import AWS from 'aws-sdk';

// Initialize the AWS SDK with your S3 credentials and region
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '81v8RfOXhFHoKvOyD5t4I8kIeaVq9ad9TSAnp7eI',
  region: 'us-east-1',
});

// Create an S3 instance
const s3 = new AWS.S3();

export default defineEventHandler(async (event) => {

  // Extracting the path variable
  const { uploadId } = event.context.params;

  // Assuming you have the necessary data from the event
  const data = await readBody(event);

  try {
    // Assuming you want to complete the multipart upload
    const response = await s3.completeMultipartUpload({
      Bucket: 'twilly',
      Key: data.key, // Make sure to adapt this based on the structure of your data
      UploadId: uploadId,
      MultipartUpload: { Parts: data.parts }, // Make sure to adapt this based on the structure of your data
    });

    return {
      status: 200,
      body: {
        location: response.Location,
      },
    };
  } catch (error) {
    console.error('Error:', error);
    return { status: 500, body: 'Internal Server Error' };
  }
});
