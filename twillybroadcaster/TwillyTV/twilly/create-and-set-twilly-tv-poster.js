/**
 * Create and Set Twilly TV Poster
 * 
 * This script:
 * 1. Generates a Twilly TV logo image (SVG)
 * 2. Converts it to PNG (if ImageMagick is available)
 * 3. Uploads to S3
 * 4. Updates DynamoDB with the new poster URL
 * 
 * Usage: node create-and-set-twilly-tv-poster.js
 */

import AWS from 'aws-sdk';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

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
const CLOUDFRONT_DOMAIN = 'd3hv50jkrzkiyh.cloudfront.net';

function generateTwillyTVLogoSVG() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#000000;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a26;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00D4AA;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#00E5FF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#00D4AA;stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="1920" height="1080" fill="url(#bgGradient)"/>
  <g transform="translate(960, 540)">
    <circle cx="0" cy="-80" r="120" fill="url(#brandGradient)" opacity="0.2" filter="url(#glow)"/>
    <g transform="translate(0, -80)">
      <rect x="-80" y="-50" width="160" height="100" rx="8" fill="url(#brandGradient)" opacity="0.3"/>
      <rect x="-75" y="-45" width="150" height="90" rx="6" fill="#000000"/>
      <rect x="-20" y="50" width="40" height="15" rx="4" fill="url(#brandGradient)"/>
      <rect x="-30" y="65" width="60" height="8" rx="4" fill="url(#brandGradient)"/>
    </g>
    <text x="0" y="120" font-family="Arial, sans-serif" font-size="120" font-weight="900" 
          text-anchor="middle" fill="url(#brandGradient)" filter="url(#glow)">Twilly TV</text>
    <text x="0" y="200" font-family="Arial, sans-serif" font-size="36" font-weight="600" 
          text-anchor="middle" fill="#888888" letter-spacing="2">A Premium streaming network</text>
  </g>
</svg>`;
}

async function findTwillyTVFolder() {
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
  const folders = result.Items?.filter(item => 
    item.SK?.startsWith('FOLDER#') || item.SK?.startsWith('COLLAB#')
  ) || [];

  if (folders.length === 0) {
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
  const folder = await findTwillyTVFolder();
  
  if (!folder) {
    throw new Error('Twilly TV folder not found!');
  }

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
  return result.Attributes;
}

async function uploadSVGToS3(svgContent, fileName = 'poster.svg') {
  const s3Key = `public/series-posters/${TWILLY_TV_EMAIL}/${encodeURIComponent(TWILLY_TV_CHANNEL_NAME)}/${fileName}`;
  
  const uploadParams = {
    Bucket: 'twillyinputbucket',
    Key: s3Key,
    Body: svgContent,
    ContentType: 'image/svg+xml',
    ACL: 'public-read'
  };

  await s3.putObject(uploadParams).promise();
  const posterUrl = `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
  return posterUrl;
}

async function main() {
  try {
    console.log('🎨 Creating Twilly TV logo...');
    
    // Generate SVG
    const svg = generateTwillyTVLogoSVG();
    const svgPath = path.join(__dirname, 'twilly-tv-logo.svg');
    fs.writeFileSync(svgPath, svg, 'utf8');
    console.log('✅ SVG generated:', svgPath);
    
    // Convert SVG to PNG using sharp - use consistent filename
    let pngPath = null;
    try {
      const pngPathTemp = path.join(__dirname, 'twilly-tv-poster.png');
      await sharp(svgPath)
        .resize(1920, 1080)
        .png()
        .toFile(pngPathTemp);
      pngPath = pngPathTemp;
      console.log('✅ PNG generated (via sharp):', pngPath);
    } catch (error) {
      console.log('⚠️  Failed to convert SVG to PNG, will use SVG instead:', error.message);
    }
    
    // Upload to S3 (prefer PNG, fallback to SVG) - use consistent filename
    const fileToUpload = pngPath || svgPath;
    const fileName = pngPath ? 'twilly-tv-poster.png' : 'twilly-tv-poster.svg';
    const fileContent = fs.readFileSync(fileToUpload);
    
    console.log('📤 Uploading to S3...');
    const s3Key = `public/series-posters/${TWILLY_TV_EMAIL}/${encodeURIComponent(TWILLY_TV_CHANNEL_NAME)}/${fileName}`;
    
    const uploadParams = {
      Bucket: 'twillyinputbucket',
      Key: s3Key,
      Body: fileContent,
      ContentType: fileName.endsWith('.png') ? 'image/png' : 'image/svg+xml'
      // Note: ACL removed - bucket uses bucket policy for public access
    };

    await s3.putObject(uploadParams).promise();
    const posterUrl = `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
    console.log('✅ Uploaded to S3:', posterUrl);
    
    // Update DynamoDB
    console.log('🔄 Updating DynamoDB...');
    await updatePoster(posterUrl);
    console.log('✅ Poster updated in DynamoDB!');
    
    console.log('\n🎉 Done! Twilly TV poster has been created and set.');
    console.log(`📸 Poster URL: ${posterUrl}`);
    console.log('🔄 The new poster should appear in the app after a refresh.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
