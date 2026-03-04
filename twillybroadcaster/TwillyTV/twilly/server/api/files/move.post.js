import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
    try {
        const { userId, fileId, targetFolder } = await readBody(event);
        console.log('Moving file:', { userId, fileId, targetFolder });

        AWS.config.update({
            accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
            secretAccessKey: '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',
            region: 'us-east-1'
        });

        const dynamodb = new AWS.DynamoDB.DocumentClient();

        // First verify the file exists
        const fileResult = await dynamodb.get({
            TableName: 'Twilly',
            Key: {
                PK: `USER#${userId}`,
                SK: fileId,
            },
        }).promise();
        console.log('Found file:', fileResult.Item);

        if (!fileResult.Item) {
            throw createError({
                statusCode: 404,
                message: 'File not found'
            });
        }

        // If target folder is not 'default', verify it exists
        if (targetFolder !== 'default') {
            // Query for folders with the target name across all categories
            const folderResult = await dynamodb.query({
                TableName: 'Twilly',
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': `USER#${userId}`,
                    ':sk': 'FOLDER#',
                },
            }).promise();

            // Find the folder that matches the target name, regardless of category
            const folder = folderResult.Items.find(folder => {
                const folderName = folder.SK.split('#').pop();
                return folderName === targetFolder;
            });

            if (!folder) {
                throw createError({
                    statusCode: 404,
                    message: 'Target folder not found'
                });
            }
        }

        // Prevent moving thumbnail files
        if (fileResult.Item.fileName.includes('_0.gif')) {
            throw new Error('Cannot move thumbnail files');
        }

        // Update the file's folder
        const updateParams = {
            TableName: 'Twilly',
            Key: {
                PK: `USER#${userId}`,
                SK: fileId,
            },
            UpdateExpression: targetFolder === 'default' 
                ? 'remove folderName' 
                : 'set folderName = :folderName',
            ...(targetFolder !== 'default' && {
                ExpressionAttributeValues: {
                    ':folderName': targetFolder
                }
            })
        };

        console.log('Updating with params:', updateParams);
        await dynamodb.update(updateParams).promise();
        console.log('Update successful');

        // If this is a video, also update its thumbnail's folder
        if (fileResult.Item.category === 'Videos' && fileResult.Item.thumbnailId) {
            const thumbnailUpdateParams = {
                TableName: 'Twilly',
                Key: {
                    PK: `USER#${userId}`,
                    SK: fileResult.Item.thumbnailId,
                },
                UpdateExpression: targetFolder === 'default' 
                    ? 'remove folderName' 
                    : 'set folderName = :folderName',
                ...(targetFolder !== 'default' && {
                    ExpressionAttributeValues: {
                        ':folderName': targetFolder
                    }
                })
            };

            await dynamodb.update(thumbnailUpdateParams).promise();
        }

        return { success: true };
    } catch (error) {
        console.error('Error in move endpoint:', error);
        if (error.code === 'ResourceNotFoundException') {
            throw createError({
                statusCode: 500,
                message: 'Database table not found. Please check your configuration.'
            });
        }
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message || 'An error occurred while moving the file'
        });
    }
}); 