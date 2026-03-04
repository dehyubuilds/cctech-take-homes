const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function testTitlePersistence() {
  try {
    // Test: Find a recent video file
    console.log('🔍 Testing title persistence...\n');
    
    // Query for recent files (adjust email as needed)
    const testEmail = 'dehyu.sinyan@gmail.com'; // Twilly TV email
    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${testEmail}`,
        ':skPrefix': 'FILE#'
      },
      Limit: 5,
      ScanIndexForward: false // Most recent first
    };
    
    const result = await dynamodb.query(queryParams).promise();
    
    if (!result.Items || result.Items.length === 0) {
      console.log('❌ No files found for testing');
      return;
    }
    
    console.log(`✅ Found ${result.Items.length} files\n`);
    
    // Check each file for title
    result.Items.forEach((item, index) => {
      console.log(`[File ${index + 1}]`);
      console.log(`  PK: ${item.PK}`);
      console.log(`  SK: ${item.SK}`);
      console.log(`  fileName: ${item.fileName || 'MISSING'}`);
      console.log(`  title: ${item.title !== undefined ? `"${item.title}"` : 'NOT SET'} (type: ${typeof item.title})`);
      console.log(`  fileId: ${item.fileId || 'NOT SET'}`);
      console.log(`  uploadId: ${item.uploadId || 'NOT SET'}`);
      console.log('');
    });
    
    // Test update on first file
    const testFile = result.Items[0];
    const testTitle = `Test Title ${Date.now()}`;
    
    console.log(`\n🧪 Testing title update...`);
    console.log(`  File: ${testFile.SK}`);
    console.log(`  Current title: ${testFile.title || 'NONE'}`);
    console.log(`  New title: "${testTitle}"`);
    
    // Update the title
    const updateParams = {
      TableName: table,
      Key: {
        PK: testFile.PK,
        SK: testFile.SK // Use full SK format
      },
      UpdateExpression: 'SET #title = :title',
      ExpressionAttributeNames: {
        '#title': 'title'
      },
      ExpressionAttributeValues: {
        ':title': testTitle
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const updateResult = await dynamodb.update(updateParams).promise();
    console.log(`\n✅ Title updated successfully!`);
    console.log(`  Updated title: "${updateResult.Attributes.title}"`);
    
    // Verify by reading it back
    console.log(`\n🔍 Verifying title was saved...`);
    const verifyParams = {
      TableName: table,
      Key: {
        PK: testFile.PK,
        SK: testFile.SK
      }
    };
    
    const verifyResult = await dynamodb.get(verifyParams).promise();
    if (verifyResult.Item) {
      console.log(`  ✅ Title in DB: "${verifyResult.Item.title || 'NOT SET'}"`);
      if (verifyResult.Item.title === testTitle) {
        console.log(`  ✅ SUCCESS: Title matches!`);
      } else {
        console.log(`  ❌ FAIL: Title mismatch!`);
      }
    } else {
      console.log(`  ❌ File not found after update!`);
    }
    
    // Test what get-content would return
    console.log(`\n🔍 Testing get-content query...`);
    const getContentParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${testEmail}`,
        ':skPrefix': 'FILE#'
      },
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `USER#${testEmail}`,
        ':skPrefix': 'FILE#',
        ':sk': testFile.SK
      }
    };
    
    // Actually, let's just query and filter in code
    const queryParams2 = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${testEmail}`,
        ':skPrefix': 'FILE#'
      }
    };
    
    const queryResult = await dynamodb.query(queryParams2).promise();
    const foundFile = queryResult.Items.find(item => item.SK === testFile.SK);
    
    if (foundFile) {
      console.log(`  ✅ File found in query`);
      console.log(`  Title in query result: ${foundFile.title !== undefined ? `"${foundFile.title}"` : 'NOT SET'}`);
      if (foundFile.title === testTitle) {
        console.log(`  ✅ SUCCESS: Title is returned by query!`);
      } else {
        console.log(`  ❌ FAIL: Title not returned correctly!`);
      }
    } else {
      console.log(`  ❌ File not found in query!`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testTitlePersistence();
