import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB();
const table = 'Twilly';

async function createChannelsVisibilityGSI() {
  console.log('🔧 Creating GSI for Channels by Visibility...\n');

  try {
    // Check if GSI already exists
    const describeParams = {
      TableName: table
    };

    const tableDescription = await dynamodb.describeTable(describeParams).promise();
    const existingGSIs = tableDescription.Table.GlobalSecondaryIndexes || [];
    const gsiExists = existingGSIs.some(gsi => gsi.IndexName === 'ChannelsByVisibilityIndex');

    if (gsiExists) {
      console.log('✅ GSI "ChannelsByVisibilityIndex" already exists!');
      console.log('   Skipping creation...\n');
      return;
    }

    console.log('📋 Current table attributes:', tableDescription.Table.AttributeDefinitions.map(a => a.AttributeName).join(', '));

    // Check if we need to add visibility and channelName to attribute definitions
    const existingAttributes = tableDescription.Table.AttributeDefinitions.map(a => a.AttributeName);
    const needsVisibility = !existingAttributes.includes('visibility');
    const needsChannelName = !existingAttributes.includes('channelName');

    const attributeDefinitions = [...tableDescription.Table.AttributeDefinitions];
    
    if (needsVisibility) {
      attributeDefinitions.push({
        AttributeName: 'visibility',
        AttributeType: 'S'
      });
      console.log('➕ Adding visibility to attribute definitions');
    }

    if (needsChannelName) {
      attributeDefinitions.push({
        AttributeName: 'channelName',
        AttributeType: 'S'
      });
      console.log('➕ Adding channelName to attribute definitions');
    }

    // Create the GSI
    const updateParams = {
      TableName: table,
      AttributeDefinitions: attributeDefinitions,
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: 'ChannelsByVisibilityIndex',
            KeySchema: [
              {
                AttributeName: 'visibility',
                KeyType: 'HASH' // Partition key (public/searchable/private)
              },
              {
                AttributeName: 'channelName',
                KeyType: 'RANGE' // Sort key (for ordering)
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
    console.log('   Index Name: ChannelsByVisibilityIndex');
    console.log('   Partition Key: visibility');
    console.log('   Sort Key: channelName');
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

createChannelsVisibilityGSI().catch(console.error);
