const AWS = require('aws-sdk');

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findCollaborations() {
  try {
    console.log('Scanning database for collaboration records...');

    // Scan for all collaboration records
    const result = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':sk': 'COLLABORATION#'
      }
    }).promise();

    const collaborations = result.Items || [];
    console.log('Found collaboration records:', collaborations.length);

    // Group by user ID
    const userCollaborations = {};
    collaborations.forEach(collab => {
      const userId = collab.PK.replace('USER#', '');
      if (!userCollaborations[userId]) {
        userCollaborations[userId] = [];
      }
      userCollaborations[userId].push(collab);
    });

    console.log('\nCollaborations by user ID:');
    Object.keys(userCollaborations).forEach(userId => {
      console.log(`User: ${userId} - ${userCollaborations[userId].length} collaborations`);
      userCollaborations[userId].forEach(collab => {
        console.log(`  - Channel: ${collab.channelName} (${collab.channelId})`);
      });
    });

  } catch (error) {
    console.error('Error scanning collaborations:', error);
  }
}

findCollaborations(); 