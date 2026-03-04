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
    const { channelId, channelName, creatorUsername, newDescription } = body;

    console.log('Update channel description request:', { channelId, channelName, creatorUsername, newDescription });

    if (!channelName || !creatorUsername || !newDescription) {
      return {
        success: false,
        message: 'Missing required fields: channelName, creatorUsername, and newDescription'
      };
    }

    // Validate description
    if (typeof newDescription !== 'string' || newDescription.trim().length === 0) {
      return {
        success: false,
        message: 'Description must be a non-empty string'
      };
    }

    // Try to find the series by channelId first (if provided)
    let seriesRecord = null;
    let seriesKey = null;
    
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
          seriesKey = {
            PK: `SERIES#${channelId}`,
            SK: 'METADATA'
          };
          console.log('Found series by channelId:', channelId);
        }
      } catch (error) {
        console.error('Error querying by channelId:', error);
      }
    }

    // If not found by channelId, try to find by series name and creator username/email
    if (!seriesRecord && channelName && creatorUsername) {
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
            seriesKey = {
              PK: `SERIES#${seriesId}`,
              SK: 'METADATA'
            };
            console.log('Found series by creator and channelName:', { creatorEmail, channelName });
          }
        }
      } catch (error) {
        console.error('Error querying by creator and channelName:', error);
      }
    }

    // If still not found, try to find by series name only (fallback)
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
          seriesKey = {
            PK: result.Items[0].PK,
            SK: 'METADATA'
          };
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
              seriesKey = {
                PK: `SERIES#${seriesId}`,
                SK: 'METADATA'
              };
              console.log('Found series by creator and channelName:', { creatorEmail, channelName });
            }
          }
        }
      } catch (error) {
        console.error('Error querying by creator and channelName:', error);
      }
    }

    if (!seriesRecord || !seriesKey) {
      return {
        success: false,
        message: 'Series not found. Please ensure the channel exists and you have permission to update it.'
      };
    }

    // Update the series description
    try {
      const updateParams = {
        TableName: table,
        Key: seriesKey,
        UpdateExpression: 'SET description = :description, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':description': newDescription.trim(),
          ':updatedAt': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      };

      const updateResult = await dynamodb.update(updateParams).promise();
      
      console.log('Successfully updated channel description:', updateResult.Attributes);

      return {
        success: true,
        message: 'Channel description updated successfully',
        description: newDescription.trim(),
        updatedAt: updateResult.Attributes.updatedAt
      };

    } catch (updateError) {
      console.error('Error updating channel description:', updateError);
      return {
        success: false,
        message: 'Failed to update channel description',
        error: updateError.message
      };
    }

  } catch (error) {
    console.error('Error updating channel description:', error);
    return {
      success: false,
      message: 'Failed to update channel description',
      error: error.message
    };
  }
});
