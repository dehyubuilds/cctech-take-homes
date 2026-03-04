import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
    try {
        // Get userId from URL params for GET requests or body for POST requests
        const userId = event.context.params?.userId || (await readBody(event))?.userId;
        console.log('Fetching user:', userId);
        
        if (!userId) {
            throw createError({
                statusCode: 400,
                message: 'User ID is required'
            });
        }

        AWS.config.update({
            accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
            secretAccessKey: '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',
            region: 'us-east-1'
        });

        const dynamodb = new AWS.DynamoDB.DocumentClient();

        const params = {
            TableName: 'Twilly',
            Key: {
                PK: `USER#${userId}`,
                SK: 'PROFILE'
            }
        };

        console.log('DynamoDB params:', params);

        const response = await dynamodb.get(params).promise();
        console.log('DynamoDB response:', response);

        if (!response.Item) {
            console.log('No user found with ID:', userId);
            throw createError({
                statusCode: 404,
                message: 'User not found'
            });
        }

        return {
            email: response.Item.email,
            name: response.Item.name,
            totalEarnings: response.Item.totalEarnings || 0,
            pendingBalance: response.Item.pendingBalance || 0
        };

    } catch (error) {
        console.error('Error fetching user:', error);
        throw createError({
            statusCode: 500,
            message: error.message
        });
    }
}); 