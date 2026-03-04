import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB();
const table = 'Twilly';

async function createFollowRequestsGSI() {
  console.log('🔧 Creating GSI for Follow Requests by Requester...\n');

  try {
    // Check if GSI already exists
    const describeParams = {
      TableName: table
    };

    const tableDescription = await dynamodb.describeTable(describeParams).promise();
    const existingGSIs = tableDescription.Table.GlobalSecondaryIndexes || [];
    const gsiExists = existingGSIs.some(gsi => gsi.IndexName === 'FollowRequestsByRequesterIndex');

    if (gsiExists) {
      console.log('✅ GSI "FollowRequestsByRequesterIndex" already exists!');
      console.log('   Skipping creation...\n');
      return;
    }

    console.log('📋 Current table attributes:', tableDescription.Table.AttributeDefinitions.map(a => a.AttributeName).join(', '));

    // Check if we need to add requesterEmail to attribute definitions
    const existingAttributes = tableDescription.Table.AttributeDefinitions.map(a => a.AttributeName);
    const needsRequesterEmail = !existingAttributes.includes('requesterEmail');

    const attributeDefinitions = [...tableDescription.Table.AttributeDefinitions];
    
    if (needsRequesterEmail) {
      attributeDefinitions.push({
        AttributeName: 'requesterEmail',
        AttributeType: 'S'
      });
      console.log('➕ Adding requesterEmail to attribute definitions');
    }

    // Create the GSI
    const updateParams = {
      TableName: table,
      AttributeDefinitions: attributeDefinitions,
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: 'FollowRequestsByRequesterIndex',
            KeySchema: [
              {
                AttributeName: 'requesterEmail',
                KeyType: 'HASH' // Partition key
              },
              {
                AttributeName: 'SK',
                KeyType: 'RANGE' // Sort key (FOLLOW_REQUEST#...)
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
    console.log('   Index Name: FollowRequestsByRequesterIndex');
    console.log('   Partition Key: requesterEmail');
    console.log('   Sort Key: SK');
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

createFollowRequestsGSI().catch(console.error);
