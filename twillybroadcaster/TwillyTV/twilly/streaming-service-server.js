const express = require('express');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cors = require('cors');
const os = require('os');
const multer = require('multer');

const app = express();
const PORT = 3000;

// Configure multer for file uploads
// Note: multer automatically parses text fields from multipart/form-data into req.body
const upload = multer({
  dest: '/tmp/uploaded-videos/',
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['video/mp4', 'video/mov', 'video/quicktime', 'video/avi'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, MOV, and AVI files are allowed.'));
    }
  }
});

// Add middleware to log all incoming multipart fields (for debugging)
const logMultipartFields = (req, res, next) => {
  if (req.body) {
    console.log(`🔍 [Multer] Parsed fields in req.body: ${Object.keys(req.body).join(', ')}`);
  }
  next();
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies (for form data)

// AWS Configuration
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const s3 = new AWS.S3();
const sqs = new AWS.SQS();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const transcribe = new AWS.TranscribeService();
const bedrock = new AWS.BedrockRuntime({ region: 'us-east-1' });
const BUCKET_NAME = 'theprivatecollection';
const PROCESSING_BUCKET = 'twilly-streaming-processing'; // Bucket for Lambda processing
const COORDINATOR_QUEUE_URL = process.env.COORDINATOR_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/142770202579/twilly-coordinator';

// Store active streams
const activeStreams = new Map();

// Queue for processing multiple streams
const processingQueue = [];
let isProcessing = false;

// Track active FFmpeg processes to prevent resource conflicts
const activeFFmpegProcesses = new Map();

// Create necessary directories
const createDirectories = () => {
  const dirs = [
    '/var/www/hls',
    '/var/www/recordings',
    '/tmp/streaming-service',
    '/tmp/uploaded-videos'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    }
    // Try to ensure write permissions
    try {
      fs.chmodSync(dir, 0o755);
    } catch (error) {
      console.warn(`⚠️ Could not set permissions on ${dir}: ${error.message}`);
    }
  });
};

// Initialize directories
createDirectories();

// Monitor system resources using actual system memory
function checkSystemResources() {
  const totalMem = os.totalmem(); // Total system memory in bytes
  const freeMem = os.freemem();   // Free system memory in bytes
  const usedMem = totalMem - freeMem;
  const memoryUsagePercent = (usedMem / totalMem) * 100;
  
  console.log(`📊 System Memory: ${Math.round(usedMem / 1024 / 1024)}MB used / ${Math.round(totalMem / 1024 / 1024)}MB total (${Math.round(memoryUsagePercent)}%)`);
  console.log(`📊 Active FFmpeg processes: ${activeFFmpegProcesses.size}`);
  
  // Dynamically adjust FFmpeg process limit based on available memory
  // t3.micro (1GB): 1 process
  // t3.small (2GB): 2 processes
  // t3.medium (4GB): 3-4 processes
  // t3.large (8GB): 5-6 processes
  const totalMemGB = Math.round(totalMem / (1024 * 1024 * 1024));
  let maxFFmpegProcesses = 1;
  
  if (totalMemGB >= 8) {
    maxFFmpegProcesses = 6; // t3.large or larger
  } else if (totalMemGB >= 4) {
    maxFFmpegProcesses = 4; // t3.medium
  } else if (totalMemGB >= 2) {
    maxFFmpegProcesses = 2; // t3.small
  } else {
    maxFFmpegProcesses = 1; // t3.micro
  }
  
  if (activeFFmpegProcesses.size >= maxFFmpegProcesses) {
    console.log(`⚠️ Too many FFmpeg processes running (${activeFFmpegProcesses.size}/${maxFFmpegProcesses}), waiting...`);
    return false;
  }
  
  console.log(`✅ System resources OK - ${activeFFmpegProcesses.size}/${maxFFmpegProcesses} FFmpeg processes (${totalMemGB}GB RAM)`);
  
  // Only block if system memory usage is over 85%
  if (memoryUsagePercent > 85) {
    console.log(`⚠️ High system memory usage (${Math.round(memoryUsagePercent)}%), waiting...`);
    return false;
  }
  
  return true;
}

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

