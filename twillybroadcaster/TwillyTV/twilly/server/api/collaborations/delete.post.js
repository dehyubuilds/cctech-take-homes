import AWS from 'aws-sdk';
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const { ownerEmail, collaboratorEmail, folderName } = await readBody(event);

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
    console.error('Failed to delete collaboration:', error);
    throw createError({
      statusCode: 500,
      message: error.message
    });
  }
}); 