import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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',
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

/** Timeline types: each has its own DynamoDB SK prefix so timelines are isolated. */
export const TIMELINE_TYPES = Object.freeze({ PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE', PREMIUM: 'PREMIUM' });

/**
 * Derive timeline type from file/item flags. One of PUBLIC, PRIVATE, PREMIUM.
 */
export function getTimelineTypeFromFile(file) {
  if (!file) return TIMELINE_TYPES.PUBLIC;
  const isPremium = file.isPremium === true || file.isPremium === 'true' || file.isPremium === 1;
  const isPrivate = file.isPrivateUsername === true || file.isPrivateUsername === 'true' || file.isPrivateUsername === 1 ||
    (file.creatorUsername && String(file.creatorUsername).includes('🔒'));
  if (isPremium) return TIMELINE_TYPES.PREMIUM;
  if (isPrivate) return TIMELINE_TYPES.PRIVATE;
  return TIMELINE_TYPES.PUBLIC;
}

/**
 * Create a timeline entry for a file in an isolated timeline.
 * Schema: PK = USER#viewerEmail, SK = {PUBLIC|PRIVATE|PREMIUM}#timestamp#fileId#creatorEmail
 */
export async function createTimelineEntry(viewerEmail, fileData, creatorEmail, timelineType = TIMELINE_TYPES.PUBLIC) {
  const timelineTypeUpper = (timelineType || TIMELINE_TYPES.PUBLIC).toUpperCase();
  if (!['PUBLIC', 'PRIVATE', 'PREMIUM'].includes(timelineTypeUpper)) {
    console.error(`❌ [timeline-utils] Invalid timelineType: ${timelineType}`);
    return false;
  }

  try {
    const timestamp = fileData.createdAt || fileData.timestamp || new Date().toISOString();
    const fileId = fileData.SK?.replace('FILE#', '') || fileData.fileId || `file-${Date.now()}`;
    const timestampForSort = new Date(timestamp).toISOString();
    const sortKey = `${timelineTypeUpper}#${timestampForSort}#${fileId}#${(creatorEmail || '').toLowerCase()}`;

    const timelineEntry = {
      PK: `USER#${(viewerEmail || '').toLowerCase()}`,
      SK: sortKey,
      ...fileData,
      fileId,
      creatorEmail: (creatorEmail || '').toLowerCase(),
      timelineCreatorEmail: (creatorEmail || '').toLowerCase(),
      streamerEmail: fileData.streamerEmail || (creatorEmail || '').toLowerCase(),
      timelineCreatedAt: new Date().toISOString(),
      timelineType: timelineTypeUpper,
      isTimelineEntry: true
    };

    await dynamodb.put({
      TableName: table,
      Item: timelineEntry,
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)'
    }).promise();

    console.log(`✅ [timeline-utils] Created ${timelineTypeUpper} timeline entry for ${viewerEmail}: ${sortKey}`);
    return true;
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException' || error.name === 'ConditionalCheckFailedException') {
      console.log(`⚠️ [timeline-utils] Timeline entry already exists, skipping`);
      return true;
    }
    console.error(`❌ [timeline-utils] Error creating timeline entry: ${error.message}`);
    return false;
  }
}

/**
 * Fan-out: add file to all followers' timelines for the given type (PUBLIC, PRIVATE, or PREMIUM).
 * PUBLIC/PRIVATE: followers from ADDED_USERNAME with matching streamerVisibility.
 * PREMIUM: subscribers from SUBSCRIBED_CREATOR# for this creator.
 */
