import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { 
      email, 
      username, 
      fullName, 
      phone, 
      socialMediaProfiles,
      marketingExperience,
      preferredChannels,
      paymentMethod,
      bankAccountInfo
    } = body;

    if (!email || !username || !fullName) {
      return {
        success: false,
        message: 'Missing required fields: email, username, and fullName are required'
      };
    }

    // Generate unique affiliate ID
    const affiliateId = `aff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Create affiliate record
    const affiliateRecord = {
      PK: `AFFILIATE#${affiliateId}`,
      SK: 'PROFILE',
      affiliateId,
      email,
      username,
      fullName,
      phone: phone || null,
      socialMediaProfiles: socialMediaProfiles || [],
      marketingExperience: marketingExperience || 'beginner',
      preferredChannels: preferredChannels || [],
      paymentMethod: paymentMethod || 'bank_transfer',
      bankAccountInfo: bankAccountInfo || null,
      status: 'pending', // pending, active, suspended, terminated
      commissionRate: 0.05, // 5% commission rate
      totalEarnings: 0,
      totalSignups: 0,
      activeSignups: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      verifiedAt: null,
      lastPayoutAt: null
    };

    // Store affiliate record
    await dynamodb.put({
      TableName: 'Twilly',
      Item: affiliateRecord
    }).promise();

    // Create reverse lookup for email
    await dynamodb.put({
      TableName: 'Twilly',
      Item: {
        PK: `AFFILIATE_EMAIL#${email}`,
        SK: 'REF',
        affiliateId,
        email,
        username,
        status: 'pending',
        createdAt: timestamp
      }
    }).promise();

    // Create reverse lookup for username
    await dynamodb.put({
      TableName: 'Twilly',
      Item: {
        PK: `AFFILIATE_USERNAME#${username}`,
        SK: 'REF',
        affiliateId,
        email,
        username,
        status: 'pending',
        createdAt: timestamp
      }
    }).promise();

    return {
      success: true,
      message: 'Affiliate registration successful',
      affiliate: {
        affiliateId,
        email,
        username,
        fullName,
        status: 'pending',
        commissionRate: 0.05
      }
    };

  } catch (error) {
    console.error('Error registering affiliate:', error);
    return {
      success: false,
      message: 'Failed to register affiliate',
      error: error.message
    };
  }
});
