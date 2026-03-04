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
  try {
    const data = await readBody(event);


    const { uploadId, partNumber } = event.context.params;
    console.log('Upload ID:', uploadId);
    console.log('Part Number:', partNumber);

    // Assuming you have the necessary data from the event

    const url = await s3.getSignedUrl('upload_part', {
      Bucket: 'twilly',
      Key: data.key, // Make sure to adapt this based on the structure of your data
      UploadId: uploadId,
      PartNumber: partNumber,
      Expires: 3600,
    });

    return {
      status: 200,
      body: { url },
    };
  } catch (error) {
    console.error('Error:', error);
    return { status: 500, body: 'Internal Server Error' };
  }
});
