import AWS from 'aws-sdk'

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
})

const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' })
const TABLE_NAME = 'Twilly'

/** Delete multiple FILE items from DynamoDB (e.g. short-video cleanup). Permission: user must be owner or creator of each file. */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { userId, fileIds } = body

    if (!userId || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'userId and fileIds (non-empty array) are required'
      })
    }

    const userIdLower = userId.toLowerCase().trim()
    const adminEmail = 'dehyu.sinyan@gmail.com'
    let deleted = 0
    const errors = []

    for (const fileId of fileIds) {
      if (!fileId || typeof fileId !== 'string') continue
      const sk = fileId.startsWith('FILE#') ? fileId : `FILE#${fileId}`

      try {
        let item = (await dynamodb.get({
          TableName: TABLE_NAME,
          Key: { PK: `USER#${userId}`, SK: sk }
        }).promise()).Item

        let actualPK = `USER#${userId}`
        if (!item) {
          item = (await dynamodb.get({
            TableName: TABLE_NAME,
            Key: { PK: `USER#${adminEmail}`, SK: sk }
          }).promise()).Item
          if (item) actualPK = `USER#${adminEmail}`
        }

        if (!item) {
          errors.push(`${sk}: not found`)
          continue
        }

        const creatorEmailLower = (item.creatorEmail || '').toLowerCase().trim()
        const streamerEmailLower = (item.streamerEmail || '').toLowerCase().trim()
        const isOwnFile = actualPK === `USER#${userId}`
        const isCreator = creatorEmailLower === userIdLower || streamerEmailLower === userIdLower
        let isStreamKeyOwner = false
        if (item.streamKey) {
          try {
            const mapping = (await dynamodb.get({
              TableName: TABLE_NAME,
              Key: { PK: `STREAM_KEY#${item.streamKey}`, SK: 'MAPPING' }
            }).promise()).Item
            if (mapping && (mapping.ownerEmail || '').toLowerCase() === userIdLower) isStreamKeyOwner = true
            if (mapping && (mapping.collaboratorEmail || '').toLowerCase() === userIdLower) isStreamKeyOwner = true
          } catch (_) {}
        }

        if (!isOwnFile && !isCreator && !isStreamKeyOwner) {
          errors.push(`${sk}: permission denied`)
          continue
        }

        await dynamodb.delete({
          TableName: TABLE_NAME,
          Key: { PK: actualPK, SK: sk }
        }).promise()
        deleted++
      } catch (err) {
        errors.push(`${sk}: ${err.message || 'delete failed'}`)
      }
    }

    console.log(`✅ [delete-batch] userId=${userId}, requested=${fileIds.length}, deleted=${deleted}, errors=${errors.length}`)
    return {
      success: true,
      deleted,
      failed: fileIds.length - deleted,
      totalRequested: fileIds.length,
      ...(errors.length > 0 ? { errors } : {})
    }
  } catch (error) {
    console.error('❌ delete-batch error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Batch delete failed'
    })
  }
})
