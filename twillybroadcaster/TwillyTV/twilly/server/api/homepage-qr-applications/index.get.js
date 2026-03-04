import AWS from "aws-sdk";

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
  try {
    // Query for all homepage QR applications
    const params = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'COLLABORATION#APPLICATIONS'
      }
    };

    const result = await dynamodb.query(params).promise();
    
    if (result.Items && result.Items.length > 0) {
      // Filter for applications from homepage QR code
      const applications = result.Items.filter(item => 
        item.source === 'homepage-qr' || !item.source // Include legacy items without source
      );
      
      console.log('✅ [homepage-qr-applications] Retrieved applications:', applications.length);
      
      return {
        success: true,
        applications: applications.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      };
    } else {
      return {
        success: true,
        applications: []
      };
    }

  } catch (error) {
    console.error('❌ [homepage-qr-applications] Error retrieving applications:', error);
    
    return {
      success: false,
      message: 'Failed to retrieve applications',
      error: error.message
    };
  }
});
