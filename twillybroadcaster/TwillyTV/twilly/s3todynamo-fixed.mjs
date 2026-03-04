import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  GetItemCommand,
  DeleteItemCommand
} from "@aws-sdk/client-dynamodb";

export const handler = async (event) => {
  console.log("Incoming Event:");
  console.log(JSON.stringify(event, null, 2));

  const dynamodb = new DynamoDBClient({ region: "us-east-1" });
  const table = "Twilly";
  const cloudFrontBaseUrl = "https://d4idc5cmwxlpy.cloudfront.net";

  // Function to look up user account from stream key
  const getUserFromStreamKey = async (streamKey) => {
    try {
      console.log(`Looking up user for stream key: ${streamKey}`);
      
      // First, get the stream key mapping
      const query = new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk AND SK = :sk",
        ExpressionAttributeValues: {
          ":pk": { S: `STREAM_KEY#${streamKey}` },
          ":sk": { S: "MAPPING" }
        }
      });
      
      const result = await dynamodb.send(query);
      if (result.Items && result.Items.length > 0) {
        const item = result.Items[0];
        
        // Handle both personal keys (ownerEmail) and collaborator keys (collaboratorEmail)
        let userEmail = null;
        if (item.ownerEmail && item.ownerEmail.S) {
          userEmail = item.ownerEmail.S;
        } else if (item.collaboratorEmail && item.collaboratorEmail.S) {
          userEmail = item.collaboratorEmail.S;
        }
        
        // Handle both seriesName (personal) and channelName (collaborator)
        let folderName = null;
        if (item.seriesName && item.seriesName.S) {
          folderName = item.seriesName.S;
        } else if (item.channelName && item.channelName.S) {
          folderName = item.channelName.S;
        }
        
        const channelId = item.channelId && item.channelId.S ? item.channelId.S : null;
        const isPersonalKey = item.isPersonalKey && item.isPersonalKey.BOOL ? item.isPersonalKey.BOOL : false;
        const isCollaboratorKey = item.isCollaboratorKey && item.isCollaboratorKey.BOOL ? item.isCollaboratorKey.BOOL : false;                                                                                                  
        
        console.log(`Found stream key mapping - User Email: ${userEmail}, Folder: ${folderName}, Channel ID: ${channelId}, Is Personal Key: ${isPersonalKey}, Is Collaborator Key: ${isCollaboratorKey}`);                      
        
        return { userEmail, folderName, channelId, isPersonalKey, isCollaboratorKey };
        
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
      
      console.log(`No channel owner found for ${channelId}`);
      return null;
    } catch (error) {
      console.error(`Error looking up channel owner for ${channelId}:`, error);
      return null;
    }
  };

  // Function to check if a file already exists to prevent duplicates
  const checkForExistingFile = async (fileName, masterEmail) => {
    try {
      console.log(`🔍 Checking for existing file: ${fileName}`);
      
      const query = new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        FilterExpression: "fileName = :fileName",
        ExpressionAttributeValues: {
          ":pk": { S: `USER#${masterEmail}` },
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

  const updateVideoWithThumbnail = async (thumbnailFileName, thumbnailUrl, userEmail) => {
    try {
      // Extract fileId from thumbnail filename (e.g., "file-1234567890-abc123_thumb.jpg")
      const fileIdMatch = thumbnailFileName.match(/^(file-\d+-\w+)_thumb\.jpg$/);
      if (!fileIdMatch) {
        console.log(`Could not extract fileId from thumbnail filename: ${thumbnailFileName}`);
        return;
      }
      
      const fileId = fileIdMatch[1];
      console.log(`Looking for video file with fileId: ${fileId}`);
      
      // Query DynamoDB to find the video file
      const query = new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        FilterExpression: "contains(fileName, :fileId)",
        ExpressionAttributeValues: {
          ":pk": { S: `USER#${userEmail}` },
          ":sk": { S: "FILE#" },
          ":fileId": { S: fileId }
        }
      });
      
      const result = await dynamodb.send(query);
      if (result.Items && result.Items.length > 0) {
        const videoItem = result.Items[0];
        console.log(`Found video item to update: ${videoItem.SK.S}`);
        
        // Update the video item with the thumbnail URL
        const updateItem = {
          ...videoItem,
          thumbnailUrl: { S: thumbnailUrl }
        };
        
        const putCmd = new PutItemCommand({ TableName: table, Item: updateItem });
        await dynamodb.send(putCmd);
        console.log(`✓ Successfully updated video with thumbnail: ${thumbnailUrl}`);
      } else {
        console.log(`No video file found for fileId: ${fileId}`);
      }
    } catch (error) {
      console.error(`Error updating video with thumbnail: ${error.message}`);
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

  // Function to create video item for a user
  const createVideoItem = (userEmail, fileId, url, fileName, fileExtension, streamKey, finalFolderName, category, timestamp, key, cloudFrontBaseUrl) => {                                                                       
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
      isVisible: { BOOL: true }, // New items are visible by default
      isCollaboratorVideo: { BOOL: false } // Will be set based on user type
    };

    if (category === "Videos") {
      item.hlsUrl = { S: url };
      
      // Generate thumbnail URL for video files
      const fullFileName = key.split("/").pop();
      const uniquePrefix = fullFileName.replace('_master.m3u8', '');
      const thumbnailKey = `clips/${streamKey}/${uniquePrefix}_thumb.jpg`;
      const thumbnailUrl = `${cloudFrontBaseUrl}/${thumbnailKey}`;
      item.thumbnailUrl = { S: thumbnailUrl };
      
      console.log("✔ Video file - HLS:", url);
      console.log("✔ Video file - Full File Name:", fullFileName);
      console.log("✔ Video file - Unique Prefix:", uniquePrefix);
      console.log("✔ Video file - Stream Key:", streamKey);
      console.log("✔ Video file - Thumbnail Key:", thumbnailKey);
      console.log("✔ Video file - Thumbnail:", thumbnailUrl);
    }

    return item;
  };

  const processS3Event = async (records) => {
    console.log(`Processing ${records.length} S3 records`);
    
    for (const record of records) {
      try {
        const bucket = record.s3.bucket.name;
        let key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
        
        console.log(`Processing S3 event - Bucket: ${bucket}, Key: ${key}`);

        // Extract streamKey and uploadId from S3 path first
        // Format (old): clips/schedulerId/streamName_fileName
        // Format (new): clips/schedulerId/uploadId/streamName_fileName
        const pathParts = key.split("/");
        const streamKey = pathParts[1]; // Get the stream key from the path (second part)
        
        // Check if uploadId is in the path (new format: clips/{streamKey}/{uploadId}/{file})
        // uploadId can be a UUID (from mobile app) or a string starting with 'upload-' (from EC2 fallback)
        let uploadId = null;
        let filePartIndex = 2; // Default to old format (parts[2] is the file)
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
          } else {
            // Old format without uploadId (backward compatible)
            console.log(`📤 No uploadId in S3 key (parts[2]='${potentialUploadId}'), using streamKey for metadata lookup (backward compatible)`);
          }
        } else {
          // Old format without uploadId (backward compatible)
          console.log(`📤 No uploadId in S3 key (pathParts.length=${pathParts.length}), using streamKey for metadata lookup (backward compatible)`);
        }

        // Parse the S3 key structure - handle the format: clips/schedulerId/streamName_fileName
        let streamName, fileName;
        
        if (key.startsWith("clips/")) {
          // Format: clips/schedulerId/streamName_fileName (old) or clips/schedulerId/uploadId/streamName_fileName (new)
          const parts = key.split("/");
          console.log(`S3 key parts: ${JSON.stringify(parts)}`);
          
          if (parts.length >= 3) {
            // The last part contains both streamName and fileName combined
            const lastPart = parts[filePartIndex]; // e.g., "deh1_202..." (old format) or parts[3] (new format)
            
            // Try to extract streamName and fileName from the last part
            // Look for common video file extensions
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
            
            if (foundExtension && extensionIndex > 0) {
              // Extract streamName and fileName
              const beforeExtension = lastPart.substring(0, extensionIndex);
              const afterExtension = lastPart.substring(extensionIndex + foundExtension.length);
              
              // The streamName is everything before the last underscore before the extension
              const lastUnderscoreIndex = beforeExtension.lastIndexOf('_');
              if (lastUnderscoreIndex > 0) {
                streamName = beforeExtension.substring(0, lastUnderscoreIndex);
                fileName = lastPart.substring(lastUnderscoreIndex + 1);
              } else {
                // If no underscore found, use the whole part as streamName
                streamName = beforeExtension;
                fileName = lastPart;
              }
            } else {
              // Fallback: use the whole last part as streamName, no fileName
              streamName = lastPart;
              fileName = lastPart;
            }
          } else {
            console.log("Invalid S3 key format, skipping:", key);
            continue;
          }
        } else {
          // Fallback for other formats
          const pathParts = key.split("/");
          fileName = pathParts.pop();
          streamName = fileName.replace(".m3u8", "");
        }
        
        if (!fileName) {
          console.log("No filename found in S3 key, skipping");
          continue;
        }

        // streamKey and uploadId are already extracted above at the beginning of the key parsing
        const fileExtension = (fileName.split(".").pop() || "").toLowerCase();

        console.log(`Parsed - Stream Name: ${streamName}, File Name: ${fileName}, Stream Key: ${streamKey}`);

        // Look up the user account from the stream key
        const userInfo = await getUserFromStreamKey(streamKey);
        if (!userInfo) {
          console.log(`No user found for stream key: ${streamKey}, skipping file: ${fileName}`);
          continue;
        }

        const { userEmail, folderName, channelId, isPersonalKey, isCollaboratorKey } = userInfo;
        console.log(`Processing file for user: ${userEmail} in folder: ${folderName}`);

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
          console.log(`Processing thumbnail file: ${fileName}`);
          await updateVideoWithThumbnail(fileName, url, userEmail);
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

        console.log(`File category: ${category}`);

        const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();
        const url = `${cloudFrontBaseUrl}/${key}`;

        console.log(`Generated fileId: ${fileId}`);
        console.log(`Generated timestamp: ${timestamp}`);
        console.log(`Generated URL: ${url}`);

        // Use the folder name from the stream key lookup instead of matching
        const finalFolderName = folderName;

        console.log(`Using folder: ${finalFolderName}`);

        // Get channel owner (master account) - this is where ALL videos should be stored
        const channelOwner = await getChannelOwner(channelId, folderName);
        
        // isPersonalKey and isCollaboratorKey are already available from the getUserFromStreamKey call above
        
        // For personal keys, the owner is the streamer themselves
        // For collaborator keys, the owner is the channel owner (master account)
        // If no channel owner found, use the hardcoded master account
        const masterEmail = isPersonalKey ? userEmail : (channelOwner || 'dehyu.sinyan@gmail.com');
        
        // Determine if this is a collaborator video
        const isCollaboratorVideo = isCollaboratorKey;
        
        console.log(`Creating video entry under master account: ${masterEmail} (isCollaboratorVideo: ${isCollaboratorVideo})`);                                                                                                 

        // Check for duplicate files before creating
        const fullFileName = key.split("/").pop(); // Use the full filename from S3 key
        const fileExists = await checkForExistingFile(fullFileName, masterEmail);
        if (fileExists) {
          console.log(`Skipping duplicate file: ${fullFileName}`);
          continue; // Skip to next record
        }

        try {
          const item = createVideoItem(
            masterEmail,
            fileId,
            url,
            fileName,
            fileExtension,
            streamKey,
            finalFolderName,
            category,
            timestamp,
            key,
            cloudFrontBaseUrl
          );

          // Mark if this is a collaborator video (streamed by collaborator, not master)
          item.isCollaboratorVideo = { BOOL: isCollaboratorVideo };
          item.streamerEmail = { S: userEmail }; // Track who actually streamed it
          
          // Try to read video metadata (title, description, price, isVisible) from DynamoDB
          // CRITICAL: Use uploadId if available (new format), otherwise fall back to streamKey (backward compatible)
          // This ensures each video has unique metadata
          const metadataKey = {
            PK: { S: uploadId ? `METADATA#${uploadId}` : `METADATA#${streamKey}` },
            SK: { S: 'video-details' }
          };
          
          console.log(`📤 Looking up metadata using: ${uploadId ? `uploadId=${uploadId}` : `streamKey=${streamKey}`} (backward compatible)`);
          
          let metadataResult = null;
          const maxRetries = 5; // Increased from 3 to 5
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              const getMetadataCmd = new GetItemCommand({
                TableName: table,
                Key: metadataKey
              });
              
              metadataResult = await dynamodb.send(getMetadataCmd);
              
              if (metadataResult.Item) {
                console.log(`📋 Found video metadata for ${uploadId ? `uploadId: ${uploadId}` : `streamKey: ${streamKey}`} on attempt ${attempt + 1}`);
                console.log(`📋 Metadata item structure: ${JSON.stringify(metadataResult.Item, null, 2)}`);
                break; // Found it, exit retry loop
              } else if (attempt < maxRetries - 1) {
                // Wait before retrying (exponential backoff with longer initial delay)
                const waitTime = Math.pow(2, attempt) * 500; // 500ms, 1000ms, 2000ms, 4000ms, 8000ms
                console.log(`⏳ Metadata not found, retrying in ${waitTime}ms... (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
            } catch (metadataReadError) {
              console.error(`⚠️ Error reading metadata (attempt ${attempt + 1}): ${metadataReadError.message}`);
              if (attempt < maxRetries - 1) {
                const waitTime = Math.pow(2, attempt) * 500;
                await new Promise(resolve => setTimeout(resolve, waitTime));
              } else {
                console.error(`❌ Failed to read metadata after ${maxRetries} attempts`);
                // Don't throw - continue without metadata
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

          console.log(`Creating video entry for master account: ${masterEmail}`);

          // CRITICAL: Use ConditionExpression to prevent duplicate writes (atomic check-and-write)
          // This prevents race conditions where multiple Lambda invocations process the same S3 event
          const cmd = new PutItemCommand({ 
            TableName: table, 
            Item: item,
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
          });
          try {
          await dynamodb.send(cmd);
          console.log(`✓ Successfully added video to DynamoDB under master account: ${masterEmail}`);
          } catch (err) {
            // If item already exists (ConditionalCheckFailedException), it's a duplicate - skip it
            if (err.name === 'ConditionalCheckFailedException') {
              console.log(`⚠️ Item already exists (duplicate S3 event detected), skipping: PK=${item.PK.S}, SK=${item.SK.S}`);
              // Don't throw - this is expected when processing duplicate S3 events
              continue;
            } else {
              console.error(`✗ DynamoDB write error for master account ${masterEmail}:`, err);
              throw err;
            }
          }
        } catch (err) {
          console.error(`✗ DynamoDB write error for master account ${masterEmail}:`, err);
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
