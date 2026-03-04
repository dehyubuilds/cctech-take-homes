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

    // Update the application status to rejected
    const updateParams = {
      TableName: 'Twilly',
      Key: {
        PK: 'COLLABORATION#APPLICATIONS',
        SK: applicationId
      },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'rejected',
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(updateParams).promise();
    
    console.log('✅ [homepage-qr-reject] Application rejected:', applicationId);
    
    return {
      success: true,
      message: 'Application rejected successfully',
      application: result.Attributes
    };

  } catch (error) {
    console.error('❌ [homepage-qr-reject] Error rejecting application:', error);
    
    return {
      success: false,
      message: 'Failed to reject application',
      error: error.message
    };
  }
});
