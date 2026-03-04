/**
 * Twilly TV Trailer Worker Lambda
 * Consumes messages from twilly-trailer-queue (SQS), generates 9:16 MP4 with FFmpeg, uploads to S3, updates DynamoDB.
 * Requires FFmpeg Lambda layer (e.g. /opt/bin/ffmpeg and /opt/bin/ffprobe).
 *
 * Env: DYNAMODB_TABLE (Twilly), TRAILER_BUCKET (S3 bucket), TRAILER_BASE_URL (optional, e.g. CloudFront base for outputUrl),
 *      TWILLY_LOGO_URL (optional), REGION (optional, default us-east-1).
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

process.env.PATH = `/opt/bin:${process.env.PATH}`;
const FFMPEG_PATH = fs.existsSync('/opt/bin/ffmpeg') ? '/opt/bin/ffmpeg' : 'ffmpeg';
const FFPROBE_PATH = fs.existsSync('/opt/bin/ffprobe') ? '/opt/bin/ffprobe' : 'ffprobe';

const REGION = process.env.REGION || 'us-east-1';
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'Twilly';
const TRAILER_BUCKET = process.env.TRAILER_BUCKET || 'theprivatecollection';
const TRAILER_BASE_URL = process.env.TRAILER_BASE_URL || ''; // e.g. https://d123.cloudfront.net or leave empty to use S3 URL
const TWILLY_LOGO_URL = process.env.TWILLY_LOGO_URL || 'https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png';

const s3 = new S3Client({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

function escapeDrawText(s) {
  if (s == null) return '';
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "'\\''");
}

function buildFilterComplex(opts) {
  const { username, premiereText, hasLogo } = opts;
  const userText = escapeDrawText(`@${username}`);
  const premiereStr = escapeDrawText(premiereText || 'New Drop');
  const twillyStr = escapeDrawText('Twilly TV');

  let chain = '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
  chain += `,drawtext=text='${userText}':x=40:y=80:fontsize=28:fontcolor=white@0.9:shadowcolor=black@0.5:shadowx=2:shadowy=2`;
  chain += `,drawtext=text='${premiereStr}':x=40:y=1840:fontsize=24:fontcolor=white@0.9:shadowcolor=black@0.5:shadowx=2:shadowy=2`;
  if (hasLogo) {
    chain += `,drawtext=text='${twillyStr}':x=860:y=1840:fontsize=20:fontcolor=white@0.8:shadowcolor=black@0.5:shadowx=1:shadowy=1[base];[1:v]scale=120:-1[wm];[base][wm]overlay=W-w-20:H-h-20[v]`;
  } else {
    chain += `,drawtext=text='${twillyStr}':x=860:y=1840:fontsize=20:fontcolor=white@0.8:shadowcolor=black@0.5:shadowx=1:shadowy=1[v]`;
  }
  return chain;
}

function downloadLogo(url, destPath) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        return resolve(false);
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(fs.existsSync(destPath));
      });
    }).on('error', () => {
      file.close();
      fs.unlink(destPath, () => {});
      resolve(false);
    });
  });
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-800)}`));
    });
    proc.on('error', reject);
  });
}

async function generateTrailerMp4(opts) {
  const {
    sourceUrl,
    startTimeSec,
    durationSec,
    username,
    premiereText,
    outputPath,
    logoPath,
  } = opts;

  const hasLogo = !!logoPath && fs.existsSync(logoPath);
  const filterComplex = buildFilterComplex({ username, premiereText, hasLogo });

  const args = [
    '-ss', String(startTimeSec),
    '-i', sourceUrl,
    ...(hasLogo ? ['-i', logoPath] : []),
    '-t', String(durationSec),
    '-filter_complex', filterComplex,
    '-map', '[v]', '-map', '0:a',
    '-c:v', 'libx264', '-profile:v', 'main', '-level', '4.0', '-crf', '20', '-preset', 'fast',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    '-y', outputPath,
  ];

  await runFfmpeg(args);
  return outputPath;
}

function formatPremiereText(scheduledDropDate) {
  if (!scheduledDropDate) return 'New Drop';
  try {
    const d = new Date(scheduledDropDate);
    if (isNaN(d.getTime())) return 'New Drop';
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `Premieres ${day} ${time}`;
  } catch {
    return 'New Drop';
  }
}

exports.handler = async (event) => {
  console.log('Trailer worker invoked, Records:', event.Records?.length ?? 0);

  for (const record of event.Records || []) {
    let body;
    try {
      body = JSON.parse(record.body);
    } catch (e) {
      console.error('Invalid message body:', e.message);
      continue;
    }

    const {
      trailerId,
      dropId,
      ownerEmail,
      sourceVideoUrl,
      startTimeSec,
      endTimeSec,
      durationSec,
      username,
      scheduledDropDate,
    } = body;

    if (!trailerId || !ownerEmail || !sourceVideoUrl || startTimeSec == null || endTimeSec == null) {
      console.error('Missing required fields in message:', { trailerId, ownerEmail: !!ownerEmail, sourceVideoUrl: !!sourceVideoUrl });
      continue;
    }

    const duration = durationSec != null ? Number(durationSec) : (Number(endTimeSec) - Number(startTimeSec));
    const start = Number(startTimeSec);
    const premiereText = formatPremiereText(scheduledDropDate);
    const normalizedDropId = (dropId || '').replace(/^FILE#/, '');
    const sk = `TRAILER#${trailerId}`;
    const pk = `USER#${ownerEmail}`;

    try {
      await dynamodb.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: 'SET #status = :status, #updatedAt = :now',
        ExpressionAttributeNames: { '#status': 'status', '#updatedAt': 'updatedAt' },
        ExpressionAttributeValues: { ':status': 'PROCESSING', ':now': new Date().toISOString() },
      }));
      console.log('Set status PROCESSING for', trailerId);
    } catch (e) {
      console.error('Failed to set PROCESSING:', e.message);
      throw e;
    }

    const outputPath = `/tmp/trailer_${trailerId}.mp4`;
    const logoPath = '/tmp/twilly-trailer-logo.png';

    try {
      await downloadLogo(TWILLY_LOGO_URL, logoPath);
      await generateTrailerMp4({
        sourceUrl: sourceVideoUrl,
        startTimeSec: start,
        durationSec: duration,
        username: username || 'creator',
        premiereText,
        outputPath,
        logoPath: fs.existsSync(logoPath) ? logoPath : null,
      });
    } catch (err) {
      console.error('FFmpeg failed:', err.message);
      await dynamodb.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: 'SET #status = :status, #errorMessage = :err, #updatedAt = :now',
        ExpressionAttributeNames: { '#status': 'status', '#errorMessage': 'errorMessage', '#updatedAt': 'updatedAt' },
        ExpressionAttributeValues: {
          ':status': 'FAILED',
          ':err': (err.message || 'Unknown error').slice(0, 2000),
          ':now': new Date().toISOString(),
        },
      }));
      continue;
    } finally {
      try { if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath); } catch (_) {}
    }

    const fileSizeBytes = fs.statSync(outputPath).size;
    const s3Key = `trailers/${normalizedDropId || trailerId}/${trailerId}.mp4`;

    let body;
    try {
      body = fs.readFileSync(outputPath);
      await s3.send(new PutObjectCommand({
        Bucket: TRAILER_BUCKET,
        Key: s3Key,
        Body: body,
        ContentType: 'video/mp4',
      }));
    } catch (e) {
      console.error('S3 upload failed:', e.message);
      await dynamodb.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: 'SET #status = :status, #errorMessage = :err, #updatedAt = :now',
        ExpressionAttributeNames: { '#status': 'status', '#errorMessage': 'errorMessage', '#updatedAt': 'updatedAt' },
        ExpressionAttributeValues: {
          ':status': 'FAILED',
          ':err': `S3 upload failed: ${e.message}`.slice(0, 2000),
          ':now': new Date().toISOString(),
        },
      }));
      continue;
    } finally {
      try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) {}
    }

    const outputUrl = TRAILER_BASE_URL
      ? `${TRAILER_BASE_URL.replace(/\/$/, '')}/${s3Key}`
      : `https://${TRAILER_BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`;
    const now = new Date().toISOString();

    await dynamodb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk },
      UpdateExpression: 'SET #status = :status, #outputUrl = :url, #outputWidth = :w, #outputHeight = :h, #outputDurationSec = :dur, #fileSizeBytes = :size, #readyAt = :readyAt, #updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#outputUrl': 'outputUrl',
        '#outputWidth': 'outputWidth',
        '#outputHeight': 'outputHeight',
        '#outputDurationSec': 'outputDurationSec',
        '#fileSizeBytes': 'fileSizeBytes',
        '#readyAt': 'readyAt',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':status': 'READY',
        ':url': outputUrl,
        ':w': 1080,
        ':h': 1920,
        ':dur': duration,
        ':size': fileSizeBytes,
        ':readyAt': now,
        ':now': now,
      },
    }));

    console.log('Trailer READY:', trailerId, outputUrl);
  }

  return { statusCode: 200, body: 'OK' };
};
