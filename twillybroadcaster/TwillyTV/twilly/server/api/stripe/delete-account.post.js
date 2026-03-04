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

    console.log('Deleting Stripe Connect account for user:', userId);

    // Call the delete Lambda function
    const lambdaParams = {
      FunctionName: 'delete-stripe-account',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        body: JSON.stringify({
          userId: userId
        })
      })
    };

    const lambdaResponse = await lambda.invoke(lambdaParams).promise();
    
    if (lambdaResponse.StatusCode === 200) {
      const responseBody = JSON.parse(lambdaResponse.Payload);
      console.log('Lambda response:', responseBody);
      
      // Check if the Lambda returned a successful response
      if (responseBody.statusCode === 200) {
        const lambdaBody = JSON.parse(responseBody.body);
        return {
          success: lambdaBody.success,
          message: lambdaBody.message,
          accountId: lambdaBody.accountId
        };
      } else {
        console.error('Lambda returned error:', responseBody);
        const errorBody = JSON.parse(responseBody.body);
        return {
          success: false,
          message: errorBody.message || 'Failed to delete Stripe Connect account'
        };
      }
    } else {
      console.error('Lambda invocation failed:', lambdaResponse);
      return {
        success: false,
        message: 'Failed to delete Stripe Connect account'
      };
    }

  } catch (error) {
    console.error('Error calling delete Stripe Connect Lambda:', error);
    return {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
  }
}); 