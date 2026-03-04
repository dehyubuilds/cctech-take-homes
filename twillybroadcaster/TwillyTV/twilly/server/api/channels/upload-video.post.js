import { readMultipartFormData } from 'h3'
import FormData from 'form-data'
import fetch from 'node-fetch-native'

export default defineEventHandler(async (event) => {
  try {
    // Read multipart form data from request
    const formData = await readMultipartFormData(event)
    
    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No form data received'
      })
    }
    
    // Extract fields
    const videoField = formData.find(field => field.name === 'video')
    const channelNameField = formData.find(field => field.name === 'channelName')
    const userEmailField = formData.find(field => field.name === 'userEmail')
    const streamKeyField = formData.find(field => field.name === 'streamKey')
    const titleField = formData.find(field => field.name === 'title')
    const descriptionField = formData.find(field => field.name === 'description')
    const priceField = formData.find(field => field.name === 'price')
    const isVisibleField = formData.find(field => field.name === 'isVisible')
    
    if (!videoField || !videoField.data) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No video file provided'
      })
    }
    
    if (!channelNameField || !userEmailField || !streamKeyField) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: channelName, userEmail, streamKey'
      })
    }
    
    const channelName = channelNameField.data.toString()
    const userEmail = userEmailField.data.toString()
    const streamKey = streamKeyField.data.toString()
    const title = titleField ? titleField.data.toString().trim() : null
    const description = descriptionField ? descriptionField.data.toString().trim() : null
    const price = priceField ? (priceField.data.toString().trim() ? parseFloat(priceField.data.toString()) : null) : null
    
    // Get EC2 server URL from environment or use default
    const ec2ServerUrl = process.env.EC2_STREAMING_SERVER_URL || 'http://100.24.103.57:3000'
    const uploadUrl = `${ec2ServerUrl}/api/channels/upload-video`
    
    // Create form data to forward to EC2 server
    const forwardFormData = new FormData()
    forwardFormData.append('video', Buffer.from(videoField.data), {
      filename: videoField.filename || 'video.mov',
      contentType: videoField.type || 'video/quicktime'
    })
    forwardFormData.append('channelName', channelName)
    forwardFormData.append('userEmail', userEmail)
    forwardFormData.append('streamKey', streamKey)
    
    // Forward video details if provided (only non-empty values)
    if (title && title.length > 0) {
      forwardFormData.append('title', title)
      console.log(`📤 Sending title: ${title}`)
    } else {
      console.log(`📤 No title to send (title=${title})`)
    }
    if (description && description.length > 0) {
      forwardFormData.append('description', description)
      console.log(`📤 Sending description: ${description.substring(0, 50)}...`)
    } else {
      console.log(`📤 No description to send (description=${description})`)
    }
    if (price !== null && price !== undefined) {
      forwardFormData.append('price', price.toString())
      console.log(`📤 Sending price: ${price}`)
    } else {
      console.log(`📤 No price to send (price=${price})`)
    }
    
    // Forward to EC2 server
    console.log(`📤 Forwarding upload to EC2 server: ${uploadUrl}`)
    console.log(`📤 Video size: ${videoField.data.length} bytes`)
    console.log(`📤 Channel: ${channelName}, Email: ${userEmail}, StreamKey: ${streamKey}`)
    console.log(`📤 Metadata being sent - Title: ${title || 'none'}, Description: ${description || 'none'}, Price: ${price !== null && price !== undefined ? price : 'none'}`)
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: forwardFormData,
      headers: forwardFormData.getHeaders()
    })
    
    console.log(`📤 EC2 server response status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ EC2 server error (${response.status}): ${errorText}`)
      throw createError({
        statusCode: response.status,
        statusMessage: `EC2 server error: ${errorText}`
      })
    }
    
    const result = await response.json()
    
    return {
      success: true,
      ...result
    }
    
  } catch (error) {
    console.error('Error in upload-video endpoint:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to upload video'
    })
  }
})