// Start stream handler (for nginx exec hooks)
app.post('/start-stream', async (req, res) => {
  const { streamId, inputUrl, outputUrl } = req.body;
  
  console.log(`🚀 Stream started via nginx hook: ${streamId}`);
  console.log(`📹 Input URL: ${inputUrl}`);
  console.log(`📹 Output URL: ${outputUrl}`);
  
  if (!streamId || !inputUrl || !outputUrl) {
    return res.status(400).json({ error: 'Missing required parameters: streamId, inputUrl, outputUrl' });
  }
  
  // Store stream info
  activeStreams.set(streamId, {
    inputUrl,
    outputUrl,
    startTime: new Date(),
    status: 'active'
  });
  
  // Send message to coordinator queue
  try {
    const message = {
      streamId,
      inputUrl,
      outputUrl,
      variants: [
        { bitrate: '1080p', resolution: '1920x1080' },
        { bitrate: '720p', resolution: '1280x720' },
        { bitrate: '480p', resolution: '854x480' },
        { bitrate: '360p', resolution: '640x360' },
        { bitrate: '240p', resolution: '426x240' }
      ],
      action: 'start'
    };
    
    await sqs.sendMessage({
      QueueUrl: COORDINATOR_QUEUE_URL,
      MessageBody: JSON.stringify(message)
    }).promise();
    
    console.log(`📤 Sent start message to coordinator queue for stream: ${streamId}`);
  } catch (error) {
    console.error(`❌ Failed to send message to coordinator queue:`, error);
  }
  
  console.log(`✅ Stream ${streamId} registered successfully via nginx hook`);
  res.json({ success: true, message: `Stream ${streamId} started successfully`, streamId, variants: 5 });
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

// Stop stream handler (for nginx exec hooks)
app.post('/stop-stream', async (req, res) => {
  const { streamId } = req.body;
  
  console.log(`🛑 Stream stopped via nginx hook: ${streamId}`);
  
  if (!streamId) {
    return res.status(400).json({ error: 'Missing streamId parameter' });
  }
  
  const streamInfo = activeStreams.get(streamId);
  if (!streamInfo) {
    console.log(`⚠️ Stream ${streamId} not found in active streams`);
    return res.status(404).json({ error: 'Stream not found' });
  }
  
  // Send message to coordinator queue
  try {
    const message = {
      streamId,
      action: 'stop'
    };
    
    await sqs.sendMessage({
      QueueUrl: COORDINATOR_QUEUE_URL,
      MessageBody: JSON.stringify(message)
    }).promise();
    
    console.log(`📤 Sent stop message to coordinator queue for stream: ${streamId}`);
  } catch (error) {
    console.error(`❌ Failed to send message to coordinator queue:`, error);
  }
  
  // Remove from active streams
  activeStreams.delete(streamId);
  
  // Process the stream to generate HLS clips
  try {
    await processStream(streamId, streamInfo.schedulerId);
  } catch (error) {
    console.error(`❌ Failed to process stream ${streamId}:`, error);
  }
  
  console.log(`✅ Stream ${streamId} stopped successfully via nginx hook`);
  res.json({ success: true, message: `Stream ${streamId} stopped successfully` });
});

// HTTP Upload endpoint for video files (simpler approach)
app.post('/api/channels/upload-video', upload.single('video'), logMultipartFields, async (req, res) => {
  const uploadEndpointStartTime = Date.now();
  console.log('📤 [TIMING] Received video upload request');
  
  try {
    // Debug: Log entire req.body to see what we're receiving
    // Note: multer.single() parses text fields from multipart/form-data into req.body
    try {
      const bodyKeys = Object.keys(req.body || {});
      console.log(`📤 Full req.body keys (${bodyKeys.length}): ${bodyKeys.join(', ')}`);
      console.log(`📤 Full req.body: ${JSON.stringify(req.body)}`);
    } catch (logError) {
      console.error(`❌ Error logging req.body: ${logError.message}`);
    }
    
    // Validate required fields - multer should put text fields in req.body
    const channelName = req.body?.channelName;
    const userEmail = req.body?.userEmail;
    const streamKey = req.body?.streamKey;
    const uploadId = req.body?.uploadId; // Unique ID for this upload
    const title = req.body?.title;
    const description = req.body?.description;
    const price = req.body?.price;
    
    console.log(`📤 Request body: channelName=${channelName}, userEmail=${userEmail}, streamKey=${streamKey}, uploadId=${uploadId || 'none'}`);
    console.log(`📤 Video details - Title: ${title || 'none'}, Description: ${description || 'none'}, Price: ${price !== undefined && price !== null ? price : 'none'}`);
    console.log(`📤 File: ${req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'none'}`);
    
    if (!channelName || !userEmail || !streamKey) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: channelName, userEmail, streamKey' 
      });
    }
    
    // Generate unique uploadId if not provided (for backward compatibility)
    const uniqueUploadId = uploadId || `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`📤 Using uploadId: ${uniqueUploadId} (unique per upload)`);
    
    if (!req.file) {
      console.error('❌ No video file provided');
      return res.status(400).json({ 
        success: false, 
        error: 'No video file provided' 
      });
    }
    
    console.log(`📁 Uploaded file: ${req.file.originalname} (${(req.file.size / (1024 * 1024)).toFixed(2)}MB)`);
    console.log(`📋 Channel: ${channelName}, User: ${userEmail}, StreamKey: ${streamKey}`);
    
    // Use streamKey as the streamName for processing
    const streamName = streamKey;
    
    // Store context for immediate DynamoDB entry creation
    global.currentUploadContext = {
      userEmail,
      channelName,
      streamKey,
      uploadId: uniqueUploadId
    };
    
    // Determine recordings directory - try /var/www/recordings first, fallback to /tmp/recordings
    let recordingDir = '/var/www/recordings';
    let recordingPath;
    
    // Check if we can write to /var/www/recordings
    try {
      if (!fs.existsSync(recordingDir)) {
        fs.mkdirSync(recordingDir, { recursive: true, mode: 0o755 });
      }
      // Test write permissions
      const testFile = path.join(recordingDir, '.write-test');
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log(`✅ Using ${recordingDir} (write permissions OK)`);
      } catch (writeError) {
        console.warn(`⚠️ Cannot write to ${recordingDir}, using /tmp/recordings instead`);
        recordingDir = '/tmp/recordings';
        if (!fs.existsSync(recordingDir)) {
          fs.mkdirSync(recordingDir, { recursive: true, mode: 0o755 });
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error checking ${recordingDir}, using /tmp/recordings: ${error.message}`);
      recordingDir = '/tmp/recordings';
      if (!fs.existsSync(recordingDir)) {
        fs.mkdirSync(recordingDir, { recursive: true, mode: 0o755 });
      }
    }
    
    const fileExtension = path.extname(req.file.originalname);
    // Include uploadId in filename to ensure uniqueness
    // CRITICAL: Always use uniqueUploadId (it's always set, either from req.body or generated)
    const uniqueFileName = `${streamName}_${uniqueUploadId}${fileExtension}`;
    recordingPath = path.join(recordingDir, uniqueFileName);
    console.log(`📁 Saving file with uploadId in filename: ${uniqueFileName}`);
    console.log(`📁 uniqueUploadId: ${uniqueUploadId}`);
    
    // Copy file instead of rename (more reliable across filesystems)
    try {
      fs.copyFileSync(req.file.path, recordingPath);
      console.log(`✅ File copied to: ${recordingPath}`);
      
      // Delete temp file after successful copy
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (copyError) {
      console.error(`❌ Failed to copy file: ${copyError.message}`);
      throw new Error(`Failed to save uploaded file: ${copyError.message}`);
    }
    
    // Generate unique prefix early (same format used in generateSingleVariant)
    const uniquePrefix = `${streamName}_${uniqueUploadId}`;
    console.log(`🎯 Generated unique prefix for early processing: ${uniquePrefix}`);
    
    // EARLY THUMBNAIL GENERATION: Generate thumbnail immediately after file save (before variant processing)
    // This makes thumbnail available much faster (within 1-2 seconds instead of 20-30 seconds)
    // CRITICAL: This MUST run before processStream to make thumbnail available quickly
    const thumbnailStartTime = Date.now();
    console.log(`🖼️ [TIMING] EARLY: ===== STARTING EARLY THUMBNAIL GENERATION =====`);
    console.log(`🖼️ [TIMING] EARLY: File saved at: ${recordingPath}`);
    console.log(`🖼️ [TIMING] EARLY: Starting thumbnail generation immediately after file save...`);
    let earlyThumbnailPath = null;
    let earlyThumbnailGenerated = false;
    
    try {
      // Create temp directory for early thumbnail
      const tempThumbnailDir = `/tmp/early-thumbnails/${streamName}`;
      if (!fs.existsSync(tempThumbnailDir)) {
        fs.mkdirSync(tempThumbnailDir, { recursive: true, mode: 0o755 });
      }
      
      earlyThumbnailPath = path.join(tempThumbnailDir, `${uniquePrefix}_thumb.jpg`);
      
      // OPTIMIZED: Use first frame (0 seconds) for INSTANT extraction - no seeking needed
      // This is the fastest possible thumbnail generation
      const thumbnailArgs = [
        '-i', recordingPath,
        '-vf', 'select=eq(n\\,0),scale=640:-1',  // Get first frame, scale to 640px width
        '-q:v', '3',  // Slightly lower quality for speed (3 is still good quality)
        '-frames:v', '1',  // Only extract 1 frame
        '-y',  // Overwrite output file
        earlyThumbnailPath
      ];
      
      // Small delay to ensure file is fully written to disk before FFmpeg reads it
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`📸 [TIMING] EARLY: Running FFmpeg for immediate thumbnail generation (first frame)...`);
      console.log(`📝 EARLY: Command: ffmpeg ${thumbnailArgs.join(' ')}`);
      console.log(`📝 EARLY: Input file: ${recordingPath}`);
      console.log(`📝 EARLY: Input file exists: ${fs.existsSync(recordingPath)}`);
      if (fs.existsSync(recordingPath)) {
        const stats = fs.statSync(recordingPath);
        console.log(`📝 EARLY: Input file size: ${stats.size} bytes`);
      }
      
      const earlyThumbnailResult = await new Promise((resolve) => {
        const ffmpegStartTime = Date.now();
        const ffmpeg = spawn('ffmpeg', thumbnailArgs, {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stderr = '';
        ffmpeg.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        ffmpeg.on('close', (code) => {
          const ffmpegDuration = ((Date.now() - ffmpegStartTime) / 1000).toFixed(2);
          if (code === 0) {
            if (fs.existsSync(earlyThumbnailPath)) {
              const stats = fs.statSync(earlyThumbnailPath);
              console.log(`✅ [TIMING] EARLY: Thumbnail generated in ${ffmpegDuration}s: ${earlyThumbnailPath} (${stats.size} bytes)`);
              resolve(true);
            } else {
              console.error(`❌ EARLY: Thumbnail file was not created: ${earlyThumbnailPath}`);
              resolve(false);
            }
          } else {
            console.error(`❌ EARLY: Thumbnail generation failed with code ${code} (took ${ffmpegDuration}s)`);
            console.error(`📝 EARLY: FFmpeg stderr: ${stderr}`);
            resolve(false);
          }
        });
        
        ffmpeg.on('error', (error) => {
          console.error(`❌ EARLY: FFmpeg error during thumbnail generation:`, error);
          resolve(false);
        });
      });
      
      if (earlyThumbnailResult) {
        earlyThumbnailGenerated = true;
        const s3UploadStartTime = Date.now();
        console.log(`✅ [TIMING] EARLY: Thumbnail ready! Uploading to S3 immediately...`);
        
        // Upload thumbnail to S3 immediately
        try {
          const cloudFrontBaseUrl = 'https://d4idc5cmwxlpy.cloudfront.net';
          const s3Key = `clips/${streamName}/${uniqueUploadId}/${uniquePrefix}_thumb.jpg`;
          const thumbnailContent = fs.readFileSync(earlyThumbnailPath);
          
          console.log(`☁️ [TIMING] EARLY: Uploading thumbnail to S3: s3://${BUCKET_NAME}/${s3Key}`);
          
          await s3.upload({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            Body: thumbnailContent,
            ContentType: 'image/jpeg'
          }).promise();
          
          const s3UploadDuration = ((Date.now() - s3UploadStartTime) / 1000).toFixed(2);
          const thumbnailUrl = `${cloudFrontBaseUrl}/${s3Key}`;
          const totalThumbnailDuration = ((Date.now() - thumbnailStartTime) / 1000).toFixed(2);
          console.log(`✅ [TIMING] EARLY: Thumbnail uploaded to S3 in ${s3UploadDuration}s`);
          console.log(`✅ [TIMING] EARLY: Total thumbnail time: ${totalThumbnailDuration}s (FFmpeg + S3 upload)`);
          console.log(`🔗 EARLY: Thumbnail URL: ${thumbnailUrl}`);
            
            // Store thumbnail URL and info in global context for DynamoDB entry creation
            if (!global.currentUploadContext) {
              global.currentUploadContext = {
                userEmail,
                channelName,
                streamKey,
                uploadId: uniqueUploadId
              };
            }
            global.currentUploadContext.thumbnailUrl = thumbnailUrl;
            global.currentUploadContext.uniquePrefix = uniquePrefix;
            global.currentUploadContext.earlyThumbnailPath = earlyThumbnailPath; // Store path for later processing
            
            // Copy thumbnail to output directory so later processing can find it
            const outputDir = `/tmp/streaming-service/${streamName}`;
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true, mode: 0o755 });
            }
            const finalThumbnailPath = path.join(outputDir, `${uniquePrefix}_thumb.jpg`);
            fs.copyFileSync(earlyThumbnailPath, finalThumbnailPath);
            console.log(`📋 EARLY: Copied thumbnail to output directory: ${finalThumbnailPath}`);
            
            // CRITICAL: Create DynamoDB entry IMMEDIATELY after thumbnail is ready
            // This makes the thumbnail available for polling right away (within 1-2 seconds)
            // The HLS URL will be a placeholder for now, and will be updated when processing completes
            try {
              const dbStartTime = Date.now();
              console.log(`📝 [TIMING] EARLY: Creating DynamoDB entry immediately with thumbnail URL...`);
              await createVideoEntryImmediately(streamName, uniqueUploadId, uniquePrefix, userEmail, channelName);
              const dbDuration = ((Date.now() - dbStartTime) / 1000).toFixed(2);
              const totalTime = ((Date.now() - thumbnailStartTime) / 1000).toFixed(2);
              console.log(`✅ [TIMING] EARLY: DynamoDB entry created in ${dbDuration}s! Total thumbnail process: ${totalTime}s`);
              console.log(`✅ [TIMING] EARLY: Thumbnail is now available for polling!`);
            } catch (dbError) {
              console.error(`⚠️ EARLY: Failed to create immediate DynamoDB entry: ${dbError.message}`);
              // Continue - it will be created later in processStreamInternal
            }
            
          } catch (s3Error) {
            console.error(`❌ EARLY: Failed to upload thumbnail to S3: ${s3Error.message}`);
            // CRITICAL: Clear thumbnail URL from context if upload failed
            // This prevents creating video entry with invalid thumbnail URL
            if (global.currentUploadContext) {
              delete global.currentUploadContext.thumbnailUrl;
              console.log(`🚫 EARLY: Cleared thumbnailUrl from context due to S3 upload failure`);
            }
            // Continue processing - thumbnail will be uploaded later
          }
      }
    } catch (earlyThumbnailError) {
      const totalThumbnailDuration = ((Date.now() - thumbnailStartTime) / 1000).toFixed(2);
      console.error(`❌ [TIMING] EARLY: Error during early thumbnail generation (took ${totalThumbnailDuration}s): ${earlyThumbnailError.message}`);
      // CRITICAL: Clear thumbnail URL from context if generation failed
      if (global.currentUploadContext) {
        delete global.currentUploadContext.thumbnailUrl;
        console.log(`🚫 EARLY: Cleared thumbnailUrl from context due to generation failure`);
      }
      // Continue processing - thumbnail will be generated later in normal flow
    }
    
    // Store video metadata in DynamoDB before processing (only if any field is provided)
    // This allows the Lambda function (triggered by S3 upload) to read the metadata
    // Only store if at least one field has a value (don't store empty metadata)
    const hasTitle = title && title.trim().length > 0;
    const hasDescription = description && description.trim().length > 0;
    const hasPrice = price !== undefined && price !== null && price !== '';
    
    // CRITICAL: Always store metadata entry (even if empty) so Lambda can find it
    // This ensures videos without details still get written to DynamoDB properly
    try {
      // CRITICAL: Use unique uploadId instead of streamKey to ensure each video has unique metadata
      const metadataItem = {
        PK: `METADATA#${uniqueUploadId}`,
        SK: 'video-details',
        uploadId: uniqueUploadId, // Store uploadId for reference
        streamKey: streamKey, // Keep streamKey for reference
        createdAt: new Date().toISOString()
      };
      
      // Only include fields that have values (but always create the metadata entry)
      if (hasTitle) {
        metadataItem.title = title.trim();
      }
      if (hasDescription) {
        metadataItem.description = description.trim();
      }
      if (hasPrice) {
        const parsedPrice = parseFloat(price);
        metadataItem.price = parsedPrice;
        console.log(`💰 Parsed price: ${parsedPrice} (type: ${typeof parsedPrice})`);
      }
      
      const metadataParams = {
        TableName: 'Twilly',
        Item: metadataItem
      };
      
      console.log(`📤 Storing metadata with DocumentClient: ${JSON.stringify(metadataItem, null, 2)}`);
      await dynamodb.put(metadataParams).promise();
      console.log(`✅ Stored video metadata for uploadId: ${uniqueUploadId} (unique per upload)`);
      console.log(`📋 Metadata item structure: PK=${metadataItem.PK}, SK=${metadataItem.SK}`);
      console.log(`📋 Metadata fields: title=${hasTitle ? 'YES' : 'NO'}, description=${hasDescription ? 'YES' : 'NO'}, price=${hasPrice ? 'YES' : 'NO'}`);
      
      // Verify it was stored by reading it back
      try {
        const verifyParams = {
          TableName: 'Twilly',
          Key: {
            PK: `METADATA#${uniqueUploadId}`,
            SK: 'video-details'
          }
        };
        const verifyResult = await dynamodb.get(verifyParams).promise();
        if (verifyResult.Item) {
          console.log(`✅ Verified metadata stored: ${JSON.stringify(verifyResult.Item, null, 2)}`);
        } else {
          console.error(`❌ Metadata verification failed - item not found after storing!`);
        }
      } catch (verifyError) {
        console.error(`⚠️ Failed to verify metadata storage: ${verifyError.message}`);
      }
      
      // Longer delay to ensure metadata is fully committed before processing starts
      // This ensures the Lambda function can read it when triggered by S3 upload
      // Increased to 2 seconds to account for DynamoDB eventual consistency
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log(`⏳ Waited 2000ms for metadata to be fully committed`);
    } catch (metadataError) {
      console.error(`⚠️ Failed to store video metadata: ${metadataError.message}`);
      // Continue processing even if metadata storage fails
    }
    
    // CRITICAL: Wait for early thumbnail to be ready and DynamoDB entry created
    // This ensures thumbnail is available for polling immediately (1-2 seconds)
    // Then send response and continue processing in background
    if (earlyThumbnailGenerated) {
      console.log(`✅ [TIMING] Early thumbnail ready - sending response immediately`);
      const totalUploadDuration = ((Date.now() - uploadEndpointStartTime) / 1000).toFixed(2);
      console.log(`✅ [TIMING] Total upload endpoint time (with early thumbnail): ${totalUploadDuration} seconds`);
      
      // Send response immediately - thumbnail is ready, user can navigate
      res.json({ 
        success: true, 
        message: 'Video uploaded successfully - thumbnail ready',
        streamKey: streamName
      });
      
      // Continue processing in background (don't await - let it run async)
      console.log(`🔄 [TIMING] Starting background processing (HLS generation)...`);
      processStream(streamName, streamKey, uniqueUploadId)
        .then(() => {
          console.log(`✅ [TIMING] Background processing completed for: ${streamName}`);
        })
        .catch((error) => {
          console.error(`❌ [TIMING] Background processing failed: ${error.message}`);
        });
    } else {
      // Fallback: Early thumbnail failed, process normally (slower)
      console.log(`⚠️ [TIMING] Early thumbnail not generated - processing normally`);
      await processStream(streamName, streamKey, uniqueUploadId);
      
      const totalUploadDuration = ((Date.now() - uploadEndpointStartTime) / 1000).toFixed(2);
      console.log(`✅ [TIMING] Video upload processed successfully: ${streamName}`);
      console.log(`✅ [TIMING] Total upload endpoint time: ${totalUploadDuration} seconds`);
      res.json({ 
        success: true, 
        message: 'Video uploaded and processed successfully',
        streamKey: streamName
      });
    }
    
    // Clean up uploaded temp file (already moved, but check)
    if (fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
    
  } catch (error) {
    console.error(`❌ Error processing video upload:`, error);
    console.error(`❌ Error stack:`, error.stack);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log(`🗑️ Cleaned up temp file: ${req.file.path}`);
      } catch (cleanupError) {
        console.error(`❌ Failed to cleanup temp file:`, cleanupError);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process video upload',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Process stream and generate HLS clips
// uploadId: Optional unique identifier for this upload (for metadata association)
async function processStream(streamName, schedulerId, uploadId = null) {
  console.log(`🔍 processStream called with: streamName=${streamName}, schedulerId=${schedulerId}, uploadId=${uploadId || 'NULL'}`);
  // Check if we can process immediately
  if (checkSystemResources()) {
    console.log(`🚀 Processing stream ${streamName} immediately`);
    isProcessing = true;
    
    try {
      await processStreamInternal(streamName, schedulerId, uploadId);
    } finally {
      isProcessing = false;
      
      // Process next item in queue if any
      if (processingQueue.length > 0) {
        const next = processingQueue.shift();
        console.log(`🔄 Processing next stream in queue: ${next.streamName}, uploadId=${next.uploadId || 'NULL'}`);
        processStream(next.streamName, next.schedulerId, next.uploadId)
          .then(next.resolve)
          .catch(next.reject);
      }
    }
  } else {
    // Add to queue if resources not available
    console.log(`⏳ Adding stream ${streamName} to processing queue`);
    return new Promise((resolve, reject) => {
      processingQueue.push({ streamName, schedulerId, uploadId, resolve, reject });
    });
  }
}

// Internal stream processing function (your existing logic)
async function processStreamInternal(streamName, schedulerId, uploadId = null) {
  console.log(`🔍 processStreamInternal called with: streamName=${streamName}, schedulerId=${schedulerId}, uploadId=${uploadId || 'NULL'}`);
  // Check system resources before processing
  if (!checkSystemResources()) {
    console.log(`⏳ Waiting for resources to be available for stream: ${streamName}`);
    // Wait 30 seconds and try again
    await new Promise(resolve => setTimeout(resolve, 30000));
    if (!checkSystemResources()) {
      console.error(`❌ Resources not available for stream: ${streamName}, skipping`);
      return;
    }
  }
  
  // Find the recording file - check for uploaded files first, then RTMP recordings
  // Check both /var/www/recordings and /tmp/recordings (fallback location)
  const recordingDirs = ['/var/www/recordings', '/tmp/recordings'];
  
  // First, check for uploaded files (MP4, MOV, etc.) with streamKey as filename
  // If uploadId is provided, look for files with uploadId in the name
  const uploadedExtensions = ['.mp4', '.mov', '.avi', '.m4v'];
  let recordingPath = null;
  
  for (const recordingDir of recordingDirs) {
    for (const ext of uploadedExtensions) {
      // Try with uploadId first if provided
      if (uploadId) {
        const potentialPathWithUploadId = path.join(recordingDir, `${streamName}_${uploadId}${ext}`);
        if (fs.existsSync(potentialPathWithUploadId)) {
          recordingPath = potentialPathWithUploadId;
          console.log(`📁 Found uploaded file with uploadId: ${path.basename(recordingPath)}`);
          break;
        }
      }
      // Fallback to old format (backward compatibility)
      const potentialPath = path.join(recordingDir, `${streamName}${ext}`);
      if (fs.existsSync(potentialPath)) {
        recordingPath = potentialPath;
        console.log(`📁 Found uploaded file (old format): ${path.basename(recordingPath)}`);
        // Try to extract uploadId from filename if it exists
        // Format: streamName_uploadId.ext or streamName_timestamp_random.ext
        const basename = path.basename(recordingPath, ext);
        const parts = basename.split('_');
        if (parts.length >= 2) {
          // Check if the last part before extension looks like a UUID or upload- format
          const lastPart = parts[parts.length - 1];
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidPattern.test(lastPart) || lastPart.startsWith('upload-')) {
            // Extract uploadId from filename
            const extractedUploadId = lastPart;
            if (!uploadId) {
              uploadId = extractedUploadId;
              console.log(`📤 Extracted uploadId from filename: ${uploadId}`);
            }
          }
        }
        break;
      }
    }
    if (recordingPath) break;
  }
  
  // If no uploaded file found, look for RTMP recordings (FLV files)
  if (!recordingPath) {
    // Use the first recording directory that exists
    let recordingDirToUse = null;
    for (const dir of recordingDirs) {
      if (fs.existsSync(dir)) {
        recordingDirToUse = dir;
        break;
      }
    }
    
    if (!recordingDirToUse) {
      console.error(`❌ No recording directory found`);
      return;
    }
    
    const recordingFiles = fs.readdirSync(recordingDirToUse).filter(file => 
      file.startsWith(`${streamName}-`) && file.endsWith('.flv')
    );
    
    if (recordingFiles.length > 0) {
      // Find the most recent file by modification time
      let mostRecentFile = null;
      let mostRecentTime = 0;
      
      for (const file of recordingFiles) {
        const filePath = path.join(recordingDirToUse, file);
        const stats = fs.statSync(filePath);
        if (stats.mtime.getTime() > mostRecentTime) {
          mostRecentTime = stats.mtime.getTime();
          mostRecentFile = file;
        }
      }
      
      recordingPath = path.join(recordingDirToUse, mostRecentFile);
      console.log(`📁 Found most recent RTMP recording: ${mostRecentFile}`);
    } else {
      // Fallback to default FLV path
      recordingPath = `/var/www/recordings/${streamName}.flv`;
    }
  }
  
  const outputDir = `/tmp/streaming-service/${streamName}`;
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true, mode: 0o755 });
  }
  
  // Check if recording exists
  if (!recordingPath || !fs.existsSync(recordingPath)) {
    console.log(`⚠️ Recording not found: ${recordingPath || 'null'}`);
    // Log available files in recording directories for debugging
    for (const dir of recordingDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          console.log(`📁 Available files in ${dir}:`, files.slice(0, 10)); // Show first 10 files
        } catch (listError) {
          console.error(`❌ Error listing ${dir}:`, listError.message);
        }
      }
    }
    return;
  }
  
  // Check file size - skip empty or very small files (likely corrupted/incomplete)
  const fileStats = fs.statSync(recordingPath);
  const fileSizeMB = fileStats.size / (1024 * 1024);
  const minFileSizeBytes = 100 * 1024; // 100KB minimum
  
  if (fileStats.size < minFileSizeBytes) {
    console.log(`⚠️ Skipping recording ${recordingPath}: File too small (${fileStats.size} bytes / ${fileSizeMB.toFixed(2)}MB)`);
    console.log(`   This usually means the stream was too short or was interrupted before recording completed.`);
    return;
  }
  
  console.log(`📊 Recording file size: ${fileSizeMB.toFixed(2)}MB (${fileStats.size} bytes)`);
  
  console.log(`🎬 Processing stream: ${streamName}`);
  console.log(`📁 Recording path: ${recordingPath}`);
  console.log(`📁 Output directory: ${outputDir}`);
  
  // SNAPCHAT-STYLE APPROACH: Generate 1080p first, then process remaining variants in background
  // This allows us to return success to mobile app much faster (~20-30s vs ~40-50s)
  const isUpload = uploadId !== null; // Check if this is an HTTP upload (has uploadId)
  
  if (isUpload) {
    // NEW FLOW: HTTP uploads - generate 1080p first, return success, then process remaining variants
    console.log(`🚀 Using Snapchat-style approach: Generate 1080p first, then background processing`);
    
    // Step 1: Generate 1080p variant only
    console.log(`📹 Step 1: Generating 1080p variant...`);
    const { uniquePrefix, isPortrait } = await generateSingleVariant(recordingPath, outputDir, streamName, uploadId, '1080p');
    
    // Step 2: Generate thumbnail (skip if already generated early)
    console.log(`🖼️ Step 2: Checking if thumbnail already exists from early generation...`);
    let thumbnailGenerated = false;
    const thumbnailPath = path.join(outputDir, `${uniquePrefix}_thumb.jpg`);
    
    // Check if thumbnail was already generated and uploaded early
    if (fs.existsSync(thumbnailPath)) {
      const stats = fs.statSync(thumbnailPath);
      console.log(`✅ Thumbnail already exists from early generation: ${thumbnailPath} (${stats.size} bytes)`);
      thumbnailGenerated = true;
    } else {
      // Thumbnail wasn't generated early - generate it now
      console.log(`🖼️ Thumbnail not found from early generation - generating now...`);
      try {
        await generateThumbnail(recordingPath, outputDir, streamName);
        // Verify thumbnail was actually created
        if (fs.existsSync(thumbnailPath)) {
          const stats = fs.statSync(thumbnailPath);
          console.log(`✅ Thumbnail generated successfully: ${thumbnailPath} (${stats.size} bytes)`);
          thumbnailGenerated = true;
          
          // Upload thumbnail to S3 if it wasn't uploaded early
          try {
            const cloudFrontBaseUrl = 'https://d4idc5cmwxlpy.cloudfront.net';
            const s3Key = `clips/${streamName}/${uploadId}/${uniquePrefix}_thumb.jpg`;
            const thumbnailContent = fs.readFileSync(thumbnailPath);
            
            console.log(`☁️ Uploading thumbnail to S3: s3://${BUCKET_NAME}/${s3Key}`);
            await s3.upload({
              Bucket: BUCKET_NAME,
              Key: s3Key,
              Body: thumbnailContent,
              ContentType: 'image/jpeg'
            }).promise();
            
            const thumbnailUrl = `${cloudFrontBaseUrl}/${s3Key}`;
            console.log(`✅ Thumbnail uploaded to S3 successfully!`);
            console.log(`🔗 Thumbnail URL: ${thumbnailUrl}`);
            
            // Store thumbnail URL in context if not already stored
            if (global.currentUploadContext && !global.currentUploadContext.thumbnailUrl) {
              global.currentUploadContext.thumbnailUrl = thumbnailUrl;
            }
          } catch (s3Error) {
            console.error(`❌ Failed to upload thumbnail to S3: ${s3Error.message}`);
            // Continue - thumbnail will be uploaded with other files
          }
        } else {
          console.error(`❌ Thumbnail file not found after generation: ${thumbnailPath}`);
        }
      } catch (error) {
        console.error(`❌ Error during thumbnail generation:`, error);
      }
    }
    
    // Step 3: Create initial master playlist (1080p only)
    createInitialMasterPlaylist(outputDir, streamName, uniquePrefix, isPortrait, uploadId);
    
    // Step 4: Upload 1080p variant, thumbnail, and initial master playlist
    console.log(`☁️ Step 4: Uploading 1080p variant, thumbnail, and master playlist...`);
    
    // Build file patterns list - only include thumbnail if it was generated
    const filesToUpload = [
      `${uniquePrefix}_1080p.m3u8`,
      `${uniquePrefix}_1080p_*.ts`,
      `${uniquePrefix}_master.m3u8`
    ];
    
    if (thumbnailGenerated) {
      filesToUpload.push(`${uniquePrefix}_thumb.jpg`);
      console.log(`✅ Thumbnail will be uploaded`);
    } else {
      console.warn(`⚠️ Thumbnail not generated - skipping thumbnail upload`);
    }
    
    await uploadFilesToS3(outputDir, streamName, uploadId, filesToUpload);
    
    console.log(`✅ Initial upload complete! 1080p variant is now available.`);
    
    // Step 4.5: Create DynamoDB entry immediately so video appears instantly
    // Get user info from the request context (passed from upload endpoint)
    const userEmail = global.currentUploadContext?.userEmail;
    const channelName = global.currentUploadContext?.channelName;
    
    if (userEmail && uploadId) {
      try {
        console.log(`📝 Creating DynamoDB entry immediately for instant video appearance...`);
        await createVideoEntryImmediately(streamName, uploadId, uniquePrefix, userEmail, channelName);
        console.log(`✅ DynamoDB entry created! Video should now appear in channel.`);
      } catch (error) {
        console.error(`⚠️ Failed to create immediate DynamoDB entry (Lambda will create it later):`, error);
        // Don't throw - Lambda will create it when S3 event fires
      }
    } else {
      console.log(`⚠️ Missing userEmail or uploadId, skipping immediate DynamoDB entry creation`);
    }
    
    // Clear context after use
    global.currentUploadContext = null;
    
    console.log(`🔄 Starting background processing for remaining variants (720p, 480p, 360p)...`);
    
    // Step 5: Process remaining variants in background (non-blocking)
    // This runs asynchronously and doesn't block the response
    generateRemainingVariants(recordingPath, outputDir, streamName, uploadId, uniquePrefix, isPortrait)
      .then(async () => {
        console.log(`✅ Background processing complete: All variants generated`);
        
        // Update master playlist with all variants
        await updateMasterPlaylist(outputDir, streamName, uniquePrefix, isPortrait, uploadId);
        
        // Upload remaining variants and updated master playlist
        console.log(`☁️ Uploading remaining variants (720p, 480p, 360p) and updated master playlist...`);
        await uploadFilesToS3(outputDir, streamName, uploadId, [
          `${uniquePrefix}_720p.m3u8`,
          `${uniquePrefix}_720p_*.ts`,
          `${uniquePrefix}_480p.m3u8`,
          `${uniquePrefix}_480p_*.ts`,
          `${uniquePrefix}_360p.m3u8`,
          `${uniquePrefix}_360p_*.ts`,
          `${uniquePrefix}_master.m3u8`
        ]);
        
        console.log(`🎉 All variants uploaded successfully! Adaptive streaming is now fully available.`);
        
        // Clean up temporary files after background processing
        cleanupTempFiles(outputDir);
      })
      .catch((error) => {
        console.error(`❌ Error in background processing:`, error);
        // Don't throw - this is background processing, errors shouldn't affect the initial upload
      });
    
    // Return early - don't wait for background processing
    // The mobile app will get success response immediately
    return;
  } else {
    // NEW LAMBDA FLOW: RTMP streams - upload FLV to S3 for Lambda processing
    console.log(`🚀 Using Lambda processing for RTMP stream: Upload FLV to S3`);
    
    // Generate unique identifier for this stream
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uniqueId = Math.random().toString(36).substring(2, 10);
    const uniquePrefix = `${streamName}_${timestamp}_${uniqueId}`;
    
    // Upload FLV file to processing bucket for Lambda
    console.log(`📤 Uploading FLV file to processing bucket for Lambda processing...`);
    const flvFileName = `${uniquePrefix}.flv`;
    const s3Key = `clips/${streamName}/${flvFileName}`;
    
    try {
      const flvContent = fs.readFileSync(recordingPath);
      const fileSizeMB = flvContent.length / (1024 * 1024);
      console.log(`📊 FLV file size: ${fileSizeMB.toFixed(2)}MB`);
      
      console.log(`📤 Uploading to s3://${PROCESSING_BUCKET}/${s3Key}`);
      await s3.upload({
        Bucket: PROCESSING_BUCKET,
        Key: s3Key,
        Body: flvContent,
        ContentType: 'video/x-flv'
      }).promise();
      
      console.log(`✅ FLV file uploaded successfully! Lambda will process it automatically.`);
      console.log(`🔗 S3 key: s3://${PROCESSING_BUCKET}/${s3Key}`);
      
      // Send message to coordinator queue
      try {
        await sqs.sendMessage({
          QueueUrl: COORDINATOR_QUEUE_URL,
          MessageBody: JSON.stringify({
            type: 'stream_uploaded_for_processing',
            streamName: streamName,
            schedulerId: schedulerId,
            timestamp: new Date().toISOString(),
            s3Key: s3Key,
            processingBucket: PROCESSING_BUCKET
          })
        }).promise();
        
        console.log(`📤 Sent upload notification to coordinator queue for stream: ${streamName}`);
      } catch (error) {
        console.error(`❌ Failed to send message to coordinator queue:`, error);
      }
      
      // Clean up local FLV file after successful upload
      try {
        fs.unlinkSync(recordingPath);
        console.log(`🧹 Cleaned up local FLV file: ${recordingPath}`);
      } catch (cleanupError) {
        console.warn(`⚠️ Failed to clean up local FLV file: ${cleanupError.message}`);
      }
      
    } catch (uploadError) {
      console.error(`❌ Failed to upload FLV to S3: ${uploadError.message}`);
      throw new Error(`Failed to upload FLV for Lambda processing: ${uploadError.message}`);
    }
  }
}

