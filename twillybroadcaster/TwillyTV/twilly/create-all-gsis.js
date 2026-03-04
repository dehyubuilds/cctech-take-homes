import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB();
const table = 'Twilly';

async function createAllGSIs() {
  console.log('🚀 Creating ALL GSIs for Twilly DynamoDB table...\n');
  console.log('This will create the following GSIs:');
  console.log('1. UsernameSearchIndex (usernameVisibility, username)');
  console.log('2. FollowRequestsByRequesterIndex (requesterEmail, SK)');
  console.log('3. ChannelsByVisibilityIndex (visibility, channelName)');
  console.log('4. ChannelsByNameIndex (channelName, PK)');
  console.log('5. CollaboratorRolesByChannelIndex (channelId, PK)');
  console.log('6. StreamKeysByCreatorIndex (creatorId, SK)');
  console.log('\n⏳ Note: GSI creation can take 2-5 minutes each. Please wait...\n');

  const gsiConfigs = [
    {
      name: 'UsernameSearchIndex',
      partitionKey: 'usernameVisibility',
      sortKey: 'username',
      attributes: ['usernameVisibility', 'username']
    },
    {
      name: 'FollowRequestsByRequesterIndex',
      partitionKey: 'requesterEmail',
      sortKey: 'SK',
      attributes: ['requesterEmail']
    },
    {
      name: 'ChannelsByVisibilityIndex',
      partitionKey: 'visibility',
      sortKey: 'channelName',
      attributes: ['visibility', 'channelName']
    },
    {
      name: 'ChannelsByNameIndex',
      partitionKey: 'channelName',
      sortKey: 'PK',
      attributes: ['channelName']
    },
    {
      name: 'CollaboratorRolesByChannelIndex',
      partitionKey: 'channelId',
      sortKey: 'PK',
      attributes: ['channelId']
    },
    {
      name: 'StreamKeysByCreatorIndex',
      partitionKey: 'creatorId',
      sortKey: 'SK',
      attributes: ['creatorId']
    }
  ];

  try {
    // Get current table description
    const describeParams = { TableName: table };
    const tableDescription = await dynamodb.describeTable(describeParams).promise();
    const existingGSIs = tableDescription.Table.GlobalSecondaryIndexes || [];
    const existingAttributes = tableDescription.Table.AttributeDefinitions.map(a => a.AttributeName);

    console.log('📋 Current GSIs:', existingGSIs.map(gsi => gsi.IndexName).join(', ') || 'None');
    console.log('📋 Current attributes:', existingAttributes.join(', '));
    console.log('');

    // Collect all needed attributes
    const neededAttributes = new Set();
    gsiConfigs.forEach(config => {
      config.attributes.forEach(attr => neededAttributes.add(attr));
    });

    // Add missing attributes to attribute definitions
    const attributeDefinitions = [...tableDescription.Table.AttributeDefinitions];
    neededAttributes.forEach(attr => {
      if (!existingAttributes.includes(attr)) {
        attributeDefinitions.push({
          AttributeName: attr,
          AttributeType: 'S'
        });
        console.log(`➕ Adding ${attr} to attribute definitions`);
      }
    });

    // Create GSIs that don't exist
    const gsisToCreate = gsiConfigs.filter(config => 
      !existingGSIs.some(gsi => gsi.IndexName === config.name)
    );

    if (gsisToCreate.length === 0) {
      console.log('✅ All GSIs already exist!');
      return;
    }

    console.log(`\n🔧 Creating ${gsisToCreate.length} GSI(s)...\n`);

    // Note: DynamoDB only allows one GSI to be created at a time
    // So we'll create them sequentially and wait for each to become ACTIVE
    for (const config of gsisToCreate) {
      console.log(`\n📦 Creating ${config.name}...`);
      
      const updateParams = {
        TableName: table,
        AttributeDefinitions: attributeDefinitions,
        GlobalSecondaryIndexUpdates: [
          {
            Create: {
              IndexName: config.name,
              KeySchema: [
                {
                  AttributeName: config.partitionKey,
                  KeyType: 'HASH'
                },
                {
                  AttributeName: config.sortKey,
                  KeyType: 'RANGE'
                }
              ],
              Projection: {
                ProjectionType: 'ALL'
              }
            }
          }
        ]
      };

      try {
        const result = await dynamodb.updateTable(updateParams).promise();
        const gsi = result.TableDescription.GlobalSecondaryIndexes.find(g => g.IndexName === config.name);
        console.log(`   ✅ ${config.name} creation initiated!`);
        console.log(`   Status: ${gsi.IndexStatus}`);
        
        // Wait for GSI to become ACTIVE before creating next one
        if (gsi.IndexStatus === 'CREATING') {
          console.log(`   ⏳ Waiting for ${config.name} to become ACTIVE...`);
          let isActive = false;
          let attempts = 0;
          const maxAttempts = 60; // 5 minutes max (60 * 5 seconds)
          
          while (!isActive && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            attempts++;
            
            try {
              const statusResult = await dynamodb.describeTable({ TableName: table }).promise();
              const statusGsi = statusResult.Table.GlobalSecondaryIndexes.find(g => g.IndexName === config.name);
              
              if (statusGsi) {
                const status = statusGsi.IndexStatus;
                console.log(`   ⏳ ${config.name} status: ${status} (attempt ${attempts}/${maxAttempts})`);
                
                if (status === 'ACTIVE') {
                  isActive = true;
                  console.log(`   ✅ ${config.name} is now ACTIVE!`);
                } else if (status === 'DELETING' || status === 'FAILED') {
                  throw new Error(`${config.name} failed to create. Status: ${status}`);
                }
              }
            } catch (statusError) {
              console.log(`   ⚠️  Error checking status: ${statusError.message}`);
            }
          }
          
          if (!isActive) {
            console.log(`   ⚠️  ${config.name} is still CREATING after ${maxAttempts} attempts. Continuing to next GSI...`);
            console.log(`   ⚠️  You can check status manually: aws dynamodb describe-table --table-name Twilly --region us-east-1`);
          }
        }
      } catch (error) {
        if (error.code === 'ResourceInUseException' || error.code === 'LimitExceededException') {
          console.log(`   ⚠️  ${config.name} - Another GSI is being created. Waiting for it to complete...`);
          
          // Wait for any existing GSI creation to complete
          let waiting = true;
          let waitAttempts = 0;
          const maxWaitAttempts = 60; // 5 minutes max
          
          while (waiting && waitAttempts < maxWaitAttempts) {
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            waitAttempts++;
            
            try {
              const statusResult = await dynamodb.describeTable({ TableName: table }).promise();
              const creatingGSIs = statusResult.Table.GlobalSecondaryIndexes.filter(g => g.IndexStatus === 'CREATING');
              
              if (creatingGSIs.length === 0) {
                waiting = false;
                console.log(`   ✅ Previous GSI creation completed. Retrying ${config.name}...`);
                // Retry this GSI by adding it back to the queue
                gsisToCreate.unshift(config);
                break;
              } else {
                console.log(`   ⏳ Waiting for ${creatingGSIs.length} GSI(s) to complete... (${waitAttempts}/${maxWaitAttempts})`);
              }
            } catch (statusError) {
              console.log(`   ⚠️  Error checking status: ${statusError.message}`);
            }
          }
          
          if (waiting) {
            console.log(`   ⚠️  Timeout waiting for previous GSI. Skipping ${config.name} for now.`);
            console.log(`   ⚠️  Run this script again later to create remaining GSIs.`);
          }
          continue;
        } else if (error.code === 'ValidationException' && error.message.includes('already exists')) {
          console.log(`   ✅ ${config.name} already exists!`);
        } else {
          console.error(`   ❌ Error creating ${config.name}:`, error.message);
          console.log(`   ⚠️  Continuing to next GSI...`);
        }
      }
    }

    console.log('\n✅ All GSI creation requests submitted!');
    console.log('\n⏳ Note: GSIs can take 2-5 minutes each to become ACTIVE.');
    console.log('   Check status with: aws dynamodb describe-table --table-name Twilly --region us-east-1');
    console.log('   The APIs will automatically fall back to scan until GSIs are ready.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

createAllGSIs().catch(console.error);
