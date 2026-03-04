import AWS from 'aws-sdk';

// Initialize AWS S3 client
const s3 = new AWS.S3({
  accessKeyId: "AKIASCPOEM7JYLK5BJFR",
  secretAccessKey: "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",
  region: "us-east-1"
});

export default defineEventHandler(async (event) => {
  const { bucket, folder } = event.context.params;

  console.log(folder)

  // Specify the S3 bucket and folder
  const params = {
    Bucket: bucket,
    Prefix: folder,
  };

  try {
    // List objects in the specified folder
    const { Contents } = await s3.listObjectsV2(params).promise();

    if (!Array.isArray(Contents)) {
      console.error('Error: Contents is not an array');
      return {
        status: 500,
        body: { error: 'Internal Server Error' },
      };
    }

    // Return all contents as the API response
    return {
      status: 200,
      body: Contents,
    };
  } catch (error) {
    console.error('Error fetching files:', error);

    // Return an error response
    return {
      status: 500,
      body: { error: 'Internal Server Error' },
    };
  }
});
