import AWS from 'aws-sdk'
import { addFileToTimelines } from '../channels/timeline-utils.js'

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
})

const dynamodb = new AWS.DynamoDB.DocumentClient()
const TABLE_NAME = 'TwillyPublic'
/** Short clips must never exist in DynamoDB. Videos shorter than this are never written; convert-to-post drops them and Lambda skips writing. */
const MIN_DURATION_SECONDS = 6

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { channelName, streamKey, title, description, price, userEmail, scheduledDropDate, postImmediately, durationSeconds, isPrivateUsername: bodyIsPrivate, isPremium: bodyIsPremium } = body
    // Stream drop screen can send current visibility; use when present so Public/Private/Premium go to the right timeline
    const bodyVisibility = (bodyIsPrivate !== undefined && bodyIsPrivate !== null) || (bodyIsPremium !== undefined && bodyIsPremium !== null)

    if (!streamKey) {
      throw createError({
        statusCode: 400,
        message: 'streamKey is required'
      })
    }

    // Short videos: never write to DynamoDB — drop immediately if duration is known and < threshold
    const durationNum = durationSeconds != null ? Number(durationSeconds) : null
    if (durationNum != null && !Number.isNaN(durationNum) && durationNum < MIN_DURATION_SECONDS) {
      console.log(`⏱️ Short video dropped (${durationNum}s < ${MIN_DURATION_SECONDS}s): streamKey=${streamKey}, not saving to DynamoDB`)
      // We still need to delete any existing FILE for this stream so it doesn't stay in the DB (e.g. created by Lambda before duration was known)
      // Look up creator and any matching file, then delete if found
      let creatorEmailForDrop = null
      try {
        const streamKeyResult = await dynamodb.get({
          TableName: TABLE_NAME,
          Key: { PK: `STREAM_KEY#${streamKey}`, SK: 'MAPPING' }
        }).promise()
        if (streamKeyResult.Item) {
          const m = streamKeyResult.Item
          creatorEmailForDrop = m.collaboratorEmail || m.ownerEmail || null
        }
      } catch (_) {}
      if (!creatorEmailForDrop && userEmail) creatorEmailForDrop = userEmail
      if (creatorEmailForDrop) {
        const queryParams = {
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          FilterExpression: 'streamKey = :streamKey',
          ExpressionAttributeValues: {
            ':pk': `USER#${creatorEmailForDrop}`,
            ':skPrefix': 'FILE#',
            ':streamKey': streamKey
          },
          Limit: 50
        }
        const result = await dynamodb.query(queryParams).promise()
        if (result.Items && result.Items.length > 0) {
          // Delete the most recent one (same logic as below: by timestamp)
          let toDelete = result.Items[0]
          let mostRecentTs = 0
          for (const item of result.Items) {
            const t = item.timestamp || item.createdAt || item.SK || ''
            const ts = typeof t === 'string' && t.includes('T') ? new Date(t).getTime() : (item.SK ? item.SK.length : 0)
            if (ts > mostRecentTs) { mostRecentTs = ts; toDelete = item }
          }
          await dynamodb.delete({
            TableName: TABLE_NAME,
            Key: { PK: toDelete.PK, SK: toDelete.SK }
          }).promise()
          console.log(`🗑️ Deleted existing short video from DynamoDB: ${toDelete.SK}`)
        }
      }
      return {
        success: true,
        message: 'Short video dropped (not saved)',
        dropped: true,
        durationSeconds: durationNum
      }
    }

    // Primary: ISO8601 from app (e.g. 2026-03-02T04:30:00.000Z). Fallback: parse failed but postImmediately=false.
    const isScheduledDropByInput = (schedDate, postNow) => {
      if (!schedDate) return false
      const d = new Date(schedDate)
      if (!isNaN(d.getTime()) && d > new Date()) return true
      if (postNow === false || postNow === undefined) return true
      return false
    }

    console.log(`🔄 Converting stream to post: streamKey=${streamKey}, channelName=${channelName || 'N/A'}, userEmail=${userEmail || 'N/A'}`)
    console.log(`   📅 Incoming schedule: postImmediately=${postImmediately}, scheduledDropDate=${scheduledDropDate ?? 'null'}`)

    let creatorEmail = null
    /** Snapshot of stream-key mapping at convert time; used to store this drop's private/premium on the FILE (per-drop, not overwrite all). */
    let streamKeyMapping = null

    // CRITICAL: ALWAYS look up from streamKey mapping first (even if userEmail is provided)
    // This ensures collaborator videos are ALWAYS stored under the correct email from the streamKey mapping
    // The streamKey mapping is the source of truth for who actually owns/created the stream
    if (streamKey) {
      console.log(`🔍 Looking up streamKey mapping for streamKey: ${streamKey}`)
      try {
        const streamKeyParams = {
          TableName: TABLE_NAME,
          Key: {
            PK: `STREAM_KEY#${streamKey}`,
            SK: 'MAPPING'
          }
        }
        const streamKeyResult = await dynamodb.get(streamKeyParams).promise()
        
        if (streamKeyResult.Item) {
          streamKeyMapping = streamKeyResult.Item
          // PRIORITY 1: For collaborator keys, ALWAYS use collaboratorEmail from mapping
          // This is critical - the streamKey mapping knows who the actual streamer is
          if (streamKeyResult.Item.isCollaboratorKey && streamKeyResult.Item.collaboratorEmail) {
            creatorEmail = streamKeyResult.Item.collaboratorEmail
            console.log(`✅ Using creatorEmail from streamKey mapping (collaborator): ${creatorEmail}`)
            console.log(`   Note: Ignoring userEmail from request (${userEmail || 'N/A'}) - streamKey mapping is source of truth`)
          } 
          // PRIORITY 2: For owner keys, use ownerEmail from mapping
          else if (streamKeyResult.Item.ownerEmail) {
            creatorEmail = streamKeyResult.Item.ownerEmail
            console.log(`✅ Using creatorEmail from streamKey mapping (owner): ${creatorEmail}`)
          }
        } else {
          console.log(`⚠️ StreamKey mapping not found for ${streamKey}`)
        }
      } catch (error) {
        console.error(`❌ Error looking up streamKey mapping: ${error.message}`)
      }
    }

    // FALLBACK: If streamKey mapping lookup failed, use userEmail from request
    // This handles cases where streamKey mapping doesn't exist yet (shouldn't happen in normal flow)
    if (!creatorEmail && userEmail) {
      creatorEmail = userEmail
      console.log(`⚠️ Using userEmail from request as fallback: ${creatorEmail}`)
      console.log(`   WARNING: This should only happen if streamKey mapping is missing!`)
    }

    // Fallback: If still not found, try to get it from channel metadata
    if (!creatorEmail && channelName) {
      console.log(`⚠️ creatorEmail still not found, attempting channel metadata lookup for channelName: ${channelName}`)
      try {
        const channelMetaQuery = {
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND SK = :sk',
          ExpressionAttributeValues: {
            ':pk': `CHANNEL#${channelName}`,
            ':sk': 'METADATA'
          }
        }

        const channelMetaResult = await dynamodb.query(channelMetaQuery).promise()
        creatorEmail = channelMetaResult.Items?.[0]?.creatorEmail
        
        if (!creatorEmail) {
          console.log(`⚠️ Channel metadata not found for channelName: ${channelName}`)
        } else {
          console.log(`✅ Found creatorEmail from channel metadata: ${creatorEmail}`)
        }
      } catch (error) {
        console.error(`❌ Error looking up channel metadata: ${error.message}`)
        // Don't throw here - we'll check if creatorEmail is set below
      }
    }

    if (!creatorEmail) {
      console.error(`❌ creatorEmail is missing - userEmail: ${userEmail || 'N/A'}, channelName: ${channelName || 'N/A'}`)
      throw createError({
        statusCode: 400,
        message: 'userEmail is required (either provided directly or via valid channelName)'
      })
    }
    
    // Normalize creator PK for consistent writes and lookups (timelines use lowercase)
    const creatorPk = (creatorEmail || '').toLowerCase().trim()
    console.log(`✅ Using creatorEmail: ${creatorEmail} (PK: USER#${creatorPk})`)

    // Resolve visibility for this drop: prefer body (stream drop screen) over stream key mapping
    const resolveVisibility = () => {
      if (bodyVisibility) {
        const priv = bodyIsPrivate === true || bodyIsPrivate === 'true' || bodyIsPrivate === 1
        const prem = bodyIsPremium === true || bodyIsPremium === 'true' || bodyIsPremium === 1
        console.log(`📌 [convert-to-post] Using visibility from request body: isPrivateUsername=${priv}, isPremium=${prem}`)
        return { isPrivateUsername: priv, isPremium: prem }
      }
      const fromMapping = streamKeyMapping && {
        isPrivateUsername: streamKeyMapping.isPrivateUsername === true || streamKeyMapping.isPrivateUsername === 'true' || streamKeyMapping.isPrivateUsername === 1,
        isPremium: streamKeyMapping.isPremium === true || streamKeyMapping.isPremium === 'true' || streamKeyMapping.isPremium === 1
      }
      return fromMapping || { isPrivateUsername: false, isPremium: false }
    }

    // Query for files (PK = USER#email, SK starts with FILE#). Use lowercase first so we find FILEs we wrote.
    const queryFiles = async (pk) => {
      const res = await dynamodb.query({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: 'streamKey = :streamKey',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':skPrefix': 'FILE#',
          ':streamKey': streamKey
        },
        Limit: 50
      }).promise()
      return res.Items || []
    }
    let items = await queryFiles(`USER#${creatorPk}`)
    if (items.length === 0 && creatorEmail.trim() !== creatorPk) {
      items = await queryFiles(`USER#${creatorEmail.trim()}`)
    }
    const result = { Items: items }
    
    // Find the MOST RECENT file by timestamp (not the first one!)
    // This prevents overwriting old videos when stream keys are reused
    let matchingFile = null
    let mostRecentTimestamp = null
    
    if (result.Items && result.Items.length > 0) {
      for (const item of result.Items) {
        const itemTimestamp = item.timestamp || item.createdAt || item.SK || ''
        
        // Parse timestamp - could be ISO string or file ID with timestamp
        let timestampValue = null
        try {
          // Try ISO string first
          if (typeof itemTimestamp === 'string' && itemTimestamp.includes('T')) {
            timestampValue = new Date(itemTimestamp).getTime()
          } else if (item.SK && item.SK.includes('file-')) {
            // Extract timestamp from fileId format: file-upload-1234567890-random
            const fileIdParts = item.SK.split('-')
            for (let i = 0; i < fileIdParts.length; i++) {
              if (fileIdParts[i] === 'upload' && i + 1 < fileIdParts.length) {
                const timestampStr = fileIdParts[i + 1]
                if (/^\d+$/.test(timestampStr)) {
                  timestampValue = parseInt(timestampStr)
                  break
                }
              }
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
        
        // Use file SK as fallback for sorting (newer files have higher values)
        if (!timestampValue) {
          timestampValue = item.SK ? item.SK.length : 0
        }
        
        if (!mostRecentTimestamp || timestampValue > mostRecentTimestamp) {
          mostRecentTimestamp = timestampValue
          matchingFile = item
        }
      }
      
      console.log(`📋 Found ${result.Items.length} file(s) with streamKey ${streamKey}, selected most recent: ${matchingFile.SK} (timestamp: ${mostRecentTimestamp})`)
    } else {
      console.log(`⚠️ No files found with streamKey ${streamKey} and channelName ${channelName}`)
    }

    if (!matchingFile) {
      // No file entry found - create a placeholder entry immediately
      // This allows users to add metadata right away, even before EC2 processing completes
      // Defensive: never create a placeholder for a short clip (should already be caught at top)
      if (durationSeconds != null && Number(durationSeconds) < MIN_DURATION_SECONDS) {
        console.log(`⏱️ Short video dropped (placeholder path): ${durationSeconds}s < ${MIN_DURATION_SECONDS}s, not creating FILE`)
        return { success: true, message: 'Short video dropped (not saved)', dropped: true, durationSeconds: Number(durationSeconds) }
      }
      console.log(`📝 No file entry found for streamKey ${streamKey} - creating placeholder entry`)
      console.log(`   This allows immediate metadata entry, video URLs will be added when processing completes`)
      
      // Generate a file ID with timestamp for uniqueness
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 9)
      const fileId = `file-upload-${timestamp}-${randomId}`
      const fileName = `${streamKey}_placeholder.m3u8`
      const currentTimestamp = new Date().toISOString()
      const isScheduledPlaceholder = isScheduledDropByInput(scheduledDropDate, postImmediately)
      const { isPrivateUsername: isPrivateUsernameRes, isPremium: isPremiumRes } = resolveVisibility()
      const creatorPk = (creatorEmail || '').toLowerCase().trim()
      const placeholderFile = {
        PK: `USER#${creatorPk}`,
        SK: `FILE#${fileId}`,
        fileName: fileName,
        fileExtension: 'm3u8',
        folderName: channelName || 'default',
        streamKey: streamKey,
        category: 'Videos',
        timestamp: currentTimestamp,
        createdAt: currentTimestamp,
        title: title || null,
        description: description || null,
        price: price !== null && price !== undefined ? price : 0,
        isVisible: false, // Will be set to true when processing completes or when airdate passes (for scheduled)
        isProcessing: true,
        hlsUrl: null,
        thumbnailUrl: null,
        url: null,
        isPrivateUsername: !!isPrivateUsernameRes,
        isPremium: !!isPremiumRes,
        ...(isScheduledPlaceholder ? { status: 'HELD', scheduledDropDate, releaseStatus: 'HELD' } : {}),
        ...(durationSeconds != null && Number(durationSeconds) > 0 ? { durationSeconds: Number(durationSeconds) } : {})
      }
      
      // Create the placeholder entry
      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: placeholderFile
      }).promise()
      
      console.log(`✅ Created placeholder file entry: ${fileId}`)
      console.log(`   Visibility: isPrivateUsername=${!!isPrivateUsernameRes}, isPremium=${!!isPremiumRes}`)
      if (isScheduledPlaceholder) console.log(`   📅 Scheduled drop: status=HELD, scheduledDropDate=${scheduledDropDate}`)
      if (durationSeconds != null && Number(durationSeconds) > 0) console.log(`   📏 durationSeconds: ${durationSeconds}`)
      try {
        await addFileToTimelines(creatorEmail, placeholderFile)
      } catch (e) {
        console.warn(`⚠️ [convert-to-post] Timeline add failed (non-blocking): ${e.message}`)
      }
      return {
        success: true,
        message: 'Stream metadata saved successfully. Video will be available once processing completes.',
        fileId: fileId,
        isProcessing: true
      }
    } else {
      // CRITICAL: Never overwrite a published file's visibility when the same stream key is reused.
      // If this file was already published (isVisible === true), it belongs to a previous drop — create a new placeholder for this drop.
      const alreadyPublished = matchingFile.isVisible === true || matchingFile.isVisible === 'true' || matchingFile.isVisible === 1
      if (alreadyPublished) {
        console.log(`⚠️ File ${matchingFile.SK} was already published (isVisible=true) - same streamKey reused for new drop; creating new placeholder to avoid overwriting public→private`)
        matchingFile = null
      }
      // Also check file age: if created more than 5 minutes ago, treat as previous drop
      const fileTimestamp = matchingFile ? (matchingFile.timestamp || matchingFile.createdAt) : null
      let fileAge = null
      
      if (matchingFile && fileTimestamp) {
        try {
          const fileDate = new Date(fileTimestamp)
          fileAge = Date.now() - fileDate.getTime() // Age in milliseconds
          const fileAgeMinutes = fileAge / (1000 * 60)
          
          console.log(`📋 File age: ${fileAgeMinutes.toFixed(2)} minutes (timestamp: ${fileTimestamp})`)
          
          // If file is older than 5 minutes, it's likely an old file being overwritten
          // In this case, we should create a new entry OR wait for the new file to be processed
          if (fileAgeMinutes > 5) {
            console.log(`⚠️ File is ${fileAgeMinutes.toFixed(2)} minutes old - likely an old video being overwritten!`)
            console.log(`   This should not happen. The stream might still be processing.`)
            
            // Check if there are multiple files - if so, we might have found the wrong one
            if (result.Items && result.Items.length > 1) {
              console.log(`   Found ${result.Items.length} files - checking for newer ones...`)
              
              // File should have been processed within the last 10 minutes
              // Look for any file created in the last 10 minutes
              const recentFiles = result.Items.filter(item => {
                const itemTimestamp = item.timestamp || item.createdAt
                if (!itemTimestamp) return false
                try {
                  const itemDate = new Date(itemTimestamp)
                  const itemAge = Date.now() - itemDate.getTime()
                  return itemAge < (10 * 60 * 1000) // Less than 10 minutes old
                } catch {
                  return false
                }
              })
              
              if (recentFiles.length > 0) {
                // Use the most recent of the recent files
                recentFiles.sort((a, b) => {
                  const aTime = new Date(a.timestamp || a.createdAt || 0).getTime()
                  const bTime = new Date(b.timestamp || b.createdAt || 0).getTime()
                  return bTime - aTime
                })
                matchingFile = recentFiles[0]
                console.log(`✅ Found recent file: ${matchingFile.SK} (created: ${matchingFile.timestamp || matchingFile.createdAt})`)
              } else {
                // No recent files - create a placeholder entry immediately
                console.log(`📝 No recent files found - creating placeholder entry immediately`)
                console.log(`   This allows immediate metadata entry, video URLs will be added when EC2 processing completes`)
                matchingFile = null // Force placeholder creation
              }
            } else {
              // Only one file and it's old - create a placeholder entry immediately
              console.log(`📝 Old file found but stream is new - creating placeholder entry immediately`)
              console.log(`   This allows immediate metadata entry, video URLs will be added when EC2 processing completes`)
              matchingFile = null // Force placeholder creation
            }
          }
        } catch (e) {
          console.error(`⚠️ Error parsing file timestamp: ${e.message}`)
        }
      }
      
      // If matchingFile was set to null (old file found), create placeholder instead
      if (!matchingFile) {
        // Defensive: never create a placeholder for a short clip
        if (durationSeconds != null && Number(durationSeconds) < MIN_DURATION_SECONDS) {
          console.log(`⏱️ Short video dropped (placeholder path): ${durationSeconds}s < ${MIN_DURATION_SECONDS}s, not creating FILE`)
          return { success: true, message: 'Short video dropped (not saved)', dropped: true, durationSeconds: Number(durationSeconds) }
        }
        // Generate a file ID with timestamp for uniqueness
        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substring(2, 9)
        const fileId = `file-upload-${timestamp}-${randomId}`
        const fileName = `${streamKey}_placeholder.m3u8`
        const currentTimestamp = new Date().toISOString()
        const isScheduledPlaceholder = isScheduledDropByInput(scheduledDropDate, postImmediately)
        const vis2 = resolveVisibility()
        const creatorPkVis = (creatorEmail || '').toLowerCase().trim()
        // Create placeholder file entry (scheduled drop → status HELD for timeline premiere card)
        const placeholderFile = {
          PK: `USER#${creatorPkVis}`,
          SK: `FILE#${fileId}`,
          fileName: fileName,
          fileExtension: 'm3u8',
          folderName: channelName || 'default',
          streamKey: streamKey,
          category: 'Videos',
          timestamp: currentTimestamp,
          createdAt: currentTimestamp,
          title: title || null,
          description: description || null,
          price: price !== null && price !== undefined ? price : 0,
          isVisible: false, // Will be set to true when processing completes
          isProcessing: true, // Flag to indicate still processing
          hlsUrl: null, // Will be added when EC2 processing completes
          thumbnailUrl: null, // Will be added when EC2 processing completes
          url: null,
          isPrivateUsername: !!vis2.isPrivateUsername,
          isPremium: !!vis2.isPremium,
          ...(isScheduledPlaceholder ? { status: 'HELD', scheduledDropDate, releaseStatus: 'HELD' } : {}),
          ...(durationSeconds != null && Number(durationSeconds) > 0 ? { durationSeconds: Number(durationSeconds) } : {})
        }
        
        // Create the placeholder entry
        await dynamodb.put({
          TableName: TABLE_NAME,
          Item: placeholderFile
        }).promise()
        
        console.log(`✅ Created placeholder file entry: ${fileId}`)
        console.log(`   Visibility: isPrivateUsername=${!!vis2.isPrivateUsername}, isPremium=${!!vis2.isPremium}`)
        if (isScheduledPlaceholder) console.log(`   📅 Scheduled drop: status=HELD, scheduledDropDate=${scheduledDropDate}`)
        if (durationSeconds != null && Number(durationSeconds) > 0) console.log(`   📏 durationSeconds: ${durationSeconds}`)
        try {
          await addFileToTimelines(creatorEmail, placeholderFile)
        } catch (e) {
          console.warn(`⚠️ [convert-to-post] Timeline add failed (non-blocking): ${e.message}`)
        }
        return {
          success: true,
          message: 'Stream metadata saved successfully. Video will be available once processing completes.',
          fileId: fileId,
          isProcessing: true
        }
      }

      // Update existing entry with metadata (this is the most recent file)
      console.log(`📝 Updating MOST RECENT file entry with metadata...`)
      console.log(`   File: SK=${matchingFile.SK}, fileName=${matchingFile.fileName}`)
      console.log(`   File timestamp: ${matchingFile.timestamp || matchingFile.createdAt || 'unknown'}`)
      
      // Scheduled drop: primary = ISO8601 parses and is future; fallback = parse failed but postImmediately=false
      const isScheduledDrop = isScheduledDropByInput(scheduledDropDate, postImmediately)
      if (isScheduledDrop && scheduledDropDate && isNaN(new Date(scheduledDropDate).getTime())) {
        console.log(`   📅 Fallback: scheduledDropDate could not parse ("${scheduledDropDate}"), treating as HELD`)
      }
      const status = isScheduledDrop ? 'HELD' : (matchingFile.status || 'PUBLISHED')
      const isVisible = isScheduledDrop ? false : true
      const vis3 = resolveVisibility()

      // IMPORTANT: Only update metadata fields, don't overwrite the entire file entry
      // This ensures we don't accidentally overwrite newer processing results
      // Store this drop's visibility (private vs premium) from body or stream mapping at convert time so each drop keeps its own.
      const updatedItem = {
        ...matchingFile,
        title: title || matchingFile.title || null,
        description: description || matchingFile.description || null,
        price: price !== null && price !== undefined ? price : (matchingFile.price || 0),
        isVisible,
        status,
        isPrivateUsername: !!vis3.isPrivateUsername,
        isPremium: !!vis3.isPremium,
        ...(isScheduledDrop && scheduledDropDate ? { scheduledDropDate, releaseStatus: 'HELD' } : {}),
        ...(durationSeconds != null && Number(durationSeconds) > 0 ? { durationSeconds: Number(durationSeconds) } : {}),
        // Preserve all other fields (hlsUrl, thumbnailUrl, etc.) in case they were updated during processing
      }
      
      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: updatedItem
      }).promise()
      
      console.log(`✅ Updated MOST RECENT file entry with metadata`)
      console.log(`   Title: ${updatedItem.title || 'none'}`)
      console.log(`   Description: ${updatedItem.description ? updatedItem.description.substring(0, 50) + '...' : 'none'}`)
      console.log(`   Price: ${updatedItem.price || 0}`)
      console.log(`   File ID: ${matchingFile.SK.replace('FILE#', '')}`)
      if (isScheduledDrop) {
        console.log(`   📅 Scheduled drop (premiere): status=HELD, scheduledDropDate=${scheduledDropDate}, isVisible=false`)
      }
      try {
        await addFileToTimelines(creatorEmail, updatedItem)
      } catch (e) {
        console.warn(`⚠️ [convert-to-post] Timeline add failed (non-blocking): ${e.message}`)
      }
      return {
        success: true,
        message: 'Stream converted to post successfully',
        fileId: matchingFile.SK.replace('FILE#', ''),
        fileAge: fileAge ? `${(fileAge / (1000 * 60)).toFixed(2)} minutes` : 'unknown'
      }
    }
  } catch (error) {
    console.error('❌ Error converting stream to post:', error)
    console.error('❌ Error stack:', error.stack)
    console.error('❌ Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    // Ensure we always return a proper error response
    const errorMessage = error.message || error.statusMessage || 'Failed to convert stream to post'
    const statusCode = error.statusCode || 500
    
    throw createError({
      statusCode: statusCode,
      message: errorMessage,
      data: {
        error: errorMessage,
        streamKey: streamKey || 'unknown',
        channelName: channelName || 'unknown',
        userEmail: userEmail || 'unknown'
      }
    })
  }
})

