const AWS = require('aws-sdk');

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkPOMAccounts() {
  console.log('🔍 Checking POM accounts in database...\n');
  console.log('='.repeat(60));
  
  // 1. Check public accounts (PROFILE records)
  console.log('\n1️⃣ PUBLIC ACCOUNTS (PROFILE records):');
  console.log('-'.repeat(60));
  
  try {
    // Query GSI for public accounts with "pom" in username
    const publicQueryParams = {
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'usernameVisibility = :visibility',
      ExpressionAttributeValues: {
        ':visibility': 'public'
      }
    };
    
    let publicResults = [];
    let lastEvaluatedKey = null;
    
    do {
      if (lastEvaluatedKey) {
        publicQueryParams.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await dynamodb.query(publicQueryParams).promise();
      const items = result.Items || [];
      
      // Filter for usernames containing "pom"
      const pomAccounts = items.filter(item => {
        const username = (item.username || '').toLowerCase();
        return username.includes('pom');
      });
      
      publicResults.push(...pomAccounts);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    if (publicResults.length === 0) {
      console.log('   ❌ No public POM accounts found');
    } else {
      console.log(`   ✅ Found ${publicResults.length} public POM account(s):`);
      publicResults.forEach(account => {
        console.log(`      - Username: ${account.username}`);
        console.log(`        Email: ${account.PK ? account.PK.replace('USER#', '') : 'N/A'}`);
        console.log(`        UserId: ${account.userId || 'N/A'}`);
        console.log(`        Visibility: ${account.usernameVisibility || 'public'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.log(`   ⚠️  Error querying public accounts: ${error.message}`);
    if (error.code === 'ResourceNotFoundException') {
      console.log('   ℹ️  GSI not available, trying scan fallback...');
      
      // Fallback: scan PROFILE items
      const scanParams = {
        TableName: table,
        FilterExpression: 'SK = :sk AND contains(username, :pom)',
        ExpressionAttributeValues: {
          ':sk': 'PROFILE',
          ':pom': 'pom'
        }
      };
      
      const scanResult = await dynamodb.scan(scanParams).promise();
      const items = scanResult.Items || [];
      
      if (items.length === 0) {
        console.log('   ❌ No public POM accounts found (scan)');
      } else {
        console.log(`   ✅ Found ${items.length} public POM account(s) (scan):`);
        items.forEach(account => {
          console.log(`      - Username: ${account.username}`);
          console.log(`        Email: ${account.PK ? account.PK.replace('USER#', '') : account.email || 'N/A'}`);
          console.log(`        UserId: ${account.userId || 'N/A'}`);
          console.log('');
        });
      }
    }
  }
  
  // 2. Check private accounts (STREAM_KEY#MAPPING)
  console.log('\n2️⃣ PRIVATE ACCOUNTS (STREAM_KEY#MAPPING):');
  console.log('-'.repeat(60));
  
  let privateMatches = [];
  
  try {
    let lastEvaluatedKey = null;
    let scanCount = 0;
    let totalScanned = 0;
    
    do {
      const scanParams = {
        TableName: table,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'STREAM_KEY#',
          ':sk': 'MAPPING'
        },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 100
      };
      
      const result = await dynamodb.scan(scanParams).promise();
      const items = result.Items || [];
      totalScanned += items.length;
      
      console.log(`   📄 Scanned page ${scanCount + 1}: ${items.length} items (total scanned: ${totalScanned})`);
      
      items.forEach(mapping => {
        // Check if streamUsername contains 🔒 (private username indicator)
        if (!mapping.streamUsername || !mapping.streamUsername.includes('🔒')) {
          return; // Skip non-private usernames
        }
        
        // Extract base username (without 🔒) for matching
        const baseUsername = mapping.streamUsername.replace('🔒', '').trim();
        const baseUsernameLower = baseUsername.toLowerCase();
        
        // Check if it matches "pom" (case-insensitive substring match)
        if (baseUsernameLower.includes('pom')) {
          const userEmail = mapping.userEmail || mapping.email || mapping.collaboratorEmail || mapping.ownerEmail;
          
          privateMatches.push({
            streamUsername: mapping.streamUsername,
            baseUsername: baseUsername,
            email: userEmail || 'unknown',
            streamKey: mapping.PK ? mapping.PK.replace('STREAM_KEY#', '') : 'N/A',
            isPlaceholder: mapping.isPlaceholder || false
          });
          
          console.log(`   ✅ [PRIVATE MATCH] Found: "${mapping.streamUsername}" (base: "${baseUsername}")`);
          console.log(`      Email: ${userEmail || 'N/A'}`);
          console.log(`      Stream Key: ${mapping.PK ? mapping.PK.replace('STREAM_KEY#', '') : 'N/A'}`);
          console.log(`      Is Placeholder: ${mapping.isPlaceholder || false}`);
          console.log('');
        }
      });
      
      lastEvaluatedKey = result.LastEvaluatedKey;
      scanCount++;
      
      // Continue scanning until we've checked all items
    } while (lastEvaluatedKey);
    
    console.log(`📊 [PRIVATE SEARCH COMPLETE] Scanned ${scanCount} pages, ${totalScanned} total items`);
    
    if (privateMatches.length === 0) {
      console.log('   ❌ No private POM accounts found in STREAM_KEY#MAPPING');
    } else {
      console.log(`   ✅ Found ${privateMatches.length} private POM account(s):`);
      privateMatches.forEach(match => {
        console.log(`      - Stream Username: ${match.streamUsername}`);
        console.log(`        Base Username: ${match.baseUsername}`);
        console.log(`        Email: ${match.email}`);
        console.log(`        Stream Key: ${match.streamKey}`);
        console.log(`        Is Placeholder: ${match.isPlaceholder}`);
        console.log('');
      });
    }
  } catch (error) {
    console.log(`   ❌ Error scanning private accounts: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  }
  
  // 3. Summary
  console.log('\n3️⃣ SUMMARY:');
  console.log('-'.repeat(60));
  console.log('When searching for "pom", the following should appear:');
  console.log('');
  
  // Get public usernames
  const publicUsernames = [];
  try {
    const publicQueryParams = {
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'usernameVisibility = :visibility',
      ExpressionAttributeValues: {
        ':visibility': 'public'
      }
    };
    
    let lastKey = null;
    do {
      if (lastKey) publicQueryParams.ExclusiveStartKey = lastKey;
      const result = await dynamodb.query(publicQueryParams).promise();
      const items = result.Items || [];
      items.forEach(item => {
        if (item.username && item.username.toLowerCase().includes('pom')) {
          publicUsernames.push(item.username);
        }
      });
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
  } catch (e) {
    // Fallback if GSI fails
  }
  
  const privateUsernames = privateMatches.map(m => m.streamUsername);
  
  console.log('PUBLIC ACCOUNTS:');
  if (publicUsernames.length === 0) {
    console.log('   ❌ None found');
  } else {
    publicUsernames.forEach(u => console.log(`   ✅ ${u}`));
  }
  
  console.log('\nPRIVATE ACCOUNTS:');
  if (privateUsernames.length === 0) {
    console.log('   ❌ None found');
  } else {
    privateUsernames.forEach(u => console.log(`   ✅ ${u}`));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Check completed\n');
}

checkPOMAccounts().catch(console.error);
