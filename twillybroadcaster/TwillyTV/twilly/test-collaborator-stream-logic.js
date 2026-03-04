const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

/**
 * Test the collaborator stream logic
 * This simulates what createVideoEntryImmediately should do
 */
async function testCollaboratorStreamLogic(streamKey, userEmail, channelName) {
  console.log(`\n🧪 Testing collaborator stream logic...`);
  console.log(`   streamKey: ${streamKey}`);
  console.log(`   userEmail (from request): ${userEmail}`);
  console.log(`   channelName: ${channelName}`);
  
  let creatorEmail = null;
  
  // Step 1: Check streamKey mapping (PRIORITY 1)
  console.log(`\nStep 1: Checking streamKey mapping...`);
  try {
    const streamKeyParams = {
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      }
    };
    const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
    
    if (streamKeyResult.Item) {
      console.log(`   ✅ StreamKey mapping found:`);
      console.log(`      isCollaboratorKey: ${streamKeyResult.Item.isCollaboratorKey}`);
      console.log(`      collaboratorEmail: ${streamKeyResult.Item.collaboratorEmail || 'N/A'}`);
      console.log(`      ownerEmail: ${streamKeyResult.Item.ownerEmail || 'N/A'}`);
      console.log(`      creatorId: ${streamKeyResult.Item.creatorId || 'N/A'}`);
      console.log(`      channelName: ${streamKeyResult.Item.channelName || 'N/A'}`);
      
      // PRIORITY 1: For collaborator keys, ALWAYS use collaboratorEmail
      if (streamKeyResult.Item.isCollaboratorKey && streamKeyResult.Item.collaboratorEmail) {
        creatorEmail = streamKeyResult.Item.collaboratorEmail;
        console.log(`   ✅ Using creatorEmail from streamKey mapping (collaborator): ${creatorEmail}`);
        console.log(`      Note: Ignoring userEmail from request (${userEmail}) - streamKey mapping is source of truth`);
      } 
      // PRIORITY 2: For owner keys, use ownerEmail
      else if (streamKeyResult.Item.ownerEmail) {
        creatorEmail = streamKeyResult.Item.ownerEmail;
        console.log(`   ✅ Using creatorEmail from streamKey mapping (owner): ${creatorEmail}`);
      }
    } else {
      console.log(`   ⚠️ StreamKey mapping NOT FOUND`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }
  
  // Step 2: Fallback to userEmail if streamKey mapping not found
  if (!creatorEmail && userEmail) {
    creatorEmail = userEmail;
    console.log(`\nStep 2: Using userEmail from request as fallback: ${creatorEmail}`);
    console.log(`   WARNING: This should only happen if streamKey mapping is missing!`);
  }
  
  // Step 3: Final fallback to channel metadata
  if (!creatorEmail && channelName) {
    console.log(`\nStep 3: Attempting channel metadata lookup...`);
    try {
      const channelScan = await dynamodb.scan({
        TableName: table,
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
          console.log(`   ✅ Found creatorEmail from channel metadata: ${creatorEmail}`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Step 4: Verify result
  console.log(`\n📊 RESULT:`);
  if (creatorEmail) {
    console.log(`   ✅ creatorEmail determined: ${creatorEmail}`);
    
    // Check if this matches what we expect
    if (streamKey) {
      try {
        const streamKeyParams = {
          TableName: table,
          Key: {
            PK: `STREAM_KEY#${streamKey}`,
            SK: 'MAPPING'
          }
        };
        const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
        
        if (streamKeyResult.Item) {
          const expectedEmail = streamKeyResult.Item.collaboratorEmail || streamKeyResult.Item.ownerEmail;
          if (expectedEmail && creatorEmail === expectedEmail) {
            console.log(`   ✅ CORRECT: creatorEmail matches expected email from streamKey mapping`);
          } else if (expectedEmail && creatorEmail !== expectedEmail) {
            console.log(`   ❌ WRONG: creatorEmail (${creatorEmail}) doesn't match expected (${expectedEmail})`);
          }
        }
      } catch (error) {
        // Ignore
      }
    }
  } else {
    console.log(`   ❌ FAILED: Could not determine creatorEmail`);
  }
  
  return creatorEmail;
}

/**
 * Test with real streamKeys from the database
 */
async function testRealStreamKeys() {
  console.log('🔍 Testing with real streamKeys from database...\n');
  
  // Test 1: Collaborator stream (should use collaboratorEmail)
  console.log('='.repeat(60));
  console.log('TEST 1: Collaborator Stream');
  console.log('='.repeat(60));
  await testCollaboratorStreamLogic(
    'twillyafterdark5zm836l5',  // Collaborator streamKey
    'dehyubuilds@gmail.com',      // Wrong email (what might be in request)
    'Twilly After Dark'           // Channel name
  );
  
  // Test 2: Another collaborator stream
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Another Collaborator Stream');
  console.log('='.repeat(60));
  await testCollaboratorStreamLogic(
    'twillytvn2xif8y2',           // Collaborator streamKey
    'dehyubuilds@gmail.com',      // Wrong email (what might be in request)
    'Twilly TV'                    // Channel name
  );
  
  // Test 3: Check what happens with a non-existent streamKey
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Non-existent StreamKey (should fallback)');
  console.log('='.repeat(60));
  await testCollaboratorStreamLogic(
    'nonexistent123',             // Non-existent streamKey
    'dehsin365@gmail.com',         // Should use this as fallback
    'Twilly TV'                     // Channel name
  );
  
  console.log('\n✅ All tests complete!');
}

// Run tests
testRealStreamKeys().catch(console.error);
