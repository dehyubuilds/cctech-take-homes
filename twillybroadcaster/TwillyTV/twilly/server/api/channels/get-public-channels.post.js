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
    const body = await readBody(event).catch(() => ({}));
    const searchQuery = body.searchQuery || '';
    
    console.log('Fetching channels...', { searchQuery });
    
    // OPTIMIZED: Use GSI for fast, cost-effective queries
    // GSI: ChannelsByVisibilityIndex
    //   Partition Key: visibility (public/searchable/private)
    //   Sort Key: channelName
    let channels = [];
    let useGSI = true;
    
    // Determine which visibility levels to query
    const visibilityLevels = searchQuery ? ['public', 'searchable'] : ['public'];
    
    try {
      // Query each visibility level
      for (const visibility of visibilityLevels) {
        const queryParams = {
          TableName: table,
          IndexName: 'ChannelsByVisibilityIndex',
          KeyConditionExpression: 'visibility = :visibility',
          FilterExpression: 'SK = :sk',
          ExpressionAttributeValues: {
            ':visibility': visibility,
            ':sk': 'METADATA'
          }
        };
        
        let lastEvaluatedKey = null;
        do {
          if (lastEvaluatedKey) {
            queryParams.ExclusiveStartKey = lastEvaluatedKey;
          }
          
          const result = await dynamodb.query(queryParams).promise();
          if (result.Items && result.Items.length > 0) {
            channels = channels.concat(result.Items);
          }
          lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);
      }
      
      console.log(`✅ Queried GSI: Found ${channels.length} channels (${visibilityLevels.join(', ')} visibility)`);
    } catch (error) {
      // If GSI doesn't exist yet, fall back to scan
      if (error.code === 'ResourceNotFoundException' || 
          error.message.includes('index') || 
          error.message.includes('ChannelsByVisibilityIndex')) {
        console.log('⚠️  GSI not available, falling back to scan...');
        useGSI = false;
      } else {
        throw error;
      }
    }
    
    // Fallback to scan if GSI not available
    if (!useGSI) {
      // First try to find channels with METADATA structure
      let params = {
        TableName: table,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'CHANNEL#',
          ':sk': 'METADATA'
        }
      };

      let result = await dynamodb.scan(params).promise();
      channels = result.Items || [];
      
      console.log('Found METADATA channels:', channels.length);
      
      // If no METADATA channels found, try to find channels with OWNER structure
      if (channels.length === 0) {
        console.log('No METADATA channels found, trying OWNER structure...');
        
        params = {
          TableName: table,
          FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
          ExpressionAttributeValues: {
            ':pk': 'CHANNEL#',
            ':sk': 'OWNER'
          }
        };

        result = await dynamodb.scan(params).promise();
        channels = result.Items || [];
        
        console.log('Found OWNER channels:', channels.length);
      }
    }

    // Transform the data to include necessary information
    const transformedChannels = await Promise.all(channels.map(async (channel) => {
      // Extract channelId from PK (format: "CHANNEL#email-channelName" or "CHANNEL#Twilly TV")
      const channelId = channel.PK.replace('CHANNEL#', '');
      const channelIdParts = channelId.split('-');
      const channelName = channel.channelName || channel.series || channelId;
      // creatorEmail: prefer METADATA.creatorEmail; if PK is "CHANNEL#Twilly TV" then channelId has no @, so fetch from METADATA
      let creatorEmail = (channel.creatorEmail && String(channel.creatorEmail).includes('@')) ? channel.creatorEmail : null;
      if (!creatorEmail && channelId.includes('@')) creatorEmail = channelIdParts[0];
      if (!creatorEmail && channelName) {
        try {
          const meta = await dynamodb.get({
            TableName: table,
            Key: { PK: `CHANNEL#${channelName}`, SK: 'METADATA' }
          }).promise();
          creatorEmail = (meta.Item?.creatorEmail && String(meta.Item.creatorEmail).includes('@')) ? meta.Item.creatorEmail.trim().toLowerCase() : null;
        } catch (_) {}
      }
      if (!creatorEmail) creatorEmail = channelIdParts[0];
      // Twilly TV: ensure creatorEmail is a valid email so get-content premium/public queries hit the right partition (USER#email)
      if (channelName && String(channelName).toLowerCase().trim() === 'twilly tv' && (!creatorEmail || !String(creatorEmail).includes('@'))) {
        creatorEmail = 'dehyu.sinyan@gmail.com';
        console.log('✅ [get-public-channels] Twilly TV: using fallback creatorEmail for timeline queries');
      }

      // Check channel visibility (private, searchable, or public)
      // Channels are private by default unless explicitly marked as searchable or public
      let visibility = 'private';
      let isPublic = false;
      
      // First check if the current record has visibility field
      if (channel.visibility) {
        visibility = channel.visibility;
        isPublic = (visibility === 'public');
      } else if (channel.isPublic === true) {
        // Migrate old boolean format
        visibility = 'public';
        isPublic = true;
      } else if (channel.SK === 'OWNER') {
        // For OWNER records, check the corresponding METADATA record
        try {
          const metadataResult = await dynamodb.get({
            TableName: table,
            Key: {
              PK: channel.PK,
              SK: 'METADATA'
            }
          }).promise();
          
          if (metadataResult.Item) {
            if (metadataResult.Item.visibility) {
              visibility = metadataResult.Item.visibility;
              isPublic = (visibility === 'public');
            } else if (metadataResult.Item.isPublic === true) {
              // Migrate old boolean format
              visibility = 'public';
              isPublic = true;
            }
          }
        } catch (error) {
          console.error('Error checking metadata for channel:', channel.PK, error);
          // Default to private if we can't check
          visibility = 'private';
          isPublic = false;
        }
      }
      
      // PRIORITY 1: Get poster from FOLDER record FIRST (where managefiles.vue saves it)
      // This is the source of truth - same location as web app uses
      let posterUrl = null;
      try {
        // Try both email formats - username and actual email
        const emailVariants = [creatorEmail];
        if (creatorEmail === 'dehsin365') {
          emailVariants.push('dehyu.sinyan@gmail.com');
        }
        
        for (const email of emailVariants) {
          // Query FOLDER records FIRST - same structure as managefiles.vue uses
          // PK: USER#email, SK: FOLDER#Mixed#channelName
          const folderParams = {
            TableName: table,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `USER#${email}`,
              ':sk': 'FOLDER#'
            }
          };
          
          const folderResult = await dynamodb.query(folderParams).promise();
          
          // Try multiple matching strategies (same as managefiles.vue logic)
          const folder = folderResult.Items?.find(f => 
            f.name === channelName || 
            f.series === channelName || 
            f.folderName === channelName ||
            f.name === channel.channelName ||
            f.series === channel.channelName ||
            f.folderName === channel.channelName
          );
          
          if (folder && folder.seriesPosterUrl) {
            // Convert URL format: /series-posters/ -> /public/series-posters/
            // Also handle CloudFront domain conversion if needed
            // CRITICAL: Only replace if /public/series-posters/ doesn't already exist
            posterUrl = folder.seriesPosterUrl;
            if (!posterUrl.includes('/public/series-posters/')) {
              posterUrl = posterUrl.replace('/series-posters/', '/public/series-posters/');
            }
            // Remove any double /public/public/ that might have been created
            posterUrl = posterUrl.replace('/public/public/', '/public/');
            posterUrl = posterUrl.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
            // Remove any double /public/public/ that might have been created (after domain replacement)
            posterUrl = posterUrl.replace('/public/public/', '/public/');
            console.log(`✅ [get-public-channels] Found poster from FOLDER record for ${channelName}: ${posterUrl}`);
            break; // Found it, stop searching
          }
        }
      } catch (error) {
        console.error('Error fetching FOLDER record for', channelName, ':', error);
      }
      
      // PRIORITY 2: Fallback to channel record poster
      if (!posterUrl) {
        posterUrl = channel.posterUrl || channel.seriesPosterUrl;
        if (posterUrl) {
          // Convert URL format if needed
          // CRITICAL: Only replace if /public/series-posters/ doesn't already exist
          if (!posterUrl.includes('/public/series-posters/')) {
            posterUrl = posterUrl.replace('/series-posters/', '/public/series-posters/');
          }
          // Remove any double /public/public/ that might have been created
          posterUrl = posterUrl.replace('/public/public/', '/public/');
          posterUrl = posterUrl.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
          // Remove any double /public/public/ that might have been created (after domain replacement)
          posterUrl = posterUrl.replace('/public/public/', '/public/');
          console.log(`✅ [get-public-channels] Using poster from channel record for ${channelName}`);
        }
      }
      
      // PRIORITY 3: Fallback to latest video thumbnail (only if no poster found)
      if (!posterUrl) {
        try {
          // Try both email formats - username and actual email
          const emailVariants = [creatorEmail];
          if (creatorEmail === 'dehsin365') {
            emailVariants.push('dehyu.sinyan@gmail.com');
          }
          
          for (const email of emailVariants) {
            // Only query videos if we don't have a poster yet, or limit the query
            // Get the latest video thumbnail for this channel (always check for latest)
            // CRITICAL: Use query without FilterExpression for folderName to avoid emoji/encoding issues
            // We'll filter in JavaScript instead for better Unicode/emoji handling
            // LIMIT: Only query first 100 videos to avoid timeout
            const videoParams = {
              TableName: table,
              KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
              FilterExpression: 'category = :category AND isVisible = :isVisible AND attribute_exists(thumbnailUrl)',
              ExpressionAttributeValues: {
                ':pk': `USER#${email}`,
                ':sk': 'FILE#',
                ':category': 'Videos',
                ':isVisible': true
              },
              Limit: 100 // Limit to prevent timeout
            };
            
            const videoResult = await dynamodb.query(videoParams).promise();
            
            if (videoResult.Items && videoResult.Items.length > 0) {
              // Filter by folderName in JavaScript (handles emoji/Unicode better than DynamoDB FilterExpression)
              const channelVideos = videoResult.Items.filter(video => {
                const videoFolderName = video.folderName || video.seriesName;
                
                // CRITICAL: Handle emoji/Unicode characters properly
                // Emojis can be encoded differently, so we need flexible matching
                let matches = false;
                
                if (videoFolderName) {
                  // Strategy 1: Exact match (handles emojis correctly if encoding matches)
                  if (videoFolderName === channelName) {
                    matches = true;
                  }
                  // Strategy 2: Normalize both strings (remove emojis for comparison) + case-insensitive
                  else {
                    // Remove emojis and special chars for comparison
                    const normalize = (str) => str.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(/[^\w\s]/gi, '').toLowerCase().trim();
                    const normalizedFile = normalize(videoFolderName);
                    const normalizedChannel = normalize(channelName);
                    
                    if (normalizedFile === normalizedChannel && normalizedFile.length > 0) {
                      matches = true;
                    }
                    // Strategy 3: Check if one contains the other (for partial matches)
                    else if (videoFolderName.includes(channelName) || channelName.includes(videoFolderName)) {
                      matches = true;
                    }
                    // Strategy 4: Check if normalized versions contain each other
                    else if (normalizedFile.includes(normalizedChannel) || normalizedChannel.includes(normalizedFile)) {
                      matches = true;
                    }
                  }
                }
                
                if (matches) {
                  console.log(`✅ Found matching video for channel "${channelName}": folderName="${videoFolderName}", fileName="${video.fileName}", thumbnailUrl="${video.thumbnailUrl ? 'YES' : 'NO'}"`);
                } else if (videoFolderName) {
                  console.log(`⚠️ No match for video: fileChannelName="${videoFolderName}", channelName="${channelName}"`);
                }
                
                return matches;
              });
              
              if (channelVideos.length > 0) {
                // Sort by timestamp/createdAt (newest first) and get the latest video thumbnail
                const sortedVideos = channelVideos.sort((a, b) => {
                  const dateA = (a.createdAt || a.timestamp) ? new Date(a.createdAt || a.timestamp).getTime() : 0;
                  const dateB = (b.createdAt || b.timestamp) ? new Date(b.createdAt || b.timestamp).getTime() : 0;
                  return dateB - dateA; // Newest first
                });
                
                const latestVideo = sortedVideos[0];
                if (latestVideo.thumbnailUrl) {
                  posterUrl = latestVideo.thumbnailUrl;
                  console.log(`✅ Using latest video thumbnail as channel poster for ${channelName}: ${posterUrl}`);
                  break; // Found it, stop searching
                } else {
                  console.log(`⚠️ Latest video for ${channelName} has no thumbnailUrl: ${latestVideo.fileName}`);
                }
              } else {
                console.log(`⚠️ No videos found matching folderName "${channelName}" for email ${email}. Found ${videoResult.Items.length} total videos.`);
                // Debug: log first few folder names to see what we're getting
                const uniqueFolderNames = [...new Set(videoResult.Items.map(v => v.folderName || v.seriesName || 'NONE').slice(0, 5))];
                console.log(`   Sample folderNames found: ${uniqueFolderNames.join(', ')}`);
              }
            }
            
            // If we found a video thumbnail, use it
            if (posterUrl) {
              break; // Found it, stop searching
            }
          } // End of for loop
        } catch (error) {
          console.error('Error fetching video thumbnail for', channelName, ':', error);
        }
      } // End of if (!posterUrl) for video thumbnail fallback
      
      // CRITICAL: Always ensure we have a posterUrl - never return empty
      // If we still don't have one, use the default
      if (!posterUrl) {
        posterUrl = '/assets/channels/icon-512.png';
      }
      
      // Ensure the poster URL has the correct CloudFront domain and public prefix
      if (posterUrl && !posterUrl.startsWith('/assets/')) {
        // Convert to the working CloudFront domain (d3hv50jkrzkiyh.cloudfront.net is the correct one)
        posterUrl = posterUrl.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
        // Don't replace d3hv50jkrzkiyh - it's already correct
        // Fix any incorrect domain references
        posterUrl = posterUrl.replace('d26k8mraabzpiy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
        
        // Ensure it has the public prefix
        // CRITICAL: Only check for /public/series-posters/ specifically, not just /public/
        // This prevents double /public/public/ when URL already has /public/series-posters/
        if (!posterUrl.includes('/public/series-posters/')) {
          // Only replace if /public/series-posters/ doesn't already exist
          posterUrl = posterUrl.replace('/series-posters/', '/public/series-posters/');
        }
        // Remove any double /public/public/ that might have been created
        posterUrl = posterUrl.replace('/public/public/', '/public/');
        
        // Ensure it's a full URL (not relative)
        if (posterUrl && !posterUrl.startsWith('http')) {
          posterUrl = `https://d3hv50jkrzkiyh.cloudfront.net${posterUrl.startsWith('/') ? '' : '/'}${posterUrl}`;
        }
      }
      
      // Get username - check multiple sources
      let actualUsername = channel.creatorUsername || channel.username || '';
      
      // First, try to get username from USER record (where it's stored when updated via account settings)
      try {
        // Scan for USER records with matching email
        const userParams = {
          TableName: table,
          FilterExpression: 'PK = :pk AND email = :email',
          ExpressionAttributeValues: {
            ':pk': 'USER',
            ':email': creatorEmail
          }
        };
        
        const userResult = await dynamodb.scan(userParams).promise();
        if (userResult.Items && userResult.Items.length > 0) {
          const userRecord = userResult.Items[0];
          if (userRecord.username) {
            actualUsername = userRecord.username;
          }
        }
      } catch (error) {
        console.error('Error fetching username from USER record for', creatorEmail, ':', error);
      }
      
      // Also try to get username from STRIPE_CONNECT record as fallback
      if (!actualUsername) {
        try {
          const stripeParams = {
            TableName: table,
            Key: {
              PK: `USER#${creatorEmail}`,
              SK: 'STRIPE_CONNECT'
            }
          };
          
          const stripeResult = await dynamodb.get(stripeParams).promise();
          if (stripeResult.Item && stripeResult.Item.username) {
            actualUsername = stripeResult.Item.username;
          }
        } catch (error) {
          console.error('Error fetching username from STRIPE_CONNECT for', creatorEmail, ':', error);
        }
      }
      
      return {
        channelId: channelId,
        channelName: channelName,
        creatorEmail: creatorEmail,
        creatorUsername: (actualUsername && actualUsername !== creatorEmail) ? actualUsername : (creatorEmail ? creatorEmail.split('@')[0] : 'unknown'),
        subscriptionPrice: channel.subscriptionPrice || 9.99,
        description: channel.description || 'Your personalized streaming network. Add creators you love, curate your timeline, and watch content that matters to you.',
        posterUrl: posterUrl || '/assets/channels/icon-512.png',
        visibility: visibility,
        isPublic: isPublic,
        contentType: channel.contentType || 'Premium Content'
      };
    }));

    // Filter out channels that don't have real poster URLs (test channels, etc.)
    // BUT: Allow searchable channels even without poster (they might be newly created)
    // Only require poster URL for public channels (they should be more established)
    const realChannels = transformedChannels.filter(channel => {
      const isSearchable = channel.visibility === 'searchable';
      const isPublic = channel.visibility === 'public';
      
      // Searchable channels can appear without poster (newly created)
      if (isSearchable) {
        return true; // Include all searchable channels regardless of poster
      }
      
      // Public channels should have a real poster URL
      if (isPublic) {
        return channel.posterUrl && 
               !channel.posterUrl.includes('/assets/channels/icon-512.png') &&
               !channel.posterUrl.includes('default');
      }
      
      return false; // Exclude private channels
    });

    // Remove duplicates based on channelName (case-insensitive, normalized)
    // Normalize channel names: lowercase, trim whitespace
    const normalizeChannelName = (name) => (name || '').toLowerCase().trim();
    
    const uniqueChannels = realChannels.filter((channel, index, self) => {
      const normalizedName = normalizeChannelName(channel.channelName);
      const firstIndex = self.findIndex(c => 
        normalizeChannelName(c.channelName) === normalizedName
      );
      
      // Log if we find a duplicate
      if (index !== firstIndex) {
        console.log(`⚠️ [get-public-channels] Removing duplicate channel: "${channel.channelName}" (index ${index}, first at ${firstIndex})`);
        console.log(`   PK: ${channel.channelId || 'MISSING'}`);
      }
      
      return index === firstIndex;
    });
    
    console.log(`✅ [get-public-channels] Deduplicated: ${realChannels.length} → ${uniqueChannels.length} channels`);

    return {
      success: true,
      channels: uniqueChannels
    };

  } catch (error) {
    console.error('Error fetching public channels:', error);
    return {
      success: false,
      message: 'Failed to fetch public channels',
      channels: []
    };
  }
});