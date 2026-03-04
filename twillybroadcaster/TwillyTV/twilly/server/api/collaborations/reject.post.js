import AWS from 'aws-sdk';
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    console.log('Rejecting collaboration:', body);

    const { ownerEmail, collaboratorEmail, folderName } = body;

    // Delete the collaboration record
    const params = {
      TableName: 'Twilly',
      Key: {
        PK: `USER#${ownerEmail}`,
        SK: `COLLAB#${collaboratorEmail}#${folderName}`
      }
    };

    await dynamodb.delete(params).promise();
    return { success: true };

  } catch (error) {
    console.error('Failed to reject collaboration:', error);
    throw createError({
      statusCode: 500,
      message: error.message
    });
  }
}); 