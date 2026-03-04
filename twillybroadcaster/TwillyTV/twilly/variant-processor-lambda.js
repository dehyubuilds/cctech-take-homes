const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const s3 = new S3Client({ region: 'us-east-1' });

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'theprivatecollection';

exports.handler = async (event) => {
  console.log('Variant Processor Lambda triggered:', JSON.stringify(event, null, 2));

  try {
    for (const record of event.Records) {
      const message = JSON.parse(record.body);
      const { streamId, inputUrl, outputUrl, variant, action } = message;

      if (action === 'process') {
        console.log(`Processing variant ${variant.bitrate}k for stream: ${streamId}`);

        // Extract schedulerId from inputUrl (assuming format: rtmp://localhost/live/schedulerId_streamKey)
        const urlParts = inputUrl.split('/');
        const streamKey = urlParts[urlParts.length - 1];
        const [schedulerId, streamName] = streamKey.split('_');
        
        // Create temporary directory for processing
        const tempDir = `/tmp/${streamId}_${variant.bitrate}k`;
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Generate HLS variant
        const hlsOutput = await generateHLSVariant(inputUrl, tempDir, variant);
        
        // Upload HLS files to S3 in expected path format
        await uploadHLSToS3(hlsOutput, schedulerId, streamName, variant);
        
        // Generate and upload thumbnail (only for first variant to avoid duplicates)
        if (variant.bitrate === 2400) {
          await generateAndUploadThumbnail(inputUrl, schedulerId, streamName, streamId);
        }

        console.log(`Variant ${variant.bitrate}k completed for stream: ${streamId}`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Variant processing completed successfully' })
    };

  } catch (error) {
    console.error('Variant processor error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Variant processing failed', details: error.message })
    };
  }
};

async function generateHLSVariant(inputUrl, outputDir, variant) {
  return new Promise(async (resolve, reject) => {
    // Download watermark logo for overlay
    const watermarkUrl = 'https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png';
    const watermarkPath = '/tmp/twilly-watermark.png';
    let hasWatermark = false;
    
    try {
      console.log(`📥 Downloading watermark from ${watermarkUrl}...`);
      const https = require('https');
      
      await new Promise((resolveDownload) => {
        const file = fs.createWriteStream(watermarkPath);
        https.get(watermarkUrl, (response) => {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            hasWatermark = fs.existsSync(watermarkPath);
            if (hasWatermark) {
              console.log(`✅ Watermark downloaded successfully`);
            } else {
              console.log(`⚠️ Watermark file not found after download`);
            }
            resolveDownload();
          });
        }).on('error', (err) => {
          fs.unlink(watermarkPath, () => {});
          console.log(`⚠️ Could not download watermark: ${err.message}`);
          resolveDownload(); // Continue without watermark
        });
      });
    } catch (error) {
      console.log(`⚠️ Error downloading watermark: ${error.message}, continuing without overlay`);
    }
    
    // Estimate watermark size based on typical resolution for bitrate (10% of width)
    // Typical mappings: 2400k→1080p, 1200k→720p, 600k→480p, 300k→360p
    let wmWidth = 64; // Default for lower bitrates (360p)
    let wmHeight = 36;
    const bitrate = parseInt(variant.bitrate);
    if (bitrate >= 2000) { wmWidth = 192; wmHeight = 108; } // 1080p
    else if (bitrate >= 1000) { wmWidth = 128; wmHeight = 72; } // 720p
    else if (bitrate >= 500) { wmWidth = 85; wmHeight = 48; } // 480p
    // else use default 360p values
    
    const outputFile = path.join(outputDir, `${variant.bitrate}k.m3u8`);
    
    // Build filter for overlay (logo at bottom-right, scaled to 10% of video width)
    let videoFilter = '';
    if (hasWatermark && fs.existsSync(watermarkPath)) {
      // Scale watermark and overlay at bottom-right
      videoFilter = `[1:v]scale=${wmWidth}:${wmHeight}[wm];[0:v][wm]overlay=W-w-10:H-h-10[v]`;
    }
    
    const ffmpegArgs = [
      '-i', inputUrl,
      ...(hasWatermark && fs.existsSync(watermarkPath) ? ['-i', watermarkPath] : []),
      ...(videoFilter ? ['-filter_complex', videoFilter, '-map', '[v]'] : []),
      ...(videoFilter ? [] : ['-map', '0:v']),
      '-map', '0:a',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:v', `${variant.bitrate}k`,
      '-b:a', '128k',
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_segment_filename', path.join(outputDir, `${variant.bitrate}k_%03d.ts`),
      outputFile
    ];

    console.log(`Running FFmpeg: ffmpeg ${ffmpegArgs.join(' ')}`);

    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`HLS variant ${variant.bitrate}k generated successfully`);
        resolve(outputDir);
      } else {
        console.error(`FFmpeg failed with code ${code}: ${stderr}`);
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });

    ffmpeg.on('error', (error) => {
      console.error('FFmpeg error:', error);
      reject(error);
    });
  });
}

async function uploadHLSToS3(localDir, schedulerId, streamName, variant) {
  try {
    const files = fs.readdirSync(localDir);
    
    for (const file of files) {
      if (file.endsWith('.m3u8') || file.endsWith('.ts')) {
        const filePath = path.join(localDir, file);
        const s3Key = `clips/${schedulerId}/${streamName}/${file}`;
        
        console.log(`Uploading ${file} to s3://${BUCKET_NAME}/${s3Key}`);
        
        const fileContent = fs.readFileSync(filePath);
        
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: fileContent,
          ContentType: file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t'
        }));
        
        console.log(`Uploaded ${file} successfully`);
      }
    }
  } catch (error) {
    console.error('S3 upload error:', error);
    throw error;
  }
}

async function generateAndUploadThumbnail(inputUrl, schedulerId, streamName, streamId) {
  return new Promise((resolve, reject) => {
    const thumbnailPath = `/tmp/${streamId}_thumb.jpg`;
    
    const ffmpegArgs = [
      '-i', inputUrl,
      '-ss', '00:00:05', // Take thumbnail at 5 seconds
      '-vframes', '1',
      '-q:v', '2',
      thumbnailPath
    ];

    console.log(`Generating thumbnail: ffmpeg ${ffmpegArgs.join(' ')}`);

    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', async (code) => {
      if (code === 0) {
        try {
          // Upload thumbnail to S3
          const s3Key = `clips/${schedulerId}/${streamName}/${streamId}_thumb.jpg`;
          
          console.log(`Uploading thumbnail to s3://${BUCKET_NAME}/${s3Key}`);
          
          const thumbnailContent = fs.readFileSync(thumbnailPath);
          
          await s3.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            Body: thumbnailContent,
            ContentType: 'image/jpeg'
          }));
          
          console.log(`Thumbnail uploaded successfully`);
          resolve();
        } catch (error) {
          console.error('Thumbnail upload error:', error);
          reject(error);
        }
      } else {
        console.error(`Thumbnail generation failed with code ${code}: ${stderr}`);
        reject(new Error(`Thumbnail generation failed with code ${code}`));
      }
    });

    ffmpeg.on('error', (error) => {
      console.error('Thumbnail generation error:', error);
      reject(error);
    });
  });
} 