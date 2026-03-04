import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userId, userEmail, username } = body;

    console.log('Get user collaborator roles request:', { userId, userEmail, username });

    // Validate required fields
    if (!userId && !userEmail && !username) {
      return {
        success: false,
        message: 'Missing required fields: userId, userEmail, or username'
      };
    }

    // Try multiple PK formats to find collaborator roles
    // Collaborator roles might be stored with PK = USER#userId, USER#email, or USER#username
    const possiblePKs = [];
    if (userId) possiblePKs.push(`USER#${userId}`);
    if (userEmail) possiblePKs.push(`USER#${userEmail}`);
    if (username) possiblePKs.push(`USER#${username}`);
    
    // Remove duplicates
    const uniquePKs = [...new Set(possiblePKs)];
    
    console.log(`Trying ${uniquePKs.length} PK formats: ${uniquePKs.join(', ')}`);

    const allRoles = [];
    const seenChannels = new Set(); // Track channels to avoid duplicates

    // Query each possible PK format
    for (const pk of uniquePKs) {
      try {
        const queryParams = {
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': pk,
            ':sk': 'COLLABORATOR_ROLE#'
          }
        };

        const result = await dynamodb.query(queryParams).promise();
        const roles = result.Items || [];
        
        console.log(`Found ${roles.length} roles for PK: ${pk}`);

        // Add roles that haven't been seen yet (by channelName - case insensitive)
        for (const role of roles) {
          const channelKey = (role.channelName || role.channelId || '').toLowerCase().trim();
          if (channelKey && !seenChannels.has(channelKey)) {
            allRoles.push(role);
            seenChannels.add(channelKey);
            console.log(`   ✅ Added unique channel: ${role.channelName} (key: ${channelKey})`);
          } else if (channelKey) {
            console.log(`   ⚠️ Skipping duplicate channel: ${role.channelName} (key: ${channelKey})`);
          }
        }
      } catch (error) {
        console.log(`Error querying PK ${pk}: ${error.message}`);
      }
    }

    const roles = allRoles;
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total unique collaborator roles found: ${roles.length}`);
    console.log(`   PK formats queried: ${uniquePKs.join(', ')}`);
    roles.forEach((role, index) => {
      console.log(`   ${index + 1}. ${role.channelName} (PK: ${role.PK}, SK: ${role.SK})`);
    });

    // CRITICAL: Only return channels where user explicitly entered an invite code
    // STRICT: Only include roles where addedViaInvite === true (no backward compatibility)
    // We check the addedViaInvite field directly on COLLABORATOR_ROLE records
    // (This is much faster than scanning INVITE records)
    console.log(`\n🔍 Filtering collaborator roles - ONLY channels with explicit invite codes (addedViaInvite: true)...`);

    // Format roles to include channel information
    // STRICT: Only include roles with status 'active' AND explicitly added via invite code (addedViaInvite === true)
    const formattedRoles = roles
      .filter(role => {
        const status = (role.status || 'active').toLowerCase();
        const isActive = status === 'active';
        if (!isActive) {
          console.log(`   ⚠️ Filtering out inactive role: ${role.channelName} (status: ${status})`);
          return false;
        }
        
        // Check if this channel was added via invite code
        // STRICT: Only include if addedViaInvite is explicitly true
        // No backward compatibility - undefined/legacy records are excluded
        const wasAddedViaInvite = role.addedViaInvite === true;
        
        if (!wasAddedViaInvite) {
          if (role.addedViaInvite === false) {
            console.log(`   ⚠️ Filtering out manually-added role: ${role.channelName} (addedViaInvite: false)`);
          } else {
            console.log(`   ⚠️ Filtering out legacy role (no invite code): ${role.channelName} (addedViaInvite: ${role.addedViaInvite === undefined ? 'undefined' : role.addedViaInvite})`);
          }
        } else {
          console.log(`   ✅ Including invite-based role: ${role.channelName} (inviteCode: ${role.inviteCode || 'N/A'})`);
        }
        
        return wasAddedViaInvite;
      })
      .map(role => ({
        channelId: role.channelId || role.channelName,
        channelName: role.channelName,
        streamKey: role.streamKey,
        joinedAt: role.joinedAt,
        status: role.status || 'active',
        role: role.role || 'collaborator',
        pk: role.PK, // Include PK for debugging
        sk: role.SK  // Include SK for debugging
      }));
    
    console.log(`\n✅ Final active collaborator roles (ONLY explicit invite codes - addedViaInvite: true): ${formattedRoles.length}`);
    formattedRoles.forEach((role, index) => {
      console.log(`   ${index + 1}. ${role.channelName}`);
    });

    // Log detailed information about found channels
    console.log(`\n📋 DETAILED COLLABORATOR CHANNELS FOR USER:`);
    console.log(`   userId: ${userId || 'N/A'}`);
    console.log(`   userEmail: ${userEmail || 'N/A'}`);
    console.log(`   username: ${username || 'N/A'}`);
    console.log(`   Total channels found: ${formattedRoles.length}`);
    formattedRoles.forEach((role, index) => {
      console.log(`\n   Channel ${index + 1}:`);
      console.log(`     Name: ${role.channelName}`);
      console.log(`     ID: ${role.channelId}`);
      console.log(`     PK: ${role.pk}`);
      console.log(`     SK: ${role.sk}`);
      console.log(`     Has Stream Key: ${role.streamKey ? 'Yes' : 'No'}`);
      console.log(`     Status: ${role.status}`);
    });
    console.log(`\n`);

    return {
      success: true,
      message: 'Collaborator roles retrieved successfully',
      roles: formattedRoles,
      debug: {
        userId,
        userEmail,
        username,
        pkFormatsTried: uniquePKs,
        totalRolesFound: roles.length,
        uniqueChannels: formattedRoles.length
      }
    };

  } catch (error) {
    console.error('Error in get-user-roles:', error);
    return {
      success: false,
      message: 'Failed to retrieve collaborator roles',
      roles: []
    };
  }
});