// Generate thumbnail from video
async function generateThumbnail(inputPath, outputDir, streamName) {
  console.log(`🖼️ generateThumbnail called with:`, { inputPath, outputDir, streamName });
  
  return new Promise((resolve, reject) => {
    try {
      // Extract the unique prefix from the output directory files
      const files = fs.readdirSync(outputDir);
      console.log(`📁 Files found in output directory:`, files);
      
      // Look for any m3u8 file to get the unique prefix
      const m3u8Files = files.filter(file => file.endsWith('.m3u8'));
      console.log(`📄 Found m3u8 files:`, m3u8Files);
      
      if (m3u8Files.length === 0) {
        console.log(`⚠️ No m3u8 files found for thumbnail generation`);
        resolve();
        return;
      }
      
      // Use the first m3u8 file to extract the unique prefix
      const m3u8File = m3u8Files[0];
      
      // Extract the unique prefix from the m3u8 filename
      // m3u8File format: "deh1_2025-07-16T20-34-59-561Z_gqx58f42_1080p.m3u8" or "deh1_2025-07-16T20-34-59-561Z_gqx58f42_master.m3u8"
      // We want to extract: "deh1_2025-07-16T20-34-59-561Z_gqx58f42"
      const uniquePrefix = m3u8File.replace(/_(1080p|720p|480p|360p|master)\.m3u8$/, '');
      
      // Use the same unique prefix for the thumbnail
      const thumbnailPath = path.join(outputDir, `${uniquePrefix}_thumb.jpg`);
      
      console.log(`🖼️ Generating thumbnail: ${thumbnailPath}`);
      console.log(`📝 Unique prefix for thumbnail: ${uniquePrefix}`);
      
      // Check if input file exists
      if (!fs.existsSync(inputPath)) {
        console.error(`❌ Input file does not exist: ${inputPath}`);
        resolve();
        return;
      }
      
      // Generate thumbnail that preserves aspect ratio (no black bars)
      // Use scale with max dimension of 640px, preserving aspect ratio
      // This ensures portrait videos get portrait thumbnails, landscape gets landscape
      const thumbnailArgs = [
        '-i', inputPath,
        '-ss', '00:00:05',  // Seek to 5 seconds
        '-vframes', '1',
        '-q:v', '2',  // High quality
        '-vf', 'scale=640:-1',  // Scale to max width 640px, height auto (preserves aspect ratio)
        '-y',  // Overwrite output file
        thumbnailPath
      ];
      
      console.log(`📸 Running FFmpeg for thumbnail generation...`);
      console.log(`📝 Command: ffmpeg ${thumbnailArgs.join(' ')}`);
      
      const ffmpeg = spawn('ffmpeg', thumbnailArgs, {
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
          // Verify the thumbnail was actually created
          if (fs.existsSync(thumbnailPath)) {
            const stats = fs.statSync(thumbnailPath);
            console.log(`✅ Thumbnail generated successfully: ${thumbnailPath} (${stats.size} bytes)`);
            resolve();
          } else {
            console.error(`❌ Thumbnail file was not created: ${thumbnailPath}`);
            resolve();
          }
        } else {
          console.error(`❌ Thumbnail generation failed with code ${code}`);
          console.error(`📝 FFmpeg stderr: ${stderr}`);
          // Don't reject, just resolve without thumbnail
          resolve();
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.error(`❌ FFmpeg error during thumbnail generation:`, error);
        // Don't reject, just resolve without thumbnail
        resolve();
      });
      
    } catch (error) {
      console.error(`❌ Error in thumbnail generation setup:`, error);
      resolve();
    }
  });
}

// Helper function to get overlay metadata from DynamoDB
async function getOverlayMetadata(streamKey) {
  try {
    const params = {
      TableName: 'Twilly',
      Key: {
        PK: `STREAM_OVERLAY#${streamKey}`,
        SK: 'metadata'
      }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (result.Item && result.Item.overlay) {
      console.log(`📋 Found overlay metadata for streamKey: ${streamKey}`);
      return result.Item.overlay;
    }
    
    console.log(`ℹ️ No overlay metadata found for streamKey: ${streamKey}, using default`);
    return null;
  } catch (error) {
    console.error(`❌ Error fetching overlay metadata for streamKey ${streamKey}:`, error.message);
    return null; // Continue without overlay on error
  }
}

// Helper function to download overlay image
async function downloadOverlayImage(imageUrl, outputPath) {
  return new Promise((resolve) => {
    const https = require('https');
    const http = require('http');
    const url = require('url');
    
    const parsedUrl = url.parse(imageUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    console.log(`📥 Downloading overlay image from ${imageUrl}...`);
    const file = fs.createWriteStream(outputPath);
    
    client.get(imageUrl, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          const exists = fs.existsSync(outputPath);
          if (exists) {
            console.log(`✅ Overlay image downloaded successfully`);
          } else {
            console.log(`⚠️ Overlay image file not found after download`);
          }
          resolve(exists);
        });
      } else {
        console.log(`⚠️ Failed to download overlay image: HTTP ${response.statusCode}`);
        resolve(false);
      }
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      console.log(`⚠️ Could not download overlay image: ${err.message}`);
      resolve(false);
    });
  });
}

// Detect video dimensions using ffprobe (including rotation metadata for iOS videos)
async function detectVideoDimensions(inputPath) {
  return new Promise((resolve, reject) => {
    console.log(`🔍 [detectVideoDimensions] Starting detection for: ${inputPath}`);
    
    // Use full path to ffprobe
    const ffprobePath = '/usr/local/bin/ffprobe';
    console.log(`🔍 [detectVideoDimensions] Using ffprobe at: ${ffprobePath}`);
    
    // Check both stream dimensions AND side_data (rotation metadata)
    // iOS videos store portrait videos as landscape frames with rotation metadata
    // Use stream_side_data=rotation (not side_data=rotation) to get rotation from stream
    const ffprobe = spawn(ffprobePath, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,display_aspect_ratio',
      '-show_entries', 'stream_side_data=rotation',
      '-show_entries', 'stream_tags=rotate',
      '-of', 'json',
      inputPath
    ]);
    
    let stdout = '';
    let stderr = '';
    
    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      console.log(`🔍 [detectVideoDimensions] ffprobe exited with code: ${code}`);
      if (code === 0) {
        try {
          console.log(`🔍 [detectVideoDimensions] ffprobe stdout: ${stdout.substring(0, 500)}`);
          const info = JSON.parse(stdout);
          const stream = info.streams && info.streams[0];
          if (stream && stream.width && stream.height) {
            let width = parseInt(stream.width);
            let height = parseInt(stream.height);
            
            // Check for rotation metadata (iOS videos)
            // Rotation can be in side_data_list (most common for iOS) or tags.rotate
            let rotation = 0;
            
            // Check stream_side_data first (this is where iOS stores it)
            if (stream.side_data_list && stream.side_data_list.length > 0) {
              const rotationData = stream.side_data_list.find(sd => sd.rotation !== undefined && sd.rotation !== null);
              if (rotationData && rotationData.rotation !== undefined && rotationData.rotation !== null) {
                rotation = parseInt(rotationData.rotation);
                console.log(`🔄 Found rotation in side_data_list: ${rotation} degrees`);
              }
            }
            
            // Also check tags.rotate as fallback
            if (rotation === 0 && stream.tags && stream.tags.rotate) {
              rotation = parseInt(stream.tags.rotate);
              console.log(`🔄 Found rotation tag: ${rotation} degrees`);
            }
            
            // CRITICAL: Determine orientation based on FINAL dimensions after rotation
            // iOS stores videos with rotation metadata indicating how to display them
            // We need to determine if the FINAL (displayed) orientation is portrait or landscape
            
            // Store original rotation for later use in filter
            const originalRotation = rotation;
            
            // Normalize rotation: -90 = 270, -270 = 90
            let normalizedRotation = rotation;
            if (rotation === -90) normalizedRotation = 270;
            if (rotation === -270) normalizedRotation = 90;
            
            // Calculate final dimensions after rotation
            // If rotated 90° or 270°, dimensions swap
            let finalWidth = width;
            let finalHeight = height;
            let isPortrait;
            
            if (normalizedRotation === 90 || normalizedRotation === 270) {
              // 90° or 270° rotation swaps dimensions
              finalWidth = height;
              finalHeight = width;
              // Determine orientation from FINAL dimensions
              isPortrait = finalHeight > finalWidth;
              console.log(`🔄 Video has ${rotation}° rotation: stored as ${width}x${height}, final will be ${finalWidth}x${finalHeight} (${isPortrait ? 'PORTRAIT' : 'LANDSCAPE'})`);
            } else {
              // No rotation or 180°: dimensions stay the same (180° just flips, doesn't change aspect)
              isPortrait = height > width;
              console.log(`🔄 Video has ${rotation}° rotation: dimensions ${width}x${height} (${isPortrait ? 'PORTRAIT' : 'LANDSCAPE'})`);
            }
            
            console.log(`📐 Video: stored ${width}x${height}, rotation: ${originalRotation}°, final: ${finalWidth}x${finalHeight}, isPortrait: ${isPortrait}`);
            resolve({ width: finalWidth, height: finalHeight, isPortrait, rotation: originalRotation });
          } else {
            console.log(`⚠️ Could not parse video dimensions from stream: ${JSON.stringify(stream)}, defaulting to landscape`);
            resolve({ width: 1280, height: 720, isPortrait: false, rotation: 0 });
          }
        } catch (error) {
          console.log(`⚠️ Error parsing ffprobe output: ${error.message}, stdout: ${stdout.substring(0, 500)}, defaulting to landscape`);
          resolve({ width: 1280, height: 720, isPortrait: false, rotation: 0 });
        }
      } else {
        console.log(`⚠️ ffprobe failed with code ${code}, stderr: ${stderr.substring(0, 200)}, defaulting to landscape`);
        resolve({ width: 1280, height: 720, isPortrait: false, rotation: 0 });
      }
    });
    
    ffprobe.on('error', (error) => {
      console.log(`⚠️ ffprobe spawn error: ${error.message}, defaulting to landscape`);
      resolve({ width: 1280, height: 720, isPortrait: false, rotation: 0 });
    });
  });
}

