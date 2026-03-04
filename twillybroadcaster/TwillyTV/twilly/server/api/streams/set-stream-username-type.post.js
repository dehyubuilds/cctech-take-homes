import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { streamKey, isPrivateUsername, streamUsername: streamUsernameFromRequest, isPremium, targetUserEmails } = body;

    if (!streamKey) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: streamKey'
      });
    }

    if (typeof isPrivateUsername !== 'boolean') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: isPrivateUsername (boolean)'
      });
    }

    console.log(`📝 [set-stream-username-type] Setting username type for streamKey ${streamKey} to ${isPrivateUsername ? 'private' : 'public'}`);
    console.log(`🔍 [set-stream-username-type] Request body - isPremium: ${isPremium} (type: ${typeof isPremium})`);
    if (targetUserEmails && targetUserEmails.length > 0) {
      console.log(`📤 [set-stream-username-type] Direct stream to ${targetUserEmails.length} users: ${targetUserEmails.join(', ')}`);
    }

    // CRITICAL FIX: First, get the existing mapping (if it exists) to preserve all fields
    // Then use put to create/update with streamUsername (username + 🔒 if private)
    // This ensures we don't lose any existing data and works even if mapping doesn't exist yet
    let existingMapping = null;
    let userEmail = null;
    let creatorId = null;
    try {
      const getResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `STREAM_KEY#${streamKey}`,
          SK: 'MAPPING'
        },
        ConsistentRead: true // Use strong consistency to ensure we get the latest
      }).promise();
      
      if (getResult.Item) {
        existingMapping = getResult.Item;
        userEmail = existingMapping.collaboratorEmail || existingMapping.ownerEmail;
        creatorId = existingMapping.creatorId;
        console.log(`✅ [set-stream-username-type] Found existing mapping for ${streamKey}`);
      } else {
        console.log(`⚠️ [set-stream-username-type] Mapping doesn't exist yet for ${streamKey} - will create minimal mapping`);
      }
    } catch (getError) {
      console.error(`❌ [set-stream-username-type] Error getting existing mapping: ${getError.message}`);
      // Continue anyway - we'll create a minimal mapping
    }

    // Get the user's username from their profile
    let username = null;
    if (userEmail) {
      try {
        const userResult = await dynamodb.get({
          TableName: table,
          Key: {
            PK: `USER#${userEmail}`,
            SK: 'PROFILE'
          }
        }).promise();
        
        if (userResult.Item) {
          username = userResult.Item.username || userEmail.split('@')[0];
          console.log(`✅ [set-stream-username-type] Found username: ${username}`);
        } else {
          // Fallback: use email prefix
          username = userEmail.split('@')[0];
          console.log(`⚠️ [set-stream-username-type] No profile found, using email prefix: ${username}`);
        }
      } catch (usernameError) {
        console.error(`❌ [set-stream-username-type] Error getting username: ${usernameError.message}`);
        // Fallback: use email prefix
        username = userEmail ? userEmail.split('@')[0] : 'unknown';
      }
    } else if (creatorId) {
      // Try to get username from creatorId (userId)
      try {
        const userResult = await dynamodb.get({
          TableName: table,
          Key: {
            PK: 'USER',
            SK: creatorId
          }
        }).promise();
        
        if (userResult.Item) {
          username = userResult.Item.username || 'unknown';
          userEmail = userResult.Item.email || userResult.Item.userEmail;
          console.log(`✅ [set-stream-username-type] Found username from creatorId: ${username}`);
        }
      } catch (creatorError) {
        console.error(`❌ [set-stream-username-type] Error getting username from creatorId: ${creatorError.message}`);
      }
    }

    // If we still don't have username, use a fallback
    if (!username) {
      username = 'unknown';
      console.log(`⚠️ [set-stream-username-type] Could not determine username, using fallback: ${username}`);
    }

    // CRITICAL: Use streamUsername from request if provided, otherwise construct it from username
    // This is more reliable - mobile app knows the exact username to use
    let streamUsername = streamUsernameFromRequest;
    if (!streamUsername) {
      // Fallback: construct from username if not provided in request
      streamUsername = isPrivateUsername ? `${username}🔒` : username;
      console.log(`⚠️ [set-stream-username-type] streamUsername not provided in request, constructing from username: ${streamUsername}`);
    } else {
      console.log(`✅ [set-stream-username-type] Using streamUsername from request: ${streamUsername}`);
    }
    console.log(`✅ [set-stream-username-type] Setting streamUsername to: ${streamUsername} (private: ${isPrivateUsername})`);

    // Create/update the mapping with streamUsername (which includes 🔒 if private)
    // If mapping exists, merge with existing data; if not, create minimal mapping
    // CRITICAL: Always set isPremium explicitly - convert undefined/null to false, true to true
    const isPremiumValue = isPremium === true ? true : false;
    console.log(`🔍 [set-stream-username-type] isPremiumValue after conversion: ${isPremiumValue} (type: ${typeof isPremiumValue})`);
    
    const mappingItem = existingMapping ? {
      ...existingMapping,
      streamUsername: streamUsername, // This is the key - username with 🔒 if private
      isPrivateUsername: isPrivateUsername, // Keep for backward compatibility
      isPremium: isPremiumValue, // Always set explicitly (true or false, never undefined)
      targetUserEmails: targetUserEmails && targetUserEmails.length > 0 ? targetUserEmails : undefined, // Store target user emails for direct streams
      updatedAt: new Date().toISOString()
    } : {
      PK: `STREAM_KEY#${streamKey}`,
      SK: 'MAPPING',
      streamKey: streamKey,
      streamUsername: streamUsername, // This is the key - username with 🔒 if private
      isPrivateUsername: isPrivateUsername, // Keep for backward compatibility
      isPremium: isPremiumValue, // Always set explicitly (true or false, never undefined)
      targetUserEmails: targetUserEmails && targetUserEmails.length > 0 ? targetUserEmails : undefined, // Store target user emails for direct streams
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ACTIVE'
    };
    
    console.log(`🔍 [set-stream-username-type] mappingItem.isPremium: ${mappingItem.isPremium} (type: ${typeof mappingItem.isPremium})`);

    const putParams = {
      TableName: table,
      Item: mappingItem
    };

    await dynamodb.put(putParams).promise();

    console.log(`✅ [set-stream-username-type] Username type ${existingMapping ? 'updated' : 'created'} successfully for streamKey ${streamKey}`);
    console.log(`✅ [set-stream-username-type] Saved to DynamoDB - isPremium: ${mappingItem.isPremium} (type: ${typeof mappingItem.isPremium})`);

    // CRITICAL PRIVACY FIX: Also store IMMEDIATELY in EC2 server's global map
    // This eliminates race condition - value is available instantly when stream starts processing
    // CRITICAL: This MUST succeed - if it fails, private streams will go to public!
    try {
      const ec2ServerUrl = process.env.EC2_STREAMING_SERVER_URL || 'http://100.24.103.57:3000';
      const immediateUrl = `${ec2ServerUrl}/api/streams/set-privacy-immediate`;
      
      console.log(`🔍 [set-stream-username-type] Calling EC2 immediate endpoint: ${immediateUrl}`);
      console.log(`   Payload: { streamKey: "${streamKey}", isPrivateUsername: ${isPrivateUsername}, isPremium: ${isPremiumValue} }`);
      
      // Try to call EC2 immediate endpoint - this is CRITICAL for privacy
      // Include isPremium so EC2 can use it if needed (FILE/isPremium is still set from DynamoDB in convert-to-post and Lambda)
      let immediateResponse = null;
      let responseText = '';
      
      try {
        const fetch = (await import('node-fetch-native')).default;
        immediateResponse = await fetch(immediateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ streamKey, isPrivateUsername, isPremium: isPremiumValue }),
          timeout: 10000 // 10 second timeout (increased for reliability)
        });
        
        responseText = await immediateResponse.text();
        console.log(`   Response Status: ${immediateResponse.status}`);
        console.log(`   Response Body: ${responseText}`);
      } catch (fetchError) {
        console.error(`❌ [set-stream-username-type] CRITICAL: Fetch to EC2 failed!`);
        console.error(`   Error: ${fetchError.message}`);
        console.error(`   URL: ${immediateUrl}`);
        console.error(`   This means the global map won't be set - private streams may go to public!`);
        // Don't throw - DynamoDB write succeeded, but log the critical error
        throw fetchError; // Re-throw to be caught by outer catch
      }
      
      if (immediateResponse && immediateResponse.ok) {
        console.log(`✅ [set-stream-username-type] Successfully stored in EC2 server global map`);
      } else {
        const status = immediateResponse ? immediateResponse.status : 'NO_RESPONSE';
        console.error(`❌ [set-stream-username-type] CRITICAL: Failed to store in EC2 global map! Status: ${status}`);
        console.error(`   Response: ${responseText}`);
        // This is CRITICAL - throw error so we know it failed
        throw new Error(`EC2 immediate endpoint failed with status ${status}: ${responseText}`);
      }
    } catch (immediateError) {
      // CRITICAL ERROR - log it but don't fail the API call (DynamoDB write succeeded)
      // But we MUST know about this failure
      console.error(`❌ [set-stream-username-type] CRITICAL: Could not store in EC2 global map!`);
      console.error(`   Error: ${immediateError.message}`);
      console.error(`   Stack: ${immediateError.stack}`);
      console.error(`   ⚠️ WARNING: Private streams may go to public if this fails!`);
      // Don't throw - DynamoDB write succeeded, but log the critical error
    }

    return {
      success: true,
      message: `Username type set to ${isPrivateUsername ? 'private' : 'public'}`,
      isPrivateUsername: isPrivateUsername,
      wasCreated: !existingMapping
    };

  } catch (error) {
    console.error('❌ [set-stream-username-type] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to set stream username type'
    });
  }
});
