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
    let { userEmail, status = 'pending' } = body;

    if (!userEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: userEmail'
      });
    }

    // CRITICAL: Normalize email to lowercase to prevent case-sensitivity issues
    userEmail = userEmail.toLowerCase();

    console.log(`📬 [follow-requests] Getting ${status} follow requests for ${userEmail}`);

    // Query for follow requests
    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':pk': `USER#${userEmail}`,
        ':skPrefix': 'FOLLOW_REQUEST#',
        ':status': status
      }
    };

    const result = await dynamodb.query(queryParams).promise();
    const requests = result.Items || [];

    // Use stored usernames from request items (no lookup needed)
    // The requesterUsername is stored when the request is created (from requester's settings)
    const requestsWithUsernames = requests.map((request) => {
      let requesterEmail = request.requesterEmail || request.SK?.replace('FOLLOW_REQUEST#', '');
      
      // CRITICAL: Normalize email to lowercase
      if (requesterEmail) {
        requesterEmail = requesterEmail.toLowerCase();
      }
      
      // Use stored requesterUsername from request item (set when request was created)
      // This is the username from the requester's settings at the time of request
      const username = request.requesterUsername || '';

      return {
        requesterEmail,
        requesterUsername: username,
        requestedAt: request.requestedAt,
        respondedAt: request.respondedAt,
        status: request.status
      };
    });

    console.log(`✅ [follow-requests] Found ${requestsWithUsernames.length} ${status} requests`);

    return {
      success: true,
      requests: requestsWithUsernames,
      count: requestsWithUsernames.length
    };

  } catch (error) {
    console.error('❌ [follow-requests] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to get follow requests'
    });
  }
});
