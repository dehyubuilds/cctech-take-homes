#!/usr/bin/env node

/**
 * Create isolated TwillyMessaging DynamoDB table
 * This table is separate from the main Twilly table to isolate messaging functionality
 */

const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB();

const tableName = 'TwillyMessaging';

const params = {
  TableName: tableName,
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' },   // VIDEO#videoId
    { AttributeName: 'SK', KeyType: 'RANGE' }     // COMMENT#timestamp#commentId
  ],
  AttributeDefinitions: [
    { AttributeName: 'PK', AttributeType: 'S' },
    { AttributeName: 'SK', AttributeType: 'S' },
    { AttributeName: 'userId', AttributeType: 'S' },
    { AttributeName: 'createdAt', AttributeType: 'S' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'UserIdIndex',
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'createdAt', KeyType: 'RANGE' }
      ],
      Projection: {
        ProjectionType: 'ALL'
      }
    }
  ],
  BillingMode: 'PAY_PER_REQUEST'
};

async function createTable() {
  try {
    console.log(`📦 Creating isolated messaging table: ${tableName}...`);
    
    // Check if table already exists
    try {
      await dynamodb.describeTable({ TableName: tableName }).promise();
      console.log(`✅ Table ${tableName} already exists`);
      return;
    } catch (err) {
      if (err.code !== 'ResourceNotFoundException') {
        throw err;
      }
    }
    
    // Create the table
    const result = await dynamodb.createTable(params).promise();
    console.log(`✅ Created table: ${tableName}`);
    console.log(`   Table ARN: ${result.TableDescription.TableArn}`);
    console.log(`   Status: ${result.TableDescription.TableStatus}`);
    
    // Wait for table to be active
    console.log(`⏳ Waiting for table to be active...`);
    await dynamodb.waitFor('tableExists', { TableName: tableName }).promise();
    console.log(`✅ Table is now active and ready to use!`);
    
  } catch (error) {
    console.error(`❌ Error creating table: ${error.message}`);
    if (error.code === 'ResourceInUseException') {
      console.log(`ℹ️  Table ${tableName} already exists`);
    } else {
      throw error;
    }
  }
}

createTable()
  .then(() => {
    console.log(`\n🎉 Messaging table setup complete!`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. All comment endpoints now use: ${tableName}`);
    console.log(`   2. Main Twilly table is only used for video lookups`);
    console.log(`   3. Set MESSAGING_TABLE env var if using different table name`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n❌ Failed to create table:`, error);
    process.exit(1);
  });
