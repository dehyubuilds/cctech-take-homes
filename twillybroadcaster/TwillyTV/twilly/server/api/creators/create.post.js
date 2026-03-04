import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
    try {
        console.log('API - Received request to create/update creator');
        console.log('API - Request headers:', event.node.req.headers);
        const body = await readBody(event);
        console.log('API - Request body:', body);
        
        const { userId, email, name, username } = body;
        console.log('API - Creating/updating creator:', { userId, email, name, username });

        if (!userId || !email) {
            console.log('API - Missing required fields');
            throw createError({
                statusCode: 400,
                message: 'User ID and email are required'
            });
        }

        // Auto-generate username from email if not provided
        const finalUsername = username || email.split('@')[0];

        AWS.config.update({
            accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
            secretAccessKey: '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',
            region: 'us-east-1'
        });

        const dynamodb = new AWS.DynamoDB.DocumentClient();

        const params = {
            TableName: 'Creators',
            Item: {
                userId,
                email,
                name: name || '',
                username: finalUsername,
                totalEarnings: 0,
                pendingBalance: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };

        console.log('API - DynamoDB params:', JSON.stringify(params, null, 2));
        const result = await dynamodb.put(params).promise();
        console.log('API - DynamoDB response:', JSON.stringify(result, null, 2));
        console.log('API - Creator record created/updated in DynamoDB');

        return { success: true };
    } catch (error) {
        console.error('API - Error creating/updating creator:', error);
        console.error('API - Error stack:', error.stack);
        throw createError({
            statusCode: 500,
            message: error.message
        });
    }
}); 