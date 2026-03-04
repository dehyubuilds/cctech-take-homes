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
    const { fileUrl, filename, contentType, creatorUsername } = body

    if (!fileUrl || !filename || !contentType || !creatorUsername) {
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
    const fileName = `collaborator-requests/${creatorUsername}/${requestId}/clip.${fileExtension}`
    
    // Download the file from the provided URL
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error('Failed to download file from URL')
    }
    
    const fileBuffer = await response.arrayBuffer()
    
    // Validate file size (2GB limit)
    const maxSize = 2 * 1024 * 1024 * 1024 // 2GB
    if (fileBuffer.byteLength > maxSize) {
      throw new Error('File size must be less than 2GB')
    }
    
    // Upload to S3
    const uploadParams = {
      Bucket: 'twillyimages',
      Key: fileName,
      Body: Buffer.from(fileBuffer),
      ContentType: contentType,
      Metadata: {
        'original-filename': filename,
        'upload-date': new Date().toISOString()
      }
    }

    const uploadResult = await s3.upload(uploadParams).promise()
    
    // Generate CloudFront URL
    const clipUrl = `https://d3hv50jkrzkiyh.cloudfront.net/${fileName}`
    
    console.log('Clip uploaded successfully:', {
      bucket: 'twillyimages',
      key: fileName,
      cloudFrontUrl: clipUrl,
      size: fileBuffer.byteLength,
      type: contentType
    })

    return {
      success: true,
      clipUrl,
      requestId,
      fileName: filename,
      size: fileBuffer.byteLength
    }

  } catch (error) {
    console.error('Error uploading clip:', error)
    return {
      success: false,
      message: error.message || 'Failed to upload clip'
    }
  }
}) 