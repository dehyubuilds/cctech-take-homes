import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { userId, folderName, category } = body;

        console.log('Delete folder request:', { userId, folderName, category });

        if (!userId || !folderName || !category) {
            throw createError({
                statusCode: 400,
                message: 'Missing required parameters: userId, folderName, category'
            });
        }

        AWS.config.update({
            accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
            secretAccessKey: '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',
            region: 'us-east-1'
        });

        const dynamodb = new AWS.DynamoDB.DocumentClient();

        // First check if folder contains any files
        console.log('Checking for files in folder:', folderName);
        const { Items: allFiles } = await dynamodb.query({
            TableName: 'Twilly',
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: {
                ':pk': `USER#${userId}`
            }
        }).promise();

        console.log('Total files found:', allFiles?.length || 0);

        // Check for files in this folder (case-insensitive)
        const filesInFolder = allFiles.filter(file => 
            file.folderName && file.folderName.toLowerCase() === folderName.toLowerCase()
        );

        console.log('Files in folder:', filesInFolder.length);

        // If folder has files, don't allow deletion
        if (filesInFolder.length > 0) {
            console.log('Cannot delete folder - contains files:', filesInFolder.map(f => f.fileName));
            throw createError({
                statusCode: 400,
                message: 'Cannot delete folder that contains files'
            });
        }

        // Delete the folder
        const folderKey = {
            PK: `USER#${userId}`,
            SK: `FOLDER#${category}#${folderName}`
        };

        console.log('Deleting folder with key:', folderKey);

        await dynamodb.delete({
            TableName: 'Twilly',
            Key: folderKey
        }).promise();

        console.log('Folder deleted successfully:', folderName);

        return { 
            success: true,
            message: 'Folder deleted successfully' 
        };
    } catch (error) {
        console.error('Error deleting folder:', error);
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message
        });
    }
}); 