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
    console.log(body)
  
    
    const url = body.linkName;

    const params = {
      FunctionName: 's3twillyuploader',
      Payload: JSON.stringify({
        url: url
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
