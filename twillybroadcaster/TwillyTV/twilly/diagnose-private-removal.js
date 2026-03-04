/**
 * Diagnostic script to check why private content is still showing after removal
 * 
 * This script checks:
 * 1. What ADDED_USERNAME entries exist for the viewer
 * 2. What entries are being found by the reverse relationship check
 * 3. What usernames are being added to the addedUsernamesPrivate set
 */

const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '81v8RfOXhFHoKvOyD5t4I8kIeaVq9ad9TSAnp7eI',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

// Replace these with the actual emails/usernames you're testing with
const viewerEmail = process.argv[2] || 'dehyubuilds@gmail.com'; // The user who was removed
const ownerEmail = process.argv[3] || 'dehyu.sinyan@gmail.com'; // Twilly TV (who removed them)

async function diagnose() {
  console.log('\n🔍 ========== DIAGNOSING PRIVATE REMOVAL ISSUE ==========\n');
  console.log(`Viewer (removed user): ${viewerEmail}`);
  console.log(`Owner (Twilly TV): ${ownerEmail}\n`);

  // Step 1: Check direct ADDED_USERNAME entries (where viewer added owner)
  console.log('📋 STEP 1: Checking direct ADDED_USERNAME entries...');
  const directParams = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${viewerEmail.toLowerCase()}`,
      ':skPrefix': 'ADDED_USERNAME#'
    }
  };

  const directResult = await dynamodb.query(directParams).promise();
  const directEntries = directResult.Items || [];
  
  console.log(`   Found ${directEntries.length} direct ADDED_USERNAME entries:`);
  directEntries.forEach((entry, idx) => {
    const isPrivate = entry.SK.includes('#private') || entry.streamerVisibility === 'private';
    const isActive = entry.status === 'active';
    console.log(`   [${idx + 1}] SK: ${entry.SK}`);
    console.log(`       Status: ${entry.status || 'N/A'}`);
    console.log(`       Is Private: ${isPrivate}`);
    console.log(`       Is Active: ${isActive}`);
    console.log(`       Streamer Username: ${entry.streamerUsername || 'N/A'}`);
    console.log(`       Streamer Email: ${entry.streamerEmail || 'N/A'}`);
    
    // Check if this is the entry that should have been deleted
    if (entry.SK.includes(ownerEmail.toLowerCase()) && isPrivate) {
      if (isActive) {
        console.log(`       ⚠️ PROBLEM: This entry should have been deleted but is still active!`);
      } else {
        console.log(`       ✅ This entry is inactive (correctly removed)`);
      }
    }
    console.log('');
  });

  // Step 2: Check reverse ADDED_USERNAME entries (where owner added viewer)
  console.log('📋 STEP 2: Checking reverse ADDED_USERNAME entries...');
  const reverseParams = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${viewerEmail.toLowerCase()}`,
      ':skPrefix': 'ADDED_USERNAME#'
    }
  };

  const reverseResult = await dynamodb.query(reverseParams).promise();
  const reverseEntries = reverseResult.Items || [];
  
  // Filter for entries where owner added viewer (SK contains ownerEmail)
  const ownerAddedViewerEntries = reverseEntries.filter(entry => {
    const skParts = entry.SK.split('#');
    if (skParts.length >= 3) {
      const creatorEmail = skParts[1].toLowerCase();
      return creatorEmail === ownerEmail.toLowerCase();
    }
    return false;
  });

  console.log(`   Found ${ownerAddedViewerEntries.length} entries where owner added viewer:`);
  ownerAddedViewerEntries.forEach((entry, idx) => {
    const isPrivate = entry.SK.includes('#private') || entry.streamerVisibility === 'private';
    const isActive = entry.status === 'active';
    console.log(`   [${idx + 1}] SK: ${entry.SK}`);
    console.log(`       Status: ${entry.status || 'N/A'}`);
    console.log(`       Is Private: ${isPrivate}`);
    console.log(`       Is Active: ${isActive}`);
    
    if (isPrivate && isActive) {
      console.log(`       ⚠️ PROBLEM: This reverse entry is active - viewer will see owner's private content!`);
      console.log(`       This entry should be checked in the reverse relationship logic.`);
    }
    console.log('');
  });

  // Step 3: Simulate what get-content.post.js would do
  console.log('📋 STEP 3: Simulating get-content.post.js logic...');
  
  // Step 3a: Direct entries (where viewer added owner)
  let addedUsernamesPrivate = new Set();
  const activeDirectPrivate = directEntries.filter(entry => {
    const isPrivate = entry.SK.includes('#private') || entry.streamerVisibility === 'private';
    const isActive = entry.status === 'active';
    return isPrivate && isActive;
  });

  console.log(`   Active direct private entries: ${activeDirectPrivate.length}`);
  activeDirectPrivate.forEach(entry => {
    if (entry.streamerUsername) {
      const normalized = entry.streamerUsername.trim().toLowerCase();
      addedUsernamesPrivate.add(normalized);
      console.log(`   ✅ Added "${entry.streamerUsername}" (normalized: "${normalized}") to PRIVATE set`);
    }
  });

  // Step 3b: Reverse entries (where owner added viewer)
  const activeReversePrivate = reverseEntries.filter(entry => {
    const isPrivate = entry.SK.includes('#private') || entry.streamerVisibility === 'private';
    const isActive = entry.status === 'active';
    if (!isPrivate || !isActive) return false;
    
    // Extract creator email from SK
    const skParts = entry.SK.split('#');
    if (skParts.length >= 3) {
      const creatorEmail = skParts[1].toLowerCase();
      return creatorEmail === ownerEmail.toLowerCase();
    }
    return false;
  });

  console.log(`   Active reverse private entries: ${activeReversePrivate.length}`);
  if (activeReversePrivate.length > 0) {
    // Get owner's username from PROFILE
    try {
      const ownerProfile = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `USER#${ownerEmail.toLowerCase()}`,
          SK: 'PROFILE'
        }
      }).promise();
      
      if (ownerProfile.Item?.username) {
        const normalized = ownerProfile.Item.username.trim().toLowerCase();
        addedUsernamesPrivate.add(normalized);
        console.log(`   ✅ Added "${ownerProfile.Item.username}" (normalized: "${normalized}") to PRIVATE set from reverse relationship`);
      }
    } catch (err) {
      console.log(`   ⚠️ Error fetching owner profile: ${err.message}`);
    }
  }

  console.log(`\n   Final PRIVATE set: [${Array.from(addedUsernamesPrivate).map(u => `"${u}"`).join(', ')}]`);

  // Step 4: Check what username "Twilly TV" normalizes to
  console.log('\n📋 STEP 4: Checking username normalization...');
  try {
    const ownerProfile = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${ownerEmail.toLowerCase()}`,
        SK: 'PROFILE'
      }
    }).promise();
    
    if (ownerProfile.Item?.username) {
      const raw = ownerProfile.Item.username;
      const cleaned = raw.replace(/🔒/g, '').trim();
      const normalized = cleaned.toLowerCase();
      console.log(`   Raw username: "${raw}"`);
      console.log(`   Cleaned (no lock): "${cleaned}"`);
      console.log(`   Normalized: "${normalized}"`);
      console.log(`   In PRIVATE set? ${addedUsernamesPrivate.has(normalized)}`);
    }
  } catch (err) {
    console.log(`   ⚠️ Error fetching owner profile: ${err.message}`);
  }

  console.log('\n✅ ========== DIAGNOSIS COMPLETE ==========\n');
}

diagnose().catch(console.error);
