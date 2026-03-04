/**
 * Script to create and upload Twilly TV poster
 * Converts SVG to PNG and uploads to S3, then updates DynamoDB
 */

import AWS from 'aws-sdk';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function convertSvgToPng(svgPath, pngPath) {
  console.log('🎨 Converting SVG to PNG...');
  
  try {
    // Try using rsvg-convert (librsvg)
    execSync(`rsvg-convert -w 1920 -h 1080 "${svgPath}" -o "${pngPath}"`, { stdio: 'inherit' });
    console.log('✅ Converted using rsvg-convert');
    return true;
  } catch (e) {
    console.log('⚠️ rsvg-convert not available, trying ImageMagick...');
    try {
      execSync(`convert -background none -resize 1920x1080 "${svgPath}" "${pngPath}"`, { stdio: 'inherit' });
      console.log('✅ Converted using ImageMagick');
      return true;
    } catch (e2) {
      console.log('⚠️ ImageMagick not available, trying magick...');
      try {
        execSync(`magick -background none -resize 1920x1080 "${svgPath}" "${pngPath}"`, { stdio: 'inherit' });
        console.log('✅ Converted using magick');
        return true;
      } catch (e3) {
        console.error('❌ Could not convert SVG. Please install rsvg-convert or ImageMagick');
        console.log('💡 On macOS: brew install librsvg');
        console.log('💡 Or use an online converter and save as poster.jpg');
        return false;
      }
    }
  }
}

async function uploadToS3(filePath, fileName) {
  console.log('📤 Uploading to S3...');
  
  const fileContent = fs.readFileSync(filePath);
  const s3Key = `public/series-posters/${TWILLY_TV_EMAIL}/${encodeURIComponent(TWILLY_TV_CHANNEL_NAME)}/${fileName}`;
  
  const uploadParams = {
    Bucket: BUCKET,
    Key: s3Key,
    Body: fileContent,
    ContentType: fileName.endsWith('.png') ? 'image/png' : 'image/jpeg',
    ACL: 'public-read',
    CacheControl: 'max-age=31536000' // 1 year cache
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
    FilterExpression: 'name = :channelName OR folderName = :channelName OR series = :channelName',
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
      FilterExpression: 'PK = :pk AND (name = :channelName OR folderName = :channelName OR series = :channelName)',
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
    console.error('❌ Twilly TV folder not found!');
    console.log('💡 Creating folder record...');
    
    // Create folder if it doesn't exist
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
  const pngPath = path.join(__dirname, 'public/assets/twilly-tv-poster-2026.png');
  const jpgPath = path.join(__dirname, 'public/assets/twilly-tv-poster-2026.jpg');
  
  try {
    // Check if SVG exists
    if (!fs.existsSync(svgPath)) {
      console.error('❌ SVG file not found:', svgPath);
      process.exit(1);
    }
    
    // Convert SVG to PNG
    const converted = await convertSvgToPng(svgPath, pngPath);
    
    if (!converted) {
      console.log('\n💡 Alternative: Use the SVG file directly or convert manually');
      console.log('   SVG location:', svgPath);
      return;
    }
    
    // Convert PNG to JPG (optional, for smaller file size)
    try {
      execSync(`convert "${pngPath}" -quality 90 "${jpgPath}"`, { stdio: 'inherit' });
      console.log('✅ Converted to JPG');
    } catch (e) {
      console.log('⚠️ Could not convert to JPG, using PNG');
    }
    
    // Upload to S3 (prefer JPG if available, otherwise PNG)
    const fileToUpload = fs.existsSync(jpgPath) ? jpgPath : pngPath;
    const fileName = fs.existsSync(jpgPath) ? 'poster.jpg' : 'poster.png';
    const posterUrl = await uploadToS3(fileToUpload, fileName);
    
    // Update DynamoDB
    await updateDynamoDB(posterUrl);
    
    console.log('\n✅ Done! Twilly TV poster has been uploaded and updated.');
    console.log('🔄 The new poster should appear in the app after a refresh.');
    console.log('\n📸 Poster URL:', posterUrl);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
