import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { streamKey, schedulerId, flvPath, uniquePrefix } = body;

    console.log('Thumbnail generation request:', {
      streamKey,
      schedulerId,
      flvPath,
      uniquePrefix
    });

    // Validate required parameters
    if (!streamKey || !schedulerId || !flvPath || !uniquePrefix) {
      throw createError({
        statusCode: 400,
        message: 'Missing required parameters: streamKey, schedulerId, flvPath, uniquePrefix'
      });
    }

    // Configure AWS Lambda
    const lambda = new AWS.Lambda({
      region: 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });

    // Prepare Lambda payload
    const lambdaPayload = {
      streamKey,
      schedulerId,
      flvPath,
      uniquePrefix
    };

    console.log('Invoking Lambda thumbnail generator with payload:', lambdaPayload);

    // Invoke Lambda function
    const lambdaResponse = await lambda.invoke({
      FunctionName: 'twilly-thumbnail-generator',
      InvocationType: 'Event', // Asynchronous
      Payload: JSON.stringify(lambdaPayload)
    }).promise();

    console.log('Lambda invocation response:', lambdaResponse);

    return {
      success: true,
      message: 'Thumbnail generation triggered successfully',
      requestId: lambdaResponse.ResponseMetadata?.RequestId
    };

  } catch (error) {
    console.error('Error triggering thumbnail generation:', error);
    
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to trigger thumbnail generation'
    });
  }
}); 