// Generate single HLS variant (1080p only - for fast initial upload)
async function generateSingleVariant(inputPath, outputDir, streamName, uploadId = null, variant = '1080p') {
  return new Promise(async (resolve, reject) => {
    // Generate unique prefix using uploadId if available
    let uniquePrefix;
    if (uploadId) {
      uniquePrefix = `${streamName}_${uploadId}`;
      console.log(`🎯 Generated unique prefix using uploadId: ${uniquePrefix}`);
    } else {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      uniquePrefix = `${streamName}_${timestamp}_${randomSuffix}`;
      console.log(`🎯 Generated unique prefix with timestamp: ${uniquePrefix}`);
    }
    
    // Detect video dimensions
    console.log(`🔍 [generateSingleVariant] Detecting video dimensions: ${inputPath}`);
    const videoInfo = await detectVideoDimensions(inputPath);
    const isPortrait = videoInfo.isPortrait;
    const rotation = videoInfo.rotation || 0;
    
    console.log(`🎥 Video is ${isPortrait ? 'PORTRAIT' : 'LANDSCAPE'}: ${videoInfo.width}x${videoInfo.height}, rotation: ${rotation}°`);
    
    // Build rotation filter
    let rotationFilter = '';
    if (isPortrait) {
      if (rotation === -90 || rotation === 270) {
        rotationFilter = 'transpose=1,';
      } else if (rotation === 90 || rotation === -270) {
        rotationFilter = 'transpose=2,';
      } else if (rotation === 180 || rotation === -180) {
        rotationFilter = 'transpose=2,transpose=2,';
      }
    }
    
    // Build filter for single variant (1080p)
    let scaleFilter;
    if (isPortrait) {
      scaleFilter = `[0:v]${rotationFilter}scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black[v_scaled]`;
    } else {
      scaleFilter = `[0:v]${rotationFilter}scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black[v_scaled]`;
    }
    
    const cpuCores = require('os').cpus().length;
    const threads = Math.max(1, Math.floor(cpuCores * 0.95));
    
    console.log(`⚡ Generating ${variant} variant using ${threads} threads`);
    
    const ffmpegArgs = [
      '-noautorotate',
      '-i', inputPath,
      '-filter_complex', scaleFilter,
      '-map', '[v_scaled]', '-map', '0:a',
      '-c:v', 'libx264', '-c:a', 'aac',
      '-map_metadata', '-1',
      '-crf', '20', '-preset', 'veryfast', '-threads', String(threads), '-b:a', '128k', '-tune', 'fastdecode',
      '-f', 'hls', '-hls_time', '6', '-hls_list_size', '0',
      '-hls_segment_filename', path.join(outputDir, `${uniquePrefix}_${variant}_%03d.ts`),
      path.join(outputDir, `${uniquePrefix}_${variant}.m3u8`)
    ];
    
    const processKey = `${streamName}_${variant}`;
    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      cwd: outputDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    activeFFmpegProcesses.set(processKey, ffmpeg);
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timeout = setTimeout(() => {
      console.error(`⏰ FFmpeg timeout for ${variant} variant: ${streamName}`);
      ffmpeg.kill('SIGKILL');
      activeFFmpegProcesses.delete(processKey);
      reject(new Error(`FFmpeg timeout for ${variant} variant`));
    }, 600000);
    
    ffmpeg.on('close', (code) => {
      clearTimeout(timeout);
      activeFFmpegProcesses.delete(processKey);
      
      if (code === 0) {
        console.log(`✅ ${variant} variant generated successfully`);
        resolve({ uniquePrefix, isPortrait });
      } else {
        console.error(`❌ FFmpeg failed for ${variant} variant with code ${code}`);
        reject(new Error(`FFmpeg failed for ${variant} variant`));
      }
    });
    
    ffmpeg.on('error', (error) => {
      clearTimeout(timeout);
      activeFFmpegProcesses.delete(processKey);
      console.error(`❌ FFmpeg error for ${variant} variant:`, error);
      reject(error);
    });
  });
}

// Generate remaining variants in background (720p, 480p, 360p)
async function generateRemainingVariants(inputPath, outputDir, streamName, uploadId, uniquePrefix, isPortrait) {
  return new Promise(async (resolve, reject) => {
    const rotation = (await detectVideoDimensions(inputPath)).rotation || 0;
    
    let rotationFilter = '';
    if (isPortrait) {
      if (rotation === -90 || rotation === 270) {
        rotationFilter = 'transpose=1,';
      } else if (rotation === 90 || rotation === -270) {
        rotationFilter = 'transpose=2,';
      } else if (rotation === 180 || rotation === -180) {
        rotationFilter = 'transpose=2,transpose=2,';
      }
    }
    
    let filterComplex;
    if (isPortrait) {
      filterComplex = `[0:v]${rotationFilter}split=3[v2][v3][v4];[v2]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=black[v2_scaled];[v3]scale=480:854:force_original_aspect_ratio=decrease,pad=480:854:(ow-iw)/2:(oh-ih)/2:color=black[v3_scaled];[v4]scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2:color=black[v4_scaled]`;
    } else {
      filterComplex = `[0:v]${rotationFilter}split=3[v2][v3][v4];[v2]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black[v2_scaled];[v3]scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2:color=black[v3_scaled];[v4]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:color=black[v4_scaled]`;
    }
    
    const cpuCores = require('os').cpus().length;
    const threads = Math.max(1, Math.floor(cpuCores * 0.95));
    
    console.log(`⚡ Generating remaining variants (720p, 480p, 360p) in background using ${threads} threads`);
    
    const ffmpegArgs = [
      '-noautorotate',
      '-i', inputPath,
      '-filter_complex', filterComplex,
      '-map', '[v2_scaled]', '-map', '0:a',
      '-c:v', 'libx264', '-c:a', 'aac',
      '-map_metadata', '-1',
      '-crf', '22', '-preset', 'veryfast', '-threads', String(threads), '-b:a', '128k', '-tune', 'fastdecode',
      '-f', 'hls', '-hls_time', '6', '-hls_list_size', '0',
      '-hls_segment_filename', path.join(outputDir, `${uniquePrefix}_720p_%03d.ts`),
      path.join(outputDir, `${uniquePrefix}_720p.m3u8`),
      '-map', '[v3_scaled]', '-map', '0:a',
      '-c:v', 'libx264', '-c:a', 'aac',
      '-map_metadata', '-1',
      '-crf', '24', '-preset', 'veryfast', '-threads', String(threads), '-b:a', '96k', '-tune', 'fastdecode',
      '-f', 'hls', '-hls_time', '6', '-hls_list_size', '0',
      '-hls_segment_filename', path.join(outputDir, `${uniquePrefix}_480p_%03d.ts`),
      path.join(outputDir, `${uniquePrefix}_480p.m3u8`),
      '-map', '[v4_scaled]', '-map', '0:a',
      '-c:v', 'libx264', '-c:a', 'aac',
      '-map_metadata', '-1',
      '-crf', '26', '-preset', 'veryfast', '-threads', String(threads), '-b:a', '64k', '-tune', 'fastdecode',
      '-f', 'hls', '-hls_time', '6', '-hls_list_size', '0',
      '-hls_segment_filename', path.join(outputDir, `${uniquePrefix}_360p_%03d.ts`),
      path.join(outputDir, `${uniquePrefix}_360p.m3u8`)
    ];
    
    const processKey = `${streamName}_remaining`;
    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      cwd: outputDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    activeFFmpegProcesses.set(processKey, ffmpeg);
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timeout = setTimeout(() => {
      console.error(`⏰ FFmpeg timeout for remaining variants: ${streamName}`);
      ffmpeg.kill('SIGKILL');
      activeFFmpegProcesses.delete(processKey);
      reject(new Error(`FFmpeg timeout for remaining variants`));
    }, 600000);
    
    ffmpeg.on('close', (code) => {
      clearTimeout(timeout);
      activeFFmpegProcesses.delete(processKey);
      
      if (code === 0) {
        console.log(`✅ Remaining variants generated successfully`);
        resolve();
      } else {
        console.error(`❌ FFmpeg failed for remaining variants with code ${code}`);
        reject(new Error(`FFmpeg failed for remaining variants`));
      }
    });
    
    ffmpeg.on('error', (error) => {
      clearTimeout(timeout);
      activeFFmpegProcesses.delete(processKey);
      console.error(`❌ FFmpeg error for remaining variants:`, error);
      reject(error);
    });
  });
}

// Generate adaptive HLS clips (simplified - no overlay encoding)
// DEPRECATED: Kept for backward compatibility with RTMP streams
// New uploads use generateSingleVariant + generateRemainingVariants
async function generateAdaptiveHLS(inputPath, outputDir, streamName, uploadId = null) {
  return new Promise(async (resolve, reject) => {
    // Generate unique prefix using uploadId if available, otherwise use timestamp + random
    // CRITICAL: Using uploadId ensures each upload gets a unique filename
    let uniquePrefix;
    if (uploadId) {
      // Use uploadId as the unique identifier (it's already a UUID from mobile app)
      uniquePrefix = `${streamName}_${uploadId}`;
      console.log(`🎯 Generated unique prefix using uploadId: ${uniquePrefix}`);
    } else {
      // Fallback for RTMP streams (backward compatibility)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const randomSuffix = Math.random().toString(36).substring(2, 10); // 8 character random string
      uniquePrefix = `${streamName}_${timestamp}_${randomSuffix}`;
      console.log(`🎯 Generated unique prefix with timestamp: ${uniquePrefix}`);
    }
    
    // Detect video dimensions to determine if portrait or landscape
    console.log(`🔍 [generateAdaptiveHLS] About to call detectVideoDimensions with: ${inputPath}`);
    const videoInfo = await detectVideoDimensions(inputPath);
    console.log(`🔍 [generateAdaptiveHLS] detectVideoDimensions returned:`, JSON.stringify(videoInfo));
    const isPortrait = videoInfo.isPortrait;
    const rotation = videoInfo.rotation || 0;
    
    console.log(`🎥 Video is ${isPortrait ? 'PORTRAIT' : 'LANDSCAPE'}: ${videoInfo.width}x${videoInfo.height}, rotation: ${rotation}°`);
    
    // Build filter complex based on orientation
    // For iOS videos with rotation metadata, we MUST explicitly apply rotation
    // RTMP streams were pre-rotated by iOS, but HTTP uploads need rotation applied here
    let filterComplex;
    
    // Determine rotation filter needed
    // CRITICAL: Only apply rotation if the video is actually portrait
    // Landscape videos should NOT have rotation applied (they're already landscape)
    // Portrait videos need rotation to be applied (they're stored as landscape with rotation metadata)
    let rotationFilter = '';
    
    // Only apply rotation for portrait videos
    // Landscape videos with rotation=0 should not get any rotation filter
    if (isPortrait) {
      // Portrait videos need rotation to be applied
      if (rotation === -90 || rotation === 270) {
        // -90° means video needs to be rotated 90° clockwise to be right-side-up portrait
        rotationFilter = 'transpose=1,'; // Rotate 90° clockwise
        console.log(`🔄 Applying rotation filter for PORTRAIT: transpose=1 (${rotation}° → rotate 90° clockwise for right-side-up)`);
      } else if (rotation === 90 || rotation === -270) {
        // 90° means video needs to be rotated 90° counterclockwise to be right-side-up portrait
        rotationFilter = 'transpose=2,'; // Rotate 90° counterclockwise
        console.log(`🔄 Applying rotation filter for PORTRAIT: transpose=2 (${rotation}° → rotate 90° counterclockwise for right-side-up)`);
      } else if (rotation === 180 || rotation === -180) {
        rotationFilter = 'transpose=2,transpose=2,'; // Rotate 180°
        console.log(`🔄 Applying rotation filter for PORTRAIT: transpose=2,transpose=2 (${rotation}°)`);
      } else {
        console.log(`⚠️ Portrait video has unexpected rotation (${rotation}°), not applying rotation filter`);
      }
    } else {
      // Landscape videos: NO rotation filter needed (they're already landscape)
      console.log(`✅ Landscape video detected - no rotation filter needed (rotation: ${rotation}°)`);
    }
    
    if (isPortrait) {
      // Portrait variants: 1080x1920, 720x1280, 480x854, 360x640
      // Apply rotation first (if needed), then scale to portrait dimensions
      filterComplex = `[0:v]${rotationFilter}split=4[v1][v2][v3][v4];[v1]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black[v1_scaled];[v2]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=black[v2_scaled];[v3]scale=480:854:force_original_aspect_ratio=decrease,pad=480:854:(ow-iw)/2:(oh-ih)/2:color=black[v3_scaled];[v4]scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2:color=black[v4_scaled]`;
    } else {
      // Landscape variants: 1920x1080, 1280x720, 854x480, 640x360
      // Apply rotation first (if needed), then scale to landscape dimensions
      filterComplex = `[0:v]${rotationFilter}split=4[v1][v2][v3][v4];[v1]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black[v1_scaled];[v2]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black[v2_scaled];[v3]scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2:color=black[v3_scaled];[v4]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:color=black[v4_scaled]`;
    }
    
    // FFmpeg command for adaptive HLS with multiple variants (no overlay)
    // OPTIMIZED FOR MAXIMUM SPEED: Using 'veryfast' preset (faster than 'faster') and thread optimization
    // Speed vs Quality tradeoff: 'veryfast' is ~2x faster than 'faster' with ~15-20% larger files
    // For uploads, speed is more important than perfect quality
    const cpuCores = require('os').cpus().length;
    const threads = Math.max(1, Math.floor(cpuCores * 0.95)); // Use 95% of CPU cores (more aggressive)
    
    console.log(`⚡ Using ${threads} threads for encoding (${cpuCores} CPU cores available)`);
    console.log(`⚡ Using 'veryfast' preset for maximum encoding speed (prioritizing speed over quality)`);
    
    // FFmpeg will automatically apply rotation metadata from iOS videos by default
    // The detectVideoDimensions function now correctly detects portrait videos
    // even when stored with landscape frame dimensions + rotation metadata
    // CRITICAL: Use -noautorotate to prevent FFmpeg from auto-applying rotation
    // We're manually applying rotation via transpose filter, so we don't want double rotation
    const ffmpegArgs = [
      '-noautorotate', // Prevent FFmpeg from auto-applying rotation metadata
      '-i', inputPath,
      '-filter_complex', filterComplex,
      '-map', '[v1_scaled]', '-map', '0:a',
      '-c:v', 'libx264', '-c:a', 'aac',
      '-map_metadata', '-1', // Remove all metadata (including rotation) from output
      '-crf', '20', '-preset', 'veryfast', '-threads', String(threads), '-b:a', '128k', '-tune', 'fastdecode',
      '-f', 'hls', '-hls_time', '6', '-hls_list_size', '0',
      '-hls_segment_filename', path.join(outputDir, `${uniquePrefix}_1080p_%03d.ts`),
      path.join(outputDir, `${uniquePrefix}_1080p.m3u8`),
      '-map', '[v2_scaled]', '-map', '0:a',
      '-c:v', 'libx264', '-c:a', 'aac',
      '-map_metadata', '-1', // Remove all metadata (including rotation) from output
      '-crf', '22', '-preset', 'veryfast', '-threads', String(threads), '-b:a', '128k', '-tune', 'fastdecode',
      '-f', 'hls', '-hls_time', '6', '-hls_list_size', '0',
      '-hls_segment_filename', path.join(outputDir, `${uniquePrefix}_720p_%03d.ts`),
      path.join(outputDir, `${uniquePrefix}_720p.m3u8`),
      '-map', '[v3_scaled]', '-map', '0:a',
      '-c:v', 'libx264', '-c:a', 'aac',
      '-map_metadata', '-1', // Remove all metadata (including rotation) from output
      '-crf', '24', '-preset', 'veryfast', '-threads', String(threads), '-b:a', '96k', '-tune', 'fastdecode',
      '-f', 'hls', '-hls_time', '6', '-hls_list_size', '0',
      '-hls_segment_filename', path.join(outputDir, `${uniquePrefix}_480p_%03d.ts`),
      path.join(outputDir, `${uniquePrefix}_480p.m3u8`),
      '-map', '[v4_scaled]', '-map', '0:a',
      '-c:v', 'libx264', '-c:a', 'aac',
      '-map_metadata', '-1', // Remove all metadata (including rotation) from output
      '-crf', '26', '-preset', 'veryfast', '-threads', String(threads), '-b:a', '64k', '-tune', 'fastdecode',
      '-f', 'hls', '-hls_time', '6', '-hls_list_size', '0',
      '-hls_segment_filename', path.join(outputDir, `${uniquePrefix}_360p_%03d.ts`),
      path.join(outputDir, `${uniquePrefix}_360p.m3u8`)
    ];
    
    console.log(`🎥 Running FFmpeg for adaptive HLS generation...`);
    console.log(`📝 Command: ffmpeg ${ffmpegArgs.join(' ')}`);
    
    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      cwd: outputDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Track this FFmpeg process
    activeFFmpegProcesses.set(streamName, ffmpeg);
    
    let stdout = '';
    let stderr = '';
    
    ffmpeg.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Add timeout to prevent hanging processes
    const timeout = setTimeout(() => {
      console.error(`⏰ FFmpeg timeout after 10 minutes for stream: ${streamName}`);
      ffmpeg.kill('SIGKILL');
      activeFFmpegProcesses.delete(streamName);
      reject(new Error(`FFmpeg timeout for stream: ${streamName}`));
    }, 600000); // 10 minutes
    
    ffmpeg.on('close', (code) => {
      clearTimeout(timeout);
      // Remove from active processes
      activeFFmpegProcesses.delete(streamName);
      
      if (code === 0) {
        console.log(`✅ FFmpeg completed successfully`);
        console.log(`📁 Generated files in: ${outputDir}`);
        
        // Create master playlist with the same unique prefix
        // CRITICAL: Pass uploadId so segment playlist URLs include uploadId in path
        createMasterPlaylist(outputDir, streamName, uniquePrefix, isPortrait, uploadId);
        
        resolve();
      } else {
        console.error(`❌ FFmpeg failed with code ${code}`);
        console.error(`📝 FFmpeg stderr: ${stderr}`);
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });
    
    ffmpeg.on('error', (error) => {
      clearTimeout(timeout);
      // Remove from active processes
      activeFFmpegProcesses.delete(streamName);
      console.error(`❌ FFmpeg error:`, error);
      reject(error);
    });
  });
}

// Upload specific files to S3 (for incremental uploads)
async function uploadFilesToS3(localDir, streamName, uploadId, filePatterns) {
  try {
    console.log(`☁️ Uploading specific files to S3...`);
    console.log(`📦 Bucket: ${BUCKET_NAME}`);
    console.log(`📁 Local directory: ${localDir}`);
    console.log(`📋 File patterns: ${filePatterns.join(', ')}`);
    
    const files = fs.readdirSync(localDir);
    console.log(`📋 Files in directory: ${files.join(', ')}`);
    const uploadedFiles = [];
    
    for (const file of files) {
      // Check if file matches any pattern
      const matches = filePatterns.some(pattern => {
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          return regex.test(file);
        }
        return file === pattern || file.includes(pattern);
      });
      
      if (!matches) {
        console.log(`⏭️ Skipping ${file} (doesn't match any pattern)`);
        continue;
      }
      
      console.log(`✅ File ${file} matches pattern`);
      
      const filePath = path.join(localDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        let s3Key;
        
        if (file.includes('_thumb.jpg')) {
          s3Key = uploadId ? `clips/${streamName}/${uploadId}/${file}` : `clips/${streamName}/${file}`;
        } else {
          s3Key = uploadId ? `clips/${streamName}/${uploadId}/${file}` : `clips/${streamName}/${file}`;
        }
        
        console.log(`📤 Uploading ${file} to s3://${BUCKET_NAME}/${s3Key}`);
        
        const fileContent = fs.readFileSync(filePath);
        
        await s3.upload({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: fileContent,
          ContentType: getContentType(file)
        }).promise();
        
        console.log(`✅ Uploaded ${file} successfully`);
        uploadedFiles.push(file);
      }
    }
    
    console.log(`🎉 Uploaded ${uploadedFiles.length} files: ${uploadedFiles.join(', ')}`);
    return uploadedFiles;
    
  } catch (error) {
    console.error(`❌ S3 upload error:`, error);
    throw error;
  }
}

