const express = require('express');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// AWS Configuration
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const s3 = new AWS.S3();
const BUCKET_NAME = 'theprivatecollection';

// Store active streams
const activeStreams = new Map();

// Create necessary directories
const createDirectories = () => {
  const dirs = [
    '/var/www/hls',
    '/var/www/recordings',
    '/tmp/streaming-service'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    }
  });
};

// Initialize directories
createDirectories();

// Stream start handler
app.post('/stream/start', (req, res) => {
  const { name, schedulerId } = req.body;
  
  console.log(`🚀 Stream started: ${name} for scheduler: ${schedulerId}`);
  
  if (!name || !schedulerId) {
    return res.status(400).json({ error: 'Missing name or schedulerId' });
  }
  
  // Store stream info
  activeStreams.set(name, {
    schedulerId,
    startTime: new Date(),
    status: 'active'
  });
  
  console.log(`✅ Stream ${name} registered successfully`);
  res.json({ success: true, message: `Stream ${name} started` });
});

// Stream stop handler
app.post('/stream/stop', async (req, res) => {
  const { name, schedulerId } = req.body;
  
  console.log(`🛑 Stream stopped: ${name} for scheduler: ${schedulerId}`);
  
  if (!name || !schedulerId) {
    return res.status(400).json({ error: 'Missing name or schedulerId' });
  }
  
  const streamInfo = activeStreams.get(name);
  if (!streamInfo) {
    console.log(`⚠️ Stream ${name} not found in active streams`);
    return res.status(404).json({ error: 'Stream not found' });
  }
  
  try {
    // Process the recorded stream and generate HLS clips
    await processStream(name, schedulerId);
    
    // Remove from active streams
    activeStreams.delete(name);
    
    console.log(`✅ Stream ${name} processed and uploaded successfully`);
    res.json({ success: true, message: `Stream ${name} processed` });
    
  } catch (error) {
    console.error(`❌ Error processing stream ${name}:`, error);
    res.status(500).json({ error: 'Failed to process stream' });
  }
});

// Process stream and generate HLS clips
async function processStream(streamName, schedulerId) {
  // Find the recording file with timestamp suffix
  const recordingDir = '/var/www/recordings';
  const recordingFiles = fs.readdirSync(recordingDir).filter(file => 
    file.startsWith(`${streamName}-`) && file.endsWith('.flv')
  );
  const recordingPath = recordingFiles.length > 0 
    ? path.join(recordingDir, recordingFiles[0])
    : `/var/www/recordings/${streamName}.flv`;
  
  const outputDir = `/tmp/streaming-service/${streamName}`;
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true, mode: 0o755 });
  }
  
  // Check if recording exists
  if (!fs.existsSync(recordingPath)) {
    console.log(`⚠️ Recording not found: ${recordingPath}`);
    return;
  }
  
  console.log(`🎬 Processing stream: ${streamName}`);
  console.log(`📁 Recording path: ${recordingPath}`);
  console.log(`📁 Output directory: ${outputDir}`);
  
  // Generate HLS with single bitrate
  await generateHLS(recordingPath, outputDir, streamName);
  
  // Generate thumbnail from video
  await generateThumbnail(recordingPath, streamName, schedulerId);
  
  // Upload to S3
  await uploadToS3(outputDir, streamName, schedulerId);
  
  // Clean up temporary files
  cleanupTempFiles(outputDir);
}

// Generate HLS clips (simplified)
async function generateHLS(inputPath, outputDir, streamName) {
  return new Promise((resolve, reject) => {
    // Simplified FFmpeg command for single HLS stream
    const ffmpegArgs = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:v', '2400k',
      '-b:a', '128k',
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_segment_filename', path.join(outputDir, 'segment_%03d.ts'),
      path.join(outputDir, 'playlist.m3u8')
    ];
    
    console.log(`🎥 Running FFmpeg for HLS generation...`);
    console.log(`📝 Command: ffmpeg ${ffmpegArgs.join(' ')}`);
    
    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      cwd: outputDir,
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
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ FFmpeg completed successfully`);
        console.log(`📁 Generated files in: ${outputDir}`);
        resolve();
      } else {
        console.error(`❌ FFmpeg failed with code ${code}`);
        console.error(`📝 FFmpeg stderr: ${stderr}`);
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });
    
    ffmpeg.on('error', (error) => {
      console.error(`❌ FFmpeg error:`, error);
      reject(error);
    });
  });
}

// Upload to S3
async function uploadToS3(localDir, streamName, schedulerId) {
  try {
    console.log(`☁️ Uploading to S3...`);
    console.log(`📦 Bucket: ${BUCKET_NAME}`);
    console.log(`📁 Local directory: ${localDir}`);
    
    // Read all files in the directory
    const files = fs.readdirSync(localDir);
    
    for (const file of files) {
      const filePath = path.join(localDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        let s3Key;
        
        // For the master playlist (playlist.m3u8), upload to the path structure that Lambda expects
        if (file === 'playlist.m3u8') {
          // Upload to schedulerId/mixed/streamName.m3u8 to trigger Lambda
          s3Key = `${schedulerId}/mixed/${streamName}.m3u8`;
          console.log(`📤 Uploading master playlist ${file} to s3://${BUCKET_NAME}/${s3Key} (will trigger Lambda)`);
        } else {
          // Upload segments to clips folder (won't trigger Lambda)
          s3Key = `clips/${schedulerId}/${streamName}/${file}`;
          console.log(`📤 Uploading segment ${file} to s3://${BUCKET_NAME}/${s3Key}`);
        }
        
        const fileContent = fs.readFileSync(filePath);
        
        await s3.upload({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: fileContent,
          ContentType: getContentType(file)
        }).promise();
        
        console.log(`✅ Uploaded ${file} successfully`);
      }
    }
    
    console.log(`🎉 All files uploaded successfully for stream: ${streamName}`);
    
  } catch (error) {
    console.error(`❌ S3 upload error:`, error);
    throw error;
  }
}

