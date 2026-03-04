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
    const { channelId, channelName, creatorUsername } = body;

    console.log('Get subscription price request:', { channelId, channelName, creatorUsername });

    if (!channelId && !channelName) {
      return {
        success: false,
        message: 'Missing required fields: channelId or channelName'
      };
    }

    // Try to find the series by channelId first
    let seriesRecord = null;
    
    if (channelId) {
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
    }

    // If not found by channelId, try to find by series name
    if (!seriesRecord && channelName) {
      try {
        // Query for series by name (this might need to be more specific)
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

    if (seriesRecord && seriesRecord.subscriptionPrice) {
      return {
        success: true,
        message: 'Subscription price retrieved successfully',
        price: seriesRecord.subscriptionPrice
      };
    } else {
      // Return default price if no series found
      return {
        success: true,
        message: 'No series found, using default price',
        price: 9.99
      };
    }

  } catch (error) {
    console.error('Error getting subscription price:', error);
    return {
      success: false,
      message: 'Failed to get subscription price',
      error: error.message
    };
  }
}); 