const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

// Simulate the Lambda function logic
async function testLambdaLogic(streamKey) {
  console.log(`\n🧪 Testing Lambda function logic for streamKey: ${streamKey}`);
  console.log('=' .repeat(60));
  
  // Step 1: Get user info from streamKey (simulating getUserFromStreamKey)
  console.log('\nStep 1: Looking up streamKey mapping...');
  let userEmail = null;
  let folderName = null;
  let isPersonalKey = false;
  let isCollaboratorKey = false;
  
  try {
    const streamKeyParams = {
      TableName: 'Twilly',
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      }
    };
    const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
    
    if (streamKeyResult.Item) {
      // Handle both personal keys (ownerEmail) and collaborator keys (collaboratorEmail)
      if (streamKeyResult.Item.ownerEmail) {
        userEmail = streamKeyResult.Item.ownerEmail;
        isPersonalKey = true;
        console.log(`✅ Personal key found - ownerEmail: ${userEmail}`);
      } else if (streamKeyResult.Item.collaboratorEmail) {
        userEmail = streamKeyResult.Item.collaboratorEmail;
        isCollaboratorKey = streamKeyResult.Item.isCollaboratorKey || false;
        console.log(`✅ Collaborator key found - collaboratorEmail: ${userEmail}`);
        console.log(`   isCollaboratorKey: ${isCollaboratorKey}`);
      }
      
      // Handle both seriesName (personal) and channelName (collaborator)
      folderName = streamKeyResult.Item.seriesName || streamKeyResult.Item.channelName;
      console.log(`   folderName: ${folderName || 'N/A'}`);
    } else {
      console.log(`❌ StreamKey mapping not found`);
      return;
    }
  } catch (error) {
    console.error(`❌ Error looking up streamKey: ${error.message}`);
    return;
  }
  
  // Step 2: Get channel owner (for fallback only)
  console.log('\nStep 2: Looking up channel owner (for fallback only)...');
  let channelOwner = null;
  if (folderName) {
    try {
      const channelScan = await dynamodb.scan({
        TableName: 'Twilly',
        FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND channelName = :channelName',
        ExpressionAttributeValues: {
          ':pkPrefix': 'CHANNEL#',
          ':sk': 'METADATA',
          ':channelName': folderName
        },
        Limit: 1
      }).promise();
      
      if (channelScan.Items && channelScan.Items.length > 0) {
        channelOwner = channelScan.Items[0].creatorEmail;
        console.log(`✅ Channel owner: ${channelOwner}`);
      }
    } catch (error) {
      console.log(`⚠️ Could not get channel owner: ${error.message}`);
    }
  }
  
  // Step 3: Determine masterEmail (THIS IS THE CRITICAL PART)
  console.log('\nStep 3: Determining masterEmail (where file will be stored)...');
  
  // OLD LOGIC (WRONG):
  // const masterEmail = isPersonalKey ? userEmail : (channelOwner || 'dehyu.sinyan@gmail.com');
  // console.log(`❌ OLD LOGIC: masterEmail = ${masterEmail}`);
  // console.log(`   Problem: For collaborator streams, this uses channelOwner instead of userEmail!`);
  
  // NEW LOGIC (CORRECT):
  const masterEmail = userEmail || channelOwner || 'dehyu.sinyan@gmail.com';
  console.log(`✅ NEW LOGIC: masterEmail = ${masterEmail}`);
  console.log(`   userEmail from streamKey mapping: ${userEmail || 'N/A'}`);
  console.log(`   channelOwner: ${channelOwner || 'N/A'}`);
  console.log(`   isPersonalKey: ${isPersonalKey}`);
  console.log(`   isCollaboratorKey: ${isCollaboratorKey}`);
  
  if (isCollaboratorKey) {
    if (masterEmail === userEmail) {
      console.log(`\n   ✅ CORRECT: File will be stored under collaborator's email (${userEmail})`);
      console.log(`      This ensures get-content will find it when querying files from legitimate collaborators`);
    } else {
      console.log(`\n   ❌ WRONG: File will be stored under ${masterEmail} instead of collaborator's email (${userEmail})`);
      console.log(`      This means get-content won't find it because it queries files from ${userEmail}, not ${masterEmail}`);
    }
  } else if (isPersonalKey) {
    console.log(`\n   ✅ CORRECT: File will be stored under owner's email (${userEmail})`);
  }
  
  return { masterEmail, userEmail, channelOwner, isCollaboratorKey, folderName };
}

// Test with collaborator streams
async function runTests() {
  console.log('🧪 Testing Lambda function logic for collaborator streams\n');
  
  // Test 1: Last stream (collaborator)
  console.log('\n📋 TEST 1: Last stream (collaborator)');
  const test1 = await testLambdaLogic('twillyafterdark5zm836l5');
  
  // Test 2: Another collaborator stream
  console.log('\n\n📋 TEST 2: Another collaborator stream');
  const test2 = await testLambdaLogic('twillytvn2xif8y2');
  
  console.log('\n\n✅ All tests complete!');
  console.log('\n📊 SUMMARY:');
  console.log('   The Lambda function should use userEmail (from streamKey mapping) for ALL streams,');
  console.log('   whether personal or collaborator. This ensures collaborator videos are stored');
  console.log('   under the correct email and will be found by get-content when it queries files');
  console.log('   from legitimate collaborators.');
}

runTests().catch(console.error);
