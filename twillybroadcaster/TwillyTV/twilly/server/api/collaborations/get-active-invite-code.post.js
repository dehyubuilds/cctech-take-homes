import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { channelName } = body;

    if (!channelName) {
      return {
        success: false,
        message: 'Missing required field: channelName',
        inviteCode: null
      };
    }

    console.log('🔍 Fetching active invite code for channel:', channelName);

    // Scan for the most recent active invite code for this channel
    const scanResult = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'PK = :pk AND channelName = :channelName AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':pk': 'INVITE',
        ':channelName': channelName,
        ':status': 'active'
      }
    }).promise();

    if (scanResult.Items && scanResult.Items.length > 0) {
      // Sort by createdAt (most recent first) and get the first one
      const sortedInvites = scanResult.Items.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA; // Most recent first
      });

      const activeInvite = sortedInvites[0];
      
      // Check if invite is expired by expiresAt date
      if (activeInvite.expiresAt && new Date(activeInvite.expiresAt) < new Date()) {
        console.log('⚠️ Active invite code found but it has expired');
        return {
          success: true,
          message: 'No active invite code found (expired)',
          inviteCode: null
        };
      }

      console.log('✅ Found active invite code:', activeInvite.SK);
      return {
        success: true,
        message: 'Active invite code found',
        inviteCode: activeInvite.SK,
        createdAt: activeInvite.createdAt,
        expiresAt: activeInvite.expiresAt
      };
    } else {
      console.log('ℹ️ No active invite code found for channel:', channelName);
      return {
        success: true,
        message: 'No active invite code found',
        inviteCode: null
      };
    }

  } catch (error) {
    console.error('Error fetching active invite code:', error);
    return {
      success: false,
      message: 'Failed to fetch active invite code',
      inviteCode: null
    };
  }
});
