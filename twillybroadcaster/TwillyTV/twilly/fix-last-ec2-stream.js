const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function fixLastEC2Stream() {
  console.log('🔧 Fixing last EC2 stream file location...\n');

  const streamKey = 'twillyafterdark5zm836l5';
  const wrongOwner = 'dehyubuilds@gmail.com';
  const correctOwner = 'dehsin365@gmail.com';

  // Find the file under wrong owner
  console.log('Finding file under wrong owner...');
  try {
    const wrongOwnerFiles = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'streamKey = :streamKey',
      ExpressionAttributeValues: {
        ':pk': `USER#${wrongOwner}`,
        ':skPrefix': 'FILE#',
        ':streamKey': streamKey
      }
    }).promise();

    if (wrongOwnerFiles.Items && wrongOwnerFiles.Items.length > 0) {
      // Sort by createdAt (newest first)
      const sortedFiles = wrongOwnerFiles.Items.sort((a, b) => {
        const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
        const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
        return bTime - aTime;
      });

      const mostRecent = sortedFiles[0];
      console.log(`✅ Found file: ${mostRecent.fileName}`);
      console.log(`   Created: ${mostRecent.createdAt || mostRecent.timestamp}`);
      console.log(`   Currently under: ${wrongOwner}`);
      console.log(`   Should be under: ${correctOwner}`);

      // Move file to correct owner
      console.log(`\nMoving file to correct owner...`);
      
      // Create new file record under correct email
      const newFile = {
        ...mostRecent,
        PK: `USER#${correctOwner}`,
        // Keep the same SK
      };
      
      // Delete old file
      await dynamodb.delete({
        TableName: table,
        Key: {
          PK: mostRecent.PK,
          SK: mostRecent.SK
        }
      }).promise();
      
      // Create new file
      await dynamodb.put({
        TableName: table,
        Item: newFile
      }).promise();
      
      console.log(`✅ File moved from ${wrongOwner} to ${correctOwner}`);
      console.log(`   File: ${mostRecent.fileName}`);
    } else {
      console.log(`⚠️ No files found under wrong owner`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }

  console.log('\n✅ Fix complete!');
}

fixLastEC2Stream().catch(console.error);
