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
    const { channelName, streamKey } = body;
    
    // EC2 server details - NOW USING HTTPS DIRECTLY (no proxy needed!)
    const EC2_IP = '100.24.103.57';
    const EC2_API_URL = `http://${EC2_IP}:3000`;
    const EC2_HLS_URL_HTTP = `http://${EC2_IP}/hls`;
    const EC2_HLS_URL_HTTPS = `https://${EC2_IP}/hls`; // Direct HTTPS - no proxy needed!
    
    // Helper function to get user info for a stream key
    const getUserInfoForStream = async (streamKey, channelName) => {
      try {
        // Try to find stream metadata in DynamoDB by querying channels for this stream key
        if (channelName) {
          const channelQuery = await dynamodb.query({
            TableName: table,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `CHANNEL#${channelName}`,
              ':sk': 'COLLABORATOR#'
            }
          }).promise();
          
          // Find collaborator with matching stream key
          if (channelQuery.Items) {
            const matchingCollab = channelQuery.Items.find(c => c.streamKey === streamKey && c.status === 'active');
            if (matchingCollab) {
              // Get user profile for avatar/username
              if (matchingCollab.userId) {
                const userProfile = await dynamodb.get({
                  TableName: table,
                  Key: {
                    PK: `USER#${matchingCollab.userId}`,
                    SK: 'PROFILE'
                  }
                }).promise();
                
                return {
                  userId: matchingCollab.userId,
                  username: userProfile.Item?.username || matchingCollab.username,
                  userEmail: matchingCollab.userEmail,
                  userAvatarUrl: userProfile.Item?.avatarUrl || null,
                  title: matchingCollab.title || matchingCollab.streamTitle,
                  description: matchingCollab.description || matchingCollab.streamDescription
                };
              }
            }
          }
          
          // Check channel owner stream
          const ownerResult = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `CHANNEL#${channelName}`,
              SK: 'OWNER'
            }
          }).promise();
          
          if (ownerResult.Item) {
            const ownerEmail = ownerResult.Item.email || ownerResult.Item.userEmail;
            if (ownerEmail) {
              // Get owner profile
              const userProfile = await dynamodb.query({
                TableName: table,
                IndexName: 'EmailIndex', // If exists, otherwise scan
                KeyConditionExpression: 'SK = :sk',
                FilterExpression: 'email = :email',
                ExpressionAttributeValues: {
                  ':sk': 'PROFILE',
                  ':email': ownerEmail
                },
                Limit: 1
              }).promise();
              
              return {
                userId: ownerResult.Item.userId || null,
                username: userProfile.Items?.[0]?.username || ownerResult.Item.username || ownerEmail.split('@')[0],
                userEmail: ownerEmail,
                userAvatarUrl: userProfile.Items?.[0]?.avatarUrl || null
              };
            }
          }
        }
        
        return null;
      } catch (error) {
        console.error(`Error getting user info for stream ${streamKey}:`, error);
        return null;
      }
    };
    
    console.log(`[Stream Status] Checking status - streamKey: ${streamKey}, channelName: ${channelName}`);
    
    // If streamKey is provided, check if HLS files exist for that specific stream
    // Note: NGINX RTMP with hls_nested creates index.m3u8, not playlist.m3u8
    // Use HTTP for internal checks (server-to-server), HTTPS for client URLs
    if (streamKey) {
      const hlsUrl = `${EC2_HLS_URL_HTTP}/${streamKey}/index.m3u8`; // Use HTTP for internal check (server-to-server)
      
      try {
        console.log(`[Stream Status] Attempting to check HLS URL: ${hlsUrl}`);
        
        // Try to fetch the HLS playlist to see if stream is active
        const response = await fetch(hlsUrl, { 
          method: 'GET',
          headers: {
            'Accept': 'application/vnd.apple.mpegurl, */*'
          },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        console.log(`[Stream Status] HLS check response status: ${response.status}`);
        
        if (response.ok) {
          const playlistContent = await response.text();
          const contentType = response.headers.get('content-type');
          console.log(`[Stream Status] HLS check successful - Content-Type: ${contentType}`);
          
          // Check if playlist has #EXT-X-ENDLIST tag (if it does, stream ended)
          const hasEndList = playlistContent.includes('#EXT-X-ENDLIST');
          
          if (hasEndList) {
            console.log(`[Stream Status] Playlist has #EXT-X-ENDLIST - stream has ended`);
            // Stream ended, don't return as active - continue to check RTMP to be sure
          } else {
            // Playlist exists and doesn't have ENDLIST - might be active
            // But we need to verify RTMP is actually streaming (HLS files can persist after RTMP stops)
            console.log(`[Stream Status] HLS playlist exists without ENDLIST - will verify RTMP status below`);
            // Don't return yet - continue to check RTMP status to confirm it's actually active
          }
        } else {
          console.log(`[Stream Status] HLS check failed - Status: ${response.status}`);
        }
      } catch (error) {
        // Stream not found or not active
        console.log(`[Stream Status] HLS check error for ${streamKey}: ${error.message}`);
        console.log(`[Stream Status] This could mean: 1) Stream not active, 2) HLS not generated yet (wait 10-15s), 3) NGINX not configured correctly`);
      }
    }
    
    // Check NGINX RTMP status page for active streams
    try {
      console.log(`[Stream Status] Checking NGINX RTMP status page...`);
      const nginxStatusUrl = `http://${EC2_IP}/status`;
      const nginxResponse = await fetch(nginxStatusUrl, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (nginxResponse.ok) {
        const nginxHtml = await nginxResponse.text();
        console.log(`[Stream Status] NGINX status page retrieved (${nginxHtml.length} bytes)`);
        
        // Parse NGINX RTMP status XML to find active streams
        // RTMP status XML format: <stream><name>streamKey</name>...</stream>
        // The <name> tag immediately after <stream> is the stream key
        const streamMatches = nginxHtml.match(/<stream[^>]*>[\s\S]*?<\/stream>/g);
        
        const activeStreamKeys = streamMatches && streamMatches.length > 0
          ? streamMatches
              .map(match => {
                // Try attribute format first: <stream name="...">
                let nameMatch = match.match(/<stream[^>]*name="([^"]+)"/);
                if (nameMatch) {
                  return nameMatch[1];
                }
                // Try child element format: <stream><name>...</name>
                // Match the first <name> tag inside the stream block (which is the stream key)
                nameMatch = match.match(/<stream[^>]*>\s*<name>([^<]+)<\/name>/);
                if (nameMatch) {
                  return nameMatch[1].trim();
                }
                return null;
              })
              .filter(Boolean)
          : []; // Empty array if no active streams
        
        console.log(`[Stream Status] Found ${activeStreamKeys.length} active streams in NGINX: ${activeStreamKeys.length > 0 ? activeStreamKeys.join(', ') : 'none'}`);
        
        // If specific streamKey was requested, check both RTMP status and HLS files
        if (streamKey) {
          // Check RTMP status first (most reliable)
          const rtmpActive = activeStreamKeys.includes(streamKey);
          
          // Also check HLS files (fallback for timing issues or RTMP status lag)
          let hlsActive = false;
          let hlsVerified = false;
          try {
            const hlsCheckUrl = `${EC2_HLS_URL_HTTP}/${streamKey}/index.m3u8`; // Use HTTP for internal check (server-to-server)
            const hlsCheckResponse = await fetch(hlsCheckUrl, {
              method: 'GET',
              headers: { 'Accept': 'application/vnd.apple.mpegurl, */*' },
              signal: AbortSignal.timeout(3000)
            });
            
            if (hlsCheckResponse.ok) {
              const hlsContent = await hlsCheckResponse.text();
              const hasEndList = hlsContent.includes('#EXT-X-ENDLIST');
              hlsVerified = true;
              hlsActive = !hasEndList; // Active if no ENDLIST tag
              
              // Also check if playlist has segments (more reliable than just checking ENDLIST)
              const hasSegments = hlsContent.match(/\.ts$/m) !== null;
              if (hasSegments && !hasEndList) {
                hlsActive = true;
              }
            }
          } catch (hlsError) {
            console.log(`[Stream Status] HLS verification failed: ${hlsError.message}`);
          }
          
          // Mark as active if EITHER RTMP confirms it OR HLS files exist without ENDLIST
          // This handles timing issues where HLS is generated but RTMP status hasn't updated yet
          if (rtmpActive || hlsActive) {
            return {
              success: true,
              isActive: true,
              streamKey: streamKey,
              streamUrl: `https://${EC2_IP}/hls/${streamKey}/index.m3u8`, // Direct HTTPS from EC2 - no proxy!
              message: rtmpActive && hlsVerified
                ? 'Stream is active and HLS files are available'
                : rtmpActive
                ? 'Stream is active in RTMP (HLS files may still be generating)'
                : hlsActive
                ? 'Stream appears active (HLS files found, RTMP status may have a slight delay)'
                : 'Stream is active'
            };
          } else {
            // streamKey was provided but NOT found in RTMP active streams AND no active HLS files
            return {
              success: true,
              isActive: false,
              streamKey: streamKey,
              message: 'Stream is not active. Start streaming from your device and wait 15-20 seconds for the connection to establish and HLS files to generate.'
            };
          }
        }
        
        // If no active streams found in RTMP, check for streams with recent HLS files
        // This handles cases where streams are active but RTMP status hasn't updated yet
        // OR when checking all channels with open sessions (what user wants)
        if (activeStreamKeys.length === 0 && !streamKey) {
          console.log(`[Stream Status] No RTMP streams found, checking streaming service for active streams...`);
          
          // Check streaming service for active streams
          try {
            const serviceResponse = await fetch(`${EC2_API_URL}/streams`, {
              signal: AbortSignal.timeout(3000)
            });
            
            if (serviceResponse.ok) {
              const serviceData = await serviceResponse.json();
              if (serviceData.streams && serviceData.streams.length > 0) {
                const serviceStreamKeys = serviceData.streams
                  .filter(s => s.status === 'active')
                  .map(s => s.name || s.streamId);
                
                if (serviceStreamKeys.length > 0) {
                  console.log(`[Stream Status] Found ${serviceStreamKeys.length} active stream(s) in streaming service: ${serviceStreamKeys.join(', ')}`);
                  activeStreamKeys.push(...serviceStreamKeys);
                }
              }
            }
          } catch (serviceError) {
            console.log(`[Stream Status] Could not check streaming service: ${serviceError.message}`);
          }
        }
        
        // Return all active streams with user info (if no specific streamKey requested)
        if (activeStreamKeys.length > 0) {
            // Fetch user info for each stream key and verify HLS files exist
            const streamsWithUserInfo = await Promise.all(
              activeStreamKeys.map(async (key) => {
                try {
                  // Verify HLS files exist for this stream
                  let hlsVerified = false;
                  try {
                    const hlsCheckUrl = `${EC2_HLS_URL_HTTP}/${key}/index.m3u8`; // Use HTTP for internal check (server-to-server)
                    const hlsCheckResponse = await fetch(hlsCheckUrl, {
                      method: 'GET',
                      headers: { 'Accept': 'application/vnd.apple.mpegurl, */*' },
                      signal: AbortSignal.timeout(3000)
                    });
                    
                    if (hlsCheckResponse.ok) {
                      const hlsContent = await hlsCheckResponse.text();
                      const hasEndList = hlsContent.includes('#EXT-X-ENDLIST');
                      const hasSegments = hlsContent.match(/\.ts$/m) !== null;
                      hlsVerified = hasSegments && !hasEndList; // Active if has segments and no ENDLIST
                    }
                  } catch (hlsError) {
                    console.log(`[Stream Status] HLS verification failed for ${key}: ${hlsError.message}`);
                  }
                  
                  // Only include streams with verified HLS files
                  if (!hlsVerified) {
                    console.log(`[Stream Status] Stream ${key} has no valid HLS files, skipping`);
                    return null;
                  }
                  
                  const userInfo = await getUserInfoForStream(key, channelName);
                  
                  return {
                    streamKey: key,
                    streamUrl: `https://${EC2_IP}/hls/${key}/index.m3u8`, // Direct HTTPS from EC2 - no proxy!
                    channelName: channelName || null,
                    userId: userInfo?.userId || null,
                    username: userInfo?.username || null,
                    userEmail: userInfo?.userEmail || null,
                    userAvatarUrl: userInfo?.userAvatarUrl || null,
                    title: userInfo?.title || null,
                    description: userInfo?.description || null,
                    status: 'active',
                    isLive: true
                  };
                } catch (error) {
                  console.error(`Error fetching user info for stream ${key}:`, error);
                  // Don't return streams without verified HLS files
                  return null;
                }
              })
            );
            
            // Filter out null streams (those without verified HLS files)
            const validStreams = streamsWithUserInfo.filter(s => s !== null);
            
            if (validStreams.length > 0) {
              return {
                success: true,
                isActive: true,
                activeStreams: validStreams,
                message: `Found ${validStreams.length} active stream(s) with valid HLS files`
              };
            }
          }
      }
    } catch (error) {
      console.error(`[Stream Status] Error checking NGINX status: ${error.message}`);
      
      // If streamKey was provided but NGINX check failed, return inactive
      // (we can't confirm it's active if we can't check RTMP status)
      if (streamKey) {
        return {
          success: true,
          isActive: false,
          streamKey: streamKey,
          message: 'Unable to verify stream status. Make sure you are streaming and RTMP server is accessible.'
        };
      }
    }
    
    // If we got here and streamKey was provided but not found in RTMP active streams,
    // return inactive (this handles the case where RTMP status was checked but streamKey wasn't in the list)
    if (streamKey) {
      return {
        success: true,
        isActive: false,
        streamKey: streamKey,
        message: 'Stream is not active. Start streaming from your device and wait 10-15 seconds for HLS to generate.'
      };
    }
    
    // Check with streaming service for active streams (fallback - only if no streamKey provided)
    try {
      console.log(`[Stream Status] Checking streaming service API...`);
      const streamsResponse = await fetch(`${EC2_API_URL}/streams`, {
        signal: AbortSignal.timeout(3000)
      });
      
      if (streamsResponse.ok) {
        const streamsData = await streamsResponse.json();
        console.log(`[Stream Status] Streaming service response:`, JSON.stringify(streamsData));
        
        if (streamsData.streams && streamsData.streams.length > 0) {
          const activeStreams = streamsData.streams.filter(s => s.status === 'active');
          
          if (activeStreams.length > 0) {
            // Fetch user info for streams from streaming service
            const streamsWithUserInfo = await Promise.all(
              activeStreams.map(async (s) => {
                try {
                  const userInfo = await getUserInfoForStream(s.name, channelName);
                  return {
                    streamKey: s.name,
                    streamUrl: `${EC2_HLS_URL_HTTPS}/${s.name}/index.m3u8`, // Direct HTTPS from EC2
                    channelName: channelName || null,
                    userId: userInfo?.userId || null,
                    username: userInfo?.username || null,
                    userEmail: userInfo?.userEmail || null,
                    userAvatarUrl: userInfo?.userAvatarUrl || null,
                    title: userInfo?.title || null,
                    description: userInfo?.description || null,
                    startTime: s.startTime,
                    status: s.status,
                    isLive: true
                  };
                } catch (error) {
                  console.error(`Error fetching user info for stream ${s.name}:`, error);
                  return {
                    streamKey: s.name,
                    streamUrl: `${EC2_HLS_URL_HTTPS}/${s.name}/index.m3u8`, // Direct HTTPS from EC2
                    channelName: channelName || null,
                    startTime: s.startTime,
                    status: s.status,
                    isLive: true
                  };
                }
              })
            );
            
            return {
              success: true,
              isActive: true,
              activeStreams: streamsWithUserInfo,
              message: `Found ${activeStreams.length} active stream(s) in streaming service`
            };
          }
        }
      }
    } catch (error) {
      console.error(`[Stream Status] Error checking streaming service: ${error.message}`);
    }
    
    // No active streams found
    const message = streamKey 
      ? `Stream ${streamKey} is not active. Possible reasons: 1) Not streaming yet, 2) Stream stopped, 3) HLS not generated yet (wait 10-15 seconds after starting stream), 4) NGINX not generating HLS files`
      : 'No active streams found. Start streaming on your device first!';
    
    console.log(`[Stream Status] ${message}`);
    
    return {
      success: true,
      isActive: false,
      message: message,
      debug: {
        checkedHLS: !!streamKey,
        checkedNGINX: true,
        checkedStreamingService: true
      }
    };
    
  } catch (error) {
    console.error('[Stream Status] Error checking stream status:', error);
    throw createError({
      statusCode: 500,
      message: `Failed to check stream status: ${error.message}`
    });
  }
}); 