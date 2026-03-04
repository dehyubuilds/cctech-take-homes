import AWS from "aws-sdk";

// Initialize the AWS SDK with your credentials and region
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '81v8RfOXhFHoKvOyD5t4I8kIeaVq9ad9TSAnp7eI',
  region: 'us-east-1',
});

// Create an instance of the Lambda class
const lambda = new AWS.Lambda();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    // { phoneNumber: '555-555-5555', verificationCode: '6757' }  
    const params = {
      FunctionName: 'twillycode-VerifyAuthChallengeResponse-ox3wxhSKr0gH',
      Payload: JSON.stringify({
        request: {
          session: [
            {
              challengeName: "SRP_A"
            }
          ],
          userAttributes: {
            phone_number: body.phoneNumber,
            verification_code: body.verificationCode
          }
        }
      }),
    };

    // Invoke the Lambda function
    const result = await lambda.invoke(params).promise();
    const resultPayload = JSON.parse(result.Payload);

    const statusCode = resultPayload?.response?.statusCode;
    return statusCode;
  } catch (error) {
    console.error('Error:', error);
  }
});
