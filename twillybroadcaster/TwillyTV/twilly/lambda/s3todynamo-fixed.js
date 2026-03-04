import {
    DynamoDBClient,
    PutItemCommand,
    QueryCommand
  } from "@aws-sdk/client-dynamodb";

  /** Short clips must never exist in DynamoDB. Videos shorter than this are not written. */
  const MIN_DURATION_SECONDS = 6;

  /** Fetch HLS playlist and return total duration in seconds, or null if unavailable. */
  async function getDurationFromHlsUrl(hlsUrl) {
    try {
      let body = await fetch(hlsUrl, { signal: AbortSignal.timeout(15000) }).then((r) => r.text());
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
        body = await fetch(resolved.toString(), { signal: AbortSignal.timeout(15000) }).then((r) => r.text());
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
  
  export const handler = async (event) => {
    console.log("Incoming Event:");
    console.log(JSON.stringify(event, null, 2));
  
    const dynamodb = new DynamoDBClient({ region: "us-east-1" });
    const table = "Twilly";
    const cloudFrontBaseUrl = "https://d4idc5cmwxlpy.cloudfront.net";
    
    // Extract user email from the S3 key path
    // S3 key format: clips/{streamKey}/{filename}
    // We need to extract the streamKey and map it to the correct user
    
    const getUserEmailFromStreamKey = async (streamKey) => {
      try {
        // Query DynamoDB to find the user who owns this stream key
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
          const userEmail = item.ownerEmail.S;
          const seriesName = item.seriesName?.S; // Get the folder name from the mapping
          console.log(`Found user email ${userEmail} for stream key ${streamKey}`);
          console.log(`Found series name ${seriesName} for stream key ${streamKey}`);
          return { userEmail, seriesName };
        }
        
        console.log(`No user found for stream key: ${streamKey}`);
        return null;
      } catch (error) {
        console.error(`Error looking up user for stream key ${streamKey}:`, error);
        return null;
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
  
    const processS3Event = async (records) => {
      console.log(`Processing ${records.length} S3 records`);
      
      for (const record of records) {
        try {
          const bucket = record.s3.bucket.name;
          let key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
          
          // Extract streamKey from S3 key path: clips/{streamKey}/{filename}
          const keyParts = key.split('/');
          if (keyParts.length < 3 || keyParts[0] !== 'clips') {
            console.log(`Invalid S3 key format: ${key}`);
            continue;
          }
          
          const extractedStreamKey = keyParts[1];
          console.log(`Processing file for streamKey: ${extractedStreamKey}`);
          
          // Look up the user email and series name from the stream key
          const userInfo = await getUserEmailFromStreamKey(extractedStreamKey);
          if (!userInfo) {
            console.log(`Could not find user for streamKey: ${extractedStreamKey}`);
            continue;
          }
          
          const { userEmail, seriesName } = userInfo;
          console.log(`Found user email: ${userEmail} for streamKey: ${extractedStreamKey}`);
          console.log(`Found series name: ${seriesName} for streamKey: ${extractedStreamKey}`);
          
          console.log(`Processing S3 event - Bucket: ${bucket}, Key: ${key}`);
  
          // Parse the S3 key structure - handle the format: clips/schedulerId/streamName_fileName
          let streamName, fileName;
          
          if (key.startsWith("clips/")) {
            // Format: clips/schedulerId/streamName_fileName
            const parts = key.split("/");
            console.log(`S3 key parts: ${JSON.stringify(parts)}`);
            
            if (parts.length >= 3) {
              // The last part contains both streamName and fileName combined
              const lastPart = parts[2]; // e.g., "deh1_202..."
              
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
  
          // Extract the full stream key from the S3 path
          // Format: clips/sk_471a28081fbbe853/sk_471a28081fbbe853_2025-07-18T16-49-26-001Z_lf525ptn_720p.m3u8
          // We want: sk_471a28081fbbe853
          const pathParts = key.split("/");
          const streamKey = pathParts[1]; // Get the stream key from the path (second part)
          const fileExtension = (fileName.split(".").pop() || "").toLowerCase();
  
          console.log(`Parsed - Stream Name: ${streamName}, File Name: ${fileName}, Stream Key: ${streamKey}`);

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
            const url = `${cloudFrontBaseUrl}/${key}`;
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
  
          // Use the series name from the stream key mapping as the folder name
          const folderName = seriesName || 'default';
  
          console.log(`Matched folder: ${folderName}`);
  
          const item = {
            PK: { S: `USER#${userEmail}` },
            SK: { S: `FILE#${fileId}` },
            url: { S: url },
            fileName: { S: key.split("/").pop() }, // Store the full unique filename
            fileExtension: { S: fileExtension },
            folderPath: { S: streamKey },
            folderName: { S: folderName },
            streamKey: { S: streamKey },
            category: { S: category },
            timestamp: { S: timestamp },
            price: { S: "0.00" },
            isVisible: { BOOL: true } // New items are visible by default
          };
  
          if (category === "Videos") {
            // Short clips must never exist: skip writing if duration < MIN_DURATION_SECONDS
            const durationSec = await getDurationFromHlsUrl(url);
            if (durationSec !== null && durationSec < MIN_DURATION_SECONDS) {
              console.log(`⏱️ Short video skipped (${durationSec.toFixed(1)}s < ${MIN_DURATION_SECONDS}s), not writing to DynamoDB: ${fileName}`);
              continue;
            }
            item.hlsUrl = { S: url };
            
            // Generate thumbnail URL for video files
            // Use the same unique filename as the master playlist but with _thumb.jpg
            // fileName format: "deh1_2025-07-16T20-27-38-922Z_9x0c7lz6_master.m3u8"
            // We want: "deh1_2025-07-16T20-27-38-922Z_9x0c7lz6_thumb.jpg"
            // Extract the unique prefix from the full filename
            const fullFileName = key.split("/").pop(); // e.g., "deh1_2025-07-16T21-37-20-780Z_p13j1v6b_master.m3u8"
            const uniquePrefix = fullFileName.replace('_master.m3u8', ''); // e.g., "deh1_2025-07-16T21-37-20-780Z_p13j1v6b"
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
  
          // Check if this file already exists to prevent duplicates
          const fullFileName = key.split("/").pop();
          const existingQuery = new QueryCommand({
            TableName: table,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            FilterExpression: "fileName = :fileName",
            ExpressionAttributeValues: {
              ":pk": { S: `USER#${userEmail}` },
              ":sk": { S: "FILE#" },
              ":fileName": { S: fullFileName }
            }
          });
          
          const existingResult = await dynamodb.send(existingQuery);
          
          console.log(`🔍 Checking for existing file: ${fullFileName}`);
          console.log(`🔍 Found ${existingResult.Items?.length || 0} existing items`);
          
          if (existingResult.Items && existingResult.Items.length > 0) {
            console.log(`⚠️ File already exists in DynamoDB, skipping: ${fullFileName}`);
            console.log(`⚠️ Existing items:`, JSON.stringify(existingResult.Items, null, 2));
            continue;
          }
          
          console.log("Attempting to write to DynamoDB with item:", JSON.stringify(item, null, 2));

          try {
            // CRITICAL: Use ConditionExpression to prevent duplicate writes (atomic check-and-write)
            // This prevents race conditions where multiple Lambda invocations process the same S3 event
            const cmd = new PutItemCommand({ 
              TableName: table, 
              Item: item,
              ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
            });
            await dynamodb.send(cmd);
            console.log("✓ Successfully added to DynamoDB:", fileName);
          } catch (err) {
            // If item already exists (ConditionalCheckFailedException), it's a duplicate - skip it
            if (err.name === 'ConditionalCheckFailedException') {
              console.log(`⚠️ Item already exists (duplicate S3 event detected), skipping: PK=${item.PK.S}, SK=${item.SK.S}`);
              // Don't throw - this is expected when processing duplicate S3 events
              continue;
            } else {
            console.error("✗ DynamoDB write error:", err);
            throw err;
            }
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