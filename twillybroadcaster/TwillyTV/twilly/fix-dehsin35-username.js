const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function fixDehsin35Username() {
  console.log('🔧 Fixing dehsin35 username in PROFILE...\n');
  
  const email = 'jsinyan03@gmail.com';
  const username = 'dehsin35';
  
  try {
    // Update PROFILE to add username field
    const updateParams = {
      TableName: table,
      Key: {
        PK: `USER#${email}`,
        SK: 'PROFILE'
      },
      UpdateExpression: 'SET username = :username, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':username': username,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    console.log(`📝 Updating PROFILE for ${email}...`);
    const result = await dynamodb.update(updateParams).promise();
    
    console.log(`✅ Successfully updated PROFILE:`);
    console.log(`   username: "${result.Attributes.username}"`);
    console.log(`   usernameVisibility: "${result.Attributes.usernameVisibility}"`);
    console.log(`   email: ${result.Attributes.email || email}`);
    
    // Verify it's now in GSI
    console.log(`\n🔍 Verifying GSI lookup...`);
    const gsiParams = {
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
      ExpressionAttributeValues: {
        ':visibility': 'public',
        ':username': username
      },
      Limit: 1
    };
    
    // Wait a moment for GSI to update
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const gsiResult = await dynamodb.query(gsiParams).promise();
    if (gsiResult.Items && gsiResult.Items.length > 0) {
      console.log(`✅ FOUND in GSI! Username lookup will now work.`);
    } else {
      console.log(`⚠️ Not yet in GSI (may take a few seconds to index)`);
    }
    
    console.log('\n✅ Fix complete!');
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
    throw error;
  }
}

fixDehsin35Username().catch(console.error);
