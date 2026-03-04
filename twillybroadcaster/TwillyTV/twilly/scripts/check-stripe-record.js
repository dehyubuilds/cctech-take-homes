const AWS = require('aws-sdk');

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkStripeRecord() {
  try {
    console.log('Checking Stripe Connect records...');

    // Try different possible key formats
    const possibleKeys = [
      { PK: 'USER#dehyu.sinyan@gmail.com', SK: 'STRIPE_CONNECT' },
      { PK: 'USER#e392bb8e-7f2a-4fc5-a96d-87544ecb3f34', SK: 'STRIPE_CONNECT' },
      { PK: 'USER#dehsin365', SK: 'STRIPE_CONNECT' }
    ];

    for (const key of possibleKeys) {
      console.log(`\nTrying key:`, key);
      try {
        const result = await dynamodb.get({
          TableName: table,
          Key: key
        }).promise();

        if (result.Item) {
          console.log('✅ Found record:', result.Item);
        } else {
          console.log('❌ No record found');
        }
      } catch (error) {
        console.log('❌ Error:', error.message);
      }
    }

    // Also scan for any Stripe Connect records
    console.log('\nScanning for all STRIPE_CONNECT records...');
    const scanResult = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':sk': 'STRIPE_CONNECT'
      }
    }).promise();

    console.log('Found STRIPE_CONNECT records:', scanResult.Items?.length || 0);
    scanResult.Items?.forEach((item, index) => {
      console.log(`Record ${index + 1}:`, {
        PK: item.PK,
        SK: item.SK,
        isActive: item.isActive,
        status: item.status
      });
    });

  } catch (error) {
    console.error('Error checking Stripe records:', error);
  }
}

checkStripeRecord(); 