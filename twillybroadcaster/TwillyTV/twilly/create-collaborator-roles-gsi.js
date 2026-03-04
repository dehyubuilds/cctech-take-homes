import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB();
const table = 'Twilly';

async function createCollaboratorRolesGSI() {
  console.log('🔧 Creating GSI for Collaborator Roles by Channel...\n');

  try {
    // Check if GSI already exists
    const describeParams = {
      TableName: table
    };

    const tableDescription = await dynamodb.describeTable(describeParams).promise();
    const existingGSIs = tableDescription.Table.GlobalSecondaryIndexes || [];
    const gsiExists = existingGSIs.some(gsi => gsi.IndexName === 'CollaboratorRolesByChannelIndex');

    if (gsiExists) {
      console.log('✅ GSI "CollaboratorRolesByChannelIndex" already exists!');
      console.log('   Skipping creation...\n');
      return;
    }

    console.log('📋 Current table attributes:', tableDescription.Table.AttributeDefinitions.map(a => a.AttributeName).join(', '));

    // Check if we need to add channelId to attribute definitions
    const existingAttributes = tableDescription.Table.AttributeDefinitions.map(a => a.AttributeName);
    const needsChannelId = !existingAttributes.includes('channelId');

    const attributeDefinitions = [...tableDescription.Table.AttributeDefinitions];
    
    if (needsChannelId) {
      attributeDefinitions.push({
        AttributeName: 'channelId',
        AttributeType: 'S'
      });
      console.log('➕ Adding channelId to attribute definitions');
    }

    // Create the GSI
    const updateParams = {
      TableName: table,
      AttributeDefinitions: attributeDefinitions,
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: 'CollaboratorRolesByChannelIndex',
            KeySchema: [
              {
                AttributeName: 'channelId',
                KeyType: 'HASH' // Partition key
              },
              {
                AttributeName: 'PK',
                KeyType: 'RANGE' // Sort key (USER#userId)
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
    console.log('   Index Name: CollaboratorRolesByChannelIndex');
    console.log('   Partition Key: channelId');
    console.log('   Sort Key: PK');
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

createCollaboratorRolesGSI().catch(console.error);
