import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

/**
 * Get list of users who can view private content
 * Returns all users who have ADDED_USERNAME entries with streamerVisibility='private' for this owner
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    let { ownerEmail } = body;

    if (!ownerEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: ownerEmail'
      });
    }

    ownerEmail = ownerEmail.toLowerCase();

    console.log(`🔒 [get-private-viewers] Getting private viewers for ${ownerEmail}`);

    // Query reverse index (no scan): STREAMER_FOLLOWERS#owner
    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'streamerVisibility = :visibility AND #status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':pk': `STREAMER_FOLLOWERS#${ownerEmail}`,
        ':skPrefix': 'VIEWER#',
        ':visibility': 'private',
        ':status': 'active'
      }
    };
    const result = await dynamodb.query(queryParams).promise();
    const entries = (result.Items || []).map(it => ({
      ...it,
      PK: `USER#${(it.SK || '').replace('VIEWER#', '')}`,
      viewerEmail: (it.SK || '').replace('VIEWER#', '')
    }));

    console.log(`🔒 [get-private-viewers] Found ${entries.length} private viewers`);

    // Extract viewer emails and fetch their usernames
    const viewers = [];
    for (const entry of entries) {
      const viewerEmail = entry.PK?.replace('USER#', '') || entry.viewerEmail;
      if (viewerEmail) {
        // Get viewer's username from PROFILE
        try {
          const profileParams = {
            TableName: table,
            Key: {
              PK: `USER#${viewerEmail.toLowerCase()}`,
              SK: 'PROFILE'
            }
          };
          const profileResult = await dynamodb.get(profileParams).promise();
          const username = profileResult.Item?.username || viewerEmail.split('@')[0];
          
          viewers.push({
            email: viewerEmail.toLowerCase(),
            username: username,
            addedAt: entry.addedAt,
            addedByOwner: entry.addedByOwner || false
          });
        } catch (error) {
          console.log(`⚠️ [get-private-viewers] Could not fetch profile for ${viewerEmail}: ${error.message}`);
          // Still include viewer with email as fallback
          viewers.push({
            email: viewerEmail.toLowerCase(),
            username: viewerEmail.split('@')[0],
            addedAt: entry.addedAt,
            addedByOwner: entry.addedByOwner || false
          });
        }
      }
    }

    return {
      success: true,
      viewers: viewers,
      count: viewers.length
    };

  } catch (error) {
    console.error(`❌ [get-private-viewers] Error: ${error.message}`);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to get private viewers'
    });
  }
});
