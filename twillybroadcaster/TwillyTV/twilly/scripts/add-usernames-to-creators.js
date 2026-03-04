import AWS from 'aws-sdk';

// Configure AWS SDK
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();

async function addUsernamesToCreators() {
  try {
    console.log('Starting migration to add usernames to existing creators...');
    
    // Scan all creators
    const scanParams = {
      TableName: 'Creators'
    };
    
    const result = await dynamoDb.scan(scanParams).promise();
    console.log(`Found ${result.Items.length} creators to update`);
    
    for (const creator of result.Items) {
      if (!creator.username) {
        // Generate username from email
        const username = creator.email.split('@')[0];
        
        console.log(`Adding username "${username}" to creator: ${creator.email}`);
        
        // Update the creator record
        const updateParams = {
          TableName: 'Creators',
          Key: {
            userId: creator.userId
          },
          UpdateExpression: 'SET username = :username',
          ExpressionAttributeValues: {
            ':username': username
          }
        };
        
        await dynamoDb.update(updateParams).promise();
        console.log(`✓ Updated creator: ${creator.email} with username: ${username}`);
      } else {
        console.log(`Creator ${creator.email} already has username: ${creator.username}`);
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
addUsernamesToCreators(); 