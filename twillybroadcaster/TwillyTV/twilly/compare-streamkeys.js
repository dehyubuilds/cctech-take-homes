const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function compareStreamKeys() {
  const adminStreamKey = 'sk_rrpls34e8m4t8g42'; // Working
  const nonAdminStreamKey = 'twillytvdur4k9l2'; // Not working
  
  console.log('🔍 Comparing streamKeys:\n');
  console.log(`Admin (working): ${adminStreamKey}`);
  console.log(`Non-admin (not working): ${nonAdminStreamKey}\n`);
  
  // Get both mappings
  const [adminMapping, nonAdminMapping] = await Promise.all([
    dynamodb.get({
      TableName: table,
      Key: { PK: `STREAM_KEY#${adminStreamKey}`, SK: 'MAPPING' }
    }).promise(),
    dynamodb.get({
      TableName: table,
      Key: { PK: `STREAM_KEY#${nonAdminStreamKey}`, SK: 'MAPPING' }
    }).promise()
  ]);
  
  console.log('📊 ADMIN STREAMKEY MAPPING:');
  console.log(JSON.stringify(adminMapping.Item, null, 2));
  console.log('\n📊 NON-ADMIN STREAMKEY MAPPING:');
  console.log(JSON.stringify(nonAdminMapping.Item, null, 2));
  
  console.log('\n\n🔍 DIFFERENCES:');
  const admin = adminMapping.Item || {};
  const nonAdmin = nonAdminMapping.Item || {};
  
  const keys = new Set([...Object.keys(admin), ...Object.keys(nonAdmin)]);
  for (const key of keys) {
    if (admin[key] !== nonAdmin[key]) {
      console.log(`\n${key}:`);
      console.log(`  Admin: ${JSON.stringify(admin[key])}`);
      console.log(`  Non-admin: ${JSON.stringify(nonAdmin[key])}`);
    }
  }
  
  // Check files
  console.log('\n\n📹 FILES:');
  const adminFiles = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND streamKey = :streamKey',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':skPrefix': 'FILE#',
      ':streamKey': adminStreamKey
    }
  }).promise();
  
  const nonAdminFiles = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND streamKey = :streamKey',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':skPrefix': 'FILE#',
      ':streamKey': nonAdminStreamKey
    }
  }).promise();
  
  console.log(`Admin files: ${adminFiles.Items?.length || 0}`);
  console.log(`Non-admin files: ${nonAdminFiles.Items?.length || 0}`);
}

compareStreamKeys().catch(console.error);
