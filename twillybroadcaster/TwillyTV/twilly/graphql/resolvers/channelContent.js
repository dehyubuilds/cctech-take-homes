// Resolver for channelContent query
// Returns videos/content for a specific channel
// This is a Lambda resolver - deploy as Lambda function and use as AppSync data source
// Matches REST API logic exactly from twilly/server/api/channels/get-content.post.js

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

// Helper function to normalize channel names (handle emojis) - matches REST API exactly
const normalize = (str) => {
  if (!str) return '';
  // Pattern 1: U0001F37F (8 hex digits after U - DynamoDB format without backslash)
  let normalized = str.replace(/U([0-9A-Fa-f]{8})/g, (match, hex) => {
    try {
      return String.fromCodePoint(parseInt(hex, 16));
    } catch (e) {
      return '';
    }
  });
  // Pattern 2: \U0001F37F (with backslash - if somehow it's preserved)
  normalized = normalized.replace(/\\U([0-9A-Fa-f]{8})/g, (match, hex) => {
    try {
      return String.fromCodePoint(parseInt(hex, 16));
    } catch (e) {
      return '';
    }
  });
  // Pattern 3: \u{1F37F} format (lowercase u with braces)
  normalized = normalized.replace(/\\u\{([0-9A-Fa-f]{1,6})\}/gi, (match, hex) => {
    try {
      return String.fromCodePoint(parseInt(hex, 16));
    } catch (e) {
      return '';
    }
  });
  // Now remove all emoji characters (including converted ones)
  normalized = normalized.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  // Also remove any remaining Unicode escape sequence patterns
  normalized = normalized.replace(/U[0-9A-Fa-f]{8}/gi, '');
  normalized = normalized.replace(/\\U[0-9A-Fa-f]{8}/gi, '');
  normalized = normalized.replace(/\\u\{[0-9A-Fa-f]{1,6}\}/gi, '');
  return normalized.trim();
};

