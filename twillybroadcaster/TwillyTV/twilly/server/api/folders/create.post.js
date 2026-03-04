import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
    try {
        const { userId, folderName, category, SK, trailerUrl } = await readBody(event);

        AWS.config.update({
            accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
            secretAccessKey: '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',
            region: 'us-east-1'
        });

        const dynamodb = new AWS.DynamoDB.DocumentClient();

        // Create a folder entry using the SK format from the request
        const folderItem = {
            PK: `USER#${userId}`,
            SK: SK || `FOLDER#${category}#${folderName}`, // Use provided SK or construct one
            type: 'folder',
            name: folderName,
            isFolder: true,
            createdAt: new Date().toISOString(),
            category: category || 'Mixed',
            trailerUrl: trailerUrl || null
        };

        await dynamodb.put({
            TableName: 'Twilly',
            Item: folderItem
        }).promise();

        // Also create series metadata if trailer URL is provided
        if (trailerUrl) {
            const seriesId = `${userId}-${folderName}`;
            const seriesMetadata = {
                PK: `SERIES#${seriesId}`,
                SK: 'METADATA',
                title: folderName,
                description: `Check out this series from ${userId}`,
                trailerUrl: trailerUrl,
                createdAt: new Date().toISOString()
            };

            await dynamodb.put({
                TableName: 'Twilly',
                Item: seriesMetadata
            }).promise();
        }

        return { success: true, folder: folderItem };
    } catch (error) {
        throw createError({
            statusCode: 500,
            message: error.message
        });
    }
}); 