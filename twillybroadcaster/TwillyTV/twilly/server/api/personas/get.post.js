import AWS from 'aws-sdk';

// Configure AWS SDK
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userId, userEmail } = body;

    if (!userId || !userEmail) {
      return {
        success: false,
        message: 'Missing required fields: userId and userEmail'
      };
    }

    // Check if user is master account
    const MASTER_EMAILS = ['dehyu.sinyan@gmail.com'];
    const MASTER_USERNAMES = ['DehSin365'];
    
    // Get username from DynamoDB
    let username = '';
    try {
      const userResult = await dynamodb.get({
        TableName: 'Twilly',
        Key: {
          PK: `USER#${userEmail}`,
          SK: 'PROFILE'
        }
      }).promise();
      
      if (userResult.Item) {
        username = userResult.Item.username || '';
      }
    } catch (error) {
      console.error('Error fetching username:', error);
    }

    const isMaster = MASTER_EMAILS.includes(userEmail) || MASTER_USERNAMES.includes(username);

    // Initialize persona data
    const personas = {
      master: isMaster,
      viewer: true, // Everyone is a viewer by default
      affiliate: false,
      creator: false
    };

    const personaData = {
      master: isMaster ? { activatedAt: new Date().toISOString() } : null,
      viewer: { activatedAt: new Date().toISOString() },
      affiliate: null,
      creator: null
    };

    let affiliateCode = null;
    let commissionRate = 0.1;
    let activeChannel = null;
    let availableChannels = [];

    // Check for affiliate persona
    try {
      const affiliateResult = await dynamodb.query({
        TableName: 'Twilly',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userEmail}`,
          ':sk': 'AFFILIATE#'
        }
      }).promise();

      if (affiliateResult.Items && affiliateResult.Items.length > 0) {
        const affiliateData = affiliateResult.Items[0];
        personas.affiliate = true;
        personaData.affiliate = affiliateData;
        affiliateCode = affiliateData.affiliateCode;
        commissionRate = affiliateData.commissionRate || 0.1;
      }
    } catch (error) {
      console.error('Error checking affiliate persona:', error);
    }

    // Check for creator persona
    try {
      console.log('🔍 Looking for creator personas with PK:', `USER#${userId}`);
      const creatorResult = await dynamodb.query({
        TableName: 'Twilly',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'COLLABORATOR_ROLE#'
        }
      }).promise();
      
      console.log('🔍 Creator persona query result:', creatorResult.Items);

      if (creatorResult.Items && creatorResult.Items.length > 0) {
        personas.creator = true;
        personaData.creator = creatorResult.Items;
        availableChannels = creatorResult.Items.map(item => ({
          channelName: item.channelName,
          channelId: item.channelId,
          streamKey: item.streamKey,
          joinedAt: item.joinedAt,
          status: item.status
        }));
        
        console.log('🔍 Available channels found:', availableChannels);
        
        // Set active channel to first available channel (will be sorted later)
        if (availableChannels.length > 0) {
          activeChannel = availableChannels[0].channelName;
          console.log('🔍 Active channel set to:', activeChannel);
        }
      }
    } catch (error) {
      console.error('Error checking creator persona:', error);
    }

    // If user has both affiliate and creator personas, ensure affiliate also gets access to channels
    if (personas.affiliate && personas.creator && availableChannels.length > 0) {
      console.log('🔍 User has both affiliate and creator personas, channels available for affiliate invites');
    }

    // Sort channels for ALL personas (not just creator) - Twilly TV first
    if (availableChannels.length > 0) {
      const sortedChannels = availableChannels.sort((a, b) => {
        // Twilly TV should always come first
        if (a.channelName === 'Twilly TV') return -1;
        if (b.channelName === 'Twilly TV') return 1;
        
        // For other channels, sort alphabetically
        return a.channelName.localeCompare(b.channelName);
      });
      
      // Update availableChannels with sorted order
      availableChannels = sortedChannels;
      
      // Always set active channel to first sorted channel (Twilly TV) for consistency
      activeChannel = sortedChannels[0].channelName;
      console.log('🔍 Active channel set to first sorted channel:', activeChannel);
    }

    // Get current active persona from user preferences
    let activePersona = 'viewer';
    try {
      const prefsResult = await dynamodb.get({
        TableName: 'Twilly',
        Key: {
          PK: `USER#${userEmail}`,
          SK: 'PERSONA_PREFS'
        }
      }).promise();

      if (prefsResult.Item && prefsResult.Item.activePersona) {
        activePersona = prefsResult.Item.activePersona;
        activeChannel = prefsResult.Item.activeChannel || activeChannel;
      }
    } catch (error) {
      console.error('Error fetching persona preferences:', error);
    }

    return {
      success: true,
      personas,
      personaData,
      affiliateCode,
      commissionRate,
      activeChannel,
      availableChannels,
      activePersona
    };

  } catch (error) {
    console.error('Error getting persona data:', error);
    return {
      success: false,
      message: 'Failed to get persona data',
      error: error.message
    };
  }
});
