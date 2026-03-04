import AWS from 'aws-sdk';

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
    const { channelOwner, sharedWith, permissions, expiresAt } = body;

    if (!channelOwner || !sharedWith || !permissions) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: channelOwner, sharedWith, permissions'
      });
    }

    // Generate temporary stream key for the guest streamer
    const tempStreamKey = `sk_temp_${generateRandomString(16)}`;

    // Create channel sharing record
    const sharingRecord = {
      PK: `CHANNEL_SHARE#${channelOwner}`,
      SK: `SHARED_WITH#${sharedWith}`,
      channelOwner: channelOwner,
      sharedWith: sharedWith,
      permissions: permissions, // ["stream", "monetize"]
      tempStreamKey: tempStreamKey,
      isActive: true,
      expiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days default
      createdAt: new Date().toISOString()
    };

    // Create temporary stream key mapping
    const tempStreamKeyMapping = {
      PK: `STREAM_KEY#${tempStreamKey}`,
      SK: 'MAPPING',
      channelOwner: channelOwner,
      guestStreamer: sharedWith,
      channelId: `channel_${channelOwner.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      isTemporary: true,
      expiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    };

    // Store both records
    await dynamodb.put({
      TableName: table,
      Item: sharingRecord
    }).promise();

    await dynamodb.put({
      TableName: table,
      Item: tempStreamKeyMapping
    }).promise();

    return {
      success: true,
      tempStreamKey: tempStreamKey,
      channelOwner: channelOwner,
      guestStreamer: sharedWith,
      permissions: permissions,
      expiresAt: sharingRecord.expiresAt,
      message: 'Channel access shared successfully'
    };

  } catch (error) {
    console.error('Error sharing channel access:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to share channel access'
    });
  }
});

function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
} 