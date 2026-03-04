const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function manuallyAddPOMJ() {
  console.log('🔧 [MANUAL] Manually creating ADDED_USERNAME entry for POM-J...\n');
  
  const twillyTVEmail = 'dehyu.sinyan@gmail.com';
  const pomJEmail = 'pomjfitness@gmail.com';
  
  // Step 1: Get POM-J's PROFILE to get username
  console.log('📋 Step 1: Getting POM-J PROFILE...');
  try {
    const profileParams = {
      TableName: table,
      Key: {
        PK: `USER#${pomJEmail.toLowerCase()}`,
        SK: 'PROFILE'
      }
    };
    const profileResult = await dynamodb.get(profileParams).promise();
    
    if (!profileResult.Item || !profileResult.Item.username) {
      console.log('❌ POM-J PROFILE not found or username not set');
      return;
    }
    
    const pomJUsername = profileResult.Item.username;
    console.log(`✅ Found POM-J username: "${pomJUsername}"`);
    
    // Step 2: Create ADDED_USERNAME entry
    console.log('\n📋 Step 2: Creating ADDED_USERNAME entry...');
    const addParams = {
      TableName: table,
      Item: {
        PK: `USER#${twillyTVEmail.toLowerCase()}`,
        SK: `ADDED_USERNAME#${pomJEmail.toLowerCase()}`,
        status: 'active',
        addedAt: new Date().toISOString(),
        streamerUsername: pomJUsername,
        streamerEmail: pomJEmail.toLowerCase(),
        streamerVisibility: 'public',
        autoAccepted: true
      }
    };
    
    console.log('Creating entry:');
    console.log(JSON.stringify(addParams.Item, null, 2));
    
    try {
      await dynamodb.put(addParams).promise();
      console.log('\n✅ Successfully created ADDED_USERNAME entry!');
      
      // Step 3: Verify it was created
      console.log('\n📋 Step 3: Verifying entry was created...');
      const verifyParams = {
        TableName: table,
        Key: {
          PK: `USER#${twillyTVEmail.toLowerCase()}`,
          SK: `ADDED_USERNAME#${pomJEmail.toLowerCase()}`
        }
      };
      const verifyResult = await dynamodb.get(verifyParams).promise();
      
      if (verifyResult.Item) {
        console.log('✅ Entry verified:');
        console.log(JSON.stringify(verifyResult.Item, null, 2));
      } else {
        console.log('❌ Entry not found after creation!');
      }
    } catch (error) {
      console.error('❌ Error creating entry:', error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

manuallyAddPOMJ().catch(console.error);
