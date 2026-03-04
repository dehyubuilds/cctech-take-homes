import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const lambda = new AWS.Lambda();

  try {
    const body = await readBody(event);
    const { userId } = body;

    if (!userId) {
      return {
        success: false,
        message: 'Missing required field: userId'
      };
    }

    console.log('Syncing Stripe Connect status for user:', userId);

    // Invoke the sync Lambda function
    const lambdaParams = {
      FunctionName: 'stripe-create-connect-account',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        body: JSON.stringify({
          userId: userId
        })
      })
    };

    const lambdaResponse = await lambda.invoke(lambdaParams).promise();
    console.log('Lambda response:', lambdaResponse);

    // Parse the Lambda response
    const responseData = JSON.parse(lambdaResponse.Payload);
    console.log('Parsed response:', responseData);

    if (responseData.statusCode === 200) {
      const result = JSON.parse(responseData.body);
      return {
        success: true,
        status: result.status,
        accountId: result.accountId,
        message: result.message
      };
    } else {
      const error = JSON.parse(responseData.body);
      return {
        success: false,
        message: error.message || 'Failed to sync status'
      };
    }

  } catch (error) {
    console.error('Error syncing Stripe Connect status:', error);
    return {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
  }
}); 