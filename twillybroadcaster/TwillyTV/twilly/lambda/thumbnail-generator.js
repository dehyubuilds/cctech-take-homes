const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const s3 = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'theprivatecollection';

exports.handler = async (event) => {
  console.log('Thumbnail Generator Lambda triggered:', JSON.stringify(event, null, 2));

  try {
    const { streamKey, schedulerId, flvPath, uniquePrefix } = event;
    
    console.log(`Generating thumbnail for stream: ${streamKey}`);
    console.log(`Scheduler ID: ${schedulerId}`);
    console.log(`FLV Path: ${flvPath}`);
    console.log(`Unique Prefix: ${uniquePrefix}`);

    // Create temporary directory for processing
    const tempDir = `/tmp/${streamKey}_thumbnail`;
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate thumbnail using same FFmpeg settings as current implementation
    const thumbnailPath = path.join(tempDir, `${uniquePrefix}_thumb.jpg`);
    
    const thumbnailArgs = [
      '-i', flvPath,                    // Input FLV file
      '-ss', '00:00:05',               // Seek to 5 seconds (same as current)
      '-vframes', '1',                  // Extract 1 frame
      '-q:v', '2',                     // High quality (same as current)
      '-vf', 'scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:color=black',
      '-y',                            // Overwrite output
      thumbnailPath
    ];

    console.log(`Running FFmpeg command: ffmpeg ${thumbnailArgs.join(' ')}`);

    // Execute FFmpeg (same as current implementation)
    const ffmpeg = spawn('ffmpeg', thumbnailArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    ffmpeg.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Wait for FFmpeg to complete
    await new Promise((resolve, reject) => {
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Thumbnail generated successfully: ${thumbnailPath}`);
          resolve();
        } else {
          console.error(`❌ FFmpeg thumbnail generation failed with code ${code}`);
          console.error(`📝 FFmpeg stderr: ${stderr}`);
          reject(new Error(`FFmpeg thumbnail generation failed with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        console.error(`❌ FFmpeg error during thumbnail generation:`, error);
        reject(error);
      });
    });

    // Verify thumbnail was created
    if (!fs.existsSync(thumbnailPath)) {
      throw new Error(`Thumbnail file was not created: ${thumbnailPath}`);
    }

    const stats = fs.statSync(thumbnailPath);
    console.log(`✅ Thumbnail file verified: ${thumbnailPath} (${stats.size} bytes)`);

    // Upload to S3 using EXACT same logic as current implementation
    const thumbnailContent = fs.readFileSync(thumbnailPath);
    const s3Key = `clips/${schedulerId}/${streamKey}/${uniquePrefix}_thumb.jpg`;
    
    console.log(`☁️ Uploading thumbnail to S3: s3://${BUCKET_NAME}/${s3Key}`);

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: thumbnailContent,
      ContentType: 'image/jpeg'
    }));

    console.log(`✅ Thumbnail uploaded successfully to S3: s3://${BUCKET_NAME}/${s3Key}`);

    // Clean up temporary files (same as current implementation)
    try {
      fs.unlinkSync(thumbnailPath);
      fs.rmdirSync(tempDir);
      console.log(`🧹 Cleaned up temporary files`);
    } catch (error) {
      console.error(`⚠️ Error cleaning up temporary files:`, error);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        thumbnailUrl: `https://d4idc5cmwxlpy.cloudfront.net/${s3Key}`,
        message: `Thumbnail generated and uploaded successfully for stream: ${streamKey}`
      })
    };

  } catch (error) {
    console.error('❌ Error in thumbnail generation Lambda:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        message: `Failed to generate thumbnail: ${error.message}`
      })
    };
  }
}; 