import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
  QueryCommand,
  GetItemCommand,
  DeleteItemCommand,
  ScanCommand
} from "@aws-sdk/client-dynamodb";

export const handler = async (event) => {
  console.log("Incoming Event:");
  console.log(JSON.stringify(event, null, 2));

  const dynamodb = new DynamoDBClient({ region: "us-east-1" });
  const table = "Twilly";
  const cloudFrontBaseUrl = "https://d4idc5cmwxlpy.cloudfront.net";

  /** Short clips must never exist in DynamoDB. Videos shorter than this are not written. */
  const MIN_DURATION_SECONDS = 6;

  /** Fetch HLS playlist and return total duration in seconds, or null if unavailable. */
  async function getDurationFromHlsUrl(hlsUrl) {
    try {
      const res = await fetch(hlsUrl, { signal: AbortSignal.timeout(15000) });
      let body = await res.text();
      if (!body || typeof body !== "string") return null;
      if (body.includes("#EXT-X-STREAM-INF")) {
        const lines = body.split(/\r?\n/);
        let variantUrl = null;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
            const next = lines[i + 1];
            if (next && !next.startsWith("#")) {
              variantUrl = next.trim();
              break;
            }
          }
        }
        if (!variantUrl) return null;
        const base = new URL(hlsUrl);
        const resolved = new URL(variantUrl, base.origin + base.pathname.replace(/\/[^/]*$/, "/"));
        const variantRes = await fetch(resolved.toString(), { signal: AbortSignal.timeout(15000) });
        body = await variantRes.text();
        if (!body || typeof body !== "string") return null;
      }
      const extinf = /#EXTINF:(\d+(?:\.\d+)?)\s*,/g;
      let total = 0;
      let m;
      while ((m = extinf.exec(body)) !== null) total += parseFloat(m[1]);
      return total > 0 ? total : null;
    } catch (e) {
      console.warn("Could not get HLS duration:", e?.message || e);
      return null;
    }
  }

  // Function to look up user account from stream key
  const getUserFromStreamKey = async (streamKey) => {
    try {
      console.log(`Looking up user for stream key: ${streamKey}`);
      
      // First, get the stream key mapping
      // CRITICAL: Use GetItemCommand with ConsistentRead to ensure we get the latest mapping (including isPremium)
      const getItem = new GetItemCommand({
        TableName: table,
        Key: {
          PK: { S: `STREAM_KEY#${streamKey}` },
          SK: { S: "MAPPING" }
        },
        ConsistentRead: true // CRITICAL: Use strong consistency to ensure we get the latest mapping
      });
      
      const result = await dynamodb.send(getItem);
      if (result.Item) {
        const item = result.Item;
        
        // Handle both personal keys (ownerEmail) and collaborator keys (collaboratorEmail)
        let userEmail = null;
        if (item.ownerEmail && item.ownerEmail.S) {
          userEmail = item.ownerEmail.S;
        } else if (item.collaboratorEmail && item.collaboratorEmail.S) {
          userEmail = item.collaboratorEmail.S;
        }
        
        // Handle both seriesName (personal) and channelName (collaborator)
        // CRITICAL: For Twilly TV, prioritize channelName over seriesName to ensure correct matching
        let folderName = null;
        if (item.channelName && item.channelName.S) {
          folderName = item.channelName.S;
        } else if (item.seriesName && item.seriesName.S) {
          folderName = item.seriesName.S;
        }
        
        const channelId = item.channelId && item.channelId.S ? item.channelId.S : null;
        const isPersonalKey = item.isPersonalKey && item.isPersonalKey.BOOL ? item.isPersonalKey.BOOL : false;
        const isCollaboratorKey = item.isCollaboratorKey && item.isCollaboratorKey.BOOL ? item.isCollaboratorKey.BOOL : false;
        const creatorId = item.creatorId && item.creatorId.S ? item.creatorId.S : null;
        // Get streamUsername from mapping (will be "username🔒" if private, or just "username" if public)
        const streamUsername = item.streamUsername && item.streamUsername.S ? item.streamUsername.S : null;
        // Get isPrivateUsername from streamKey mapping (set when user selects private before streaming)
        // Handle DynamoDB format { BOOL: true }, string 'true'/'1', or number 1
        // Also check streamUsername for 🔒 as fallback
        let isPrivateUsername = false;
        if (item.isPrivateUsername) {
          if (item.isPrivateUsername.BOOL !== undefined) {
            isPrivateUsername = item.isPrivateUsername.BOOL === true;
          } else if (item.isPrivateUsername.S !== undefined) {
            isPrivateUsername = item.isPrivateUsername.S === 'true' || item.isPrivateUsername.S === '1';
          } else if (item.isPrivateUsername.N !== undefined) {
            isPrivateUsername = item.isPrivateUsername.N === '1';
          }
        } else if (streamUsername && streamUsername.includes('🔒')) {
          // Fallback: Check streamUsername for 🔒
          isPrivateUsername = true;
        }
        
        // Get isPremium from streamKey mapping
        let isPremium = false;
        if (item.isPremium) {
          if (item.isPremium.BOOL !== undefined) {
            isPremium = item.isPremium.BOOL === true;
          } else if (item.isPremium.S !== undefined) {
            isPremium = item.isPremium.S === 'true' || item.isPremium.S === '1';
          } else if (item.isPremium.N !== undefined) {
            isPremium = item.isPremium.N === '1';
          }
        }
        
        console.log(`Found stream key mapping - User Email: ${userEmail}, Folder: ${folderName}, Channel ID: ${channelId}, Is Personal Key: ${isPersonalKey}, Is Collaborator Key: ${isCollaboratorKey}, Creator ID: ${creatorId || 'N/A'}, Stream Username: ${streamUsername || 'N/A'}, Is Private Username: ${isPrivateUsername}, Is Premium: ${isPremium}`);                      
        
        return { userEmail, folderName, channelId, isPersonalKey, isCollaboratorKey, creatorId, isPrivateUsername, streamUsername, isPremium };
        
      } else {
        console.log(`No stream key mapping found for: ${streamKey}`);
        return null;
      }
    } catch (error) {
      console.error(`Error looking up stream key ${streamKey}:`, error);
      return null;
    }
  };

  // Function to get all collaborators for a channel
  const getChannelCollaborators = async (channelId, channelName) => {
    try {
      console.log(`Looking up collaborators for channel: ${channelId} (${channelName})`);
      
      // Try both channelId and channelName as the PK
      const queries = [
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "PK = :pk",
          FilterExpression: "channelId = :channelId AND #status = :status",
          ExpressionAttributeNames: {
            "#status": "status"
          },
          ExpressionAttributeValues: {
            ":pk": { S: `COLLABORATION#${channelId}` },
            ":channelId": { S: channelId },
            ":status": { S: "active" }
          }
        }),
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "PK = :pk",
          FilterExpression: "channelId = :channelId AND #status = :status",
          ExpressionAttributeNames: {
            "#status": "status"
          },
          ExpressionAttributeValues: {
            ":pk": { S: `COLLABORATION#${channelName}` },
            ":channelId": { S: channelId },
            ":status": { S: "active" }
          }
        })
      ];
      
      // Try the first query (channelId as PK)
      let result = await dynamodb.send(queries[0]);
      if (result.Items && result.Items.length > 0) {
        const collaborators = result.Items.map(item => ({
          email: item.collaboratorEmail.S,
          joinedAt: item.joinedAt.S,
          permissions: item.permissions?.SS || []
        }));
        console.log(`Found ${collaborators.length} collaborators for channel ${channelId} (by channelId):`, collaborators.map(c => c.email));                                                                                   
        return collaborators;
      }
      
      // Try the second query (channelName as PK)
      result = await dynamodb.send(queries[1]);
      if (result.Items && result.Items.length > 0) {
        const collaborators = result.Items.map(item => ({
          email: item.collaboratorEmail.S,
          joinedAt: item.joinedAt.S,
          permissions: item.permissions?.SS || []
        }));
        console.log(`Found ${collaborators.length} collaborators for channel ${channelId} (by channelName):`, collaborators.map(c => c.email));                                                                                 
        return collaborators;
      }
      
      // If no collaborations found, try looking in CHANNEL# records for collaborators
      const channelQuery = new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk",
        FilterExpression: "channelId = :channelId AND #status = :status AND #role = :role",
        ExpressionAttributeNames: {
          "#status": "status",
          "#role": "role"
        },
        ExpressionAttributeValues: {
          ":pk": { S: `CHANNEL#${channelName}` },
          ":channelId": { S: channelId },
          ":status": { S: "active" },
          ":role": { S: "collaborator" }
        }
      });
      
      result = await dynamodb.send(channelQuery);
      if (result.Items && result.Items.length > 0) {
        const collaborators = result.Items.map(item => ({
          email: item.userEmail.S,
          joinedAt: item.joinedAt.S,
          permissions: item.permissions?.SS || []
        }));
        console.log(`Found ${collaborators.length} collaborators for channel ${channelId} (from CHANNEL records):`, collaborators.map(c => c.email));                                                                           
        return collaborators;
      }
      
      console.log(`No collaborators found for channel ${channelId}`);
      return [];
    } catch (error) {
      console.error(`Error looking up collaborators for channel ${channelId}:`, error);
      return [];
    }
  };

  // Function to get channel owner from channel ID
  const getChannelOwner = async (channelId, channelName) => {
    try {
      console.log(`Looking up channel owner for: ${channelId} (${channelName})`);
      
      // CRITICAL: Special handling for Twilly TV - always use known owner
      if (channelName === 'Twilly TV') {
        console.log(`✅ Using known owner for Twilly TV: dehyu.sinyan@gmail.com`);
        return 'dehyu.sinyan@gmail.com';
      }
      
      // Try both channelId and channelName as the PK
      const queries = [
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "PK = :pk",
          FilterExpression: "channelId = :channelId AND #role = :ownerRole",
          ExpressionAttributeNames: {
            "#role": "role"
          },
          ExpressionAttributeValues: {
            ":pk": { S: `CHANNEL#${channelId}` },
            ":channelId": { S: channelId },
            ":ownerRole": { S: "owner" }
          }
        }),
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "PK = :pk",
          FilterExpression: "channelId = :channelId AND #role = :ownerRole",
          ExpressionAttributeNames: {
            "#role": "role"
          },
          ExpressionAttributeValues: {
            ":pk": { S: `CHANNEL#${channelName}` },
            ":channelId": { S: channelId },
            ":ownerRole": { S: "owner" }
          }
        })
      ];
      
      // Try the first query (channelId as PK)
      let result = await dynamodb.send(queries[0]);
      if (result.Items && result.Items.length > 0) {
        const ownerEmail = result.Items[0].userEmail.S;
        console.log(`Found channel owner (by channelId): ${ownerEmail}`);
        return ownerEmail;
      }
      
      // Try the second query (channelName as PK)
      result = await dynamodb.send(queries[1]);
      if (result.Items && result.Items.length > 0) {
        const ownerEmail = result.Items[0].userEmail.S;
        console.log(`Found channel owner (by channelName): ${ownerEmail}`);
        return ownerEmail;
      }
      
      // If no owner found, look for any user with master privileges for this channel
      const masterQuery = new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk",
        FilterExpression: "channelId = :channelId",
        ExpressionAttributeValues: {
          ":pk": { S: `CHANNEL#${channelName}` },
          ":channelId": { S: channelId }
        }
      });
      
      result = await dynamodb.send(masterQuery);
      if (result.Items && result.Items.length > 0) {
        // Find the first active user (preferably not a collaborator)
        const ownerItem = result.Items.find(item => 
          item.status?.S === "active" && item.role?.S !== "collaborator"
        ) || result.Items[0];
        
        const ownerEmail = ownerItem.userEmail.S;
        console.log(`Found channel owner (fallback): ${ownerEmail}`);
        return ownerEmail;
      }
      
      // Additional fallback: Scan for channel by name (handles cases where channelId doesn't match)
      console.log(`Trying scan-based lookup for channel: ${channelName}`);
      const scanParams = {
        TableName: table,
        FilterExpression: "begins_with(PK, :pkPrefix) AND channelName = :channelName AND #role = :ownerRole",
        ExpressionAttributeNames: {
          "#role": "role"
        },
        ExpressionAttributeValues: {
          ":pkPrefix": { S: "CHANNEL#" },
          ":channelName": { S: channelName },
          ":ownerRole": { S: "owner" }
        },
        Limit: 1
      };
      
      const scanResult = await dynamodb.send(new ScanCommand(scanParams));
      if (scanResult.Items && scanResult.Items.length > 0) {
        const ownerEmail = scanResult.Items[0].userEmail?.S || scanResult.Items[0].creatorEmail?.S;
        if (ownerEmail) {
          console.log(`Found channel owner (scan fallback): ${ownerEmail}`);
          return ownerEmail;
        }
      }
      
      console.log(`No channel owner found for ${channelId} (${channelName})`);
      return null;
    } catch (error) {
      console.error(`Error looking up channel owner for ${channelId}:`, error);
      return null;
    }
  };

  // Function to check if a file already exists to prevent duplicates
  const checkForExistingFile = async (fileName, userEmail) => {
    try {
      console.log(`🔍 Checking for existing file: ${fileName}`);
      
      const query = new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        FilterExpression: "fileName = :fileName",
        ExpressionAttributeValues: {
          ":pk": { S: `USER#${userEmail}` },
          ":sk": { S: "FILE#" },
          ":fileName": { S: fileName }
        }
      });
      
      const result = await dynamodb.send(query);
      if (result.Items && result.Items.length > 0) {
        console.log(`⚠️ File already exists in DynamoDB, skipping: ${fileName}`);
        console.log(`⚠️ Existing items: ${JSON.stringify(result.Items, null, 2)}`);
        return true; // File exists, skip processing
      }
      
      console.log(`✅ File does not exist, proceeding with creation: ${fileName}`);
      return false; // File doesn't exist, proceed with processing
    } catch (error) {
      console.error(`Error checking for existing file ${fileName}:`, error);
      return false; // On error, proceed with processing
    }
  };

  function matchStreamKeyToFolder(streamKey, existingFolders) {
    const baseName = streamKey.replace(/\d+$/, "").toLowerCase();
    for (const folder of existingFolders) {
      const folderLower = folder.toLowerCase();
      const common = findCommonWords(baseName, folderLower);
      if (folderLower.includes(baseName) || baseName.includes(folderLower) || common.some(w => w.length >= 3)) {
        return folder;
      }
    }
    return null;
  }

  function findCommonWords(a, b) {
    const aWords = a.split(/[\s\-_]+/);
    const bWords = b.split(/[\s\-_]+/);
    return aWords.filter(word => bWords.includes(word));
  }

  const updateVideoWithThumbnail = async (thumbnailFileName, thumbnailUrl, userEmail, uploadId = null) => {
    try {
      console.log(`🖼️ Processing thumbnail: ${thumbnailFileName}, uploadId: ${uploadId || 'none'}`);
      
      // Extract uniquePrefix from thumbnail filename
      // Format: "{uniquePrefix}_thumb.jpg" (e.g., "deh1_2025-07-16T20-34-59-561Z_gqx58f42_thumb.jpg")
      const uniquePrefixMatch = thumbnailFileName.match(/^(.+)_thumb\.jpg$/);
      if (!uniquePrefixMatch) {
        console.log(`⚠️ Could not extract uniquePrefix from thumbnail filename: ${thumbnailFileName}`);
        return;
      }
      
      const uniquePrefix = uniquePrefixMatch[1];
      console.log(`🔍 Extracted uniquePrefix: ${uniquePrefix}`);
      
      // The video entry's fileName should be: "{uniquePrefix}_master.m3u8"
      const expectedFileName = `${uniquePrefix}_master.m3u8`;
      console.log(`🔍 Looking for video with fileName: ${expectedFileName}`);
      
      // Query DynamoDB to find the video file by fileName
      // CRITICAL: Match by fileName which contains the uniquePrefix
      const query = new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        FilterExpression: "fileName = :fileName",
        ExpressionAttributeValues: {
          ":pk": { S: `USER#${userEmail}` },
          ":sk": { S: "FILE#" },
          ":fileName": { S: expectedFileName }
        }
      });
      
      const result = await dynamodb.send(query);
      if (result.Items && result.Items.length > 0) {
        const videoItem = result.Items[0];
        console.log(`✅ Found video item to update: ${videoItem.SK.S}, fileName: ${videoItem.fileName?.S || 'N/A'}`);
        
        // Update the video item with the thumbnail URL
        const updateItem = {
          ...videoItem,
          thumbnailUrl: { S: thumbnailUrl }
        };
        
        const putCmd = new PutItemCommand({ TableName: table, Item: updateItem });
        await dynamodb.send(putCmd);
        console.log(`✅ Successfully updated video with thumbnail: ${thumbnailUrl}`);
      } else {
        console.log(`⚠️ No video file found with fileName: ${expectedFileName}`);
        // Try alternative: search by uniquePrefix in fileName (contains match)
        console.log(`🔍 Trying alternative search by uniquePrefix...`);
        const altQuery = new QueryCommand({
          TableName: table,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          FilterExpression: "contains(fileName, :uniquePrefix)",
          ExpressionAttributeValues: {
            ":pk": { S: `USER#${userEmail}` },
            ":sk": { S: "FILE#" },
            ":uniquePrefix": { S: uniquePrefix }
          }
        });
        
        const altResult = await dynamodb.send(altQuery);
        if (altResult.Items && altResult.Items.length > 0) {
          // Find the one with _master.m3u8
          const masterPlaylist = altResult.Items.find(item => 
            item.fileName?.S?.includes('_master.m3u8')
          );
          
          if (masterPlaylist) {
            console.log(`✅ Found video item (alternative search): ${masterPlaylist.SK.S}`);
            const updateItem = {
              ...masterPlaylist,
              thumbnailUrl: { S: thumbnailUrl }
            };
            const putCmd = new PutItemCommand({ TableName: table, Item: updateItem });
            await dynamodb.send(putCmd);
            console.log(`✅ Successfully updated video with thumbnail (alternative): ${thumbnailUrl}`);
          } else {
            console.log(`⚠️ Found items but none with _master.m3u8`);
          }
        } else {
          console.log(`⚠️ No video file found with uniquePrefix: ${uniquePrefix}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error updating video with thumbnail: ${error.message}`);
      console.error(error.stack);
    }
  };

  const getExistingFolders = async (userId) => {
    try {
      console.log(`Looking up folders for user: ${userId}`);
      const query = new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": { S: `USER#${userId}` },
          ":sk": { S: "FOLDER#" }
        }
      });
      const res = await dynamodb.send(query);
      const folders = res.Items?.map(i => i.SK.S.split("#").pop()) || [];
      console.log(`Found folders: ${folders.join(', ')}`);
      return folders;
    } catch (e) {
      console.error("DynamoDB folder lookup failed:", e);
      return [];
    }
  };

  // Function to check if "post automatically" is enabled for a user
  // CRITICAL: All videos post automatically by default
  const checkPostAutomatically = async (userEmail) => {
    try {
      // The postAutomatically setting is stored under SK: 'POST_AUTOMATICALLY'
      // Default to true - all videos post automatically unless explicitly disabled
      const getPostAutoCmd = new GetItemCommand({
        TableName: table,
        Key: {
          PK: { S: `USER#${userEmail}` },
          SK: { S: 'POST_AUTOMATICALLY' }
        }
      });
      const postAutoResult = await dynamodb.send(getPostAutoCmd);
      if (postAutoResult.Item && postAutoResult.Item.postAutomatically?.BOOL === false) {
        console.log(`📅 [Lambda] Post automatically is DISABLED by user setting for ${userEmail} - video visibility will follow schedule`);
        return false;
      } else {
        console.log(`✅ [Lambda] Post automatically is ENABLED (default) for ${userEmail} - video will be visible immediately`);
        return true; // Default to true - all videos post automatically
      }
    } catch (error) {
      console.log(`⚠️ [Lambda] Could not check post automatically setting for ${userEmail}: ${error.message}`);
      return true; // Default to true if we can't check - all videos post automatically by default
    }
  };

  // Function to create video item for a user
  const createVideoItem = async (userEmail, fileId, url, fileName, fileExtension, streamKey, finalFolderName, category, timestamp, key, cloudFrontBaseUrl, uploadId = null) => {
    // Check if "post automatically" is enabled
    const postAutomatically = await checkPostAutomatically(userEmail);
    
    const item = {
      PK: { S: `USER#${userEmail}` },
      SK: { S: `FILE#${fileId}` },
      url: { S: url },
      fileName: { S: key.split("/").pop() }, // Store the full unique filename
      fileExtension: { S: fileExtension },
      folderPath: { S: streamKey },
      folderName: { S: finalFolderName },
      streamKey: { S: streamKey },
      category: { S: category },
      timestamp: { S: timestamp },
      // Price will be set from metadata if provided, otherwise default to 0 (as number) to match web app format
      price: { N: "0" },
      isVisible: { BOOL: postAutomatically }, // Only visible immediately if post automatically is enabled
      isCollaboratorVideo: { BOOL: false } // Will be set based on user type
    };

    if (category === "Videos") {
      item.hlsUrl = { S: url };
      
      // Generate thumbnail URL for video files
      // CRITICAL: Use the same S3 key structure as the video file (with uploadId if present)
      // Old format: clips/{streamKey}/{uniquePrefix}_thumb.jpg
      // New format: clips/{streamKey}/{uploadId}/{uniquePrefix}_thumb.jpg
      const fullFileName = key.split("/").pop();
      const uniquePrefix = fullFileName.replace('_master.m3u8', '');
      
      let thumbnailKey;
      if (uploadId) {
        // New format with uploadId
        thumbnailKey = `clips/${streamKey}/${uploadId}/${uniquePrefix}_thumb.jpg`;
      } else {
        // Old format (backward compatible)
        thumbnailKey = `clips/${streamKey}/${uniquePrefix}_thumb.jpg`;
      }
      
      const thumbnailUrl = `${cloudFrontBaseUrl}/${thumbnailKey}`;
      item.thumbnailUrl = { S: thumbnailUrl };
      
      console.log("✔ Video file - HLS:", url);
      console.log("✔ Video file - Full File Name:", fullFileName);
      console.log("✔ Video file - Unique Prefix:", uniquePrefix);
      console.log("✔ Video file - Stream Key:", streamKey);
      console.log("✔ Video file - Upload ID:", uploadId || 'none');
      console.log("✔ Video file - Thumbnail Key:", thumbnailKey);
      console.log("✔ Video file - Thumbnail:", thumbnailUrl);
    }

    return item;
  };

  // Isolated timelines: write to PUBLIC# / PRIVATE# / PREMIUM# (no shared bucket)
  const addToIsolatedTimelines = async (dynamo, tableName, fileItem, creatorEmail, fileId, timestamp) => {
    if (!fileItem || !creatorEmail || !fileId) return;
    const creator = creatorEmail.toLowerCase();
    const ts = timestamp || fileItem.timestamp?.S || new Date().toISOString();
    const getBool = (attr) => {
      if (!attr) return false;
      if (attr.BOOL !== undefined) return attr.BOOL === true;
      if (attr.S) return attr.S === 'true' || attr.S === '1';
      if (attr.N) return attr.N === '1' || attr.N === 1;
      return false;
    };
    const isPremium = getBool(fileItem.isPremium);
    const isPrivate = getBool(fileItem.isPrivateUsername);
    const isVisible = getBool(fileItem.isVisible);
    const timelineType = isPremium ? 'PREMIUM' : (isPrivate ? 'PRIVATE' : 'PUBLIC');
    const sortKey = `${timelineType}#${ts}#${fileId}#${creator}`;
    const buildEntry = (viewerEmail) => {
      const entry = {};
      for (const [k, v] of Object.entries(fileItem)) {
        if (k !== 'PK' && k !== 'SK') entry[k] = v;
      }
      entry.PK = { S: `USER#${viewerEmail.toLowerCase()}` };
      entry.SK = { S: sortKey };
      entry.timelineType = { S: timelineType };
      entry.timelineCreatorEmail = { S: creator };
      entry.timelineCreatedAt = { S: new Date().toISOString() };
      entry.isTimelineEntry = { BOOL: true };
      return entry;
    };
    try {
      await dynamo.send(new PutItemCommand({
        TableName: tableName,
        Item: buildEntry(creator),
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)'
      }));
      console.log(`✓ [Lambda] Isolated timeline: added ${timelineType} entry for owner ${creator}`);
    } catch (e) {
      if (e.name === 'ConditionalCheckFailedException') {
        console.log(`⚠️ [Lambda] Timeline entry already exists for owner, skipping`);
      } else {
        console.warn(`⚠️ [Lambda] Timeline write for owner failed: ${e.message}`);
      }
    }
    if (!isVisible) return;
    let viewers = [];
    if (timelineType === 'PREMIUM') {
      const q = await dynamo.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: '#s = :active',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':pk': { S: `CREATOR_SUBSCRIBERS#${creator}` },
          ':skPrefix': { S: 'SUBSCRIBER#' },
          ':active': { S: 'active' }
        }
      }));
      viewers = (q.Items || []).map(i => (i.SK?.S || '').replace('SUBSCRIBER#', '')).filter(Boolean);
    } else {
      const vis = timelineType === 'PRIVATE' ? 'private' : 'public';
      const q = await dynamo.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: 'streamerVisibility = :vis AND #s = :active',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':pk': { S: `STREAMER_FOLLOWERS#${creator}` },
          ':skPrefix': { S: 'VIEWER#' },
          ':vis': { S: vis },
          ':active': { S: 'active' }
        }
      }));
      viewers = (q.Items || []).map(i => (i.SK?.S || '').replace('VIEWER#', '')).filter(Boolean);
    }
    for (const viewer of viewers) {
      if (viewer.toLowerCase() === creator) continue;
      try {
        await dynamo.send(new PutItemCommand({
          TableName: tableName,
          Item: buildEntry(viewer),
          ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)'
        }));
      } catch (e) {
        if (e.name !== 'ConditionalCheckFailedException') {
          console.warn(`⚠️ [Lambda] Timeline fan-out to ${viewer} failed: ${e.message}`);
        }
      }
    }
    if (viewers.length > 0) {
      console.log(`✓ [Lambda] Isolated timeline: fanned out to ${viewers.length} viewers (${timelineType})`);
    }
  };

  const processS3Event = async (records) => {
    console.log(`Processing ${records.length} S3 records`);
    
    for (const record of records) {
      try {
        const bucket = record.s3.bucket.name;
        let key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
        
        console.log(`Processing S3 event - Bucket: ${bucket}, Key: ${key}`);
        console.log(`🔍 Full S3 key for debugging: ${key}`);
        console.log(`🔍 Key parts: ${JSON.stringify(key.split("/"))}`);

        // Extract the full stream key and uploadId from the S3 path FIRST
        // Format (old): clips/sk_471a28081fbbe853/sk_471a28081fbbe853_2025-07-18T16-49-26-001Z_lf525ptn_720p.m3u8
        // Format (new): clips/sk_471a28081fbbe853/{uploadId}/sk_471a28081fbbe853_{uploadId}_720p.m3u8
        // We want: sk_471a28081fbbe853
        const pathParts = key.split("/");
        console.log(`S3 key parts: ${JSON.stringify(pathParts)}`);
        
        if (pathParts.length < 3) {
          console.log("Invalid S3 key format, skipping:", key);
          continue;
        }
        
        const streamKey = pathParts[1]; // Get the stream key from the path (second part)
        
        // Check if uploadId is in the path (new format: clips/{streamKey}/{uploadId}/{file})
        // uploadId can be a UUID (from mobile app) or a string starting with 'upload-' (from EC2 fallback)
        let uploadId = null;
        let filePartIndex = 2; // Default to old format (parts[2] is the file)
        let streamName, fileName;
        
        if (pathParts.length >= 4) {
          // Check if parts[2] looks like an uploadId (UUID format or starts with 'upload-')
          const potentialUploadId = pathParts[2];
          // UUID format: 8-4-4-4-12 hex characters (e.g., "550e8400-e29b-41d4-a716-446655440000")
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (potentialUploadId.startsWith('upload-') || uuidPattern.test(potentialUploadId)) {
            // New format with uploadId
            uploadId = potentialUploadId;
            filePartIndex = 3; // File is at parts[3]
            console.log(`📤 Extracted uploadId from S3 key: ${uploadId}`);
            console.log(`📤 File is at index ${filePartIndex}: ${pathParts[filePartIndex]}`);
            
            // Parse filename and streamName for new format
            if (pathParts.length > filePartIndex) {
              const filePart = pathParts[filePartIndex];
              fileName = filePart;
              // Extract streamName from filename (format: streamName_uploadId_quality.m3u8)
              // Example: sk_7bks13dy2ul1v01j_upload-1767826352-15671_master.m3u8
              // The streamName is everything before the uploadId in the filename
              const uploadIdIndex = filePart.indexOf(uploadId);
              if (uploadIdIndex > 0) {
                // streamName is everything before uploadId (minus the underscore)
                streamName = filePart.substring(0, uploadIdIndex - 1);
              } else {
                // Fallback: try splitting by underscore
                const fileParts = filePart.split('_');
                if (fileParts.length >= 2) {
                  // Find uploadId in parts
                  const uploadIdPartIndex = fileParts.findIndex(part => part === uploadId || part.startsWith('upload-'));
                  if (uploadIdPartIndex > 0) {
                    streamName = fileParts.slice(0, uploadIdPartIndex).join('_');
                  } else {
                    streamName = fileParts[0]; // First part is streamName
                  }
                } else {
                  streamName = streamKey; // Fallback to streamKey
                }
              }
              console.log(`📤 Re-parsed with uploadId: streamName=${streamName}, fileName=${fileName}`);
            } else {
              console.log("Invalid S3 key format (missing file part), skipping:", key);
              continue;
            }
          } else {
            // Old format without uploadId (backward compatible)
            console.log(`📤 No uploadId in S3 key (parts[2]='${potentialUploadId}'), using old format parsing`);
            // Parse old format: clips/{streamKey}/{filename}
            const lastPart = pathParts[2];
            fileName = lastPart;
            // Extract streamName from filename
            const videoExtensions = ['.m3u8', '.ts', '.mp4', '.mov', '.avi'];
            let foundExtension = null;
            let extensionIndex = -1;
            
            for (const ext of videoExtensions) {
              const index = lastPart.lastIndexOf(ext);
              if (index !== -1) {
                foundExtension = ext;
                extensionIndex = index;
                break;
              }
            }
            
            // CRITICAL FIX: Use streamKey from path directly - don't extract from filename
            // The filename format is inconsistent (may contain streamKey_timestamp_uploadId)
            // But streamKey from path (pathParts[1]) is always correct
            streamName = streamKey; // Use streamKey from path - it's the source of truth
            console.log(`✅ Using streamKey from path as streamName: ${streamName}`);
          }
        } else {
          // Old format without uploadId (backward compatible)
          console.log(`📤 No uploadId in S3 key (pathParts.length=${pathParts.length}), using old format parsing`);
          // Parse old format: clips/{streamKey}/{filename}
          const lastPart = pathParts[2];
          fileName = lastPart;
          // Extract streamName from filename
          const videoExtensions = ['.m3u8', '.ts', '.mp4', '.mov', '.avi'];
          let foundExtension = null;
          let extensionIndex = -1;
          
          for (const ext of videoExtensions) {
            const index = lastPart.lastIndexOf(ext);
            if (index !== -1) {
              foundExtension = ext;
              extensionIndex = index;
              break;
            }
          }
          
          // CRITICAL FIX: Use streamKey from path directly - don't extract from filename
          // The filename format is inconsistent (may contain streamKey_timestamp_uploadId)
          // But streamKey from path (pathParts[1]) is always correct
          streamName = streamKey; // Use streamKey from path - it's the source of truth
          console.log(`✅ Using streamKey from path as streamName: ${streamName}`);
        }
        
        if (!fileName) {
          console.log("No filename found in S3 key, skipping");
          continue;
        }
        
        const fileExtension = (fileName.split(".").pop() || "").toLowerCase();

        console.log(`Parsed - Stream Name: ${streamName}, File Name: ${fileName}, Stream Key: ${streamKey}, Upload ID: ${uploadId || 'NONE'}`);
        console.log(`🔍 Full path breakdown: streamKey=${streamKey}, uploadId=${uploadId || 'null'}, fileName=${fileName}`);

        // Look up the user account from the stream key
        const userInfo = await getUserFromStreamKey(streamKey);
        if (!userInfo) {
          console.log(`No user found for stream key: ${streamKey}, skipping file: ${fileName}`);
          continue;
        }

        const { userEmail, folderName, channelId, isPersonalKey, isCollaboratorKey, creatorId, isPrivateUsername, streamUsername, isPremium: isPremiumFromMapping } = userInfo;
        console.log(`Processing file for user: ${userEmail} in folder: ${folderName}, creatorId: ${creatorId || 'N/A'}, streamUsername: ${streamUsername || 'N/A'}, isPrivateUsername: ${isPrivateUsername || false}`);

        // Process master playlist files and thumbnail files
        const qualitySuffixes = ['_1080p', '_720p', '_480p', '_360p', '_240p'];
        const hasQualitySuffix = qualitySuffixes.some(suffix => key.includes(suffix));
        const isMasterPlaylist = key.includes('_master.m3u8');
        const isThumbnail = key.includes('_thumb.jpg');
        
        if (hasQualitySuffix && !isMasterPlaylist && !isThumbnail) {
          console.log(`Skipping individual quality variant: ${key}`);
          continue;
        }
        
        if (!isMasterPlaylist && !isThumbnail) {
          console.log(`Skipping non-master playlist file: ${key}`);
          continue;
        }

        const videoExt = new Set(["m3u8"]);
        const audioExt = new Set(["mp3", "wav", "ogg", "aac", "m4a"]);
        const imgExt = new Set(["jpg", "jpeg", "png", "bmp", "tiff"]);
        const docExt = new Set(["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt"]);

        let category = null;
        if (isThumbnail) {
          // For thumbnails, we need to find the corresponding video file and update it
          console.log(`🖼️ Processing thumbnail file: ${fileName}, uploadId: ${uploadId || 'none'}`);
          await updateVideoWithThumbnail(fileName, url, userEmail, uploadId);
          continue; // Skip normal processing for thumbnails
        } else if (videoExt.has(fileExtension) && !fileName.includes("_hls")) {
          category = "Videos";
        } else if (audioExt.has(fileExtension)) {
          category = "Audios";
        } else if (imgExt.has(fileExtension)) {
          category = "Images";
        } else if (docExt.has(fileExtension)) {
          category = "Docs";
        } else {
          console.log("Skipping unsupported file:", fileName);
          continue;
        }

        // Generate URL early so it's available for thumbnail processing
        const url = `${cloudFrontBaseUrl}/${key}`;
        
        console.log(`File category: ${category}`);
        
        // CRITICAL PRIVACY FIX: Look up existing entry by fileName FIRST (before generating new fileId)
        // createVideoEntryImmediately uses fileId = file-${uploadId}, so we need to find it by fileName
        // fileName is consistent: uniquePrefix_master.m3u8
        let existingFileId = null;
        let existingSK = null;
        // CRITICAL FIX: For Twilly TV, ALWAYS use master account (matches createVideoEntryImmediately)
        // For other channels, use userEmail from streamKey mapping
        const targetUserEmail = (folderName && folderName.toLowerCase() === 'twilly tv') 
          ? 'dehyu.sinyan@gmail.com'  // Master account for Twilly TV
          : userEmail;  // Use actual owner for other channels
        console.log(`✅ [Lambda] Target storage account: ${targetUserEmail} (folderName: ${folderName || 'N/A'})`);
        
        if (isMasterPlaylist) {
          try {
            // CRITICAL PRIVACY FIX: Retry lookup with exponential backoff to wait for createVideoEntryImmediately
            // createVideoEntryImmediately might still be writing to DynamoDB when Lambda runs
            // We need to wait for it to complete to preserve isPrivateUsername
            const maxRetries = 5;
            let lookupResult = null;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
              if (attempt > 0) {
                // Wait before retrying (exponential backoff: 200ms, 400ms, 800ms, 1600ms, 3200ms)
                const waitTime = Math.min(200 * Math.pow(2, attempt - 1), 3200);
                console.log(`⏳ [Lambda] Retrying lookup for existing entry (attempt ${attempt + 1}/${maxRetries}) - waiting ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
              
              // Look up existing entry by fileName (consistent identifier)
              const lookupQuery = new QueryCommand({
                TableName: table,
                KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
                FilterExpression: "fileName = :fileName",
                ExpressionAttributeValues: {
                  ":pk": { S: `USER#${targetUserEmail}` },
                  ":sk": { S: "FILE#" },
                  ":fileName": { S: fileName }
                }
              });
              
              lookupResult = await dynamodb.send(lookupQuery);
              if (lookupResult.Items && lookupResult.Items.length > 0) {
                // Found existing entry - use its fileId and SK
                existingSK = lookupResult.Items[0].SK.S;
                // Extract fileId from SK (format: FILE#file-${uploadId})
                const skMatch = existingSK.match(/^FILE#(.+)$/);
                if (skMatch) {
                  existingFileId = skMatch[1];
                  console.log(`✅ [Lambda] Found existing entry by fileName: ${fileName} (attempt ${attempt + 1})`);
                  console.log(`   Existing fileId: ${existingFileId}`);
                  console.log(`   Existing SK: ${existingSK}`);
                }
                break; // Found it, exit retry loop
              } else if (attempt < maxRetries - 1) {
                console.log(`ℹ️ [Lambda] No existing entry found by fileName: ${fileName} (attempt ${attempt + 1}/${maxRetries}) - will retry...`);
              } else {
                console.log(`ℹ️ [Lambda] No existing entry found by fileName: ${fileName} after ${maxRetries} attempts - will create new entry`);
              }
            }
          } catch (lookupError) {
            console.log(`⚠️ [Lambda] Error looking up existing entry by fileName: ${lookupError.message}`);
            // Continue with new fileId generation
          }
          
          // CRITICAL PRIVACY FIX: If no entry found by real fileName, check for convert-to-post placeholder
          // convert-to-post creates FILE with fileName = ${streamKey}_placeholder.m3u8 and correct isPrivateUsername.
          // Lambda normally looks up by real S3 fileName (e.g. sk_xxx_upload-123_master.m3u8) and misses the placeholder.
          // If we find a placeholder for this streamKey, update IT instead of creating a new FILE (so we preserve isPrivateUsername).
          if (!existingFileId) {
            try {
              const placeholderFileName = `${streamKey}_placeholder.m3u8`;
              const placeholderQuery = new QueryCommand({
                TableName: table,
                KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
                FilterExpression: "streamKey = :streamKey AND fileName = :placeholderFileName",
                ExpressionAttributeValues: {
                  ":pk": { S: `USER#${targetUserEmail}` },
                  ":sk": { S: "FILE#" },
                  ":streamKey": { S: streamKey },
                  ":placeholderFileName": { S: placeholderFileName }
                }
              });
              const placeholderResult = await dynamodb.send(placeholderQuery);
              if (placeholderResult.Items && placeholderResult.Items.length > 0) {
                const placeholderItem = placeholderResult.Items[0];
                existingSK = placeholderItem.SK.S;
                const skMatch = existingSK.match(/^FILE#(.+)$/);
                if (skMatch) {
                  existingFileId = skMatch[1];
                  console.log(`✅ [Lambda] Found convert-to-post placeholder for streamKey (fileName=${placeholderFileName}) - will update it to preserve isPrivateUsername`);
                  console.log(`   Placeholder SK: ${existingSK}, fileId: ${existingFileId}`);
                }
              }
            } catch (placeholderErr) {
              console.log(`⚠️ [Lambda] Placeholder lookup failed: ${placeholderErr.message}`);
            }
          }
        }
        
        // Use existing fileId if found, otherwise generate new one
        // CRITICAL: If uploadId is available, use file-${uploadId} to match createVideoEntryImmediately
        // CRITICAL FIX: For RTMP streams without uploadId, use uniquePrefix to generate deterministic fileId
        // This ensures Lambda and createVideoEntryImmediately use the SAME fileId for the same video
        let fileId;
        if (existingFileId) {
          fileId = existingFileId;
          console.log(`✅ [Lambda] Using existing fileId: ${fileId}`);
        } else if (uploadId) {
          // Match createVideoEntryImmediately format: file-${uploadId}
          fileId = `file-${uploadId}`;
          console.log(`✅ [Lambda] Generated fileId matching createVideoEntryImmediately format: ${fileId}`);
        } else {
          // CRITICAL FIX: Extract uniquePrefix from fileName and use it for deterministic fileId
          // fileName format: {uniquePrefix}_master.m3u8
          // This matches createVideoEntryImmediately which uses: file-${uniquePrefix} when uploadId is missing
          const uniquePrefix = fileName.replace('_master.m3u8', '');
          fileId = `file-${uniquePrefix}`;
          console.log(`✅ [Lambda] Generated deterministic fileId from uniquePrefix (RTMP fallback): ${fileId}`);
          console.log(`   Extracted uniquePrefix from fileName: ${uniquePrefix}`);
        }
        
        const timestamp = new Date().toISOString();

        console.log(`Final fileId: ${fileId}`);
        console.log(`Generated timestamp: ${timestamp}`);
        console.log(`Generated URL: ${url}`);

        // Use the folder name from the stream key lookup instead of matching
        const finalFolderName = folderName;

        console.log(`Using folder: ${finalFolderName}`);

        // CRITICAL FIX: Store stream under the actual owner's email from streamKey mapping
        // The streamKey mapping already has the correct ownerEmail - use it directly
        console.log(`✅ [Lambda] Storing stream under owner's account: ${targetUserEmail}`);
        console.log(`   userEmail from streamKey mapping: ${userEmail || 'N/A'}`);
        console.log(`   folderName: ${folderName || 'N/A'}`);
        
        // Determine if this is a collaborator video
        const isCollaboratorVideo = isCollaboratorKey;
        
        console.log(`📝 [Lambda] Creating video entry:`);
        console.log(`   targetUserEmail (where file will be stored): ${targetUserEmail}`);
        console.log(`   userEmail from streamKey mapping: ${userEmail || 'N/A'}`);
        console.log(`   isCollaboratorKey: ${isCollaboratorKey}`);
        console.log(`   isPersonalKey: ${isPersonalKey}`);
        console.log(`   isCollaboratorVideo: ${isCollaboratorVideo}`);

        // Check for duplicate files before creating
        const fullFileName = key.split("/").pop(); // Use the full filename from S3 key
        const fileExists = await checkForExistingFile(fullFileName, targetUserEmail);
        if (fileExists) {
          console.log(`Skipping duplicate file: ${fullFileName}`);
          continue; // Skip to next record
        }

        // Short clips must never exist in DynamoDB: skip writing if duration < MIN_DURATION_SECONDS
        if (category === "Videos") {
          const durationSec = await getDurationFromHlsUrl(url);
          if (durationSec !== null && durationSec < MIN_DURATION_SECONDS) {
            console.log(`⏱️ Short video skipped (${durationSec.toFixed(1)}s < ${MIN_DURATION_SECONDS}s), not writing to DynamoDB: ${fileName}`);
            continue;
          }
        }

        try {
          const item = await createVideoItem(
            targetUserEmail,
            fileId,
            url,
            fileName,
            fileExtension,
            streamKey,
            finalFolderName,
            category,
            timestamp,
            key,
            cloudFrontBaseUrl,
            uploadId // Pass uploadId so thumbnail URL is generated correctly
          );

          // CRITICAL: Use existingSK if we found it earlier (to match existing entry exactly)
          if (existingSK) {
            item.SK = { S: existingSK };
            console.log(`✅ [Lambda] Using existing SK: ${existingSK}`);
          }
          
          // Mark if this is a collaborator video (streamed by collaborator, not master)
          item.isCollaboratorVideo = { BOOL: isCollaboratorVideo };
          item.streamerEmail = { S: userEmail }; // Track who actually streamed it
          
          // Add creatorId if available (critical for username lookup in get-content API)
          if (creatorId) {
            item.creatorId = { S: creatorId };
            console.log(`✅ [Lambda] Added creatorId to video entry: ${creatorId}`);
          } else {
            console.log(`⚠️ [Lambda] No creatorId found in streamKey mapping - username lookup may fail`);
          }
          
          // Add isPrivateUsername from streamKey mapping (critical for filtering public/private content)
          // Check if there's an existing entry first (from createVideoEntryImmediately) and preserve it
          try {
            const existingEntryKey = {
              PK: { S: `USER#${targetUserEmail}` },
              SK: { S: `FILE#${fileId}` }
            };
            const getExistingCmd = new GetItemCommand({
              TableName: table,
              Key: existingEntryKey
            });
            const existingResult = await dynamodb.send(getExistingCmd);
            
            // CRITICAL: If file is already published, NEVER overwrite visibility (isPrivateUsername/isPremium).
            // Same stream key reused for a new drop must not change an old public video to premium.
            const getBoolFromItem = (it, key) => {
              if (!it || !it[key]) return null;
              const v = it[key];
              if (v.BOOL !== undefined) return v.BOOL === true;
              if (v.S !== undefined) return v.S === 'true' || v.S === '1';
              if (v.N !== undefined) return v.N === '1' || v.N === 1;
              return null;
            };
            const existingIsVisible = getBoolFromItem(existingResult.Item, 'isVisible');
            const existingIsPremium = getBoolFromItem(existingResult.Item, 'isPremium');
            const isAlreadyPublished = existingIsVisible === true;
            if (isAlreadyPublished) {
              console.log(`✅ [Lambda] File already published (isVisible=true) - preserving existing isPrivateUsername and isPremium (do not overwrite with stream key)`);
            }
            
            // CRITICAL: Check if existing entry has isPrivateUsername (handle both DynamoDB format and plain boolean)
            // DocumentClient saves booleans as plain booleans, but low-level client reads them as { BOOL: true }
            // We need to handle BOTH formats correctly
            let existingIsPrivate = false;
            let foundExistingValue = false;
            
            if (existingResult.Item && existingResult.Item.isPrivateUsername !== undefined) {
              const rawValue = existingResult.Item.isPrivateUsername;
              console.log(`🔍 [Lambda] Found existing isPrivateUsername field, raw value: ${JSON.stringify(rawValue)}, type: ${typeof rawValue}`);
              
              // Handle DynamoDB low-level format { BOOL: true } (from low-level client reads)
              if (rawValue && typeof rawValue === 'object' && rawValue.BOOL !== undefined) {
                existingIsPrivate = rawValue.BOOL === true;
                foundExistingValue = true;
                console.log(`✅ [Lambda] Parsed from DynamoDB BOOL format: ${existingIsPrivate}`);
              } 
              // Handle DynamoDB string format { S: "true" }
              else if (rawValue && typeof rawValue === 'object' && rawValue.S !== undefined) {
                existingIsPrivate = rawValue.S === 'true' || rawValue.S === '1';
                foundExistingValue = true;
                console.log(`✅ [Lambda] Parsed from DynamoDB string format: ${existingIsPrivate}`);
              }
              // Handle DynamoDB number format { N: "1" }
              else if (rawValue && typeof rawValue === 'object' && rawValue.N !== undefined) {
                existingIsPrivate = rawValue.N === '1' || rawValue.N === 1;
                foundExistingValue = true;
                console.log(`✅ [Lambda] Parsed from DynamoDB number format: ${existingIsPrivate}`);
              }
              // Handle plain boolean (shouldn't happen with low-level client, but handle for safety)
              else if (typeof rawValue === 'boolean') {
                existingIsPrivate = rawValue === true;
                foundExistingValue = true;
                console.log(`✅ [Lambda] Parsed from plain boolean: ${existingIsPrivate}`);
              }
              // Handle string (shouldn't happen, but handle for safety)
              else if (typeof rawValue === 'string') {
                existingIsPrivate = rawValue === 'true' || rawValue === '1';
                foundExistingValue = true;
                console.log(`✅ [Lambda] Parsed from string: ${existingIsPrivate}`);
              }
              // Handle number (shouldn't happen, but handle for safety)
              else if (typeof rawValue === 'number') {
                existingIsPrivate = rawValue === 1;
                foundExistingValue = true;
                console.log(`✅ [Lambda] Parsed from number: ${existingIsPrivate}`);
              }
              
              if (foundExistingValue || isAlreadyPublished) {
                item.isPrivateUsername = { BOOL: existingIsPrivate };
                console.log(`✅ [Lambda] Preserved isPrivateUsername from existing entry: ${existingIsPrivate}`);
              } else {
                console.log(`⚠️ [Lambda] Could not parse existing isPrivateUsername value, will try streamKey mapping`);
              }
            }
            
            // If we didn't find a valid existing value (and file not already published), use streamKey mapping
            // CRITICAL: isPrivateUsername from streamKey mapping is the source of truth for NEW/placeholder entries
            if (!foundExistingValue && !isAlreadyPublished) {
              // Use isPrivateUsername from streamKey mapping (handle boolean, string, number, DynamoDB format)
              // isPrivateUsername is always defined (defaults to false if not in mapping)
              let streamIsPrivate = false;
              
              if (isPrivateUsername !== undefined && isPrivateUsername !== null) {
                if (typeof isPrivateUsername === 'boolean') {
                  streamIsPrivate = isPrivateUsername === true;
                } else if (typeof isPrivateUsername === 'string') {
                  streamIsPrivate = isPrivateUsername === 'true' || isPrivateUsername === '1';
                } else if (typeof isPrivateUsername === 'number') {
                  streamIsPrivate = isPrivateUsername === 1;
                } else if (isPrivateUsername && typeof isPrivateUsername === 'object' && isPrivateUsername.BOOL !== undefined) {
                  streamIsPrivate = isPrivateUsername.BOOL === true;
                }
              }
              // If isPrivateUsername is undefined/null, default to false (public)
              // This matches the behavior in getUserInfoFromStreamKey where it defaults to false
              
              item.isPrivateUsername = { BOOL: streamIsPrivate };
              console.log(`✅ [Lambda] Set isPrivateUsername from streamKey mapping: ${streamIsPrivate} (raw: ${JSON.stringify(isPrivateUsername)})`);
              console.log(`   StreamKey: ${streamKey}, isPrivate: ${streamIsPrivate}`);
            } else {
              // We found an existing value - it was already set above, so we're good
              console.log(`✅ [Lambda] Preserved isPrivateUsername from existing entry: ${existingIsPrivate}`);
            }
            
            // isPremium: preserve from existing if file already published; else use streamKey mapping
            const streamIsPremium = isPremiumFromMapping === true || isPremiumFromMapping === 'true' || isPremiumFromMapping === 1;
            if (isAlreadyPublished) {
              const usePremium = existingIsPremium !== null ? existingIsPremium : false;
              item.isPremium = { BOOL: usePremium };
              console.log(`✅ [Lambda] Preserved isPremium for published file: ${usePremium} (existing: ${existingIsPremium})`);
            } else {
              item.isPremium = { BOOL: streamIsPremium };
              console.log(`✅ [Lambda] Set isPremium from streamKey mapping: ${streamIsPremium} (raw: ${isPremiumFromMapping})`);
            }
          } catch (error) {
            console.log(`⚠️ [Lambda] Error checking/preserving isPrivateUsername/isPremium: ${error.message}`);
            // Default to public on error
            item.isPrivateUsername = { BOOL: false };
            item.isPremium = { BOOL: false };
          }
          
          // Try to read video metadata (title, description, price, isVisible) from DynamoDB
          // CRITICAL: Use uploadId if available (new format), otherwise fall back to streamKey (backward compatible)
          // This ensures each video has unique metadata
          try {
            const metadataKey = {
              PK: { S: uploadId ? `METADATA#${uploadId}` : `METADATA#${streamKey}` },
              SK: { S: 'video-details' }
            };
            
            console.log(`📤 Looking up metadata using: ${uploadId ? `uploadId=${uploadId}` : `streamKey=${streamKey}`} (backward compatible)`);
            
            let metadataResult = null;
            const maxRetries = 5; // Reduced to 5 retries with shorter wait times to prevent timeout
            for (let attempt = 0; attempt < maxRetries; attempt++) {
              try {
                const getMetadataCmd = new GetItemCommand({
                  TableName: table,
                  Key: metadataKey
                });
                
                metadataResult = await dynamodb.send(getMetadataCmd);
                
                if (metadataResult.Item) {
                  console.log(`📋 Found video metadata for ${uploadId ? `uploadId: ${uploadId}` : `streamKey: ${streamKey}`} on attempt ${attempt + 1}`);
                  break; // Found it, exit retry loop
                } else if (attempt < maxRetries - 1) {
                  // Wait before retrying (shorter wait times to prevent timeout)
                  // Cap wait time at 2 seconds max to ensure Lambda completes within 60 seconds
                  const waitTime = Math.min(Math.pow(2, attempt) * 500, 2000); // 500ms, 1000ms, 2000ms, 2000ms, 2000ms
                  console.log(`⏳ Metadata not found, retrying in ${waitTime}ms... (attempt ${attempt + 1}/${maxRetries})`);
                  console.log(`⏳ Looking for metadata with key: PK=${metadataKey.PK.S}, SK=${metadataKey.SK.S}`);
                  console.log(`⏳ UploadId from S3 path: ${uploadId || 'null'}, StreamKey: ${streamKey}`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                }
              } catch (metadataReadError) {
                console.error(`⚠️ Error reading metadata (attempt ${attempt + 1}): ${metadataReadError.message}`);
                if (attempt < maxRetries - 1) {
                  const waitTime = Math.min(Math.pow(2, attempt) * 200, 1000); // Cap at 1 second
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                  // Don't throw error, continue with defaults
                  console.error(`⚠️ Failed to read metadata after ${maxRetries} attempts, continuing with defaults`);
                }
              }
            }
            
            if (metadataResult && metadataResult.Item) {
                console.log(`📋 Metadata item found: ${JSON.stringify(metadataResult.Item, null, 2)}`);
                console.log(`📋 Metadata item keys: ${Object.keys(metadataResult.Item).join(', ')}`);
                
                // DocumentClient stores data in plain format, but GetItemCommand returns typed format
                // Handle both cases: typed format ({ S: "...", N: "..." }) and plain format (if somehow DocumentClient format leaks through)
                
                // Update item with metadata if available (only set if values exist)
                let titleValue = null;
                if (metadataResult.Item.title) {
                  // Handle typed format from GetItemCommand
                  if (metadataResult.Item.title.S) {
                    titleValue = metadataResult.Item.title.S.trim();
                  } 
                  // Handle plain format (shouldn't happen with GetItemCommand, but just in case)
                  else if (typeof metadataResult.Item.title === 'string') {
                    titleValue = metadataResult.Item.title.trim();
                  }
                }
                
                if (titleValue && titleValue.length > 0) {
                  item.title = { S: titleValue };
                  console.log(`✅ Set title: ${titleValue}`);
                } else {
                  console.log(`ℹ️ No title in metadata or title is empty`);
                }
                
                let descriptionValue = null;
                if (metadataResult.Item.description) {
                  if (metadataResult.Item.description.S) {
                    descriptionValue = metadataResult.Item.description.S.trim();
                  } else if (typeof metadataResult.Item.description === 'string') {
                    descriptionValue = metadataResult.Item.description.trim();
                  }
                }
                
                if (descriptionValue && descriptionValue.length > 0) {
                  item.description = { S: descriptionValue };
                  console.log(`✅ Set description: ${descriptionValue.substring(0, 50)}...`);
                } else {
                  console.log(`ℹ️ No description in metadata or description is empty`);
                }
                
                let priceValue = null;
                if (metadataResult.Item.price !== undefined && metadataResult.Item.price !== null) {
                  // Handle typed format: { N: "2.99" } or { S: "2.99" }
                  if (metadataResult.Item.price.N) {
                    priceValue = parseFloat(metadataResult.Item.price.N);
                  } else if (metadataResult.Item.price.S) {
                    priceValue = parseFloat(metadataResult.Item.price.S);
                  }
                  // Handle plain format (number directly)
                  else if (typeof metadataResult.Item.price === 'number') {
                    priceValue = metadataResult.Item.price;
                  }
                  // Handle plain format (string)
                  else if (typeof metadataResult.Item.price === 'string') {
                    priceValue = parseFloat(metadataResult.Item.price);
                  }
                  
                  if (priceValue !== null && priceValue !== undefined && !isNaN(priceValue) && priceValue >= 0) {
                    // Store price as NUMBER (not string) to match web app format
                    // Web app stores price as number, so we need to match that format
                    item.price = { N: priceValue.toFixed(2) };
                    console.log(`✅ Set price: ${priceValue.toFixed(2)} (as number)`);
                  } else {
                    console.log(`ℹ️ Price value is invalid: ${priceValue} (raw: ${JSON.stringify(metadataResult.Item.price)})`);
                  }
                } else {
                  console.log(`ℹ️ No price in metadata`);
                }
                
                // Clean up metadata item after using it
                const deleteMetadataCmd = new DeleteItemCommand({
                  TableName: table,
                  Key: metadataKey
                });
                await dynamodb.send(deleteMetadataCmd);
                console.log(`🗑️ Cleaned up metadata item for streamKey: ${streamKey}`);
              } else {
                console.log(`ℹ️ No metadata found for streamKey: ${streamKey}, using defaults`);
              }
          } catch (metadataError) {
            console.error(`⚠️ Error reading metadata for streamKey ${streamKey}:`, metadataError.message);
            // Continue with defaults if metadata read fails
          }

          console.log(`Creating/updating video entry for owner account: ${targetUserEmail}`);

          // CRITICAL PRIVACY FIX: Check if item already exists (from createVideoEntryImmediately)
          // If it exists, use UpdateItemCommand to preserve isPrivateUsername
          // If it doesn't exist, use PutItemCommand to create it
          // Use existingSK if we found it earlier, otherwise construct from fileId
          const checkSK = existingSK || `FILE#${fileId}`;
          const checkExistingCmd = new GetItemCommand({
            TableName: table,
            Key: {
              PK: { S: `USER#${targetUserEmail}` },
              SK: { S: checkSK }
            }
          });
          const existingCheck = await dynamodb.send(checkExistingCmd);
          
          if (existingCheck.Item) {
            // Item exists - use UpdateItemCommand to preserve isPrivateUsername
            console.log(`✅ [Lambda] Item already exists - using UpdateItemCommand to preserve isPrivateUsername`);
            
            // CRITICAL: Check if isPrivateUsername exists in existing item FIRST (before building update expressions)
            // Low-level client returns { BOOL: true } format, not plain boolean
            const existingIsPrivateRaw = existingCheck.Item.isPrivateUsername;
            let hasExistingIsPrivate = false;
            let existingIsPrivateValue = false;
            
            if (existingIsPrivateRaw !== undefined && existingIsPrivateRaw !== null) {
              // Handle DynamoDB format { BOOL: true } or { S: "true" } or { N: "1" }
              if (existingIsPrivateRaw.BOOL !== undefined) {
                hasExistingIsPrivate = true;
                existingIsPrivateValue = existingIsPrivateRaw.BOOL === true;
                console.log(`🔍 [Lambda] Found existing isPrivateUsername in DynamoDB BOOL format: ${existingIsPrivateValue}`);
              } else if (existingIsPrivateRaw.S !== undefined) {
                hasExistingIsPrivate = true;
                existingIsPrivateValue = existingIsPrivateRaw.S === 'true' || existingIsPrivateRaw.S === '1';
                console.log(`🔍 [Lambda] Found existing isPrivateUsername in DynamoDB string format: ${existingIsPrivateValue}`);
              } else if (existingIsPrivateRaw.N !== undefined) {
                hasExistingIsPrivate = true;
                existingIsPrivateValue = existingIsPrivateRaw.N === '1' || existingIsPrivateRaw.N === 1;
                console.log(`🔍 [Lambda] Found existing isPrivateUsername in DynamoDB number format: ${existingIsPrivateValue}`);
              } else {
                console.log(`⚠️ [Lambda] Existing isPrivateUsername has unexpected format: ${JSON.stringify(existingIsPrivateRaw)}`);
              }
            }
            
            // Build UpdateExpression to update only fields that need updating
            // CRITICAL: Do NOT update isPrivateUsername if it already exists - preserve it
            const updateExpressions = [];
            const expressionAttributeNames = {};
            const expressionAttributeValues = {};
            
            // Only update fields that are in the new item but might be different
            // Preserve isPrivateUsername if it exists
            if (item.hlsUrl) {
              updateExpressions.push('#hlsUrl = :hlsUrl');
              expressionAttributeNames['#hlsUrl'] = 'hlsUrl';
              expressionAttributeValues[':hlsUrl'] = item.hlsUrl;
            }
            if (item.url) {
              updateExpressions.push('#url = :url');
              expressionAttributeNames['#url'] = 'url';
              expressionAttributeValues[':url'] = item.url;
            }
            if (item.fileName) {
              updateExpressions.push('#fileName = :fileName');
              expressionAttributeNames['#fileName'] = 'fileName';
              expressionAttributeValues[':fileName'] = item.fileName;
            }
            if (item.thumbnailUrl) {
              updateExpressions.push('#thumbnailUrl = :thumbnailUrl');
              expressionAttributeNames['#thumbnailUrl'] = 'thumbnailUrl';
              expressionAttributeValues[':thumbnailUrl'] = item.thumbnailUrl;
            }
            if (item.isVisible !== undefined) {
              updateExpressions.push('#isVisible = :isVisible');
              expressionAttributeNames['#isVisible'] = 'isVisible';
              expressionAttributeValues[':isVisible'] = item.isVisible;
            }
            
            // CRITICAL SIMPLIFICATION: Preserve creatorUsername if it exists (set by createVideoEntryImmediately)
            // creatorUsername will be "username🔒" if private, or just "username" if public
            // This is the SIMPLEST approach - no flags needed, just check for 🔒 in creatorUsername
            if (existingCheck.Item && existingCheck.Item.creatorUsername) {
              const existingCreatorUsernameRaw = existingCheck.Item.creatorUsername;
              const existingCreatorUsername = existingCreatorUsernameRaw.S || existingCreatorUsernameRaw;
              console.log(`✅ [Lambda] PRESERVING existing creatorUsername='${existingCreatorUsername}' (NOT updating it)`);
              const hasLock = typeof existingCreatorUsername === 'string' && existingCreatorUsername.includes('🔒');
              console.log(`   This username ${hasLock ? 'IS PRIVATE' : 'IS PUBLIC'} (has 🔒: ${hasLock})`);
              // DO NOT add creatorUsername to updateExpressions - this preserves it
            } else if (streamUsername) {
              // creatorUsername doesn't exist, but we can set it from streamUsername in mapping
              // streamUsername will be "username🔒" if private, or just "username" if public
              updateExpressions.push('#creatorUsername = :creatorUsername');
              expressionAttributeNames['#creatorUsername'] = 'creatorUsername';
              expressionAttributeValues[':creatorUsername'] = { S: streamUsername };
              console.log(`✅ [Lambda] Adding creatorUsername from streamUsername: ${streamUsername}`);
              console.log(`   This username ${streamUsername.includes('🔒') ? 'IS PRIVATE' : 'IS PUBLIC'} (has 🔒: ${streamUsername.includes('🔒')})`);
            }
            
            // CRITICAL PRIVACY FIX: Only update isPrivateUsername if it doesn't exist
            // If it exists, we MUST preserve it (it was set by createVideoEntryImmediately)
            if (hasExistingIsPrivate) {
              // isPrivateUsername already exists - DO NOT UPDATE IT (preserve it)
              // This is the value set by createVideoEntryImmediately - we must preserve it
              console.log(`✅ [Lambda] PRESERVING existing isPrivateUsername=${existingIsPrivateValue} (NOT updating it)`);
              console.log(`   This value was set by createVideoEntryImmediately - must be preserved`);
              // DO NOT add it to updateExpressions - this preserves it
            } else if (item.isPrivateUsername) {
              // isPrivateUsername is missing from existing item - add it from streamKey mapping
              updateExpressions.push('#isPrivateUsername = :isPrivateUsername');
              expressionAttributeNames['#isPrivateUsername'] = 'isPrivateUsername';
              expressionAttributeValues[':isPrivateUsername'] = item.isPrivateUsername;
              console.log(`✅ [Lambda] Adding missing isPrivateUsername from streamKey mapping`);
              console.log(`   Value to add: ${JSON.stringify(item.isPrivateUsername)}`);
            } else {
              console.log(`⚠️ [Lambda] No isPrivateUsername in existing item or streamKey mapping - will default to PUBLIC`);
            }
            
            if (updateExpressions.length > 0) {
              // Use existingSK if we found it earlier, otherwise construct from fileId
              const updateSK = existingSK || `FILE#${fileId}`;
              const updateCmd = new UpdateItemCommand({
                TableName: table,
                Key: {
                  PK: { S: `USER#${targetUserEmail}` },
                  SK: { S: updateSK }
                },
                UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues
              });
              await dynamodb.send(updateCmd);
              console.log(`✓ Successfully updated video entry (preserved isPrivateUsername)`);
            } else {
              console.log(`ℹ️ No fields to update - item is already up to date`);
            }
          } else {
            // Item doesn't exist - use PutItemCommand to create it
            console.log(`✅ [Lambda] Item doesn't exist - using PutItemCommand to create it`);
            
            // CRITICAL SIMPLIFICATION: Add creatorUsername from streamUsername if available
            // streamUsername will be "username🔒" if private, or just "username" if public
            if (streamUsername) {
              item.creatorUsername = { S: streamUsername };
              console.log(`✅ [Lambda] Adding creatorUsername from streamUsername: ${streamUsername}`);
              console.log(`   This username ${streamUsername.includes('🔒') ? 'IS PRIVATE' : 'IS PUBLIC'} (has 🔒: ${streamUsername.includes('🔒')})`);
            }
            
            // CRITICAL: Use ConditionExpression to prevent duplicate writes (atomic check-and-write)
            // This prevents race conditions where multiple Lambda invocations process the same S3 event
            const cmd = new PutItemCommand({ 
              TableName: table, 
              Item: item,
              ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
            });
            try {
              await dynamodb.send(cmd);
              console.log(`✓ Successfully created video entry in DynamoDB under owner account: ${targetUserEmail}`);
            } catch (conditionalCheckError) {
              // If item already exists (ConditionalCheckFailedException), it's a duplicate - skip it
              if (conditionalCheckError.name === 'ConditionalCheckFailedException') {
                console.log(`⚠️ Item already exists (duplicate S3 event detected), skipping: PK=${item.PK.S}, SK=${item.SK.S}`);
                // Don't throw - this is expected when processing duplicate S3 events
              } else {
                // Re-throw other errors
                throw conditionalCheckError;
              }
            }
          }
          // Isolated timelines: add to owner + fan-out (PUBLIC/PRIVATE/PREMIUM)
          const fileSK = existingSK || `FILE#${fileId}`;
          try {
            const getFileCmd = new GetItemCommand({
              TableName: table,
              Key: {
                PK: { S: `USER#${targetUserEmail}` },
                SK: { S: fileSK }
              }
            });
            const getFileResult = await dynamodb.send(getFileCmd);
            if (getFileResult.Item) {
              await addToIsolatedTimelines(dynamodb, table, getFileResult.Item, targetUserEmail, fileId, timestamp);
            }
          } catch (timelineErr) {
            console.warn(`⚠️ [Lambda] Isolated timeline write failed (non-fatal): ${timelineErr.message}`);
          }
        } catch (err) {
          console.error(`✗ DynamoDB write error for owner account ${targetUserEmail}:`, err);
          throw err; // Fail the entire process if master account write fails
        }
      } catch (error) {
        console.error(`Error processing S3 record: ${error.message}`);
        console.error(`Full error:`, error);
        // Continue processing other records instead of failing completely
        continue;
      }
    }
  };

  try {
    await processS3Event(event.Records);
    return { statusCode: 200, body: JSON.stringify({ message: "Processed successfully" }) };
  } catch (err) {
    console.error("Fatal error in Lambda handler:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Error during processing", details: err.message }) };
  }
};