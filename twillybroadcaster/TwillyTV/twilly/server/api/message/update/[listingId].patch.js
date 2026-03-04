import AWS from "aws-sdk";

// Initialize the AWS SDK with your credentials and region
AWS.config.update({
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '81v8RfOXhFHoKvOyD5t4I8kIeaVq9ad9TSAnp7eI',
    region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
    try {
        const { listingId } = event.context.params;
        
        // Use readBody to parse the request body
        const user = await readBody(event);
        const userObj = { username: user.username, isFav: user.isFav };
        const userJson = JSON.stringify(userObj);
        const { username, isFav } = JSON.parse(userJson);
        

        // Define the parameters for the DynamoDB update operation (PATCH)
        const params = {
            TableName: "Twilly", // Replace with your table name
            Key: {
                schedulerId: username, // Use the username from the request body
                id: listingId,
            },
            UpdateExpression: 'SET isFav = :isFav', // Specify the attribute to update
            ExpressionAttributeValues: {
                ':isFav': isFav, // Set the new value for the 'isFav' attribute
            },
            ReturnValues: 'ALL_NEW', // Retrieve the updated item
        };

        const data = await dynamodb.update(params).promise();

        // Extract the updated item from the response
        const updatedItem = data.Attributes;

        return { updatedItem };
    } catch (error) {
        console.error("Error updating item in DynamoDB:", error);
        throw createError({
            statusCode: 500,
            statusMessage: "Internal Server Error",
        });
    }
});
