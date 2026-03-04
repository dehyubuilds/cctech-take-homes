/**
 * Clear ALL videos for the Twilly TV channel (everything under the Twilly TV owner).
 * Deletes every FILE# item under USER#dehyu.sinyan@gmail.com plus their S3 objects.
 * Use this to wipe the Twilly TV public timeline and start fresh.
 *
 * Run from twilly folder: node clear-twilly-tv-videos.js
 */

const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3East1 = new AWS.S3({ region: 'us-east-1' });
const s3East2 = new AWS.S3({ region: 'us-east-2' });
const table = 'Twilly';

const TWILLY_TV_OWNER_EMAIL = 'dehyu.sinyan@gmail.com';

async function deleteS3ForFile(ownerEmail, fileName, streamKey, folderName) {
  const promises = [];
  const fn = fileName || '';
  const stream = streamKey || '';
  const folder = folderName || '';

  // clips/streamKey/filename (theprivatecollection, us-east-2)
  if (stream && (fn.endsWith('.m3u8') || fn.endsWith('.ts') || fn.endsWith('_thumb.jpg'))) {
    const uniquePrefix = fn.replace('_master.m3u8', '').replace('_thumb.jpg', '').replace('.m3u8', '');
    const thumbnailKey = `clips/${stream}/${uniquePrefix}_thumb.jpg`;
    const m3u8Key = `clips/${stream}/${fn}`;
    if (fn.endsWith('.m3u8')) {
      promises.push(
        s3East2.deleteObject({ Bucket: 'theprivatecollection', Key: m3u8Key }).promise()
          .catch(err => { console.log(`   S3 skip/fail: ${m3u8Key}: ${err.message}`); })
      );
    }
    promises.push(
      s3East2.deleteObject({ Bucket: 'theprivatecollection', Key: thumbnailKey }).promise()
        .catch(err => { console.log(`   S3 skip/fail: ${thumbnailKey}: ${err.message}`); })
    );
  }

  // twilly bucket (us-east-1)
  if (folder) {
    promises.push(
      s3East1.deleteObject({ Bucket: 'twilly', Key: `${ownerEmail}/${folder}/${fn}` }).promise()
        .catch(err => { console.log(`   S3 skip/fail: twilly/${ownerEmail}/${folder}/${fn}: ${err.message}`); })
    );
  }
  promises.push(
    s3East1.deleteObject({ Bucket: 'twilly', Key: `${ownerEmail}/${fn}` }).promise()
      .catch(err => { console.log(`   S3 skip/fail: twilly/${ownerEmail}/${fn}: ${err.message}`); })
  );

  if (fn.endsWith('.m3u8') || fn.endsWith('.ts')) {
    promises.push(
      s3East2.deleteObject({ Bucket: 'theprivatecollection', Key: `${ownerEmail}/mixed/${fn}` }).promise()
        .catch(err => { console.log(`   S3 skip/fail: theprivatecollection/${ownerEmail}/mixed/${fn}: ${err.message}`); })
    );
  }

  await Promise.allSettled(promises);
}

async function clearTwillyTVVideos() {
  const pk = `USER#${TWILLY_TV_OWNER_EMAIL}`;

  console.log('Clearing ALL videos for Twilly TV (every FILE# under owner)...');
  console.log(`  PK: ${pk}\n`);

  let toDelete = [];
  let lastKey = null;
  do {
    const params = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':sk': 'FILE#'
      },
      ExclusiveStartKey: lastKey
    };
    const result = await dynamodb.query(params).promise();
    toDelete = toDelete.concat(result.Items || []);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Found ${toDelete.length} FILE# item(s) to delete.\n`);

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  let deleted = 0;
  for (const file of toDelete) {
    const fileName = file.fileName || file.SK?.replace(/^FILE#/, '') || 'unknown';
    const streamKey = file.streamKey || file.folderPath;
    const folderName = file.folderName || file.seriesName;
    console.log(`Deleting: ${fileName} (${file.SK})`);

    try {
      await dynamodb.delete({
        TableName: table,
        Key: { PK: file.PK, SK: file.SK }
      }).promise();
      await deleteS3ForFile(TWILLY_TV_OWNER_EMAIL, fileName, streamKey, folderName);
      deleted++;
      console.log('  OK DynamoDB + S3\n');
    } catch (err) {
      console.error('  Error:', err.message, '\n');
    }
  }

  console.log(`Done. Deleted ${deleted} Twilly TV video(s).`);
}

clearTwillyTVVideos().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
