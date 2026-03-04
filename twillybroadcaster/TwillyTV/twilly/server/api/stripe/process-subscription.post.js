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
    const { subscriptionId, channelId, amount, subscriberId } = body;

    if (!subscriptionId || !channelId || !amount || !subscriberId) {
      return {
        success: false,
        message: 'Missing required fields: subscriptionId, channelId, amount, subscriberId'
      };
    }

    console.log('Calling subscription payment Lambda for:', { subscriptionId, channelId, amount, subscriberId });

    // Call the Lambda function
    const lambdaParams = {
      FunctionName: 'stripe-subscription-payment',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        body: JSON.stringify({
          subscriptionId,
          channelId,
          amount,
          subscriberId
        })
      })
    };

    const lambdaResponse = await lambda.invoke(lambdaParams).promise();
    
    if (lambdaResponse.StatusCode === 200) {
      const responseBody = JSON.parse(lambdaResponse.Payload);
      console.log('Lambda response:', responseBody);
      
      return {
        success: responseBody.success,
        message: responseBody.message,
        subscriptionId: responseBody.subscriptionId,
        platformFee: responseBody.platformFee,
        ownerShare: responseBody.ownerShare,
        collaboratorShare: responseBody.collaboratorShare,
        ownerTransferId: responseBody.ownerTransferId,
        collaboratorTransfers: responseBody.collaboratorTransfers
      };
    } else {
      console.error('Lambda invocation failed:', lambdaResponse);
      return {
        success: false,
        message: 'Failed to process subscription payment'
      };
    }

  } catch (error) {
    console.error('Error calling subscription payment Lambda:', error);
    return {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
  }
}); 