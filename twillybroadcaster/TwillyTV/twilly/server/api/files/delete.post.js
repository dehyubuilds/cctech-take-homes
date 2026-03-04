import AWS from "aws-sdk";

export default defineEventHandler(async (event) => {
    try {
        console.log('Delete file request received');
        
        const body = await readBody(event);
        console.log('Request body:', body);
        
        const { userId, fileId, fileName, folderName } = body;
        let actualSK = fileId; // may be resolved from timeline SK to FILE#id

        if (!userId || !fileId || !fileName) {
            console.error('Missing required parameters:', { userId, fileId, fileName });
            throw createError({
                statusCode: 400,
                message: 'Missing required parameters: userId, fileId, fileName'
            });
        }

        // Configure AWS SDK
        AWS.config.update({
            region: 'us-east-1',
            accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
            secretAccessKey: '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'
        });

        // Create DynamoDB DocumentClient (us-east-1)
        const dynamodb = new AWS.DynamoDB.DocumentClient({
            region: 'us-east-1'
        });

        // Create S3 instances for different regions
        const s3East1 = new AWS.S3({
            region: 'us-east-1'
        });

        const s3East2 = new AWS.S3({
            region: 'us-east-2'
        });

        // First verify the file exists in DynamoDB
        // For Twilly TV, files are stored under admin account, so check both user's account and admin account
        console.log('Checking if file exists in DynamoDB:', { userId, fileId });
        
        let fileResult = await dynamodb.get({
            TableName: 'Twilly',
            Key: {
                PK: `USER#${userId}`,
                SK: fileId
            }
        }).promise();

        console.log('DynamoDB get result (user account):', fileResult);

        // If not found under user's account, try admin account for Twilly TV files
        let actualPK = `USER#${userId}`;
        if (!fileResult.Item) {
            console.log('File not found under user account, checking admin account for Twilly TV files...');
            const adminEmail = 'dehyu.sinyan@gmail.com'; // Twilly TV master account
            fileResult = await dynamodb.get({
                TableName: 'Twilly',
                Key: {
                    PK: `USER#${adminEmail}`,
                    SK: fileId
                }
            }).promise();
            
            console.log('DynamoDB get result (admin account):', fileResult);
            
            if (fileResult.Item) {
                actualPK = `USER#${adminEmail}`;
                console.log(`✅ File found under admin account: ${adminEmail}`);
            }
        }

        if (!fileResult.Item) {
            // Client may have sent a timeline SK (e.g. PUBLIC#timestamp#fileId#email) from older get-content response.
            // Resolve to actual FILE#fileId and retry; always remove timeline entries so deleted items don't reappear.
            let resolvedFileId = fileId;
            const skParts = (fileId || '').split('#');
            if (skParts.length >= 3 && ['PUBLIC', 'PRIVATE', 'PREMIUM'].includes((skParts[0] || '').toUpperCase())) {
                const shortId = skParts[2];
                resolvedFileId = shortId.startsWith('FILE#') ? shortId : `FILE#${shortId}`;
                console.log('🔄 [delete] Resolving timeline SK to FILE id:', { original: fileId, resolved: resolvedFileId });
                const retryUser = await dynamodb.get({
                    TableName: 'Twilly',
                    Key: { PK: `USER#${userId}`, SK: resolvedFileId }
                }).promise();
                const retryAdmin = !retryUser.Item ? await dynamodb.get({
                    TableName: 'Twilly',
                    Key: { PK: 'USER#dehyu.sinyan@gmail.com', SK: resolvedFileId }
                }).promise() : { Item: null };
                if (retryUser.Item || retryAdmin.Item) {
                    fileResult = { Item: retryUser.Item || retryAdmin.Item };
                    actualPK = retryUser.Item ? `USER#${userId}` : 'USER#dehyu.sinyan@gmail.com';
                    actualSK = resolvedFileId;
                }
            }
            if (!fileResult.Item) {
                // Still not found - remove timeline entries so item stops reappearing; then return idempotent success
                try {
                    const { removeTimelineEntriesForFile } = await import('../channels/timeline-utils.js');
                    const idForTimeline = (resolvedFileId || fileId).replace(/^FILE#/, '');
                    await removeTimelineEntriesForFile(idForTimeline);
                    await removeTimelineEntriesForFile(fileId);
                } catch (timelineErr) {
                    console.warn(`⚠️ [delete] Timeline cleanup on not-found: ${timelineErr.message}`);
                }
                console.log('⚠️ File not found in database (may have already been deleted):', { userId, fileId, checkedAdminAccount: true });
                return {
                    success: true,
                    message: 'File not found (may have already been deleted)',
                    alreadyDeleted: true
                };
            }
        }

        const fileData = fileResult.Item;
        
        // Verify user has permission to delete this file
        // User can delete if:
        // 1. File is under their own account, OR
        // 2. File is under admin account but user is the creator (creatorEmail or streamerEmail matches userId), OR
        // 3. File has a streamKey and the streamKey mapping shows the user owns it
        const isOwnFile = actualPK === `USER#${userId}`;
        
        // Case-insensitive email comparison
        const userIdLower = userId.toLowerCase().trim();
        const creatorEmailLower = (fileData.creatorEmail || '').toLowerCase().trim();
        const streamerEmailLower = (fileData.streamerEmail || '').toLowerCase().trim();
        
        // Check if user is the creator (case-insensitive)
        let isCreator = creatorEmailLower === userIdLower || 
                       streamerEmailLower === userIdLower ||
                       (fileData.creatorId && fileData.creatorId.toLowerCase() === userIdLower);
        
        // If not found by email, check streamKey mapping (for Twilly TV files stored under admin account)
        let isStreamKeyOwner = false;
        if (!isOwnFile && !isCreator && fileData.streamKey) {
            try {
                const streamKeyParams = {
                    TableName: 'Twilly',
                    Key: {
                        PK: `STREAM_KEY#${fileData.streamKey}`,
                        SK: 'MAPPING'
                    }
                };
                const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
                if (streamKeyResult.Item) {
                    const ownerEmail = (streamKeyResult.Item.ownerEmail || '').toLowerCase().trim();
                    const collaboratorEmail = (streamKeyResult.Item.collaboratorEmail || '').toLowerCase().trim();
                    const creatorId = (streamKeyResult.Item.creatorId || '').toLowerCase().trim();
                    
                    // Check if user owns this stream key
                    if (ownerEmail === userIdLower || 
                        collaboratorEmail === userIdLower ||
                        creatorId === userIdLower) {
                        isStreamKeyOwner = true;
                        console.log(`✅ Permission verified via streamKey mapping: ${fileData.streamKey}`);
                    }
                }
            } catch (streamKeyError) {
                console.log(`⚠️ Error checking streamKey mapping: ${streamKeyError.message}`);
            }
        }
        
        // Also check if creatorUsername matches user's username (for Twilly TV)
        let isUsernameMatch = false;
        if (!isOwnFile && !isCreator && !isStreamKeyOwner && fileData.creatorUsername) {
            try {
                // Get user's username from their profile
                const userProfileParams = {
                    TableName: 'Twilly',
                    Key: {
                        PK: `USER#${userId}`,
                        SK: 'PROFILE'
                    }
                };
                const userProfileResult = await dynamodb.get(userProfileParams).promise();
                if (userProfileResult.Item && userProfileResult.Item.username) {
                    const userUsername = (userProfileResult.Item.username || '').toLowerCase().trim();
                    const creatorUsername = (fileData.creatorUsername || '').toLowerCase().trim();
                    // Remove lock emoji for comparison
                    const userUsernameClean = userUsername.replace('🔒', '').trim();
                    const creatorUsernameClean = creatorUsername.replace('🔒', '').trim();
                    
                    if (userUsernameClean === creatorUsernameClean) {
                        isUsernameMatch = true;
                        console.log(`✅ Permission verified via username match: ${userUsernameClean}`);
                    }
                }
            } catch (usernameError) {
                console.log(`⚠️ Error checking username match: ${usernameError.message}`);
            }
        }
        
        // Allow deletion if any of the conditions are met
        const hasPermission = isOwnFile || isCreator || isStreamKeyOwner || isUsernameMatch;
        
        if (!hasPermission) {
            console.error('❌ User does not have permission to delete this file:', { 
                userId, 
                userIdLower,
                filePK: actualPK, 
                creatorId: fileData.creatorId,
                creatorEmail: fileData.creatorEmail,
                creatorEmailLower,
                streamerEmail: fileData.streamerEmail,
                streamerEmailLower,
                creatorUsername: fileData.creatorUsername,
                streamKey: fileData.streamKey,
                isOwnFile,
                isCreator,
                isStreamKeyOwner,
                isUsernameMatch
            });
            throw createError({
                statusCode: 403,
                message: 'You do not have permission to delete this file'
            });
        }
        
        console.log(`✅ Permission verified - user can delete file: isOwnFile=${isOwnFile}, isCreator=${isCreator}, isStreamKeyOwner=${isStreamKeyOwner}, isUsernameMatch=${isUsernameMatch}`);
        
        // Determine the actual folder name from the file data if not provided
        let actualFolderName = folderName;
        if (!actualFolderName) {
            // Try to extract folder name from various possible fields
            actualFolderName = fileData.folderName || 
                             fileData.seriesName || 
                             fileData.category || 
                             'default';
        }

        // Delete from DynamoDB using the actual PK where the file was found
        await dynamodb.delete({
            TableName: 'Twilly',
            Key: {
                PK: actualPK,
                SK: actualSK
            }
        }).promise();
        
        console.log(`✅ Deleted file from DynamoDB: PK=${actualPK}, SK=${actualSK}`);

        // CRITICAL: Remove ALL timeline entries (PUBLIC#, PRIVATE#, PREMIUM#) for this file across ALL users.
        // Otherwise the video can reappear in any timeline after delete.
        try {
            const { removeTimelineEntriesForFile } = await import('../channels/timeline-utils.js');
            await removeTimelineEntriesForFile(actualSK);
        } catch (timelineErr) {
            console.warn(`⚠️ [delete] Timeline cleanup failed (non-blocking): ${timelineErr.message}`);
        }

        // Delete from S3 - try multiple possible bucket/key combinations
        // Extract owner email from actualPK (remove 'USER#' prefix)
        const ownerEmail = actualPK.replace('USER#', '');
        const streamKey = fileData.streamKey || fileData.folderPath;
        
        const s3DeletionPromises = [];
        
        // For Twilly TV files, try streamKey-based path first (clips/streamKey/filename)
        if (streamKey && (fileName.endsWith('.m3u8') || fileName.endsWith('.ts') || fileName.endsWith('_thumb.jpg'))) {
            // Extract unique prefix from filename for thumbnail
            const uniquePrefix = fileName.replace('_master.m3u8', '').replace('_thumb.jpg', '').replace('.m3u8', '');
            const thumbnailKey = `clips/${streamKey}/${uniquePrefix}_thumb.jpg`;
            const m3u8Key = `clips/${streamKey}/${fileName}`;
            
            // Try deleting m3u8 file
            if (fileName.endsWith('.m3u8')) {
                s3DeletionPromises.push(
                    s3East2.deleteObject({
                        Bucket: 'theprivatecollection',
                        Key: m3u8Key
                    }).promise().catch(err => {
                        console.log(`S3 deletion failed for theprivatecollection/${m3u8Key}:`, err.message);
                    })
                );
            }
            
            // Try deleting thumbnail
            s3DeletionPromises.push(
                s3East2.deleteObject({
                    Bucket: 'theprivatecollection',
                    Key: thumbnailKey
                }).promise().catch(err => {
                    console.log(`S3 deletion failed for theprivatecollection/${thumbnailKey}:`, err.message);
                })
            );
        }
        
        // Try the original bucket/key structure (us-east-1) with owner email
        if (actualFolderName) {
            s3DeletionPromises.push(
                s3East1.deleteObject({
                    Bucket: 'twilly',
                    Key: `${ownerEmail}/${actualFolderName}/${fileName}`
                }).promise().catch(err => {
                    console.log(`S3 deletion failed for twilly/${ownerEmail}/${actualFolderName}/${fileName}:`, err.message);
                })
            );
        }

        // Try without folder name (direct user/file structure) (us-east-1) with owner email
        s3DeletionPromises.push(
            s3East1.deleteObject({
                Bucket: 'twilly',
                Key: `${ownerEmail}/${fileName}`
            }).promise().catch(err => {
                console.log(`S3 deletion failed for twilly/${ownerEmail}/${fileName}:`, err.message);
            })
        );
        
        // Also try with requesting user's email (for backwards compatibility)
        if (ownerEmail !== userId) {
            if (actualFolderName) {
                s3DeletionPromises.push(
                    s3East1.deleteObject({
                        Bucket: 'twilly',
                        Key: `${userId}/${actualFolderName}/${fileName}`
                    }).promise().catch(err => {
                        console.log(`S3 deletion failed for twilly/${userId}/${actualFolderName}/${fileName}:`, err.message);
                    })
                );
            }
            s3DeletionPromises.push(
                s3East1.deleteObject({
                    Bucket: 'twilly',
                    Key: `${userId}/${fileName}`
                }).promise().catch(err => {
                    console.log(`S3 deletion failed for twilly/${userId}/${fileName}:`, err.message);
                })
            );
        }

        // Try theprivatecollection bucket for HLS files (us-east-2) with owner email
        if (fileName.endsWith('.m3u8') || fileName.endsWith('.ts')) {
            s3DeletionPromises.push(
                s3East2.deleteObject({
                    Bucket: 'theprivatecollection',
                    Key: `${ownerEmail}/mixed/${fileName}`
                }).promise().catch(err => {
                    console.log(`S3 deletion failed for theprivatecollection/${ownerEmail}/mixed/${fileName}:`, err.message);
                })
            );
        }

        // Execute all deletion attempts
        await Promise.allSettled(s3DeletionPromises);

        console.log('File deleted successfully from DynamoDB and S3');
        
        return { 
            success: true,
            message: 'File deleted successfully'
        };
    } catch (error) {
        console.error("Error deleting file:", error);
        console.error("Error stack:", error.stack);
        
        // Handle specific AWS errors
        if (error.code === 'CredentialsError') {
            throw createError({
                statusCode: 500,
                message: 'AWS credentials error. Please check configuration.'
            });
        } else if (error.code === 'AccessDenied') {
            throw createError({
                statusCode: 403,
                message: 'Access denied. Please check AWS permissions.'
            });
        } else if (error.code === 'ResourceNotFoundException') {
            throw createError({
                statusCode: 404,
                message: 'Resource not found in AWS.'
            });
        }
        
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Failed to delete file'
        });
    }
}); 