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
    // Specify the Lambda function name and payload
    const params = {
      FunctionName: 'twillycode-CreateAuthChallenge-uc8VZmbqXtqA',
      Payload: JSON.stringify({
        request: {
          session: [
            {
              challengeName: "SRP_A"
            }
          ],
          userAttributes: {
            phone_number: body
          }
        }
      }),
    };

    // Invoke the Lambda function
    const result = await lambda.invoke(params).promise();

    // Handle the result

  } catch (error) {
    console.error('Error:', error);
  }
});
