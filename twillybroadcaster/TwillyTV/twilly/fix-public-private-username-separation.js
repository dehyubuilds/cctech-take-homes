import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

/**
 * Fix ADDED_USERNAME entries to properly separate public and private
 * 
 * Problem: Currently, ADDED_USERNAME entries use SK: "ADDED_USERNAME#ownerEmail"
 * This means only ONE entry can exist per viewer-owner pair.
 * When you add someone as public, then add them as private, it updates the same entry.
 * 
 * Solution: Change SK to include visibility: "ADDED_USERNAME#ownerEmail#public" or "ADDED_USERNAME#ownerEmail#private"
 * This allows BOTH public and private entries to coexist.
 */
async function fixPublicPrivateUsernameSeparation() {
  try {
    console.log('🔍 Scanning all ADDED_USERNAME entries...\n');
    
    // Scan all ADDED_USERNAME entries
    let lastEvaluatedKey = null;
    let allEntries = [];
    let scanCount = 0;
    
    do {
      const scanParams = {
        TableName: table,
        FilterExpression: 'begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':skPrefix': 'ADDED_USERNAME#'
        },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 100
      };
      
      const result = await dynamodb.scan(scanParams).promise();
      const items = result.Items || [];
      
      // Filter to only ADDED_USERNAME entries (SK should start with ADDED_USERNAME#)
      const addedUsernameItems = items.filter(item => 
        item.SK && item.SK.startsWith('ADDED_USERNAME#')
      );
      
      allEntries = allEntries.concat(addedUsernameItems);
      scanCount++;
      
      console.log(`📄 Scanned page ${scanCount}: Found ${addedUsernameItems.length} ADDED_USERNAME entries (total so far: ${allEntries.length})`);
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`\n✅ Total ADDED_USERNAME entries found: ${allEntries.length}\n`);
    
    // Analyze entries
    const entriesToFix = [];
    const entriesAlreadyFixed = [];
    const entriesWithNewFormat = [];
    
    for (const entry of allEntries) {
      const sk = entry.SK || '';
      const visibility = entry.streamerVisibility || 'public';
      
      // Check if SK already has visibility suffix (new format)
      const hasVisibilitySuffix = sk.includes('#public') || sk.includes('#private');
      
      if (hasVisibilitySuffix) {
        // Already in new format
        entriesWithNewFormat.push(entry);
      } else {
        // Old format - needs to be migrated
        entriesToFix.push({
          entry,
          currentSK: sk,
          visibility,
          ownerEmail: sk.replace('ADDED_USERNAME#', ''),
          viewerEmail: entry.PK?.replace('USER#', '') || ''
        });
      }
    }
    
    console.log(`📊 Analysis:`);
    console.log(`   ✅ Already in new format: ${entriesWithNewFormat.length}`);
    console.log(`   🔧 Need migration: ${entriesToFix.length}\n`);
    
    if (entriesToFix.length === 0) {
      console.log('✅ All entries are already in the correct format!');
      return;
    }
    
    // Show entries that need fixing
    console.log('🔍 Entries that need migration:\n');
    entriesToFix.forEach((item, index) => {
      console.log(`  [${index + 1}] Viewer: ${item.viewerEmail}`);
      console.log(`      Owner: ${item.ownerEmail}`);
      console.log(`      Username: ${item.entry.streamerUsername || 'MISSING'}`);
      console.log(`      Current Visibility: ${item.visibility}`);
      console.log(`      Current SK: ${item.currentSK}`);
      console.log(`      New SK: ADDED_USERNAME#${item.ownerEmail}#${item.visibility}`);
      console.log('');
    });
    
    // Ask for confirmation (in production, you'd want to add a --dry-run flag)
    console.log('⚠️  This will:');
    console.log('   1. Create new entries with visibility in SK');
    console.log('   2. Delete old entries');
    console.log('   3. This is IRREVERSIBLE!\n');
    
    // For now, we'll do it (in production, add confirmation)
    console.log('🚀 Starting migration...\n');
    
    let migrated = 0;
    let errors = 0;
    
    for (const item of entriesToFix) {
      try {
        const { entry, ownerEmail, visibility } = item;
        const newSK = `ADDED_USERNAME#${ownerEmail}#${visibility}`;
        
        // Check if new entry already exists
        const checkParams = {
          TableName: table,
          Key: {
            PK: entry.PK,
            SK: newSK
          }
        };
        
        const existing = await dynamodb.get(checkParams).promise();
        
        if (existing.Item) {
          console.log(`⚠️  [${migrated + 1}] New entry already exists for ${entry.PK} / ${newSK} - skipping`);
          // Delete old entry
          await dynamodb.delete({
            TableName: table,
            Key: {
              PK: entry.PK,
              SK: entry.SK
            }
          }).promise();
          console.log(`   ✅ Deleted old entry`);
          migrated++;
          continue;
        }
        
        // Create new entry with visibility in SK
        const newEntry = {
          ...entry,
          SK: newSK,
          streamerVisibility: visibility // Ensure visibility is set
        };
        
        // Remove PK and SK from the item object (they're in the Key, not the Item)
        delete newEntry.PK;
        delete newEntry.SK;
        
        const putParams = {
          TableName: table,
          Item: {
            PK: entry.PK,
            SK: newSK,
            ...newEntry
          }
        };
        
        await dynamodb.put(putParams).promise();
        
        // Delete old entry
        await dynamodb.delete({
          TableName: table,
          Key: {
            PK: entry.PK,
            SK: entry.SK
          }
        }).promise();
        
        migrated++;
        console.log(`✅ [${migrated}] Migrated: ${entry.PK} / ${entry.SK} → ${newSK} (${visibility})`);
        
      } catch (error) {
        errors++;
        console.error(`❌ [${migrated + errors}] Error migrating ${item.entry.PK} / ${item.entry.SK}:`, error.message);
      }
    }
    
    console.log(`\n✅ Migration complete!`);
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📊 Total processed: ${migrated + errors} / ${entriesToFix.length}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

// Run the fix
fixPublicPrivateUsernameSeparation()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
