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
    let { userEmail, limit = 50, unreadOnly = false } = body;

    if (!userEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: userEmail'
      });
    }

    // CRITICAL: Normalize email to lowercase to prevent case-sensitivity issues
    // This ensures we query the same PK format that was used when creating notifications
    const originalUserEmail = userEmail;
    userEmail = userEmail.toLowerCase();

    console.log(`📬 [get-notifications] Getting notifications for user:`);
    console.log(`   Original email: "${originalUserEmail}"`);
    console.log(`   Normalized email: "${userEmail}"`);
    console.log(`   Query PK: USER#${userEmail}`);
    console.log(`   Unread only: ${unreadOnly}`);
    
    // CRITICAL: Verify user exists and get their username for debugging
    try {
      const profileParams = {
        TableName: table,
        Key: {
          PK: `USER#${userEmail}`,
          SK: 'PROFILE'
        }
      };
      const profileResult = await dynamodb.get(profileParams).promise();
      if (profileResult.Item && profileResult.Item.username) {
        console.log(`   ✅ User profile found: username="${profileResult.Item.username}"`);
      } else {
        console.log(`   ⚠️ User profile NOT found for email: "${userEmail}"`);
        console.log(`   This might explain why notifications aren't appearing!`);
      }
    } catch (profileError) {
      console.log(`   ⚠️ Could not verify user profile: ${profileError.message}`);
    }

    // Query for notifications
    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userEmail}`,
        ':skPrefix': 'NOTIFICATION#'
      },
      Limit: limit,
      ScanIndexForward: false // Most recent first
    };

    // Add filter for unread only if requested
    if (unreadOnly) {
      queryParams.FilterExpression = 'isRead = :isRead';
      queryParams.ExpressionAttributeValues[':isRead'] = false;
    }

    const result = await dynamodb.query(queryParams).promise();
    let notifications = result.Items || [];

    // CRITICAL: Normalize and ensure all required fields are present
    // Mobile app expects: SK, type, title, message, metadata, isRead, createdAt
    notifications = notifications.map(notif => {
      // Ensure SK is included (mobile app extracts id from SK)
      if (!notif.SK) {
        console.log(`⚠️ [get-notifications] Notification missing SK: ${JSON.stringify(notif)}`);
      }
      
      // CRITICAL: Ensure isRead is always a boolean (default to false if missing)
      if (notif.isRead === undefined || notif.isRead === null) {
        notif.isRead = false;
      }
      
      // Ensure metadata is an object (not undefined)
      if (!notif.metadata) {
        notif.metadata = {};
      }
      
      return notif;
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;
    
    // Debug: Log all notification types
    const followRequestNotifications = notifications.filter(n => n.type === 'follow_request');
    const privateAccessNotifications = notifications.filter(n => n.type === 'private_access_granted');
    
    console.log(`✅ [get-notifications] Found ${notifications.length} notifications (${unreadCount} unread)`);
    console.log(`   📬 Follow request notifications: ${followRequestNotifications.length}`);
    console.log(`   🔒 Private access granted notifications: ${privateAccessNotifications.length}`);
    
    if (privateAccessNotifications.length > 0) {
      console.log(`   📋 Private access notifications:`);
      privateAccessNotifications.forEach((notif, idx) => {
        console.log(`      [${idx + 1}] ${notif.message} (read: ${notif.isRead}, created: ${notif.createdAt})`);
        console.log(`          Owner: ${notif.metadata?.ownerUsername || 'N/A'}, Email: ${notif.metadata?.ownerEmail || 'N/A'}`);
      });
    }
    
    if (followRequestNotifications.length > 0) {
      followRequestNotifications.forEach((notif, idx) => {
        console.log(`   [${idx + 1}] ${notif.title}: ${notif.message} (read: ${notif.isRead}, created: ${notif.createdAt})`);
      });
    }

    // CRITICAL: Log response structure for debugging
    if (notifications.length > 0) {
      const sample = notifications[0];
      console.log(`📤 [get-notifications] Sample notification in response:`);
      console.log(`   PK: ${sample.PK}`);
      console.log(`   SK: ${sample.SK}`);
      console.log(`   type: ${sample.type}`);
      console.log(`   message: ${sample.message}`);
      console.log(`   metadata: ${JSON.stringify(sample.metadata)}`);
    }

    return {
      success: true,
      notifications: notifications,
      count: notifications.length,
      unreadCount: unreadCount
    };

  } catch (error) {
    console.error('❌ [get-notifications] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to get notifications'
    });
  }
});
