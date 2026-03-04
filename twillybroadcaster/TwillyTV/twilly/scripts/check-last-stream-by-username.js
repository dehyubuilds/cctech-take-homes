#!/usr/bin/env node
/**
 * Check last video streamed (optionally private) for a username.
 * Usage: node check-last-stream-by-username.js [username]
 * Example: node check-last-stream-by-username.js dehswizzy
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

async function getEmailForUsername(username) {
  const scanParams = {
    TableName: table,
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: { ':sk': 'PROFILE' }
  };
  const result = await dynamodb.scan(scanParams).promise();
  const items = result.Items || [];
  const lower = username.trim().toLowerCase();
  const profile = items.find(
    (p) => p.username && p.username.trim().toLowerCase() === lower
  );
  return profile ? profile.PK.replace('USER#', '') : null;
}

async function main() {
  const input = process.argv[2] || 'dehswizzy';
  const isEmail = input.includes('@');
  let email;
  if (isEmail) {
    email = input.trim();
    console.log(`\n🔍 Checking last stream for email: ${email}\n`);
  } else {
    const username = input;
    console.log(`\n🔍 Checking last stream for username: ${username}\n`);
    email = await getEmailForUsername(username);
    if (!email) {
      console.log('❌ No user found with that username.');
      process.exit(1);
    }
    console.log(`✅ Email: ${email}\n`);
  }

  const queryParams = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${email}`,
      ':sk': 'FILE#'
    }
  };
  const result = await dynamodb.query(queryParams).promise();
  const items = result.Items || [];
  if (items.length === 0) {
    console.log('❌ No FILE items found for this user.');
    process.exit(0);
  }

  // Sort by timestamp or createdAt descending (newest first)
  const sorted = items.slice().sort((a, b) => {
    const t1 = a.timestamp || a.createdAt || '';
    const t2 = b.timestamp || b.createdAt || '';
    return t2.localeCompare(t1);
  });

  // Filter for private: creatorUsername contains 🔒 or isPrivateUsername true
  const privateOnly = sorted.filter(
    (f) =>
      (f.creatorUsername && f.creatorUsername.includes('🔒')) ||
      f.isPrivateUsername === true
  );
  const latest = sorted[0];

  console.log(`📺 Latest stream (most recent of ${sorted.length} FILE(s)):\n`);
  console.log('   SK:               ', latest.SK);
  console.log('   fileName:        ', latest.fileName || 'N/A');
  console.log('   title:           ', latest.title || 'N/A');
  console.log('   status:          ', latest.status ?? 'N/A');
  console.log('   isVisible:       ', latest.isVisible);
  console.log('   scheduledDropDate:', latest.scheduledDropDate ?? 'N/A');
  console.log('   releaseStatus:   ', latest.releaseStatus ?? 'N/A');
  console.log('   creatorUsername: ', latest.creatorUsername ?? 'N/A');
  console.log('   isPrivateUsername:', latest.isPrivateUsername);
  console.log('   thumbnailUrl:    ', latest.thumbnailUrl ? (latest.thumbnailUrl.length > 60 ? latest.thumbnailUrl.substring(0, 60) + '...' : latest.thumbnailUrl) : 'N/A');
  console.log('   streamKey:       ', latest.streamKey ?? 'N/A');
  console.log('   timestamp:       ', latest.timestamp ?? 'N/A');
  console.log('   createdAt:       ', latest.createdAt ?? 'N/A');
  if (privateOnly.length > 0 && privateOnly[0].SK !== latest.SK) {
    const lp = privateOnly[0];
    console.log('\n   (Last *private*: ' + lp.SK + ', status=' + (lp.status ?? 'N/A') + ', scheduledDropDate=' + (lp.scheduledDropDate ?? 'N/A') + ', thumbnail=' + (lp.thumbnailUrl ? 'YES' : 'NO') + ')');
  }
  console.log('');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
