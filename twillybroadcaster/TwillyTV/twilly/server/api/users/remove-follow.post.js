import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    let { requesterEmail, requestedUserEmail, requestedUsername } = body; // Use 'let' instead of 'const' to allow reassignment

    if (!requesterEmail || !requestedUserEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: requesterEmail and requestedUserEmail'
      });
    }

    // CRITICAL: Normalize emails to lowercase to prevent case-sensitivity issues
    // This ensures we query the same PK/SK format that was used when creating entries
    requesterEmail = requesterEmail.toLowerCase();
    requestedUserEmail = requestedUserEmail.toLowerCase();
    
    console.log(`🗑️ [remove-follow] ${requesterEmail} removing ${requestedUserEmail} (username: ${requestedUsername || 'N/A'})`);

    let deletedSomething = false;
    let deletedType = null;

    // CRITICAL: Handle both ADDED_USERNAME (public) and FOLLOW_REQUEST (private)
    // These are COMPLETELY INDEPENDENT - removing one should NOT affect the other
    
    // 1. Try to delete ADDED_USERNAME entry (public, private, or premium)
    // CRITICAL: SK format includes visibility: ADDED_USERNAME#ownerEmail#public | #private | #premium
    for (const visibility of ['public', 'private', 'premium']) {
      const addedParams = {
        TableName: table,
        Key: {
          PK: `USER#${requesterEmail}`,
          SK: `ADDED_USERNAME#${requestedUserEmail}#${visibility}`
        }
      };
      try {
        const item = await dynamodb.get(addedParams).promise();
        if (item.Item) {
          await dynamodb.delete(addedParams).promise();
          await dynamodb.delete({
            TableName: table,
            Key: {
              PK: `STREAMER_FOLLOWERS#${requestedUserEmail}`,
              SK: `VIEWER#${requesterEmail}`
            }
          }).promise().catch(() => {});
          deletedSomething = true;
          deletedType = deletedType || 'ADDED_USERNAME';
          console.log(`✅ [remove-follow] Deleted ADDED_USERNAME entry (${visibility})`);
          break;
        }
      } catch (error) {
        console.log(`ℹ️ [remove-follow] ADDED_USERNAME #${visibility} not found or error: ${error.message}`);
      }
    }
    
    // Also try old format (for backward compatibility during migration)
    if (!deletedSomething) {
      const addedUsernameOldParams = {
        TableName: table,
        Key: {
          PK: `USER#${requesterEmail}`,
          SK: `ADDED_USERNAME#${requestedUserEmail}`
        }
      };
      
      try {
        const addedUsernameItem = await dynamodb.get(addedUsernameOldParams).promise();
        if (addedUsernameItem.Item) {
          // Migrate to new format before deleting
          const visibility = addedUsernameItem.Item.streamerVisibility || 'public';
          const newSK = `ADDED_USERNAME#${requestedUserEmail}#${visibility}`;
          
          // Create new entry with correct SK
          const newItem = {
            ...addedUsernameItem.Item,
            PK: `USER#${requesterEmail}`,
            SK: newSK
          };
          delete newItem.PK;
          delete newItem.SK;
          
          await dynamodb.put({
            TableName: table,
            Item: {
              PK: `USER#${requesterEmail}`,
              SK: newSK,
              ...newItem
            }
          }).promise();
          
          // Delete old entry
          await dynamodb.delete(addedUsernameOldParams).promise();
          await dynamodb.delete({
            TableName: table,
            Key: {
              PK: `STREAMER_FOLLOWERS#${requestedUserEmail}`,
              SK: `VIEWER#${requesterEmail}`
            }
          }).promise().catch(() => {});
          deletedSomething = true;
          deletedType = 'ADDED_USERNAME';
          console.log(`✅ [remove-follow] Migrated and deleted old format ADDED_USERNAME entry`);
        }
      } catch (error) {
        console.log(`ℹ️ [remove-follow] ADDED_USERNAME old format entry not found or error: ${error.message}`);
      }
    }

    // 2. Handle FOLLOW_REQUEST entry (for private accounts - "Request🔒" button)
    // CRITICAL: If request was accepted, set status to "rejected" instead of deleting
    // This maintains the one-way flow: Request → Requested → Approved → Rejected (if removed)
    const followRequestParams = {
      TableName: table,
      Key: {
        PK: `USER#${requestedUserEmail}`,
        SK: `FOLLOW_REQUEST#${requesterEmail}`
      }
    };

    try {
      const followRequestItem = await dynamodb.get(followRequestParams).promise();
      if (followRequestItem.Item) {
        const requestStatus = followRequestItem.Item.status;
        
        if (requestStatus === 'accepted') {
          // Request was approved - set status to "rejected" instead of deleting
          // This maintains the lifecycle: Request → Requested → Approved → Rejected
          const updateParams = {
            TableName: table,
            Key: {
              PK: `USER#${requestedUserEmail}`,
              SK: `FOLLOW_REQUEST#${requesterEmail}`
            },
            UpdateExpression: 'SET #status = :status, rejectedAt = :rejectedAt',
            ExpressionAttributeNames: {
              '#status': 'status'
            },
            ExpressionAttributeValues: {
              ':status': 'rejected',
              ':rejectedAt': new Date().toISOString()
            }
          };
          
          await dynamodb.update(updateParams).promise();
          deletedSomething = true;
          deletedType = deletedType ? 'BOTH' : 'FOLLOW_REQUEST';
          console.log(`✅ [remove-follow] Updated FOLLOW_REQUEST status to "rejected" (was approved, now removed)`);
        } else if (requestStatus === 'pending') {
          // Request was pending (not yet responded to) - delete it (user can request again)
          await dynamodb.delete(followRequestParams).promise();
          deletedSomething = true;
          deletedType = deletedType ? 'BOTH' : 'FOLLOW_REQUEST';
          console.log(`✅ [remove-follow] Deleted FOLLOW_REQUEST entry (status: ${requestStatus})`);
        } else if (requestStatus === 'declined') {
          // Request was declined - keep it but mark as removed
          // Requester still sees "Requested" but can't request again (one-way flow)
          const updateParams = {
            TableName: table,
            Key: {
              PK: `USER#${requestedUserEmail}`,
              SK: `FOLLOW_REQUEST#${requesterEmail}`
            },
            UpdateExpression: 'SET #status = :status, removedAt = :removedAt',
            ExpressionAttributeNames: {
              '#status': 'status'
            },
            ExpressionAttributeValues: {
              ':status': 'declined', // Keep as declined (requester sees "Requested")
              ':removedAt': new Date().toISOString()
            }
          };
          await dynamodb.update(updateParams).promise();
          deletedSomething = true;
          deletedType = deletedType ? 'BOTH' : 'FOLLOW_REQUEST';
          console.log(`✅ [remove-follow] Kept FOLLOW_REQUEST as declined (requester still sees "Requested")`);
        }
      }
    } catch (error) {
      // Item doesn't exist or error - that's okay
      console.log(`ℹ️ [remove-follow] FOLLOW_REQUEST entry not found or error: ${error.message}`);
    }

    if (!deletedSomething) {
      console.log(`⚠️ [remove-follow] No entries found to delete for ${requesterEmail} -> ${requestedUserEmail}`);
      // Return success anyway (idempotent operation)
      return {
        success: true,
        message: 'No entries found (already removed or never added)',
        status: 'removed',
        deletedType: null
      };
    }

    console.log(`✅ [remove-follow] Successfully removed ${deletedType} entry(ies)`);

    return {
      success: true,
      message: `Removed ${deletedType === 'BOTH' ? 'both public and private' : deletedType === 'ADDED_USERNAME' ? 'public' : 'private'} entry`,
      status: 'removed',
      deletedType: deletedType
    };

  } catch (error) {
    console.error('❌ [remove-follow] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to remove user from timeline'
    });
  }
});
