const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

// Simulate the createVideoEntryImmediately logic
async function testStreamKeyLookup(streamKey, userEmail, channelName) {
  console.log(`\n🧪 Testing streamKey lookup logic...`);
  console.log(`   streamKey: ${streamKey}`);
  console.log(`   userEmail (from request): ${userEmail}`);
  console.log(`   channelName: ${channelName}`);
  
  let creatorEmail = null;
  console.log(`\n🔍 Step 1: Looking up streamKey mapping for streamKey: ${streamKey}`);
  
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
      console.log(`✅ StreamKey mapping found:`);
      console.log(`   isCollaboratorKey: ${streamKeyResult.Item.isCollaboratorKey}`);
      console.log(`   collaboratorEmail: ${streamKeyResult.Item.collaboratorEmail || 'N/A'}`);
      console.log(`   ownerEmail: ${streamKeyResult.Item.ownerEmail || 'N/A'}`);
      console.log(`   creatorId: ${streamKeyResult.Item.creatorId || 'N/A'}`);
      console.log(`   channelName: ${streamKeyResult.Item.channelName || 'N/A'}`);
      
      // PRIORITY 1: For collaborator keys, ALWAYS use collaboratorEmail from mapping
      if (streamKeyResult.Item.isCollaboratorKey && streamKeyResult.Item.collaboratorEmail) {
        creatorEmail = streamKeyResult.Item.collaboratorEmail;
        console.log(`\n✅ PRIORITY 1: Using collaboratorEmail from streamKey mapping: ${creatorEmail}`);
        console.log(`   Note: Ignoring userEmail from request (${userEmail || 'N/A'}) - streamKey mapping is source of truth`);
      } 
      // PRIORITY 2: For owner keys, use ownerEmail from mapping
      else if (streamKeyResult.Item.ownerEmail) {
        creatorEmail = streamKeyResult.Item.ownerEmail;
        console.log(`\n✅ PRIORITY 2: Using ownerEmail from streamKey mapping: ${creatorEmail}`);
      }
    } else {
      console.log(`⚠️ StreamKey mapping not found for ${streamKey}`);
    }
  } catch (error) {
    console.error(`❌ Error looking up streamKey mapping: ${error.message}`);
  }
  
  // FALLBACK: If streamKey mapping lookup failed, use userEmail from request
  if (!creatorEmail && userEmail) {
    creatorEmail = userEmail;
    console.log(`\n⚠️ FALLBACK: Using userEmail from request: ${creatorEmail}`);
    console.log(`   WARNING: This should only happen if streamKey mapping is missing!`);
  }
  
  // Final fallback: If still not found, try to get it from channel metadata
  if (!creatorEmail && channelName) {
    console.log(`\n⚠️ FINAL FALLBACK: Attempting channel metadata lookup for channelName: ${channelName}`);
    try {
      const channelScan = await dynamodb.scan({
        TableName: 'Twilly',
        FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND channelName = :channelName',
        ExpressionAttributeValues: {
          ':pkPrefix': 'CHANNEL#',
          ':sk': 'METADATA',
          ':channelName': channelName
        },
        Limit: 1
      }).promise();
      
      if (channelScan.Items && channelScan.Items.length > 0) {
        creatorEmail = channelScan.Items[0].creatorEmail;
        if (creatorEmail) {
          console.log(`✅ Found creatorEmail from channel metadata: ${creatorEmail}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error looking up channel metadata: ${error.message}`);
    }
  }
  
  console.log(`\n📊 RESULT:`);
  console.log(`   Final creatorEmail: ${creatorEmail || 'NOT FOUND'}`);
  console.log(`   This is the email the file will be stored under: USER#${creatorEmail || 'N/A'}`);
  
  if (creatorEmail && userEmail && creatorEmail !== userEmail) {
    console.log(`\n   ✅ CORRECT: File will be stored under ${creatorEmail} (not ${userEmail})`);
    console.log(`      This ensures collaborator videos are stored under the correct owner`);
  } else if (creatorEmail && userEmail && creatorEmail === userEmail) {
    console.log(`\n   ✅ CORRECT: File will be stored under ${creatorEmail} (matches request)`);
  } else if (!creatorEmail) {
    console.log(`\n   ❌ ERROR: creatorEmail not found - file creation will fail`);
  }
  
  return creatorEmail;
}

// Test with the last stream
async function runTests() {
  console.log('🧪 Testing streamKey lookup logic for collaborator streams\n');
  console.log('=' .repeat(60));
  
  // Test 1: Last stream (collaborator stream)
  console.log('\n📋 TEST 1: Last stream (collaborator)');
  console.log('=' .repeat(60));
  const test1 = await testStreamKeyLookup(
    'twillyafterdark5zm836l5',
    'dehyubuilds@gmail.com', // This is what was sent in the request (WRONG)
    'Twilly After Dark'
  );
  
  // Test 2: Another collaborator stream
  console.log('\n\n📋 TEST 2: Another collaborator stream');
  console.log('=' .repeat(60));
  const test2 = await testStreamKeyLookup(
    'twillytvn2xif8y2',
    'dehyubuilds@gmail.com', // Wrong email
    'Twilly TV'
  );
  
  // Test 3: Owner stream (should use ownerEmail)
  console.log('\n\n📋 TEST 3: Owner stream');
  console.log('=' .repeat(60));
  // Find an owner stream key
  try {
    const ownerStreamScan = await dynamodb.scan({
      TableName: 'Twilly',
      FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND isCollaboratorKey = :isCollab',
      ExpressionAttributeValues: {
        ':pkPrefix': 'STREAM_KEY#',
        ':sk': 'MAPPING',
        ':isCollab': false
      },
      Limit: 1
    }).promise();
    
    if (ownerStreamScan.Items && ownerStreamScan.Items.length > 0) {
      const ownerStream = ownerStreamScan.Items[0];
      const streamKey = ownerStream.PK.replace('STREAM_KEY#', '');
      await testStreamKeyLookup(
        streamKey,
        ownerStream.ownerEmail || 'test@example.com',
        ownerStream.channelName || 'Test Channel'
      );
    } else {
      console.log('   ⚠️ No owner stream keys found for testing');
    }
  } catch (error) {
    console.log(`   ⚠️ Error finding owner stream: ${error.message}`);
  }
  
  console.log('\n\n✅ All tests complete!');
}

runTests().catch(console.error);
