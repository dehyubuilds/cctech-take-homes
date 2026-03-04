import AWS from "aws-sdk"; // Import AWS SDK for DynamoDB

export default defineEventHandler(async (event) => {
    const { schedulerId } = event.context.params;
    
    const id = `${schedulerId}User` 

    AWS.config.update({
        accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
        secretAccessKey: '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',
        region: 'us-east-1',
    });

    // Create a DynamoDB instance
    const dynamodb = new AWS.DynamoDB.DocumentClient();

    // Define the DynamoDB query parameters
    const params = {
        TableName: 'Twilly', // Replace with your DynamoDB table name
        KeyConditionExpression: 'schedulerId = :schedulerId AND id = :id', // Update to use schedulerId and id
        ExpressionAttributeValues: {
            ':schedulerId': schedulerId,
            ':id': id,
        },
        ProjectionExpression: 'avatarUrl, email, firstName, lastName, Notifications, phoneNumber', // Specify the attributes you want to select
    };

    try {
        const data = await dynamodb.query(params).promise();

        // Extract the relevant data from the response
        const listings = data.Items || [];

        return { listings };
    } catch (error) {
        // Handle any errors here
        throw createError({
            statusCode: 500, // Set an appropriate status code
            statusMessage: 'Error retrieving listings',
        });
    }
});
