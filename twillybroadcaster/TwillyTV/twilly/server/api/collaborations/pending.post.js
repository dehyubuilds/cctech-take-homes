import AWS from 'aws-sdk';
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    console.log('Fetching pending collaborations for:', body);

    const { ownerEmail, folderName, category } = body;

    const params = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':pk': `USER#${ownerEmail}`,
        ':sk': 'COLLAB#',
        ':status': 'pending'
      }
    };

    console.log('DynamoDB query params:', params);
    const result = await dynamodb.query(params).promise();
    console.log('Found pending collaborations:', result.Items);

    return {
      collaborators: result.Items || []
    };
  } catch (error) {
    console.error('Error fetching pending collaborations:', error);
    throw createError({
      statusCode: 500,
      message: error.message
    });
  }
}); 