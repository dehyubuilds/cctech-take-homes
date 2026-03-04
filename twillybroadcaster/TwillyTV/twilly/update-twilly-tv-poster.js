/**
 * Script to update Twilly TV channel poster
 * 
 * Usage:
 * 1. Upload your new poster image to S3 at: public/series-posters/{email}/Twilly TV/poster.jpg
 * 2. Run this script to update the DynamoDB folder record
 * 
 * Or use the API endpoint: POST /api/channels/update-poster
 */

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const table = 'Twilly';

// Twilly TV channel info
const TWILLY_TV_EMAIL = 'dehyu.sinyan@gmail.com';
const TWILLY_TV_CHANNEL_NAME = 'Twilly TV';
const CLOUDFRONT_DOMAIN = 'd3hv50jkrzkiyh.cloudfront.net'; // Working CloudFront domain

async function findTwillyTVFolder() {
  console.log('🔍 Finding Twilly TV folder...');
  
  // Try to find folder by querying
  const queryParams = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk',
    FilterExpression: '#name = :channelName OR folderName = :channelName OR series = :channelName',
    ExpressionAttributeNames: {
      '#name': 'name'
    },
    ExpressionAttributeValues: {
      ':pk': `USER#${TWILLY_TV_EMAIL}`,
      ':channelName': TWILLY_TV_CHANNEL_NAME
    }
  };

  const result = await dynamodb.query(queryParams).promise();
  
  // Look for FOLDER records
  const folders = result.Items?.filter(item => 
    item.SK?.startsWith('FOLDER#') || item.SK?.startsWith('COLLAB#')
  ) || [];

  if (folders.length === 0) {
    console.log('❌ No folder found. Trying scan...');
    
    // Try scanning for folder
    const scanParams = {
      TableName: table,
      FilterExpression: 'PK = :pk AND (#name = :channelName OR folderName = :channelName OR series = :channelName)',
      ExpressionAttributeNames: {
        '#name': 'name'
      },
      ExpressionAttributeValues: {
        ':pk': `USER#${TWILLY_TV_EMAIL}`,
        ':channelName': TWILLY_TV_CHANNEL_NAME
      }
    };
    
    const scanResult = await dynamodb.scan(scanParams).promise();
    return scanResult.Items?.find(item => 
      item.SK?.startsWith('FOLDER#') || item.SK?.startsWith('COLLAB#')
    );
  }

  return folders[0];
}

async function updatePoster(posterUrl) {
  console.log('📸 Updating Twilly TV poster...');
  
  const folder = await findTwillyTVFolder();
  
  if (!folder) {
    console.error('❌ Twilly TV folder not found!');
    console.log('💡 You may need to create the folder first or check the channel name.');
    return;
  }

  console.log('✅ Found folder:', {
    PK: folder.PK,
    SK: folder.SK,
    name: folder.name,
    currentPoster: folder.seriesPosterUrl
  });

  // Update the folder with new poster URL
  const updateParams = {
    TableName: table,
    Key: {
      PK: folder.PK,
      SK: folder.SK
    },
    UpdateExpression: 'SET seriesPosterUrl = :posterUrl, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':posterUrl': posterUrl,
      ':updatedAt': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  };

  try {
    const result = await dynamodb.update(updateParams).promise();
    console.log('✅ Poster updated successfully!');
    console.log('📸 New poster URL:', result.Attributes.seriesPosterUrl);
    return result.Attributes;
  } catch (error) {
    console.error('❌ Error updating poster:', error);
    throw error;
  }
}

async function uploadPosterToS3(filePath, fileName = 'poster.jpg') {
  console.log('📤 Uploading poster to S3...');
  
  const fs = await import('fs');
  const fileContent = await fs.promises.readFile(filePath);
  
  const s3Key = `public/series-posters/${TWILLY_TV_EMAIL}/${encodeURIComponent(TWILLY_TV_CHANNEL_NAME)}/${fileName}`;
  
  // Detect content type based on file extension
  let contentType = 'image/jpeg';
  if (fileName.endsWith('.png')) contentType = 'image/png';
  if (fileName.endsWith('.svg')) contentType = 'image/svg+xml';
  
  const uploadParams = {
    Bucket: 'twillyinputbucket',
    Key: s3Key,
    Body: fileContent,
    ContentType: contentType
    // Note: ACL removed - bucket uses bucket policy for public access
  };

  try {
    await s3.putObject(uploadParams).promise();
    const posterUrl = `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
    console.log('✅ Poster uploaded to S3!');
    console.log('📸 S3 Key:', s3Key);
    console.log('🌐 Poster URL:', posterUrl);
    return posterUrl;
  } catch (error) {
    console.error('❌ Error uploading to S3:', error);
    throw error;
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📸 Twilly TV Poster Update Script

Usage:
  node update-twilly-tv-poster.js <poster-url>
  node update-twilly-tv-poster.js --upload <path-to-image.jpg>

Examples:
  node update-twilly-tv-poster.js "https://d26k8mraabzpiy.cloudfront.net/public/series-posters/dehyu.sinyan@gmail.com/Twilly%20TV/poster.jpg"
  node update-twilly-tv-poster.js --upload ./twilly-tv-poster-2026.jpg

Options:
  --upload <file>  Upload image file to S3 and update poster
  <url>            Update poster with existing URL
    `);
    return;
  }

  try {
    let posterUrl;
    
    if (args[0] === '--upload' && args[1]) {
      // Upload file to S3 first
      const filePath = args[1];
      const fileName = filePath.split('/').pop() || 'poster.jpg';
      posterUrl = await uploadPosterToS3(filePath, fileName);
    } else {
      // Use provided URL
      posterUrl = args[0];
    }

    // Update DynamoDB
    await updatePoster(posterUrl);
    
    console.log('\n✅ Done! Twilly TV poster has been updated.');
    console.log('🔄 The new poster should appear in the app after a refresh.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { updatePoster, uploadPosterToS3, findTwillyTVFolder };
