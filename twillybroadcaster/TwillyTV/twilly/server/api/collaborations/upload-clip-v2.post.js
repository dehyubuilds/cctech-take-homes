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
    const formData = await readMultipartFormData(event);

    const clipFile = formData.find((item) => item.name === 'clipFile');
    const creatorUsernameField = formData.find((item) => item.name === 'creatorUsername');

    if (!clipFile) {
      throw new Error('No clip file provided');
    }

    if (!creatorUsernameField) {
      throw new Error('Creator username is required');
    }

    const creatorUsername = creatorUsernameField.data.toString();

    // Validate file size (2GB limit)
    const maxSize = 2 * 1024 * 1024 * 1024 // 2GB
    if (clipFile.data.length > maxSize) {
      throw new Error('File size must be less than 2GB')
    }

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime']
    if (!allowedTypes.includes(clipFile.type)) {
      throw new Error('Only MP4, MOV, and AVI files are allowed')
    }

    // Generate unique filename
    const requestId = uuidv4()
    const fileExtension = clipFile.filename.split('.').pop()
    const fileName = `collaborator-requests/${creatorUsername}/${requestId}/clip.${fileExtension}`
    
    // Upload to S3
    const uploadParams = {
      Bucket: 'twillyimages',
      Key: fileName,
      Body: clipFile.data,
      ContentType: clipFile.type,
      Metadata: {
        'original-filename': clipFile.filename,
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
      size: clipFile.data.length,
      type: clipFile.type
    })

    return {
      success: true,
      clipUrl,
      requestId,
      fileName: clipFile.filename,
      size: clipFile.data.length
    }

  } catch (error) {
    console.error('Error uploading clip:', error)
    return {
      success: false,
      message: error.message || 'Failed to upload clip'
    }
  }
}) 