import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  try {
    const shortId = event.context.params.id;

    if (!shortId) {
      throw createError({
        statusCode: 400,
        message: 'Short ID is required'
      });
    }

    // Configure AWS SDK
    AWS.config.update({
      region: 'us-east-1',
      accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
      secretAccessKey: '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'
    });

    const dynamoDb = new AWS.DynamoDB.DocumentClient({
      region: 'us-east-1'
    });

    // Get the original URL from DynamoDB
    const params = {
      TableName: 'Twilly',
      Key: {
        PK: 'SHORT_URL',
        SK: shortId
      }
    };

    const result = await dynamoDb.get(params).promise();

    if (!result.Item) {
      throw createError({
        statusCode: 404,
        message: 'Short URL not found'
      });
    }

    const { longUrl, expiresAt } = result.Item;

    // Check if the URL has expired
    if (expiresAt && new Date(expiresAt) < new Date()) {
      throw createError({
        statusCode: 410,
        message: 'Short URL has expired'
      });
    }

    // Redirect directly to the stored long URL for viewing
    return sendRedirect(event, longUrl, 302);
  } catch (error) {
    console.error('Error redirecting:', error);
    
    // Handle specific AWS errors
    if (error.code === 'CredentialsError') {
      throw createError({
        statusCode: 500,
        message: 'AWS credentials error. Please check configuration.'
      });
    } else if (error.code === 'AccessDenied') {
      throw createError({
        statusCode: 403,
        message: 'Access denied. Please check AWS permissions.'
      });
    } else if (error.code === 'ResourceNotFoundException') {
      throw createError({
        statusCode: 404,
        message: 'DynamoDB table not found.'
      });
    }
    
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to redirect'
    });
  }
}); 