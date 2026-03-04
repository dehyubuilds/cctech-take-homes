const AWS = require('aws-sdk');

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  console.log('Aggregator Lambda triggered:', JSON.stringify(event, null, 2));

  try {
    for (const record of event.Records) {
      const message = JSON.parse(record.body);
      console.log('Processing message:', JSON.stringify(message, null, 2));
      
      // Handle new message format from streaming service
      if (message.type === 'stream_processed') {
        const { streamName, schedulerId, timestamp, files } = message;
        console.log(`Processing stream_processed message for ${streamName}`);
        
        // Create unique prefix from timestamp
        const uniquePrefix = `${streamName}_${timestamp.replace(/[:.]/g, '-')}`;
        
        try {
          // Check if files exist in S3
          const listResponse = await s3.listObjectsV2({
            Bucket: 'theprivatecollection',
            Prefix: `clips/${streamName}/`,
            MaxKeys: 20
          }).promise();
          
          console.log(`S3 response for ${streamName}:`, JSON.stringify(listResponse, null, 2));
          
          if (listResponse.Contents && listResponse.Contents.length > 0) {
            console.log(`Found ${listResponse.Contents.length} files for stream ${streamName}`);
            
            // Find the master playlist file
            const masterPlaylist = listResponse.Contents.find(file => 
              file.Key.includes('_master.m3u8')
            );
            
            if (masterPlaylist) {
              console.log(`Found master playlist: ${masterPlaylist.Key}`);
              
              // Create DynamoDB entry
              const timestamp = new Date().toISOString();
              const item = {
                PK: `USER#${schedulerId}`,
                SK: `FILE#${uniquePrefix}`,
                fileName: `${streamName}_master_${uniquePrefix.split('_').pop()}`,
                fileType: 'hls',
                fileSize: masterPlaylist.Size || 0,
                uploadDate: timestamp,
                lastModified: timestamp,
                isPublic: false,
                folderPath: streamName,
                folderName: streamName,
                streamKey: streamName,
                s3Key: masterPlaylist.Key,
                uniquePrefix: uniquePrefix,
                hasVariants: true,
                category: 'Videos',
                hlsUrl: `https://d26k8mraabzpiy.cloudfront.net/${masterPlaylist.Key}`,
                thumbnailUrl: `https://theprivatecollection.s3.us-east-1.amazonaws.com/clips/${streamName}/${uniquePrefix}_thumb.jpg`,
                isVisible: true // New items are visible by default
              };
              
              await dynamodb.put({
                TableName: 'Twilly',
                Item: item
              }).promise();
              
              console.log(`Successfully wrote to DynamoDB for stream ${streamName}`);
            } else {
              console.log(`No master playlist found for stream ${streamName}`);
            }
          } else {
            console.log(`No files found for stream ${streamName}`);
          }
        } catch (error) {
          console.error(`Error processing stream ${streamName}:`, error);
        }
      }
      // Handle old message format (for backward compatibility)
      else if (message.streamId && message.action) {
        const { streamId, variants, action } = message;

        if (action === 'aggregate') {
          console.log(`Aggregating stream: ${streamId}`);
          console.log(`All variants ready for stream: ${streamId}`);
          console.log(`Stream ${streamId} processing completed with ${variants} variants`);
          console.log(`All variants have been processed and uploaded to S3`);
          console.log(`S3 uploads will trigger the DynamoDB Lambda for final processing`);
        } else {
          console.log(`Unknown action: ${action} for stream: ${streamId}`);
        }
      }
      else {
        console.log(`Unknown message format:`, message);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Aggregation completed successfully' })
    };

  } catch (error) {
    console.error('Error in aggregator:', error);
    console.error('[ERROR]', error.message);
    console.error(error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Aggregation failed', details: error.message })
    };
  }
}; 