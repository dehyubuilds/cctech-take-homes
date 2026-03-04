import AWS from "aws-sdk";

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const {
      fullName,
      contactInfo,
      whatDoYouDo,
      submittedAt,
      source
    } = body;

    // Validate required fields
    if (!fullName || !contactInfo || !whatDoYouDo) {
      return {
        success: false,
        message: 'Missing required fields: fullName, contactInfo, and whatDoYouDo are required'
      };
    }

    // Generate unique application ID
    const applicationId = `APP#${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create the application record
    const applicationRecord = {
      PK: 'COLLABORATION#APPLICATIONS',
      SK: applicationId,
      fullName,
      contactInfo,
      whatDoYouDo,
      submittedAt: submittedAt || new Date().toISOString(),
      source: source || 'homepage-qr',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store in DynamoDB
    await dynamodb.put({
      TableName: 'Twilly',
      Item: applicationRecord
    }).promise();

    // Create a reverse lookup for quick access
    const reverseLookup = {
      PK: 'COLLABORATION#REVERSE',
      SK: `${applicationId}#${fullName.toLowerCase().replace(/\s+/g, '-')}`,
      applicationId,
      fullName,
      contactInfo,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: reverseLookup
    }).promise();

    console.log('✅ [submit-application] Contact form submitted successfully:', {
      applicationId,
      fullName,
      source
    });

    return {
      success: true,
      message: 'Message sent successfully',
      applicationId
    };

  } catch (error) {
    console.error('❌ [submit-application] Error submitting contact form:', error);
    
    return {
      success: false,
      message: 'Failed to send message. Please try again.',
      error: error.message
    };
  }
});
