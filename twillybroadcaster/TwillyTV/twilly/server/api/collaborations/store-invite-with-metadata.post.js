import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

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
    const { 
      channelName, 
      channelOwnerEmail, 
      channelOwnerId, 
      title, 
      description, 
      creator, 
      poster,
      expiresAt 
    } = body;

    console.log('Storing collaborator invite with metadata:', { 
      channelName, 
      channelOwnerEmail, 
      title, 
      description, 
      creator, 
      poster 
    });

    // Validate required fields
    if (!channelName || !channelOwnerEmail || !channelOwnerId) {
      return {
        success: false,
        message: 'Missing required fields: channelName, channelOwnerEmail, channelOwnerId'
      };
    }

    // Expire all old active invite codes for this channel first (rotation)
    // This works for any channel
    console.log(`🔄 Rotating invite codes for ${channelName} - expiring old active codes`);
    
    try {
      // Scan for all active invite codes for this channel
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

        // Expire all old active invite codes
      if (scanResult.Items && scanResult.Items.length > 0) {
        console.log(`📋 Found ${scanResult.Items.length} active invite codes to expire for ${channelName}`);
        
        const expirePromises = scanResult.Items.map(async (oldInvite) => {
          await dynamodb.update({
            TableName: table,
            Key: {
              PK: oldInvite.PK,
              SK: oldInvite.SK
            },
            UpdateExpression: 'SET #status = :expired, expiredAt = :expiredAt, rotatedAt = :rotatedAt',
            ExpressionAttributeNames: {
              '#status': 'status'
            },
            ExpressionAttributeValues: {
              ':expired': 'expired',
              ':expiredAt': new Date().toISOString(),
              ':rotatedAt': new Date().toISOString()
            }
          }).promise();
        });

        await Promise.all(expirePromises);
        console.log(`✅ Expired ${scanResult.Items.length} old invite codes for ${channelName}`);
      }
    } catch (error) {
      console.error('⚠️ Error expiring old invite codes (continuing anyway):', error);
      // Continue even if expiration fails - don't block new code generation
    }

    // Generate unique invite code
    const inviteCode = uuidv4();

    // Store the invite record with metadata
    const inviteRecord = {
      PK: 'INVITE',
      SK: inviteCode,
      channelName,
      channelOwnerEmail,
      channelOwnerId,
      title: title || channelName,
      description: description || `Join as a collaborator and stream on ${channelName}`,
      creator: creator || '',
      poster: poster || '',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days default
      status: 'active'
    };

    await dynamodb.put({
      TableName: table,
      Item: inviteRecord
    }).promise();

    console.log('Collaborator invite with metadata stored successfully:', inviteCode);

    return {
      success: true,
      message: 'Collaborator invite with metadata stored successfully',
      inviteCode,
      channelName,
      title: inviteRecord.title,
      description: inviteRecord.description,
      creator: inviteRecord.creator,
      poster: inviteRecord.poster
    };

  } catch (error) {
    console.error('Error storing collaborator invite with metadata:', error);
    return {
      success: false,
      message: 'Failed to store collaborator invite with metadata'
    };
  }
});
