import AWS from "aws-sdk";

export default defineEventHandler(async (event) => {
    try {
        const { schedulerId } = event.context.params;

        // Configure the AWS SDK with your credentials and region
        AWS.config.update({
            accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
            secretAccessKey: '81v8RfOXhFHoKvOyD5t4I8kIeaVq9ad9TSAnp7eI',
            region: 'us-east-1',
        });

        // Create a DynamoDB instance
        const dynamodb = new AWS.DynamoDB.DocumentClient();

        // Retrieve the item associated with the schedulerId
        const params = {
            TableName: 'Twilly',
            Key: {
                schedulerId: schedulerId,
                id: "None",
            },
            ProjectionExpression: 'Channels,hashedSchedulerId',
        };

        const result = await dynamodb.get(params).promise();
        const channels = result.Item?.Channels || {};
        const hashedSchedulerId = result.Item?.hashedSchedulerId || null;

        // Extract channel names from the Channels map
        const channelNames = Object.keys(channels);

        // Modify the response to include hashedSchedulerId
        const response = {
            channelNames,
            hashedSchedulerId,
        };

        return response;
    } catch (error) {
        console.error("Error:", error);

        throw createError({
            statusCode: 500,
            statusMessage: 'Error retrieving channel details',
        });
    }
});
