import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { userId } = query;

    AWS.config.update({
      accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
      secretAccessKey: '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',
      region: 'us-east-1'
    });

    const dynamodb = new AWS.DynamoDB.DocumentClient();

    // Get collaborations where user is producer
    const producerParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'COLLAB#'
      }
    };

    // Get collaborations where user is collaborator
    const collaboratorParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'COLLABACCESS#'
      }
    };

    const [producerResults, collaboratorResults] = await Promise.all([
      dynamodb.query(producerParams).promise(),
      dynamodb.query(collaboratorParams).promise()
    ]);

    return {
      asProducer: producerResults.Items || [],
      asCollaborator: collaboratorResults.Items || []
    };
  } catch (error) {
    console.error('Error listing collaborations:', error);
    throw createError({
      statusCode: 500,
      message: error.message
    });
  }
}); 