// Get content type for S3 upload
function getContentType(filename) {
  if (filename.endsWith('.m3u8')) {
    return 'application/vnd.apple.mpegurl';
  } else if (filename.endsWith('.ts')) {
    return 'video/mp2t';
  }
  return 'application/octet-stream';
}

// Generate thumbnail from video
async function generateThumbnail(inputPath, streamName, schedulerId) {
  return new Promise((resolve, reject) => {
    console.log(`🖼️ Generating thumbnail for stream: ${streamName}`);
    
    // Create thumbnail filename
    const thumbnailName = `${streamName}_thumb.jpg`;
    const thumbnailPath = `/tmp/streaming-service/${thumbnailName}`;
    
    // FFmpeg command to extract thumbnail at 5 seconds into the video
    const ffmpegArgs = [
      '-i', inputPath,
      '-ss', '00:00:05',  // Seek to 5 seconds
      '-vframes', '1',    // Extract 1 frame
      '-q:v', '2',        // High quality
      '-vf', 'scale=480:270',  // Scale to 16:9 thumbnail
      thumbnailPath
    ];
    
    console.log(`📸 Running FFmpeg for thumbnail generation...`);
    console.log(`📝 Command: ffmpeg ${ffmpegArgs.join(' ')}`);
    
    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
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
    
    ffmpeg.on('close', async (code) => {
      if (code === 0) {
        console.log(`✅ Thumbnail generated successfully: ${thumbnailPath}`);
        
        try {
          // Upload thumbnail to S3
          const thumbnailContent = fs.readFileSync(thumbnailPath);
          const s3Key = `clips/${schedulerId}/${streamName}/${thumbnailName}`;
          
          await s3.upload({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            Body: thumbnailContent,
            ContentType: 'image/jpeg'
          }).promise();
          
          console.log(`☁️ Thumbnail uploaded to S3: s3://${BUCKET_NAME}/${s3Key}`);
          
          // Clean up local thumbnail file
          fs.unlinkSync(thumbnailPath);
          
          resolve();
        } catch (error) {
          console.error(`❌ Error uploading thumbnail:`, error);
          reject(error);
        }
      } else {
        console.error(`❌ FFmpeg thumbnail generation failed with code ${code}`);
        console.error(`📝 FFmpeg stderr: ${stderr}`);
        reject(new Error(`FFmpeg thumbnail generation failed with code ${code}`));
      }
    });
    
    ffmpeg.on('error', (error) => {
      console.error(`❌ FFmpeg thumbnail error:`, error);
      reject(error);
    });
  });
}

// Clean up temporary files
function cleanupTempFiles(dir) {
  try {
    console.log(`🧹 Cleaning up temporary files in: ${dir}`);
    
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        fs.unlinkSync(filePath);
      }
      
      fs.rmdirSync(dir);
      console.log(`✅ Cleanup completed`);
    }
  } catch (error) {
    console.error(`⚠️ Cleanup error:`, error);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    activeStreams: activeStreams.size,
    timestamp: new Date().toISOString()
  });
});

// Get active streams
app.get('/streams', (req, res) => {
  const streams = Array.from(activeStreams.entries()).map(([name, info]) => ({
    name,
    schedulerId: info.schedulerId,
    startTime: info.startTime,
    status: info.status
  }));
  
  res.json({ streams });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Streaming service started on port ${PORT}`);
  console.log(`📡 Ready to receive RTMP hooks from NGINX`);
  console.log(`☁️ S3 Bucket: ${BUCKET_NAME}`);
  console.log(`🎬 Active streams: ${activeStreams.size}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down streaming service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down streaming service...');
  process.exit(0);
}); 