export async function fanOutToTimelines(creatorEmail, fileData, timelineType = TIMELINE_TYPES.PUBLIC) {
  const typeUpper = (timelineType || TIMELINE_TYPES.PUBLIC).toUpperCase();
  try {
    console.log(`📤 [timeline-utils] Fan-out: creator=${creatorEmail}, timelineType=${typeUpper}`);

    let followers = [];

    // Query reverse indexes (no scans): STREAMER_FOLLOWERS#creator, CREATOR_SUBSCRIBERS#creator
    if (typeUpper === TIMELINE_TYPES.PREMIUM) {
      const queryParams = {
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: '#status = :active',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':pk': `CREATOR_SUBSCRIBERS#${(creatorEmail || '').toLowerCase()}`,
          ':skPrefix': 'SUBSCRIBER#',
          ':active': 'active'
        }
      };
      const queryResult = await dynamodb.query(queryParams).promise();
      followers = (queryResult.Items || []).map(it => {
        const viewerEmail = (it.SK || '').replace('SUBSCRIBER#', '');
        return { PK: `USER#${viewerEmail}`, streamerVisibility: 'premium' };
      });
    } else {
      const isPrivate = typeUpper === TIMELINE_TYPES.PRIVATE;
      const vis = isPrivate ? 'private' : 'public';
      const queryParams = {
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: 'streamerVisibility = :vis AND #status = :active',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':pk': `STREAMER_FOLLOWERS#${(creatorEmail || '').toLowerCase()}`,
          ':skPrefix': 'VIEWER#',
          ':vis': vis,
          ':active': 'active'
        }
      };
      const result = await dynamodb.query(queryParams).promise();
      followers = (result.Items || []).map(it => {
        const viewerEmail = (it.SK || '').replace('VIEWER#', '');
        return { PK: `USER#${viewerEmail}`, streamerVisibility: it.streamerVisibility || vis };
      });
    }

    console.log(`📤 [timeline-utils] ${followers.length} followers for ${typeUpper}`);

    const followerEmails = [];
    const fanOutPromises = followers.map(async (follower) => {
      const viewerEmail = follower.PK?.replace('USER#', '') || follower.viewerEmail;
      if (viewerEmail && viewerEmail.toLowerCase() !== (creatorEmail || '').toLowerCase()) {
        await createTimelineEntry(viewerEmail, fileData, creatorEmail, typeUpper);
        followerEmails.push(viewerEmail.toLowerCase());
      }
    });
    await Promise.allSettled(fanOutPromises);

    if (followerEmails.length > 0) {
      try {
        const { sendWebSocketNotification } = await import('../../utils/websocket-cache.js');
        const endpoint = process.env.WEBSOCKET_API_ENDPOINT || process.env.WSS_ENDPOINT || 'wss://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev';
        await sendWebSocketNotification(
          followerEmails,
          'timeline_update',
          {
            fileId: fileData.SK?.replace('FILE#', '') || fileData.fileId,
            fileName: fileData.fileName,
            title: fileData.title,
            description: fileData.description,
            thumbnailUrl: fileData.thumbnailUrl,
            hlsUrl: fileData.hlsUrl,
            createdAt: fileData.createdAt || fileData.timestamp,
            creatorEmail: (creatorEmail || '').toLowerCase(),
            creatorUsername: fileData.creatorUsername,
            isPrivateUsername: fileData.isPrivateUsername,
            isPremium: fileData.isPremium,
            price: fileData.price,
            category: fileData.category
          },
          endpoint,
          true
        );
      } catch (wsError) {
        console.error(`⚠️ [timeline-utils] WebSocket notification failed: ${wsError.message}`);
      }
    }

    console.log(`✅ [timeline-utils] Fan-out complete for ${creatorEmail} (${typeUpper})`);
    return true;
  } catch (error) {
    console.error(`❌ [timeline-utils] Fan-out error: ${error.message}`);
    return false;
  }
}

/**
 * Add file to owner's timeline and fan-out (only when visible). Call after creating/updating a FILE.
 * Determines timeline type from file flags and writes only to that timeline.
 * Fan-out is skipped for HELD/scheduled (isVisible false) so followers don't see placeholders.
 */
export async function addFileToTimelines(creatorEmail, fileData) {
  const timelineType = getTimelineTypeFromFile(fileData);
  const creator = (creatorEmail || '').toLowerCase();
  await createTimelineEntry(creator, fileData, creator, timelineType);
  const isVisible = fileData.isVisible === true || fileData.isVisible === 'true' || fileData.isVisible === 1;
  if (isVisible) {
    await fanOutToTimelines(creator, fileData, timelineType);
  }
  return true;
}

/**
 * Populate timeline when a user is added. Writes to PUBLIC or PRIVATE timeline only (isolated).
 */
