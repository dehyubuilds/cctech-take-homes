import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const table = 'Twilly';

  try {
    const body = await readBody(event);
    const { inviteCode, userId, userEmail } = body;

    console.log('Casting Director accept invite request:', { inviteCode, userId, userEmail });

    // Validate required fields
    if (!inviteCode || !userId || !userEmail) {
      return {
        success: false,
        message: 'Missing required fields: inviteCode, userId, userEmail'
      };
    }

    // First, look up the invite record
    let inviteRecord;
    try {
      const inviteResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: 'CASTING_DIRECTOR_INVITE',
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

    const { channelName, channelOwnerId, commissionRate = 0.15 } = inviteRecord;

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

    // Generate a unique referral code for the casting director that maps to the channel
    // Use a shorter, more readable format (similar to stream key pattern)
    const referralCode = `cd_${Math.random().toString(36).substring(2, 10)}_${channelName}`;
    const referralLink = `https://twilly.app/casting/${referralCode}`;
    
    // Create casting director record (following collaborator pattern)
    const castingDirectorRecord = {
      PK: `CHANNEL#${channelName}`,
      SK: `CASTING_DIRECTOR#${userId}`,
      channelId: channelName, // Using channelName as channelId for consistency
      channelName: channelName,
      userId: userId,
      userEmail: userEmail,
      referralCode: referralCode,
      referralLink: referralLink,
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: 'casting_director',
      commissionRate: commissionRate,
      hasPayoutSetup: hasPayoutSetup,
      payoutSetupRequired: !hasPayoutSetup
    };

    // Create user's casting director record (following collaborator pattern)
    const userCastingDirectorRecord = {
      PK: `USER#${userId}`,
      SK: `CASTING_DIRECTOR_ROLE#${channelName}`,
      channelId: channelName, // Using channelName as channelId for consistency
      channelName: channelName,
      referralCode: referralCode,
      referralLink: referralLink,
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: 'casting_director',
      commissionRate: commissionRate,
      hasPayoutSetup: hasPayoutSetup,
      payoutSetupRequired: !hasPayoutSetup
    };

    // Check if casting director already exists for this channel
    try {
      const existingQuery = await dynamodb.query({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `CHANNEL#${channelName}`,
          ':sk': `CASTING_DIRECTOR#${userId}`
        }
      }).promise();

      if (existingQuery.Items && existingQuery.Items.length > 0) {
        // Casting director already exists, update payout status and return info
        const existingCastingDirector = existingQuery.Items[0];
        
        // Update the existing casting director record with current payout status
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: `CHANNEL#${channelName}`,
            SK: `CASTING_DIRECTOR#${userId}`
          },
          UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
          ExpressionAttributeValues: {
            ':hasPayoutSetup': hasPayoutSetup,
            ':payoutSetupRequired': !hasPayoutSetup
          }
        }).promise();

        // Also update the user's casting director record
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: `USER#${userId}`,
            SK: `CASTING_DIRECTOR_ROLE#${channelName}`
          },
          UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
          ExpressionAttributeValues: {
            ':hasPayoutSetup': hasPayoutSetup,
            ':payoutSetupRequired': !hasPayoutSetup
          }
        }).promise();

        console.log('Casting director already exists, updated payout status:', { channelName, userId, hasPayoutSetup });

        return {
          success: true,
          message: hasPayoutSetup ? 'Successfully joined as casting director' : 'Successfully joined as casting director. Set up your payout account to get your referral link.',
          referralCode: existingCastingDirector.referralCode,
          referralLink: hasPayoutSetup ? existingCastingDirector.referralLink : null,
          hasPayoutSetup: hasPayoutSetup,
          payoutSetupRequired: !hasPayoutSetup,
          castingDirector: {
            channelId: channelName,
            channelName: channelName,
            referralCode: existingCastingDirector.referralCode,
            referralLink: hasPayoutSetup ? existingCastingDirector.referralLink : null,
            joinedAt: existingCastingDirector.joinedAt,
            commissionRate: existingCastingDirector.commissionRate || commissionRate,
            hasPayoutSetup: hasPayoutSetup,
            payoutSetupRequired: !hasPayoutSetup
          }
        };
      }
    } catch (error) {
      console.error('Error checking existing casting director:', error);
    }

    // Add casting director records
    try {
      await dynamodb.put({
        TableName: table,
        Item: castingDirectorRecord
      }).promise();

      await dynamodb.put({
        TableName: table,
        Item: userCastingDirectorRecord
      }).promise();

      // Create referral link mapping for tracking (similar to stream key mapping)
      await dynamodb.put({
        TableName: table,
        Item: {
          PK: `REFERRAL_LINK#${referralCode}`,
          SK: 'MAPPING',
          referralCode: referralCode,
          referralLink: referralLink,
          castingDirectorEmail: userEmail,
          channelId: channelName,
          channelName: channelName,
          isActive: true,
          isCastingDirectorLink: true,
          createdAt: new Date().toISOString(),
          status: 'ACTIVE'
        }
      }).promise();

      // Mark the invite as used (optional, but good practice)
      await dynamodb.update({
        TableName: table,
        Key: {
          PK: 'CASTING_DIRECTOR_INVITE',
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

      console.log('Casting director created successfully:', { channelName, userId, referralCode, hasPayoutSetup });

      return {
        success: true,
        message: hasPayoutSetup ? 'Successfully joined as casting director!' : 'Successfully joined as casting director! Set up your payout account to get your referral link.',
        referralCode: referralCode,
        referralLink: hasPayoutSetup ? referralLink : null,
        hasPayoutSetup: hasPayoutSetup,
        payoutSetupRequired: !hasPayoutSetup,
        castingDirector: {
          channelId: channelName,
          channelName: channelName,
          referralCode: referralCode,
          referralLink: hasPayoutSetup ? referralLink : null,
          joinedAt: castingDirectorRecord.joinedAt,
          commissionRate: commissionRate,
          hasPayoutSetup: hasPayoutSetup,
          payoutSetupRequired: !hasPayoutSetup
        }
      };

    } catch (error) {
      console.error('Error creating casting director:', error);
      return {
        success: false,
        message: 'Failed to create casting director record'
      };
    }

  } catch (error) {
    console.error('Error in casting director accept invite:', error);
    return {
      success: false,
      message: 'Failed to accept casting director invitation'
    };
  }
});