// Upload to S3 (all files - backward compatibility)
async function uploadToS3(localDir, streamName, schedulerId, uploadId = null) {
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
        
        // Handle thumbnails with special naming
        if (file.includes('_thumb.jpg')) {
          // For thumbnails, use the structure: clips/{streamName}/{uniquePrefix}_thumb.jpg
          // If uploadId is provided, include it in the path so Lambda can extract it
          if (uploadId) {
            s3Key = `clips/${streamName}/${uploadId}/${file}`;
          } else {
            s3Key = `clips/${streamName}/${file}`;
          }
          console.log(`🖼️ Uploading thumbnail: ${file} to s3://${BUCKET_NAME}/${s3Key}`);
        } else {
          // For other files, use the structure: clips/{streamName}/{file}
          // If uploadId is provided, include it in the path so Lambda can extract it
          // Format: clips/{streamName}/{uploadId}/{file} or clips/{streamName}/{file} (backward compatible)
          if (uploadId) {
            s3Key = `clips/${streamName}/${uploadId}/${file}`;
            console.log(`📤 Using NEW format with uploadId: ${uploadId}`);
          } else {
            s3Key = `clips/${streamName}/${file}`;
            console.log(`⚠️ WARNING: uploadId is NULL, using OLD format (metadata lookup will fail!)`);
          }
        }
        
        console.log(`📤 Uploading ${file} to s3://${BUCKET_NAME}/${s3Key}`);
        console.log(`📤 uploadId value: ${uploadId || 'NULL'}`);
        
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
    
    // Send message to coordinator queue after successful upload
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const uniquePrefix = `${streamName}_${timestamp}`;
      
      await sqs.sendMessage({
        QueueUrl: COORDINATOR_QUEUE_URL,
        MessageBody: JSON.stringify({
          type: 'stream_processed',
          streamName: streamName,
          schedulerId: streamName, // Using streamName as schedulerId for now
          timestamp: new Date().toISOString(),
          files: ['1080p', '720p', '480p', '360p'] // Available variants
        })
      }).promise();
      
      console.log(`📤 Sent processing complete message to coordinator queue for stream: ${streamName}`);
    } catch (error) {
      console.error(`❌ Failed to send message to coordinator queue:`, error);
    }
    
    console.log(`🎉 All files uploaded successfully for stream: ${streamName}`);
    
  } catch (error) {
    console.error(`❌ S3 upload error:`, error);
    throw error;
  }
}

// Create master playlist for adaptive streaming (initial - 1080p only)
function createInitialMasterPlaylist(outputDir, streamName, uniquePrefix, isPortrait, uploadId = null) {
  const masterPlaylistPath = path.join(outputDir, `${uniquePrefix}_master.m3u8`);
  const cloudFrontBaseUrl = 'https://d4idc5cmwxlpy.cloudfront.net';
  
  let basePath;
  if (uploadId) {
    basePath = `clips/${streamName}/${uploadId}`;
  } else {
    basePath = `clips/${streamName}`;
  }
  
  let masterContent;
  if (isPortrait) {
    masterContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1080x1920
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_1080p.m3u8`;
  } else {
    masterContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1920x1080
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_1080p.m3u8`;
  }

  fs.writeFileSync(masterPlaylistPath, masterContent);
  console.log(`📝 Created initial master playlist (1080p only): ${masterPlaylistPath}`);
}

// Update master playlist to include remaining variants
async function updateMasterPlaylist(outputDir, streamName, uniquePrefix, isPortrait, uploadId = null) {
  const masterPlaylistPath = path.join(outputDir, `${uniquePrefix}_master.m3u8`);
  const cloudFrontBaseUrl = 'https://d4idc5cmwxlpy.cloudfront.net';
  
  let basePath;
  if (uploadId) {
    basePath = `clips/${streamName}/${uploadId}`;
  } else {
    basePath = `clips/${streamName}`;
  }
  
  let masterContent;
  if (isPortrait) {
    masterContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1080x1920
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1300000,RESOLUTION=720x1280
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=700000,RESOLUTION=480x854
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_480p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=360x640
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_360p.m3u8`;
  } else {
    masterContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1920x1080
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1300000,RESOLUTION=1280x720
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=700000,RESOLUTION=854x480
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_480p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=640x360
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_360p.m3u8`;
  }

  fs.writeFileSync(masterPlaylistPath, masterContent);
  console.log(`📝 Updated master playlist with all variants: ${masterPlaylistPath}`);
}

// Create master playlist for adaptive streaming (backward compatibility)
function createMasterPlaylist(outputDir, streamName, uniquePrefix, isPortrait, uploadId = null) {
  const masterPlaylistPath = path.join(outputDir, `${uniquePrefix}_master.m3u8`);
  const cloudFrontBaseUrl = 'https://d4idc5cmwxlpy.cloudfront.net';
  
  let basePath;
  if (uploadId) {
    basePath = `clips/${streamName}/${uploadId}`;
  } else {
    basePath = `clips/${streamName}`;
  }
  
  let masterContent;
  if (isPortrait) {
    masterContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1080x1920
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1300000,RESOLUTION=720x1280
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=700000,RESOLUTION=480x854
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_480p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=360x640
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_360p.m3u8`;
  } else {
    masterContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1920x1080
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1300000,RESOLUTION=1280x720
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=700000,RESOLUTION=854x480
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_480p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=640x360
${cloudFrontBaseUrl}/${basePath}/${uniquePrefix}_360p.m3u8`;
  }

  fs.writeFileSync(masterPlaylistPath, masterContent);
  console.log(`📝 Created master playlist: ${masterPlaylistPath}`);
  console.log(`📝 Master playlist uses basePath: ${basePath} (uploadId: ${uploadId || 'none'})`);
}

// Get content type for S3 upload
function getContentType(filename) {
  if (filename.endsWith('.m3u8')) {
    return 'application/vnd.apple.mpegurl';
  } else if (filename.endsWith('.ts')) {
    return 'video/mp2t';
  } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
    return 'image/jpeg';
  } else if (filename.endsWith('.png')) {
    return 'image/png';
  }
  return 'application/octet-stream';
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

// Short clips must never exist in DynamoDB. Videos shorter than this are not written.
const MIN_VIDEO_DURATION_SECONDS = 6;

/** Fetch HLS playlist and return total duration in seconds, or null if unavailable. */
async function getDurationFromHlsUrl(hlsUrl) {
  try {
    const res = await fetch(hlsUrl, { signal: AbortSignal.timeout(15000) });
    let body = await res.text();
    if (!body || typeof body !== 'string') return null;
    if (body.includes('#EXT-X-STREAM-INF')) {
      const lines = body.split(/\r?\n/);
      let variantUrl = null;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
          const next = lines[i + 1];
          if (next && !next.startsWith('#')) {
            variantUrl = next.trim();
            break;
          }
        }
      }
      if (!variantUrl) return null;
      const base = new URL(hlsUrl);
      const resolved = new URL(variantUrl, base.origin + base.pathname.replace(/\/[^/]*$/, '/'));
      const variantRes = await fetch(resolved.toString(), { signal: AbortSignal.timeout(15000) });
      body = await variantRes.text();
      if (!body || typeof body !== 'string') return null;
    }
    const extinf = /#EXTINF:(\d+(?:\.\d+)?)\s*,/g;
    let total = 0;
    let m;
    while ((m = extinf.exec(body)) !== null) total += parseFloat(m[1]);
    return total > 0 ? total : null;
  } catch (e) {
    console.warn('Could not get HLS duration:', e?.message || e);
    return null;
  }
}

