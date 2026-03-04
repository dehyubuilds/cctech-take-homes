import AWS from 'aws-sdk'
import { readMultipartFormData } from 'h3'

const s3 = new AWS.S3({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readMultipartFormData(event)
    
    if (!body || body.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No file uploaded'
      })
    }

    // Find the file in the multipart data
    const fileData = body.find(part => part.name === 'file')
    const creatorUsername = body.find(part => part.name === 'creatorUsername')?.data.toString()
    
    if (!fileData) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No file found in request'
      })
    }

    if (!creatorUsername) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Creator username is required'
      })
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const originalName = fileData.filename || 'clip.mp4'
    const key = `collaborator-requests/${creatorUsername}/${timestamp}_${originalName}`

    // Upload to S3
    const uploadParams = {
      Bucket: 'twillyimages',
      Key: key,
      Body: fileData.data,
      ContentType: fileData.type || 'video/mp4',
      Metadata: {
        'creator-username': creatorUsername,
        'original-filename': originalName,
        'upload-date': new Date().toISOString()
      }
    }

    const result = await s3.upload(uploadParams).promise()

    // Return CloudFront URL
    const cloudFrontUrl = `https://d3hv50jkrzkiyh.cloudfront.net/${key}`

    return {
      success: true,
      message: 'File uploaded successfully',
      key: key,
      cloudFrontUrl: cloudFrontUrl,
      size: fileData.data.length,
      type: fileData.type || 'video/mp4'
    }

  } catch (error) {
    console.error('Upload error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to upload file'
    })
  }
}) 