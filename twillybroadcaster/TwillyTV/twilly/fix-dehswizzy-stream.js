const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function fixDehswizzyStream() {
  console.log('🔧 Fixing dehswizzy stream issues...\n');

  const userId = 'f6ff9d4d-fb19-425c-94cb-617a9ee6f7fc';
  const correctEmail = 'dehsin365@gmail.com';
  const wrongEmail = 'dehyubuilds@gmail.com';
  const streamKeys = ['twillyafterdark5zm836l5', 'twillytvn2xif8y2'];

  // Fix 1: Update STREAM_KEY mappings to include creatorId
  console.log('Fix 1: Updating STREAM_KEY mappings to include creatorId...');
  for (const streamKey of streamKeys) {
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
        const updateParams = {
          TableName: table,
          Key: {
            PK: `STREAM_KEY#${streamKey}`,
            SK: 'MAPPING'
          },
          UpdateExpression: 'SET creatorId = :creatorId',
          ExpressionAttributeValues: {
            ':creatorId': userId
          }
        };
        
        await dynamodb.update(updateParams).promise();
        console.log(`✅ Updated STREAM_KEY#${streamKey} with creatorId: ${userId}`);
      } else {
        console.log(`⚠️ STREAM_KEY#${streamKey} not found`);
      }
    } catch (error) {
      console.error(`❌ Error updating STREAM_KEY#${streamKey}:`, error.message);
    }
  }

  // Fix 2: Update "Twilly After Dark" collaboration to have addedViaInvite: true
  console.log('\nFix 2: Updating "Twilly After Dark" collaboration...');
  try {
    const updateParams = {
      TableName: table,
      Key: {
        PK: `USER#${userId}`,
        SK: 'COLLABORATOR_ROLE#Twilly After Dark'
      },
      UpdateExpression: 'SET addedViaInvite = :addedViaInvite',
      ExpressionAttributeValues: {
        ':addedViaInvite': true
      }
    };
    
    await dynamodb.update(updateParams).promise();
    console.log(`✅ Updated "Twilly After Dark" collaboration to have addedViaInvite: true`);
  } catch (error) {
    console.error(`❌ Error updating collaboration:`, error.message);
  }

  // Fix 3: Move files from wrong email to correct email
  console.log('\nFix 3: Moving files from wrong email to correct email...');
  for (const streamKey of streamKeys) {
    try {
      // Find files with this streamKey under wrong email
      const fileScan = await dynamodb.scan({
        TableName: table,
        FilterExpression: 'PK = :pk AND begins_with(SK, :skPrefix) AND streamKey = :streamKey',
        ExpressionAttributeValues: {
          ':pk': `USER#${wrongEmail}`,
          ':skPrefix': 'FILE#',
          ':streamKey': streamKey
        }
      }).promise();

      if (fileScan.Items && fileScan.Items.length > 0) {
        console.log(`Found ${fileScan.Items.length} file(s) with streamKey ${streamKey} under wrong email`);
        
        for (const file of fileScan.Items) {
          // Create new file record under correct email
          const newFile = {
            ...file,
            PK: `USER#${correctEmail}`,
            // Keep the same SK
          };
          
          // Delete old file
          await dynamodb.delete({
            TableName: table,
            Key: {
              PK: file.PK,
              SK: file.SK
            }
          }).promise();
          
          // Create new file
          await dynamodb.put({
            TableName: table,
            Item: newFile
          }).promise();
          
          console.log(`✅ Moved file ${file.SK} from ${wrongEmail} to ${correctEmail}`);
        }
      } else {
        console.log(`⚠️ No files found with streamKey ${streamKey} under wrong email`);
      }
    } catch (error) {
      console.error(`❌ Error moving files for streamKey ${streamKey}:`, error.message);
    }
  }

  console.log('\n✅ Fix complete!');
}

fixDehswizzyStream().catch(console.error);
