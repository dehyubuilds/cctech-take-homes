/**
 * API endpoint to update Twilly TV channel poster
 * 
 * POST /api/channels/update-poster
 * Body: {
 *   posterUrl: "https://..." (optional - will upload if file provided)
 *   imageFile: File (optional - multipart form data)
 *   channelName: "Twilly TV" (optional, defaults to Twilly TV)
 * }
 */

import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  try {
    // Configure AWS
    AWS.config.update({
      region: 'us-east-1',
      accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
      secretAccessKey: '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'
    });

    const dynamodb = new AWS.DynamoDB.DocumentClient();
    const s3 = new AWS.S3();
    const table = 'Twilly';

    // Default values
    const TWILLY_TV_EMAIL = 'dehyu.sinyan@gmail.com';
    const CLOUDFRONT_DOMAIN = 'd26k8mraabzpiy.cloudfront.net';

    // Get request body
    const body = await readBody(event);
    let posterUrl = body.posterUrl;
    const channelName = body.channelName || 'Twilly TV';

    if (!posterUrl) {
      throw createError({
        statusCode: 400,
        message: 'posterUrl is required. Upload your image to S3 first and provide the URL.'
      });
    }

    // Find the Twilly TV folder
    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk',
      FilterExpression: 'name = :channelName OR folderName = :channelName OR series = :channelName',
      ExpressionAttributeValues: {
        ':pk': `USER#${TWILLY_TV_EMAIL}`,
        ':channelName': channelName
      }
    };

    const result = await dynamodb.query(queryParams).promise();
    const folders = result.Items?.filter(item => 
      item.SK?.startsWith('FOLDER#') || item.SK?.startsWith('COLLAB#')
    ) || [];

    if (folders.length === 0) {
      // Try scanning
      const scanParams = {
        TableName: table,
        FilterExpression: 'PK = :pk AND (name = :channelName OR folderName = :channelName OR series = :channelName)',
        ExpressionAttributeValues: {
          ':pk': `USER#${TWILLY_TV_EMAIL}`,
          ':channelName': channelName
        }
      };
      
      const scanResult = await dynamodb.scan(scanParams).promise();
      const folder = scanResult.Items?.find(item => 
        item.SK?.startsWith('FOLDER#') || item.SK?.startsWith('COLLAB#')
      );

      if (!folder) {
        throw createError({
          statusCode: 404,
          message: `Twilly TV folder not found for channel: ${channelName}`
        });
      }

      // Update folder
      const updateParams = {
        TableName: table,
        Key: {
          PK: folder.PK,
          SK: folder.SK
        },
        UpdateExpression: 'SET seriesPosterUrl = :posterUrl, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':posterUrl': posterUrl,
          ':updatedAt': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      };

      await dynamodb.update(updateParams).promise();

      return {
        success: true,
        message: 'Twilly TV poster updated successfully',
        posterUrl,
        channelName
      };
    }

    // Update the first matching folder
    const folder = folders[0];
    const updateParams = {
      TableName: table,
      Key: {
        PK: folder.PK,
        SK: folder.SK
      },
      UpdateExpression: 'SET seriesPosterUrl = :posterUrl, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':posterUrl': posterUrl,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const updateResult = await dynamodb.update(updateParams).promise();

    return {
      success: true,
      message: 'Twilly TV poster updated successfully',
      posterUrl,
      channelName,
      folder: updateResult.Attributes
    };

  } catch (error) {
    console.error('Error updating Twilly TV poster:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to update poster'
    });
  }
});
