import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const lambda = new AWS.Lambda();
  
  try {
    const body = await readBody(event);
    const { userId, username, email } = body;

    if (!userId || !email) {
      return {
        success: false,
        message: 'Missing required fields: userId, email'
      };
    }

    console.log('Calling Stripe Connect Lambda for:', { userId, username, email });

    // Call the Lambda function
    const lambdaParams = {
      FunctionName: 'stripe-create-connect-account',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        body: JSON.stringify({
          userId,
          username,
          email
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
          accountId: lambdaBody.accountId,
          status: lambdaBody.status,
          onboardingUrl: lambdaBody.onboardingUrl,
          dashboardUrl: lambdaBody.dashboardUrl
        };
      } else {
        console.error('Lambda returned error:', responseBody);
        return {
          success: false,
          message: 'Failed to create Stripe Connect account'
        };
      }
    } else {
      console.error('Lambda invocation failed:', lambdaResponse);
      return {
        success: false,
        message: 'Failed to create Stripe Connect account'
      };
    }

  } catch (error) {
    console.error('Error calling Stripe Connect Lambda:', error);
    return {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
  }
}); 