import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    console.log('Verifying collaboration:', body);

    const { ownerEmail, collaboratorEmail, folderName } = body;

    const params = {
      TableName: 'Twilly',
      Key: {
        PK: `USER#${ownerEmail}`,
        SK: `COLLAB#${collaboratorEmail}#${folderName}`
      }
    };

    const result = await dynamodb.get(params).promise();
    console.log('Found collaboration:', result.Item);

    if (!result.Item) {
      return { isApproved: false, permissions: [] };
    }

    return {
      isApproved: result.Item.status === 'active',
      permissions: result.Item.permissions || []
    };

  } catch (error) {
    console.error('Failed to verify collaboration:', error);
    throw createError({
      statusCode: 500,
      message: error.message
    });
  }
}); 