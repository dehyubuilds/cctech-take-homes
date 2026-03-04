import AWS from "aws-sdk";

// Initialize the AWS SDK with your credentials and region
AWS.config.update({
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',  // Make sure to rotate and secure these credentials
    secretAccessKey: '81v8RfOXhFHoKvOyD5t4I8kIeaVq9ad9TSAnp7eI',
    region: 'us-east-2',
});

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        console.log("Request body:", body);

        const payload = {
            body: JSON.stringify({ 
                username: body.username, 
                url: body.url, 
                category: body.category, 
                sk: body.sk 
            }),
        };

        const params = {
            FunctionName: "RemoveMedia",  // Make sure this is the correct Lambda function name
            Payload: JSON.stringify(payload),
        };

        const lambda = new AWS.Lambda();
        
        // Log the params being sent to Lambda
        console.log("Invoking Lambda with params:", params);

        const data = await lambda.invoke(params).promise();

        // Log the full Lambda response for debugging
        console.log("Raw Lambda response:", data);

        // Parse the payload from Lambda's response (usually a JSON string)
        const payloadData = JSON.parse(data.Payload);
        console.log("Parsed payload from Lambda:", payloadData);

        // Check if the Lambda function returned a success status code
        if (payloadData.statusCode === 200) {
            console.log("Lambda succeeded, returning success:", payloadData.body);
            return {
                statusCode: 200,
                body: JSON.parse(payloadData.body)  // Parse the body to return as an object
            };
        } else {
            console.error("Lambda execution failed with status:", payloadData.statusCode);
            return {
                statusCode: 500,
                body: JSON.stringify({
                    message: "Function execution failed",
                    details: payloadData.body  // Include the actual response body from Lambda
                })
            };
        }
    } catch (error) {
        // Log the full error for debugging
        console.error("Error in invoking Lambda function:", error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Error occurred while invoking Lambda",
                error: error.message,  // Return the error message
            }),
        };
    }
});
