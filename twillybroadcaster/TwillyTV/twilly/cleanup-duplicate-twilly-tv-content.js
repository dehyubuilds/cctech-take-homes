import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';
const username = 'Twilly TV';

async function findUserEmail() {
  console.log(`🔍 Finding user email for username: ${username}...\n`);
  
  // Scan for USER records with this username
  const scanParams = {
    TableName: table,
    FilterExpression: 'PK = :pk AND username = :username',
    ExpressionAttributeValues: {
      ':pk': 'USER',
      ':username': username
    }
  };

  const result = await dynamodb.scan(scanParams).promise();
  const users = result.Items || [];

  if (users.length === 0) {
    throw new Error(`No user found with username: ${username}`);
  }

  if (users.length > 1) {
    console.log(`⚠️  Found ${users.length} users with username "${username}", using the first one`);
  }

  const userEmail = users[0].email || users[0].SK;
  console.log(`✅ Found user email: ${userEmail}\n`);
  return userEmail;
}

async function cleanupDuplicates() {
  try {
    // Find user email for "Twilly TV"
    const userEmail = await findUserEmail();
    const pk = `USER#${userEmail}`;

    console.log(`🧹 Cleaning up duplicate content for ${username} (${userEmail})...\n`);

    // Query all FILE records for this user
    let allFiles = [];
    let lastEvaluatedKey = null;

    do {
      const queryParams = {
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':skPrefix': 'FILE#'
        },
        ExclusiveStartKey: lastEvaluatedKey
      };

      const result = await dynamodb.query(queryParams).promise();
      if (result.Items) {
        allFiles = allFiles.concat(result.Items);
      }
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`📋 Found ${allFiles.length} total FILE records\n`);

    if (allFiles.length === 0) {
      console.log('✅ No files found to check for duplicates\n');
      return;
    }

    // Group by fileName to find duplicates
    const fileNameGroups = {};
    for (const file of allFiles) {
      const fileName = file.fileName;
      if (!fileName) {
        console.log(`⚠️  Skipping file without fileName: SK=${file.SK}`);
        continue;
      }

      if (!fileNameGroups[fileName]) {
        fileNameGroups[fileName] = [];
      }
      fileNameGroups[fileName].push(file);
    }

    // Find files with duplicate fileNames
    const duplicates = Object.entries(fileNameGroups).filter(([fileName, files]) => files.length > 1);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate content found!\n');
      return;
    }

    console.log(`⚠️  Found ${duplicates.length} file(s) with duplicate entries:\n`);

    let totalDeleted = 0;

    for (const [fileName, files] of duplicates) {
      console.log(`\n📹 FileName: ${fileName}`);
      console.log(`   Found ${files.length} duplicate entries:`);

      // Sort by createdAt or timestamp (most recent first)
      files.sort((a, b) => {
        const aTime = a.createdAt || a.timestamp || '0';
        const bTime = b.createdAt || b.timestamp || '0';
        return bTime.localeCompare(aTime);
      });

      // Keep the most recent one, delete the rest
      const keepFile = files[0];
      const deleteFiles = files.slice(1);

      console.log(`   ✅ KEEPING: SK=${keepFile.SK}, Created=${keepFile.createdAt || keepFile.timestamp || 'N/A'}`);

      for (const file of deleteFiles) {
        console.log(`   🗑️  DELETING: SK=${file.SK}, Created=${file.createdAt || file.timestamp || 'N/A'}`);

        try {
          const deleteParams = {
            TableName: table,
            Key: {
              PK: file.PK,
              SK: file.SK
            }
          };
          await dynamodb.delete(deleteParams).promise();
          totalDeleted++;
          console.log(`      ✅ Deleted successfully`);
        } catch (deleteError) {
          console.error(`      ❌ Error deleting: ${deleteError.message}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 CLEANUP SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Username: ${username}`);
    console.log(`   User Email: ${userEmail}`);
    console.log(`   Total files checked: ${allFiles.length}`);
    console.log(`   Files with duplicates: ${duplicates.length}`);
    console.log(`   Duplicate records deleted: ${totalDeleted}`);
    console.log('='.repeat(60));
    console.log('\n✅ Cleanup completed!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

cleanupDuplicates()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
