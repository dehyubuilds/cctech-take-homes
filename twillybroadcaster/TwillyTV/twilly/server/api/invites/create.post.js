import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { channelOwner, channelId, channelName, expiresAt } = body;

    if (!channelOwner || !channelId || !channelName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: channelOwner, channelId, channelName'
      });
    }

    // Generate a unique invite code
    const inviteCode = uuidv4();

    // Store the invite record
    const inviteRecord = {
      PK: `INVITE#${inviteCode}`,
      SK: 'INVITE',
      channelOwner,
      channelId,
      channelName, // Store the display name
      inviteCode,
      status: 'pending',
      expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days default
      createdAt: new Date().toISOString()
    };

    await dynamodb.put({ TableName: table, Item: inviteRecord }).promise();

    return {
      success: true,
      inviteCode,
      invite: inviteRecord,
      message: 'Invite created successfully'
    };
  } catch (error) {
    console.error('Error creating invite:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create invite'
    });
  }
}); 