export async function populateTimelineOnAdd(viewerEmail, addedUserEmail, addedUsername, visibility) {
  try {
    console.log(`📥 [timeline-utils] Populating timeline: viewer=${viewerEmail}, added=${addedUserEmail}, visibility=${visibility}`);

    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${(addedUserEmail || '').toLowerCase()}`,
        ':skPrefix': 'FILE#'
      }
    };
    const result = await dynamodb.query(queryParams).promise();
    const files = result.Items || [];

    const isPrivate = (visibility || '').toLowerCase() === 'private';
    const timelineType = isPrivate ? TIMELINE_TYPES.PRIVATE : TIMELINE_TYPES.PUBLIC;
    const relevantFiles = files.filter(file => {
      const fileIsPrivate = file.isPrivateUsername === true ||
        (file.creatorUsername && String(file.creatorUsername).includes('🔒'));
      const fileIsPremium = file.isPremium === true || file.isPremium === 'true' || file.isPremium === 1;
      if (fileIsPremium) return false;
      return isPrivate ? fileIsPrivate : !fileIsPrivate;
    });

    console.log(`📥 [timeline-utils] ${relevantFiles.length} files for ${timelineType}`);

    const createPromises = relevantFiles.map(file =>
      createTimelineEntry(viewerEmail, file, addedUserEmail, timelineType)
    );
    await Promise.allSettled(createPromises);

    console.log(`✅ [timeline-utils] Timeline populated for ${viewerEmail} with ${timelineType} from ${addedUserEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ [timeline-utils] Error populating timeline: ${error.message}`);
    return false;
  }
}

/**
 * Remove ALL timeline entries (PUBLIC#, PRIVATE#, PREMIUM#) that reference a given file, across ALL users.
 * Call this when a FILE is deleted so the video never reappears in any timeline.
 * @param {string} fileId - FILE SK (e.g. "FILE#file-upload-123-abc") or short id ("file-upload-123-abc")
 */
export async function removeTimelineEntriesForFile(fileId) {
  if (!fileId || typeof fileId !== 'string') return;
  const shortId = fileId.replace(/^FILE#/, '').trim();
  if (!shortId) return;
  try {
    console.log(`🗑️ [timeline-utils] Removing all timeline entries for file: ${shortId}`);
    const tableName = table;
    let entriesToRemove = [];
    let lastKey = null;
    do {
      const scanParams = {
        TableName: tableName,
        FilterExpression: 'begins_with(PK, :userPrefix) AND contains(SK, :fileId)',
        ExpressionAttributeValues: {
          ':userPrefix': 'USER#',
          ':fileId': shortId
        },
        ExclusiveStartKey: lastKey || undefined
      };
      const result = await dynamodb.scan(scanParams).promise();
      const items = result.Items || [];
      entriesToRemove = entriesToRemove.concat(items);
      lastKey = result.LastEvaluatedKey || null;
    } while (lastKey);

    if (entriesToRemove.length === 0) {
      console.log(`🗑️ [timeline-utils] No timeline entries found for file: ${shortId}`);
      return true;
    }
    console.log(`🗑️ [timeline-utils] Found ${entriesToRemove.length} timeline entries to remove for file: ${shortId}`);
    const BATCH = 25;
    for (let i = 0; i < entriesToRemove.length; i += BATCH) {
      const chunk = entriesToRemove.slice(i, i + BATCH);
      await dynamodb.batchWrite({
        RequestItems: {
          [tableName]: chunk.map(entry => ({
            DeleteRequest: { Key: { PK: entry.PK, SK: entry.SK } }
          }))
        }
      }).promise();
    }
    console.log(`✅ [timeline-utils] Removed ${entriesToRemove.length} timeline entries for file: ${shortId}`);
    return true;
  } catch (error) {
    console.error(`❌ [timeline-utils] Error removing timeline entries for file: ${error.message}`);
    return false;
  }
}

/**
 * Remove all timeline entries (PUBLIC, PRIVATE, PREMIUM) for a removed user from viewer's timelines.
 */
export async function removeTimelineEntries(viewerEmail, removedUserEmail) {
  try {
    console.log(`🗑️ [timeline-utils] Removing timeline entries: viewer=${viewerEmail}, removed=${removedUserEmail}`);

    const pk = `USER#${(viewerEmail || '').toLowerCase()}`;
    const normalizedRemoved = (removedUserEmail || '').toLowerCase();
    const prefixes = ['PUBLIC#', 'PRIVATE#', 'PREMIUM#'];
    let entriesToRemove = [];

    for (const prefix of prefixes) {
      const queryParams = {
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': pk, ':skPrefix': prefix }
      };
      const result = await dynamodb.query(queryParams).promise();
      const items = result.Items || [];
      const fromCreator = items.filter(entry => {
        const c = (entry.creatorEmail || entry.timelineCreatorEmail || entry.streamerEmail || '').toLowerCase();
        return c === normalizedRemoved;
      });
      entriesToRemove = entriesToRemove.concat(fromCreator);
    }

    console.log(`🗑️ [timeline-utils] Found ${entriesToRemove.length} entries to remove`);

    await Promise.allSettled(entriesToRemove.map(entry =>
      dynamodb.delete({
        TableName: table,
        Key: { PK: entry.PK, SK: entry.SK }
      }).promise()
    ));

    console.log(`✅ [timeline-utils] Removed ${entriesToRemove.length} timeline entries`);
    return true;
  } catch (error) {
    console.error(`❌ [timeline-utils] Error removing timeline entries: ${error.message}`);
    return false;
  }
}
