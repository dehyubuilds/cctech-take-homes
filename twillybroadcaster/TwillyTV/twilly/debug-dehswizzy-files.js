const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findDehswizzyFiles() {
  console.log('🔍 Finding dehswizzy files by userId...\n');

  const userId = 'f6ff9d4d-fb19-425c-94cb-617a9ee6f7fc';
  const email = 'dehsin365@gmail.com';
  const streamKeys = ['twillyafterdark5zm836l5', 'twillytvn2xif8y2'];

  // Check files under userId
  console.log(`Checking files under USER#${userId}...`);
  try {
    const fileQuery = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': 'FILE#'
      }
    }).promise();

    if (fileQuery.Items && fileQuery.Items.length > 0) {
      console.log(`✅ Found ${fileQuery.Items.length} files under userId:`);
      fileQuery.Items.forEach((file, idx) => {
        console.log(`   [${idx}] fileName: ${file.fileName || 'N/A'}`);
        console.log(`       folderName: ${file.folderName || 'N/A'}, seriesName: ${file.seriesName || 'N/A'}`);
        console.log(`       streamKey: ${file.streamKey || 'N/A'}`);
        console.log(`       isVisible: ${file.isVisible}, hasHls: ${!!file.hlsUrl}`);
        console.log(`       createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
      });
    } else {
      console.log(`⚠️ No files found under userId`);
    }
  } catch (error) {
    console.error(`❌ Error querying files for userId:`, error.message);
  }

  // Check files under email
  console.log(`\nChecking files under USER#${email}...`);
  try {
    const fileQuery = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
        ':skPrefix': 'FILE#'
      }
    }).promise();

    if (fileQuery.Items && fileQuery.Items.length > 0) {
      console.log(`✅ Found ${fileQuery.Items.length} files under email:`);
      fileQuery.Items.forEach((file, idx) => {
        console.log(`   [${idx}] fileName: ${file.fileName || 'N/A'}`);
        console.log(`       folderName: ${file.folderName || 'N/A'}, seriesName: ${file.seriesName || 'N/A'}`);
        console.log(`       streamKey: ${file.streamKey || 'N/A'}`);
        console.log(`       isVisible: ${file.isVisible}, hasHls: ${!!file.hlsUrl}`);
        console.log(`       createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
      });
    } else {
      console.log(`⚠️ No files found under email`);
    }
  } catch (error) {
    console.error(`❌ Error querying files for email:`, error.message);
  }

  // Search for files by streamKey across all users
  console.log(`\nSearching for files by streamKey across all users...`);
  for (const streamKey of streamKeys) {
    try {
      const fileScan = await dynamodb.scan({
        TableName: table,
        FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND streamKey = :streamKey',
        ExpressionAttributeValues: {
          ':pkPrefix': 'USER#',
          ':skPrefix': 'FILE#',
          ':streamKey': streamKey
        }
      }).promise();

      if (fileScan.Items && fileScan.Items.length > 0) {
        console.log(`✅ Found ${fileScan.Items.length} file(s) with streamKey ${streamKey}:`);
        fileScan.Items.forEach((file, idx) => {
          const owner = file.PK ? file.PK.replace('USER#', '') : 'unknown';
          console.log(`   [${idx}] Owner: ${owner}`);
          console.log(`       fileName: ${file.fileName || 'N/A'}`);
          console.log(`       folderName: ${file.folderName || 'N/A'}, seriesName: ${file.seriesName || 'N/A'}`);
          console.log(`       isVisible: ${file.isVisible}, hasHls: ${!!file.hlsUrl}`);
          console.log(`       createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
        });
      } else {
        console.log(`⚠️ No files found with streamKey: ${streamKey}`);
      }
    } catch (error) {
      console.error(`❌ Error scanning for streamKey ${streamKey}:`, error.message);
    }
  }

  console.log('\n✅ Search complete!');
}

findDehswizzyFiles().catch(console.error);
