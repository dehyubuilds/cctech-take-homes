import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userId } = body;

    if (!userId) {
      return {
        success: false,
        message: "User ID is required"
      };
    }

    // Configure AWS SDK
    AWS.config.update({
      region: 'us-east-1',
      accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
      secretAccessKey: '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'
    });

    const dynamodb = new AWS.DynamoDB.DocumentClient();

    // Scan for active stream keys for this user
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'ownerEmail = :userId AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':status': 'ACTIVE'
      }
    };

    const result = await dynamodb.scan(scanParams).promise();
    const count = result.Items ? result.Items.length : 0;

    return {
      success: true,
      count: count
    };

  } catch (error) {
    console.error("Error counting stream keys:", error);
    return {
      success: false,
      message: "Error counting stream keys",
      error: error.message
    };
  }
}); 