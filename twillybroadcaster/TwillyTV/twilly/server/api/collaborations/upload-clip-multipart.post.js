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
    const { creatorUsername, fileName, fileType, fileSize } = body

    if (!creatorUsername || !fileName || !fileType) {
      throw new Error('Missing required parameters')
    }

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime']
    if (!allowedTypes.includes(fileType)) {
      throw new Error('Only MP4, MOV, and AVI files are allowed')
    }

    // Generate unique filename
    const requestId = uuidv4()
    const fileExtension = fileName.split('.').pop()
    const s3Key = `collaborator-requests/${creatorUsername}/${requestId}/clip.${fileExtension}`
    
    // Initiate multipart upload
    const multipartParams = {
      Bucket: 'twillyimages',
      Key: s3Key,
      ContentType: fileType,
      Metadata: {
        'original-filename': fileName,
        'upload-date': new Date().toISOString(),
        'file-size': fileSize.toString()
      }
    }

    const multipartResult = await s3.createMultipartUpload(multipartParams).promise()
    
    console.log('Multipart upload initiated:', {
      uploadId: multipartResult.UploadId,
      key: s3Key,
      fileSize: fileSize
    })

    return {
      success: true,
      uploadId: multipartResult.UploadId,
      key: s3Key,
      requestId,
      fileName,
      fileSize
    }

  } catch (error) {
    console.error('Error initiating multipart upload:', error)
    return {
      success: false,
      message: error.message || 'Failed to initiate upload'
    }
  }
}) 