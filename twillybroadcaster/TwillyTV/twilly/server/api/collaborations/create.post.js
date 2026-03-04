import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { producerId, folderName, category, collaborators, settings } = body;

    AWS.config.update({
      accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
      secretAccessKey: '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',
      region: 'us-east-1'
    });

    const dynamodb = new AWS.DynamoDB.DocumentClient();
    const collaborationId = `COLLAB#${Date.now()}`;

    // Create main collaboration record
    const collaborationParams = {
      TableName: 'Twilly',
      Item: {
        PK: `USER#${producerId}`,
        SK: `COLLAB#${category}#${folderName}`,
        collaborationId,
        folderName,
        category,
        collaborators,
        settings,
        createdAt: new Date().toISOString(),
        status: 'ACTIVE'
      }
    };

    await dynamodb.put(collaborationParams).promise();

    // Create access records for collaborators
    const collaboratorPromises = collaborators.map(collab => {
      const accessParams = {
        TableName: 'Twilly',
        Item: {
          PK: `USER#${collab.email}`,
          SK: `COLLABACCESS#${collaborationId}`,
          producerId,
          folderName,
          category,
          permissions: collab.permissions,
          status: collab.status
        }
      };
      return dynamodb.put(accessParams).promise();
    });

    await Promise.all(collaboratorPromises);

    return { success: true, collaborationId };
  } catch (error) {
    console.error('Error creating collaboration:', error);
    throw createError({
      statusCode: 500,
      message: error.message
    });
  }
}); 