exports.handler = async (event) => {
  console.log('channelContent resolver:', JSON.stringify(event, null, 2));
  
  const { channelName, creatorEmail, limit = 50, nextToken } = event.arguments || {};
  
  if (!channelName || !creatorEmail) {
    throw new Error('Missing required fields: channelName and creatorEmail');
  }
  
  const tableName = 'Twilly';
  
  try {
    // CRITICAL: Fetch MORE items than requested (like REST API) to account for filtering
    // REST API uses: Math.min(pageLimit * 3, 100)
    const pageLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const queryLimit = Math.min(pageLimit * 3, 100); // Fetch 3x to account for filtering
    
    // CRITICAL: Query with pagination until we find enough matching files OR exhaust all files
    // This is necessary because files are sorted by SK, and channel files might not be in the first batch
    let allItems = [];
    let lastEvaluatedKey = null;
    let queryCount = 0;
    const maxQueries = 10; // Limit to prevent infinite loops
    
    if (nextToken) {
      try {
        lastEvaluatedKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
      } catch (e) {
        console.error('Invalid nextToken:', e);
      }
    }
    
    // Keep querying until we have enough matching files or exhaust all files
    while (queryCount < maxQueries) {
      const params = {
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${creatorEmail}`,
          ':skPrefix': 'FILE#'
        },
        Limit: 100 // Query in batches of 100
      };
      
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await dynamodb.query(params).promise();
      queryCount++;
      
      if (result.Items && result.Items.length > 0) {
        allItems = allItems.concat(result.Items);
        console.log(`Query ${queryCount} returned ${result.Items.length} files (total: ${allItems.length})`);
      }
      
      // Check if we have enough matching files (after filtering)
      // Filter to see how many match this channel
      const matchingCount = allItems.filter(file => {
        const fileChannelName = file.folderName || file.seriesName;
        return fileChannelName === channelName;
      }).length;
      
      // If we have enough matches OR no more items, stop querying
      if (matchingCount >= pageLimit || !result.LastEvaluatedKey) {
        lastEvaluatedKey = result.LastEvaluatedKey;
        break;
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    }
    
    console.log(`Total files queried: ${allItems.length} (from ${queryCount} queries)`);
    const result = { Items: allItems, LastEvaluatedKey: lastEvaluatedKey };
    
    if (!result.Items || result.Items.length === 0) {
      return {
        content: [],
        count: 0,
        nextToken: null
      };
    }
    
    // Filter for files in this channel and only visible content - matches REST API exactly
    const channelFiles = result.Items.filter(file => {
      const fileChannelName = file.folderName || file.seriesName;
      
      // DEBUG: Log first few files to see what we're matching against
      if (result.Items.indexOf(file) < 3) {
        console.log(`🔍 File ${result.Items.indexOf(file)}: fileName="${file.fileName}", folderName="${file.folderName}", seriesName="${file.seriesName}", category="${file.category}", isVisible=${file.isVisible}`);
      }
      
      // CRITICAL: Handle emoji/Unicode characters properly but use EXACT matching
      let matchesChannel = false;
      
      if (fileChannelName) {
        // Strategy 1: Exact match (handles emojis correctly if encoding matches)
        if (fileChannelName === channelName) {
          matchesChannel = true;
          if (result.Items.indexOf(file) < 3) {
            console.log(`✅ Exact match: "${fileChannelName}" === "${channelName}"`);
          }
        }
        // Strategy 2: Normalize both strings (remove emojis AND Unicode escape sequences for comparison)
        // ONLY if exact match failed - this handles emoji encoding differences
        else {
          const normalizedFile = normalize(fileChannelName);
          const normalizedChannel = normalize(channelName);
          
          // EXACT match after removing emojis (not contains - EXACT)
          if (normalizedFile === normalizedChannel && normalizedFile.length > 0) {
            matchesChannel = true;
            if (result.Items.indexOf(file) < 3) {
              console.log(`✅ Normalized match: "${normalizedFile}" === "${normalizedChannel}"`);
            }
          }
          // NO partial matching - that causes "Twilly" to match "Twilly After Dark"
        }
      } else {
        if (result.Items.indexOf(file) < 3) {
          console.log(`⚠️ No folderName or seriesName for file: ${file.fileName}`);
        }
      }
      
      // CRITICAL: Match web app logic - web app doesn't check isVisible, only checks HLS and folderName
      // But REST API checks isVisible === true, so we'll do the same for consistency
      // However, if isVisible is null/undefined, we should still show it (like web app does)
      const isVisible = file.isVisible !== false; // Show if not explicitly false (null/undefined/true all pass)
      const hasContent = file.fileName && !file.isFolder;
      
      // Skip thumbnail files (like web app does)
      if (file.fileName && (file.fileName.includes('_thumb.jpg') || 
          (file.fileName.endsWith('.gif') && !file.fileName.includes('_0.gif')))) {
        return false;
      }
      
      // DEBUG: Log why files are being filtered out
      if (result.Items.indexOf(file) < 3 && matchesChannel) {
        console.log(`🔍 Checking file "${file.fileName}": matchesChannel=${matchesChannel}, isVisible=${isVisible}, hasContent=${hasContent}, category="${file.category}", hasHls=${!!file.hlsUrl}, hasStreamKey=${!!file.streamKey}`);
      }
      
      // For videos, must have HLS URL (streamKey is optional - some videos may not have it)
      // This matches the core requirement: videos need to be playable (have HLS URL)
      if (file.category === 'Videos' && !file.hlsUrl) {
        if (result.Items.indexOf(file) < 3 && matchesChannel) {
          console.log(`❌ Filtering out video "${file.fileName}" - no HLS URL`);
        }
        return false;
      }
      
      // CRITICAL: Exclude sample/test videos - check fileName AND title for common patterns
      const fileName = file.fileName || '';
      const title = file.title || '';
      const fileNameLower = fileName.toLowerCase();
      const titleLower = title.toLowerCase();
      const isSampleVideo = fileNameLower.includes('sample') ||
                           fileNameLower.includes('test') ||
                           fileNameLower.includes('demo') ||
                           fileNameLower.includes('example') ||
                           titleLower.includes('sample') ||
                           titleLower.includes('test') ||
                           titleLower.includes('demo') ||
                           titleLower.includes('example');
      
      // Exclude sample videos
      if (isSampleVideo) {
        return false;
      }
      
      return matchesChannel && isVisible && hasContent;
    });
    
    console.log(`Filtered ${channelFiles.length} visible files for channel ${channelName}`);
    
    // Sort by creation date (newest first)
    // CRITICAL: If createdAt is missing, use SK (file ID) which contains timestamp
    channelFiles.sort((a, b) => {
      // Try to get date from createdAt, timestamp, or extract from SK
      let dateA = 0;
      let dateB = 0;
      
      if (a.createdAt) {
        dateA = new Date(a.createdAt).getTime();
      } else if (a.timestamp) {
        dateA = new Date(a.timestamp).getTime();
      } else if (a.SK) {
        // Extract timestamp from SK (format: FILE#file-TIMESTAMP-xxx or FILE#TIMESTAMP-xxx)
        const skMatch = a.SK.match(/file-(\d+)|FILE#(\d+)/);
        if (skMatch) {
          const timestamp = parseInt(skMatch[1] || skMatch[2]);
          if (!isNaN(timestamp)) {
            dateA = timestamp;
          }
        }
      }
      
      if (b.createdAt) {
        dateB = new Date(b.createdAt).getTime();
      } else if (b.timestamp) {
        dateB = new Date(b.timestamp).getTime();
      } else if (b.SK) {
        // Extract timestamp from SK
        const skMatch = b.SK.match(/file-(\d+)|FILE#(\d+)/);
        if (skMatch) {
          const timestamp = parseInt(skMatch[1] || skMatch[2]);
          if (!isNaN(timestamp)) {
            dateB = timestamp;
          }
        }
      }
      
      // If dates are equal or both 0, prefer videos with uploadId in filename
      if (Math.abs(dateB - dateA) < 1000) {
        const aHasUploadId = a.fileName && a.fileName.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        const bHasUploadId = b.fileName && b.fileName.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (aHasUploadId && !bHasUploadId) return -1;
        if (!aHasUploadId && bHasUploadId) return 1;
        
        // If still equal, sort by SK (which contains timestamp) - newer SKs come first
        if (a.SK && b.SK) {
          return b.SK.localeCompare(a.SK);
        }
      }
      
      return dateB - dateA; // Newest first
    });
    
    // Limit to requested amount (we fetched more to account for filtering)
    const limitedFiles = channelFiles.slice(0, pageLimit);
    
    // Normalize fields (remove empty strings)
    const content = limitedFiles.map(item => {
      const contentItem = {
        SK: item.SK,
        fileName: item.fileName,
        hlsUrl: item.hlsUrl || null,
        thumbnailUrl: item.thumbnailUrl || null,
        createdAt: item.createdAt || item.timestamp || null,
        isVisible: item.isVisible,
        price: item.price || null,
        category: item.category || null,
        uploadId: item.uploadId || null,  // Include uploadId for client-side matching
        fileId: item.fileId || null  // Include fileId for easier matching
      };
      
      // Only include title/description if they're not empty
      if (item.title && item.title.trim() !== '') {
        contentItem.title = item.title;
      }
      if (item.description && item.description.trim() !== '') {
        contentItem.description = item.description;
      }
      
      return contentItem;
    });
    
    // Get next token if there are more items (use original query result, not filtered)
    let nextTokenResult = null;
    if (result.LastEvaluatedKey) {
      nextTokenResult = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }
    
    return {
      content: content,
      count: content.length,
      nextToken: nextTokenResult
    };
  } catch (error) {
    console.error('Error in channelContent resolver:', error);
    throw error;
  }
};

