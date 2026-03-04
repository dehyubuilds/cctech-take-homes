import AWS from "aws-sdk";


// Initialize the AWS SDK with your credentials and region

AWS.config.update({
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '81v8RfOXhFHoKvOyD5t4I8kIeaVq9ad9TSAnp7eI',
    region: 'us-east-2',
});


export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const payload = {
      body: JSON.stringify(body),
    };
    
    
      const params = {
        FunctionName: "writeMetaToTPC",
        Payload: JSON.stringify(payload), // Pass input data as JSON string
      };
      const lambda = new AWS.Lambda({ region: 'us-east-2' });
      try {
        const data = await lambda.invoke(params).promise();
        
        return { data }
      } catch (error) {
        console.error("Error in function:", error);
      }
});