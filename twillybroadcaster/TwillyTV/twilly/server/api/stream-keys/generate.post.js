import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials for deployment compatibility
  AWS.config.update({
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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',
    region: 'us-east-1'
  })

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const table = 'Twilly';

  try {
    const body = await readBody(event);
    const { userEmail, channelName, creatorId } = body;

    if (!userEmail || !channelName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: userEmail, channelName'
      });
    }

    // Generate unique stream key
    const streamKey = `sk_${generateRandomString(16)}`;
    
    // Create creator record if it doesn't exist
    const creatorRecord = {
      PK: `CREATOR#${creatorId || userEmail}`,
      SK: 'PROFILE',
      email: userEmail,
      channelName: channelName,
      streamKey: streamKey,
      isActive: true,
      stripeAccountId: null, // Will be set when creator sets up Stripe Connect
      revenueShare: 0.8, // 80% to creator
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Check if user already has a personal stream key for this channel
    const existingPersonalKeyQuery = {
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND ownerEmail = :userEmail AND seriesName = :channelName AND isCollaboratorKey <> :isCollaboratorKey',
      ExpressionAttributeValues: {
        ':pkPrefix': 'STREAM_KEY#',
        ':userEmail': userEmail,
        ':channelName': channelName,
        ':isCollaboratorKey': true
      }
    };
    
    console.log('Checking for existing personal key with params:', existingPersonalKeyQuery);
    
    const existingPersonalKeyResult = await dynamodb.scan(existingPersonalKeyQuery).promise();
    
    console.log('Found existing personal keys:', existingPersonalKeyResult.Items?.length || 0);
    
    // If user already has a personal key for this channel, return error
    if (existingPersonalKeyResult.Items && existingPersonalKeyResult.Items.length > 0) {
      const existingKey = existingPersonalKeyResult.Items[0];
      return {
        success: false,
        message: 'You already have a personal stream key for this channel. Each channel can only have one personal stream key.',
        existingStreamKey: existingKey.streamKey
      };
    }
    
    // Personal stream keys are always key #1
    const keyNumber = 1;
    console.log('Creating personal stream key #1 for channel:', channelName);

    // Create stream key mapping in old structure format for consistency
    const streamKeyMapping = {
      PK: `STREAM_KEY#${streamKey}`,
      SK: 'MAPPING',
      streamKey: streamKey,
      ownerEmail: userEmail,
      seriesName: channelName, // Use seriesName for old structure compatibility
      creatorId: creatorId || userEmail,
      channelId: `channel_${channelName.toLowerCase().replace(/\s+/g, '_')}`,
      isActive: true,
      isPersonalKey: true, // Mark as personal key
      isCollaboratorKey: false, // Explicitly mark as not collaborator key
      createdAt: new Date().toISOString(),
      keyNumber: keyNumber,
      status: 'ACTIVE'
    };

    // Store both records
    await dynamodb.put({
      TableName: table,
      Item: creatorRecord
    }).promise();

    await dynamodb.put({
      TableName: table,
      Item: streamKeyMapping
    }).promise();

    return {
      success: true,
      streamKey: streamKey,
      creatorId: creatorId || userEmail,
      message: 'Stream key generated successfully'
    };

  } catch (error) {
    console.error('Error generating stream key:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate stream key'
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