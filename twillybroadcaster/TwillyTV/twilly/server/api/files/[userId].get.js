import AWS from "aws-sdk";
import { defineEventHandler, createError } from 'h3';

export default defineEventHandler(async (event) => {
    try {
        const { userId } = event.context.params;

        // Configure AWS SDK with hardcoded credentials for production
        AWS.config.update({
            accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
            secretAccessKey: '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',
            region: 'us-east-1',
        });

        // Create DynamoDB DocumentClient instance
        const dynamodb = new AWS.DynamoDB.DocumentClient();

        // Query for all files
        const filesParams = {
            TableName: 'Twilly',
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: {
                ':pk': `USER#${userId}`,
            }
        };

        const result = await dynamodb.query(filesParams).promise();
        
        console.log(`🔍 [files/${userId}] Query returned ${result.Items?.length || 0} items`);
        
        // Separate folders from files
        const folders = result.Items.filter(item => item.isFolder);
        const files = result.Items.filter(item => !item.isFolder);
        
        console.log(`🔍 [files/${userId}] Found ${folders.length} folders and ${files.length} files`);
        
        // Log first few files to debug
        if (files.length > 0) {
            console.log(`🔍 [files/${userId}] First file sample:`, {
                fileName: files[0].fileName,
                category: files[0].category,
                hlsUrl: files[0].hlsUrl ? 'present' : 'missing',
                streamKey: files[0].streamKey ? 'present' : 'missing',
                folderName: files[0].folderName,
                isVisible: files[0].isVisible
            });
        }
        
        // Log first few folders to debug
        if (folders.length > 0) {
            console.log(`🔍 [files/${userId}] First folder sample:`, {
                name: folders[0].name,
                SK: folders[0].SK,
                seriesPosterUrl: folders[0].seriesPosterUrl ? 'present' : 'missing'
            });
        }

        // Add username lookup for each file using creatorId (so collaborator usernames display correctly)
        // CRITICAL: Use SOURCE OF TRUTH (PK='USER', SK=userId) first, matching mobile app behavior
        const filesWithUsername = await Promise.all(files.map(async (file) => {
            let username = null;
            
            // PRIORITY 1: Use SOURCE OF TRUTH - PK='USER', SK=userId (where update-username API stores usernames)
            // This ensures we get the correct username, not stale data from USER#userId/PROFILE
            if (file.creatorId) {
                try {
                    const sourceOfTruthParams = {
                        TableName: 'Twilly',
                        Key: {
                            PK: 'USER',
                            SK: file.creatorId
                        }
                    };
                    const sourceResult = await dynamodb.get(sourceOfTruthParams).promise();
                    if (sourceResult.Item && sourceResult.Item.username) {
                        username = sourceResult.Item.username;
                        console.log(`✅ [files/${userId}] Found username '${username}' from SOURCE OF TRUTH for creatorId ${file.creatorId}`);
                    }
                } catch (err) {
                    console.log(`⚠️ [files/${userId}] Error with SOURCE OF TRUTH lookup for ${file.creatorId}: ${err.message}`);
                }
            }
            
            // PRIORITY 2: Fallback to USER#userId/PROFILE (legacy location)
            if (!username && file.creatorId) {
                try {
                    const userParams = {
                        TableName: 'Twilly',
                        Key: {
                            PK: `USER#${file.creatorId}`,
                            SK: 'PROFILE'
                        }
                    };
                    const userResult = await dynamodb.get(userParams).promise();
                    if (userResult.Item && userResult.Item.username) {
                        username = userResult.Item.username;
                        console.log(`⚠️ [files/${userId}] Found username '${username}' from fallback location USER#${file.creatorId}/PROFILE (should use SOURCE OF TRUTH instead)`);
                    }
                } catch (err) {
                    // Ignore errors
                }
            }
            
            // PRIORITY 3: Try to get username from streamKey mapping
            if (!username && file.streamKey) {
                try {
                    const streamKeyParams = {
                        TableName: 'Twilly',
                        Key: {
                            PK: `STREAM_KEY#${file.streamKey}`,
                            SK: 'MAPPING'
                        }
                    };
                    const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
                    if (streamKeyResult.Item && streamKeyResult.Item.creatorId) {
                        // Try SOURCE OF TRUTH first for streamKey's creatorId
                        try {
                            const sourceOfTruthParams = {
                                TableName: 'Twilly',
                                Key: {
                                    PK: 'USER',
                                    SK: streamKeyResult.Item.creatorId
                                }
                            };
                            const sourceResult = await dynamodb.get(sourceOfTruthParams).promise();
                            if (sourceResult.Item && sourceResult.Item.username) {
                                username = sourceResult.Item.username;
                                console.log(`✅ [files/${userId}] Found username '${username}' from SOURCE OF TRUTH via streamKey ${file.streamKey}`);
                            }
                        } catch (err) {
                            // Fallback to USER#userId/PROFILE
                            const userParams = {
                                TableName: 'Twilly',
                                Key: {
                                    PK: `USER#${streamKeyResult.Item.creatorId}`,
                                    SK: 'PROFILE'
                                }
                            };
                            const userResult = await dynamodb.get(userParams).promise();
                            if (userResult.Item && userResult.Item.username) {
                                username = userResult.Item.username;
                            }
                        }
                    }
                } catch (err) {
                    // Ignore errors
                }
            }
            
            // Add username to file if found (this is the collaborator's username, not the admin's)
            if (username && !username.includes('@')) {
                file.creatorUsername = username;
            }
            
            return file;
        }));

        return {
            listings: filesWithUsername,
            folders: folders
        };
    } catch (error) {
        console.error("🔍 API: Error in getFiles:", error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Error retrieving files',
        });
    }
});
