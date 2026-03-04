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
  const params = {
    Bucket: 'twilly',
    Key: 'uppyfile.pdf',
    ContentType: 'application/pdf',
    Expires: 3600,
  };
  
  const url = s3.getSignedUrl('putObject', params);

  return {
    status: 200,
    body: {
      method: 'PUT',
      url,
      headers: {
        'content-type': 'application/pdf',
      },
    },
  };
});
