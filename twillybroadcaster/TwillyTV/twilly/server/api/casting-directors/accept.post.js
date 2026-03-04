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
    const { channelId, channelName, userId, userEmail } = body;

    console.log('Casting Director accept request:', { channelId, channelName, userId, userEmail });

    // Validate required fields
    if (!channelId || !channelName || !userId || !userEmail) {
      return {
        success: false,
        message: 'Missing required fields: channelId, channelName, userId, userEmail'
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

    // Generate a unique referral code for the casting director that maps to the channel
    // Use a shorter, more readable format (similar to stream key pattern)
    const referralCode = `cd_${Math.random().toString(36).substring(2, 10)}_${channelId}`;
    const referralLink = `https://twilly.app/casting/${referralCode}`;
    
    // Create casting director record (following collaborator pattern)
    const castingDirectorRecord = {
      PK: `CHANNEL#${channelId}`,
      SK: `CASTING_DIRECTOR#${userId}`,
      channelId: channelId,
      channelName: channelName,
      userId: userId,
      userEmail: userEmail,
      referralCode: referralCode,
      referralLink: referralLink,
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: 'casting_director',
      hasPayoutSetup: hasPayoutSetup,
      payoutSetupRequired: !hasPayoutSetup
    };

    // Create user's casting director record (following collaborator pattern)
    const userCastingDirectorRecord = {
      PK: `USER#${userId}`,
      SK: `CASTING_DIRECTOR_ROLE#${channelId}`,
      channelId: channelId,
      channelName: channelName,
      referralCode: referralCode,
      referralLink: referralLink,
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: 'casting_director',
      hasPayoutSetup: hasPayoutSetup,
      payoutSetupRequired: !hasPayoutSetup
    };

    // Check if casting director already exists
    try {
      const existingQuery = await dynamodb.query({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `CHANNEL#${channelId}`,
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
            PK: `CHANNEL#${channelId}`,
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
            SK: `CASTING_DIRECTOR_ROLE#${channelId}`
          },
          UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
          ExpressionAttributeValues: {
            ':hasPayoutSetup': hasPayoutSetup,
            ':payoutSetupRequired': !hasPayoutSetup
          }
        }).promise();

        console.log('Casting director already exists, updated payout status:', { channelId, userId, hasPayoutSetup });

        return {
          success: true,
          message: hasPayoutSetup ? 'Successfully joined as casting director' : 'Successfully joined as casting director. Set up your payout account to get your referral link.',
          referralCode: existingCastingDirector.referralCode,
          referralLink: hasPayoutSetup ? existingCastingDirector.referralLink : null,
          hasPayoutSetup: hasPayoutSetup,
          payoutSetupRequired: !hasPayoutSetup,
          castingDirector: {
            channelId: channelId,
            channelName: channelName,
            referralCode: existingCastingDirector.referralCode,
            referralLink: hasPayoutSetup ? existingCastingDirector.referralLink : null,
            joinedAt: existingCastingDirector.joinedAt,
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
          channelId: channelId,
          channelName: channelName,
          isActive: true,
          isCastingDirectorLink: true,
          createdAt: new Date().toISOString(),
          status: 'ACTIVE'
        }
      }).promise();

      console.log('Casting director created successfully:', { channelId, userId, referralCode, hasPayoutSetup });

      return {
        success: true,
        message: hasPayoutSetup ? 'Successfully joined as casting director' : 'Successfully joined as casting director. Set up your payout account to get your referral link.',
        referralCode: referralCode,
        referralLink: hasPayoutSetup ? referralLink : null,
        hasPayoutSetup: hasPayoutSetup,
        payoutSetupRequired: !hasPayoutSetup,
        castingDirector: {
          channelId: channelId,
          channelName: channelName,
          referralCode: referralCode,
          referralLink: hasPayoutSetup ? referralLink : null,
          joinedAt: castingDirectorRecord.joinedAt,
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
    console.error('Error in casting director accept:', error);
    return {
      success: false,
      message: 'Failed to accept casting director invitation'
    };
  }
});
