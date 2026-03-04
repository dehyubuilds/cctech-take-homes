import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid'

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { channelId, channelName, userId, userEmail } = body

    console.log('Collaboration accept request:', { channelId, channelName, userId, userEmail })

    // Validate required fields
    if (!channelId || !channelName || !userId || !userEmail) {
      return {
        success: false,
        message: 'Missing required fields: channelId, channelName, userId, userEmail'
      }
    }

    // ✅ Check payout setup status (but don't block the invite acceptance)
    let hasPayoutSetup = false;
    try {
      // Try to find Stripe Connect record using email (since that's how it's stored)
      console.log('Looking for Stripe Connect record with PK:', `USER#${userEmail}`);
      const stripeResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `USER#${userEmail}`,
          SK: 'STRIPE_CONNECT'
        }
      }).promise();

      console.log('Stripe result:', stripeResult);
      hasPayoutSetup = stripeResult.Item && (stripeResult.Item.isActive || stripeResult.Item.status === 'connected');
      console.log('Payout setup status for user email:', userEmail, 'hasPayoutSetup:', hasPayoutSetup);
    } catch (error) {
      console.error('Error checking Stripe Connect status:', error);
      hasPayoutSetup = false;
    }

    // Generate a unique stream key for the collaborator that maps to the channel
    // Use the same format as personal keys for consistency
    const streamKey = `sk_${generateRandomString(16)}`
    
    // Create collaboration record
    const collaborationRecord = {
      PK: `CHANNEL#${channelId}`,
      SK: `COLLABORATOR#${userId}`,
      channelId: channelId,
      channelName: channelName,
      userId: userId,
      userEmail: userEmail,
      streamKey: streamKey,
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: 'collaborator',
      hasPayoutSetup: hasPayoutSetup, // Track payout status
      payoutSetupRequired: !hasPayoutSetup // Flag for UI
    }

    // Create user's collaboration record
    const userCollaborationRecord = {
      PK: `USER#${userId}`,
      SK: `COLLABORATION#${channelId}`,
      channelId: channelId,
      channelName: channelName,
      streamKey: streamKey,
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: 'collaborator',
      hasPayoutSetup: hasPayoutSetup, // Track payout status
      payoutSetupRequired: !hasPayoutSetup // Flag for UI
    }

    // Check if collaboration already exists
    try {
      const existingQuery = await dynamodb.query({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `CHANNEL#${channelId}`,
          ':sk': `COLLABORATOR#${userId}`
        }
      }).promise()

      if (existingQuery.Items && existingQuery.Items.length > 0) {
        // Collaboration already exists, update payout status and return info
        const existingCollaboration = existingQuery.Items[0]
        
        // Update the existing collaboration record with current payout status
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: `CHANNEL#${channelId}`,
            SK: `COLLABORATOR#${userId}`
          },
          UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
          ExpressionAttributeValues: {
            ':hasPayoutSetup': hasPayoutSetup,
            ':payoutSetupRequired': !hasPayoutSetup
          }
        }).promise()

        // Also update the user's collaboration record
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: `USER#${userId}`,
            SK: `COLLABORATION#${channelId}`
          },
          UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
          ExpressionAttributeValues: {
            ':hasPayoutSetup': hasPayoutSetup,
            ':payoutSetupRequired': !hasPayoutSetup
          }
        }).promise()

        return {
          success: true,
          message: hasPayoutSetup ? 'Already a collaborator on this channel' : 'Already a collaborator on this channel. Set up your payout account to get your stream key.',
          streamKey: hasPayoutSetup ? existingCollaboration.streamKey : null,
          isExisting: true,
          hasPayoutSetup: hasPayoutSetup,
          payoutSetupRequired: !hasPayoutSetup,
          collaboration: {
            channelId: channelId,
            channelName: channelName,
            streamKey: hasPayoutSetup ? existingCollaboration.streamKey : null,
            joinedAt: existingCollaboration.joinedAt,
            hasPayoutSetup: hasPayoutSetup,
            payoutSetupRequired: !hasPayoutSetup
          }
        }
      }
    } catch (error) {
      console.error('Error checking existing collaboration:', error)
    }

    // Add collaboration records
    try {
      await dynamodb.put({
        TableName: table,
        Item: collaborationRecord
      }).promise()

      await dynamodb.put({
        TableName: table,
        Item: userCollaborationRecord
      }).promise()

      // Create collaborator record (similar to creator record for personal keys)
      const collaboratorRecord = {
        PK: `COLLABORATOR#${userId}`,
        SK: 'PROFILE',
        email: userEmail,
        channelName: channelName,
        streamKey: streamKey,
        isActive: true,
        revenueShare: 0.7, // 70% to collaborator (adjust as needed)
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      // Create stream key mapping (matching personal key structure)
      const streamKeyMapping = {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING',
        streamKey: streamKey,
        ownerEmail: userEmail,
        seriesName: channelName, // Use seriesName for RTMP server compatibility
        creatorId: userId, // Use userId as creatorId for collaborators
        channelId: channelId,
        isActive: true,
        isPersonalKey: false, // Mark as not personal key
        isCollaboratorKey: true, // Mark as collaborator key
        createdAt: new Date().toISOString(),
        keyNumber: 1, // Collaborator keys are always #1
        status: 'ACTIVE'
      }

      // Store both records
      await dynamodb.put({
        TableName: table,
        Item: collaboratorRecord
      }).promise()

      await dynamodb.put({
        TableName: table,
        Item: streamKeyMapping
      }).promise()

      console.log('Collaboration created successfully:', { channelId, userId, streamKey, hasPayoutSetup })

      return {
        success: true,
        message: hasPayoutSetup ? 'Successfully joined as collaborator' : 'Successfully joined as collaborator. Set up your payout account to get your stream key.',
        streamKey: hasPayoutSetup ? streamKey : null, // Only provide key if payout setup complete
        hasPayoutSetup: hasPayoutSetup,
        payoutSetupRequired: !hasPayoutSetup,
        collaboration: {
          channelId: channelId,
          channelName: channelName,
          streamKey: hasPayoutSetup ? streamKey : null,
          joinedAt: collaborationRecord.joinedAt,
          hasPayoutSetup: hasPayoutSetup,
          payoutSetupRequired: !hasPayoutSetup
        }
      }

    } catch (error) {
      console.error('Error creating collaboration:', error)
      return {
        success: false,
        message: 'Failed to create collaboration record'
      }
    }

  } catch (error) {
    console.error('Error in collaboration accept:', error)
    return {
      success: false,
      message: 'Internal server error'
    }
  }
})

function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
} 