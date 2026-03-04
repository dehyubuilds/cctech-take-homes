const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkVideoUsernames() {
  console.log('🔍 Checking usernames for Twilly TV videos...\n');
  
  try {
    const adminEmail = 'dehyu.sinyan@gmail.com';
    const channelName = 'Twilly TV';
    
    // Get all files from admin account
    const filesParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${adminEmail}`
      }
    };
    
    const filesResult = await dynamodb.query(filesParams).promise();
    const allFiles = filesResult.Items || [];
    
    // Filter for Twilly TV videos
    const twillyTVFiles = allFiles.filter(file => {
      if (!file || !file.fileName) return false;
      if (file.fileName.includes('_thumb.jpg')) return false;
      if (file.fileName.endsWith('.gif') && !file.fileName.includes('_0.gif')) return false;
      if (file.category !== 'Videos') return false;
      
      const hasHlsUrl = !!file.hlsUrl;
      const hasStreamKey = !!file.streamKey;
      const fileChannelName = file.folderName || file.seriesName;
      const folderMatch = fileChannelName === channelName || 
                         (fileChannelName && fileChannelName.toLowerCase() === channelName.toLowerCase());
      
      return hasHlsUrl && hasStreamKey && folderMatch;
    });
    
    console.log(`Found ${twillyTVFiles.length} Twilly TV videos\n`);
    
    for (const file of twillyTVFiles) {
      console.log(`📹 Video: ${file.fileName}`);
      console.log(`   SK: ${file.SK}`);
      console.log(`   streamKey: ${file.streamKey}`);
      console.log(`   creatorId: ${file.creatorId || 'MISSING'}`);
      console.log(`   Current creatorUsername: ${file.creatorUsername || 'MISSING'}`);
      console.log('');
      
      // Simulate get-content API username lookup
      let username = null;
      
      // Priority 1: Look up from creatorId
      if (file.creatorId) {
        try {
          const userParams = {
            TableName: table,
            Key: {
              PK: `USER#${file.creatorId}`,
              SK: 'PROFILE'
            }
          };
          const userResult = await dynamodb.get(userParams).promise();
          if (userResult.Item && userResult.Item.username) {
            username = userResult.Item.username;
            console.log(`   ✅ Found username from creatorId: ${username}`);
          } else {
            console.log(`   ❌ No profile found for creatorId: ${file.creatorId}`);
          }
        } catch (err) {
          console.log(`   ❌ Error looking up creatorId: ${err.message}`);
        }
      }
      
      // Priority 2: Look up from stream key mapping
      if (!username && file.streamKey) {
        try {
          const streamKeyParams = {
            TableName: table,
            Key: {
              PK: `STREAM_KEY#${file.streamKey}`,
              SK: 'MAPPING'
            }
          };
          const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
          
          if (streamKeyResult.Item) {
            const mapping = streamKeyResult.Item;
            console.log(`   Stream key mapping:`);
            console.log(`      creatorId: ${mapping.creatorId || 'MISSING'}`);
            console.log(`      collaboratorEmail: ${mapping.collaboratorEmail || mapping.ownerEmail || 'MISSING'}`);
            
            // Try to get username from stream key mapping's creatorId
            if (mapping.creatorId) {
              try {
                const userParams = {
                  TableName: table,
                  Key: {
                    PK: `USER#${mapping.creatorId}`,
                    SK: 'PROFILE'
                  }
                };
                const userResult = await dynamodb.get(userParams).promise();
                if (userResult.Item && userResult.Item.username) {
                  username = userResult.Item.username;
                  console.log(`   ✅ Found username from stream key mapping creatorId: ${username}`);
                }
              } catch (err) {
                console.log(`   ❌ Error looking up stream key mapping creatorId: ${err.message}`);
              }
            }
            
            // Fallback: Try to get username from collaboratorEmail
            if (!username && (mapping.collaboratorEmail || mapping.ownerEmail)) {
              const email = mapping.collaboratorEmail || mapping.ownerEmail;
              try {
                const userParams = {
                  TableName: table,
                  Key: {
                    PK: `USER#${email}`,
                    SK: 'PROFILE'
                  }
                };
                const userResult = await dynamodb.get(userParams).promise();
                if (userResult.Item && userResult.Item.username) {
                  username = userResult.Item.username;
                  console.log(`   ✅ Found username from stream key mapping email: ${username}`);
                }
              } catch (err) {
                console.log(`   ❌ Error looking up stream key mapping email: ${err.message}`);
              }
            }
          }
        } catch (err) {
          console.log(`   ❌ Error looking up stream key mapping: ${err.message}`);
        }
      }
      
      // Check if username would be filtered
      const invalidUsernames = ['googoogaga', 'yess', 'dehyuusername'];
      if (username && invalidUsernames.includes(username.toLowerCase())) {
        console.log(`   🚫 WOULD BE FILTERED: Invalid username '${username}'`);
      } else if (username) {
        console.log(`   ✅ Username '${username}' is valid - would NOT be filtered`);
      } else {
        console.log(`   ⚠️ No username found - would use email prefix fallback`);
        // Check what email prefix would be used
        const emailFromPK = adminEmail.split('@')[0];
        console.log(`      Email prefix would be: ${emailFromPK}`);
        if (invalidUsernames.includes(emailFromPK.toLowerCase())) {
          console.log(`   🚫 WOULD BE FILTERED: Email prefix '${emailFromPK}' is invalid`);
        }
      }
      
      console.log('\n' + '='.repeat(60) + '\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkVideoUsernames().catch(console.error);