// Create DynamoDB entry immediately after 1080p upload for instant video appearance
async function createVideoEntryImmediately(streamName, uploadId, uniquePrefix, userEmail, channelName) {
  const cloudFrontBaseUrl = 'https://d4idc5cmwxlpy.cloudfront.net';
  // CRITICAL FIX: Handle null uploadId for RTMP streams (backward compatible)
  const basePath = uploadId ? `clips/${streamName}/${uploadId}` : `clips/${streamName}`;
  const masterPlaylistKey = `${basePath}/${uniquePrefix}_master.m3u8`;
  const masterPlaylistUrl = `${cloudFrontBaseUrl}/${masterPlaylistKey}`;
  const thumbnailKey = `${basePath}/${uniquePrefix}_thumb.jpg`;
  
  // Use early thumbnail URL if available from context AND successfully uploaded to S3
  // CRITICAL: Only use thumbnail URL if it was successfully uploaded to S3
  // If thumbnail upload failed, don't create video entry with invalid thumbnail URL
  let thumbnailUrl = null;
  if (global.currentUploadContext && global.currentUploadContext.thumbnailUrl) {
    thumbnailUrl = global.currentUploadContext.thumbnailUrl;
    console.log(`📋 Using early thumbnail URL from context: ${thumbnailUrl}`);
    
    // CRITICAL FIX: Verify thumbnail actually exists in S3 before using it
    // This prevents creating entries with non-existent thumbnail URLs
    try {
      const thumbnailS3Key = thumbnailUrl.replace(cloudFrontBaseUrl + '/', '');
      await s3.headObject({
        Bucket: BUCKET_NAME,
        Key: thumbnailS3Key
      }).promise();
      console.log(`✅ Verified thumbnail exists in S3: ${thumbnailS3Key}`);
    } catch (s3Error) {
      if (s3Error.code === 'NotFound' || s3Error.code === 'NoSuchKey') {
        console.error(`❌ [createVideoEntryImmediately] Thumbnail does NOT exist in S3: ${thumbnailUrl}`);
        console.error(`   Skipping video entry creation - will be created by Lambda when thumbnail is ready`);
        throw new Error('Thumbnail does not exist in S3 - video entry will be created by Lambda when thumbnail is ready');
      } else {
        console.error(`⚠️ [createVideoEntryImmediately] Error verifying thumbnail in S3: ${s3Error.message}`);
        // Continue - might be a temporary S3 issue, but log the warning
      }
    }
  } else {
    // CRITICAL FIX: Don't construct fallback URL - verify files exist in S3 first
    // Check if master playlist exists in S3 (indicates processing completed)
    try {
      const masterPlaylistS3Key = masterPlaylistKey;
      await s3.headObject({
        Bucket: BUCKET_NAME,
        Key: masterPlaylistS3Key
      }).promise();
      console.log(`✅ Master playlist exists in S3 - checking for thumbnail...`);
      
      // Master playlist exists, check if thumbnail exists
      try {
        await s3.headObject({
          Bucket: BUCKET_NAME,
          Key: thumbnailKey
        }).promise();
        thumbnailUrl = `${cloudFrontBaseUrl}/${thumbnailKey}`;
        console.log(`✅ Thumbnail exists in S3: ${thumbnailUrl}`);
      } catch (thumbError) {
        if (thumbError.code === 'NotFound' || thumbError.code === 'NoSuchKey') {
          console.error(`❌ [createVideoEntryImmediately] Thumbnail NOT found in S3: ${thumbnailKey}`);
          console.error(`   Master playlist exists but thumbnail missing - skipping entry creation`);
          console.error(`   Video entry will be created by Lambda when thumbnail is ready`);
          throw new Error('Thumbnail not found in S3 - video entry will be created by Lambda when thumbnail is ready');
        } else {
          throw thumbError;
        }
      }
    } catch (masterError) {
      if (masterError.code === 'NotFound' || masterError.code === 'NoSuchKey') {
        console.error(`❌ [createVideoEntryImmediately] Master playlist NOT found in S3: ${masterPlaylistKey}`);
        console.error(`   Files have not been uploaded yet - skipping entry creation`);
        console.error(`   Video entry will be created by Lambda when files are uploaded`);
        throw new Error('Master playlist not found in S3 - video entry will be created by Lambda when files are uploaded');
      } else {
        throw masterError;
      }
    }
  }
  
  // CRITICAL: Validate thumbnail URL before creating video entry
  // If thumbnail URL is invalid or missing, don't create entry (Lambda will create it later with proper thumbnail)
  // This prevents creating videos with broken thumbnail URLs that appear in all accounts
  if (!thumbnailUrl || 
      typeof thumbnailUrl !== 'string' || 
      thumbnailUrl.trim() === '' ||
      thumbnailUrl.trim() === 'null' ||
      thumbnailUrl.trim() === 'undefined' ||
      thumbnailUrl.trim() === 'None' ||
      thumbnailUrl.trim() === 'none' ||
      (!thumbnailUrl.startsWith('http://') && !thumbnailUrl.startsWith('https://'))) {
    console.error(`❌ [createVideoEntryImmediately] INVALID thumbnail URL - skipping video entry creation`);
    console.error(`   thumbnailUrl: ${JSON.stringify(thumbnailUrl)}`);
    console.error(`   Video entry will be created by Lambda when thumbnail is ready`);
    throw new Error('Invalid thumbnail URL - video entry will be created by Lambda when thumbnail is ready');
  }
  
  // Additional validation: Ensure URL is well-formed
  try {
    const url = new URL(thumbnailUrl);
    if (!url.hostname || !url.pathname) {
      console.error(`❌ [createVideoEntryImmediately] Malformed thumbnail URL - missing hostname or pathname`);
      throw new Error('Malformed thumbnail URL');
    }
  } catch (urlError) {
    console.error(`❌ [createVideoEntryImmediately] Invalid URL format: ${urlError.message}`);
    throw new Error('Invalid thumbnail URL format - video entry will be created by Lambda when thumbnail is ready');
  }
  
  // CRITICAL FIX: ALWAYS look up from streamKey mapping FIRST - IGNORE userEmail from request
  // The streamKey mapping is the SINGLE SOURCE OF TRUTH for who actually owns/created the stream
  // For collaborator streams, userEmail from request might be wrong (could be channel owner's email)
  // We MUST use the collaboratorEmail from the streamKey mapping to ensure files are stored correctly
  let creatorEmail = null;
  let streamKeyResult = null; // Store for later use (channelName lookup)
  console.log(`🔍 [createVideoEntryImmediately] Looking up streamKey mapping for streamKey: ${streamName}`);
  console.log(`   ⚠️ IGNORING userEmail from request (${userEmail || 'N/A'}) - streamKey mapping is source of truth`);
  
  try {
    const streamKeyParams = {
      TableName: 'Twilly',
      Key: {
        PK: `STREAM_KEY#${streamName}`,
        SK: 'MAPPING'
      },
      ConsistentRead: true // CRITICAL: Use strong consistency to ensure we get the latest mapping (including isPremium)
    };
    streamKeyResult = await dynamodb.get(streamKeyParams).promise();
    
    if (streamKeyResult.Item) {
      // CRITICAL: DocumentClient returns plain values, but handle both boolean and string formats
      const isCollaboratorKey = streamKeyResult.Item.isCollaboratorKey === true || 
                                streamKeyResult.Item.isCollaboratorKey === 'true' ||
                                streamKeyResult.Item.isCollaboratorKey === 1;
      
      console.log(`✅ [createVideoEntryImmediately] StreamKey mapping found:`);
      console.log(`   isCollaboratorKey (raw): ${JSON.stringify(streamKeyResult.Item.isCollaboratorKey)} (type: ${typeof streamKeyResult.Item.isCollaboratorKey})`);
      console.log(`   isCollaboratorKey (parsed): ${isCollaboratorKey}`);
      console.log(`   collaboratorEmail: ${streamKeyResult.Item.collaboratorEmail || 'N/A'}`);
      console.log(`   ownerEmail: ${streamKeyResult.Item.ownerEmail || 'N/A'}`);
      console.log(`   channelName: ${streamKeyResult.Item.channelName || streamKeyResult.Item.seriesName || 'N/A'}`);
      console.log(`   isPrivateUsername: ${streamKeyResult.Item.isPrivateUsername} (type: ${typeof streamKeyResult.Item.isPrivateUsername})`);
      console.log(`   isPremium: ${streamKeyResult.Item.isPremium} (type: ${typeof streamKeyResult.Item.isPremium})`);
      console.log(`   streamUsername: ${streamKeyResult.Item.streamUsername || 'N/A'}`);
      
      // PRIORITY 1: For collaborator keys, ALWAYS use collaboratorEmail from mapping
      // This is critical - the streamKey mapping knows who the actual streamer is
      if (isCollaboratorKey && streamKeyResult.Item.collaboratorEmail) {
        creatorEmail = streamKeyResult.Item.collaboratorEmail;
        console.log(`✅ [createVideoEntryImmediately] Using collaboratorEmail from streamKey mapping: ${creatorEmail}`);
        console.log(`   ✅ IGNORED userEmail from request (${userEmail || 'N/A'}) - using collaboratorEmail instead`);
      } 
      // PRIORITY 2: For owner keys, use ownerEmail from mapping
      else if (streamKeyResult.Item.ownerEmail) {
        creatorEmail = streamKeyResult.Item.ownerEmail;
        console.log(`✅ [createVideoEntryImmediately] Using ownerEmail from streamKey mapping: ${creatorEmail}`);
      } else {
        console.log(`⚠️ [createVideoEntryImmediately] StreamKey mapping found but no collaboratorEmail or ownerEmail`);
      }
    } else {
      console.log(`❌ [createVideoEntryImmediately] StreamKey mapping NOT FOUND for ${streamName}`);
      console.log(`   This should NEVER happen - streamKey should be registered before streaming`);
    }
  } catch (error) {
    console.error(`❌ [createVideoEntryImmediately] Error looking up streamKey mapping: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
  }
  
  // FALLBACK: Only use userEmail if streamKey mapping is completely missing (shouldn't happen)
  if (!creatorEmail && userEmail) {
    creatorEmail = userEmail;
    console.log(`⚠️ [createVideoEntryImmediately] FALLBACK: Using userEmail from request: ${creatorEmail}`);
    console.log(`   ⚠️ WARNING: StreamKey mapping was missing - this should not happen in normal flow!`);
    console.log(`   ⚠️ This means the streamKey was not properly registered before streaming`);
  }
  
  // Final fallback: If still not found, try to get it from channel metadata
  if (!creatorEmail && channelName) {
    console.log(`⚠️ [createVideoEntryImmediately] Final fallback: Attempting channel metadata lookup for channelName: ${channelName}`);
    try {
      const channelScan = await dynamodb.scan({
        TableName: 'Twilly',
        FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND channelName = :channelName',
        ExpressionAttributeValues: {
          ':pkPrefix': 'CHANNEL#',
          ':sk': 'METADATA',
          ':channelName': channelName
        },
        Limit: 1
      }).promise();
      
      if (channelScan.Items && channelScan.Items.length > 0) {
        creatorEmail = channelScan.Items[0].creatorEmail;
        if (creatorEmail) {
          console.log(`✅ [createVideoEntryImmediately] Found creatorEmail from channel metadata: ${creatorEmail}`);
        }
      }
    } catch (error) {
      console.error(`❌ [createVideoEntryImmediately] Error looking up channel metadata: ${error.message}`);
    }
  }
  
  if (!creatorEmail) {
    console.error(`❌ [createVideoEntryImmediately] FATAL: creatorEmail is missing!`);
    console.error(`   userEmail from request: ${userEmail || 'N/A'}`);
    console.error(`   channelName: ${channelName || 'N/A'}`);
    console.error(`   streamKey: ${streamName}`);
    console.error(`   This should NEVER happen - streamKey mapping must exist`);
    throw new Error('creatorEmail is required (streamKey mapping must exist and contain collaboratorEmail or ownerEmail)');
  }
  
  // SIMPLE LOGIC: ALL accounts streaming to Twilly TV use the same logic
  // Store under master account, use creatorId from streamKey mapping for username
  // This works for both admin and collaborator accounts - they all stream to the same channel
  const masterEmail = 'dehyu.sinyan@gmail.com'; // Twilly TV channel owner
  console.log(`✅ [createVideoEntryImmediately] ALL Twilly TV streams stored under master account: ${masterEmail}`);
  console.log(`   creatorEmail from streamKey: ${creatorEmail || 'N/A'} (used for creatorId lookup)`);
  
  // Check if this is a collaborator video (for metadata purposes only)
  const isCollaboratorKey = streamKeyResult && streamKeyResult.Item && (
    streamKeyResult.Item.isCollaboratorKey === true || 
    streamKeyResult.Item.isCollaboratorKey === 'true' ||
    streamKeyResult.Item.isCollaboratorKey === 1
  );
  console.log(`   isCollaboratorKey: ${isCollaboratorKey} (for metadata only, storage is same for all)`);
  
  // CRITICAL: Get channelName from streamKey mapping (source of truth)
  // The channelName from request might not match what's in the mapping
  let finalChannelName = channelName;
  try {
    if (streamKeyResult && streamKeyResult.Item) {
      const mappingChannelName = streamKeyResult.Item.channelName || streamKeyResult.Item.seriesName;
      if (mappingChannelName) {
        finalChannelName = mappingChannelName;
        console.log(`✅ [createVideoEntryImmediately] Using channelName from streamKey mapping: ${finalChannelName}`);
        if (channelName && channelName !== finalChannelName) {
          console.log(`   ⚠️ Request channelName (${channelName}) differs from mapping channelName (${finalChannelName}) - using mapping`);
        }
      } else {
        console.log(`⚠️ [createVideoEntryImmediately] StreamKey mapping has no channelName/seriesName, using request channelName: ${channelName || 'N/A'}`);
      }
    }
  } catch (error) {
    console.log(`⚠️ [createVideoEntryImmediately] Error getting channelName from mapping: ${error.message}`);
  }
  
  console.log(`✅ [createVideoEntryImmediately] FINAL: Using masterEmail: ${masterEmail}`);
  console.log(`   File will be stored under: USER#${masterEmail}`);
  console.log(`   folderName will be: ${finalChannelName || streamName}`);
  console.log(`   All Twilly TV streams (admin or collaborator) use same storage location`);
  
  // Read metadata from DynamoDB
  let metadata = {};
  try {
    const metadataParams = {
      TableName: 'Twilly',
      Key: {
        PK: `METADATA#${uploadId}`,
        SK: 'video-details'
      }
    };
    const metadataResult = await dynamodb.get(metadataParams).promise();
    if (metadataResult.Item) {
      metadata = metadataResult.Item;
      console.log(`📋 Found metadata:`, metadata);
    }
  } catch (error) {
    console.log(`⚠️ Could not read metadata: ${error.message}`);
  }
  
  // Check if "post automatically" is enabled for this user
  // The postAutomatically setting is stored under SK: 'POST_AUTOMATICALLY'
  let postAutomatically = false;
  try {
    const postAutoParams = {
      TableName: 'Twilly',
      Key: {
        PK: `USER#${masterEmail}`,
        SK: 'POST_AUTOMATICALLY'
      }
    };
    const postAutoResult = await dynamodb.get(postAutoParams).promise();
    if (postAutoResult.Item && postAutoResult.Item.postAutomatically === true) {
      postAutomatically = true;
      console.log(`✅ [createVideoEntryImmediately] Post automatically is ENABLED - video will be visible immediately`);
    } else {
      console.log(`📅 [createVideoEntryImmediately] Post automatically is DISABLED - video visibility will follow schedule`);
    }
  } catch (error) {
    console.log(`⚠️ Could not check post automatically setting: ${error.message}`);
    // Default to false if we can't check
  }
  
  // Create video item with consistent fileId based on uploadId (makes function idempotent)
  // This allows calling it multiple times (e.g., after thumbnail, after HLS ready) without creating duplicates
  // CRITICAL FIX: Use deterministic fileId - if uploadId exists, use it; otherwise use uniquePrefix
  // This ensures Lambda and createVideoEntryImmediately use the SAME fileId for the same video
  let fileId;
  if (uploadId) {
    fileId = `file-${uploadId}`;
  } else {
    // For RTMP streams without uploadId, use uniquePrefix to generate deterministic fileId
    // This ensures Lambda (which extracts uniquePrefix from fileName) will use the same fileId
    fileId = `file-${uniquePrefix}`;
  }
  const timestamp = new Date().toISOString();
  const fileName = `${uniquePrefix}_master.m3u8`;
  
  // Get creatorId from streamKey mapping if available
  // CRITICAL: Get creatorId from streamKey mapping (this is the collaborator's userId)
  // Even though we store the video under masterEmail, creatorId should be the collaborator's userId
  // This ensures username lookup shows the collaborator's username, not the admin's
  let creatorId = null;
  if (streamKeyResult && streamKeyResult.Item && streamKeyResult.Item.creatorId) {
    creatorId = streamKeyResult.Item.creatorId;
    console.log(`📋 [createVideoEntryImmediately] Found creatorId from streamKey mapping: ${creatorId}`);
    console.log(`   This is the collaborator's userId - username will be looked up from this`);
  }
  
  // Use masterEmail (which is now the channel owner for collaborator videos)
  // Videos stored here so web app managefiles can see them
  const videoItem = {
    PK: `USER#${masterEmail}`, // Store under master account for web app visibility
    SK: `FILE#${fileId}`,
    url: masterPlaylistUrl,
    hlsUrl: masterPlaylistUrl,
    fileName: fileName,
    fileExtension: 'm3u8',
    folderPath: streamName,
    folderName: finalChannelName || streamName,
    streamKey: streamName,
    category: 'Videos',
    timestamp: timestamp,
    createdAt: timestamp, // Add createdAt for consistency
    thumbnailUrl: thumbnailUrl,
    price: metadata.price || 0,
    isVisible: postAutomatically, // Only visible immediately if post automatically is enabled
    // Determine if this is a collaborator video by checking if creatorEmail differs from channel owner
    // For now, we'll mark it based on streamKey mapping (if it was a collaborator key)
    isCollaboratorVideo: false, // Will be set correctly by Lambda when it processes the S3 event
    uploadId: uploadId,  // Add uploadId for client-side matching
    fileId: fileId  // Add fileId for easier client-side matching
  };
  
  // CRITICAL: Add creatorId (collaborator's userId) even though video is stored under master account
  // This ensures username lookup shows the collaborator's username, not the admin's
  if (creatorId) {
    videoItem.creatorId = creatorId;
    console.log(`✅ [createVideoEntryImmediately] Added creatorId (collaborator userId) to video entry: ${creatorId}`);
    console.log(`   Video stored under: USER#${masterEmail} (master account)`);
    console.log(`   Username will be looked up from: USER#${creatorId}/PROFILE (collaborator's profile)`);
  } else {
    console.log(`⚠️ [createVideoEntryImmediately] No creatorId found in streamKey mapping - username lookup may fail`);
  }
  
  // Check if this is a collaborator video by looking at streamKey mapping
  // CRITICAL: Use the isCollaboratorKey we already parsed earlier
  if (isCollaboratorKey) {
    videoItem.isCollaboratorVideo = true;
    console.log(`📋 [createVideoEntryImmediately] Marked as collaborator video (from streamKey mapping)`);
  } else {
    // Not a collaborator key, so it's the owner's video
    videoItem.isCollaboratorVideo = false;
    console.log(`📋 [createVideoEntryImmediately] Marked as owner video (not collaborator)`);
  }
  
  // Add metadata fields if present
  if (metadata.title) {
    videoItem.title = metadata.title;
  }
  if (metadata.description) {
    videoItem.description = metadata.description;
  }
  
  // CRITICAL: Determine and set isPrivateUsername
  // Priority: 1) Global map (instant), 2) StreamKey mapping, 3) Default to false (public)
  let isPrivateUsername = false; // Default to public
  let isPrivateDetermined = false;
  
  // PRIORITY 1: Check global map (instant, no DynamoDB read needed)
  if (global.streamPrivacyMap && global.streamPrivacyMap.has(streamName)) {
    const privacyData = global.streamPrivacyMap.get(streamName);
    isPrivateUsername = privacyData.isPrivateUsername === true;
    isPrivateDetermined = true;
    console.log(`✅ [createVideoEntryImmediately] Got isPrivateUsername from GLOBAL MAP: ${isPrivateUsername} (INSTANT)`);
  }
  
  // PRIORITY 2: Check streamKey mapping (already fetched above)
  // CRITICAL: Check isPrivateUsername from mapping if not already determined
  if (!isPrivateDetermined && streamKeyResult && streamKeyResult.Item) {
    // Check isPrivateUsername field
    if (streamKeyResult.Item.isPrivateUsername !== undefined && streamKeyResult.Item.isPrivateUsername !== null) {
      isPrivateUsername = streamKeyResult.Item.isPrivateUsername === true || 
                         streamKeyResult.Item.isPrivateUsername === 'true' || 
                         streamKeyResult.Item.isPrivateUsername === 1;
      isPrivateDetermined = true;
      console.log(`✅ [createVideoEntryImmediately] Got isPrivateUsername from STREAM_KEY mapping: ${isPrivateUsername}`);
    }
    // Fallback: Check streamUsername for lock icon
    else if (streamKeyResult.Item.streamUsername) {
      const streamUsername = streamKeyResult.Item.streamUsername;
      if (typeof streamUsername === 'string' && streamUsername.includes('🔒')) {
        isPrivateUsername = true;
        isPrivateDetermined = true;
        console.log(`✅ [createVideoEntryImmediately] Detected private from lock icon in streamUsername: ${streamUsername}`);
      }
    }
  }
  
  // CRITICAL: Check isPremium from streamKey mapping INDEPENDENTLY
  // isPremium should always be checked, regardless of whether isPrivateUsername was determined from global map or mapping
  let isPremium = false;
  if (streamKeyResult && streamKeyResult.Item) {
    if (streamKeyResult.Item.isPremium !== undefined && streamKeyResult.Item.isPremium !== null) {
      isPremium = streamKeyResult.Item.isPremium === true || 
                  streamKeyResult.Item.isPremium === 'true' || 
                  streamKeyResult.Item.isPremium === 1;
      console.log(`✅ [createVideoEntryImmediately] Got isPremium from STREAM_KEY mapping: ${isPremium}`);
    } else {
      console.log(`⚠️ [createVideoEntryImmediately] isPremium not found in streamKey mapping, defaulting to false`);
    }
  } else {
    console.log(`⚠️ [createVideoEntryImmediately] streamKeyResult not available, defaulting isPremium to false`);
  }
  
  // CRITICAL: ALWAYS set isPrivateUsername - never leave it undefined
  // This ensures the field is always present in DynamoDB, even if the value is false (public)
  videoItem.isPrivateUsername = isPrivateUsername === true ? true : false; // Explicitly set to boolean
  console.log(`📝 [createVideoEntryImmediately] Final isPrivateUsername value: ${videoItem.isPrivateUsername} (type: ${typeof videoItem.isPrivateUsername}, will be saved to video entry)`);
  
  // CRITICAL: ALWAYS set isPremium - never leave it undefined
  videoItem.isPremium = isPremium === true ? true : false; // Explicitly set to boolean
  console.log(`📝 [createVideoEntryImmediately] Final isPremium value: ${videoItem.isPremium} (type: ${typeof videoItem.isPremium}, will be saved to video entry)`);
  
  // CRITICAL: Short clips (6 seconds or less) must never be written to DynamoDB — skip before put
  const durationSec = await getDurationFromHlsUrl(masterPlaylistUrl);
  if (durationSec !== null && durationSec < MIN_VIDEO_DURATION_SECONDS) {
    console.log(`⏱️ [createVideoEntryImmediately] Short video skipped (${durationSec.toFixed(1)}s < ${MIN_VIDEO_DURATION_SECONDS}s), not writing to DynamoDB: ${fileName}`);
    return;
  }
  
  // Write to DynamoDB using DocumentClient format
  // CRITICAL: Use ConditionExpression to prevent duplicate writes (atomic check-and-write)
  // This prevents race conditions where createVideoEntryImmediately is called multiple times
  // or when both createVideoEntryImmediately and Lambda process the same video
  const putParams = {
    TableName: 'Twilly',
    Item: videoItem,
    ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)'
  };
  
  try {
    await dynamodb.put(putParams).promise();
    const streamMode = videoItem.isPrivateUsername ? 'PRIVATE' : 'PUBLIC';
    console.log(`✅ Created DynamoDB entry for video: ${fileId}`);
    console.log(`📋 Video URL: ${masterPlaylistUrl}`);
    console.log(`📋 Thumbnail URL: ${thumbnailUrl}`);
    console.log(`📋 Stream Mode: ${streamMode} (isPrivateUsername: ${videoItem.isPrivateUsername})`);
    
    // CRITICAL: If targetUserEmails is present, create notifications instead of auto-adding
    // Users must accept/reject the direct stream request before it appears in their timeline
    if (streamKeyResult && streamKeyResult.Item && streamKeyResult.Item.targetUserEmails) {
      const targetEmails = streamKeyResult.Item.targetUserEmails;
      if (Array.isArray(targetEmails) && targetEmails.length > 0) {
        console.log(`📤 [createVideoEntryImmediately] Direct stream detected - creating notifications for ${targetEmails.length} target users`);
        
        // Get streamer's username for notification
        let streamerUsername = creatorEmail.split('@')[0];
        try {
          const streamerProfileParams = {
            TableName: 'Twilly',
            Key: {
              PK: `USER#${creatorEmail}`,
              SK: 'PROFILE'
            }
          };
          const streamerProfileResult = await dynamodb.get(streamerProfileParams).promise();
          if (streamerProfileResult.Item && streamerProfileResult.Item.username) {
            streamerUsername = streamerProfileResult.Item.username;
          }
        } catch (err) {
          console.error(`⚠️ [createVideoEntryImmediately] Could not get streamer username: ${err.message}`);
        }
        
        for (const targetEmail of targetEmails) {
          if (!targetEmail || typeof targetEmail !== 'string') continue;
          
          const normalizedTargetEmail = targetEmail.toLowerCase().trim();
          console.log(`   📤 Creating notification for: ${normalizedTargetEmail}`);
          
          try {
            const notificationId = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const notificationParams = {
              TableName: 'Twilly',
              Item: {
                PK: `USER#${normalizedTargetEmail}`,
                SK: `NOTIFICATION#${notificationId}`,
                type: 'direct_stream_request',
                title: 'Direct Stream Request',
                message: `${streamerUsername} sent you a direct stream`,
                metadata: {
                  videoId: String(videoId),
                  fileId: String(fileId),
                  streamerEmail: String(creatorEmail),
                  streamerUsername: String(streamerUsername),
                  videoTitle: videoItem.title ? String(videoItem.title) : '',
                  videoThumbnail: videoItem.thumbnailUrl ? String(videoItem.thumbnailUrl) : '',
                  channelName: videoItem.folderName ? String(videoItem.folderName) : '',
                  hlsUrl: String(masterPlaylistUrl),
                  timestamp: String(timestamp)
                },
                isRead: false,
                status: 'pending', // pending, accepted, rejected
                createdAt: new Date().toISOString()
              }
            };
            
            await dynamodb.put(notificationParams).promise();
            console.log(`   ✅ Created notification for ${normalizedTargetEmail}`);
          } catch (notifError) {
            console.error(`   ❌ Failed to create notification for ${normalizedTargetEmail}: ${notifError.message}`);
          }
        }
        
        console.log(`✅ [createVideoEntryImmediately] Direct stream notifications created for ${targetEmails.length} users`);
      }
    }
  } catch (error) {
    // If item already exists (ConditionalCheckFailedException), it's a duplicate - skip it
    if (error.code === 'ConditionalCheckFailedException' || error.name === 'ConditionalCheckFailedException') {
      console.log(`⚠️ [createVideoEntryImmediately] Item already exists (duplicate detected), skipping: PK=${videoItem.PK}, SK=${videoItem.SK}`);
      console.log(`   This is expected if Lambda already created the entry or if function was called multiple times`);
      // Don't throw - this is expected when processing duplicate events
    } else {
      // Re-throw other errors
      throw error;
    }
  }
}

// Get channel owner from DynamoDB
async function getChannelOwner(channelId, channelName) {
  try {
    // Try to find channel by scanning for channelId
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'channelId = :channelId AND #role = :ownerRole',
      ExpressionAttributeNames: {
        '#role': 'role'
      },
      ExpressionAttributeValues: {
        ':channelId': channelId,
        ':ownerRole': 'owner'
      }
    };
    
    const scanResult = await dynamodb.scan(scanParams).promise();
    if (scanResult.Items && scanResult.Items.length > 0) {
      // Extract email from PK (format: USER#email)
      const pk = scanResult.Items[0].PK;
      if (pk && pk.startsWith('USER#')) {
        return pk.replace('USER#', '');
      }
    }
    
    // Fallback: try querying by channel name
    const nameScanParams = {
      TableName: 'Twilly',
      FilterExpression: 'channelName = :channelName AND #role = :ownerRole',
      ExpressionAttributeNames: {
        '#role': 'role'
      },
      ExpressionAttributeValues: {
        ':channelName': channelName,
        ':ownerRole': 'owner'
      }
    };
    
    const nameScanResult = await dynamodb.scan(nameScanParams).promise();
    if (nameScanResult.Items && nameScanResult.Items.length > 0) {
      const pk = nameScanResult.Items[0].PK;
      if (pk && pk.startsWith('USER#')) {
        return pk.replace('USER#', '');
      }
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error getting channel owner:`, error);
    return null;
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

// ============================================================================
// EPISODE SEGMENTATION SYSTEM (Whisper + GPT for self-titled episodes)
// ============================================================================

// Generate episodes from stream using OpenAI Whisper + GPT
// Runs asynchronously after main stream processing completes
async function generateEpisodes(streamName, recordingPath, schedulerId, uploadId = null) {
  console.log(`🎬 [Episode Segmentation] Starting for stream: ${streamName}`);
  
  try {
    // Step 1: Get streamer email and channel name from streamKey mapping
    const streamKeyMapping = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `STREAM_KEY#${streamName}`,
        SK: 'MAPPING'
      }
    }).promise();
    
    if (!streamKeyMapping.Item) {
      console.log(`⚠️ [Episode Segmentation] StreamKey mapping not found for ${streamName} - skipping`);
      return;
    }
    
    const streamerEmail = streamKeyMapping.Item.collaboratorEmail || streamKeyMapping.Item.ownerEmail;
    const channelName = streamKeyMapping.Item.channelName || streamKeyMapping.Item.seriesName;
    
    if (!streamerEmail) {
      console.log(`⚠️ [Episode Segmentation] No streamer email found for ${streamName} - skipping`);
      return;
    }
    
    console.log(`✅ [Episode Segmentation] Streamer: ${streamerEmail}, Channel: ${channelName || 'N/A'}`);
    
    // Step 2: Transcribe video using OpenAI Whisper API (cost-effective: ~$0.36/hour vs $1.44/hour for AWS Transcribe)
    console.log(`🎤 [Episode Segmentation] Transcribing video with OpenAI Whisper...`);
    const transcription = await transcribeWithWhisper(recordingPath);
    
    if (!transcription || !transcription.segments || transcription.segments.length === 0) {
      console.log(`⚠️ [Episode Segmentation] No transcription segments found - skipping`);
      return;
    }
    
    console.log(`✅ [Episode Segmentation] Transcription complete: ${transcription.segments.length} segments`);
    
    // Step 3: Use OpenAI GPT-4o-mini to identify episode breaks and generate titles/descriptions
    console.log(`🤖 [Episode Segmentation] Analyzing content with GPT-4o-mini...`);
    const episodes = await analyzeWithGPT(transcription, channelName);
    
    if (!episodes || episodes.length === 0) {
      console.log(`⚠️ [Episode Segmentation] No episodes identified - skipping`);
      return;
    }
    
    console.log(`✅ [Episode Segmentation] Identified ${episodes.length} episodes`);
    
    // Step 4: Extract and upload episode segments
    const episodeDir = `/tmp/streaming-service/${streamName}_episodes`;
    if (!fs.existsSync(episodeDir)) {
      fs.mkdirSync(episodeDir, { recursive: true, mode: 0o755 });
    }
    
    const createdEpisodes = [];
    
    for (let i = 0; i < episodes.length; i++) {
      const episode = episodes[i];
      const episodeNumber = i + 1;
      
      console.log(`📹 [Episode Segmentation] Processing episode ${episodeNumber}/${episodes.length}: "${episode.title}"`);
      
      // Extract segment using FFmpeg
      const episodePath = await extractEpisodeSegment(
        recordingPath,
        episodeDir,
        streamName,
        episodeNumber,
        episode.startTime,
        episode.endTime
      );
      
      if (!episodePath) {
        console.log(`⚠️ [Episode Segmentation] Failed to extract episode ${episodeNumber} - skipping`);
        continue;
      }
      
      // Generate HLS for episode
      const episodeHlsDir = path.join(episodeDir, `episode_${episodeNumber}`);
      if (!fs.existsSync(episodeHlsDir)) {
        fs.mkdirSync(episodeHlsDir, { recursive: true, mode: 0o755 });
      }
      
      await generateEpisodeHLS(episodePath, episodeHlsDir, streamName, episodeNumber);
      
      // Upload episode to S3
      const episodeS3Key = await uploadEpisodeToS3(episodeHlsDir, streamName, episodeNumber, uploadId);
      
      // Generate thumbnail for episode
      const thumbnailUrl = await generateEpisodeThumbnail(episodePath, streamName, episodeNumber, uploadId);
      
      // Create episode entry in DynamoDB
      const episodeEntry = {
        PK: `USER#${streamerEmail}`,
        SK: `EPISODE#${streamName}#${episodeNumber}`,
        streamKey: streamName,
        episodeNumber: episodeNumber,
        title: episode.title,
        description: episode.description,
        hlsUrl: episodeS3Key,
        startTime: episode.startTime,
        endTime: episode.endTime,
        duration: episode.endTime - episode.startTime,
        thumbnailUrl: thumbnailUrl,
        channelName: channelName || 'default',
        createdAt: new Date().toISOString(),
        editedBy: null,
        editedAt: null
      };
      
      await dynamodb.put({
        TableName: 'Twilly',
        Item: episodeEntry
      }).promise();
      
      createdEpisodes.push(episodeEntry);
      console.log(`✅ [Episode Segmentation] Episode ${episodeNumber} created: "${episode.title}"`);
      
      // Clean up temporary episode file
      if (fs.existsSync(episodePath)) {
        fs.unlinkSync(episodePath);
      }
    }
    
    // Clean up episode directory
    if (fs.existsSync(episodeDir)) {
      fs.rmSync(episodeDir, { recursive: true, force: true });
    }
    
    console.log(`🎉 [Episode Segmentation] Complete! Created ${createdEpisodes.length} episodes for stream: ${streamName}`);
    
  } catch (error) {
    console.error(`❌ [Episode Segmentation] Error processing episodes for ${streamName}:`, error);
    throw error;
  }
}

