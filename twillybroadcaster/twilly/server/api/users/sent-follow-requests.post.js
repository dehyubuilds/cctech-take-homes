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
    let { requesterEmail, status = 'pending' } = body;

    if (!requesterEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: requesterEmail'
      });
    }

    // CRITICAL: Normalize email to lowercase to prevent case-sensitivity issues
    requesterEmail = requesterEmail.toLowerCase();

    console.log(`📤 [sent-follow-requests] Getting ${status} follow requests sent by ${requesterEmail}`);

    // OPTIMIZED: Use GSI for fast, cost-effective queries
    // GSI: FollowRequestsByRequesterIndex
    //   Partition Key: requesterEmail
    //   Sort Key: SK (FOLLOW_REQUEST#...)
    let requests = [];
    let useGSI = true;

    try {
      const queryParams = {
        TableName: table,
        IndexName: 'FollowRequestsByRequesterIndex',
        KeyConditionExpression: 'requesterEmail = :requesterEmail AND begins_with(SK, :skPrefix)',
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':requesterEmail': requesterEmail,
          ':skPrefix': 'FOLLOW_REQUEST#',
          ':status': status
        }
      };

      const result = await dynamodb.query(queryParams).promise();
      requests = result.Items || [];
      console.log(`✅ [sent-follow-requests] Queried GSI: Found ${requests.length} ${status} requests`);
    } catch (error) {
      // If GSI doesn't exist yet, fall back to scan
      if (error.code === 'ResourceNotFoundException' || 
          error.message.includes('index') || 
          error.message.includes('FollowRequestsByRequesterIndex')) {
        console.log('⚠️  GSI not available, falling back to scan...');
        useGSI = false;
      } else {
        throw error;
      }
    }

    // Fallback to scan if GSI not available
    if (!useGSI) {
      const scanParams = {
        TableName: table,
        FilterExpression: 'begins_with(SK, :skPrefix) AND requesterEmail = :requesterEmail AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':skPrefix': 'FOLLOW_REQUEST#',
          ':requesterEmail': requesterEmail,
          ':status': status
        }
      };

      const result = await dynamodb.scan(scanParams).promise();
      requests = result.Items || [];
      console.log(`⚠️  [sent-follow-requests] Fallback scan: Found ${requests.length} ${status} requests`);
    }

    // Get requested user emails and usernames
    const requestsWithUsernames = await Promise.all(
      requests.map(async (request) => {
        // Extract requested user email from PK
        let requestedUserEmail = request.PK?.replace('USER#', '') || '';
        
        // CRITICAL: Normalize email to lowercase
        if (requestedUserEmail) {
          requestedUserEmail = requestedUserEmail.toLowerCase();
        }
        
        // Get requested user's username
        const profileParams = {
          TableName: table,
          Key: {
            PK: `USER#${requestedUserEmail}`,
            SK: 'PROFILE'
          }
        };

        const profileResult = await dynamodb.get(profileParams).promise();
        const username = profileResult.Item?.username || '';

        // CRITICAL: From requester's perspective, "declined" should show as "pending" (requested)
        // This maintains the one-way flow: Request → Requested (can't go back)
        // Requester doesn't see that their request was declined - they just see it's still "requested"
        // BUT: Keep "accepted" as "accepted" - don't convert it
        let displayStatus = request.status;
        if (request.status === 'declined') {
          displayStatus = 'pending'; // Show as "requested" from requester's view
        }
        // Keep "accepted" as "accepted" - frontend needs this to show "Approved" button
        
        return {
          requestedUserEmail,
          requestedUsername: username,
          requestedAt: request.requestedAt,
          respondedAt: request.respondedAt,
          status: displayStatus, // Use display status (declined → pending for requester, accepted stays accepted)
          actualStatus: request.status // Keep actual status for internal use
        };
      })
    );

    console.log(`✅ [sent-follow-requests] Found ${requestsWithUsernames.length} ${status} requests sent by ${requesterEmail}`);

    return {
      success: true,
      requests: requestsWithUsernames,
      count: requestsWithUsernames.length
    };

  } catch (error) {
    console.error('❌ [sent-follow-requests] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to get sent follow requests'
    });
  }
});
