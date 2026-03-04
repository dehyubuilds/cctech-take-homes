import AWS from "aws-sdk";

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
  try {
    const applicationId = getRouterParam(event, 'applicationId');
    
    if (!applicationId) {
      return {
        success: false,
        message: 'Application ID is required'
      };
    }

    // Delete the application record
    const deleteParams = {
      TableName: 'Twilly',
      Key: {
        PK: 'COLLABORATION#APPLICATIONS',
        SK: applicationId
      }
    };

    await dynamodb.delete(deleteParams).promise();
    
    // Also delete the reverse lookup record if it exists
    try {
      const reverseDeleteParams = {
        TableName: 'Twilly',
        Key: {
          PK: 'COLLABORATION#REVERSE',
          SK: `${applicationId}#*`
        }
      };
      
      // Query to find the exact reverse lookup record
      const reverseQueryParams = {
        TableName: 'Twilly',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': 'COLLABORATION#REVERSE',
          ':sk': applicationId
        }
      };
      
      const reverseResult = await dynamodb.query(reverseQueryParams).promise();
      
      if (reverseResult.Items && reverseResult.Items.length > 0) {
        for (const item of reverseResult.Items) {
          await dynamodb.delete({
            TableName: 'Twilly',
            Key: {
              PK: item.PK,
              SK: item.SK
            }
          }).promise();
        }
      }
    } catch (reverseError) {
      // Ignore errors when deleting reverse lookup records
      console.log('Note: Could not delete reverse lookup records:', reverseError.message);
    }
    
    console.log('✅ [homepage-qr-delete] Application deleted:', applicationId);
    
    return {
      success: true,
      message: 'Application deleted successfully'
    };

  } catch (error) {
    console.error('❌ [homepage-qr-delete] Error deleting application:', error);
    
    return {
      success: false,
      message: 'Failed to delete application',
      error: error.message
    };
  }
});
