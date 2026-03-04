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

        const user = await readBody(event);

        // Log the values before using them

        // Define the parameters for the DynamoDB delete operation
        const params = {
            TableName: "Twilly", // Replace with your table name
            Key: {
                schedulerId: user.username,
                id: listingId,
            },
        };

        const data = await dynamodb.delete(params).promise();

        // Extract the relevant data from the response
        const listings = data.Items || [];

        return { listings };

    } catch (error) {
        console.error("Error deleting item from DynamoDB:", error);
        throw createError({
            statusCode: 500,
            statusMessage: "Internal Server Error",
        });
    }
});