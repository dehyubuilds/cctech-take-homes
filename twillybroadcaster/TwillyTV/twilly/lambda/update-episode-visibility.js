const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

// Configure AWS SDK v3
const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  const { episodeId, userId, seriesName, airdate, immediate } = event;
  
  try {
    console.log('Updating episode visibility:', { episodeId, userId, seriesName, airdate, immediate });
    
    // Update the episode to make it visible and clear the airdate
    const updateParams = {
      TableName: 'Twilly',
      Key: {
        PK: `USER#${userId}`,
        SK: episodeId
      },
      UpdateExpression: 'SET isVisible = :isVisible, airdate = :airdate, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isVisible': true,
        ':airdate': airdate, // This will be null when canceling airdate
        ':updatedAt': new Date().toISOString()
      }
    };
    
    await dynamodb.send(new UpdateCommand(updateParams));
    
    console.log(`Episode ${episodeId} is now visible and airdate updated`);
    
    // 🎬 NEW: Create ledger entry for scheduled episode visibility
    try {
      console.log('📝 Creating ledger entry for scheduled episode visibility');
      
      // Get the updated episode data
      const getParams = {
        TableName: 'Twilly',
        Key: {
          PK: `USER#${userId}`,
          SK: episodeId
        }
      };
      
      const episodeResult = await dynamodb.send(new GetCommand(getParams));
      
      if (episodeResult.Item) {
        // Create ledger entry via API call
        const ledgerPayload = {
          episodeData: episodeResult.Item,
          triggeredBy: 'system-scheduled'
        };
        
        // Note: In a Lambda, we'd typically call the API endpoint
        // For now, we'll log that this should create a ledger entry
        console.log('📋 Should create ledger entry for scheduled episode:', {
          episodeId: episodeId,
          episodeTitle: episodeResult.Item.title,
          channelId: `${userId}-${seriesName}`,
          triggeredBy: 'system-scheduled'
        });
      }
    } catch (ledgerError) {
      console.error('❌ Error creating ledger entry for scheduled episode:', ledgerError);
      // Don't fail the visibility update if ledger creation fails
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Episode visibility updated successfully',
        episodeId,
        isVisible: true,
        immediate: immediate || false
      })
    };
  } catch (error) {
    console.error('Error updating episode visibility:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating episode visibility',
        error: error.message
      })
    };
  }
}; 