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
    const { inviteCode, channelName, title, description, creator, poster, userId, userEmail } = body

    console.log('Collaborator accept invite request:', { inviteCode, channelName, title, description, creator, poster, userId, userEmail })

    // Validate required fields
    if (!inviteCode) {
      return {
        success: false,
        message: 'Missing required field: inviteCode'
      }
    }

    // First, look up the invite record
    let inviteRecord;
    try {
      const inviteResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: 'INVITE',
          SK: inviteCode
        }
      }).promise();

      if (!inviteResult.Item) {
        return {
          success: false,
          message: 'Invalid or expired invite code'
        };
      }

      inviteRecord = inviteResult.Item;

      // Check if invite is expired
      if (inviteRecord.status !== 'active' || new Date(inviteRecord.expiresAt) < new Date()) {
        return {
          success: false,
          message: 'This invite has expired or is no longer valid'
        };
      }

    } catch (error) {
      console.error('Error looking up invite:', error);
      return {
        success: false,
        message: 'Failed to validate invite code'
      };
    }

    const { channelName: inviteChannelName, channelOwnerId } = inviteRecord;
    
    // CRITICAL: Validate that invite code matches the channel
    // If channelName is provided in request, it MUST match the invite's channelName
    if (channelName && channelName !== inviteChannelName) {
      console.log(`❌ Invite code mismatch: invite is for "${inviteChannelName}" but request is for "${channelName}"`);
      return {
        success: false,
        message: `This invite code is for "${inviteChannelName}", not "${channelName}". Please use the correct invite code for this channel.`
      };
    }
    
    // Use channelName from invite record (it's the source of truth)
    const finalChannelName = inviteChannelName;

    // If userId and userEmail are not provided, this is likely an unauthenticated user
    // We'll return success but indicate they need to authenticate first
    if (!userId || !userEmail) {
      return {
        success: true,
        message: 'Please sign in to accept this collaborator invitation',
        requiresAuth: true,
        channelName: finalChannelName,
        title: title || inviteRecord.title,
        description: description || inviteRecord.description,
        creator: creator || inviteRecord.creator,
        poster: poster || inviteRecord.poster
      };
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

    // Generate a stream key for the collaborator
    const baseStreamKey = `${finalChannelName}_${Math.random().toString(36).substring(2, 10)}`;
    const streamKey = baseStreamKey.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Create collaborator record with the invite details
    const collaboratorRecord = {
      PK: `CHANNEL#${finalChannelName}`,
      SK: `COLLABORATOR#${userId}`,
      channelId: finalChannelName, // Using finalChannelName as channelId for consistency
      channelName: finalChannelName,
      userId: userId,
      userEmail: userEmail,
      streamKey: streamKey,
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: 'collaborator',
      hasPayoutSetup: hasPayoutSetup,
      payoutSetupRequired: !hasPayoutSetup,
      // Store metadata if provided
      ...(title && { title }),
      ...(description && { description }),
      ...(creator && { creator }),
      ...(poster && { poster })
    };

    // Create user's collaborator record
    const userCollaboratorRecord = {
      PK: `USER#${userId}`,
      SK: `COLLABORATOR_ROLE#${finalChannelName}`,
      channelId: finalChannelName, // Using finalChannelName as channelId for consistency
      channelName: finalChannelName,
      streamKey: streamKey,
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: 'collaborator',
      hasPayoutSetup: hasPayoutSetup,
      payoutSetupRequired: !hasPayoutSetup,
      // Track that this was added via invite code (for efficient filtering)
      addedViaInvite: true,
      inviteCode: inviteCode,
      // Store metadata if provided
      ...(title && { title }),
      ...(description && { description }),
      ...(creator && { creator }),
      ...(poster && { poster })
    };

    // Check if collaborator already exists for this channel
    try {
      const existingQuery = await dynamodb.query({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `CHANNEL#${finalChannelName}`,
          ':sk': `COLLABORATOR#${userId}`
        }
      }).promise();

      if (existingQuery.Items && existingQuery.Items.length > 0) {
        // Collaborator already exists, update payout status and return info
        const existingCollaborator = existingQuery.Items[0];
        
        // Update the existing collaborator record with current payout status
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: `CHANNEL#${finalChannelName}`,
            SK: `COLLABORATOR#${userId}`
          },
          UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
          ExpressionAttributeValues: {
            ':hasPayoutSetup': hasPayoutSetup,
            ':payoutSetupRequired': !hasPayoutSetup
          }
        }).promise();

        // Also update the user's collaborator record (ensure addedViaInvite is set)
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: `USER#${userId}`,
            SK: `COLLABORATOR_ROLE#${finalChannelName}`
          },
          UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired, addedViaInvite = :addedViaInvite, inviteCode = :inviteCode',
          ExpressionAttributeValues: {
            ':hasPayoutSetup': hasPayoutSetup,
            ':payoutSetupRequired': !hasPayoutSetup,
            ':addedViaInvite': true,
            ':inviteCode': inviteCode
          }
        }).promise();

        console.log('Collaborator already exists, updated payout status:', { channelName: finalChannelName, userId, hasPayoutSetup });

        return {
          success: true,
          message: hasPayoutSetup ? 'Welcome back! You\'re already a collaborator for this channel.' : 'Welcome back! Set up your payout account to start earning.',
          streamKey: existingCollaborator.streamKey,
          hasPayoutSetup: hasPayoutSetup,
          payoutSetupRequired: !hasPayoutSetup,
          collaborator: {
            channelId: finalChannelName,
            channelName: finalChannelName,
            streamKey: existingCollaborator.streamKey,
            joinedAt: existingCollaborator.joinedAt,
            hasPayoutSetup: hasPayoutSetup,
            payoutSetupRequired: !hasPayoutSetup
          }
        };
      }
    } catch (error) {
      console.error('Error checking existing collaborator:', error);
    }

    // Add collaborator records
    try {
      await dynamodb.put({
        TableName: table,
        Item: collaboratorRecord
      }).promise();

      await dynamodb.put({
        TableName: table,
        Item: userCollaboratorRecord
      }).promise();

      // Create stream key mapping for tracking
      // CRITICAL: Store both email AND userId for proper file lookup
      await dynamodb.put({
        TableName: table,
        Item: {
          PK: `STREAM_KEY#${streamKey}`,
          SK: 'MAPPING',
          streamKey: streamKey,
          collaboratorEmail: userEmail, // Email for file storage lookup
          creatorId: userId, // userId (UUID) for collaborator identification
          channelId: finalChannelName,
          channelName: finalChannelName,
          isActive: true,
          isCollaboratorKey: true,
          createdAt: new Date().toISOString(),
          status: 'ACTIVE'
        }
      }).promise();

      // Mark the invite as used (optional, but good practice)
      await dynamodb.update({
        TableName: table,
        Key: {
          PK: 'INVITE',
          SK: inviteCode
        },
        UpdateExpression: 'SET #status = :status, usedAt = :usedAt, usedBy = :usedBy',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'used',
          ':usedAt': new Date().toISOString(),
          ':usedBy': userEmail
        }
      }).promise();

      console.log('Collaborator created successfully:', { channelName: finalChannelName, userId, streamKey, hasPayoutSetup });

      return {
        success: true,
        message: hasPayoutSetup ? 'Successfully joined as collaborator!' : 'Successfully joined as collaborator! Set up your payout account to start earning.',
        streamKey: streamKey,
        hasPayoutSetup: hasPayoutSetup,
        payoutSetupRequired: !hasPayoutSetup,
        collaborator: {
          channelId: finalChannelName,
          channelName: finalChannelName,
          streamKey: streamKey,
          joinedAt: collaboratorRecord.joinedAt,
          hasPayoutSetup: hasPayoutSetup,
          payoutSetupRequired: !hasPayoutSetup
        }
      };

    } catch (error) {
      console.error('Error creating collaborator:', error);
      return {
        success: false,
        message: 'Failed to create collaborator record'
      };
    }

  } catch (error) {
    console.error('Error in collaborator accept invite:', error);
    return {
      success: false,
      message: 'Failed to accept collaborator invitation'
    };
  }
});
