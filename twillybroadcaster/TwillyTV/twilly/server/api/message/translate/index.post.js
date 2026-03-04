import AWS from "aws-sdk";


// Initialize the AWS SDK with your credentials and region

AWS.config.update({
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '81v8RfOXhFHoKvOyD5t4I8kIeaVq9ad9TSAnp7eI',
    region: 'us-east-1',
});


export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    
    const payload = {
        body: JSON.stringify({ newTask: body.newTask, timezone: body.timezone}), // Include 'body' field with JSON data
      };
    
      const params = {
        FunctionName: "TwillyTranslate",
        Payload: JSON.stringify(payload), // Pass input data as JSON string
      };
      const lambda = new AWS.Lambda();
      try {
        const data = await lambda.invoke(params).promise();
        
        return { data }
        // Use async/await for Lambda invocation
        // const result = JSON.parse(data.Payload);
        // const responseAsObject = JSON.parse(result.body);
        // const timestamp = responseAsObject.parsed_date
        // const parsedTimestamp = new Date(timestamp);
        // const humanReadableFormat = parsedTimestamp.toLocaleString();
      } catch (error) {
        console.error("Error in function:", error);
      }


 
});