// Transcribe video using OpenAI Whisper API (MUCH cheaper: ~$0.36/hour vs $1.44/hour for AWS Transcribe)
async function transcribeWithWhisper(videoPath) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable not set');
  }
  
  console.log(`🎤 [Transcription] Starting OpenAI Whisper transcription...`);
  
  // Read video file
  const videoBuffer = fs.readFileSync(videoPath);
  
  // Create form data for OpenAI Whisper API using multipart/form-data
  const boundary = `----WebKitFormBoundary${Date.now()}`;
  const CRLF = '\r\n';
  
  let formData = '';
  formData += `--${boundary}${CRLF}`;
  formData += `Content-Disposition: form-data; name="file"; filename="${path.basename(videoPath)}"${CRLF}`;
  formData += `Content-Type: video/mp4${CRLF}${CRLF}`;
  
  const formDataBuffer = Buffer.from(formData, 'utf8');
  
  formData = '';
  formData += `${CRLF}--${boundary}${CRLF}`;
  formData += `Content-Disposition: form-data; name="model"${CRLF}${CRLF}`;
  formData += `whisper-1${CRLF}`;
  formData += `--${boundary}${CRLF}`;
  formData += `Content-Disposition: form-data; name="response_format"${CRLF}${CRLF}`;
  formData += `verbose_json${CRLF}`;
  formData += `--${boundary}${CRLF}`;
  formData += `Content-Disposition: form-data; name="timestamp_granularities[]"${CRLF}${CRLF}`;
  formData += `segment${CRLF}`;
  formData += `--${boundary}--${CRLF}`;
  
  const formDataEndBuffer = Buffer.from(formData, 'utf8');
  const finalBuffer = Buffer.concat([formDataBuffer, videoBuffer, formDataEndBuffer]);
  
  // Call OpenAI Whisper API
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: finalBuffer
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Whisper API error: ${response.status} ${errorText}`);
  }
  
  const result = await response.json();
  console.log(`✅ [Transcription] Whisper transcription complete: ${result.segments?.length || 0} segments`);
  return result;
}

// OLD: AWS Transcribe function (kept for reference, but Whisper is 4x cheaper)
async function transcribeWithAWS(videoPath) {
  console.log(`🎤 [Transcription] Starting AWS Transcribe job...`);
  
  // Extract audio from video first (Transcribe needs audio file)
  const audioPath = `/tmp/${path.basename(videoPath, path.extname(videoPath))}_audio.wav`;
  
  return new Promise((resolve, reject) => {
    // Extract audio using FFmpeg
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vn', // No video
      '-acodec', 'pcm_s16le', // PCM 16-bit
      '-ar', '16000', // 16kHz sample rate (required by Transcribe)
      '-ac', '1', // Mono
      '-y',
      audioPath
    ]);
    
    ffmpeg.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg audio extraction failed with code ${code}`));
        return;
      }
      
      try {
        // Upload audio to S3 (Transcribe needs S3 URI)
        const audioKey = `transcriptions/${Date.now()}_${path.basename(audioPath)}`;
        const audioBuffer = fs.readFileSync(audioPath);
        
        await s3.upload({
          Bucket: BUCKET_NAME,
          Key: audioKey,
          Body: audioBuffer,
          ContentType: 'audio/wav'
        }).promise();
        
        const audioUri = `s3://${BUCKET_NAME}/${audioKey}`;
        console.log(`✅ [Transcription] Audio uploaded to S3: ${audioUri}`);
        
        // Start Transcribe job
        const transcribe = new AWS.TranscribeService();
        const jobName = `transcribe_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        await transcribe.startTranscriptionJob({
          TranscriptionJobName: jobName,
          Media: { MediaFileUri: audioUri },
          MediaFormat: 'wav',
          LanguageCode: 'en-US',
          Settings: {
            ShowSpeakerLabels: false,
            ShowAlternatives: false
          },
          OutputBucketName: BUCKET_NAME,
          OutputKey: `transcriptions/${jobName}.json`
        }).promise();
        
        console.log(`✅ [Transcription] Transcribe job started: ${jobName}`);
        
        // Poll for job completion (max 10 minutes)
        const maxWaitTime = 10 * 60 * 1000; // 10 minutes
        const startTime = Date.now();
        const pollInterval = 5000; // 5 seconds
        
        const pollJob = async () => {
          try {
            const jobStatus = await transcribe.getTranscriptionJob({
              TranscriptionJobName: jobName
            }).promise();
            
            const status = jobStatus.TranscriptionJob.TranscriptionJobStatus;
            
            if (status === 'COMPLETED') {
              // Download transcription result
              const resultKey = `transcriptions/${jobName}.json`;
              const result = await s3.getObject({
                Bucket: BUCKET_NAME,
                Key: resultKey
              }).promise();
              
              const transcriptionData = JSON.parse(result.Body.toString());
              
              // Convert to Whisper-like format
              const segments = transcriptionData.results.items.map((item, index) => {
                const start = parseFloat(item.start_time || '0');
                const end = parseFloat(item.end_time || '0');
                const text = item.alternatives[0].content;
                
                return {
                  start,
                  end,
                  text
                };
              });
              
              // Clean up
              fs.unlinkSync(audioPath);
              await s3.deleteObject({ Bucket: BUCKET_NAME, Key: audioKey }).promise().catch(() => {});
              await s3.deleteObject({ Bucket: BUCKET_NAME, Key: resultKey }).promise().catch(() => {});
              
              console.log(`✅ [Transcription] Transcription complete: ${segments.length} segments`);
              
              resolve({ segments });
            } else if (status === 'FAILED') {
              reject(new Error(`Transcription job failed: ${jobStatus.TranscriptionJob.FailureReason}`));
            } else if (Date.now() - startTime > maxWaitTime) {
              reject(new Error('Transcription job timeout'));
            } else {
              // Still processing, poll again
              setTimeout(pollJob, pollInterval);
            }
          } catch (error) {
            reject(error);
          }
        };
        
        // Start polling
        setTimeout(pollJob, pollInterval);
        
      } catch (error) {
        // Clean up audio file
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
        reject(error);
      }
    });
    
    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg error: ${error.message}`));
    });
  });
}

