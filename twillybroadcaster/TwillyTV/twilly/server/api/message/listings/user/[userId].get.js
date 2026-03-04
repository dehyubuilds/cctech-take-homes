
import AWS from "aws-sdk"; // Import AWS SDK for DynamoDB

export default defineEventHandler(async (event) => {
    try {
        const { userId } = event.context.params;

        // Configure the AWS SDK with your credentials and region
        AWS.config.update({
            accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
            secretAccessKey: '81v8RfOXhFHoKvOyD5t4I8kIeaVq9ad9TSAnp7eI',
            region: 'us-east-1',
        });

        // Create a DynamoDB instance
        const dynamodb = new AWS.DynamoDB.DocumentClient();

        const params = {
            TableName: 'Twilly',
            KeyConditionExpression: 'schedulerId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId,
            },
            ProjectionExpression: 'image, reminder, id, isFav',
            FilterExpression: 'attribute_exists(reminder)', // Exclude items without a 'reminder' key
        };

        const data = await dynamodb.query(params).promise();

        const listings = data.Items || [];


        return { listings };
    } catch (error) {
        console.error("Error:", error);

        throw createError({
            statusCode: 500,
            statusMessage: 'Error retrieving listings',
        });
    }
});