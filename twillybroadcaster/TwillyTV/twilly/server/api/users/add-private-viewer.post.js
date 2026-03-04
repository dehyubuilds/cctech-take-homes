import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

/**
 * Add a user to view private content
 * SIMPLIFIED: Mirrors the simplicity of public add (request-follow.post.js)
 * 
 * Flow:
 * 1. Owner adds viewer to their private timeline
 * 2. Creates ADDED_USERNAME entry: PK=USER#viewerEmail, SK=ADDED_USERNAME#ownerEmail#private
 * 3. Populates viewer's timeline with owner's existing private content
 * 4. Creates notification for viewer
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    let { ownerUsername, viewerUsername, ownerEmail, viewerEmail } = body;

    console.log(`\n🔒 [add-private-viewer] ========== START ==========`);
    console.log(`   Owner: ${ownerUsername} (${ownerEmail || 'lookup needed'})`);
    console.log(`   Viewer: ${viewerUsername} (${viewerEmail || 'lookup needed'})`);

    if (!ownerUsername || !viewerUsername) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: ownerUsername and viewerUsername'
      });
    }

    // Normalize inputs (trim but preserve spaces for exact matching)
    ownerUsername = ownerUsername.trim();
    viewerUsername = viewerUsername.trim();

    // Helper function to normalize username for comparison (remove spaces, lowercase)
    const normalizeUsernameForComparison = (username) => {
      if (!username) return '';
      return username.replace(/\s+/g, '').toLowerCase();
    };

    // Helper function to resolve email from username with robust matching
    const resolveEmailFromUsername = async (username, userType) => {
      // Try exact match first (preserve spaces and case for GSI query)
      const exactVariations = [
        username, // Original with spaces
        username.toLowerCase(),
        username.charAt(0).toUpperCase() + username.slice(1).toLowerCase()
      ];
      
      // Also try variations with different spacing
      const spaceVariations = [
        username.replace(/\s+/g, ''), // No spaces
        username.replace(/\s+/g, ' '), // Single space
        username.replace(/\s+/g, '_'), // Underscores
      ];
      
      const allVariations = [...new Set([...exactVariations, ...spaceVariations])];
      const normalizedSearch = normalizeUsernameForComparison(username);
      
      console.log(`🔍 [add-private-viewer] Looking up ${userType} with username: "${username}" (normalized: "${normalizedSearch}")`);
      console.log(`   Trying ${allVariations.length} variations: ${allVariations.map(v => `"${v}"`).join(', ')}`);
      
      // CRITICAL FIX: Collect ALL matches from both public and private GSI queries
      // Then sort by priority and pick the best one (email field > email in PK > UUID)
      const allMatches = [];
      
      // First, try exact GSI queries and collect all matches
      for (const variation of allVariations) {
        for (const visibility of ['public', 'private']) {
          const gsiParams = {
            TableName: table,
            IndexName: 'UsernameSearchIndex',
            KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
            ExpressionAttributeValues: {
              ':visibility': visibility,
              ':username': variation
            },
            Limit: 10 // Get multiple matches to compare
          };
          
          try {
            const gsiResult = await dynamodb.query(gsiParams).promise();
            if (gsiResult.Items && gsiResult.Items.length > 0) {
              // Check for normalized match (handles spaces, case)
              const matchingUsers = gsiResult.Items.filter(item => {
                if (!item.username) return false;
                const itemNormalized = normalizeUsernameForComparison(item.username);
                return itemNormalized === normalizedSearch;
              });
              
              // Add all matching users to the collection
              for (const user of matchingUsers) {
                // Extract email and determine priority
                let email = user.email;
                if (!email && user.PK && user.PK.startsWith('USER#')) {
                  email = user.PK.replace('USER#', '');
                }
                
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(email);
                const hasEmailField = !!user.email;
                const hasEmailInPK = email && email.includes('@') && !isUUID;
                
                // Priority: 3 = has email field, 2 = email in PK, 1 = UUID
                let priority = 0;
                if (hasEmailField) priority = 3;
                else if (hasEmailInPK) priority = 2;
                else if (isUUID) priority = 1;
                
                allMatches.push({
                  user,
                  email,
                  priority,
                  visibility,
                  isUUID,
                  hasEmailField,
                  hasEmailInPK
                });
              }
            }
          } catch (queryError) {
            // If this specific query fails, continue to next visibility
            console.log(`⚠️ [add-private-viewer] GSI query failed for visibility ${visibility}, variation "${variation}": ${queryError.message}`);
          }
        }
      }
      
      // Sort matches by priority (highest first), then process UUID matches to find actual email
      allMatches.sort((a, b) => b.priority - a.priority);
      
      console.log(`🔍 [add-private-viewer] Found ${allMatches.length} total matches from GSI queries`);
      allMatches.forEach((match, idx) => {
        console.log(`   [${idx + 1}] Priority ${match.priority}: ${match.user.username} (${match.email}) [${match.visibility}]`);
      });
      
      // Process matches in priority order, starting with the best one
      for (const match of allMatches) {
        let email = match.email;
        
        // If this is a UUID match, try to find the actual email
        if (match.isUUID) {
          console.log(`⚠️ [add-private-viewer] Processing UUID match: ${email}, querying PROFILE for actual email...`);
          try {
            const profileParams = {
              TableName: table,
              Key: {
                PK: match.user.PK,
                SK: 'PROFILE'
              }
            };
            const profileResult = await dynamodb.get(profileParams).promise();
            if (profileResult.Item && profileResult.Item.email) {
              email = profileResult.Item.email;
              console.log(`✅ [add-private-viewer] Found actual email in PROFILE: ${email}`);
            } else {
              // Try to find PROFILE with same username that has email
              console.log(`⚠️ [add-private-viewer] PROFILE with UUID PK has no email, searching for PROFILE with email...`);
              const scanParams = {
                TableName: table,
                FilterExpression: 'SK = :sk AND username = :username',
                ExpressionAttributeValues: {
                  ':sk': 'PROFILE',
                  ':username': match.user.username
                },
                Limit: 10
              };
              const scanResult = await dynamodb.scan(scanParams).promise();
              const profileWithEmail = scanResult.Items?.find(item => {
                const pkEmail = item.PK?.replace('USER#', '');
                return pkEmail && pkEmail.includes('@') && item.email;
              });
              if (profileWithEmail) {
                email = profileWithEmail.email || profileWithEmail.PK?.replace('USER#', '');
                console.log(`✅ [add-private-viewer] Found PROFILE with email: ${email}`);
              }
            }
          } catch (profileError) {
            console.log(`⚠️ [add-private-viewer] Error querying PROFILE: ${profileError.message}`);
          }
        }
        
        // If we have a valid email, return it
        if (email && email.includes('@')) {
          console.log(`✅ [add-private-viewer] Selected ${userType} via GSI match: "${match.user.username}" (${email}) [priority ${match.priority}, visibility ${match.visibility}]`);
          return email.toLowerCase();
        }
      }
      
      // Fallback: Scan GSI and do normalized matching (handles weird spacing)
      // Only do this if we didn't find any matches in the exact queries above
      if (allMatches.length === 0) {
        console.log(`🔍 [add-private-viewer] Exact GSI match failed, scanning GSI for normalized match...`);
        const scanMatches = [];
        
        for (const visibility of ['public', 'private']) {
          const scanParams = {
            TableName: table,
            IndexName: 'UsernameSearchIndex',
            KeyConditionExpression: 'usernameVisibility = :visibility',
            ExpressionAttributeValues: {
              ':visibility': visibility
            }
          };
          
          let lastEvaluatedKey = null;
          do {
            if (lastEvaluatedKey) {
              scanParams.ExclusiveStartKey = lastEvaluatedKey;
            }
            
            try {
              const scanResult = await dynamodb.query(scanParams).promise();
              const foundUsers = scanResult.Items.filter(item => {
                if (!item.username) return false;
                const itemNormalized = normalizeUsernameForComparison(item.username);
                return itemNormalized === normalizedSearch;
              });
              
              // Add all matching users to the collection
              for (const user of foundUsers) {
                let email = user.email;
                if (!email && user.PK && user.PK.startsWith('USER#')) {
                  email = user.PK.replace('USER#', '');
                }
                
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(email);
                const hasEmailField = !!user.email;
                const hasEmailInPK = email && email.includes('@') && !isUUID;
                
                let priority = 0;
                if (hasEmailField) priority = 3;
                else if (hasEmailInPK) priority = 2;
                else if (isUUID) priority = 1;
                
                scanMatches.push({
                  user,
                  email,
                  priority,
                  visibility,
                  isUUID,
                  hasEmailField,
                  hasEmailInPK
                });
              }
              
              lastEvaluatedKey = scanResult.LastEvaluatedKey;
            } catch (scanError) {
              console.log(`⚠️ [add-private-viewer] GSI scan failed for visibility ${visibility}: ${scanError.message}`);
              break;
            }
          } while (lastEvaluatedKey);
        }
        
        // Sort scan matches by priority
        scanMatches.sort((a, b) => b.priority - a.priority);
        
        // Process scan matches in priority order
        for (const match of scanMatches) {
          let email = match.email;
          
          if (match.isUUID) {
            console.log(`⚠️ [add-private-viewer] Processing UUID match from scan: ${email}, querying PROFILE for actual email...`);
            try {
              const profileParams = {
                TableName: table,
                Key: {
                  PK: match.user.PK,
                  SK: 'PROFILE'
                }
              };
              const profileResult = await dynamodb.get(profileParams).promise();
              if (profileResult.Item && profileResult.Item.email) {
                email = profileResult.Item.email;
                console.log(`✅ [add-private-viewer] Found actual email in PROFILE: ${email}`);
              } else {
                const scanParams = {
                  TableName: table,
                  FilterExpression: 'SK = :sk AND username = :username',
                  ExpressionAttributeValues: {
                    ':sk': 'PROFILE',
                    ':username': match.user.username
                  },
                  Limit: 10
                };
                const scanResult = await dynamodb.scan(scanParams).promise();
                const profileWithEmail = scanResult.Items?.find(item => {
                  const pkEmail = item.PK?.replace('USER#', '');
                  return pkEmail && pkEmail.includes('@') && item.email;
                });
                if (profileWithEmail) {
                  email = profileWithEmail.email || profileWithEmail.PK?.replace('USER#', '');
                  console.log(`✅ [add-private-viewer] Found PROFILE with email: ${email}`);
                }
              }
            } catch (profileError) {
              console.log(`⚠️ [add-private-viewer] Error querying PROFILE: ${profileError.message}`);
            }
          }
          
          if (email && email.includes('@')) {
            console.log(`✅ [add-private-viewer] Selected ${userType} via GSI scan: "${match.user.username}" (${email}) [priority ${match.priority}, visibility ${match.visibility}]`);
            return email.toLowerCase();
          }
        }
      }
      
      return null;
    };

    // ============================================
    // STEP 1: Resolve ownerEmail from ownerUsername
    // ============================================
    let ownerEmailFinal = ownerEmail ? ownerEmail.toLowerCase().trim() : null;
    
    if (!ownerEmailFinal) {
      ownerEmailFinal = await resolveEmailFromUsername(ownerUsername, 'owner');
      
      if (!ownerEmailFinal) {
        throw createError({
          statusCode: 404,
          statusMessage: `Owner not found: ${ownerUsername}`
        });
      }
    }

    // ============================================
    // STEP 2: Resolve viewerEmail from viewerUsername
    // ============================================
    let viewerEmailFinal = viewerEmail ? viewerEmail.toLowerCase().trim() : null;
    
    if (!viewerEmailFinal) {
      viewerEmailFinal = await resolveEmailFromUsername(viewerUsername, 'viewer');
      
      if (!viewerEmailFinal) {
        throw createError({
          statusCode: 404,
          statusMessage: `Viewer not found: ${viewerUsername}`
        });
      }
    }

    // ============================================
    // STEP 3: Get owner's username from PROFILE (single source of truth)
    // ============================================
    const ownerProfileParams = {
      TableName: table,
      Key: {
        PK: `USER#${ownerEmailFinal}`,
        SK: 'PROFILE'
      }
    };
    
    const ownerProfile = await dynamodb.get(ownerProfileParams).promise();
    if (!ownerProfile.Item || !ownerProfile.Item.username) {
      throw createError({
        statusCode: 404,
        statusMessage: `Owner profile not found: ${ownerEmailFinal}`
      });
    }
    
    const ownerUsernameFinal = ownerProfile.Item.username;

    // ============================================
    // STEP 4: Check if already added (SIMPLE - like public)
    // ============================================
    const existingParams = {
      TableName: table,
      Key: {
        PK: `USER#${viewerEmailFinal}`,
        SK: `ADDED_USERNAME#${ownerEmailFinal}#private`
      }
    };
    
    const existing = await dynamodb.get(existingParams).promise();
    let entryAlreadyExists = false;
    
    if (existing.Item && existing.Item.status === 'active') {
      console.log(`⚠️ [add-private-viewer] Already added - will still create notification`);
      entryAlreadyExists = true;
    }

    // ============================================
    // STEP 5: Create ADDED_USERNAME entry (only if not already exists)
    // ============================================
    if (!entryAlreadyExists) {
      const addParams = {
        TableName: table,
        Item: {
          PK: `USER#${viewerEmailFinal}`,
          SK: `ADDED_USERNAME#${ownerEmailFinal}#private`,
          status: 'active',
          addedAt: new Date().toISOString(),
          streamerUsername: ownerUsernameFinal, // PROFILE username (single source of truth)
          streamerEmail: ownerEmailFinal,
          streamerVisibility: 'private',
          addedByOwner: true
        }
      };

      await dynamodb.put(addParams).promise();
      console.log(`✅ [add-private-viewer] Created ADDED_USERNAME entry`);
      // Reverse index for fan-out (query by creator, no scan)
      await dynamodb.put({
        TableName: table,
        Item: {
          PK: `STREAMER_FOLLOWERS#${ownerEmailFinal}`,
          SK: `VIEWER#${viewerEmailFinal}`,
          streamerVisibility: 'private',
          status: 'active',
          addedAt: new Date().toISOString()
        }
      }).promise();
    } else {
      console.log(`ℹ️ [add-private-viewer] Entry already exists - skipping creation`);
    }

    // ============================================
    // STEP 6: Populate timeline (async, don't block)
    // ============================================
    try {
      const { populateTimelineOnAdd } = await import('../channels/timeline-utils.js');
      populateTimelineOnAdd(
        viewerEmailFinal,
        ownerEmailFinal,
        ownerUsernameFinal,
        'private'
      ).catch(err => {
        console.error(`⚠️ [add-private-viewer] Timeline population failed (non-blocking): ${err.message}`);
      });
    } catch (err) {
      console.error(`⚠️ [add-private-viewer] Timeline population error (non-blocking): ${err.message}`);
    }

    // ============================================
    // STEP 7: Create notification (SIMPLE - always create, no idempotency check)
    // ============================================
    try {
      // CRITICAL: Verify viewerEmailFinal is correct before creating notification
      console.log(`🔍 [add-private-viewer] Verifying viewer email before creating notification:`);
      console.log(`   Viewer username: "${viewerUsername}"`);
      console.log(`   Resolved viewer email: "${viewerEmailFinal}"`);
      
      // Double-check by querying PROFILE to ensure email matches
      const viewerProfileCheck = {
        TableName: table,
        Key: {
          PK: `USER#${viewerEmailFinal}`,
          SK: 'PROFILE'
        }
      };
      
      const viewerProfileResult = await dynamodb.get(viewerProfileCheck).promise();
      if (viewerProfileResult.Item && viewerProfileResult.Item.username) {
        const profileUsername = viewerProfileResult.Item.username;
        const normalizedProfileUsername = normalizeUsernameForComparison(profileUsername);
        const normalizedViewerUsername = normalizeUsernameForComparison(viewerUsername);
        
        if (normalizedProfileUsername !== normalizedViewerUsername) {
          console.log(`⚠️ [add-private-viewer] WARNING: Profile username mismatch!`);
          console.log(`   Expected: "${viewerUsername}" (normalized: "${normalizedViewerUsername}")`);
          console.log(`   Found in PROFILE: "${profileUsername}" (normalized: "${normalizedProfileUsername}")`);
          console.log(`   Email: "${viewerEmailFinal}"`);
          console.log(`   This might cause notification lookup issues!`);
        } else {
          console.log(`✅ [add-private-viewer] Verified: Profile username matches viewer username`);
          console.log(`   Profile username: "${profileUsername}"`);
          console.log(`   Viewer username: "${viewerUsername}"`);
          console.log(`   Email: "${viewerEmailFinal}"`);
        }
      } else {
        console.log(`⚠️ [add-private-viewer] WARNING: Could not verify viewer profile for email: "${viewerEmailFinal}"`);
      }
      
      const notificationId = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const notificationParams = {
        TableName: table,
        Item: {
          PK: `USER#${viewerEmailFinal}`,
          SK: `NOTIFICATION#${notificationId}`,
          type: 'private_access_granted',
          title: 'Private Access Granted',
          message: `You were added to ${ownerUsernameFinal}'s private timeline`,
          metadata: {
            ownerEmail: String(ownerEmailFinal),
            ownerUsername: String(ownerUsernameFinal),
            viewerEmail: String(viewerEmailFinal),
            viewerUsername: String(viewerUsername)
          },
          isRead: false,
          createdAt: new Date().toISOString()
        }
      };

      await dynamodb.put(notificationParams).promise();
      console.log(`✅ [add-private-viewer] Notification created successfully:`);
      console.log(`   PK: ${notificationParams.Item.PK}`);
      console.log(`   SK: ${notificationParams.Item.SK}`);
      console.log(`   Type: ${notificationParams.Item.type}`);
      console.log(`   Message: ${notificationParams.Item.message}`);
      console.log(`   Owner: ${ownerUsernameFinal} (${ownerEmailFinal})`);
      console.log(`   Viewer: ${viewerUsername} (${viewerEmailFinal})`);
      console.log(`   📬 Notification will be queryable with: PK=USER#${viewerEmailFinal}`);
    } catch (err) {
      console.error(`❌ [add-private-viewer] Notification creation FAILED: ${err.message}`);
      console.error(`   Stack: ${err.stack}`);
      // Don't throw - notification is non-blocking
    }

    console.log(`✅ [add-private-viewer] ========== SUCCESS ==========\n`);

    return {
      success: true,
      message: 'User added to view your private content',
      viewerEmail: viewerEmailFinal,
      viewerUsername: viewerUsername,
      ownerUsername: ownerUsernameFinal,
      ownerEmail: ownerEmailFinal
    };

  } catch (error) {
    console.error(`\n❌ [add-private-viewer] ========== ERROR ==========`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}\n`);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to add private viewer'
    });
  }
});
