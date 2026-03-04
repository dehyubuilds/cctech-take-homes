/**
 * One-time script: Remove short video clips (< 6 seconds) across ALL accounts.
 * - Scans DynamoDB Twilly table for all FILE items (PK=USER#*, SK=FILE#*).
 * - Short = item.durationSeconds < 6, OR (if no durationSeconds) duration from HLS < 6s.
 * - Deletes those FILE items from DynamoDB.
 *
 * Usage:
 *   cd TwillyTV/twilly && node scripts/remove-short-clips-all-accounts.js
 *
 * AWS: Uses AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION (default us-east-1).
 *      Or use AWS_PROFILE.
 */

const AWS = require('aws-sdk');
const https = require('https');
const { URL } = require('url');

const MIN_DURATION_SECONDS = 6;
const TABLE_NAME = 'Twilly';

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  AWS.config.update({
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
} else {
  AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });
}

const dynamodb = new AWS.DynamoDB.DocumentClient();

function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { hostname: u.hostname, path: u.pathname + u.search, method: 'GET' };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

/**
 * Parse HLS media playlist and return total duration in seconds.
 * Handles #EXTINF:duration, (e.g. #EXTINF:2.0, or #EXTINF:2.000,)
 */
function parseMediaPlaylistDuration(body) {
  const extinf = /#EXTINF:(\d+(?:\.\d+)?)\s*,/g;
  let total = 0;
  let m;
  while ((m = extinf.exec(body)) !== null) total += parseFloat(m[1]);
  return total;
}

/**
 * Get duration in seconds from an HLS URL (master or media playlist).
 */
async function getDurationFromHls(hlsUrl) {
  let body = await get(hlsUrl);
  if (!body || typeof body !== 'string') return null;

  // Master playlist: pick first variant and fetch it
  if (body.includes('#EXT-X-STREAM-INF')) {
    const lines = body.split(/\r?\n/);
    let variantUrl = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
        const next = lines[i + 1];
        if (next && !next.startsWith('#')) {
          variantUrl = next.trim();
          break;
        }
      }
    }
    if (!variantUrl) return null;
    const base = new URL(hlsUrl);
    const resolved = new URL(variantUrl, base.origin + base.pathname.replace(/\/[^/]*$/, '/'));
    body = await get(resolved.toString());
    if (!body || typeof body !== 'string') return null;
  }

  return parseMediaPlaylistDuration(body);
}

async function scanAllFileItems() {
  const items = [];
  let lastKey = null;
  do {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':sk': 'FILE#' },
      ExclusiveStartKey: lastKey || undefined
    };
    const result = await dynamodb.scan(params).promise();
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey || null;
  } while (lastKey);
  return items;
}

async function main() {
  console.log('Scanning Twilly for all FILE items (all accounts)...\n');
  const allFiles = await scanAllFileItems();
  console.log(`Found ${allFiles.length} FILE items.\n`);

  const toDelete = [];
  let checkedHls = 0;
  let skippedNoDuration = 0;

  for (const item of allFiles) {
    const pk = item.PK;
    const sk = item.SK;
    const hasStored = item.durationSeconds != null && typeof item.durationSeconds === 'number';

    if (hasStored) {
      if (item.durationSeconds < MIN_DURATION_SECONDS) {
        toDelete.push({ PK: pk, SK: sk, reason: `durationSeconds=${item.durationSeconds}` });
      }
      continue;
    }

    const hlsUrl = item.hlsUrl || item.url;
    if (!hlsUrl || typeof hlsUrl !== 'string') {
      skippedNoDuration++;
      continue;
    }

    try {
      checkedHls++;
      const duration = await getDurationFromHls(hlsUrl);
      if (duration != null && duration < MIN_DURATION_SECONDS) {
        toDelete.push({ PK: pk, SK: sk, reason: `hls duration=${duration.toFixed(1)}s` });
      }
    } catch (e) {
      console.warn(`  Skip ${sk}: could not get duration (${e.message})`);
    }
  }

  console.log(`Short clips to delete: ${toDelete.length}`);
  console.log(`Checked via HLS: ${checkedHls}, skipped (no url/duration): ${skippedNoDuration}\n`);

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  let deleted = 0;
  for (const { PK, SK, reason } of toDelete) {
    try {
      await dynamodb.delete({
        TableName: TABLE_NAME,
        Key: { PK, SK }
      }).promise();
      deleted++;
      console.log(`  Deleted ${SK} (${reason})`);
    } catch (e) {
      console.error(`  Failed to delete ${SK}: ${e.message}`);
    }
  }

  console.log(`\nDone. Deleted ${deleted} short clips.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
