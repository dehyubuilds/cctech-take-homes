import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS({ region: 'us-east-1' });
const TABLE_NAME = 'Twilly';
const TRAILER_QUEUE_URL = process.env.TRAILER_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/142770202579/twilly-trailer-queue';
const OVERLAY_TEMPLATE_VERSION = 'v1';

function normalizeDropId(dropId) {
  if (!dropId) return '';
  return dropId.startsWith('FILE#') ? dropId : `FILE#${dropId}`;
}

export default defineEventHandler(async (event) => {
  try {
    const dropIdParam = event.context.params?.dropId;
    const body = await readBody(event);
    const { startTimeSec, endTimeSec, durationSec = 10, ownerEmail, creatorUsername, scheduledDropDate } = body;

    if (!dropIdParam || !ownerEmail) {
      throw createError({
        statusCode: 400,
        message: 'Missing required: dropId (path) and ownerEmail (body)'
      });
    }

    const dropId = normalizeDropId(dropIdParam);
    const pk = `USER#${ownerEmail}`;
    const fileSk = dropId;

    const fileResult = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: fileSk }
    }).promise();

    const drop = fileResult.Item;
    if (!drop) {
      throw createError({
        statusCode: 404,
        message: 'Drop not found'
      });
    }

    if (drop.isProcessing) {
      throw createError({
        statusCode: 400,
        message: 'Drop is still processing; try again when the video is ready'
      });
    }

    const hlsUrl = drop.hlsUrl || drop.url;
    if (!hlsUrl || !hlsUrl.trim()) {
      throw createError({
        statusCode: 400,
        message: 'Drop has no playable video yet (missing hlsUrl)'
      });
    }

    const videoDuration = drop.durationSeconds ?? drop.duration ?? 900;
    const start = Number(startTimeSec);
    const end = endTimeSec != null ? Number(endTimeSec) : start + Number(durationSec);
    const duration = end - start;

    if (start < 0 || end > videoDuration) {
      throw createError({
        statusCode: 400,
        message: `Invalid range: start must be >= 0 and end <= ${videoDuration}`
      });
    }
    if (duration < 3 || duration > 30) {
      throw createError({
        statusCode: 400,
        message: 'Clip duration must be between 3 and 30 seconds'
      });
    }

    const idempotencyKey = `${dropId.replace(/^FILE#/, '')}|${start}|${end}|${OVERLAY_TEMPLATE_VERSION}`;
    const existingQuery = await dynamodb.query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'idempotencyKey = :key AND #s IN (:req, :proc, :ready)',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':pk': pk,
        ':sk': 'TRAILER#',
        ':key': idempotencyKey,
        ':req': 'REQUESTED',
        ':proc': 'PROCESSING',
        ':ready': 'READY'
      },
      Limit: 1
    }).promise();

    if (existingQuery.Items?.length) {
      const existing = existingQuery.Items[0];
      return {
        success: true,
        trailerId: existing.trailerId,
        status: existing.status,
        message: 'Trailer already requested or ready',
        outputUrl: existing.outputUrl || null
      };
    }

    const trailerId = `trl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    const trailerItem = {
      PK: pk,
      SK: `TRAILER#${trailerId}`,
      trailerId,
      dropId: dropId.replace(/^FILE#/, ''),
      ownerEmail,
      status: 'REQUESTED',
      startTimeSec: start,
      endTimeSec: end,
      durationSec: duration,
      overlayTemplateVersion: OVERLAY_TEMPLATE_VERSION,
      idempotencyKey,
      sourceVideoUrl: hlsUrl,
      createdAt: now,
      updatedAt: now,
      requestedAt: now
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: trailerItem
    }).promise();

    await sqs.sendMessage({
      QueueUrl: TRAILER_QUEUE_URL,
      MessageBody: JSON.stringify({
        trailerId,
        dropId: dropId.replace(/^FILE#/, ''),
        ownerEmail,
        sourceVideoUrl: hlsUrl,
        startTimeSec: start,
        endTimeSec: end,
        durationSec: duration,
        username: creatorUsername || 'creator',
        scheduledDropDate: scheduledDropDate || drop.scheduledDropDate || null
      })
    }).promise();

    return {
      success: true,
      trailerId,
      status: 'REQUESTED',
      message: 'Trailer queued; check back in a minute for download'
    };
  } catch (err) {
    if (err.statusCode) throw err;
    console.error('trailers.post error:', err);
    throw createError({ statusCode: 500, message: err.message || 'Failed to create trailer' });
  }
});
