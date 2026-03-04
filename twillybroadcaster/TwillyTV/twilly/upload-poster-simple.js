/**
 * Simple script to upload Twilly TV poster using Node.js with sharp for image conversion
 * Falls back to direct SVG upload if sharp not available
 */

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const table = 'Twilly';

const TWILLY_TV_EMAIL = 'dehyu.sinyan@gmail.com';
const TWILLY_TV_CHANNEL_NAME = 'Twilly TV';
const CLOUDFRONT_DOMAIN = 'd26k8mraabzpiy.cloudfront.net';
const BUCKET = 'twillyinputbucket';

async function uploadToS3(filePath, fileName) {
  console.log('📤 Uploading to S3...');
  
  const fileContent = fs.readFileSync(filePath);
  const s3Key = `public/series-posters/${TWILLY_TV_EMAIL}/${encodeURIComponent(TWILLY_TV_CHANNEL_NAME)}/${fileName}`;
  
  // Detect content type
  let contentType = 'image/jpeg';
  if (fileName.endsWith('.png')) contentType = 'image/png';
  if (fileName.endsWith('.svg')) contentType = 'image/svg+xml';
  
  const uploadParams = {
    Bucket: BUCKET,
    Key: s3Key,
    Body: fileContent,
    ContentType: contentType,
    CacheControl: 'max-age=31536000'
  };

  try {
    await s3.putObject(uploadParams).promise();
    const posterUrl = `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
    console.log('✅ Uploaded to S3!');
    console.log('📸 S3 Key:', s3Key);
    console.log('🌐 Poster URL:', posterUrl);
    return posterUrl;
  } catch (error) {
    console.error('❌ Error uploading to S3:', error);
    throw error;
  }
}

async function findTwillyTVFolder() {
  console.log('🔍 Finding Twilly TV folder...');
  
  const queryParams = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk',
    FilterExpression: '#n = :channelName OR folderName = :channelName OR series = :channelName',
    ExpressionAttributeNames: {
      '#n': 'name'
    },
    ExpressionAttributeValues: {
      ':pk': `USER#${TWILLY_TV_EMAIL}`,
      ':channelName': TWILLY_TV_CHANNEL_NAME
    }
  };

  const result = await dynamodb.query(queryParams).promise();
  const folders = result.Items?.filter(item => 
    item.SK?.startsWith('FOLDER#') || item.SK?.startsWith('COLLAB#')
  ) || [];

  if (folders.length === 0) {
    console.log('⚠️ No folder found via query, trying scan...');
    const scanParams = {
      TableName: table,
      FilterExpression: 'PK = :pk AND (#n = :channelName OR folderName = :channelName OR series = :channelName)',
      ExpressionAttributeNames: {
        '#n': 'name'
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

async function updateDynamoDB(posterUrl) {
  console.log('💾 Updating DynamoDB...');
  
  const folder = await findTwillyTVFolder();
  
  if (!folder) {
    console.log('💡 Creating new folder record...');
    
    const newFolder = {
      PK: `USER#${TWILLY_TV_EMAIL}`,
      SK: `FOLDER#Mixed#${TWILLY_TV_CHANNEL_NAME}`,
      name: TWILLY_TV_CHANNEL_NAME,
      folderName: TWILLY_TV_CHANNEL_NAME,
      series: TWILLY_TV_CHANNEL_NAME,
      category: 'Mixed',
      seriesPosterUrl: posterUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await dynamodb.put({
      TableName: table,
      Item: newFolder
    }).promise();
    
    console.log('✅ Created new folder record');
    return newFolder;
  }

  console.log('✅ Found folder:', {
    PK: folder.PK,
    SK: folder.SK,
    name: folder.name
  });

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

  const result = await dynamodb.update(updateParams).promise();
  console.log('✅ DynamoDB updated!');
  console.log('📸 New poster URL:', result.Attributes.seriesPosterUrl);
  return result.Attributes;
}

async function main() {
  console.log('🎨 Twilly TV Poster Upload Script\n');
  
  const svgPath = path.join(__dirname, 'public/assets/twilly-tv-poster-2026.svg');
  
  try {
    // Check if SVG exists
    if (!fs.existsSync(svgPath)) {
      console.error('❌ SVG file not found:', svgPath);
      process.exit(1);
    }
    
    console.log('✅ Found SVG file:', svgPath);
    
    // Upload SVG directly (modern browsers support SVG)
    const posterUrl = await uploadToS3(svgPath, 'poster.svg');
    
    // Also try to create a PNG version if sharp is available
    try {
      const sharp = require('sharp');
      console.log('🎨 Converting SVG to PNG using sharp...');
      
      const pngBuffer = await sharp(svgPath)
        .resize(1920, 1080, { fit: 'contain', background: { r: 10, g: 14, b: 26, alpha: 1 } })
        .png()
        .toBuffer();
      
      const pngPath = path.join(__dirname, 'public/assets/twilly-tv-poster-2026.png');
      fs.writeFileSync(pngPath, pngBuffer);
      console.log('✅ Created PNG version');
      
      // Upload PNG as well
      const pngUrl = await uploadToS3(pngPath, 'poster.png');
      console.log('📸 PNG URL:', pngUrl);
      
      // Use PNG as primary (better compatibility)
      await updateDynamoDB(pngUrl);
    } catch (e) {
      console.log('⚠️ Sharp not available, using SVG directly');
      console.log('💡 Install sharp for PNG conversion: npm install sharp');
      await updateDynamoDB(posterUrl);
    }
    
    console.log('\n✅ Done! Twilly TV poster has been uploaded and updated.');
    console.log('🔄 The new poster should appear in the app after a refresh.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
