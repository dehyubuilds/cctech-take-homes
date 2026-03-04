import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { searchQuery, limit = 50, visibilityFilter = 'all' } = body; // visibilityFilter: 'all', 'public', 'private'

    console.log('Search usernames request:', { searchQuery, limit, visibilityFilter });

    // Validate required fields
    if (!searchQuery || searchQuery.trim().length === 0) {
      return {
        success: false,
        message: 'Missing required field: searchQuery',
        usernames: []
      };
    }

    // Handle search for username🔒 (private username)
    // If search query ends with 🔒, search for private usernames
    const isSearchingForPrivate = searchQuery.trim().endsWith('🔒');
    const cleanSearchQuery = isSearchingForPrivate ? searchQuery.trim().slice(0, -1) : searchQuery.trim();

    // OPTIMIZED: Use GSI for fast, cost-effective queries
    // GSI: UsernameSearchIndex
    //   Partition Key: usernameVisibility (public/private)
    //   Sort Key: username (for prefix matching)
    const searchQueryLower = cleanSearchQuery.toLowerCase();
    let allUsers = [];
    let useGSI = true;
    
    // SIMPLIFIED: Source of truth for private accounts is STREAM_KEY#MAPPING
    // - Public users: Search PROFILE items (GSI or scan) with usernameVisibility: 'public'
    // - Private users: Search STREAM_KEY#MAPPING for streamUsername containing 🔒
    // NO MORE usernameVisibility: 'private' or privateUsername fields in PROFILE - those are disabled
    
    // For public users, use GSI to search PROFILE items
    if (visibilityFilter === 'public' || visibilityFilter === 'all') {
      console.log(`🔍 Querying GSI for public users, searchQuery: "${cleanSearchQuery}"`);
      
      try {
        const queryParams = {
      TableName: table,
          IndexName: 'UsernameSearchIndex',
          KeyConditionExpression: 'usernameVisibility = :visibility',
      ExpressionAttributeValues: {
            ':visibility': 'public'
          },
          Limit: limit * 2
        };
        
        let lastEvaluatedKey = null;
        let queryCount = 0;
        
        do {
          if (lastEvaluatedKey) {
            queryParams.ExclusiveStartKey = lastEvaluatedKey;
          }
          
          const result = await dynamodb.query(queryParams).promise();
          const items = result.Items || [];
          
          items.forEach(profile => {
            if (!profile.username) return;
            
            const usernameLower = profile.username.toLowerCase();
            if (usernameLower.includes(searchQueryLower)) {
              const email = profile.PK ? profile.PK.replace('USER#', '') : null;
              if (email) {
                allUsers.push({
                  ...profile,
                  email: email,
                  userId: profile.userId || email,
                  usernameVisibility: 'public' // Explicitly mark as public
                });
                console.log(`   [GSI Query] ✅ Public user: "${profile.username}" (email: ${email})`);
              }
            }
          });
          
          lastEvaluatedKey = result.LastEvaluatedKey;
          queryCount++;
          
          if (allUsers.length >= limit * 2) {
            break;
          }
        } while (lastEvaluatedKey);
        
        console.log(`✅ Queried public partition: ${queryCount} pages, ${allUsers.length} matches`);
      } catch (error) {
        if (error.code === 'ResourceNotFoundException' || 
            error.message.includes('index') || 
            error.message.includes('UsernameSearchIndex')) {
          console.log('⚠️  GSI not available, will use scan fallback...');
          useGSI = false;
        } else {
          throw error;
        }
      }
    }
    
    // For private users, ONLY search STREAM_KEY#MAPPING (source of truth)
    if (visibilityFilter === 'private' || visibilityFilter === 'all' || isSearchingForPrivate) {
      console.log(`🔍 [PRIVATE SEARCH] Scanning STREAM_KEY#MAPPING for query: "${searchQuery}" (filter: ${visibilityFilter})...`);
      console.log(`   📊 Current allUsers count before private search: ${allUsers.length}`);
      let lastEvaluatedKey = null;
      let scanCount = 0;
      let totalScanned = 0;
      let privateMatches = 0;
      
      do {
        // Scan ALL STREAM_KEY#MAPPING items first, then filter in code (more reliable than FilterExpression with emojis)
        const scanParams = {
          TableName: table,
          FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
          ExpressionAttributeValues: {
            ':pk': 'STREAM_KEY#',
            ':sk': 'MAPPING'
          },
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: 100
        };
        
        const result = await dynamodb.scan(scanParams).promise();
        const items = result.Items || [];
        totalScanned += items.length;
        
        console.log(`   📄 Scanned page ${scanCount + 1}: ${items.length} items (total scanned: ${totalScanned})`);
        
        items.forEach(mapping => {
          // Check if streamUsername contains 🔒 (private username indicator)
          if (!mapping.streamUsername || !mapping.streamUsername.includes('🔒')) {
            return; // Skip non-private usernames
          }
          
          // Extract base username (without 🔒) for matching
          const baseUsername = mapping.streamUsername.replace('🔒', '').trim();
          const baseUsernameLower = baseUsername.toLowerCase();
          
          // Check if it matches the search query (case-insensitive substring match)
          if (baseUsernameLower.includes(searchQueryLower)) {
            console.log(`   🔍 [PRIVATE CHECK] "${mapping.streamUsername}" (base: "${baseUsername}") matches "${searchQuery}" - checking for duplicates...`);
            
            // Check if we already have this EXACT private username (with 🔒) - allow both public and private versions
            // CRITICAL: We want BOTH "POM-J" (public) AND "POM-J🔒" (private) in results
            const existingPrivate = allUsers.find(u => {
              const uUsername = (u.username || '').toLowerCase();
              return uUsername === mapping.streamUsername.toLowerCase();
            });
            
            if (!existingPrivate) {
              // Get user email from mapping
              const userEmail = mapping.userEmail || mapping.email || mapping.collaboratorEmail || mapping.ownerEmail;
              
              // Create a user entry for this private stream username
              allUsers.push({
                username: mapping.streamUsername, // Full username with 🔒 (e.g., "POM-J🔒")
                email: userEmail || 'unknown',
                userId: mapping.userId || userEmail || 'unknown',
                usernameVisibility: 'private', // Mark as private
                PK: userEmail ? `USER#${userEmail}` : 'STREAM_KEY#UNKNOWN',
                SK: 'PROFILE',
                isFromStreamMapping: true // Flag to indicate this came from stream mapping
              });
              privateMatches++;
              console.log(`   ✅ [PRIVATE MATCH] Added: "${mapping.streamUsername}" (base: "${baseUsername}") matches "${searchQuery}" (email: ${userEmail || 'N/A'})`);
            } else {
              console.log(`   ⚠️ [PRIVATE SKIP] "${mapping.streamUsername}" already exists in allUsers (exact match)`);
            }
          }
        });
        
        lastEvaluatedKey = result.LastEvaluatedKey;
        scanCount++;
        
        // Continue scanning until we have enough results or no more pages
        if (allUsers.length >= limit * 2) {
          console.log(`   ⚠️ Reached result limit (${limit * 2}), stopping scan`);
          break;
        }
      } while (lastEvaluatedKey);
      
      console.log(`📊 [PRIVATE SEARCH COMPLETE] Scanned ${scanCount} pages, ${totalScanned} total items, ${privateMatches} private matches found`);
      console.log(`   📊 Current allUsers count after private search: ${allUsers.length}`);
      console.log(`   📋 Private usernames found: ${allUsers.filter(u => u.usernameVisibility === 'private').map(u => u.username).join(', ')}`);
    } else {
      console.log(`⚠️ [PRIVATE SEARCH] Skipped - visibilityFilter: ${visibilityFilter}, isSearchingForPrivate: ${isSearchingForPrivate}`);
    }
    
    // Fallback to scan if GSI not available OR if we need to check USER records too
    // Always scan USER records as a fallback (for users without PROFILE items)
    // This ensures we find all usernames like before the GSI migration
    const shouldScanUserRecords = allUsers.length < limit; // Scan if we don't have enough results
    
    // First, scan PROFILE items if GSI not available - ONLY for public searches
    // CRITICAL: For private searches, ONLY use STREAM_KEY#MAPPING (no PROFILE fallback)
    // This ensures private tab only shows private accounts (with 🔒)
    if (!useGSI && visibilityFilter !== 'private') {
      console.log('🔍 Scanning PROFILE items as fallback (public only)...');
      const targetResults = limit * 3;
    let lastEvaluatedKey = null;
    let scanCount = 0;
    
    do {
      const scanParams = {
        TableName: table,
          FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk',
        ExpressionAttributeValues: {
            ':pkPrefix': 'USER#',
            ':sk': 'PROFILE'
        },
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: 100
      };
      
      const result = await dynamodb.scan(scanParams).promise();
      const items = result.Items || [];
        
        items.forEach(profile => {
          const email = profile.PK ? profile.PK.replace('USER#', '') : null;
          if (!email || !profile.username) return;
          
          // Only include public users in fallback scan (private comes from STREAM_KEY only)
          const userVisibility = profile.usernameVisibility || 'public';
          if (userVisibility.toLowerCase() === 'private') return; // Skip private (they come from STREAM_KEY)
          
          const usernameLower = profile.username.toLowerCase();
          if (usernameLower.includes(searchQueryLower)) {
            // Check if we already have this user (avoid duplicates)
            const existing = allUsers.find(u => u.username?.toLowerCase() === profile.username.toLowerCase());
            if (!existing) {
              allUsers.push({
                ...profile,
                email: email,
                userId: profile.userId || email,
                usernameVisibility: 'public' // Explicitly mark as public
              });
            }
          }
        });
        
      lastEvaluatedKey = result.LastEvaluatedKey;
      scanCount++;
      
        if (allUsers.length >= targetResults) {
          break;
      }
    } while (lastEvaluatedKey);

      console.log(`📊 PROFILE scan: ${scanCount} pages, ${allUsers.length} matches so far`);
    }
    
    // Also scan USER records (for users without PROFILE items) - ONLY for public searches
    // CRITICAL: Don't scan USER records for private searches - private comes from STREAM_KEY only
    if (shouldScanUserRecords && visibilityFilter !== 'private') {
      console.log('🔍 Scanning USER records as additional fallback (for users without PROFILE items)...');
      let lastEvaluatedKey = null;
      let scanCount = 0;
      
      do {
        const scanParams = {
          TableName: table,
          FilterExpression: 'PK = :pk',
          ExpressionAttributeValues: {
            ':pk': 'USER'
          },
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: 100
        };
        
        const result = await dynamodb.scan(scanParams).promise();
        const items = result.Items || [];
        
        items.forEach(user => {
          if (!user.username) return;
          
          // Skip if we already found this username from PROFILE
          const existing = allUsers.find(u => u.username?.toLowerCase() === user.username.toLowerCase());
          if (existing) return;
          
          const usernameLower = user.username.toLowerCase();
          if (usernameLower.includes(searchQueryLower)) {
            // For USER records, we don't have usernameVisibility, so default to public
            // But check if user has a private username set
            const isUserPrivate = false; // USER records don't have visibility, default to public
            
            // Apply visibility filter
            // CRITICAL: Don't include USER records in private searches - private comes from STREAM_KEY only
            if (visibilityFilter === 'private' || isSearchingForPrivate) return; // Skip for private searches
            
            const email = user.email || user.userId || user.SK;
            allUsers.push({
              username: user.username,
              email: email,
              userId: user.userId || user.SK,
              usernameVisibility: 'public', // Default to public for USER records
              PK: `USER#${email}`,
              SK: 'PROFILE' // Mark as if it were a PROFILE for consistency
            });
            console.log(`   ✅ Found in USER record: "${user.username}" (email: ${email})`);
          }
        });
        
        lastEvaluatedKey = result.LastEvaluatedKey;
        scanCount++;
        
        if (allUsers.length >= limit * 2) {
          break;
        }
      } while (lastEvaluatedKey);
      
      console.log(`📊 USER scan: ${scanCount} pages, ${allUsers.length} total matches`);
    }
    
    // NOTE: Private search is already handled in the block above (lines 111-187)
    // This duplicate block has been removed to avoid conflicts

    // Limit results
    const limitedUsers = allUsers.slice(0, limit);

    console.log(`Found ${limitedUsers.length} users matching query: "${searchQuery}" (filter: ${visibilityFilter})`);

    // Format usernames (remove duplicates and format)
    // Use Map to deduplicate by username (case-insensitive)
    const usernameMap = new Map();
    
    // Batch fetch premium status for all users
    const premiumChecks = await Promise.all(
      limitedUsers.map(async (user) => {
        if (!user.email) return { email: null, isPremium: false, subscriptionPrice: null };
        
        try {
          // Check if user has premium enabled and active Stripe account
          const [profileResult, premiumSettingsResult, stripeResult] = await Promise.all([
            dynamodb.get({
              TableName: table,
              Key: { PK: `USER#${user.email}`, SK: 'PROFILE' }
            }).promise(),
            dynamodb.get({
              TableName: table,
              Key: { PK: `USER#${user.email}`, SK: 'PREMIUM_SETTINGS' }
            }).promise(),
            dynamodb.get({
              TableName: table,
              Key: { PK: `USER#${user.email}`, SK: 'STRIPE_CONNECT' }
            }).promise()
          ]);
          
          const isPremiumEnabled = profileResult.Item?.isPremiumEnabled || false;
          const hasStripeAccount = !!stripeResult.Item?.stripeAccountId;
          const stripeStatus = stripeResult.Item?.status || 'none';
          const isStripeActive = stripeStatus === 'connected' || stripeStatus === 'active';
          const isPremium = isPremiumEnabled && hasStripeAccount && isStripeActive;
          const subscriptionPrice = premiumSettingsResult.Item?.subscriptionPrice || null;
          
          return {
            email: user.email,
            isPremium,
            subscriptionPrice
          };
        } catch (error) {
          console.error(`Error checking premium for ${user.email}:`, error);
          return { email: user.email, isPremium: false, subscriptionPrice: null };
        }
      })
    );
    
    const premiumMap = new Map(premiumChecks.map(check => [check.email, check]));
    
    limitedUsers.forEach(user => {
      const userVisibility = user.usernameVisibility || 'public';
      const isUserPrivate = userVisibility.toLowerCase() === 'private';
      
      // CRITICAL: Public and private usernames are SEPARATE accounts
      // - Public username: "POM-J" (shows public streams)
      // - Private username: "POM-J🔒" (shows private streams, from STREAM_KEY#MAPPING)
      // Usernames with 🔒 already exist in STREAM_KEY mappings - don't modify them
      
      // Use username EXACTLY as stored - don't modify it
      let finalUsername = user.username?.trim();
      
      if (!finalUsername || finalUsername.length === 0) {
        return; // Skip users without username
      }
      
      // Use full username (with 🔒 if it has it) as the key to avoid duplicates
      const finalUsernameLower = finalUsername.toLowerCase();
      
      // Get premium status
      const premiumInfo = premiumMap.get(user.email) || { isPremium: false, subscriptionPrice: null };
      
      // Only add if we haven't seen this EXACT username (with or without 🔒) before
      if (!usernameMap.has(finalUsernameLower)) {
        usernameMap.set(finalUsernameLower, {
          username: finalUsername, // Full username as stored (with 🔒 if private from STREAM_KEY)
          displayUsername: finalUsername, // Same - no modification needed
          email: user.email,
          userId: user.userId,
          visibility: userVisibility, // 'public', 'private', or 'premium'
          isPrivate: isUserPrivate, // Actual privacy status (true if from STREAM_KEY with 🔒)
          isPremium: premiumInfo.isPremium, // Premium status
          subscriptionPrice: premiumInfo.subscriptionPrice // Subscription price if Premium
        });
      }
    });

    const usernames = Array.from(usernameMap.values());

    console.log(`📤 Returning ${usernames.length} usernames to client`);
    if (usernames.length > 0) {
      console.log(`   Sample results: ${usernames.slice(0, 3).map(u => u.username).join(', ')}`);
    }

    return {
      success: true,
      message: 'Usernames retrieved successfully',
      usernames: usernames,
      count: usernames.length
    };

  } catch (error) {
    console.error('❌ Error in search-usernames:', error);
    console.error('   Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return {
      success: false,
      message: `Failed to search usernames: ${error.message}`,
      usernames: [],
      error: error.message
    };
  }
});
