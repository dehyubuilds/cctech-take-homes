import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError, getHeader, getCookie } from 'h3';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

/**
 * Remove a user from viewing private content
 * SIMPLIFIED: Mirrors the simplicity of public remove (remove-follow.post.js)
 * 
 * Flow:
 * 1. Owner removes viewer from their private timeline
 * 2. Deletes ADDED_USERNAME entry: PK=USER#viewerEmail, SK=ADDED_USERNAME#ownerEmail#private
 * 3. Removes timeline entries for owner's private content from viewer's timeline
 * 4. Deletes notification
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    let { ownerEmail, viewerEmail, ownerUsername, viewerUsername } = body;
    
    // CRITICAL SECURITY: Verify that the requester is the owner
    const authenticatedUserEmail = getHeader(event, 'x-user-email') || 
                                   getCookie(event, 'userEmail') ||
                                   body.authenticatedUserEmail ||
                                   body.userEmail ||
                                   ownerEmail;
    
    if (!authenticatedUserEmail) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required - user email not provided'
      });
    }
    
    const normalizedAuthenticatedEmail = authenticatedUserEmail.toLowerCase().trim();

    // Resolve ownerEmail from ownerUsername if not provided
    if (!ownerEmail && ownerUsername) {
      const usernameVariations = [
        ownerUsername,
        ownerUsername.toLowerCase(),
        ownerUsername.charAt(0).toUpperCase() + ownerUsername.slice(1).toLowerCase()
      ];
      
      for (const variation of usernameVariations) {
        const gsiParams = {
          TableName: table,
          IndexName: 'UsernameSearchIndex',
          KeyConditionExpression: 'username = :username',
          ExpressionAttributeValues: { ':username': variation },
          Limit: 1
        };
        
        const gsiResult = await dynamodb.query(gsiParams).promise();
        if (gsiResult.Items && gsiResult.Items.length > 0) {
          ownerEmail = gsiResult.Items[0].email?.toLowerCase();
          break;
        }
      }
    }

    // Resolve viewerEmail from viewerUsername if not provided
    if (!viewerEmail && viewerUsername) {
      const usernameVariations = [
        viewerUsername,
        viewerUsername.toLowerCase(),
        viewerUsername.charAt(0).toUpperCase() + viewerUsername.slice(1).toLowerCase()
      ];
      
      for (const variation of usernameVariations) {
        const gsiParams = {
          TableName: table,
          IndexName: 'UsernameSearchIndex',
          KeyConditionExpression: 'username = :username',
          ExpressionAttributeValues: { ':username': variation },
          Limit: 1
        };
        
        const gsiResult = await dynamodb.query(gsiParams).promise();
        if (gsiResult.Items && gsiResult.Items.length > 0) {
          viewerEmail = gsiResult.Items[0].email?.toLowerCase();
          break;
        }
      }
    }

    if (!ownerEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: ownerEmail (or ownerUsername for lookup)'
      });
    }

    if (!viewerEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: viewerEmail (or viewerUsername for lookup)'
      });
    }

    // Normalize emails
    ownerEmail = ownerEmail.toLowerCase();
    viewerEmail = viewerEmail.toLowerCase();

    // CRITICAL SECURITY: Verify authenticated user is the owner
    if (normalizedAuthenticatedEmail !== ownerEmail) {
      console.log(`🚫 [remove-private-viewer] SECURITY: Unauthorized removal attempt`);
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Only the account owner can remove viewers from their private timeline'
      });
    }

    console.log(`🔒 [remove-private-viewer] ${ownerEmail} removing ${viewerEmail} from private`);

    // ============================================
    // STEP 1: Delete ADDED_USERNAME entry (SIMPLE - like public)
    // ============================================
    const deleteParams = {
      TableName: table,
      Key: {
        PK: `USER#${viewerEmail}`,
        SK: `ADDED_USERNAME#${ownerEmail}#private`
      }
    };

    // CRITICAL: First check if entry exists before deleting
    try {
      const checkParams = {
        TableName: table,
        Key: {
          PK: `USER#${viewerEmail}`,
          SK: `ADDED_USERNAME#${ownerEmail}#private`
        }
      };
      
      const existingEntry = await dynamodb.get(checkParams).promise();
      if (existingEntry.Item) {
        console.log(`🔍 [remove-private-viewer] Found entry to delete: ${existingEntry.Item.SK}, status: ${existingEntry.Item.status || 'N/A'}`);
        
        // Delete the entry
        await dynamodb.delete(deleteParams).promise();
        await dynamodb.delete({
          TableName: table,
          Key: {
            PK: `STREAMER_FOLLOWERS#${ownerEmail}`,
            SK: `VIEWER#${viewerEmail}`
          }
        }).promise().catch(() => {});
        console.log(`✅ [remove-private-viewer] Deleted ADDED_USERNAME entry`);
        
        // CRITICAL: Verify deletion succeeded
        const verifyDelete = await dynamodb.get(checkParams).promise();
        if (verifyDelete.Item) {
          console.log(`⚠️ [remove-private-viewer] WARNING: Entry still exists after deletion!`);
          console.log(`   This might indicate a deletion failure or race condition.`);
        } else {
          console.log(`✅ [remove-private-viewer] Verified deletion - entry no longer exists`);
        }
      } else {
        console.log(`ℹ️ [remove-private-viewer] Entry not found - may have already been deleted`);
      }
    } catch (error) {
      console.error(`❌ [remove-private-viewer] Error during deletion: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      // Don't throw - continue with timeline removal even if deletion fails
      // This allows the operation to complete even if there's a transient error
    }

    // ============================================
    // STEP 2: Remove timeline entries (CRITICAL: Make this synchronous like public remove)
    // ============================================
    try {
      const { removeTimelineEntries } = await import('../channels/timeline-utils.js');
      await removeTimelineEntries(viewerEmail, ownerEmail);
      console.log(`✅ [remove-private-viewer] Removed timeline entries for ${viewerEmail}`);
    } catch (err) {
      console.error(`⚠️ [remove-private-viewer] Timeline removal failed: ${err.message}`);
      // Don't throw - continue with deletion even if timeline removal fails
    }

    // ============================================
    // STEP 3: Delete notification (SIMPLE - just delete it)
    // ============================================
    try {
      const notificationQuery = {
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${viewerEmail}`,
          ':skPrefix': 'NOTIFICATION#'
        }
      };

      const allNotifications = await dynamodb.query(notificationQuery).promise();
      
      // Filter for private_access_granted notifications from this owner
      const matchingNotifications = (allNotifications.Items || []).filter(notif => {
        return notif.type === 'private_access_granted' && 
               notif.metadata?.ownerEmail?.toLowerCase() === ownerEmail;
      });
      
      // Delete all matching notifications
      for (const notification of matchingNotifications) {
        await dynamodb.delete({
          TableName: table,
          Key: {
            PK: notification.PK,
            SK: notification.SK
          }
        }).promise();
      }
      
      if (matchingNotifications.length > 0) {
        console.log(`✅ [remove-private-viewer] Deleted ${matchingNotifications.length} notification(s)`);
      }
    } catch (err) {
      console.error(`⚠️ [remove-private-viewer] Notification deletion failed (non-blocking): ${err.message}`);
    }

    console.log(`✅ [remove-private-viewer] ========== SUCCESS ==========\n`);

    return {
      success: true,
      message: 'User removed from viewing your private content',
      viewerEmail: viewerEmail
    };

  } catch (error) {
    console.error(`❌ [remove-private-viewer] Error: ${error.message}`);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to remove private viewer'
    });
  }
});
