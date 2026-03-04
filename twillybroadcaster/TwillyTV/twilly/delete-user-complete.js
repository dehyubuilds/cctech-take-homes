#!/usr/bin/env node

/**
 * Complete User Deletion Script
 * 
 * This script deletes a user from Cognito and all associated entries in DynamoDB.
 * Useful for testing registration flows with a clean slate.
 * 
 * Usage:
 *   node delete-user-complete.js <userEmail>
 * 
 * Example:
 *   node delete-user-complete.js test@example.com
 */

const { CognitoIdentityProviderClient, AdminDeleteUserCommand, AdminGetUserCommand, ListUsersCommand } = require("@aws-sdk/client-cognito-identity-provider");
const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const USER_POOL_ID = 'us-east-1_hbYWvnY7Q';
const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' });
const table = 'Twilly';

async function deleteUserComplete(userEmail) {
  if (!userEmail) {
    console.error('❌ Error: User email is required');
    console.log('\nUsage: node delete-user-complete.js <userEmail>');
    console.log('Example: node delete-user-complete.js test@example.com\n');
    process.exit(1);
  }

  const userEmailLower = userEmail.toLowerCase().trim();
  console.log('🗑️  Starting complete deletion for user:', userEmailLower);
  console.log('='.repeat(60));

  let deletedFromCognito = false;
  let dynamoEntriesDeleted = 0;
  let errors = [];

  try {
    // Step 1: Delete from Cognito
    console.log('\n📱 Step 1: Finding and deleting from Cognito...');
    
    let cognitoUsername = null;
    
    // Try 1: Direct lookup by email (most common case)
    try {
      const getUserCommand = new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userEmailLower
      });
      const userResult = await cognitoClient.send(getUserCommand);
      cognitoUsername = userEmailLower;
      console.log('   ✅ Found user in Cognito with email as username');
    } catch (getError) {
      if (getError.name !== 'UserNotFoundException') {
        console.log('   ⚠️  Error checking user by email:', getError.message);
      }
      
      // Try 2: List users and search by email attribute
      console.log('   🔍 User not found by email, searching by email attribute...');
      try {
        const listUsersCommand = new ListUsersCommand({
          UserPoolId: USER_POOL_ID,
          Filter: `email = "${userEmailLower}"`,
          Limit: 10
        });
        const listResult = await cognitoClient.send(listUsersCommand);
        
        if (listResult.Users && listResult.Users.length > 0) {
          // Found user(s) with this email
          for (const user of listResult.Users) {
            if (user.Username) {
              cognitoUsername = user.Username;
              console.log(`   ✅ Found user in Cognito with username: ${user.Username}`);
              break;
            }
          }
        } else {
          console.log('   ⚠️  No user found in Cognito with this email');
        }
      } catch (listError) {
        console.log('   ⚠️  Error listing users:', listError.message);
        // Try 3: Try with original case (not lowercased)
        try {
          const getUserCommandOriginal = new AdminGetUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: userEmail
          });
          await cognitoClient.send(getUserCommandOriginal);
          cognitoUsername = userEmail;
          console.log('   ✅ Found user in Cognito with original case email');
        } catch (originalError) {
          console.log('   ⚠️  User not found in Cognito with any method');
        }
      }
    }
    
    // Delete the user if we found them
    if (cognitoUsername) {
      try {
        const deleteUserCommand = new AdminDeleteUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: cognitoUsername
        });
        
        await cognitoClient.send(deleteUserCommand);
        deletedFromCognito = true;
        console.log(`   ✅ User deleted from Cognito (username: ${cognitoUsername})`);
      } catch (deleteError) {
        console.error(`   ❌ Error deleting user from Cognito: ${deleteError.message}`);
        errors.push(`Cognito delete: ${deleteError.message}`);
      }
    } else {
      console.log('   ⚠️  User not found in Cognito (may have already been deleted or doesn\'t exist)');
    }

    // Step 2: Find and delete all DynamoDB entries
    console.log('\n🗄️  Step 2: Finding DynamoDB entries...');
    
    // Query all entries with PK = USER#<email>
    let lastEvaluatedKey = null;
    let allEntries = [];

    do {
      const queryParams = {
        TableName: table,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userEmailLower}`
        }
      };

      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await dynamodb.query(queryParams).promise();
      if (result.Items && result.Items.length > 0) {
        allEntries.push(...result.Items);
      }
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`   📋 Found ${allEntries.length} DynamoDB entries with PK = USER#${userEmailLower}`);

    // Also check for entries where this user is referenced (e.g., ADDED_USERNAME entries where streamerEmail matches)
    console.log('\n   🔍 Checking for referenced entries (e.g., ADDED_USERNAME entries)...');
    
    // Scan for ADDED_USERNAME entries where streamerEmail matches
    let referencedEntries = [];
    let scanLastEvaluatedKey = null;

    do {
      const scanParams = {
        TableName: table,
        FilterExpression: 'streamerEmail = :email',
        ExpressionAttributeValues: {
          ':email': userEmailLower
        }
      };

      if (scanLastEvaluatedKey) {
        scanParams.ExclusiveStartKey = scanLastEvaluatedKey;
      }

      const scanResult = await dynamodb.scan(scanParams).promise();
      if (scanResult.Items && scanResult.Items.length > 0) {
        referencedEntries.push(...scanResult.Items);
      }
      scanLastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (scanLastEvaluatedKey);

    if (referencedEntries.length > 0) {
      console.log(`   📋 Found ${referencedEntries.length} referenced entries (e.g., where this user was added by others)`);
      // Filter out entries that are already in allEntries
      const uniqueReferenced = referencedEntries.filter(ref => 
        !allEntries.some(entry => entry.PK === ref.PK && entry.SK === ref.SK)
      );
      if (uniqueReferenced.length > 0) {
        console.log(`   📋 Adding ${uniqueReferenced.length} unique referenced entries to deletion list`);
        allEntries.push(...uniqueReferenced);
      }
    }

    // Step 3: Delete all found entries
    console.log(`\n🗑️  Step 3: Deleting ${allEntries.length} DynamoDB entries...`);
    
    if (allEntries.length === 0) {
      console.log('   ✅ No DynamoDB entries found to delete');
    } else {
      // Group entries by type for better logging
      const entriesByType = {};
      allEntries.forEach(entry => {
        const sk = entry.SK || 'UNKNOWN';
        const type = sk.split('#')[0] || 'UNKNOWN';
        if (!entriesByType[type]) {
          entriesByType[type] = [];
        }
        entriesByType[type].push(entry);
      });

      console.log('\n   Entry types found:');
      Object.keys(entriesByType).forEach(type => {
        console.log(`      - ${type}: ${entriesByType[type].length} entries`);
      });

      // Delete entries in batches
      for (const entry of allEntries) {
        try {
          const deleteParams = {
            TableName: table,
            Key: {
              PK: entry.PK,
              SK: entry.SK
            }
          };
          await dynamodb.delete(deleteParams).promise();
          dynamoEntriesDeleted++;
        } catch (deleteError) {
          console.error(`   ❌ Error deleting entry ${entry.SK}: ${deleteError.message}`);
          errors.push(`DynamoDB ${entry.SK}: ${deleteError.message}`);
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 DELETION SUMMARY');
    console.log('='.repeat(60));
    console.log(`   User Email: ${userEmailLower}`);
    console.log(`   Deleted from Cognito: ${deletedFromCognito ? '✅ Yes' : '❌ No'}`);
    console.log(`   DynamoDB entries deleted: ${dynamoEntriesDeleted}`);
    if (errors.length > 0) {
      console.log(`   Errors: ${errors.length}`);
      errors.forEach(err => console.log(`      - ${err}`));
    }
    console.log('='.repeat(60));

    if (dynamoEntriesDeleted > 0 || deletedFromCognito) {
      console.log('\n✅ User deletion completed!');
      console.log('   You can now sign up again with this email to test registration flows.\n');
    } else {
      console.log('\n⚠️  No entries were deleted. User may not exist or may have already been deleted.\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal error during deletion:', error);
    throw error;
  }
}

// Get email from command line arguments
const userEmail = process.argv[2];

// Run the deletion
deleteUserComplete(userEmail)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
