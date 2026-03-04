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

    console.log('Get channel description request:', { channelId, channelName, creatorUsername });

    if (!channelName) {
      return {
        success: false,
        message: 'Missing required field: channelName'
      };
    }

    // Try to find the series by channelId first (if provided)
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

    // If not found by channelId, try to find by series name and creator username
    if (!seriesRecord && channelName && creatorUsername) {
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

    // If still not found, try to find by series name only (fallback)
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
        // Check if creatorUsername is an email or username
        const isEmail = creatorUsername.includes('@');
        let creatorEmail = creatorUsername;
        
        if (!isEmail) {
          // If it's a username, try to get the email from the USER profile
          const userResult = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `USER#${creatorUsername}`,
              SK: 'PROFILE'
            }
          }).promise();
          
          if (userResult.Item) {
            creatorEmail = userResult.Item.email || creatorUsername;
          }
        }
        
        console.log('Looking for series with:', { creatorEmail, channelName, isEmail });
        
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
      } catch (error) {
        console.error('Error querying by creator and channelName:', error);
      }
    }

    if (seriesRecord && seriesRecord.description) {
      return {
        success: true,
        message: 'Channel description retrieved successfully',
        description: seriesRecord.description
      };
    } else {
      // Return default description if no series found or no description set
      return {
        success: true,
        message: 'No description found, using default',
        description: `Check out this series from ${creatorUsername || 'this creator'}`
      };
    }

  } catch (error) {
    console.error('Error getting channel description:', error);
    return {
      success: false,
      message: 'Failed to get channel description',
      error: error.message
    };
  }
});
