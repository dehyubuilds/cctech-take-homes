import AWS from 'aws-sdk';
import { defineEventHandler, readBody } from 'h3';
import { createError } from 'h3';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    console.log('API - Getting creator details:', body);

    const { userId } = body;

    if (!userId) {
      console.error('API - User ID is missing in request body');
      throw createError({
        statusCode: 400,
        message: 'User ID is required'
      });
    }

    // Configure AWS with hardcoded credentials for production compatibility
    AWS.config.update({
      region: 'us-east-1',
      accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
      secretAccessKey: '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'
    });

    const dynamoDb = new AWS.DynamoDB.DocumentClient();

    // First try to get the creator record
    const params = {
      TableName: 'Creators',
      Key: {
        userId: userId
      }
    };

    console.log('API - DynamoDB params:', params);

    let result;
    try {
      result = await dynamoDb.get(params).promise();
      console.log('API - DynamoDB get result:', result);
    } catch (dbError) {
      console.error('API - DynamoDB get error:', dbError);
      throw createError({
        statusCode: 500,
        message: 'Failed to query DynamoDB',
        details: dbError.message
      });
    }

    if (!result.Item) {
      console.log('API - Creator not found for userId:', userId);
      
      // Create a new creator record with basic info
      const createParams = {
        TableName: 'Creators',
        Item: {
          userId: userId,
          email: `${userId}@twilly.com`, // Temporary email format
          name: 'Creator',
          createdAt: new Date().toISOString(),
          totalEarnings: 0,
          pendingBalance: 0,
          payoutHistory: []
        }
      };

      console.log('API - Creating new creator record:', createParams);
      
      try {
        await dynamoDb.put(createParams).promise();
        console.log('API - Successfully created new creator record');
        return createParams.Item;
      } catch (createError) {
        console.error('API - Error creating creator record:', createError);
        throw createError({
          statusCode: 500,
          message: 'Failed to create creator record',
          details: createError.message
        });
      }
    }

    console.log('API - Creator found:', result.Item);
    return result.Item;
  } catch (error) {
    console.error('API - Unexpected error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
      details: error.details || error.stack
    });
  }
}); 