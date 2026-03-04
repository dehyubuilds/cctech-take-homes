import AWS from 'aws-sdk';
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    console.log('Approving collaboration:', body);

    const { ownerEmail, collaboratorEmail, folderName } = body;

    // Update collaboration status to active
    const params = {
      TableName: 'Twilly',
      Key: {
        PK: `USER#${ownerEmail}`,
        SK: `COLLAB#${collaboratorEmail}#${folderName}`
      },
      UpdateExpression: 'SET #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'active'
      }
    };

    await dynamodb.update(params).promise();
    return { success: true };

  } catch (error) {
    console.error('Failed to approve collaboration:', error);
    throw createError({
      statusCode: 500,
      message: error.message
    });
  }
}); 