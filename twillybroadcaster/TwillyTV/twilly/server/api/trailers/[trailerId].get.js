import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const trailerIdParam = event.context.params?.trailerId;
    const query = getQuery(event);
    const ownerEmail = query.ownerEmail;

    if (!trailerIdParam || !ownerEmail) {
      throw createError({
        statusCode: 400,
        message: 'Missing required: trailerId (path) and ownerEmail (query)'
      });
    }

    const trailerId = trailerIdParam.startsWith('trl_') ? trailerIdParam : `trl_${trailerIdParam}`;
    const pk = `USER#${ownerEmail}`;
    const sk = `TRAILER#${trailerId}`;

    const result = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk }
    }).promise();

    const item = result.Item;
    if (!item) {
      throw createError({
        statusCode: 404,
        message: 'Trailer not found'
      });
    }

    return {
      success: true,
      trailerId: item.trailerId,
      dropId: item.dropId,
      status: item.status,
      startTimeSec: item.startTimeSec,
      endTimeSec: item.endTimeSec,
      durationSec: item.durationSec,
      outputUrl: item.outputUrl || null,
      outputWidth: item.outputWidth,
      outputHeight: item.outputHeight,
      outputDurationSec: item.outputDurationSec,
      fileSizeBytes: item.fileSizeBytes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      readyAt: item.readyAt,
      errorMessage: item.errorMessage
    };
  } catch (err) {
    if (err.statusCode) throw err;
    console.error('trailer get error:', err);
    throw createError({ statusCode: 500, message: err.message || 'Failed to get trailer' });
  }
});
