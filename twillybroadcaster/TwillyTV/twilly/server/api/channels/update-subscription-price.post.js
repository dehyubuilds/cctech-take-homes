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
    const { channelId, channelName, creatorUsername, newPrice } = body;

    console.log('Update subscription price request:', { channelId, channelName, creatorUsername, newPrice });

    if (!channelId || !channelName || !creatorUsername || newPrice === undefined) {
      return {
        success: false,
        message: 'Missing required fields: channelId, channelName, creatorUsername, and newPrice'
      };
    }

    // Validate price
    if (newPrice < 0) {
      return {
        success: false,
        message: 'Price must be greater than or equal to 0'
      };
    }

    // Try to find the series by channelId first
    let seriesRecord = null;
    
    try {
      const result = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `SERIES#${channelId}`,
          SK: 'METADATA'
        }
      }).promise();
      
      if (result.Item) {
        seriesRecord = result.Item;
        console.log('Found series by channelId:', channelId);
      }
    } catch (error) {
      console.error('Error querying by channelId:', error);
    }

    // If not found by channelId, try to find by series name
    if (!seriesRecord && channelName) {
      try {
        const result = await dynamodb.scan({
          TableName: table,
          FilterExpression: 'SK = :sk AND seriesName = :seriesName',
          ExpressionAttributeValues: {
            ':sk': 'METADATA',
            ':seriesName': channelName
          }
        }).promise();
        
        if (result.Items && result.Items.length > 0) {
          seriesRecord = result.Items[0];
          console.log('Found series by channelName:', channelName);
        }
      } catch (error) {
        console.error('Error querying by channelName:', error);
      }
    }

    // If still not found, try to find by creator and series name
    if (!seriesRecord && creatorUsername && channelName) {
      try {
        // First get the creator's email from username
        const userResult = await dynamodb.get({
          TableName: table,
          Key: {
            PK: `USER#${creatorUsername}`,
            SK: 'PROFILE'
          }
        }).promise();
        
        if (userResult.Item) {
          const creatorEmail = userResult.Item.email || creatorUsername;
          
          // Query for series by creator and name
          const result = await dynamodb.query({
            TableName: table,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            FilterExpression: 'seriesName = :seriesName',
            ExpressionAttributeValues: {
              ':pk': `CREATOR#${creatorEmail}`,
              ':sk': 'SERIES#',
              ':seriesName': channelName
            }
          }).promise();
          
          if (result.Items && result.Items.length > 0) {
            const seriesId = result.Items[0].seriesId;
            
            // Get the full series record
            const seriesResult = await dynamodb.get({
              TableName: table,
              Key: {
                PK: `SERIES#${seriesId}`,
                SK: 'METADATA'
              }
            }).promise();
            
            if (seriesResult.Item) {
              seriesRecord = seriesResult.Item;
              console.log('Found series by creator and channelName:', { creatorEmail, channelName });
            }
          }
        }
      } catch (error) {
        console.error('Error querying by creator and channelName:', error);
      }
    }

    if (seriesRecord) {
      // Update the existing series record
      try {
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: seriesRecord.PK,
            SK: seriesRecord.SK
          },
          UpdateExpression: 'SET subscriptionPrice = :price, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':price': newPrice,
            ':updatedAt': new Date().toISOString()
          }
        }).promise();

        // Also update the creator's series reference
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: `CREATOR#${seriesRecord.creatorId}`,
            SK: `SERIES#${seriesRecord.seriesId}`
          },
          UpdateExpression: 'SET subscriptionPrice = :price',
          ExpressionAttributeValues: {
            ':price': newPrice
          }
        }).promise();

        console.log('Successfully updated subscription price for series:', seriesRecord.seriesId);
        
        return {
          success: true,
          message: 'Subscription price updated successfully',
          price: newPrice
        };
      } catch (error) {
        console.error('Error updating series record:', error);
        return {
          success: false,
          message: 'Failed to update subscription price',
          error: error.message
        };
      }
    } else {
      // Create a new series record if none exists
      try {
        const seriesId = channelId;
        const creatorEmail = creatorUsername.includes('@') ? creatorUsername : `${creatorUsername}@example.com`;
        
        const seriesRecord = {
          PK: `SERIES#${seriesId}`,
          SK: 'METADATA',
          seriesId: seriesId,
          creatorId: creatorEmail,
          seriesName: channelName,
          subscriptionPrice: newPrice,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const creatorSeriesRecord = {
          PK: `CREATOR#${creatorEmail}`,
          SK: `SERIES#${seriesId}`,
          seriesId: seriesId,
          seriesName: channelName,
          subscriptionPrice: newPrice,
          status: 'active',
          createdAt: new Date().toISOString()
        };

        // Batch write to DynamoDB
        await dynamodb.batchWrite({
          RequestItems: {
            [table]: [
              { PutRequest: { Item: seriesRecord } },
              { PutRequest: { Item: creatorSeriesRecord } }
            ]
          }
        }).promise();

        console.log('Successfully created new series record with subscription price:', seriesId);
        
        return {
          success: true,
          message: 'Subscription price set successfully',
          price: newPrice
        };
      } catch (error) {
        console.error('Error creating series record:', error);
        return {
          success: false,
          message: 'Failed to set subscription price',
          error: error.message
        };
      }
    }

  } catch (error) {
    console.error('Error updating subscription price:', error);
    return {
      success: false,
      message: 'Failed to update subscription price',
      error: error.message
    };
  }
}); 