import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userEmail, streamKey } = body;

    if (!userEmail || !streamKey) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: userEmail and streamKey'
      });
    }

    console.log(`🔍 [check-stream-file] Checking for stream file: userEmail=${userEmail}, streamKey=${streamKey}`);

    // Query for files with this streamKey
    // Files are stored with PK = USER#email, SK = FILE#fileId
    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'streamKey = :streamKey',
      ExpressionAttributeValues: {
        ':pk': `USER#${userEmail}`,
        ':skPrefix': 'FILE#',
        ':streamKey': streamKey
      },
      Limit: 10 // Only need to check if it exists
    };

    const result = await dynamodb.query(queryParams).promise();

    if (result.Items && result.Items.length > 0) {
      // Find the most recent file (by timestamp)
      let mostRecentFile = null;
      let mostRecentTimestamp = null;

      for (const file of result.Items) {
        const timestamp = file.timestamp || file.createdAt;
        if (timestamp) {
          const timestampValue = new Date(timestamp).getTime();
          if (!mostRecentTimestamp || timestampValue > mostRecentTimestamp) {
            mostRecentTimestamp = timestampValue;
            mostRecentFile = file;
          }
        } else if (!mostRecentFile) {
          // If no timestamp, use first file as fallback
          mostRecentFile = file;
        }
      }

      if (mostRecentFile) {
        // Check if file has HLS URL (processing complete)
        const hasHlsUrl = mostRecentFile.hlsUrl && mostRecentFile.hlsUrl.trim() !== '';
        // Check if file has thumbnail (thumbnail should be ready before metadata form)
        const hasThumbnail = mostRecentFile.thumbnailUrl && mostRecentFile.thumbnailUrl.trim() !== '';
        console.log(`✅ [check-stream-file] Found file: fileName=${mostRecentFile.fileName}, hasHlsUrl=${hasHlsUrl}, hasThumbnail=${hasThumbnail}, isVisible=${mostRecentFile.isVisible}`);
        
        // Return the full SK (like managefiles.vue expects) - don't remove FILE# prefix
        const fullFileId = mostRecentFile.SK || (mostRecentFile.fileId ? `FILE#${mostRecentFile.fileId}` : null);
        console.log(`✅ [check-stream-file] Returning fileId (full SK): ${fullFileId}`);
        
        return {
          exists: true,
          hasHlsUrl: hasHlsUrl,
          hasThumbnail: hasThumbnail,
          isVisible: mostRecentFile.isVisible === true,
          fileName: mostRecentFile.fileName,
          fileId: fullFileId // Return full SK (FILE#file-123 format) like managefiles.vue expects
        };
      }
    }

    console.log(`⚠️ [check-stream-file] No file found for streamKey: ${streamKey}`);
    return {
      exists: false,
      hasHlsUrl: false,
      hasThumbnail: false,
      isVisible: false
    };

  } catch (error) {
    console.error('❌ [check-stream-file] Error checking stream file:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to check stream file'
    });
  }
});
