import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'Twilly';

function normalizeDropId(dropId) {
  if (!dropId) return '';
  return dropId.startsWith('FILE#') ? dropId : `FILE#${dropId}`;
}

export default defineEventHandler(async (event) => {
  try {
    const dropIdParam = event.context.params?.dropId;
    const query = getQuery(event);
    const ownerEmail = query.ownerEmail;

    if (!dropIdParam || !ownerEmail) {
      throw createError({
        statusCode: 400,
        message: 'Missing required: dropId (path) and ownerEmail (query)'
      });
    }

    const dropId = normalizeDropId(dropIdParam).replace(/^FILE#/, '');
    const pk = `USER#${ownerEmail}`;

    const result = await dynamodb.query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'dropId = :dropId',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':sk': 'TRAILER#',
        ':dropId': dropId
      }
    }).promise();

    const trailers = (result.Items || []).map((item) => ({
      trailerId: item.trailerId,
      status: item.status,
      startTimeSec: item.startTimeSec,
      endTimeSec: item.endTimeSec,
      durationSec: item.durationSec,
      outputUrl: item.outputUrl || null,
      outputWidth: item.outputWidth,
      outputHeight: item.outputHeight,
      fileSizeBytes: item.fileSizeBytes,
      createdAt: item.createdAt,
      readyAt: item.readyAt,
      errorMessage: item.errorMessage
    }));

    return { success: true, trailers };
  } catch (err) {
    if (err.statusCode) throw err;
    console.error('trailers.get error:', err);
    throw createError({ statusCode: 500, message: err.message || 'Failed to list trailers' });
  }
});
