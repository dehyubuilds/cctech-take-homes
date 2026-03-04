const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function deletePrivateTwillyTV() {
  const viewerEmail = 'dehyubuilds@gmail.com';
  const ownerEmail = 'dehyu.sinyan@gmail.com'; // Twilly TV email
  const normalizedViewerEmail = viewerEmail.toLowerCase();
  const normalizedOwnerEmail = ownerEmail.toLowerCase();
  
  console.log(`\n🗑️  Deleting private Twilly TV entry for: ${normalizedViewerEmail}\n`);
  
  try {
    // Delete the private entry
    const privateSK = `ADDED_USERNAME#${normalizedOwnerEmail}#private`;
    
    console.log(`Attempting to delete:`);
    console.log(`   PK: USER#${normalizedViewerEmail}`);
    console.log(`   SK: ${privateSK}`);
    
    const deleteParams = {
      TableName: table,
      Key: {
        PK: `USER#${normalizedViewerEmail}`,
        SK: privateSK
      }
    };
    
    const result = await dynamodb.delete(deleteParams).promise();
    console.log(`✅ Successfully deleted private Twilly TV entry!`);
    console.log(`   The entry with SK "${privateSK}" has been removed.`);
    console.log(`\n💡 Now you can add "Twilly TV" as a PUBLIC username and see their public content.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error.code === 'ResourceNotFoundException') {
      console.log('   Entry not found - it may have already been deleted.');
    }
  }
}

deletePrivateTwillyTV();
