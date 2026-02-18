import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    let { userEmail, requesterEmail } = body;

    if (!userEmail || !requesterEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: userEmail and requesterEmail'
      });
    }

    // CRITICAL: Normalize emails to lowercase to prevent case-sensitivity issues
    userEmail = userEmail.toLowerCase();
    requesterEmail = requesterEmail.toLowerCase();

    console.log(`❌ [decline-follow] ${userEmail} declining follow request from ${requesterEmail}`);

    // Get the follow request
    const requestParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: `FOLLOW_REQUEST#${requesterEmail}`
      }
    };

    const requestResult = await dynamodb.get(requestParams).promise();

    if (!requestResult.Item) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Follow request not found'
      });
    }

    // Update follow request status to declined
    // CRITICAL: Once declined, requester still sees "Requested" (can't request again)
    // This maintains one-way flow: Request → Requested → (stays Requested if declined)
    const updateParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: `FOLLOW_REQUEST#${requesterEmail}`
      },
      UpdateExpression: 'SET #status = :status, respondedAt = :respondedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'declined',
        ':respondedAt': new Date().toISOString()
      }
    };

    await dynamodb.update(updateParams).promise();

    console.log(`✅ [decline-follow] Follow request declined`);

    return {
      success: true,
      message: 'Follow request declined',
      status: 'declined'
    };

  } catch (error) {
    console.error('❌ [decline-follow] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to decline follow request'
    });
  }
});