// Analyze transcription with OpenAI GPT-4o-mini to identify episodes (cost-effective)
async function analyzeWithGPT(transcription, channelName) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable not set');
  }
  
  console.log(`🤖 [Episode Analysis] Using OpenAI GPT-4o-mini...`);
  
  // Build prompt for GPT
  const segments = transcription.segments.map(s => ({
    start: s.start,
    end: s.end,
    text: s.text
  }));
  
  const prompt = `You are analyzing a video stream transcription to identify natural episode breaks and generate self-titled episodes.

Channel: ${channelName || 'General Content'}

Transcription segments:
${segments.map(s => `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s] ${s.text}`).join('\n')}

Your task:
1. Identify natural episode breaks (topic changes, pauses, scene transitions, natural conversation endings)
2. For each episode, generate:
   - A concise, engaging title (self-titled style, 3-8 words)
   - A brief description (1-2 sentences summarizing the episode content)

Guidelines:
- Episodes should be 5-30 minutes long (prefer 10-20 minutes)
- Look for natural breaks in conversation/topics
- Titles should be catchy and descriptive
- Descriptions should summarize key points

Return a JSON array of episodes, each with:
{
  "startTime": <start time in seconds>,
  "endTime": <end time in seconds>,
  "title": "<episode title>",
  "description": "<episode description>"
}

Return ONLY valid JSON, no other text.`;

  // Call OpenAI GPT API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Cost-effective model
      messages: [
        {
          role: 'system',
          content: 'You are a video content analyzer. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI GPT API error: ${response.status} ${errorText}`);
  }
  
  const result = await response.json();
  const content = result.choices[0].message.content;
  
  // Parse JSON response
  let episodes;
  try {
    // Remove markdown code blocks if present
    const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    episodes = JSON.parse(cleanedContent);
  } catch (parseError) {
    console.error(`❌ [Episode Segmentation] Failed to parse GPT response:`, content);
    throw new Error(`Failed to parse GPT response: ${parseError.message}`);
  }
  
  if (!Array.isArray(episodes)) {
    throw new Error('GPT response is not an array');
  }
  
  console.log(`✅ [Episode Analysis] GPT analysis complete: ${episodes.length} episodes identified`);
  return episodes;
}

// Extract episode segment from video using FFmpeg
async function extractEpisodeSegment(inputPath, outputDir, streamName, episodeNumber, startTime, endTime) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(outputDir, `${streamName}_episode_${episodeNumber}.mp4`);
    const duration = endTime - startTime;
    
    console.log(`🎬 [Episode Segmentation] Extracting episode ${episodeNumber}: ${startTime}s - ${endTime}s (${duration.toFixed(1)}s)`);
    
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-ss', startTime.toString(),
      '-t', duration.toString(),
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'fast',
      '-crf', '23',
      '-y',
      outputPath
    ]);
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ [Episode Segmentation] Episode ${episodeNumber} extracted: ${outputPath}`);
        resolve(outputPath);
      } else {
        console.error(`❌ [Episode Segmentation] FFmpeg failed for episode ${episodeNumber}:`, stderr);
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });
    
    ffmpeg.on('error', (error) => {
      console.error(`❌ [Episode Segmentation] FFmpeg error for episode ${episodeNumber}:`, error);
      reject(error);
    });
  });
}

// Generate HLS for episode
async function generateEpisodeHLS(inputPath, outputDir, streamName, episodeNumber) {
  return new Promise((resolve, reject) => {
    const uniquePrefix = `${streamName}_episode_${episodeNumber}`;
    const outputPath = path.join(outputDir, `${uniquePrefix}_1080p.m3u8`);
    
    console.log(`📹 [Episode Segmentation] Generating HLS for episode ${episodeNumber}...`);
    
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_segment_filename', path.join(outputDir, `${uniquePrefix}_%03d.ts`),
      '-preset', 'fast',
      '-crf', '23',
      '-y',
      outputPath
    ]);
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ [Episode Segmentation] HLS generated for episode ${episodeNumber}`);
        resolve();
      } else {
        console.error(`❌ [Episode Segmentation] FFmpeg HLS failed for episode ${episodeNumber}:`, stderr);
        reject(new Error(`FFmpeg HLS failed with code ${code}`));
      }
    });
    
    ffmpeg.on('error', (error) => {
      console.error(`❌ [Episode Segmentation] FFmpeg HLS error for episode ${episodeNumber}:`, error);
      reject(error);
    });
  });
}

// Upload episode to S3
async function uploadEpisodeToS3(localDir, streamName, episodeNumber, uploadId) {
  const files = fs.readdirSync(localDir);
  const cloudFrontBaseUrl = 'https://d4idc5cmwxlpy.cloudfront.net';
  
  let masterPlaylistKey = null;
  
  for (const file of files) {
    const filePath = path.join(localDir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isFile()) {
      let s3Key;
      if (uploadId) {
        s3Key = `clips/${streamName}/${uploadId}/episodes/episode_${episodeNumber}/${file}`;
      } else {
        s3Key = `clips/${streamName}/episodes/episode_${episodeNumber}/${file}`;
      }
      
      if (file.endsWith('_1080p.m3u8')) {
        masterPlaylistKey = s3Key;
      }
      
      const fileContent = fs.readFileSync(filePath);
      
      await s3.upload({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: fileContent,
        ContentType: getContentType(file)
      }).promise();
      
      console.log(`✅ [Episode Segmentation] Uploaded ${file} to S3`);
    }
  }
  
  if (masterPlaylistKey) {
    return `${cloudFrontBaseUrl}/${masterPlaylistKey}`;
  }
  
  throw new Error('Master playlist not found in uploaded files');
}

// Generate thumbnail for episode
async function generateEpisodeThumbnail(videoPath, streamName, episodeNumber, uploadId) {
  return new Promise((resolve, reject) => {
    const thumbnailPath = `/tmp/${streamName}_episode_${episodeNumber}_thumb.jpg`;
    
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-ss', '1', // Take frame at 1 second
      '-vframes', '1',
      '-q:v', '2',
      '-y',
      thumbnailPath
    ]);
    
    ffmpeg.on('close', async (code) => {
      if (code === 0) {
        try {
          const thumbnailBuffer = fs.readFileSync(thumbnailPath);
          let s3Key;
          if (uploadId) {
            s3Key = `clips/${streamName}/${uploadId}/episodes/episode_${episodeNumber}_thumb.jpg`;
          } else {
            s3Key = `clips/${streamName}/episodes/episode_${episodeNumber}_thumb.jpg`;
          }
          
          await s3.upload({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            Body: thumbnailBuffer,
            ContentType: 'image/jpeg'
          }).promise();
          
          const cloudFrontBaseUrl = 'https://d4idc5cmwxlpy.cloudfront.net';
          const thumbnailUrl = `${cloudFrontBaseUrl}/${s3Key}`;
          
          // Clean up local thumbnail
          if (fs.existsSync(thumbnailPath)) {
            fs.unlinkSync(thumbnailPath);
          }
          
          console.log(`✅ [Episode Segmentation] Thumbnail generated for episode ${episodeNumber}`);
          resolve(thumbnailUrl);
        } catch (error) {
          console.error(`❌ [Episode Segmentation] Failed to upload thumbnail:`, error);
          reject(error);
        }
      } else {
        console.error(`❌ [Episode Segmentation] FFmpeg thumbnail failed for episode ${episodeNumber}`);
        reject(new Error(`FFmpeg thumbnail failed with code ${code}`));
      }
    });
    
    ffmpeg.on('error', (error) => {
      console.error(`❌ [Episode Segmentation] FFmpeg thumbnail error:`, error);
      reject(error);
    });
  });
}

// ============================================================================
// ADMIN API: Edit Episode Titles/Descriptions
// ============================================================================

// Edit episode title and description (admin only)
app.post('/api/episodes/edit', async (req, res) => {
  try {
    const { streamKey, episodeNumber, title, description, adminEmail } = req.body;
    
    if (!streamKey || !episodeNumber || !title || !description || !adminEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: streamKey, episodeNumber, title, description, adminEmail' 
      });
    }
    
    // Verify admin
    const ADMIN_EMAIL = 'dehyu.sinyan@gmail.com';
    if (adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only admin can edit episodes' 
      });
    }
    
    // Get streamer email from streamKey mapping
    const streamKeyMapping = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      }
    }).promise();
    
    if (!streamKeyMapping.Item) {
      return res.status(404).json({ 
        success: false, 
        error: 'StreamKey mapping not found' 
      });
    }
    
    const streamerEmail = streamKeyMapping.Item.collaboratorEmail || streamKeyMapping.Item.ownerEmail;
    
    if (!streamerEmail) {
      return res.status(404).json({ 
        success: false, 
        error: 'Streamer email not found in streamKey mapping' 
      });
    }
    
    // Get existing episode
    const episodeKey = {
      PK: `USER#${streamerEmail}`,
      SK: `EPISODE#${streamKey}#${episodeNumber}`
    };
    
    const existingEpisode = await dynamodb.get({
      TableName: 'Twilly',
      Key: episodeKey
    }).promise();
    
    if (!existingEpisode.Item) {
      return res.status(404).json({ 
        success: false, 
        error: `Episode ${episodeNumber} not found for streamKey ${streamKey}` 
      });
    }
    
    // Update episode
    await dynamodb.update({
      TableName: 'Twilly',
      Key: episodeKey,
      UpdateExpression: 'SET title = :title, description = :description, editedBy = :editedBy, editedAt = :editedAt',
      ExpressionAttributeValues: {
        ':title': title,
        ':description': description,
        ':editedBy': adminEmail,
        ':editedAt': new Date().toISOString()
      }
    }).promise();
    
    console.log(`✅ [Admin API] Episode edited: ${streamKey} episode ${episodeNumber} by ${adminEmail}`);
    
    res.json({ 
      success: true, 
      message: 'Episode updated successfully',
      episode: {
        streamKey,
        episodeNumber,
        title,
        description,
        editedBy: adminEmail,
        editedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ [Admin API] Error editing episode:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to edit episode',
      details: error.message 
    });
  }
});

// Get episodes for a stream (for admin editing)
app.get('/api/episodes/:streamKey', async (req, res) => {
  try {
    const { streamKey } = req.params;
    const { adminEmail } = req.query;
    
    if (!adminEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'adminEmail query parameter required' 
      });
    }
    
    // Verify admin
    const ADMIN_EMAIL = 'dehyu.sinyan@gmail.com';
    if (adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only admin can view episodes' 
      });
    }
    
    // Get streamer email from streamKey mapping
    const streamKeyMapping = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      }
    }).promise();
    
    if (!streamKeyMapping.Item) {
      return res.status(404).json({ 
        success: false, 
        error: 'StreamKey mapping not found' 
      });
    }
    
    const streamerEmail = streamKeyMapping.Item.collaboratorEmail || streamKeyMapping.Item.ownerEmail;
    
    if (!streamerEmail) {
      return res.status(404).json({ 
        success: false, 
        error: 'Streamer email not found in streamKey mapping' 
      });
    }
    
    // Query all episodes for this stream
    const episodesResult = await dynamodb.query({
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${streamerEmail}`,
        ':skPrefix': `EPISODE#${streamKey}#`
      }
    }).promise();
    
    // Sort by episode number
    const episodes = (episodesResult.Items || []).sort((a, b) => a.episodeNumber - b.episodeNumber);
    
    res.json({ 
      success: true, 
      episodes: episodes.map(ep => ({
        streamKey: ep.streamKey,
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        description: ep.description,
        duration: ep.duration,
        hlsUrl: ep.hlsUrl,
        thumbnailUrl: ep.thumbnailUrl,
        editedBy: ep.editedBy,
        editedAt: ep.editedAt,
        createdAt: ep.createdAt
      }))
    });
    
  } catch (error) {
    console.error('❌ [Admin API] Error fetching episodes:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch episodes',
      details: error.message 
    });
  }
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