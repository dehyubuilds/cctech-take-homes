#!/usr/bin/env node
/**
 * Check latest premium streams for Twilly TV: PREMIUM# timeline entries and
 * premium FILEs from subscribed creators. Use to debug "no content available" on Premium tab.
 *
 * Usage:
 *   node check-latest-premium-streams.js [viewerEmail]
 *   node check-latest-premium-streams.js              (list recent PREMIUM# across all users, then sample FILEs)
 *
 * Examples:
 *   node check-latest-premium-streams.js user@example.com
 */

const AWS = require('aws-sdk');

AWS.config.update({
  region: 'us-east-1',
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {}
    : {
        accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
        secretAccessKey: '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'
      })
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkViewer(viewerEmail) {
  const normalized = (viewerEmail || '').toLowerCase().trim();
  if (!normalized) return;

  console.log(`\n👑 Premium check for viewer: ${normalized}\n`);

  // 1) PREMIUM# timeline entries for this viewer
  const timelineRes = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${normalized}`,
      ':sk': 'PREMIUM#'
    },
    ScanIndexForward: false,
    Limit: 20
  }).promise();
  const timelineItems = timelineRes.Items || [];
  console.log(`  PREMIUM# timeline entries (viewer's feed): ${timelineItems.length}`);
  timelineItems.slice(0, 5).forEach((it, i) => {
    console.log(`    [${i + 1}] ${it.SK}  fileName=${it.fileName || '(n/a)'}  isPremium=${it.isPremium}`);
  });
  if (timelineItems.length > 5) console.log(`    ... and ${timelineItems.length - 5} more`);

  // 2) SUBSCRIBED_CREATOR# for this viewer
  const subRes = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${normalized}`,
      ':sk': 'SUBSCRIBED_CREATOR#'
    }
  }).promise();
  const subs = (subRes.Items || []).filter(it => it.status === 'active');
  const creatorEmails = subs.map(it => it.creatorEmail || (it.SK || '').replace('SUBSCRIBED_CREATOR#', '')).filter(Boolean);
  console.log(`  Subscribed creators (active): ${creatorEmails.length}`);
  creatorEmails.slice(0, 10).forEach((e, i) => console.log(`    ${i + 1}. ${e}`));
  if (creatorEmails.length > 10) console.log(`    ... and ${creatorEmails.length - 10} more`);

  // 3) For each subscribed creator, count premium FILEs
  let totalPremiumFiles = 0;
  for (const crEmail of creatorEmails.slice(0, 20)) {
    const cr = crEmail.toLowerCase();
    const fileRes = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': `USER#${cr}`, ':sk': 'FILE#' },
      Limit: 100
    }).promise();
    const files = fileRes.Items || [];
    const premium = files.filter(f => f.isPremium === true || f.isPremium === 'true' || f.isPremium === 1);
    if (premium.length > 0) {
      console.log(`  Creator ${cr}: ${premium.length} premium FILE(s)`);
      premium.slice(0, 3).forEach((f, i) => {
        console.log(`    - ${f.SK}  ${f.fileName || '(n/a)'}  visible=${f.isVisible}`);
      });
      totalPremiumFiles += premium.length;
    }
  }
  console.log(`  Total premium FILEs (from first 20 creators): ${totalPremiumFiles}`);
  console.log('');
}

/** Find most recent FILEs with isPremium true (where premium streams "land") */
async function listLastPremiumFiles() {
  console.log('\n📁 Last premium FILEs (where premium streams land in DynamoDB)...\n');
  const scanRes = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':sk': 'FILE#' },
    Limit: 300,
    ProjectionExpression: 'PK, SK, fileName, #ts, isVisible, isPremium, creatorEmail, #cat',
    ExpressionAttributeNames: { '#ts': 'timestamp', '#cat': 'category' }
  }).promise();
  const files = (scanRes.Items || [])
    .filter(f => f.isPremium === true || f.isPremium === 'true' || f.isPremium === 1)
    .sort((a, b) => {
      const t1 = (a.timestamp || a.createdAt || '').toString();
      const t2 = (b.timestamp || b.createdAt || '').toString();
      return t2.localeCompare(t1);
    });
  console.log(`  Found ${files.length} premium FILE(s). Latest 10:`);
  files.slice(0, 10).forEach((f, i) => {
    const ts = (f.timestamp || f.createdAt || '').slice(0, 24);
    console.log(`    ${i + 1}. PK=${f.PK}  SK=${(f.SK || '').slice(0, 50)}  fileName=${(f.fileName || 'n/a').slice(0, 35)}  isVisible=${f.isVisible}  ts=${ts}`);
  });
  if (files.length > 0) {
    const latest = files[0];
    const fileId = (latest.SK || '').replace('FILE#', '');
    console.log(`\n  → Your last premium stream likely landed at: PK=${latest.PK}, SK=${latest.SK}`);
    console.log(`  → To appear in Premium tab: (1) FILE must have isVisible=true after processing, (2) PREMIUM# timeline entries must exist for viewers (fan-out to subscribers).`);
  }
  console.log('');
}

async function listRecentPremiumGlobally() {
  console.log('\n👑 Scanning for recent PREMIUM# timeline entries (sample across table)...\n');
  const scanRes = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(SK, :pre)',
    ExpressionAttributeValues: { ':pre': 'PREMIUM#' },
    Limit: 50,
    ProjectionExpression: 'PK, SK, fileName, #ts, isPremium, creatorEmail',
    ExpressionAttributeNames: { '#ts': 'timestamp' }
  }).promise();
  const items = (scanRes.Items || []).slice().sort((a, b) => {
    const t1 = a.timestamp || a.createdAt || a.SK || '';
    const t2 = b.timestamp || b.createdAt || b.SK || '';
    return t2.localeCompare(t1);
  });
  console.log(`  Found ${items.length} PREMIUM# entries (sample):`);
  items.slice(0, 15).forEach((it, i) => {
    const ts = (it.timestamp || it.createdAt || it.SK || '').slice(0, 25);
    console.log(`    ${i + 1}. PK=${it.PK}  SK=${(it.SK || '').slice(0, 60)}...  fileName=${(it.fileName || 'n/a').slice(0, 30)}  ts≈${ts}`);
  });
  console.log('');
}

async function main() {
  const viewerEmail = process.argv[2];
  if (viewerEmail) {
    await checkViewer(viewerEmail);
  } else {
    await listLastPremiumFiles();
    await listRecentPremiumGlobally();
    console.log('Tip: pass viewer email to check that user’s premium timeline and subscriptions:');
    console.log('  node check-latest-premium-streams.js user@example.com\n');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
