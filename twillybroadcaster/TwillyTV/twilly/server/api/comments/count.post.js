import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

export default defineEventHandler(async (event) => {
  // Configure AWS
  AWS.config.update({
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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',
    region: 'us-east-1'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const table = 'Twilly';

  try {
    const body = await readBody(event);
    const { videoIds } = body; // Array of videoIds

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: videoIds (array)'
      });
    }

    console.log(`🔍 [comments/count] Fetching comment counts for ${videoIds.length} videos`);

    // Normalize videoIds and get counts
    const counts = {};
    
    // Process in batches to avoid overwhelming DynamoDB
    const batchSize = 10;
    for (let i = 0; i < videoIds.length; i += batchSize) {
      const batch = videoIds.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (videoId) => {
        try {
          // Normalize videoId - strip FILE# prefix if present
          const normalizedVideoId = videoId.startsWith('FILE#') ? videoId.replace('FILE#', '') : videoId;
          
          // Query comments for this video (only count, don't fetch all data)
          const params = {
            TableName: table,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `VIDEO#${normalizedVideoId}`,
              ':sk': 'COMMENT#'
            },
            Select: 'COUNT' // Only get count, not full items
          };

          const result = await dynamodb.query(params).promise();
          const count = result.Count || 0;
          counts[videoId] = count; // Store with original videoId for matching
          
          console.log(`📊 [comments/count] Video ${videoId}: ${count} comments`);
        } catch (error) {
          console.error(`❌ [comments/count] Error counting comments for ${videoId}: ${error.message}`);
          counts[videoId] = 0; // Default to 0 on error
        }
      }));
    }

    return {
      success: true,
      counts: counts
    };
  } catch (error) {
    console.error('❌ [comments/count] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to fetch comment counts'
    });
  }
});
