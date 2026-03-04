import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  try {
    const { userId, folderName, category, metadata, trailerUrl } = await readBody(event);

    // Configure AWS SDK
    AWS.config.update({
      accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
      secretAccessKey: '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',
      region: 'us-east-1'
    });

    // Use low-level DynamoDB client
    const dynamodb = new AWS.DynamoDB();
    
    // First, try to find the folder (could be regular folder or collaboration folder)
    const dynamodbDoc = new AWS.DynamoDB.DocumentClient();
    
    // Try regular folder first
    let folderKey = null;
    try {
      const folderParams = {
        TableName: 'Twilly',
        Key: {
          PK: `USER#${userId}`,
          SK: `FOLDER#${category || 'Mixed'}#${folderName}`
        }
      };
      const folderResult = await dynamodbDoc.get(folderParams).promise();
      if (folderResult.Item) {
        folderKey = {
          PK: { S: `USER#${userId}` },
          SK: { S: `FOLDER#${category || 'Mixed'}#${folderName}` }
        };
      }
    } catch (err) {
      console.log('Regular folder not found, trying collaboration folder');
    }
    
    // If regular folder not found, try collaboration folder
    if (!folderKey) {
      try {
        const collabParams = {
          TableName: 'Twilly',
          Key: {
            PK: `USER#${userId}`,
            SK: `COLLAB#${category || 'Mixed'}#${folderName}`
          }
        };
        const collabResult = await dynamodbDoc.get(collabParams).promise();
        if (collabResult.Item) {
          folderKey = {
            PK: { S: `USER#${userId}` },
            SK: { S: `COLLAB#${category || 'Mixed'}#${folderName}` }
          };
        }
      } catch (err) {
        console.log('Collaboration folder not found either');
      }
    }
    
    if (!folderKey) {
      throw createError({
        statusCode: 404,
        message: 'Folder not found'
      });
    }

    // Update the folder metadata
    const updateParams = {
      TableName: 'Twilly',
      Key: folderKey,
      UpdateExpression: 'SET seriesPosterUrl = :seriesPosterUrl, trailerUrl = :trailerUrl',
      ExpressionAttributeValues: {
        ':seriesPosterUrl': { S: metadata?.seriesPosterUrl || '' },
        ':trailerUrl': { S: trailerUrl || '' }
      },
      ReturnValues: 'ALL_NEW'
    };

    console.log('Updating folder with params:', updateParams);

    const result = await dynamodb.updateItem(updateParams).promise();
    
    return {
      success: true,
      message: 'Series poster updated successfully',
      folder: result.Attributes
    };

  } catch (error) {
    console.error('Error updating folder metadata:', error);
    throw createError({
      statusCode: 500,
      message: error.message
    });
  }
}); 