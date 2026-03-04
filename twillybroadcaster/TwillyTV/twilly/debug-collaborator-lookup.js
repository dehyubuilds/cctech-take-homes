const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function debugCollaboratorLookup() {
  console.log('🔍 Debugging collaborator lookup...\n');

  const channelName = 'Twilly After Dark';
  const userId = 'f6ff9d4d-fb19-425c-94cb-617a9ee6f7fc'; // From streamKey mapping
  const expectedEmail = 'dehsin365@gmail.com';

  // Step 1: Check collaborator role directly
  console.log('Step 1: Checking collaborator role directly...');
  try {
    const roleCheck = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userId}`,
        SK: `COLLABORATOR_ROLE#${channelName}`
      }
    }).promise();

    if (roleCheck.Item) {
      console.log(`   ✅ Collaborator role found:`);
      console.log(`      channelName: ${roleCheck.Item.channelName}`);
      console.log(`      channelId: ${roleCheck.Item.channelId || 'N/A'}`);
      console.log(`      addedViaInvite: ${roleCheck.Item.addedViaInvite}`);
      console.log(`      status: ${roleCheck.Item.status || 'N/A'}`);
    } else {
      console.log(`   ❌ Collaborator role NOT FOUND`);
      console.log(`      Looking for: PK=USER#${userId}, SK=COLLABORATOR_ROLE#${channelName}`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  // Step 2: Check user profile
  console.log(`\nStep 2: Checking user profile for userId ${userId}...`);
  try {
    const userProfile = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE'
      }
    }).promise();

    if (userProfile.Item) {
      console.log(`   ✅ User profile found:`);
      console.log(`      email: ${userProfile.Item.email || userProfile.Item.userEmail || 'N/A'}`);
      console.log(`      username: ${userProfile.Item.username || userProfile.Item.userName || 'N/A'}`);
      
      const email = userProfile.Item.email || userProfile.Item.userEmail;
      if (email === expectedEmail) {
        console.log(`   ✅ Email matches expected: ${expectedEmail}`);
      } else {
        console.log(`   ⚠️ Email doesn't match: ${email} vs ${expectedEmail}`);
      }
    } else {
      console.log(`   ❌ User profile NOT FOUND`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  // Step 3: Try the scan that get-content uses
  console.log(`\nStep 3: Testing the scan that get-content uses...`);
  try {
    const collaboratorScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND channelName = :channelName AND addedViaInvite = :addedViaInvite AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'COLLABORATOR_ROLE#',
        ':channelName': channelName,
        ':addedViaInvite': true,
        ':status': 'active'
      }
    }).promise();

    if (collaboratorScan.Items && collaboratorScan.Items.length > 0) {
      console.log(`   ✅ Found ${collaboratorScan.Items.length} collaborator role(s):`);
      for (const role of collaboratorScan.Items) {
        const roleUserId = role.PK ? role.PK.replace('USER#', '') : 'unknown';
        console.log(`      userId: ${roleUserId}`);
        console.log(`      channelName: ${role.channelName}`);
        console.log(`      addedViaInvite: ${role.addedViaInvite}`);
        console.log(`      status: ${role.status || 'N/A'}`);
        
        // Try to get email
        try {
          const userProfile = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `USER#${roleUserId}`,
              SK: 'PROFILE'
            }
          }).promise();

          if (userProfile.Item) {
            const email = userProfile.Item.email || userProfile.Item.userEmail;
            console.log(`      email: ${email || 'N/A'}`);
            if (email === expectedEmail) {
              console.log(`      ✅ This is the expected collaborator!`);
            }
          }
        } catch (err) {
          console.log(`      ⚠️ Could not get email for userId ${roleUserId}`);
        }
      }
    } else {
      console.log(`   ⚠️ No collaborator roles found with scan`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  console.log('\n✅ Debug complete!');
}

debugCollaboratorLookup().catch(console.error);
