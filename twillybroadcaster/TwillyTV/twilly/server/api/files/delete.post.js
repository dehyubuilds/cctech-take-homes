import AWS from "aws-sdk";

export default defineEventHandler(async (event) => {
    let body;
    try {
        body = await readBody(event);
        const { userId, fileId, fileName, folderName } = body;
        console.log('[DELETE] request', { userId: userId || 'MISSING', fileId: fileId || 'MISSING', fileName: fileName || 'MISSING' });

        if (!userId || !fileId || !fileName) {
            console.error('Missing required parameters:', { userId, fileId, fileName });
            throw createError({
                statusCode: 400,
                message: 'Missing required parameters: userId, fileId, fileName'
            });
        }

        // FILEs are always stored with SK = FILE#<id>. Use that format for lookup (intended behavior, one path).
        const toFileSK = (id) => {
            if (!id || typeof id !== 'string') return id;
            const trimmed = id.trim();
            if (trimmed.startsWith('FILE#')) return trimmed;
            return `FILE#${trimmed}`;
        };
        let actualSK = toFileSK(fileId);

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

        // Lookup FILE: PK = USER#creatorEmail, SK = FILE#fileId (same for public, private, premium).
        // CRITICAL: Normalize PK to lowercase - timeline/get-content use lowercase; FILE may be stored either way.
        const normalizedUserId = (userId || '').toLowerCase().trim();
        const userIdTrimmed = (userId || '').trim();
        console.log('[DELETE] lookup', { normalizedUserId, fileId, actualSK });

        const tryGet = async (pk) => {
            const res = await dynamodb.get({
                TableName: 'Twilly',
                Key: { PK: pk, SK: actualSK }
            }).promise();
            return res.Item;
        };

        let fileItem = await tryGet(`USER#${normalizedUserId}`);
        if (!fileItem && normalizedUserId !== userIdTrimmed) {
            fileItem = await tryGet(`USER#${userIdTrimmed}`);
        }
        let fileResult = { Item: fileItem };
        // actualPK must be the PK where the FILE was found (for delete and permission checks)
        let actualPK = fileItem ? fileItem.PK : `USER#${normalizedUserId}`;
        console.log('DynamoDB get result (user account):', fileResult.Item ? 'found' : 'not found');

        // If not found under user's account, try admin account for Twilly TV files
        if (!fileResult.Item) {
            console.log('File not found under user account, checking admin account for Twilly TV files...');
            const adminEmail = 'dehyu.sinyan@gmail.com'; // Twilly TV master account
            fileResult = { Item: await tryGet(`USER#${adminEmail}`) };
            console.log('DynamoDB get result (admin account):', fileResult.Item ? 'found' : 'not found');
            if (fileResult.Item) {
                actualPK = fileResult.Item.PK;
                console.log(`✅ File found under admin account: ${adminEmail}`);
            }
        }

        // NORMALIZE: If still not found, search by shortId so we always find the same file that appears on the timeline
        const shortIdForLookup = (actualSK || fileId).replace(/^FILE#/, '').trim();
        if (!fileResult.Item && shortIdForLookup) {
            const pksToSearch = [`USER#${normalizedUserId}`];
            if (normalizedUserId !== userIdTrimmed) pksToSearch.push(`USER#${userIdTrimmed}`);
            pksToSearch.push('USER#dehyu.sinyan@gmail.com');
            for (const pk of pksToSearch) {
                const q = await dynamodb.query({
                    TableName: 'Twilly',
                    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                    ExpressionAttributeValues: { ':pk': pk, ':sk': 'FILE#' },
                    Limit: 200
                }).promise();
                const match = (q.Items || []).find(f => {
                    const skShort = (f.SK || '').replace(/^FILE#/, '').trim();
                    const fid = (f.fileId || '').trim();
                    return skShort === shortIdForLookup || fid === shortIdForLookup;
                });
                if (match) {
                    fileResult = { Item: match };
                    actualPK = match.PK;
                    actualSK = match.SK;
                    console.log('[DELETE] normalized find: located FILE by shortId', { actualPK, actualSK });
                    break;
                }
            }
        }

        if (!fileResult.Item) {
            // FILE not found (e.g. client sent timeline fileId but DB has different SK for same clip). Remove timeline entries
            // and delete any OTHER FILE rows for the same stream so the video cannot reappear from "viewer's own FILEs" merge.
            const shortId = (actualSK || fileId).replace(/^FILE#/, '').trim();
            let streamKeyFromTimeline = null;
            if (shortId) {
                const { removeTimelineEntriesForFile, removeTimelineEntriesForFileForUser } = await import('../channels/timeline-utils.js');
                // Get streamKey from a timeline entry that references this file (so we can delete duplicate FILE rows)
                const pk = `USER#${normalizedUserId}`;
                for (const prefix of ['PUBLIC#', 'PRIVATE#', 'PREMIUM#']) {
                    const res = await dynamodb.query({
                        TableName: 'Twilly',
                        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
                        ExpressionAttributeValues: { ':pk': pk, ':prefix': prefix },
                        Limit: 50
                    }).promise();
                    const match = (res.Items || []).find(entry => {
                        const parts = (entry.SK || '').split('#');
                        if (parts.length < 3) return false;
                        const seg = (parts[2] || '').trim().replace(/^FILE#/, '');
                        return seg === shortId;
                    });
                    if (match && (match.streamKey || match.folderPath)) {
                        streamKeyFromTimeline = match.streamKey || match.folderPath;
                        console.log('[DELETE] got streamKey from timeline entry', { streamKey: streamKeyFromTimeline });
                        break;
                    }
                }
                try {
                    await removeTimelineEntriesForFileForUser(normalizedUserId, shortId);
                    await removeTimelineEntriesForFile(shortId);
                } catch (timelineErr) {
                    console.warn(`⚠️ [delete] Timeline cleanup on not-found: ${timelineErr.message}`);
                }
                // Delete any FILE rows for the same stream (different SK) so get-content "viewer's own FILEs" merge cannot bring the clip back
                if (streamKeyFromTimeline) {
                    const pksToCheck = [`USER#${normalizedUserId}`];
                    const adminEmail = 'dehyu.sinyan@gmail.com';
                    if (normalizedUserId !== adminEmail) pksToCheck.push(`USER#${adminEmail}`);
                    for (const pk of pksToCheck) {
                        const q = await dynamodb.query({
                            TableName: 'Twilly',
                            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                            FilterExpression: 'streamKey = :skey',
                            ExpressionAttributeValues: { ':pk': pk, ':sk': 'FILE#', ':skey': streamKeyFromTimeline }
                        }).promise();
                        for (const other of q.Items || []) {
                            await dynamodb.delete({ TableName: 'Twilly', Key: { PK: other.PK, SK: other.SK } }).promise();
                            const otherShortId = (other.SK || '').replace(/^FILE#/, '').trim();
                            await removeTimelineEntriesForFileForUser(normalizedUserId, otherShortId);
                            await removeTimelineEntriesForFile(otherShortId);
                            console.log('[DELETE] deleted duplicate FILE (not-found path)', { PK: other.PK, SK: other.SK });
                        }
                    }
                }
                try {
                    await dynamodb.put({
                        TableName: 'Twilly',
                        Item: {
                            PK: `USER#${normalizedUserId}`,
                            SK: `REMOVED_PREMIUM#${shortId}`,
                            fileId: shortId,
                            removedAt: new Date().toISOString()
                        }
                    }).promise();
                    await dynamodb.put({
                        TableName: 'Twilly',
                        Item: {
                            PK: `USER#${normalizedUserId}`,
                            SK: `REMOVED_FILE#${shortId}`,
                            fileId: shortId,
                            removedAt: new Date().toISOString()
                        }
                    }).promise();
                } catch (putErr) {
                    console.warn(`⚠️ [delete] REMOVED write (non-fatal): ${putErr.message}`);
                }
            }
            console.log('[DELETE] FILE not found - timeline + duplicate FILE cleanup done', { shortId, userId, actualSK });
            return {
                success: true,
                message: 'File not found (may have already been deleted)',
                alreadyDeleted: true
            };
        }

        const fileData = fileResult.Item;
        const streamKey = fileData.streamKey || fileData.folderPath;
        
        // Verify user has permission to delete this file
        // User can delete if:
        // 1. File is under their own account, OR
        // 2. File is under admin account but user is the creator (creatorEmail or streamerEmail matches userId), OR
        // 3. File has a streamKey and the streamKey mapping shows the user owns it
        const isOwnFile = actualPK === `USER#${normalizedUserId}` || actualPK === `USER#${userIdTrimmed}`;
        
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
        
        // Allow deletion if any of the conditions are met (compare with normalized userId for isOwnFile)
        const hasPermission = isOwnFile || isCreator || isStreamKeyOwner || isUsernameMatch;
        
        if (!hasPermission) {
            console.error('❌ User does not have permission to delete this file:', {
                userId: userIdTrimmed,
                normalizedUserId,
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
        console.log('[DELETE] deleted primary FILE', { actualPK, actualSK });

        const shortId = (actualSK || '').replace(/^FILE#/, '').trim();
        const normalizedDeleter = (userId || '').toLowerCase().trim();
        const creatorEmailNorm = (fileData.creatorEmail || '').toLowerCase().trim();

        // Remove any other FILE rows for the same stream (same streamKey, same user) so video cannot reappear
        if (streamKey) {
            const pksToCheck = [actualPK];
            if (actualPK !== 'USER#dehyu.sinyan@gmail.com') pksToCheck.push('USER#dehyu.sinyan@gmail.com');
            for (const pk of pksToCheck) {
                const q = await dynamodb.query({
                    TableName: 'Twilly',
                    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                    FilterExpression: 'streamKey = :skey',
                    ExpressionAttributeValues: { ':pk': pk, ':sk': 'FILE#', ':skey': streamKey }
                }).promise();
                for (const other of q.Items || []) {
                    if (other.SK === actualSK) continue; // already deleted
                    await dynamodb.delete({ TableName: 'Twilly', Key: { PK: other.PK, SK: other.SK } }).promise();
                    console.log('[DELETE] deleted duplicate FILE for same stream', { PK: other.PK, SK: other.SK });
                }
            }
        }
        // 1) Targeted: always remove from deleter's timeline (so premium tab clears even if global scan fails)
        try {
            const { removeTimelineEntriesForFileForUser } = await import('../channels/timeline-utils.js');
            await removeTimelineEntriesForFileForUser(normalizedDeleter, shortId);
            if (creatorEmailNorm && creatorEmailNorm !== normalizedDeleter) {
                await removeTimelineEntriesForFileForUser(creatorEmailNorm, shortId);
            }
        } catch (targetedErr) {
            console.warn(`⚠️ [delete] Targeted timeline cleanup failed: ${targetedErr.message}`);
        }
        // 2) Global: remove ALL timeline entries for this file (all users' feeds)
        try {
            const { removeTimelineEntriesForFile } = await import('../channels/timeline-utils.js');
            await removeTimelineEntriesForFile(actualSK);
        } catch (timelineErr) {
            console.warn(`⚠️ [delete] Timeline cleanup failed (non-blocking): ${timelineErr.message}`);
        }

        // 3) Mark as removed for this viewer so get-content never shows this clip again (safety net for any stray duplicate FILE)
        try {
            await dynamodb.put({
                TableName: 'Twilly',
                Item: {
                    PK: `USER#${normalizedDeleter}`,
                    SK: `REMOVED_FILE#${shortId}`,
                    fileId: shortId,
                    removedAt: new Date().toISOString()
                }
            }).promise();
        } catch (putErr) {
            console.warn(`⚠️ [delete] REMOVED_FILE write (non-fatal): ${putErr.message}`);
        }

        // Delete from S3 - try multiple possible bucket/key combinations
        const ownerEmail = actualPK.replace('USER#', '');
        
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

        console.log('[DELETE] success', { userId: normalizedDeleter, fileId: shortId, actualSK });
        return { 
            success: true,
            message: 'File deleted successfully'
        };
    } catch (error) {
        console.error('[DELETE] error', error.message, { userId: body?.userId, fileId: body?.fileId });
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