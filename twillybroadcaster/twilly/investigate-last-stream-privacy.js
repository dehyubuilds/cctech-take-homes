const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

async function investigateLastStream() {
  console.log('🔍 Investigating Last Stream Privacy Issue...\n');
  
  try {
    // 1. Get the most recent video entry
    console.log('1️⃣ Finding most recent video entry...');
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':sk': 'FILE#'
      },
      Limit: 1
    };
    
    // Get all files and sort by timestamp
    const allFiles = await dynamodb.scan({
      TableName: 'Twilly',
      FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':sk': 'FILE#'
      }
    }).promise();
    
    if (!allFiles.Items || allFiles.Items.length === 0) {
      console.log('❌ No video entries found');
      return;
    }
    
    // Sort by timestamp (most recent first)
    const sortedFiles = allFiles.Items.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt || 0);
      const timeB = new Date(b.timestamp || b.createdAt || 0);
      return timeB - timeA;
    });
    
    const lastVideo = sortedFiles[0];
    console.log('✅ Found most recent video:');
    console.log(`   FileId: ${lastVideo.SK}`);
    console.log(`   FileName: ${lastVideo.fileName || 'N/A'}`);
    console.log(`   StreamKey: ${lastVideo.streamKey || 'N/A'}`);
    console.log(`   Timestamp: ${lastVideo.timestamp || lastVideo.createdAt || 'N/A'}`);
    console.log(`   isPrivateUsername: ${JSON.stringify(lastVideo.isPrivateUsername)} (type: ${typeof lastVideo.isPrivateUsername})`);
    console.log(`   isVisible: ${lastVideo.isVisible}`);
    
    // 2. Check the streamKey mapping
    if (lastVideo.streamKey) {
      console.log('\n2️⃣ Checking streamKey mapping...');
      const streamKeyParams = {
        TableName: 'Twilly',
        Key: {
          PK: `STREAM_KEY#${lastVideo.streamKey}`,
          SK: 'MAPPING'
        }
      };
      
      const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
      if (streamKeyResult.Item) {
        console.log('✅ Found streamKey mapping:');
        console.log(`   StreamKey: ${lastVideo.streamKey}`);
        console.log(`   isPrivateUsername: ${JSON.stringify(streamKeyResult.Item.isPrivateUsername)} (type: ${typeof streamKeyResult.Item.isPrivateUsername})`);
        console.log(`   streamUsername: ${streamKeyResult.Item.streamUsername || 'N/A'}`);
        console.log(`   creatorId: ${streamKeyResult.Item.creatorId || 'N/A'}`);
        console.log(`   userEmail: ${streamKeyResult.Item.collaboratorEmail || streamKeyResult.Item.ownerEmail || 'N/A'}`);
      } else {
        console.log('❌ StreamKey mapping NOT FOUND');
      }
    }
    
    // 3. Check if there are multiple entries for this fileName (Lambda might have created a duplicate)
    if (lastVideo.fileName) {
      console.log('\n3️⃣ Checking for duplicate entries with same fileName...');
      const duplicateCheck = await dynamodb.scan({
        TableName: 'Twilly',
        FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk) AND fileName = :fileName',
        ExpressionAttributeValues: {
          ':pk': 'USER#dehyu.sinyan@gmail.com',
          ':sk': 'FILE#',
          ':fileName': lastVideo.fileName
        }
      }).promise();
      
      if (duplicateCheck.Items && duplicateCheck.Items.length > 1) {
        console.log(`⚠️ Found ${duplicateCheck.Items.length} entries with same fileName!`);
        duplicateCheck.Items.forEach((item, idx) => {
          console.log(`   Entry ${idx + 1}:`);
          console.log(`      SK: ${item.SK}`);
          console.log(`      isPrivateUsername: ${JSON.stringify(item.isPrivateUsername)}`);
          console.log(`      timestamp: ${item.timestamp || item.createdAt || 'N/A'}`);
        });
      } else {
        console.log('✅ No duplicate entries found');
      }
    }
    
    // 4. Check EC2 logs (if we can access them)
    console.log('\n4️⃣ Summary:');
    const videoIsPrivate = lastVideo.isPrivateUsername === true || 
                          lastVideo.isPrivateUsername === 'true' || 
                          lastVideo.isPrivateUsername === 1;
    
    if (videoIsPrivate) {
      console.log('✅ Video is marked as PRIVATE in DynamoDB');
    } else {
      console.log('❌ Video is marked as PUBLIC in DynamoDB (or undefined)');
      console.log('   This is the problem - isPrivateUsername is not set correctly');
    }
    
    console.log('\n📋 Next steps to investigate:');
    console.log('   1. Check EC2 logs for createVideoEntryImmediately call');
    console.log('   2. Check Lambda logs for this stream');
    console.log('   3. Verify mobile app actually set privacy before streaming');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

investigateLastStream();
