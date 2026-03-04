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
  if (event.request.method !== 'DELETE') {
    return { status: 405, body: 'Method Not Allowed' };
  }



  const data = JSON.parse(await event.request.text());

  await s3.abortMultipartUpload({
    Bucket: 'twilly',
    Key: data.key,
    UploadId: event.params.upload_id,
  });

  return {
    status: 200,
    body: {},
  };
});
