import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB();
const table = 'Twilly';

async function createUsernameSearchGSI() {
  console.log('🔧 Creating GSI for username search...\n');

  try {
    // First, check if GSI already exists
    const describeParams = {
      TableName: table
    };

    const tableDescription = await dynamodb.describeTable(describeParams).promise();
    const existingGSIs = tableDescription.Table.GlobalSecondaryIndexes || [];
    const gsiExists = existingGSIs.some(gsi => gsi.IndexName === 'UsernameSearchIndex');

    if (gsiExists) {
      console.log('✅ GSI "UsernameSearchIndex" already exists!');
      console.log('   Skipping creation...\n');
      return;
    }

    console.log('📋 Current table attributes:', tableDescription.Table.AttributeDefinitions.map(a => a.AttributeName).join(', '));

    // Check if we need to add usernameVisibility and username to attribute definitions
    const existingAttributes = tableDescription.Table.AttributeDefinitions.map(a => a.AttributeName);
    const needsUsernameVisibility = !existingAttributes.includes('usernameVisibility');
    const needsUsername = !existingAttributes.includes('username');

    const attributeDefinitions = [...tableDescription.Table.AttributeDefinitions];
    
    if (needsUsernameVisibility) {
      attributeDefinitions.push({
        AttributeName: 'usernameVisibility',
        AttributeType: 'S'
      });
      console.log('➕ Adding usernameVisibility to attribute definitions');
    }

    if (needsUsername) {
      attributeDefinitions.push({
        AttributeName: 'username',
        AttributeType: 'S'
      });
      console.log('➕ Adding username to attribute definitions');
    }

    // Create the GSI
    const updateParams = {
      TableName: table,
      AttributeDefinitions: attributeDefinitions,
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: 'UsernameSearchIndex',
            KeySchema: [
              {
                AttributeName: 'usernameVisibility',
                KeyType: 'HASH' // Partition key
              },
              {
                AttributeName: 'username',
                KeyType: 'RANGE' // Sort key
              }
            ],
            Projection: {
              ProjectionType: 'ALL' // Include all attributes
            }
          }
        }
      ]
    };

    console.log('\n🚀 Creating GSI...');
    console.log('   Index Name: UsernameSearchIndex');
    console.log('   Partition Key: usernameVisibility');
    console.log('   Sort Key: username');
    console.log('   Projection: ALL\n');

    const result = await dynamodb.updateTable(updateParams).promise();
    
    console.log('✅ GSI creation initiated!');
    console.log('   Status:', result.TableDescription.GlobalSecondaryIndexes[0].IndexStatus);
    console.log('\n⏳ Note: GSI creation can take a few minutes. The index will be available when status is "ACTIVE".');
    console.log('   You can check status with: aws dynamodb describe-table --table-name Twilly --region us-east-1\n');

  } catch (error) {
    if (error.code === 'ResourceInUseException') {
      console.log('⚠️  GSI is already being created or table is being modified. Please wait and try again.');
    } else if (error.code === 'ValidationException' && error.message.includes('already exists')) {
      console.log('✅ GSI already exists!');
    } else {
      console.error('❌ Error creating GSI:', error.message);
      console.error('   Code:', error.code);
      throw error;
    }
  }
}

createUsernameSearchGSI().catch(console.error);
