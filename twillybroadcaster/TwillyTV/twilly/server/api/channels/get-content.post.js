import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials for deployment compatibility
  AWS.config.update({
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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',
    region: 'us-east-1'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const table = 'Twilly';

  try {
    const body = await readBody(event);
    const { channelName, creatorEmail, limit = 50, nextToken, viewerEmail, showPrivateContent = false, returnBothViews = false, showPremiumContent = false, clientAddedUsernames } = body;

    if (!channelName || !creatorEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: channelName and creatorEmail'
      });
    }
    
    // Validate limit
    const pageLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100); // Between 1 and 100

    // CRITICAL: Normalize private flag (DynamoDB/API can return boolean, string "true", or number 1)
    const isItemPrivate = (item) => {
      const hasLock = item.creatorUsername && String(item.creatorUsername).includes('🔒');
      const isPrivateFlag = item.isPrivateUsername === true || item.isPrivateUsername === 'true' || item.isPrivateUsername === 1;
      return !!hasLock || !!isPrivateFlag;
    };

    console.log(`🔍 [get-content] Fetching content for channel: "${channelName}" by ${creatorEmail}${viewerEmail ? ` (viewer: ${viewerEmail})` : ''}`);

    // Premium timeline: for non–Twilly TV use subscription-based feed; for Twilly TV use main flow and filter by isPremium (below)
    const isTwillyTV = (channelName || '').toLowerCase().trim() === 'twilly tv';
    if (showPremiumContent && viewerEmail && !isTwillyTV) {
      const normalizedViewer = (viewerEmail || '').toLowerCase().trim();
      const pageLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
      try {
        const subQuery = await dynamodb.query({
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          FilterExpression: '#status = :active',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':pk': `USER#${normalizedViewer}`,
            ':skPrefix': 'SUBSCRIBED_CREATOR#',
            ':active': 'active'
          }
        }).promise();
        const premiumCreatorEmails = (subQuery.Items || [])
          .map(it => it.creatorEmail || (it.SK && it.SK.startsWith('SUBSCRIBED_CREATOR#') ? it.SK.replace('SUBSCRIBED_CREATOR#', '') : null))
          .filter(Boolean);
        if (premiumCreatorEmails.length === 0) {
          console.log(`👑 [get-content] Premium timeline: no active subscriptions for ${normalizedViewer}`);
          return { success: true, content: [], nextToken: null, hasMore: false };
        }
        console.log(`👑 [get-content] Premium timeline: ${premiumCreatorEmails.length} creators for ${normalizedViewer}`);
        const allFiles = [];
        for (const creatorEmail of premiumCreatorEmails) {
          const fileResult = await dynamodb.query({
            TableName: table,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
            ExpressionAttributeValues: {
              ':pk': `USER#${creatorEmail.toLowerCase()}`,
              ':skPrefix': 'FILE#'
            },
            Limit: 50
          }).promise();
          const items = (fileResult.Items || []).map(f => ({ ...f, creatorEmail: creatorEmail.toLowerCase() }));
          allFiles.push(...items);
        }
        const visible = allFiles.filter(file => {
          const isVisible = file.isVisible === true;
          const hasContent = file.hlsUrl || file.category === 'Videos';
          const hasThumbnail = file.thumbnailUrl && String(file.thumbnailUrl).trim();
          if (file.category === 'Videos' && !hasThumbnail) return false;
          return isVisible && hasContent;
        });
        const sorted = visible.sort((a, b) => {
          const ta = (a.createdAt || a.timestamp || '').replace('Z', '');
          const tb = (b.createdAt || b.timestamp || '').replace('Z', '');
          return tb.localeCompare(ta);
        });
        for (const item of sorted) {
          if (!item.creatorUsername) {
            const email = (item.PK || '').replace('USER#', '') || item.creatorEmail;
            if (email) {
              try {
                const profile = await dynamodb.get({
                  TableName: table,
                  Key: { PK: `USER#${email}`, SK: 'PROFILE' }
                }).promise();
                if (profile.Item && profile.Item.username) item.creatorUsername = profile.Item.username;
                if (!item.creatorEmail) item.creatorEmail = email;
              } catch (_) {}
            }
          }
          if (item.isPrivateUsername === undefined) item.isPrivateUsername = false;
          if (item.isPremium === undefined) item.isPremium = false;
        }
        const paginated = sorted.slice(0, pageLimit);
        const nextTokenResult = sorted.length > pageLimit ? Buffer.from(JSON.stringify({ last: paginated[paginated.length - 1]?.SK })).toString('base64') : null;
        const content = paginated.map(item => ({
          SK: item.SK,
          fileName: item.fileName,
          title: item.title,
          description: item.description,
          hlsUrl: item.hlsUrl,
          thumbnailUrl: item.thumbnailUrl,
          createdAt: item.createdAt || item.timestamp,
          isVisible: item.isVisible,
          price: item.price,
          category: item.category,
          uploadId: item.uploadId,
          fileId: item.fileId,
          airdate: item.airdate,
          creatorUsername: item.creatorUsername,
          creatorEmail: item.creatorEmail,
          isPrivateUsername: item.isPrivateUsername,
          isPremium: item.isPremium,
          status: item.status,
          scheduledDropDate: item.scheduledDropDate,
          durationSeconds: item.durationSeconds
        }));
        console.log(`👑 [get-content] Premium timeline returning ${content.length} items`);
        return {
          success: true,
          content,
          nextToken: nextTokenResult,
          hasMore: nextTokenResult !== null
        };
      } catch (premiumErr) {
        console.error('👑 [get-content] Premium timeline error:', premiumErr);
        return { success: true, content: [], nextToken: null, hasMore: false };
      }
    }

    // CRITICAL: For Twilly TV channel, get added usernames for filtering
    // Twilly TV is a curated timeline - viewers only see posts from:
    // 1. Their own username (always included - streamer sees their own streams)
    // 2. Public users they've explicitly added (auto-accepted) - only see PUBLIC content
    // 3. Private users they've requested to add AND been accepted by - only see PRIVATE content
    // The ADDED_USERNAME# entries with status='active' already represent both cases
    // CRITICAL FIX: Track visibility per username to prevent seeing private content from users added for public
    let addedUsernamesPublic = new Set(); // Usernames added for PUBLIC visibility
    let addedUsernamesPrivate = new Set(); // Usernames added for PRIVATE visibility
    let addedUserEmails = new Set();
    let viewerOwnUsername = null; // Viewer's own username (always included)
    
    // OPTIMIZATION: Get viewer's own username early for Twilly TV
    // CRITICAL PERFORMANCE FIX: Use direct query instead of slow SCAN operation
    // Query PK=USER#email, SK=PROFILE for instant lookup (O(1) instead of O(n))
    // CRITICAL: Normalize viewerEmail to lowercase for consistent lookups (ADDED_USERNAME entries use lowercase)
    if (channelName.toLowerCase() === 'twilly tv' && viewerEmail) {
      const normalizedViewerEmail = viewerEmail.toLowerCase();
      try {
        // FAST PATH: Direct query using PK and SK (instant lookup)
        const profileParams = {
          TableName: table,
          Key: {
            PK: `USER#${normalizedViewerEmail}`,
            SK: 'PROFILE'
          }
        };
        
        const profileResult = await dynamodb.get(profileParams).promise();
        
        if (profileResult.Item && profileResult.Item.username) {
          // CRITICAL FIX: Normalize viewer's own username the SAME way as when comparing (trim + lowercase)
          // This ensures usernames with spaces (like "Twilly TV") match correctly
          viewerOwnUsername = profileResult.Item.username.trim().toLowerCase();
          // CRITICAL: DO NOT add viewer's own username to the sets - own videos are handled separately via isOwnVideo check
          // Adding it would cause duplicates: once from isOwnVideo check, once from added username check
          console.log(`✅ [get-content] Twilly TV: Found viewer's own username: "${profileResult.Item.username}" (normalized: "${viewerOwnUsername}") (will see own content via isOwnVideo check, NOT via added username sets) - FAST QUERY`);
        } else {
          console.log(`⚠️ [get-content] Twilly TV: No PROFILE found for viewer: ${normalizedViewerEmail}`);
        }
      } catch (error) {
        console.log(`⚠️ [get-content] Error fetching viewer's own username: ${error.message}`);
      }
      try {
        console.log(`🔍 [get-content] Twilly TV channel - fetching added usernames for viewer: ${normalizedViewerEmail}`);
        
        // Query for added usernames with status='active'
        // This includes:
        // - Public users: auto-accepted when added (status='active', streamerVisibility='public')
        // - Private users: only after request is accepted (status='active', streamerVisibility='private')
        // CRITICAL: Use normalizedViewerEmail (lowercase) to match ADDED_USERNAME entries
        const addedUsernamesParams = {
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          FilterExpression: '#status = :status',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':pk': `USER#${normalizedViewerEmail}`,
            ':skPrefix': 'ADDED_USERNAME#',
            ':status': 'active'
          }
        };

        const addedResult = await dynamodb.query(addedUsernamesParams).promise();
        if (addedResult.Items && addedResult.Items.length > 0) {
          console.log(`🔍 [get-content] DEBUG: Processing ${addedResult.Items.length} ADDED_USERNAME items from DynamoDB`);
          addedResult.Items.forEach((item, index) => {
            console.log(`  [Item ${index + 1}] streamerUsername: "${item.streamerUsername || 'MISSING'}", streamerVisibility: "${item.streamerVisibility || 'public'}"`);
            if (item.streamerUsername) {
              // CRITICAL FIX: Normalize username the SAME way as when comparing (trim + lowercase)
              // This ensures usernames with spaces (like "Twilly TV" or "POM-J ") match correctly
              const normalizedUsername = item.streamerUsername.trim().toLowerCase();
              const visibility = item.streamerVisibility || 'public'; // Default to public if not set
              
              console.log(`    → Normalized: "${normalizedUsername}" (original: "${item.streamerUsername}", visibility: ${visibility})`);
              
              // CRITICAL: Track visibility separately - users added for public should NEVER see private content
              if (visibility.toLowerCase() === 'private') {
                addedUsernamesPrivate.add(normalizedUsername);
                console.log(`    ✅ Added to PRIVATE set: "${normalizedUsername}"`);
              } else {
                addedUsernamesPublic.add(normalizedUsername);
                console.log(`    ✅ Added to PUBLIC set: "${normalizedUsername}"`);
              }
            }
            if (item.streamerEmail) {
              addedUserEmails.add(item.streamerEmail.toLowerCase());
            }
          });
          console.log(`✅ [get-content] Found ${addedUsernamesPublic.size} public and ${addedUsernamesPrivate.size} private added usernames for Twilly TV filtering`);
          console.log(`   📋 PUBLIC usernames in set: [${Array.from(addedUsernamesPublic).map(u => `"${u}"`).join(', ')}]`);
          console.log(`   📋 PRIVATE usernames in set: [${Array.from(addedUsernamesPrivate).map(u => `"${u}"`).join(', ')}]`);
          console.log(`   Public: [${Array.from(addedUsernamesPublic).join(', ')}]`);
          console.log(`   Private: [${Array.from(addedUsernamesPrivate).join(', ')}]`);
        } else {
          console.log(`⚠️ [get-content] No added usernames found in DynamoDB - Twilly TV timeline will be empty`);
        }
        
        // SIMPLIFIED: Check if viewer was added to OTHER users' private timelines (reverse relationship)
        // Entry format: PK=USER#viewerEmail, SK=ADDED_USERNAME#creatorEmail#private
        // SIMPLE: Just query directly for entries where PK = viewerEmail and SK starts with ADDED_USERNAME# and ends with #private
        try {
          console.log(`🔍 [get-content] Checking reverse private relationships for ${normalizedViewerEmail}...`);
          
          // SIMPLE: Query directly for entries where viewer was added (PK = viewerEmail)
          const reverseQueryParams = {
            TableName: table,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
            ExpressionAttributeValues: {
              ':pk': `USER#${normalizedViewerEmail}`,
              ':skPrefix': 'ADDED_USERNAME#'
            }
          };
          
          const reverseQueryResult = await dynamodb.query(reverseQueryParams).promise();
          
          if (reverseQueryResult.Items && reverseQueryResult.Items.length > 0) {
            // Filter for private entries only AND exclude direct entries (where viewer added the creator)
            // CRITICAL: The query finds ALL entries where PK=USER#viewerEmail, including:
            // 1. Direct entries: SK=ADDED_USERNAME#ownerEmail#private (viewer added owner) - already processed above
            // 2. Reverse entries: SK=ADDED_USERNAME#creatorEmail#private (creator added viewer) - these are what we want here
            // We need to distinguish: reverse entries are where the creator (from SK) added the viewer
            // Direct entries are already in the set from the first query, so we skip them here
            const privateEntries = reverseQueryResult.Items.filter(entry => {
              const isPrivate = entry.SK.includes('#private') || entry.streamerVisibility === 'private';
              const isActive = entry.status === 'active';
              
              // CRITICAL: Skip entries that are already in the set (direct entries)
              // Direct entries have streamerEmail matching the creator, and are already processed above
              // Reverse entries have a different creator email in the SK
              if (!isPrivate || !isActive) return false;
              
              // Extract creator email from SK: ADDED_USERNAME#creatorEmail#private
              const skParts = entry.SK.split('#');
              if (skParts.length >= 3) {
                const creatorEmailFromSK = skParts[1].toLowerCase();
                // Check if this creator is already in the set (from direct entry processing above)
                // If streamerEmail matches creatorEmailFromSK, this is a direct entry, skip it
                if (entry.streamerEmail && entry.streamerEmail.toLowerCase() === creatorEmailFromSK) {
                  // This is a direct entry (viewer added creator) - already processed, skip
                  return false;
                }
                // This is a reverse entry (creator added viewer) - process it
                return true;
              }
              return false;
            });
            
            console.log(`✅ [get-content] Found ${privateEntries.length} reverse private relationships (creators who added viewer)`);
            
            // For each reverse entry, extract creator email from SK and add to set
            for (const entry of privateEntries) {
              // Extract creator email from SK: ADDED_USERNAME#creatorEmail#private
              const skParts = entry.SK.split('#');
              if (skParts.length >= 3) {
                const creatorEmail = skParts[1].toLowerCase();
                
                // Get creator's username from PROFILE
                try {
                  const creatorProfile = await dynamodb.get({
                    TableName: table,
                    Key: {
                      PK: `USER#${creatorEmail}`,
                      SK: 'PROFILE'
                    }
                  }).promise();
                  
                  if (creatorProfile.Item?.username) {
                    const creatorUsername = creatorProfile.Item.username.trim().toLowerCase();
                    // CRITICAL: Only add if not already in set (avoid duplicates)
                    if (!addedUsernamesPrivate.has(creatorUsername)) {
                      addedUsernamesPrivate.add(creatorUsername);
                      console.log(`   ✅ Added "${creatorProfile.Item.username}" to PRIVATE set (reverse relationship)`);
                    } else {
                      console.log(`   ℹ️ "${creatorProfile.Item.username}" already in PRIVATE set (from direct entry)`);
                    }
                  }
                } catch (err) {
                  console.log(`   ⚠️ Error fetching profile for ${creatorEmail}: ${err.message}`);
                }
              }
            }
            
            console.log(`✅ [get-content] PRIVATE set: [${Array.from(addedUsernamesPrivate).map(u => `"${u}"`).join(', ')}]`);
          } else {
            console.log(`ℹ️ [get-content] No reverse private relationships found`);
          }
        } catch (reverseError) {
          console.error(`❌ [get-content] Error checking reverse relationships:`, reverseError);
          // Continue - not critical
        }
        
        // FALLBACK: If client sent addedUsernames but server doesn't have them (e.g., auth error prevented add)
        // Look up emails for those usernames and add them to the query list
        // This ensures content appears even if the ADDED_USERNAME entry wasn't created yet
        if (clientAddedUsernames && Array.isArray(clientAddedUsernames) && clientAddedUsernames.length > 0) {
          console.log(`🔄 [get-content] Client sent ${clientAddedUsernames.length} added usernames - checking if any need to be added to public set...`);
          console.log(`   📋 Client usernames: [${clientAddedUsernames.map(u => `"${u}"`).join(', ')}]`);
          console.log(`   📋 Server public usernames: [${Array.from(addedUsernamesPublic).map(u => `"${u}"`).join(', ')}]`);
          console.log(`   📋 Server private usernames: [${Array.from(addedUsernamesPrivate).map(u => `"${u}"`).join(', ')}]`);
          const clientUsernamesSet = new Set(clientAddedUsernames.map(u => u.trim().toLowerCase()));
          
          // CRITICAL: Check each client username separately for public and private
          // A username can be in BOTH sets (added for both public and private)
          // If client sends a username, it means they want to see it - check if it's in public set
          const usernamesNotInPublic = Array.from(clientUsernamesSet).filter(u => !addedUsernamesPublic.has(u));
          const usernamesNotInPrivate = Array.from(clientUsernamesSet).filter(u => !addedUsernamesPrivate.has(u));
          
          // Find usernames that need fallback lookup (not in either set)
          const missingUsernames = Array.from(clientUsernamesSet).filter(u => !addedUsernamesPublic.has(u) && !addedUsernamesPrivate.has(u));
          
          // CRITICAL: If username is in private but NOT in public, and client sent it, add to public
          // This handles the case where user was added for private, but client also wants them for public
          // The email should already be in addedUserEmails from the server query (line 119), so we just add to public set
          const usernamesInPrivateButNotPublic = Array.from(clientUsernamesSet).filter(u => 
            addedUsernamesPrivate.has(u) && !addedUsernamesPublic.has(u)
          );
          
          if (usernamesInPrivateButNotPublic.length > 0) {
            console.log(`   📋 Usernames in private but not public (will add to public): [${usernamesInPrivateButNotPublic.map(u => `"${u}"`).join(', ')}]`);
            // Add these to public set - client sent them, so they should be public
            // Email should already be in addedUserEmails from server query (when processing ADDED_USERNAME items)
            usernamesInPrivateButNotPublic.forEach(username => {
              addedUsernamesPublic.add(username);
              console.log(`   ✅ Added "${username}" to PUBLIC set (was only in private, client wants public - email should already be in query list)`);
            });
          }
          
          if (missingUsernames.length > 0) {
            console.log(`   📋 Missing usernames from server: [${missingUsernames.map(u => `"${u}"`).join(', ')}]`);
            console.log(`   🔍 Looking up emails for missing usernames...`);
            
            // Look up emails for missing usernames
            // OPTIMIZATION: Use a single scan with filter for all missing usernames
            // This is more efficient than scanning for each username individually
            try {
              console.log(`   🔍 Scanning PROFILE entries for ${missingUsernames.length} missing usernames...`);
              const allProfilesScan = {
                TableName: table,
                FilterExpression: 'SK = :sk',
                ExpressionAttributeValues: {
                  ':sk': 'PROFILE'
                }
              };
              const allProfilesResult = await dynamodb.scan(allProfilesScan).promise();
              const profiles = allProfilesResult.Items || [];
              
              console.log(`   📋 Scanned ${profiles.length} PROFILE entries`);
              
              // Match usernames (case-insensitive, trimmed)
              for (const username of missingUsernames) {
                const matchingProfile = profiles.find(p => {
                  if (!p.username) return false;
                  const profileUsername = p.username.trim().toLowerCase();
                  return profileUsername === username;
                });
                
                if (matchingProfile) {
                  const userEmail = matchingProfile.PK?.replace('USER#', '') || matchingProfile.email;
                  if (userEmail) {
                    addedUserEmails.add(userEmail.toLowerCase());
                    // Add to appropriate set based on visibility (default to public for fallback)
                    addedUsernamesPublic.add(username);
                    console.log(`   ✅ Found email for "${username}": ${userEmail} (original username: "${matchingProfile.username}") (added to query list)`);
                  } else {
                    console.log(`   ⚠️ Found profile for "${username}" but no email in PK or email field`);
                  }
                } else {
                  console.log(`   ⚠️ Could not find PROFILE entry for username "${username}" - will not query this user's content`);
                }
              }
            } catch (error) {
              console.log(`   ❌ Error looking up emails for missing usernames: ${error.message}`);
            }
            
            if (addedUserEmails.size > 0) {
              console.log(`   ✅ Fallback complete - will query ${addedUserEmails.size} user accounts (including fallback lookups)`);
            }
          } else {
            console.log(`   ✅ All client usernames are already in server list - no fallback needed`);
          }
        }
      } catch (error) {
        console.error(`❌ [get-content] Error fetching added usernames:`, error);
        // Continue without filtering if there's an error
      }
    }

    // Initialize array to collect all content
    let allContent = [];
    let queryResult = null;

    // Step 1: Find the channel ID (needed to look up legitimate collaborators)
    let channelId = null;
    try {
      // OPTIMIZED: Use GSI for fast channel lookup by name
      // GSI: ChannelsByNameIndex
      //   Partition Key: channelName
      //   Sort Key: PK (CHANNEL#...)
      let channelResult = null;
      let useGSI = true;
      
      try {
        const queryParams = {
          TableName: table,
          IndexName: 'ChannelsByNameIndex',
          KeyConditionExpression: 'channelName = :channelName AND begins_with(PK, :pkPrefix)',
          ExpressionAttributeValues: {
            ':channelName': channelName,
            ':pkPrefix': 'CHANNEL#'
          },
          Limit: 1
        };
        
        channelResult = await dynamodb.query(queryParams).promise();
        console.log(`✅ [get-content] Queried GSI for channel "${channelName}": Found ${channelResult.Items?.length || 0} channels`);
      } catch (error) {
        // If GSI doesn't exist yet, fall back to scan
        if (error.code === 'ResourceNotFoundException' || 
            error.message.includes('index') || 
            error.message.includes('ChannelsByNameIndex')) {
          console.log('⚠️  [get-content] GSI not available, falling back to scan...');
          useGSI = false;
        } else {
          throw error;
        }
      }
      
      // Fallback to scan if GSI not available
      if (!useGSI) {
      const channelScanParams = {
        TableName: table,
        FilterExpression: 'begins_with(PK, :pkPrefix) AND channelName = :channelName',
        ExpressionAttributeValues: {
          ':pkPrefix': 'CHANNEL#',
          ':channelName': channelName
        }
      };
        channelResult = await dynamodb.scan(channelScanParams).promise();
        console.log(`⚠️  [get-content] Fallback scan for channel "${channelName}": Found ${channelResult.Items?.length || 0} channels`);
      }
      
      if (channelResult && channelResult.Items && channelResult.Items.length > 0) {
        // Use the first matching channel
        channelId = channelResult.Items[0].channelId || channelResult.Items[0].PK.replace('CHANNEL#', '');
        console.log(`🔍 [get-content] Found channel ID: ${channelId} for channel "${channelName}"`);
      } else {
        // Fallback: use channelName as channelId (some channels use channelName as ID)
        channelId = channelName;
        console.log(`⚠️ [get-content] Channel not found, using channelName as channelId: ${channelId}`);
      }
    } catch (error) {
      console.error('Error finding channel:', error);
      channelId = channelName; // Fallback
    }

    // Step 2: Find ONLY legitimate collaborators (users with addedViaInvite: true)
    // SECURITY: Only include users who have explicitly accepted invite codes
    // COLLABORATOR_ROLE records are stored as: PK = USER#userId, SK = COLLABORATOR_ROLE#channelId
    const legitimateCollaboratorUserIds = new Set();
    try {
      // Try multiple possible channelId formats (channelId can be email-channelName or just channelName)
      const possibleChannelIds = [channelId, channelName];
      
      for (const possibleId of possibleChannelIds) {
        try {
          // OPTIMIZED: Use GSI for fast collaborator role lookup
          // GSI: CollaboratorRolesByChannelIndex
          //   Partition Key: channelId
          //   Sort Key: PK (USER#userId)
          let useGSI = true;
          let collaboratorScanResult = null;
          
          try {
            const queryParams = {
              TableName: table,
              IndexName: 'CollaboratorRolesByChannelIndex',
              KeyConditionExpression: 'channelId = :channelId AND begins_with(PK, :pkPrefix)',
              FilterExpression: 'begins_with(SK, :skPrefix) AND (channelId = :channelId OR channelName = :channelName) AND addedViaInvite = :addedViaInvite AND #status = :status',
              ExpressionAttributeNames: {
                '#status': 'status'
              },
              ExpressionAttributeValues: {
                ':channelId': possibleId,
                ':pkPrefix': 'USER#',
                ':skPrefix': 'COLLABORATOR_ROLE#',
                ':channelName': channelName,
                ':addedViaInvite': true,
                ':status': 'active'
              }
            };
            
            let lastEvaluatedKey = null;
            let allItems = [];
            do {
              if (lastEvaluatedKey) {
                queryParams.ExclusiveStartKey = lastEvaluatedKey;
              }
              
              const result = await dynamodb.query(queryParams).promise();
              if (result.Items) {
                allItems = allItems.concat(result.Items);
              }
              lastEvaluatedKey = result.LastEvaluatedKey;
            } while (lastEvaluatedKey);
            
            collaboratorScanResult = { Items: allItems };
            console.log(`✅ [get-content] Queried GSI for collaborators: Found ${allItems.length} roles for channelId ${possibleId}`);
          } catch (error) {
            // If GSI doesn't exist yet, fall back to scan
            if (error.code === 'ResourceNotFoundException' || 
                error.message.includes('index') || 
                error.message.includes('CollaboratorRolesByChannelIndex')) {
              console.log(`⚠️  [get-content] GSI not available for channelId ${possibleId}, falling back to scan...`);
              useGSI = false;
            } else {
              throw error;
            }
          }
          
          // Fallback to scan if GSI not available
          if (!useGSI) {
          let lastEvaluatedKey = null;
          do {
            const collaboratorScanParams = {
              TableName: table,
              FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND (channelId = :channelId OR channelName = :channelName) AND addedViaInvite = :addedViaInvite AND #status = :status',
              ExpressionAttributeNames: {
                '#status': 'status'
              },
              ExpressionAttributeValues: {
                ':pkPrefix': 'USER#',
                ':skPrefix': 'COLLABORATOR_ROLE#',
                ':channelId': possibleId,
                ':channelName': channelName,
                ':addedViaInvite': true,
                ':status': 'active'
              }
            };
            
            if (lastEvaluatedKey) {
              collaboratorScanParams.ExclusiveStartKey = lastEvaluatedKey;
            }
            
              collaboratorScanResult = await dynamodb.scan(collaboratorScanParams).promise();
              lastEvaluatedKey = collaboratorScanResult.LastEvaluatedKey;
            } while (lastEvaluatedKey);
            
            console.log(`⚠️  [get-content] Fallback scan for collaborators: Found ${collaboratorScanResult.Items?.length || 0} roles for channelId ${possibleId}`);
          }
          
          if (collaboratorScanResult && collaboratorScanResult.Items) {
              collaboratorScanResult.Items.forEach(role => {
                // Extract userId from PK (format: USER#userId)
                const userId = role.PK ? role.PK.replace('USER#', '') : null;
                if (userId) {
                  legitimateCollaboratorUserIds.add(userId);
                  console.log(`✅ [get-content] Found legitimate collaborator: ${userId} for channel "${channelName}" (channelId: ${role.channelId || 'N/A'}, addedViaInvite: ${role.addedViaInvite})`);
                }
              });
            }
        } catch (error) {
          console.error(`Error scanning collaborators for channelId ${possibleId}:`, error);
        }
      }
      
      console.log(`✅ [get-content] Found ${legitimateCollaboratorUserIds.size} legitimate collaborators (addedViaInvite: true) for channel "${channelName}"`);
      if (legitimateCollaboratorUserIds.size > 0) {
        console.log(`   Collaborator userIds: ${Array.from(legitimateCollaboratorUserIds).join(', ')}`);
      }
    } catch (error) {
      console.error('Error finding legitimate collaborators:', error);
    }

    // Step 3: Get emails for legitimate collaborators (OPTIMIZED: parallel lookups)
    // Since all files are stored under master account, we only need emails for security checks
    const collaboratorEmails = new Set();
    const userIdToEmailMap = new Map();
    
    // OPTIMIZATION: Parallelize all userId lookups instead of sequential
    const userIdLookupPromises = Array.from(legitimateCollaboratorUserIds).map(async (userId) => {
      try {
        // Try to get email from USER#userId/PROFILE (most common case)
        const userProfileParams = {
          TableName: table,
          Key: {
            PK: `USER#${userId}`,
            SK: 'PROFILE'
          }
        };
        const userProfileResult = await dynamodb.get(userProfileParams).promise();
        
        if (userProfileResult.Item) {
          const email = userProfileResult.Item.email || userProfileResult.Item.userEmail;
          if (email) {
            return { userId, email, source: 'PROFILE' };
          }
        }
        
        // Also try querying USER#userId directly (faster than scan)
        const directQueryParams = {
          TableName: table,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: {
            ':pk': `USER#${userId}`
          },
          Limit: 10
        };
        const directQueryResult = await dynamodb.query(directQueryParams).promise();
        
        if (directQueryResult.Items && directQueryResult.Items.length > 0) {
          for (const item of directQueryResult.Items) {
            const email = item.email || item.userEmail;
            if (email) {
              return { userId, email, source: 'QUERY' };
            }
          }
        }
        
        // FALLBACK: Check streamKey mappings (only if needed)
        // OPTIMIZED: Use GSI for fast stream key lookup
        // GSI: StreamKeysByCreatorIndex
        //   Partition Key: creatorId
        //   Sort Key: SK
        let streamKeyScanResult = null;
        let useGSI = true;
        
        try {
          const queryParams = {
            TableName: table,
            IndexName: 'StreamKeysByCreatorIndex',
            KeyConditionExpression: 'creatorId = :creatorId AND SK = :sk',
            FilterExpression: 'begins_with(PK, :pkPrefix)',
            ExpressionAttributeValues: {
              ':creatorId': userId,
              ':sk': 'MAPPING',
              ':pkPrefix': 'STREAM_KEY#'
            },
            Limit: 1
          };
          
          streamKeyScanResult = await dynamodb.query(queryParams).promise();
          console.log(`✅ [get-content] Queried GSI for stream key: Found ${streamKeyScanResult.Items?.length || 0} mappings for creatorId ${userId}`);
        } catch (error) {
          // If GSI doesn't exist yet, fall back to scan
          if (error.code === 'ResourceNotFoundException' || 
              error.message.includes('index') || 
              error.message.includes('StreamKeysByCreatorIndex')) {
            console.log(`⚠️  [get-content] GSI not available for stream key, falling back to scan...`);
            useGSI = false;
          } else {
            throw error;
          }
        }
        
        // Fallback to scan if GSI not available
        if (!useGSI) {
        const streamKeyScanParams = {
          TableName: table,
          FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND creatorId = :creatorId',
          ExpressionAttributeValues: {
            ':pkPrefix': 'STREAM_KEY#',
            ':sk': 'MAPPING',
            ':creatorId': userId
          },
          Limit: 1
        };
          streamKeyScanResult = await dynamodb.scan(streamKeyScanParams).promise();
          console.log(`⚠️  [get-content] Fallback scan for stream key: Found ${streamKeyScanResult.Items?.length || 0} mappings`);
        }
        
        if (streamKeyScanResult && streamKeyScanResult.Items && streamKeyScanResult.Items.length > 0) {
          const streamKeyMapping = streamKeyScanResult.Items[0];
          const email = streamKeyMapping.isCollaboratorKey 
            ? (streamKeyMapping.collaboratorEmail || streamKeyMapping.ownerEmail)
            : (streamKeyMapping.ownerEmail || streamKeyMapping.collaboratorEmail);
          if (email) {
            return { userId, email, source: 'STREAM_KEY' };
          }
        }
        
        return null; // Not found
      } catch (error) {
        console.error(`Error mapping userId ${userId} to email:`, error);
        return null;
      }
    });
    
    // Wait for all lookups in parallel (much faster than sequential)
    const lookupResults = await Promise.all(userIdLookupPromises);
    lookupResults.forEach(result => {
      if (result) {
        collaboratorEmails.add(result.email);
        userIdToEmailMap.set(result.userId, result.email);
        console.log(`✅ [get-content] Mapped collaborator userId ${result.userId} -> email ${result.email} (via ${result.source})`);
      }
    });

    // Step 4: ISOLATED TIMELINES - For Twilly TV, query only PUBLIC / PRIVATE / PREMIUM (no shared bucket)
    // Schema: PK = USER#viewerEmail, SK = PUBLIC#ts#fileId#creatorEmail | PRIVATE#... | PREMIUM#...
    let allFiles = [];
    let useTimeline = false;
    let usedTimelinePrefixes = []; // e.g. ['PUBLIC', 'PRIVATE'] for returnBothViews

    if (channelName.toLowerCase() === 'twilly tv' && viewerEmail) {
      const prefixes = [];
      if (showPremiumContent) {
        prefixes.push('PREMIUM');
      } else if (returnBothViews) {
        prefixes.push('PUBLIC');
        prefixes.push('PRIVATE');
      } else if (showPrivateContent) {
        prefixes.push('PRIVATE');
      } else {
        prefixes.push('PUBLIC');
      }
      usedTimelinePrefixes = prefixes;
      console.log(`📺 [get-content] Twilly TV isolated timelines - querying: ${prefixes.join(', ')}`);
      try {
        const pk = `USER#${viewerEmail.toLowerCase()}`;
        const allEntries = [];
        for (const prefix of prefixes) {
          const timelineQueryParams = {
            TableName: table,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
            ExpressionAttributeValues: {
              ':pk': pk,
              ':skPrefix': `${prefix}#`
            },
            ScanIndexForward: false,
            Limit: pageLimit * 3
          };
          const res = await dynamodb.query(timelineQueryParams).promise();
          if (res.Items && res.Items.length > 0) {
            allEntries.push(...res.Items);
          }
        }
        // When querying a specific timeline (including PREMIUM), always use timeline path - never fall back to mixed FILE query
        if (allEntries.length > 0 || prefixes.length > 0) {
          useTimeline = true;
          if (allEntries.length > 0) {
          allFiles = allEntries.map(timelineEntry => {
            const skParts = timelineEntry.SK.split('#');
            const fileId = skParts.length > 2 ? skParts[2] : timelineEntry.fileId;
            const entryCreatorEmail = skParts.length > 3 ? skParts[3] : timelineEntry.creatorEmail;
            const creatorEmailForFile = entryCreatorEmail || timelineEntry.creatorEmail || creatorEmail;
            const timelineType = (timelineEntry.timelineType || (skParts[0] || 'PUBLIC')).toUpperCase();
            // CRITICAL: Put PK/SK after spread so client receives normalized FILE#fileId (not timeline SK).
            // Client uses SK as fileId for delete; backend expects FILE SK, not PUBLIC#timestamp#fileId#email.
            return {
              ...timelineEntry,
              fileName: timelineEntry.fileName,
              folderName: timelineEntry.folderName || channelName,
              category: timelineEntry.category || 'Videos',
              createdAt: timelineEntry.createdAt || timelineEntry.timestamp,
              timestamp: timelineEntry.timestamp || timelineEntry.createdAt,
              creatorEmail: creatorEmailForFile,
              streamerEmail: timelineEntry.streamerEmail || creatorEmailForFile,
              isTimelineEntry: true,
              timelineCreatorEmail: creatorEmailForFile,
              timelineType,
              PK: `USER#${creatorEmailForFile}`,
              SK: `FILE#${fileId}`
            };
          });
          console.log(`✅ [get-content] Isolated timeline query: ${allFiles.length} entries (${prefixes.join(', ')})`);
          }
        }
        // Merge viewer's own FILEs (HELD/scheduled) that match current view - they may not be in timeline yet.
        // If a timeline entry already exists for the same SK, refresh it from the FILE so hlsUrl/thumbnailUrl
        // are up to date (timeline entries are created at convert time and not updated when processing completes).
        if (viewerEmail) {
          try {
            const viewerFilesParams = {
              TableName: table,
              KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
              ExpressionAttributeValues: {
                ':pk': `USER#${viewerEmail.toLowerCase()}`,
                ':skPrefix': 'FILE#'
              },
              Limit: 100
            };
            const viewerFilesResult = await dynamodb.query(viewerFilesParams).promise();
            const viewerFiles = viewerFilesResult.Items || [];
            const existingSKs = new Set(allFiles.map(f => f.SK));
            for (const file of viewerFiles) {
              const isPriv = isItemPrivate(file);
              const isPrem = file.isPremium === true || file.isPremium === 'true' || file.isPremium === 1;
              const fileTimelineType = isPrem ? 'PREMIUM' : (isPriv ? 'PRIVATE' : 'PUBLIC');
              if (!prefixes.includes(fileTimelineType)) continue;
              const fileSK = file.SK || `FILE#${(file.fileId || '').replace(/^FILE#/, '')}`;
              if (existingSKs.has(fileSK)) {
                // Refresh existing timeline entry with latest FILE data so processed streams show hlsUrl/thumbnailUrl
                const idx = allFiles.findIndex(f => f.SK === fileSK);
                if (idx !== -1) {
                  allFiles[idx] = {
                    ...allFiles[idx],
                    hlsUrl: file.hlsUrl ?? allFiles[idx].hlsUrl,
                    thumbnailUrl: file.thumbnailUrl ?? allFiles[idx].thumbnailUrl,
                    isVisible: file.isVisible !== undefined ? file.isVisible : allFiles[idx].isVisible,
                    fileName: file.fileName || allFiles[idx].fileName
                  };
                }
                continue;
              }
              allFiles.push({
                ...file,
                timelineType: fileTimelineType,
                isTimelineEntry: false
              });
              existingSKs.add(fileSK);
            }
          } catch (e) {
            console.log(`⚠️ [get-content] Could not merge viewer FILEs: ${e.message}`);
          }
        }
        if (allFiles.length === 0) {
          console.log(`⚠️ [get-content] Isolated timeline query returned no entries - falling back to multi-query`);
        }
      } catch (error) {
        console.log(`⚠️ [get-content] Isolated timeline query failed: ${error.message} - falling back`);
      }
    }
    
    // Step 5: FALLBACK - If timeline not available, query from individual accounts
    if (!useTimeline) {
      const usersToQuery = new Set([creatorEmail]); // Always include master account
      
      // CRITICAL: For Twilly TV, also include viewer's own email to ensure owner videos are queried
      // Owner videos should always be included regardless of addedUsernames
      if (channelName.toLowerCase() === 'twilly tv' && viewerEmail) {
        const normalizedViewerEmail = viewerEmail.toLowerCase();
        if (normalizedViewerEmail !== creatorEmail.toLowerCase()) {
          usersToQuery.add(normalizedViewerEmail);
          console.log(`👤 [get-content] Twilly TV - Added viewer's own email to query: ${normalizedViewerEmail} (for owner videos)`);
        }
      }
      
      // CRITICAL TIMELINE FIX: For Twilly TV, add all added users' emails to query their content
      // This merges content from viewer's own account + all added users' accounts into one timeline
      if (channelName.toLowerCase() === 'twilly tv' && viewerEmail && addedUserEmails.size > 0) {
        console.log(`📺 [get-content] Twilly TV timeline mode - adding ${addedUserEmails.size} added users' accounts to query`);
        console.log(`   📋 Added user emails: [${Array.from(addedUserEmails).join(', ')}]`);
        addedUserEmails.forEach(email => {
          usersToQuery.add(email);
          console.log(`   ✅ Added user account to query: ${email}`);
        });
        console.log(`🔍 [get-content] Querying files from ${usersToQuery.size} accounts (master + viewer + ${addedUserEmails.size} added users) for timeline merge`);
      } else if (channelName.toLowerCase() === 'twilly tv' && viewerEmail) {
        console.log(`⚠️ [get-content] Twilly TV but no added user emails - will query master + viewer accounts`);
        console.log(`   📋 addedUserEmails size: ${addedUserEmails.size}`);
        console.log(`   📋 addedUsernamesPublic: [${Array.from(addedUsernamesPublic).join(', ')}]`);
        console.log(`   📋 addedUsernamesPrivate: [${Array.from(addedUsernamesPrivate).join(', ')}]`);
        console.log(`   📋 usersToQuery: [${Array.from(usersToQuery).join(', ')}]`);
      } else {
        console.log(`🔍 [get-content] Querying files from master account only (${creatorEmail}) to match web app behavior`);
      }

      // Query files from ONLY legitimate collaborators + channel owner
      for (const userEmail of usersToQuery) {
        try {
          const queryParams = {
            TableName: table,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
            ExpressionAttributeValues: {
              ':pk': `USER#${userEmail}`,
              ':skPrefix': 'FILE#'
            }
          };
          
          const userFilesResult = await dynamodb.query(queryParams).promise();
          if (userFilesResult.Items && userFilesResult.Items.length > 0) {
            console.log(`🔍 [get-content] Found ${userFilesResult.Items.length} files for user ${userEmail}`);
            console.log(`   📋 Sample files: ${userFilesResult.Items.slice(0, 3).map(f => f.fileName || f.SK).join(', ')}`);
            allFiles.push(...userFilesResult.Items);
          } else {
            console.log(`⚠️ [get-content] No files found for user ${userEmail} - this user might not have any content yet`);
          }
        } catch (error) {
          console.error(`Error querying files for user ${userEmail}:`, error);
        }
      }
    }

    // CRITICAL: For Twilly TV, if viewer has no added usernames, we still need to process content
    // to check if any items belong to the viewer (their own videos should always be visible)
    // We'll filter out non-own videos later in the processing loop
    const totalAddedUsernames = addedUsernamesPublic.size + addedUsernamesPrivate.size;
    if (channelName.toLowerCase() === 'twilly tv' && viewerEmail && totalAddedUsernames === 0) {
      console.log(`⚠️ [get-content] Twilly TV: Viewer ${viewerEmail} has no added usernames - will show only their own videos`);
    }
    
    // Use combined files from all users
    const result = { Items: allFiles };
    
    try {
      console.log(`🔍 [get-content] Query returned ${result.Items ? result.Items.length : 0} total files from all users for channel "${channelName}"`);
      
      // Debug: Log first few files to see what we're working with
      if (result.Items && result.Items.length > 0) {
        console.log(`🔍 [get-content] First 5 files:`);
        result.Items.slice(0, 5).forEach((file, idx) => {
          const fileOwner = file.PK ? file.PK.replace('USER#', '') : 'unknown';
          console.log(`   [${idx}] fileName="${file.fileName}", folderName="${file.folderName}", seriesName="${file.seriesName}", category="${file.category}", isVisible=${file.isVisible}, hasHls=${!!file.hlsUrl}, streamKey=${file.streamKey || 'none'}, owner=${fileOwner}`);
        });
      }
      
      if (result.Items && result.Items.length > 0) {
        // Filter for files in this channel and only visible content
        // SECURITY: Also verify file belongs to a legitimate collaborator or owner
        // CRITICAL: Use EXACT matching like web app - web app is source of truth
        const channelFiles = result.Items.filter(file => {
          // SECURITY CHECK: Verify file owner is legitimate
          // Files are stored under USER#email, so we check by email
          const fileOwnerEmail = file.PK ? file.PK.replace('USER#', '') : null;
          const isOwnerFile = fileOwnerEmail === creatorEmail;
          const isCollaboratorFile = fileOwnerEmail && collaboratorEmails.has(fileOwnerEmail);
          
          // CRITICAL: For "Twilly TV" channel, apply added username filtering EARLY
          // This prevents showing videos from users who weren't added to the viewer's timeline
          // For Twilly TV, all videos are stored under master account, so we filter by creatorUsername
          // The final filtering happens after username lookup (lines 867-890)
          // For non-Twilly TV channels, apply standard security check
          const totalAddedUsernames = addedUsernamesPublic.size + addedUsernamesPrivate.size;
          const isViewerOwnFile = channelName.toLowerCase() === 'twilly tv' && viewerEmail && fileOwnerEmail && fileOwnerEmail.toLowerCase() === viewerEmail.toLowerCase();
          if (channelName.toLowerCase() === 'twilly tv' && totalAddedUsernames > 0) {
            // We need to check the creatorUsername, but it might not be set yet
            // So we'll do a preliminary check here and a final check later after username lookup
            // The final filtering happens after username lookup (lines 867-890)
          } else if (isViewerOwnFile) {
            // Twilly TV: viewer's own content (including HELD/scheduled placeholders) — show like regular videos
          } else if (!isOwnerFile && !isCollaboratorFile) {
            // For non-Twilly TV channels, apply standard security check
            console.log(`🚫 [get-content] SECURITY: Rejecting file from unauthorized user: ${fileOwnerEmail} (fileName: ${file.fileName})`);
            return false; // Reject files from users who are not legitimate collaborators
          }
          
          const fileChannelName = file.folderName || file.seriesName;
          
          // CRITICAL TIMELINE FIX: For Twilly TV timeline mode, skip channel name filtering for added users' content
          // Added users' content might be in their own channels (not "Twilly TV"), but we want it in the timeline
          // Only filter by channel name for content from master account
          // Also check if this is a timeline entry (which already has creator email stored)
          const isTimelineEntry = file.isTimelineEntry === true;
          const fileCreatorEmail = file.timelineCreatorEmail || fileOwnerEmail;
          const isFromAddedUser = channelName.toLowerCase() === 'twilly tv' && 
                                  viewerEmail && 
                                  fileCreatorEmail && 
                                  fileCreatorEmail !== creatorEmail && 
                                  addedUserEmails.has(fileCreatorEmail.toLowerCase());
          
          let matchesChannel = false;
          
          // For Twilly TV: allow viewer's own files regardless of folderName (they may have streamed with different channel label)
          if (isViewerOwnFile) {
            matchesChannel = true;
            if (result.Items.indexOf(file) < 5) {
              console.log(`📺 [get-content] Twilly TV: Allowing viewer's own file (folderName="${fileChannelName || 'none'}"): ${file.fileName || file.SK}`);
            }
          }
          // For Twilly TV timeline: skip channel name check for added users' content OR timeline entries
          else if (isTimelineEntry || isFromAddedUser) {
            matchesChannel = true; // Allow all content from added users (will be filtered by username later)
            console.log(`📺 [get-content] Twilly TV timeline: Allowing content from added user ${fileCreatorEmail} (${isTimelineEntry ? 'timeline entry' : 'direct query'}, skipping channel name filter)`);
          } else if (fileChannelName) {
            // Strategy 1: Exact match (handles emojis correctly if encoding matches)
            if (fileChannelName === channelName) {
              matchesChannel = true;
            }
            // Strategy 2: Normalize both strings (remove emojis AND Unicode escape sequences for comparison)
            // ONLY if exact match failed - this handles emoji encoding differences
            else {
              // Remove emojis, Unicode escape sequences (U0001F37F), and special chars for comparison
              // Handle both actual emoji characters and Unicode escape sequences stored as strings
              // DynamoDB stores \U0001F37F as literal "U0001F37F" (backslash is escaped)
              const normalize = (str) => {
                if (!str) return '';
                // First, try to convert Unicode escape sequences to actual emojis
                // Pattern 1: U0001F37F (8 hex digits after U - DynamoDB format without backslash)
                let normalized = str.replace(/U([0-9A-Fa-f]{8})/g, (match, hex) => {
                  try {
                    return String.fromCodePoint(parseInt(hex, 16));
                  } catch (e) {
                    return ''; // Remove if conversion fails
                  }
                });
                // Pattern 2: \U0001F37F (with backslash - if somehow it's preserved)
                normalized = normalized.replace(/\\U([0-9A-Fa-f]{8})/g, (match, hex) => {
                  try {
                    return String.fromCodePoint(parseInt(hex, 16));
                  } catch (e) {
                    return ''; // Remove if conversion fails
                  }
                });
                // Pattern 3: \u{1F37F} format (lowercase u with braces)
                normalized = normalized.replace(/\\u\{([0-9A-Fa-f]{1,6})\}/gi, (match, hex) => {
                  try {
                    return String.fromCodePoint(parseInt(hex, 16));
                  } catch (e) {
                    return ''; // Remove if conversion fails
                  }
                });
                // Now remove all emoji characters (including converted ones)
                normalized = normalized.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
                // Also remove any remaining Unicode escape sequence patterns (both with and without backslash)
                normalized = normalized.replace(/U[0-9A-Fa-f]{8}/gi, '');
                normalized = normalized.replace(/\\U[0-9A-Fa-f]{8}/gi, '');
                normalized = normalized.replace(/\\u\{[0-9A-Fa-f]{1,6}\}/gi, '');
                return normalized.trim();
              };
              
              const normalizedFile = normalize(fileChannelName);
              const normalizedChannel = normalize(channelName);
              
              // EXACT match after removing emojis (not contains - EXACT)
              if (normalizedFile === normalizedChannel && normalizedFile.length > 0) {
                matchesChannel = true;
              }
              // NO partial matching - that causes "Twilly" to match "Twilly After Dark"
            }
          }
          
          // CRITICAL: For Twilly TV, check if this is the viewer's own video BEFORE filtering by isVisible
          // This ensures users always see their own videos, even if isVisible is false
          let isOwnVideoEarly = false;
          if (channelName.toLowerCase() === 'twilly tv' && viewerEmail) {
            // Check streamerEmail (who actually streamed the video)
            if (file.streamerEmail && file.streamerEmail.toLowerCase() === viewerEmail.toLowerCase()) {
              isOwnVideoEarly = true;
              console.log(`✅ [get-content] Twilly TV: Early detection - Item is viewer's own video (streamerEmail match): ${file.fileName || file.SK}`);
            }
            // CRITICAL: Also treat FILEs under USER#viewerEmail as own (creator's premium drop from merge — placeholder may not have streamerEmail)
            else if (fileOwnerEmail && fileOwnerEmail.toLowerCase() === viewerEmail.toLowerCase()) {
              isOwnVideoEarly = true;
              console.log(`✅ [get-content] Twilly TV: Early detection - Item is viewer's own video (PK owner match): ${file.fileName || file.SK}`);
            }
            else if (file.streamKey && !file.streamerEmail) {
              // We'll do a quick check here, but the full check happens later after username lookup
              // For now, we'll allow it through if it has a streamKey (will be verified later)
            }
          }
          
          // CRITICAL: Only show content that is explicitly visible (isVisible === true)
          // EXCEPTION: For Twilly TV, always show viewer's own videos even if isVisible is false
          // Do NOT show scheduled/future content (isVisible !== false is too permissive)
          // Content becomes visible when backend toggles isVisible to true after air date/time
          const isVisible = file.isVisible === true || (channelName.toLowerCase() === 'twilly tv' && isOwnVideoEarly);
          const hasAirdate = file.airdate && new Date(file.airdate) > new Date();
          const hasScheduledDate = file.scheduledDropDate && new Date(file.scheduledDropDate) > new Date();
          const hasContent = file.fileName && !file.isFolder;
          // Premiere/scheduled: show on timeline before airdate; not playable until date passes
          const isHeld = file.status === 'HELD';
          
          // For videos, must have BOTH HLS URL AND streamKey (matches web app filtering)
          // EXCEPT for scheduled/premiere (HELD): no HLS/streamKey yet — show as "Airs [date]" card. Automatic posts: show only when ready (no placeholders).
          if (file.category === 'Videos') {
            if (!file.hlsUrl && !hasAirdate && !hasScheduledDate && !isHeld) {
              return false;
            }
            // Require streamKey for published videos; scheduled (HELD) items may not have it yet
            if (!file.streamKey && !isHeld) {
              console.log(`🚫 [get-content] Filtering out video without streamKey (matches web app filtering): ${file.fileName || file.SK}`);
              return false;
            }
          }
          
          // CRITICAL: Exclude sample/test videos - check fileName AND title for common patterns
          // Match web app filtering exactly - web app is source of truth
          const fileName = file.fileName || '';
          const title = file.title || '';
          const fileNameLower = fileName.toLowerCase();
          const titleLower = title.toLowerCase();
          const isSampleVideo = fileNameLower.includes('sample') ||
                               fileNameLower.includes('test') ||
                               fileNameLower.includes('demo') ||
                               fileNameLower.includes('example') ||
                               titleLower.includes('sample') ||
                               titleLower.includes('test') ||
                               titleLower.includes('demo') ||
                               titleLower.includes('example');
          
          // Debug logging for ALL files (not just videos) to see why they're filtered out
          // Log ALL files for debugging (not just first 10)
          const isVideo = file.category === 'Videos';
          if (isVideo || result.Items.indexOf(file) < 10) {
            console.log(`🔍 [get-content] File: fileName="${file.fileName}", fileChannelName="${fileChannelName}", channelName="${channelName}", matches=${matchesChannel}, isVisible=${isVisible}, hasAirdate=${hasAirdate}, hasScheduledDate=${hasScheduledDate}, isHeld=${isHeld}, hasContent=${hasContent}, category="${file.category}", hasHls=${!!file.hlsUrl}, streamKey="${file.streamKey || 'N/A'}"`);
            if (!matchesChannel && fileChannelName) {
              console.log(`   ⚠️ No match - fileChannelName="${fileChannelName}" (length: ${fileChannelName.length}) vs channelName="${channelName}" (length: ${channelName.length})`);
              // Try to see character differences
              if (fileChannelName.length === channelName.length) {
                for (let i = 0; i < Math.min(fileChannelName.length, channelName.length); i++) {
                  if (fileChannelName[i] !== channelName[i]) {
                    console.log(`   ⚠️ First difference at index ${i}: "${fileChannelName[i]}" (code: ${fileChannelName.charCodeAt(i)}) vs "${channelName[i]}" (code: ${channelName.charCodeAt(i)})`);
                    break;
                  }
                }
              } else {
                console.log(`   ⚠️ Length mismatch: fileChannelName length=${fileChannelName.length}, channelName length=${channelName.length}`);
              }
            }
            if (!isVisible && file.category === 'Videos') {
              console.log(`   ⚠️ Video is not visible: isVisible=${file.isVisible}, hasAirdate=${hasAirdate}`);
            }
            if (!file.hlsUrl && file.category === 'Videos' && !hasAirdate && !isHeld) {
              console.log(`   ⚠️ Video missing HLS URL: hlsUrl=${file.hlsUrl || 'N/A'}`);
            }
          }
          
          // Exclude sample videos
          if (isSampleVideo) {
            console.log(`⚠️ Excluding sample/test video: ${fileName}`);
            return false;
          }
          
          // For videos, filter out items with empty/missing thumbnails (except scheduled/HELD — premiere can show placeholder)
          if (file.category === 'Videos' && !isHeld) {
            const thumbnailUrl = file.thumbnailUrl;
            
            // Comprehensive validation - check for all invalid cases
            let hasValidThumbnail = false;
            
            if (thumbnailUrl) {
              // Must be a string
              if (typeof thumbnailUrl === 'string') {
                const trimmed = thumbnailUrl.trim();
                // Must not be empty, whitespace-only, or invalid string values
                if (trimmed !== '' && 
                    trimmed !== 'null' && 
                    trimmed !== 'undefined' &&
                    trimmed !== 'None' &&
                    trimmed !== 'none' &&
                    !trimmed.startsWith('data:') && // Exclude data URIs (not valid image URLs)
                    (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
                  // Additional check: URL should have a valid structure
                  try {
                    const url = new URL(trimmed);
                    // URL should have a hostname and path
                    if (url.hostname && url.pathname) {
                      hasValidThumbnail = true;
                    }
                  } catch (e) {
                    // Invalid URL format
                    hasValidThumbnail = false;
                  }
                }
              }
            }
            
            if (!hasValidThumbnail) {
              console.log(`🚫 [get-content] EARLY FILTER: Excluding video with empty/invalid thumbnail:`, {
                fileName: file.fileName || file.SK,
                streamKey: file.streamKey || 'MISSING',
                folderName: file.folderName || 'MISSING',
                thumbnailUrl: thumbnailUrl || 'MISSING',
                thumbnailUrlType: typeof thumbnailUrl,
                thumbnailUrlValue: JSON.stringify(thumbnailUrl)
              });
              return false; // Exclude this video - NO account should see it
            }
          }
          
          // Include if visible OR if scheduled/held (status === 'HELD')
          // CRITICAL: Return content that is visible (isVisible === true) OR scheduled (status === 'HELD')
          // Scheduled content shows as premiere card "Airs [date]" until release time
          const isVisibleForReturn = file.isVisible === true || (channelName.toLowerCase() === 'twilly tv' && isOwnVideoEarly);
          return matchesChannel && (isVisibleForReturn || isHeld) && hasContent;
        });
        
        console.log(`✅ [get-content] Filtered ${channelFiles.length} visible files for channel "${channelName}" out of ${result.Items.length} total files`);
        
        // Debug: Log why files were filtered out
        if (channelFiles.length === 0 && result.Items.length > 0) {
          console.log(`⚠️ [get-content] No files matched! Debugging why:`);
          const videos = result.Items.filter(f => f.category === 'Videos');
          const withFolderName = result.Items.filter(f => f.folderName || f.seriesName);
          const visible = result.Items.filter(f => f.isVisible !== false);
          const withHls = result.Items.filter(f => f.hlsUrl);
          console.log(`   - Total files: ${result.Items.length}`);
          console.log(`   - Videos: ${videos.length}`);
          console.log(`   - Files with folderName/seriesName: ${withFolderName.length}`);
          console.log(`   - Visible files: ${visible.length}`);
          console.log(`   - Videos with HLS: ${withHls.length}`);
          
          // Show sample folderName/seriesName values
          if (withFolderName.length > 0) {
            console.log(`   - Sample folderName/seriesName values:`);
            withFolderName.slice(0, 5).forEach(f => {
              console.log(`     * "${f.folderName || f.seriesName}"`);
            });
          }
        }
        allContent.push(...channelFiles);
      }
    } catch (error) {
      console.error('Error querying files:', error);
    }

    // CRITICAL: Look up usernames and filter BEFORE pagination to prevent flicker
    // This ensures we only process items that will actually be returned
    // Ensure createdAt field exists for mobile app compatibility (use timestamp as fallback)
    // Also look up username for each item
    const itemsWithUsername = await Promise.all(allContent.map(async (item) => {
      if (!item.createdAt && item.timestamp) {
        item.createdAt = item.timestamp;
      }
      
      // CRITICAL: Normalize isPrivateUsername EARLY (before any filtering logic uses it)
      // This handles DynamoDB format { BOOL: true }, strings, numbers, and plain booleans
      if (item.isPrivateUsername !== undefined && item.isPrivateUsername !== null) {
        if (typeof item.isPrivateUsername === 'object' && item.isPrivateUsername.BOOL !== undefined) {
          item.isPrivateUsername = item.isPrivateUsername.BOOL;
        } else if (typeof item.isPrivateUsername === 'string') {
          item.isPrivateUsername = item.isPrivateUsername === 'true' || item.isPrivateUsername === '1';
        } else if (typeof item.isPrivateUsername === 'number') {
          item.isPrivateUsername = item.isPrivateUsername === 1;
        } else if (typeof item.isPrivateUsername !== 'boolean') {
          item.isPrivateUsername = Boolean(item.isPrivateUsername);
        }
      } else {
        // Default to false (public) if not set
        item.isPrivateUsername = false;
      }
      
      // CRITICAL: Normalize isPremium EARLY (same as isPrivateUsername)
      // This handles DynamoDB format { BOOL: true }, strings, numbers, and plain booleans
      if (item.isPremium !== undefined && item.isPremium !== null) {
        if (typeof item.isPremium === 'object' && item.isPremium.BOOL !== undefined) {
          item.isPremium = item.isPremium.BOOL;
        } else if (typeof item.isPremium === 'string') {
          item.isPremium = item.isPremium === 'true' || item.isPremium === '1';
        } else if (typeof item.isPremium === 'number') {
          item.isPremium = item.isPremium === 1;
        } else if (typeof item.isPremium !== 'boolean') {
          item.isPremium = Boolean(item.isPremium);
        }
      } else {
        // Default to false (not premium) if not set
        item.isPremium = false;
      }
      
      // Normalize title and description - treat empty strings as null/undefined
      // This matches web app behavior where empty strings are treated as "no title"
      if (item.title !== undefined && (item.title === null || item.title === '' || item.title.trim() === '')) {
        delete item.title; // Remove empty title so mobile app doesn't see it
      }
      if (item.description !== undefined && (item.description === null || item.description === '' || item.description.trim() === '')) {
        delete item.description; // Remove empty description
      }
      
      // Look up username for this content item
      let username = null;
      let streamKeyResult = null; // Store outside if block for later use
      try {
        // Try to get username from streamKey mapping (for collaborator videos)
        if (item.streamKey) {
          const streamKeyParams = {
            TableName: table,
            Key: {
              PK: `STREAM_KEY#${item.streamKey}`,
              SK: 'MAPPING'
            }
          };
          streamKeyResult = await dynamodb.get(streamKeyParams).promise();
          if (streamKeyResult.Item) {
            console.log(`🔍 [get-content] StreamKey mapping found for ${item.streamKey}:`, {
              hasCollaboratorEmail: !!streamKeyResult.Item.collaboratorEmail,
              hasOwnerEmail: !!streamKeyResult.Item.ownerEmail,
              hasCreatorId: !!streamKeyResult.Item.creatorId,
              hasUsername: !!streamKeyResult.Item.username
            });
            // CRITICAL: Stream key mapping is the source of truth for this drop's privacy/premium (set at stream/convert time).
            // Prefer stream mapping over POST so Premium tab shows only premium drops and public tab only public.
            const m = streamKeyResult.Item;
            if (item.isPrivateUsername === undefined || item.isPrivateUsername === null) {
              if (m.isPrivateUsername !== undefined && m.isPrivateUsername !== null) {
                item.isPrivateUsername = m.isPrivateUsername === true || m.isPrivateUsername === 'true' || m.isPrivateUsername === 1;
              }
            }
            // Always use stream key isPremium when available so premium tab never shows public items
            if (m.isPremium !== undefined && m.isPremium !== null) {
              item.isPremium = m.isPremium === true || m.isPremium === 'true' || m.isPremium === 1;
            }
            // For premium subscribe button on public items: include creator email when available
            if (m.collaboratorEmail || m.ownerEmail) {
              item.creatorEmail = m.collaboratorEmail || m.ownerEmail;
            }
            
            // CRITICAL: For collaborator videos, prioritize creatorId (userId) lookup
            // This ensures we get the correct username for the collaborator who streamed
            let emailToLookup = streamKeyResult.Item.collaboratorEmail || streamKeyResult.Item.ownerEmail;
            let userIdToLookup = streamKeyResult.Item.creatorId; // This is the userId (UUID) of the collaborator
            
            console.log(`🔍 [get-content] Looking up username for streamKey ${item.streamKey}:`, {
              emailToLookup,
              userIdToLookup,
              isCollaboratorKey: streamKeyResult.Item.isCollaboratorKey,
              note: 'For collaborators, creatorId (userId) is the source of truth'
            });
            
            // PRIORITY 1: Use the SOURCE OF TRUTH - PK='USER', SK=userId
            // This is where update-username API stores the username (overwrites, not appends)
            // Each email/userId has ONLY ONE username stored here
            if (userIdToLookup && !username) {
              try {
                const sourceOfTruthParams = {
                  TableName: table,
                  Key: {
                    PK: 'USER',
                    SK: userIdToLookup
                  }
                };
                const sourceResult = await dynamodb.get(sourceOfTruthParams).promise();
                if (sourceResult.Item && sourceResult.Item.username) {
                  username = sourceResult.Item.username;
                  console.log(`✅ [get-content] Found username '${username}' from SOURCE OF TRUTH (PK=USER, SK=${userIdToLookup})`);
                }
              } catch (err) {
                console.log(`⚠️ [get-content] Error with source of truth lookup for ${userIdToLookup}: ${err.message}`);
              }
            }
            
            // PRIORITY 2: Try looking up by email (fallback if userId lookup failed)
            if (!username && emailToLookup) {
              // Method 1: Direct get
              try {
                const userParams = {
                  TableName: table,
                  Key: {
                    PK: `USER#${emailToLookup}`,
                    SK: 'PROFILE'
                  }
                };
                const userResult = await dynamodb.get(userParams).promise();
                if (userResult.Item && userResult.Item.username) {
                  username = userResult.Item.username;
                  console.log(`✅ [get-content] Found username '${username}' from streamKey ${item.streamKey} via email ${emailToLookup} (direct get)`);
                }
              } catch (err) {
                console.log(`⚠️ [get-content] Error with direct get for ${emailToLookup}: ${err.message}`);
              }
              
              // Method 2: Scan by email (more reliable)
              if (!username) {
                try {
                  const scanParams = {
                    TableName: table,
                    FilterExpression: 'PK = :pk AND email = :email',
                    ExpressionAttributeValues: {
                      ':pk': 'USER',
                      ':email': emailToLookup
                    }
                  };
                  const scanResult = await dynamodb.scan(scanParams).promise();
                  if (scanResult.Items && scanResult.Items.length > 0) {
                    const userRecord = scanResult.Items[0];
                    if (userRecord.username) {
                      username = userRecord.username;
                      console.log(`✅ [get-content] Found username '${username}' from streamKey ${item.streamKey} via email ${emailToLookup} (scan)`);
                    }
                  }
                } catch (err) {
                  console.log(`⚠️ [get-content] Error scanning for ${emailToLookup}: ${err.message}`);
                }
              }
            }
            
            // Fallback: Try USER#userId/PROFILE if source of truth lookup failed
            // (This is a legacy location, but we check it as fallback)
            if (!username && userIdToLookup) {
              try {
                const userParams = {
                  TableName: table,
                  Key: {
                    PK: `USER#${userIdToLookup}`,
                    SK: 'PROFILE'
                  }
                };
                const userResult = await dynamodb.get(userParams).promise();
                if (userResult.Item && userResult.Item.username) {
                  username = userResult.Item.username;
                  console.log(`⚠️ [get-content] Found username '${username}' from fallback location USER#${userIdToLookup}/PROFILE (should use PK=USER, SK=${userIdToLookup} instead)`);
                } else {
                  console.log(`⚠️ [get-content] No USER#${userIdToLookup}/PROFILE found or no username`);
                }
              } catch (err) {
                console.log(`⚠️ [get-content] Error looking up by userId ${userIdToLookup}: ${err.message}`);
              }
            }
            
            // Also check if streamKey mapping has username directly
            if (!username && streamKeyResult.Item.username) {
              username = streamKeyResult.Item.username;
              console.log(`✅ [get-content] Found username '${username}' directly in streamKey mapping`);
            }
          } else {
            console.log(`⚠️ [get-content] No streamKey mapping found for ${item.streamKey}`);
          }
        }
        
        // Fallback: If no username from streamKey, try to get from creatorEmail (PK)
        // BUT ONLY if this is NOT a collaborator video (no streamKey or streamKey is owner's key)
        // This is for videos streamed by the channel owner
        // Try multiple lookup methods since USER records might be structured differently
        if (!username) {
          // Check if this is a collaborator video - if streamKey exists and is a collaborator key, don't use owner fallback
          const isCollaboratorVideo = item.streamKey && streamKeyResult?.Item?.isCollaboratorKey === true;
          
          if (isCollaboratorVideo) {
            console.log(`⚠️ [get-content] Collaborator video but couldn't find username - skipping owner fallback for item ${item.SK}`);
            // Don't fall back to owner for collaborator videos - we want to show nothing rather than wrong username
          } else {
            // This is likely the owner's video, so use owner email
            const emailFromPK = creatorEmail;
            
            // Method 1: Try USER#email/PROFILE (standard structure)
            try {
              const userParams = {
                TableName: table,
                Key: {
                  PK: `USER#${emailFromPK}`,
                  SK: 'PROFILE'
                }
              };
              const userResult = await dynamodb.get(userParams).promise();
              if (userResult.Item && userResult.Item.username) {
                username = userResult.Item.username;
                console.log(`✅ [get-content] Found username '${username}' from USER#${emailFromPK}/PROFILE`);
              }
            } catch (err) {
              console.log(`⚠️ [get-content] Error with USER#${emailFromPK}/PROFILE: ${err.message}`);
            }
            
            // Method 2: Try scanning for USER records with matching email (like get-public-channels does)
            if (!username) {
              try {
                const scanParams = {
                  TableName: table,
                  FilterExpression: 'PK = :pk AND email = :email',
                  ExpressionAttributeValues: {
                    ':pk': 'USER',
                    ':email': emailFromPK
                  }
                };
                const scanResult = await dynamodb.scan(scanParams).promise();
                if (scanResult.Items && scanResult.Items.length > 0) {
                  const userRecord = scanResult.Items[0];
                  if (userRecord.username) {
                    username = userRecord.username;
                    console.log(`✅ [get-content] Found username '${username}' via scan for email ${emailFromPK}`);
                  }
                }
              } catch (err) {
                console.log(`⚠️ [get-content] Error scanning for USER with email: ${err.message}`);
              }
            }
            
            // Method 3: Check if the file record itself has user info
            if (!username && item.email) {
              try {
                const scanParams = {
                  TableName: table,
                  FilterExpression: 'PK = :pk AND email = :email',
                  ExpressionAttributeValues: {
                    ':pk': 'USER',
                    ':email': item.email
                  }
                };
                const scanResult = await dynamodb.scan(scanParams).promise();
                if (scanResult.Items && scanResult.Items.length > 0) {
                  const userRecord = scanResult.Items[0];
                  if (userRecord.username) {
                    username = userRecord.username;
                    console.log(`✅ [get-content] Found username '${username}' from item.email ${item.email}`);
                  }
                }
              } catch (err) {
                console.log(`⚠️ [get-content] Error scanning for USER with item.email: ${err.message}`);
              }
            }
            
            if (!username) {
              console.log(`⚠️ [get-content] No username found for channel owner email ${emailFromPK} for item ${item.SK}`);
            }
          }
        }
        
        // Also try looking up by userId if we have it from the file record
        // Use SOURCE OF TRUTH: PK='USER', SK=userId
        if (!username && item.userId) {
          try {
            const sourceOfTruthParams = {
              TableName: table,
              Key: {
                PK: 'USER',
                SK: item.userId
              }
            };
            const sourceResult = await dynamodb.get(sourceOfTruthParams).promise();
            if (sourceResult.Item && sourceResult.Item.username) {
              username = sourceResult.Item.username;
              console.log(`✅ [get-content] Found username '${username}' from SOURCE OF TRUTH (PK=USER, SK=${item.userId})`);
            }
          } catch (err) {
            console.log(`⚠️ [get-content] Error looking up by item.userId: ${err.message}`);
          }
        }
      } catch (error) {
        console.error(`❌ [get-content] Error looking up username for item ${item.SK}:`, error);
      }
      
      // CRITICAL: If creatorUsername is already set (from streamUsername in createVideoEntryImmediately),
      // preserve it - it may have 🔒 for private streams
      // Only lookup username if creatorUsername is not already set
      if (!item.creatorUsername || item.creatorUsername.trim() === '') {
        // Add username to item - ONLY use real username, NEVER use email prefix
        if (username && !username.includes('@')) {
          // Only use if it's a real username (not an email address)
            item.creatorUsername = username;
            console.log(`✅ [get-content] Setting creatorUsername='${username}' (real username) for item ${item.SK}`);
        } else if (!username) {
          // If no username found, try one more aggressive lookup using the get-username API pattern
          // This helps for existing streams where username might be in a different location
          let finalUsernameAttempt = null;
          
          // Try to get userId and email from streamKey mapping or item
          const finalUserId = streamKeyResult?.Item?.creatorId || item.userId || item.creatorId;
          const finalEmail = streamKeyResult?.Item?.collaboratorEmail || streamKeyResult?.Item?.ownerEmail || item.creatorEmail || creatorEmail;
          
          if (finalUserId || finalEmail) {
            // Try the enhanced lookup pattern (same as get-username API)
            try {
              // Try PK='USER', SK=userId (source of truth)
              if (finalUserId) {
                const sourceParams = {
                  TableName: table,
                  Key: {
                    PK: 'USER',
                    SK: finalUserId
                  }
                };
                const sourceResult = await dynamodb.get(sourceParams).promise();
                if (sourceResult.Item?.username && !sourceResult.Item.username.includes('@')) {
                  finalUsernameAttempt = sourceResult.Item.username;
                  console.log(`✅ [get-content] Found username '${finalUsernameAttempt}' from source of truth for item ${item.SK}`);
                }
              }
              
              // Try PK='USER#email', SK='PROFILE' (alternative)
              if (!finalUsernameAttempt && finalEmail) {
                const altParams = {
                  TableName: table,
                  Key: {
                    PK: `USER#${finalEmail}`,
                    SK: 'PROFILE'
                  }
                };
                const altResult = await dynamodb.get(altParams).promise();
                if (altResult.Item?.username && !altResult.Item.username.includes('@')) {
                  finalUsernameAttempt = altResult.Item.username;
                  console.log(`✅ [get-content] Found username '${finalUsernameAttempt}' from alternative location for item ${item.SK}`);
                }
              }
              
              // Try PK='USER#userId', SK='PROFILE' (another alternative)
              if (!finalUsernameAttempt && finalUserId) {
                const altParams2 = {
                  TableName: table,
                  Key: {
                    PK: `USER#${finalUserId}`,
                    SK: 'PROFILE'
                  }
                };
                const altResult2 = await dynamodb.get(altParams2).promise();
                if (altResult2.Item?.username && !altResult2.Item.username.includes('@')) {
                  finalUsernameAttempt = altResult2.Item.username;
                  console.log(`✅ [get-content] Found username '${finalUsernameAttempt}' from second alternative location for item ${item.SK}`);
                }
              }
            } catch (finalLookupError) {
              console.log(`⚠️ [get-content] Error in final username lookup for item ${item.SK}: ${finalLookupError.message}`);
            }
          }
          
          if (finalUsernameAttempt) {
            item.creatorUsername = finalUsernameAttempt;
            console.log(`✅ [get-content] Set creatorUsername='${finalUsernameAttempt}' after aggressive lookup for item ${item.SK}`);
          } else {
            // DO NOT use email prefix - leave it empty or use a placeholder
            // Email prefix is misleading and should not be shown to users
            console.log(`⚠️ [get-content] No username found for item ${item.SK} (streamKey: ${item.streamKey || 'none'}) - NOT using email prefix`);
            // Leave creatorUsername empty - the mobile app can handle this gracefully
          }
        } else {
          // Username contains @, which means it's an email - don't use it
          console.log(`⚠️ [get-content] Username lookup returned email '${username}' for item ${item.SK} - NOT using email prefix`);
          // Leave creatorUsername empty
        }
          } else {
        // Always try to verify and replace creatorUsername if it's an email prefix
        // This handles both cases: email addresses (with @) and email prefixes (like "dehyu.sinyan")
        const finalUserId = streamKeyResult?.Item?.creatorId || item.userId || item.creatorId;
        const finalEmail = streamKeyResult?.Item?.collaboratorEmail || streamKeyResult?.Item?.ownerEmail || item.creatorEmail || creatorEmail;
        
        // Check if creatorUsername looks like an email prefix (matches email prefix or contains @)
        const isEmailPrefix = item.creatorUsername && (
          item.creatorUsername.includes('@') || 
          (finalEmail && item.creatorUsername === finalEmail.split('@')[0])
        );
        
        if (isEmailPrefix && (finalUserId || finalEmail)) {
          console.log(`⚠️ [get-content] Existing creatorUsername '${item.creatorUsername}' appears to be an email prefix - attempting to find real username`);
          // Try to find real username using the same aggressive lookup
          try {
            let replacementUsername = null;
            
            if (finalUserId) {
              const sourceParams = {
                TableName: table,
                Key: {
                  PK: 'USER',
                  SK: finalUserId
                }
              };
              const sourceResult = await dynamodb.get(sourceParams).promise();
              if (sourceResult.Item?.username && !sourceResult.Item.username.includes('@')) {
                replacementUsername = sourceResult.Item.username;
              }
            }
            
            if (!replacementUsername && finalEmail) {
              const altParams = {
                TableName: table,
                Key: {
                  PK: `USER#${finalEmail}`,
                  SK: 'PROFILE'
                }
              };
              const altResult = await dynamodb.get(altParams).promise();
              if (altResult.Item?.username && !altResult.Item.username.includes('@')) {
                replacementUsername = altResult.Item.username;
              }
            }
            
            // Try PK='USER#userId', SK='PROFILE' as another fallback
            if (!replacementUsername && finalUserId) {
              const altParams2 = {
                TableName: table,
                Key: {
                  PK: `USER#${finalUserId}`,
                  SK: 'PROFILE'
                }
              };
              const altResult2 = await dynamodb.get(altParams2).promise();
              if (altResult2.Item?.username && !altResult2.Item.username.includes('@')) {
                replacementUsername = altResult2.Item.username;
              }
            }
            
            if (replacementUsername && replacementUsername !== item.creatorUsername) {
              const oldUsername = item.creatorUsername;
              item.creatorUsername = replacementUsername;
              console.log(`✅ [get-content] Replaced email prefix '${oldUsername}' with real username '${replacementUsername}' for item ${item.SK}`);
            } else if (!replacementUsername) {
              console.log(`⚠️ [get-content] Could not find real username to replace '${item.creatorUsername}' for item ${item.SK}`);
            }
          } catch (replaceError) {
            console.log(`⚠️ [get-content] Error replacing email prefix for item ${item.SK}: ${replaceError.message}`);
        }
      } else {
        console.log(`✅ [get-content] Preserving existing creatorUsername='${item.creatorUsername}' (may include 🔒 for private streams)`);
        }
      }
      
      // Filter out items with inactive/invalid usernames (like "googoogaga", "yess")
      // These are test accounts or accounts that are no longer active
      // Note: "dehyuusername" is a valid username for dehyubuilds@gmail.com
      const invalidUsernames = ['googoogaga', 'yess'];
      if (item.creatorUsername && invalidUsernames.includes(item.creatorUsername.toLowerCase())) {
        console.log(`🚫 [get-content] Filtering out item with invalid username '${item.creatorUsername}': ${item.fileName || item.SK}`);
        return null; // Return null to filter out this item
      }
      
      // CRITICAL: For Twilly TV channel, filter by added usernames
      // Twilly TV is a curated timeline - viewers only see posts from:
      // 1. Public users they've explicitly added (auto-accepted, status='active' in ADDED_USERNAME#)
      // 2. Private users they've requested to add AND been accepted by (status='active' in ADDED_USERNAME#)
      // 3. Their own videos (even if not explicitly added - users should always see their own content)
      // The ADDED_USERNAME# entries with status='active' already represent both cases
      // CRITICAL: For "Twilly TV", all videos are stored under master account (dehyu.sinyan@gmail.com)
      // So we MUST filter by creatorUsername only, not by itemOwnerEmail
      // CRITICAL FIX: Username is now set BEFORE this filtering (moved earlier in the code)
      // Normalize username for comparison (lowercase, trim whitespace)
      if (channelName.toLowerCase() === 'twilly tv' && viewerEmail) {
        // Isolated timelines: items from PUBLIC#/PRIVATE#/PREMIUM# are already correct - trust them
        if (useTimeline && item.isTimelineEntry && item.timelineType) {
          return item;
        }
        // Normalize username: lowercase, trim whitespace, remove any special characters that shouldn't be there
        // CRITICAL: Normalize the SAME way as when adding to sets (trim + lowercase) for consistency
        const rawUsername = item.creatorUsername || '';
        const itemUsername = rawUsername.trim().toLowerCase(); // Same order as line 105: trim().toLowerCase()
        
        // CRITICAL: ALWAYS check if this is the viewer's own video FIRST
        // This ensures users always see their own videos, even if username lookup failed or they streamed from admin account
        let isOwnVideo = false;
        // Check streamerEmail (who actually streamed the video)
        if (item.streamerEmail && item.streamerEmail.toLowerCase() === viewerEmail.toLowerCase()) {
          isOwnVideo = true;
          console.log(`✅ [get-content] Twilly TV: Item is viewer's own video (streamerEmail match): ${item.fileName || item.SK}`);
        }
        // Also check if we can determine creatorEmail from streamKey mapping
        // This handles cases where video was streamed from admin account but belongs to viewer
        else if (item.streamKey) {
          try {
            const streamKeyParams = {
              TableName: table,
              Key: {
                PK: `STREAM_KEY#${item.streamKey}`,
                SK: 'MAPPING'
              }
            };
            const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
            if (streamKeyResult.Item) {
              const creatorEmailFromMapping = streamKeyResult.Item.collaboratorEmail || streamKeyResult.Item.ownerEmail;
              if (creatorEmailFromMapping && creatorEmailFromMapping.toLowerCase() === viewerEmail.toLowerCase()) {
                isOwnVideo = true;
                console.log(`✅ [get-content] Twilly TV: Item is viewer's own video (streamKey mapping match): ${item.fileName || item.SK}`);
              }
            }
          } catch (err) {
            console.log(`⚠️ [get-content] Error checking streamKey mapping for own video: ${err.message}`);
          }
        }
        
        // CRITICAL FIX: Also check by username match (most reliable for own videos)
        // This handles cases where streamerEmail or streamKey mapping might not be set correctly
        if (!isOwnVideo && viewerOwnUsername && itemUsername) {
          const normalizedItemUsername = itemUsername.trim().toLowerCase();
          const normalizedViewerUsername = viewerOwnUsername.trim().toLowerCase();
          if (normalizedItemUsername === normalizedViewerUsername) {
            isOwnVideo = true;
            console.log(`✅ [get-content] Twilly TV: Item is viewer's own video (username match: "${normalizedItemUsername}" === "${normalizedViewerUsername}")`);
          }
        }
        
        // SIMPLE APPROACH: Check if creatorUsername has 🔒 or isPrivateUsername (normalized)
        const isPrivateStream = isItemPrivate(item);
        
        // When returnBothViews is true, we collect all items and split them later
        // Owner videos should ALWAYS be included when returnBothViews is true (client will split them)
        // Otherwise, apply the normal filtering based on showPrivateContent
        if (!returnBothViews) {
          // CRITICAL PRIVACY FIX: Server-side filtering to NEVER return private videos in public view
          // This is a security measure - private videos must NEVER appear in public view
          // Exception: Viewer's own videos are returned (client will filter by public/private)
          if (!isOwnVideo && isPrivateStream && !showPrivateContent) {
            // PRIVATE VIDEO IN PUBLIC VIEW - BLOCK IT IMMEDIATELY
            console.log(`🚫 [get-content] SECURITY: Blocking private video from public view: ${item.fileName || item.SK} (creatorUsername: ${item.creatorUsername || 'N/A'}, has 🔒: ${item.creatorUsername && item.creatorUsername.includes('🔒')})`);
            return null; // NEVER return private videos in public view
          }
          
          if (isOwnVideo) {
            // Own video - filter by showPrivateContent on server side for consistency
            // (Only when NOT using returnBothViews - when returnBothViews is true, all owner videos are included)
            if (showPrivateContent) {
              // PRIVATE VIEW: Only return own private videos
              if (!isPrivateStream) {
                console.log(`🚫 [get-content] Twilly TV: Filtering out own public video in private view: ${item.fileName || item.SK}`);
                return null;
              }
              console.log(`✅ [get-content] Twilly TV: Returning own private video: ${item.fileName || item.SK}`);
            } else {
              // PUBLIC VIEW: Only return own public videos
              if (isPrivateStream) {
                console.log(`🚫 [get-content] Twilly TV: Filtering out own private video in public view: ${item.fileName || item.SK}`);
                return null;
              }
              console.log(`✅ [get-content] Twilly TV: Returning own public video: ${item.fileName || item.SK}`);
            }
            // Continue to return item (already filtered by showPrivateContent)
          }
        } else {
          // When returnBothViews is true, owner videos should ALWAYS be included
          // The client will split them into public/private arrays
          if (isOwnVideo) {
            console.log(`✅ [get-content] Twilly TV: Including own video for returnBothViews: ${item.fileName || item.SK} (${isPrivateStream ? 'private' : 'public'})`);
            // Continue processing - don't return null, let it pass through to final filter
          }
        }
        
        // Apply visibility-based filtering (for both returnBothViews and normal mode)
        if (isPrivateStream && !isOwnVideo) {
          // PRIVATE stream (username 🔒) - CRITICAL: Only show if viewer has added this username FOR PRIVATE visibility
          // Remove 🔒 from username when checking (users add "username", not "username🔒")
          const usernameWithoutLock = itemUsername ? itemUsername.replace('🔒', '').trim() : null;
          
          if (!usernameWithoutLock) {
            console.log(`🚫 [get-content] Twilly TV: Filtering out private stream - no username found: ${item.fileName || item.SK}`);
            return null;
          }
          
          // CRITICAL FIX: Only show private content if:
          // 1. Viewer has added this username FOR PRIVATE visibility, OR
          // 2. Creator has added viewer to THEIR private timeline (reverse relationship - case 4)
          // Users added for PUBLIC should NEVER see private content
          // CRITICAL: Normalize both sides for comparison (case-insensitive, trimmed)
          const normalizedUsernameWithoutLock = usernameWithoutLock.trim().toLowerCase();
          const hasAddedForPrivate = addedUsernamesPrivate.has(normalizedUsernameWithoutLock);
          
          // CRITICAL: Also check reverse relationship - if creator added viewer to their private timeline
          // This handles case 4: "Owner added to other user private streams"
          let creatorAddedViewerToPrivate = false;
          if (!hasAddedForPrivate && item.creatorEmail) {
            try {
              // Check if creator added viewer to their private timeline
              const reverseCheckParams = {
                TableName: table,
                Key: {
                  PK: `USER#${item.creatorEmail.toLowerCase()}`,
                  SK: `ADDED_USERNAME#${normalizedViewerEmail}#private`
                }
              };
              const reverseCheckResult = await dynamodb.get(reverseCheckParams).promise();
              if (reverseCheckResult.Item && reverseCheckResult.Item.status === 'active') {
                creatorAddedViewerToPrivate = true;
                console.log(`✅ [get-content] Twilly TV: Creator ${item.creatorEmail} added viewer to their private timeline - showing private stream`);
              }
            } catch (reverseCheckError) {
              console.log(`⚠️ [get-content] Error checking reverse relationship: ${reverseCheckError.message}`);
            }
          }
          
          if (!hasAddedForPrivate && !creatorAddedViewerToPrivate) {
            console.log(`🚫 [get-content] Twilly TV: SECURITY - Blocking private stream from user not added for private: ${item.creatorUsername} (normalized: ${normalizedUsernameWithoutLock})`);
            console.log(`   User may have been added for PUBLIC only - they should NEVER see private content`);
            console.log(`   Checking against private usernames: [${Array.from(addedUsernamesPrivate).join(', ')}]`);
            // DEBUG: Check if there's a close match
            const closeMatch = Array.from(addedUsernamesPrivate).find(u => u.trim().toLowerCase() === normalizedUsernameWithoutLock);
            if (closeMatch) {
              console.log(`   ⚠️ Found close match: "${closeMatch}" - this suggests a normalization issue`);
            }
            return null;
          } else {
            const reason = hasAddedForPrivate ? 'viewer added creator for private' : 'creator added viewer to their private timeline';
            console.log(`✅ [get-content] Twilly TV: Showing private stream from ${item.creatorUsername} (normalized: ${normalizedUsernameWithoutLock}) - ${reason}`);
          }
        } else {
          // PUBLIC stream - CRITICAL: Owner videos should ALWAYS be shown, bypass "added username" check
          // For other users, only show if viewer has added this username FOR PUBLIC visibility
          if (isOwnVideo) {
            // Owner's own videos should always be included (will be filtered by privacy in final filter if needed)
            console.log(`✅ [get-content] Twilly TV: Including own public video (bypassing added username check): ${item.fileName || item.SK}`);
            // Continue processing - don't return null, don't filter by added username
            return item; // Return immediately to bypass added username check
          } else {
            // CRITICAL FIX: Only show public content if user was added FOR PUBLIC visibility
            // Users added for PRIVATE should only see private content, not public
            // CRITICAL FIX: Don't filter out items immediately if username is missing
            // Username is set earlier in this function (line 1034-1118), so if it's still missing here,
            // it means lookup failed. But we'll do a final check after all items are processed.
            // For now, let items without username pass through - they'll be filtered in final pass
            if (!itemUsername || itemUsername.trim() === '') {
              console.log(`⚠️ [get-content] Twilly TV: Item has no username after lookup: ${item.fileName || item.SK} (will filter in final pass if still missing)`);
              // Don't return null here - let it pass through to final filter
              // This prevents items from appearing then disappearing
              return item; // Return item as-is, final filter will handle it
            }
            
            // CRITICAL: Normalize both sides for comparison (case-insensitive, trimmed)
            const normalizedItemUsername = itemUsername.trim().toLowerCase();
            
            console.log(`🔍 [get-content] DEBUG: Checking public content for item "${item.fileName || item.SK}"`);
            console.log(`   creatorUsername (raw): "${item.creatorUsername || 'MISSING'}"`);
            console.log(`   itemUsername (after .toLowerCase().trim()): "${itemUsername}"`);
            console.log(`   normalizedItemUsername (after .trim().toLowerCase()): "${normalizedItemUsername}"`);
            console.log(`   Checking against PUBLIC set: [${Array.from(addedUsernamesPublic).map(u => `"${u}"`).join(', ')}]`);
            
            const hasAddedForPublic = addedUsernamesPublic.has(normalizedItemUsername);
            console.log(`   → hasAddedForPublic: ${hasAddedForPublic}`);
            
            if (!hasAddedForPublic) {
              // Check if user was added for private - if so, they shouldn't see public content
              const hasAddedForPrivate = addedUsernamesPrivate.has(normalizedItemUsername);
              console.log(`   Checking against PRIVATE set: [${Array.from(addedUsernamesPrivate).map(u => `"${u}"`).join(', ')}]`);
              console.log(`   → hasAddedForPrivate: ${hasAddedForPrivate}`);
              
              if (hasAddedForPrivate) {
                console.log(`🚫 [get-content] Twilly TV: Filtering out PUBLIC stream - user was added for PRIVATE only: "${item.creatorUsername}" (normalized: "${normalizedItemUsername}")`);
              } else {
                console.log(`🚫 [get-content] Twilly TV: Filtering out item - not from added username: "${item.creatorUsername}" (normalized: "${normalizedItemUsername}")`);
                // DEBUG: Check if there's a close match (case/whitespace difference)
                const closeMatchPublic = Array.from(addedUsernamesPublic).find(u => {
                  const uNormalized = u.trim().toLowerCase();
                  const match = uNormalized === normalizedItemUsername;
                  if (match) {
                    console.log(`   ⚠️ Found EXACT match in PUBLIC set: "${u}" (normalized: "${uNormalized}")`);
                  }
                  return match;
                });
                const closeMatchPrivate = Array.from(addedUsernamesPrivate).find(u => {
                  const uNormalized = u.trim().toLowerCase();
                  const match = uNormalized === normalizedItemUsername;
                  if (match) {
                    console.log(`   ⚠️ Found EXACT match in PRIVATE set: "${u}" (normalized: "${uNormalized}")`);
                  }
                  return match;
                });
                if (closeMatchPublic || closeMatchPrivate) {
                  console.log(`   ⚠️ Found close match but Set.has() returned false - this suggests a Set storage issue`);
                } else {
                  console.log(`   ❌ No close match found - username truly not in sets`);
                }
              }
              return null; // Filter out items not from added usernames
            } else {
              console.log(`✅ [get-content] Twilly TV: Item from user added for PUBLIC: "${item.creatorUsername}" (normalized: "${normalizedItemUsername}")`);
              console.log(`   fileName: ${item.fileName || item.SK}`);
            }
          }
        }
      }
      
      // For videos, filter out items with empty/missing thumbnails (match managefiles.vue behavior)
      // managefiles.vue is the source of truth - mobile should show the same content
      if (item.category === 'Videos') {
        // Comprehensive check for empty/missing thumbnails
        // Check for: undefined, null, empty string, whitespace-only string, or invalid URL
        const thumbnailUrl = item.thumbnailUrl;
        const hasValidThumbnail = thumbnailUrl && 
                                  typeof thumbnailUrl === 'string' && 
                                  thumbnailUrl.trim() !== '' && 
                                  thumbnailUrl !== 'null' && 
                                  thumbnailUrl !== 'undefined' &&
                                  (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://'));
        
        if (!hasValidThumbnail) {
          console.log(`🚫 [get-content] Filtering out video with empty/invalid thumbnail:`, {
            fileName: item.fileName || item.SK,
            streamKey: item.streamKey || 'MISSING',
            folderName: item.folderName || 'MISSING',
            thumbnailUrl: thumbnailUrl || 'MISSING',
            thumbnailUrlType: typeof thumbnailUrl,
            thumbnailUrlValue: JSON.stringify(thumbnailUrl)
          });
          return null; // Return null to filter out this item
        }
        
        // Filter out very short videos (likely test videos or errors)
        // Videos that are 1 second or less are likely test/error videos
        // Check fileName for patterns that indicate short test videos
        const fileName = item.fileName || '';
        const fileNameLower = fileName.toLowerCase();
        
        // Check if this might be a 1-second test video
        // Look for patterns in fileName that suggest it's a test video
        const isLikelyTestVideo = fileNameLower.includes('1s') || 
                                  fileNameLower.includes('1sec') ||
                                  fileNameLower.includes('test') ||
                                  fileNameLower.includes('sample');
        
        // Also check if streamKey suggests it's a test/old video
        const streamKey = item.streamKey || '';
        const streamKeyLower = streamKey.toLowerCase();
        const isOldTestStreamKey = streamKeyLower.includes('test') || 
                                  streamKeyLower.includes('sample') ||
                                  streamKeyLower === 'twillytvn2xif8y2';
        
        if (isLikelyTestVideo || isOldTestStreamKey) {
          console.log(`🚫 [get-content] Filtering out likely test video:`, {
            fileName: fileName,
            streamKey: streamKey,
            folderName: item.folderName || 'MISSING',
            reason: isLikelyTestVideo ? 'fileName suggests test' : 'streamKey suggests test'
          });
          return null; // Return null to filter out this item
        }
        
        // Ensure video has hlsUrl and streamKey (match managefiles.vue filtering). Automatic posts: show only when ready; no placeholders.
        if (!item.hlsUrl || !item.streamKey) {
          console.log(`🚫 [get-content] Filtering out video missing hlsUrl or streamKey: ${item.fileName || item.SK} (hlsUrl: ${!!item.hlsUrl}, streamKey: ${!!item.streamKey})`);
          return null; // Return null to filter out this item
        }
        
        // Filter out old/test streamKeys that shouldn't appear (blacklist specific patterns)
        // These are old stream keys from before the system was properly set up
        const blacklistedStreamKeyPatterns = [
          'twillytvn2xif8y2', // Old Twilly TV stream key
        ];
        
        // Check if streamKey matches any blacklisted pattern (reuse streamKeyLower from above)
        if (blacklistedStreamKeyPatterns.some(pattern => streamKeyLower.includes(pattern.toLowerCase()))) {
          console.log(`🚫 [get-content] Filtering out video with old/blacklisted streamKey '${item.streamKey}': ${item.fileName || item.SK}`);
          return null; // Return null to filter out this item
        }
        
        // Additional check: Filter out videos that don't have proper streamKey format (starts with sk_)
        // But allow twillytv* keys for backward compatibility (unless blacklisted above)
        if (item.streamKey && !item.streamKey.startsWith('sk_') && !item.streamKey.startsWith('twillytv')) {
          console.log(`🚫 [get-content] Filtering out video with invalid streamKey format '${item.streamKey}': ${item.fileName || item.SK}`);
          return null; // Return null to filter out this item
        }
      }
      
      // NOTE: isPrivateUsername is already normalized early in the processing (before filtering)
      // This ensures it's always a boolean when used in filtering logic
      
      // Debug: Log all fields for videos (especially thumbnail status and isPrivateUsername)
      if (item.category === 'Videos') {
        console.log(`Video: fileName=${item.fileName || 'MISSING'}, streamKey=${item.streamKey || 'MISSING'}, username=${username || 'NOT FOUND'}, creatorUsername=${item.creatorUsername || 'NOT SET'}, isPrivateUsername=${item.isPrivateUsername} (type: ${typeof item.isPrivateUsername}), thumbnailUrl=${item.thumbnailUrl ? 'PRESENT' : 'MISSING'}, thumbnailUrlValue=${item.thumbnailUrl || 'N/A'}`);
      }
      
      return item;
    }));

    // Filter out null items (items that were filtered out due to invalid usernames, empty thumbnails, etc.)
    let filteredItems = itemsWithUsername.filter(item => {
      if (item === null) return false;
      
      // Double-check thumbnail for videos (in case it was missed earlier)
      // CRITICAL: Allow HELD/scheduled drops without thumbnail — they show as "Airs [date]" placeholder until processing completes
      const isHeldScheduled = item.status === 'HELD' && item.scheduledDropDate;
      if (item.category === 'Videos' && !isHeldScheduled) {
        const thumbnailUrl = item.thumbnailUrl || '';
        const hasValidThumbnail = thumbnailUrl && 
                                  typeof thumbnailUrl === 'string' && 
                                  thumbnailUrl.trim() !== '' && 
                                  thumbnailUrl !== 'null' && 
                                  thumbnailUrl !== 'undefined' &&
                                  (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://'));
        
        if (!hasValidThumbnail) {
          console.log(`🚫 [get-content] Final filter: Removing video with invalid thumbnail: ${item.fileName || item.SK}, thumbnailUrl=${JSON.stringify(thumbnailUrl)}`);
          return false;
        }
      }
      
      return true;
    });
    
    // CRITICAL FIX: Apply Twilly TV filtering AFTER username is set
    // This prevents items from being filtered out before username lookup completes
    // Re-check items that might have had username set during lookup
    if (channelName.toLowerCase() === 'twilly tv' && viewerEmail) {
      // Use Promise.all with filter to handle async operations
      const filterPromises = filteredItems.map(async (item) => {
        if (!item) return false;
        
        try {
          // Re-normalize username now that it's been set
          // CRITICAL: Normalize the SAME way as when adding to sets (trim + lowercase)
          const rawUsername = item.creatorUsername || '';
          // Remove lock emoji first, then normalize
          const cleanedUsername = rawUsername.replace(/🔒/g, '').trim();
          const normalizedItemUsername = cleanedUsername.toLowerCase();
          
          console.log(`🔍 [get-content] FINAL FILTER DEBUG for item ${item.SK || item.fileName}:`);
          console.log(`   Raw creatorUsername: "${rawUsername}"`);
          console.log(`   Cleaned (no lock): "${cleanedUsername}"`);
          console.log(`   Normalized: "${normalizedItemUsername}"`);
          console.log(`   Checking against PUBLIC set: [${Array.from(addedUsernamesPublic).map(u => `"${u}"`).join(', ')}]`);
          console.log(`   Checking against PRIVATE set: [${Array.from(addedUsernamesPrivate).map(u => `"${u}"`).join(', ')}]`);
          
          // Check if this is viewer's own video - COMPREHENSIVE CHECK (same as earlier in code)
          let isOwnVideo = false;
          // Check streamerEmail (who actually streamed the video)
          // CRITICAL FIX: Normalize viewerEmail to handle case sensitivity
          const normalizedViewerEmailForCheck = viewerEmail ? viewerEmail.toLowerCase() : null;
          if (item.streamerEmail && normalizedViewerEmailForCheck && item.streamerEmail.toLowerCase() === normalizedViewerEmailForCheck) {
            isOwnVideo = true;
            console.log(`   ✅ Own video detected (streamerEmail match: "${item.streamerEmail}" === "${normalizedViewerEmailForCheck}")`);
          }
          // Also check if we can determine creatorEmail from streamKey mapping
          // This handles cases where video was streamed from admin account but belongs to viewer
          else if (item.streamKey) {
            try {
              const streamKeyParams = {
                TableName: table,
                Key: {
                  PK: `STREAM_KEY#${item.streamKey}`,
                  SK: 'MAPPING'
                }
              };
              const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
              if (streamKeyResult.Item) {
                const creatorEmailFromMapping = streamKeyResult.Item.collaboratorEmail || streamKeyResult.Item.ownerEmail;
                if (creatorEmailFromMapping && creatorEmailFromMapping.toLowerCase() === viewerEmail.toLowerCase()) {
                  isOwnVideo = true;
                  console.log(`   ✅ Own video detected (streamKey mapping match)`);
                }
              }
            } catch (streamKeyErr) {
              console.log(`   ⚠️ Error checking streamKey mapping for own video: ${streamKeyErr.message}`);
            }
          }
          // CRITICAL FIX: Also check by username match (most reliable for own videos)
          // This handles cases where streamerEmail or streamKey mapping might not be set correctly
          // viewerOwnUsername is already normalized (trim + lowercase), normalizedItemUsername is also normalized
          if (!isOwnVideo && viewerOwnUsername && normalizedItemUsername && normalizedItemUsername === viewerOwnUsername) {
            isOwnVideo = true;
            console.log(`   ✅ Own video detected (username match: "${normalizedItemUsername}" === "${viewerOwnUsername}")`);
          }
        
          // Check if it's a private stream (normalized)
          const isPrivateStream = isItemPrivate(item);
          const isPremiumStream = item.isPremium === true || item.isPremium === 'true' || item.isPremium === 1;

          // CRITICAL: For own videos, handle differently based on returnBothViews / showPremiumContent / showPrivateContent
          // When returnBothViews is true, return ALL owner videos (client will split them)
          // When showPremiumContent is true, keep own premium videos in premium tab
          // When single view (public or private), filter by showPrivateContent
          if (isOwnVideo) {
            if (returnBothViews) {
              console.log(`   ✅ [get-content] Twilly TV FINAL FILTER: Keeping own video (returnBothViews=true): ${item.fileName || item.SK} (${isPrivateStream ? 'private' : 'public'})`);
              return true;
            }
            if (showPremiumContent) {
              // Premium tab: keep only own premium videos
              if (isPremiumStream) {
                console.log(`   ✅ [get-content] Twilly TV FINAL FILTER: Keeping own premium video: ${item.fileName || item.SK}`);
                return true;
              }
              console.log(`   🚫 [get-content] Twilly TV FINAL FILTER: Filtering out non-premium own video in premium view: ${item.fileName || item.SK}`);
              return false;
            }
            // Single view: public or private tab
            if (showPrivateContent) {
              if (!isPrivateStream) {
                console.log(`   🚫 [get-content] Twilly TV FINAL FILTER: Filtering out own public video in private view: ${item.fileName || item.SK}`);
                return false;
              }
              console.log(`   ✅ [get-content] Twilly TV FINAL FILTER: Keeping own private video: ${item.fileName || item.SK}`);
              return true;
            }
            if (isPrivateStream) {
              console.log(`   🚫 [get-content] Twilly TV FINAL FILTER: Filtering out own private video in public view: ${item.fileName || item.SK}`);
              return false;
            }
            console.log(`   ✅ [get-content] Twilly TV FINAL FILTER: Keeping own public video: ${item.fileName || item.SK}`);
            return true;
          }

          // Premium tab: keep all premium items (own already handled above; others from PREMIUM# or subscribed creators)
          if (showPremiumContent && isPremiumStream) {
            console.log(`   ✅ [get-content] Twilly TV FINAL FILTER: Keeping premium stream (premium tab): ${item.fileName || item.SK}`);
            return true;
          }

          if (isPrivateStream) {
            // PRIVATE stream (or private premiere/HELD) - same visibility as stream: only if added for private (or reverse relationship).
            if (!normalizedItemUsername || normalizedItemUsername === '') {
              console.log(`🚫 [get-content] Twilly TV FINAL FILTER: Filtering out private stream - no username after cleaning: ${item.fileName || item.SK}`);
              return false;
            }
            
            // CRITICAL: If user was added for PUBLIC only, NEVER show their private content
            // Users added for public should ONLY see public content from that user
            const hasAddedForPublic = addedUsernamesPublic.has(normalizedItemUsername);
            if (hasAddedForPublic && !addedUsernamesPrivate.has(normalizedItemUsername)) {
              console.log(`🚫 [get-content] Twilly TV FINAL FILTER: Filtering out private stream - user "${item.creatorUsername}" (normalized: "${normalizedItemUsername}") was added for PUBLIC only, not private`);
              return false;
            }
            
            const hasAddedForPrivate = addedUsernamesPrivate.has(normalizedItemUsername);
            
            // CRITICAL FIX: Only use the addedUsernamesPrivate set (which already includes reverse relationships)
            // The reverse relationship check (lines 131-194) already populates addedUsernamesPrivate with usernames
            // from entries where the creator added the viewer. This ensures that when a user is removed,
            // their username is removed from the set, and the filtering works correctly.
            // The previous direct DynamoDB query was bypassing the set and could show content that should be filtered.
            if (!hasAddedForPrivate) {
              console.log(`🚫 [get-content] Twilly TV FINAL FILTER: Filtering out private stream - not added for private: "${item.creatorUsername}" (normalized: "${normalizedItemUsername}")`);
              console.log(`   Available private usernames: [${Array.from(addedUsernamesPrivate).map(u => `"${u}"`).join(', ')}]`);
              return false;
            }
            console.log(`✅ [get-content] Twilly TV FINAL FILTER: Keeping private stream from "${item.creatorUsername}" (normalized: "${normalizedItemUsername}") - added for private`);
            return true;
          } else {
            // PUBLIC stream - check if user was added for public
            if (!normalizedItemUsername || normalizedItemUsername === '') {
              // Still no username after all lookups - filter it out
              console.log(`🚫 [get-content] Twilly TV FINAL FILTER: Filtering out item - no username after lookup: ${item.fileName || item.SK}`);
              return false;
            }
            const hasAddedForPublic = addedUsernamesPublic.has(normalizedItemUsername);
            if (!hasAddedForPublic) {
              console.log(`🚫 [get-content] Twilly TV FINAL FILTER: Filtering out public stream - not added for public: "${item.creatorUsername}" (normalized: "${normalizedItemUsername}")`);
              console.log(`   Available public usernames: [${Array.from(addedUsernamesPublic).map(u => `"${u}"`).join(', ')}]`);
              console.log(`   DEBUG: Checking if "${normalizedItemUsername}" is in set...`);
              // Additional debug: check if it's a case/spacing issue
              const foundMatch = Array.from(addedUsernamesPublic).find(u => u === normalizedItemUsername);
              if (!foundMatch) {
                console.log(`   ❌ No exact match found. Item username: "${normalizedItemUsername}"`);
                console.log(`   Set contains: ${JSON.stringify(Array.from(addedUsernamesPublic))}`);
                // Try to find a partial match to help debug
                const partialMatches = Array.from(addedUsernamesPublic).filter(u => u.includes(normalizedItemUsername) || normalizedItemUsername.includes(u));
                if (partialMatches.length > 0) {
                  console.log(`   🔍 Found partial matches: ${JSON.stringify(partialMatches)}`);
                }
              }
              return false;
            }
            console.log(`✅ [get-content] Twilly TV FINAL FILTER: Keeping public stream from added user: "${item.creatorUsername}" (normalized: "${normalizedItemUsername}")`);
            return true;
          }
        } catch (filterError) {
          // CRITICAL: If filter throws an error, log it but don't filter out the item
          // This prevents errors from causing all items to be filtered out
          console.error(`❌ [get-content] Twilly TV FINAL FILTER ERROR for item ${item.SK || item.fileName}: ${filterError.message}`);
          console.error(`   Stack: ${filterError.stack}`);
          // Return true to keep the item (fail open) - better to show an item than to hide everything
          return true;
        }
      });
      
      // Wait for all async filter operations to complete
      // CRITICAL: Use Promise.allSettled to prevent one error from breaking all filtering
      let filterResults;
      try {
        filterResults = await Promise.all(filterPromises);
      } catch (promiseError) {
        console.error(`❌ [get-content] Twilly TV FINAL FILTER: Promise.all failed: ${promiseError.message}`);
        // If Promise.all fails, keep all items (fail open) to prevent total content loss
        filterResults = filteredItems.map(() => true);
      }
      // Combine items with their filter results
      filteredItems = filteredItems.filter((item, index) => {
        const shouldKeep = filterResults[index] === true;
        if (!shouldKeep && item) {
          console.log(`🚫 [get-content] Twilly TV FINAL FILTER: Filtered out item ${item.SK || item.fileName} (index ${index})`);
        }
        return shouldKeep;
      });
    }
    
    console.log(`Found ${allContent.length} visible items for channel ${channelName}`);
    console.log(`✅ [get-content] After filtering invalid usernames and empty thumbnails: ${filteredItems.length} items (removed ${itemsWithUsername.length - filteredItems.length} items)`);
    
    // CRITICAL FIX: Sort by most recent post (createdAt/timestamp) - newest first
    // This applies to ALL channels - videos should display in order of most recent post
    // Sort AFTER filtering to only sort items that will be returned
    filteredItems.sort((a, b) => {
      // Use createdAt or timestamp (when the video was actually posted/created)
      // Prefer createdAt, fall back to timestamp, then airdate as last resort
      const dateA = (a.createdAt ? new Date(a.createdAt).getTime() : 0) || 
                    (a.timestamp ? new Date(a.timestamp).getTime() : 0) ||
                    (a.airdate ? new Date(a.airdate).getTime() : 0);
      const dateB = (b.createdAt ? new Date(b.createdAt).getTime() : 0) || 
                    (b.timestamp ? new Date(b.timestamp).getTime() : 0) ||
                    (b.airdate ? new Date(b.airdate).getTime() : 0);
      
      return dateB - dateA; // Newest first (most recent posts at top)
    });
    
    // Twilly TV premium-only: return ONLY premium timeline items (never public/private)
    // CRITICAL: Exclude any item with timelineType PUBLIC or PRIVATE so tabs never mix
    if (showPremiumContent && isTwillyTV && viewerEmail) {
      const isPremiumItem = (item) => {
        const type = (item.timelineType || '').toUpperCase();
        if (type === 'PUBLIC' || type === 'PRIVATE') return false;
        return type === 'PREMIUM' || item.isPremium === true || item.isPremium === 'true' || item.isPremium === 1;
      };
      let premiumOnly = filteredItems.filter(isPremiumItem);
      const fromTimelineCount = premiumOnly.length;
      const normalizedViewer = (viewerEmail || '').toLowerCase().trim();
      // Include premium content from creators the viewer is subscribed to (SUBSCRIBED_CREATOR#)
      try {
        const subQuery = await dynamodb.query({
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          FilterExpression: '#status = :active',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':pk': `USER#${normalizedViewer}`,
            ':skPrefix': 'SUBSCRIBED_CREATOR#',
            ':active': 'active'
          }
        }).promise();
        const subscribedCreatorEmails = (subQuery.Items || [])
          .map(it => it.creatorEmail || (it.SK && it.SK.startsWith('SUBSCRIBED_CREATOR#') ? it.SK.replace('SUBSCRIBED_CREATOR#', '') : null))
          .filter(Boolean);
        console.log(`👑 [get-content] Twilly TV premium: viewer ${normalizedViewer} has ${fromTimelineCount} from PREMIUM# timeline, ${subscribedCreatorEmails.length} subscribed creator(s)`);
        if (subscribedCreatorEmails.length > 0) {
          const seenSK = new Set(premiumOnly.map(i => i.SK));
          let addedFromSubscribed = 0;
          for (const creatorEmail of subscribedCreatorEmails) {
            const crEmail = creatorEmail.toLowerCase();
            const fileResult = await dynamodb.query({
              TableName: table,
              KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
              ExpressionAttributeValues: {
                ':pk': `USER#${crEmail}`,
                ':skPrefix': 'FILE#'
              },
              Limit: 50
            }).promise();
            const items = (fileResult.Items || []).filter(file => {
              const isPrem = file.isPremium === true || file.isPremium === 'true' || file.isPremium === 1;
              const visible = file.isVisible === true;
              const hasContent = file.hlsUrl || file.category === 'Videos';
              if (!isPrem || !visible || !hasContent) return false;
              if (file.category === 'Videos' && !file.thumbnailUrl) return false;
              if (seenSK.has(file.SK)) return false;
              seenSK.add(file.SK);
              return true;
            });
            addedFromSubscribed += items.length;
            for (const file of items) {
              if (!file.creatorUsername && file.PK) {
                try {
                  const profile = await dynamodb.get({
                    TableName: table,
                    Key: { PK: file.PK, SK: 'PROFILE' }
                  }).promise();
                  if (profile.Item && profile.Item.username) file.creatorUsername = profile.Item.username;
                } catch (_) {}
              }
              if (file.creatorEmail === undefined) file.creatorEmail = (file.PK || '').replace('USER#', '') || crEmail;
              premiumOnly.push(file);
            }
          }
          premiumOnly.sort((a, b) => {
            const dateA = (a.createdAt ? new Date(a.createdAt).getTime() : 0) || (a.timestamp ? new Date(a.timestamp).getTime() : 0) || (a.airdate ? new Date(a.airdate).getTime() : 0);
            const dateB = (b.createdAt ? new Date(b.createdAt).getTime() : 0) || (b.timestamp ? new Date(b.timestamp).getTime() : 0) || (b.airdate ? new Date(b.airdate).getTime() : 0);
            return dateB - dateA;
          });
          console.log(`👑 [get-content] Twilly TV premium: merged +${addedFromSubscribed} from subscribed creators, total ${premiumOnly.length} items`);
        }
        if (premiumOnly.length === 0) {
          console.log(`👑 [get-content] Twilly TV premium: no content (0 from PREMIUM# timeline, ${subscribedCreatorEmails.length} subscribed; subscribe to premium creators and/or creators need to post premium drops)`);
        }
      } catch (subErr) {
        console.error('👑 [get-content] Subscribed creators premium merge error (non-fatal):', subErr.message);
      }
      const paginatedPremium = premiumOnly.slice(0, pageLimit);
      // Ensure every item has isPremium: true so client filter ($0.isPremium == true) never drops them
      const contentWithPremiumFlag = paginatedPremium.map(item => ({ ...item, isPremium: true }));
      let premiumNextToken = null;
      if (premiumOnly.length > pageLimit && paginatedPremium.length > 0) {
        const lastItem = paginatedPremium[paginatedPremium.length - 1];
        if (lastItem) {
          premiumNextToken = Buffer.from(JSON.stringify({
            PK: lastItem.PK || `USER#${creatorEmail}`,
            SK: lastItem.SK
          })).toString('base64');
        }
      }
      console.log(`👑 [get-content] Twilly TV premium timeline: returning ${contentWithPremiumFlag.length} items (from ${premiumOnly.length} premium-only)`);
      return {
        success: true,
        content: contentWithPremiumFlag,
        nextToken: premiumNextToken,
        hasMore: premiumNextToken !== null
      };
    }

    // If returnBothViews is true, split into public and private arrays
    if (returnBothViews) {
      // CRITICAL: Deduplicate filteredItems FIRST to prevent duplicates in both arrays
      const seenSKs = new Set();
      const deduplicatedItems = filteredItems.filter(item => {
        if (seenSKs.has(item.SK)) {
          console.log(`⚠️ [get-content] Removing duplicate item before split: ${item.SK}`);
          return false;
        }
        seenSKs.add(item.SK);
        return true;
      });
      
      const publicItems = [];
      const privateItems = [];
      
      // Helper: item is premium (premium tab only - must never be in public or private)
      const isPremiumItemForSplit = (item) => {
        const t = (item.timelineType || '').toUpperCase();
        if (t === 'PREMIUM') return true;
        return item.isPremium === true || item.isPremium === 'true' || item.isPremium === 1;
      };
      deduplicatedItems.forEach(item => {
        const type = (item.timelineType || '').toUpperCase();
        if (type === 'PREMIUM') return;
        if (isPremiumItemForSplit(item)) return; // Premium only in premium tab
        const isPrivateStream = type === 'PRIVATE' || isItemPrivate(item);
        if (isPrivateStream) {
          privateItems.push(item);
        } else {
          publicItems.push(item);
        }
      });
      
      // Apply pagination to both arrays
      const paginatedPublic = publicItems.slice(0, pageLimit);
      const paginatedPrivate = privateItems.slice(0, pageLimit);
      
      // Generate nextTokens for both
      let publicNextToken = null;
      let privateNextToken = null;
      
      if (publicItems.length > pageLimit && queryResult && queryResult.LastEvaluatedKey) {
        publicNextToken = Buffer.from(JSON.stringify(queryResult.LastEvaluatedKey)).toString('base64');
      } else if (publicItems.length > pageLimit && paginatedPublic.length > 0) {
        const lastItem = paginatedPublic[paginatedPublic.length - 1];
        if (lastItem) {
          publicNextToken = Buffer.from(JSON.stringify({
            PK: `USER#${creatorEmail}`,
            SK: lastItem.SK
          })).toString('base64');
        }
      }
      
      if (privateItems.length > pageLimit && queryResult && queryResult.LastEvaluatedKey) {
        privateNextToken = Buffer.from(JSON.stringify(queryResult.LastEvaluatedKey)).toString('base64');
      } else if (privateItems.length > pageLimit && paginatedPrivate.length > 0) {
        const lastItem = paginatedPrivate[paginatedPrivate.length - 1];
        if (lastItem) {
          privateNextToken = Buffer.from(JSON.stringify({
            PK: `USER#${creatorEmail}`,
            SK: lastItem.SK
          })).toString('base64');
        }
      }
      
      console.log(`✅ [get-content] Returning both views - public: ${paginatedPublic.length}, private: ${paginatedPrivate.length}`);
      
      return {
        success: true,
        publicContent: paginatedPublic,
        privateContent: paginatedPrivate,
        publicCount: paginatedPublic.length,
        privateCount: paginatedPrivate.length,
        publicNextToken: publicNextToken,
        privateNextToken: privateNextToken,
        publicHasMore: publicNextToken !== null,
        privateHasMore: privateNextToken !== null
      };
    }
    
    // Private tab must never show premium: exclude premium from private-only response
    if (showPrivateContent && !returnBothViews) {
      const isPremium = (item) => (item.timelineType || '').toUpperCase() === 'PREMIUM' || item.isPremium === true || item.isPremium === 'true' || item.isPremium === 1;
      filteredItems = filteredItems.filter(item => !isPremium(item));
    }
    
    // Apply pagination limit AFTER filtering and sorting (normal mode)
    const paginatedContent = filteredItems.slice(0, pageLimit);
    
    // Generate nextToken if there are more items
    let nextTokenResult = null;
    if (filteredItems.length > pageLimit && queryResult && queryResult.LastEvaluatedKey) {
      // Encode LastEvaluatedKey as base64 for nextToken
      nextTokenResult = Buffer.from(JSON.stringify(queryResult.LastEvaluatedKey)).toString('base64');
    } else if (filteredItems.length > pageLimit) {
      // If we filtered items but there might be more, create a token based on last item
      const lastItem = paginatedContent[paginatedContent.length - 1];
      if (lastItem) {
        nextTokenResult = Buffer.from(JSON.stringify({
          PK: `USER#${creatorEmail}`,
          SK: lastItem.SK
        })).toString('base64');
      }
    }
    
    // Debug: Log first item structure - check ALL items for title issues
    if (filteredItems.length > 0) {
      console.log(`\n📊 DEBUG: Checking ${filteredItems.length} items for title/description/price:`);
      filteredItems.forEach((item, index) => {
        console.log(`\n[Item ${index + 1}]`);
        console.log(`  PK: ${item.PK || 'MISSING'}`);
        console.log(`  SK: ${item.SK || 'MISSING'}`);
        console.log(`  fileName: "${item.fileName || 'MISSING'}"`);
        console.log(`  title: ${item.title !== undefined ? `"${item.title}"` : 'NOT SET'} (type: ${typeof item.title})`);
        console.log(`  description: ${item.description !== undefined ? `"${item.description.substring(0, 50)}..."` : 'NOT SET'}`);
        console.log(`  price: ${item.price !== undefined ? item.price : 'NOT SET'} (type: ${typeof item.price})`);
        console.log(`  streamKey: ${item.streamKey || 'MISSING'}`);
        console.log(`  fileId: ${item.fileId || 'NOT SET'}`);
        console.log(`  isPrivateUsername: ${item.isPrivateUsername !== undefined ? item.isPrivateUsername : 'NOT SET'} (type: ${typeof item.isPrivateUsername})`);
        
        // Check if title is accidentally set to streamKey or fileName
        if (item.title && (item.title === item.streamKey || item.title === item.fileName)) {
          console.error(`  ⚠️ WARNING: title appears to be set to streamKey or fileName!`);
        }
        
        // CRITICAL: Check if title is the string "null" (should be actual null or undefined)
        if (item.title === "null" || item.title === null) {
          console.warn(`  ⚠️ WARNING: title is "${item.title}" (should be undefined if not set)`);
        }
      });
      
      const sampleItem = filteredItems[0];
      console.log(`\n📋 Sample item (first) - All keys: ${Object.keys(sampleItem).join(', ')}`);
      console.log(`  isPrivateUsername: ${sampleItem.isPrivateUsername} (type: ${typeof sampleItem.isPrivateUsername})`);
      
      // Debug: Check all items for isPrivateUsername
      filteredItems.forEach((item, index) => {
        if (item.isPrivateUsername !== undefined) {
          console.log(`  [Item ${index + 1}] isPrivateUsername: ${item.isPrivateUsername} (type: ${typeof item.isPrivateUsername})`);
        } else {
          console.log(`  [Item ${index + 1}] isPrivateUsername: NOT SET`);
        }
      });
    }

    return {
      success: true,
      content: paginatedContent, // Return paginated content (already filtered and sorted)
      count: paginatedContent.length,
      nextToken: nextTokenResult,
      hasMore: nextTokenResult !== null
    };

  } catch (error) {
    console.error('Error fetching channel content:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch channel content'
    });
  }
});
