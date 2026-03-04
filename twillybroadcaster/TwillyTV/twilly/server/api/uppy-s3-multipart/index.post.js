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
  const body = await readBody(event);
 
  const content_type = body.type;

  const response = await s3.createMultipartUpload({
    Bucket: 'twilly',
    Key: 'multipartuppyfile.pdf',
    ContentType: content_type,
  });

  return {
    status: 200,
    body: {
      uploadId: response.UploadId,
      key: response.Key,
    },
  };
});
