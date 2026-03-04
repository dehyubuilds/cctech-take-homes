import AWS from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const s3 = new AWS.S3()

  try {
    const body = await readBody(event)
    const { filename, contentType, creatorUsername } = body

    if (!filename || !contentType || !creatorUsername) {
      throw new Error('Missing required parameters')
    }

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime']
    if (!allowedTypes.includes(contentType)) {
      throw new Error('Only MP4, MOV, and AVI files are allowed')
    }

    // Generate unique filename
    const requestId = uuidv4()
    const fileExtension = filename.split('.').pop()
    const key = `collaborator-requests/${creatorUsername}/${requestId}/clip.${fileExtension}`

    // Generate presigned URL
    const params = {
      Bucket: 'twillyimages',
      Key: key,
      ContentType: contentType,
      Expires: 3600, // 1 hour
      Metadata: {
        'original-filename': filename,
        'upload-date': new Date().toISOString(),
        'creator-username': creatorUsername
      }
    }

    const presignedUrl = await s3.getSignedUrlPromise('putObject', params)
    
    console.log('Generated presigned URL:', {
      key,
      contentType,
      creatorUsername,
      expiresIn: '1 hour'
    })

    return {
      success: true,
      url: presignedUrl,
      fields: {},
      headers: {
        'Content-Type': contentType
      },
      key: key,
      requestId: requestId
    }

  } catch (error) {
    console.error('Error generating presigned URL:', error)
    return {
      success: false,
      message: error.message || 'Failed to generate upload URL'
    }
  }
}) 