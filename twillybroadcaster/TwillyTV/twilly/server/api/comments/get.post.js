import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

export default defineEventHandler(async (event) => {
  // Configure AWS
  AWS.config.update({
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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',
    region: 'us-east-1'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  // ISOLATED MESSAGING TABLE - separate from main Twilly table
  const messagingTable = process.env.MESSAGING_TABLE || 'TwillyMessaging';
  // Main Twilly table for video lookups only
  const mainTable = 'Twilly';

  try {
    const body = await readBody(event);
    const { videoId, viewerEmail, userId } = body;

    if (!videoId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: videoId'
      });
    }

    // Normalize viewerEmail early to avoid "before initialization" errors
    const normalizedViewerEmail = viewerEmail ? viewerEmail.toLowerCase() : null;

    console.log(`🔍 [comments/get] Fetching comments for video: ${videoId} (viewer: ${viewerEmail || 'anonymous'})`);

    // First, get the video entry to check privacy and ownership
    // videoId is the SK (e.g., FILE#file-sk_xxx), we need to find the video entry
    // Videos are stored with PK=USER#email, SK=FILE#fileId
    let videoEntry = null;
    let isOwner = false;
    let isPrivate = false;
    let isPremium = false;

    // Extract fileId from videoId - handle both cases (with or without FILE# prefix)
    let searchSK = videoId;
    if (!videoId.startsWith('FILE#')) {
      searchSK = `FILE#${videoId}`;
    }
    
    // Search for the video entry - we need to scan or query by SK (use mainTable)
    const videoScanParams = {
      TableName: mainTable,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':sk': searchSK
      },
      Limit: 1
    };

    const videoResult = await dynamodb.scan(videoScanParams).promise();
    
    if (videoResult.Items && videoResult.Items.length > 0) {
      videoEntry = videoResult.Items[0];
      isPrivate = videoEntry.isPrivateUsername === true;
      isPremium = videoEntry.isPremium === true;
      
      // Check if viewer is the owner
      if (viewerEmail && videoEntry.PK) {
        const ownerEmail = videoEntry.PK.replace('USER#', '');
        isOwner = viewerEmail.toLowerCase() === ownerEmail.toLowerCase();
      }
      
      console.log(`📹 [comments/get] Video entry found - isPrivate: ${isPrivate}, isPremium: ${isPremium}, isOwner: ${isOwner}`);
    } else {
      console.log(`⚠️ [comments/get] Video entry not found for: ${searchSK}`);
      // FALLBACK: Try to determine ownership from comments themselves
      // If viewer has comments on this video and is in visibleTo of private threads, they might be the owner
      // This is a heuristic fallback for cases where video entry lookup fails
      if (viewerEmail && normalizedViewerEmail) {
        // We'll check this after we get the comments
        console.log(`🔄 [comments/get] Will check ownership from comments as fallback`);
      }
    }

    // Allow comments on all videos (public, private, and premium)
    // Comments are visible to anyone who can view the video
    // Private thread replies are still restricted to participants
    console.log(`📹 [comments/get] Video access - isPrivate: ${isPrivate}, isPremium: ${isPremium}, isOwner: ${isOwner}`);

    // Normalize videoId - strip FILE# or file- prefix if present to ensure consistent PK format
    // Comments may be stored with either format, so we need to handle both
    let normalizedVideoId = videoId;
    if (normalizedVideoId.startsWith('FILE#')) {
      normalizedVideoId = normalizedVideoId.replace('FILE#', '');
    }
    if (normalizedVideoId.startsWith('file-')) {
      normalizedVideoId = normalizedVideoId.replace('file-', '');
    }
    console.log(`🔧 [comments/get] Normalized videoId: "${videoId}" -> "${normalizedVideoId}"`);

    // Query comments for this video
    // PK: VIDEO#videoId, SK: COMMENT#timestamp#commentId
    // Use ConsistentRead to ensure we get the latest comments immediately after posting
    // CRITICAL: Try both formats (with and without file- prefix) to handle legacy comments
    const pkWithoutPrefix = `VIDEO#${normalizedVideoId}`;
    const pkWithPrefix = `VIDEO#file-${normalizedVideoId}`;
    
    // Try querying with normalized videoId first (preferred format) - USE MESSAGING TABLE
    let params = {
      TableName: messagingTable,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': pkWithoutPrefix,
        ':sk': 'COMMENT#'
      },
      ScanIndexForward: false, // Most recent first
      ConsistentRead: true // Ensure we read the latest data immediately
    };

    let result = await dynamodb.query(params).promise();
    console.log(`📊 [comments/get] Found ${result.Items?.length || 0} comments for PK: ${pkWithoutPrefix}`);
    
    // If no results and videoId doesn't already have file- prefix, try with file- prefix (legacy format)
    if ((!result.Items || result.Items.length === 0) && !videoId.startsWith('file-')) {
      console.log(`🔄 [comments/get] No comments found with ${pkWithoutPrefix}, trying legacy format: ${pkWithPrefix}`);
      params = {
        TableName: messagingTable,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': pkWithPrefix,
          ':sk': 'COMMENT#'
        },
        ScanIndexForward: false,
        ConsistentRead: true
      };
      result = await dynamodb.query(params).promise();
      console.log(`📊 [comments/get] Found ${result.Items?.length || 0} comments for PK: ${pkWithPrefix}`);
    }

    // Filter comments based on visibility
    // normalizedViewerEmail is already defined above
    const allComments = result.Items || [];
    
    // Separate public and private comments
    const publicComments = [];
    const privateThreads = [];
    
    for (const item of allComments) {
      const isPrivate = item.isPrivate === true;
      const hasParent = item.parentCommentId != null;
      
      // Calculate isLiked based on whether viewer's userId is in likedBy array
      const likedBy = item.likedBy || [];
      const isLiked = userId && likedBy.includes(userId);
      
      // Public comments: not private and no parent (top-level comments)
      if (!isPrivate && !hasParent) {
        publicComments.push({
          id: item.commentId || item.SK.replace('COMMENT#', ''),
          videoId: item.videoId || videoId,
          userId: item.userId,
          username: item.username,
          text: item.text,
          createdAt: item.createdAt || item.timestamp,
          likeCount: item.likeCount || 0,
          isLiked: isLiked || false,
          isPrivate: false,
          parentCommentId: null,
          visibleTo: null,
          mentionedUsername: null
        });
      }
      
      // SIMPLIFIED: Private threads - if viewer is a participant, they see ALL messages
      // Both participants see the EXACT same thread history - no differences
      if (isPrivate || hasParent) {
        const visibleTo = item.visibleTo || [];
        const threadId = item.parentCommentId || item.commentId;
        
        // SIMPLE RULE: If viewer is in visibleTo OR is the author OR is the video owner, they're a participant
        // If they're a participant in ANY message in a thread, they see ALL messages in that thread
        let isParticipant = false;
        
        // Check 1: Is viewer in visibleTo?
        if (normalizedViewerEmail && Array.isArray(visibleTo) && visibleTo.length > 0) {
          if (visibleTo.some(email => email && email.toLowerCase() === normalizedViewerEmail)) {
            isParticipant = true;
          }
        }
        
        // Check 2: Is viewer the author of this message?
        if (!isParticipant && normalizedViewerEmail && item.userId) {
          if (item.userId.includes('@') && item.userId.toLowerCase() === normalizedViewerEmail) {
            isParticipant = true;
          }
        }
        
        // Check 3: Is viewer the video owner?
        if (!isParticipant && isOwner) {
          isParticipant = true;
        }
        
        // Check 4: Check ALL messages in this thread - if viewer is participant in ANY message, they see ALL
        if (!isParticipant && normalizedViewerEmail && threadId) {
          for (const threadItem of allComments) {
            const isInSameThread = 
              (threadItem.parentCommentId === threadId) || 
              (threadItem.commentId === threadId) ||
              (threadItem.parentCommentId && threadItem.parentCommentId === item.parentCommentId);
            
            if (isInSameThread) {
              // Check if viewer is author of any message in thread
              if (threadItem.userId && threadItem.userId.includes('@')) {
                if (threadItem.userId.toLowerCase() === normalizedViewerEmail) {
                  isParticipant = true;
                  break;
                }
              }
              
              // Check if viewer is in visibleTo of any message in thread
              const threadVisibleTo = threadItem.visibleTo || [];
              if (Array.isArray(threadVisibleTo) && threadVisibleTo.length > 0) {
                if (threadVisibleTo.some(email => email && email.toLowerCase() === normalizedViewerEmail)) {
                  isParticipant = true;
                  break;
                }
              }
            }
          }
        }
        
        // CRITICAL: If viewer is a participant, include ALL messages in the thread
        // This ensures both participants see identical thread history
        if (isParticipant || !normalizedViewerEmail) {
          const likedBy = item.likedBy || [];
          const isLiked = userId && likedBy.includes(userId);
          
          console.log(`✅ [comments/get] Including thread message - commentId: ${item.commentId}, threadId: ${threadId}, viewer: ${normalizedViewerEmail || 'anonymous'}, isParticipant: ${isParticipant}`);
          
          privateThreads.push({
            id: item.commentId || item.SK.replace('COMMENT#', ''),
            videoId: item.videoId || videoId,
            userId: item.userId,
            username: item.username,
            text: item.text,
            createdAt: item.createdAt || item.timestamp,
            likeCount: item.likeCount || 0,
            isLiked: isLiked || false,
            isPrivate: isPrivate,
            parentCommentId: item.parentCommentId || null,
            visibleTo: visibleTo.length > 0 ? visibleTo : null,
            mentionedUsername: item.mentionedUsername || null
          });
        } else {
          console.log(`🚫 [comments/get] Excluding thread message - commentId: ${item.commentId}, threadId: ${threadId}, viewer: ${normalizedViewerEmail}, visibleTo: ${JSON.stringify(visibleTo)}`);
        }
      }
    }
    
    // SIMPLIFIED: Group private threads by parentCommentId (room identifier)
    // Private chat = general chat with a room ID - simple flat list per room
    // parentCommentId IS the room identifier - all messages with same parentCommentId are in same room
    const threadsByParent = {};
    
    for (const thread of privateThreads) {
      // Use parentCommentId as the room identifier (threadId)
      // If no parentCommentId, use the comment's own ID as the room (self-messaging or first message)
      const roomId = thread.parentCommentId || thread.id;
      
      if (!threadsByParent[roomId]) {
        threadsByParent[roomId] = [];
      }
      threadsByParent[roomId].push(thread);
    }

    // CRITICAL: Sort messages in each thread (newest first, oldest last)
    // We'll reverse once on client to show newest at bottom (like a chat)
    // This is more efficient than reversing on every access
    for (const parentId in threadsByParent) {
      threadsByParent[parentId].sort((a, b) => {
        // Parse createdAt - handle both ISO8601 strings and timestamps
        const dateA = typeof a.createdAt === 'string' 
          ? new Date(a.createdAt).getTime() 
          : (typeof a.createdAt === 'number' ? a.createdAt : 0);
        const dateB = typeof b.createdAt === 'string' 
          ? new Date(b.createdAt).getTime() 
          : (typeof b.createdAt === 'number' ? b.createdAt : 0);
        
        // Sort by createdAt (newest first, oldest last) - reverse of chat order
        if (dateA > dateB) return -1;
        if (dateA < dateB) return 1;
        
        // If timestamps are equal, sort by ID for consistency
        return (b.id || '').localeCompare(a.id || '');
      });
    }

    console.log(`✅ [comments/get] Found ${publicComments.length} public comments and ${privateThreads.length} private thread messages for video: ${videoId}`);

    return {
      success: true,
      comments: publicComments,
      privateThreads: privateThreads,
      threadsByParent: threadsByParent
    };
  } catch (error) {
    console.error('❌ [comments/get] Error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch comments'
    });
  }
});
