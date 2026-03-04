import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  
  try {
    const body = await readBody(event);
    const { userEmail, unitPrice } = body;

    if (!userEmail) {
      return {
        success: false,
        message: 'Missing required field: userEmail'
      };
    }

    if (unitPrice !== null && unitPrice !== undefined) {
      if (typeof unitPrice !== 'number' || unitPrice < 0) {
        return {
          success: false,
          message: 'unitPrice must be a non-negative number'
        };
      }
    }

    console.log(`💰 [set-premium-price] Setting unit price for ${userEmail} to $${unitPrice}`);

    // Store premium settings with unitPrice (per-item pricing)
    await dynamodb.put({
      TableName: 'Twilly',
      Item: {
        PK: `USER#${userEmail}`,
        SK: 'PREMIUM_SETTINGS',
        unitPrice: unitPrice || null,
        // Legacy support
        subscriptionPrice: unitPrice || null,
        updatedAt: new Date().toISOString()
      }
    }).promise();

    console.log(`✅ [set-premium-price] Unit price updated successfully`);

    return {
      success: true,
      message: 'Unit price updated successfully',
      unitPrice: unitPrice || null
    };

  } catch (error) {
    console.error('❌ [set-premium-price] Error:', error);
    return {
      success: false,
      message: 'Failed to set unit price',
      error: error.message
    };
  }
});
