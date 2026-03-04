const AWS = require('aws-sdk');
require('dotenv').config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function testExactFlow() {
  console.log('\n🔍 TRACING EXACT BACKEND LOGIC\n');
  
  // Simulate exact request
  let ownerUsername = 'Twilly TV';
  let viewerUsername = 'dehyuusername';
  let ownerEmail = 'dehyu.sinyan@gmail.com';
  
  console.log('📥 REQUEST RECEIVED:');
  console.log(`   ownerUsername: "${ownerUsername}"`);
  console.log(`   viewerUsername: "${viewerUsername}"`);
  console.log(`   ownerEmail: "${ownerEmail}"`);
  
  // Step 1: Normalize
  console.log('\n📋 STEP 1: Normalize inputs');
  ownerUsername = ownerUsername.trim();
  viewerUsername = viewerUsername.trim();
  if (ownerEmail) {
    ownerEmail = ownerEmail.toLowerCase().trim();
  }
  console.log(`   After normalization:`);
  console.log(`   ownerUsername: "${ownerUsername}"`);
  console.log(`   ownerEmail: "${ownerEmail}"`);
  
  // Step 2: Find owner
  console.log('\n📋 STEP 2: Find OWNER');
  let ownerUser = null;
  let resolvedOwnerEmail = null;
  
  if (ownerEmail) {
    console.log(`   ✅ ownerEmail exists, using email lookup`);
    try {
      const normalizedEmail = ownerEmail.toLowerCase().trim();
      console.log(`   Normalized email: "${normalizedEmail}"`);
      console.log(`   PK: USER#${normalizedEmail}`);
      console.log(`   SK: PROFILE`);
      
      const profileParams = {
        TableName: table,
        Key: {
          PK: `USER#${normalizedEmail}`,
          SK: 'PROFILE'
        }
      };
      
      const profileResult = await dynamodb.get(profileParams).promise();
      console.log(`   DynamoDB result: ${profileResult.Item ? 'FOUND' : 'NOT FOUND'}`);
      
      if (profileResult.Item) {
        ownerUser = profileResult.Item;
        resolvedOwnerEmail = normalizedEmail;
        console.log(`   ✅ SUCCESS: Found owner`);
        console.log(`      Username: "${ownerUser.username}"`);
        console.log(`      Email: ${resolvedOwnerEmail}`);
        console.log(`      Visibility: ${ownerUser.usernameVisibility || 'public'}`);
      } else {
        console.log(`   ❌ FAILED: PROFILE not found`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  } else {
    console.log(`   ❌ No ownerEmail provided`);
  }
  
  console.log(`\n   After email lookup: ownerUser=${!!ownerUser}, resolvedOwnerEmail=${resolvedOwnerEmail || 'null'}`);
  
  // Step 3: Check if owner found
  if (!ownerUser || !resolvedOwnerEmail) {
    console.log(`\n❌ OWNER NOT FOUND - Would throw error here`);
    console.log(`   This is where the endpoint fails!`);
    return;
  }
  
  console.log(`\n✅ OWNER FOUND - Continuing to viewer lookup...`);
  
  // Step 4: Find viewer
  console.log(`\n📋 STEP 3: Find VIEWER`);
  const viewerUsernameLower = viewerUsername.toLowerCase();
  let viewerUser = null;
  let resolvedViewerEmail = null;
  
  // Try GSI lookup
  for (const visibility of ['public', 'private']) {
    const queryParams = {
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
      ExpressionAttributeValues: {
        ':visibility': visibility,
        ':username': viewerUsername
      },
      Limit: 1
    };
    
    try {
      const result = await dynamodb.query(queryParams).promise();
      if (result.Items && result.Items.length > 0) {
        const foundUser = result.Items[0];
        if (foundUser.username && foundUser.username.toLowerCase() === viewerUsernameLower) {
          viewerUser = foundUser;
          resolvedViewerEmail = foundUser.PK?.replace('USER#', '') || foundUser.email;
          console.log(`   ✅ Found viewer via GSI ${visibility}: "${foundUser.username}" (${resolvedViewerEmail})`);
          break;
        }
      }
    } catch (error) {
      console.log(`   ⚠️ GSI ${visibility} error: ${error.message}`);
    }
  }
  
  if (!viewerUser) {
    console.log(`   ❌ VIEWER NOT FOUND`);
    return;
  }
  
  console.log(`\n✅ BOTH OWNER AND VIEWER FOUND`);
  console.log(`   Owner: "${ownerUser.username}" (${resolvedOwnerEmail})`);
  console.log(`   Viewer: "${viewerUser.username}" (${resolvedViewerEmail})`);
  console.log(`\n✅ ENDPOINT SHOULD SUCCEED`);
}

testExactFlow().catch(console.error);
