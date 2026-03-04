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
    const { referralCode, talentEmail, talentRequestId, channelId } = body;

    console.log('Track referral request:', { referralCode, talentEmail, talentRequestId, channelId });

    // Validate required fields
    if (!referralCode || !talentEmail) {
      return {
        success: false,
        message: 'Missing required fields: referralCode, talentEmail'
      };
    }

    // Get referral link mapping to find casting director
    const referralResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `REFERRAL_LINK#${referralCode}`,
        SK: 'MAPPING'
      }
    }).promise();

    if (!referralResult.Item) {
      return {
        success: false,
        message: 'Invalid referral code'
      };
    }

    const referralMapping = referralResult.Item;
    const castingDirectorEmail = referralMapping.castingDirectorEmail;
    const mappedChannelId = referralMapping.channelId;

    console.log('Found referral mapping:', { castingDirectorEmail, channelId: mappedChannelId });

    // Create referral tracking record
    const referralTrackingRecord = {
      PK: `REFERRAL_TRACKING#${referralCode}`,
      SK: `TALENT#${talentEmail}`,
      referralCode: referralCode,
      castingDirectorEmail: castingDirectorEmail,
      talentEmail: talentEmail,
      channelId: mappedChannelId,
      talentRequestId: talentRequestId || null,
      referredAt: new Date().toISOString(),
      status: 'referred',
      channelName: referralMapping.channelName
    };

    // Create casting director referral record
    const castingDirectorReferralRecord = {
      PK: `CASTING_DIRECTOR_REFERRALS#${castingDirectorEmail}`,
      SK: `REFERRAL#${Date.now()}_${talentEmail}`,
      referralCode: referralCode,
      castingDirectorEmail: castingDirectorEmail,
      talentEmail: talentEmail,
      channelId: mappedChannelId,
      talentRequestId: talentRequestId || null,
      referredAt: new Date().toISOString(),
      status: 'referred',
      channelName: referralMapping.channelName
    };

    // Create talent referral record
    const talentReferralRecord = {
      PK: `TALENT_REFERRALS#${talentEmail}`,
      SK: `REFERRAL#${Date.now()}_${referralCode}`,
      referralCode: referralCode,
      castingDirectorEmail: castingDirectorEmail,
      talentEmail: talentEmail,
      channelId: mappedChannelId,
      talentRequestId: talentRequestId || null,
      referredAt: new Date().toISOString(),
      status: 'referred',
      channelName: referralMapping.channelName
    };

    // Store all referral records
    await Promise.all([
      dynamodb.put({
        TableName: table,
        Item: referralTrackingRecord
      }).promise(),
      dynamodb.put({
        TableName: table,
        Item: castingDirectorReferralRecord
      }).promise(),
      dynamodb.put({
        TableName: table,
        Item: talentReferralRecord
      }).promise()
    ]);

    console.log('Referral tracked successfully:', { referralCode, talentEmail, castingDirectorEmail });

    return {
      success: true,
      message: 'Referral tracked successfully',
      referralData: {
        referralCode: referralCode,
        castingDirectorEmail: castingDirectorEmail,
        talentEmail: talentEmail,
        channelId: mappedChannelId,
        channelName: referralMapping.channelName,
        referredAt: referralTrackingRecord.referredAt
      }
    };

  } catch (error) {
    console.error('Error tracking referral:', error);
    return {
      success: false,
      message: 'Failed to track referral'
    };
  }
});
