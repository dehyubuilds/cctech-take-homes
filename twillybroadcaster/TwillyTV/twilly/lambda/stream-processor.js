const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Set PATH to include FFmpeg from Lambda layer
process.env.PATH = `/opt/bin:${process.env.PATH}`;

const s3Client = new S3Client({ region: 'us-east-1' });
const PROCESSING_BUCKET = 'twilly-streaming-processing';
const OUTPUT_BUCKET = 'theprivatecollection';

// Create separate S3 client for the output bucket in us-east-2
const outputS3Client = new S3Client({ region: 'us-east-2' });

// FFmpeg path - use layer path if available, otherwise try system path
const FFMPEG_PATH = fs.existsSync('/opt/bin/ffmpeg') ? '/opt/bin/ffmpeg' : 'ffmpeg';
const FFPROBE_PATH = fs.existsSync('/opt/bin/ffprobe') ? '/opt/bin/ffprobe' : 'ffprobe';

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Parse the S3 event
    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    console.log(`Processing FLV file: s3://${bucket}/${key}`);
    
    // Extract stream info from the S3 key
    // Expected format: clips/streamKey/streamName_timestamp_uniqueId.flv
    const keyParts = key.split('/');
    if (keyParts.length < 3) {
      throw new Error(`Invalid S3 key format: ${key}`);
    }
    
    const streamKey = keyParts[1];
    const fileName = keyParts[2];
    
    // Parse the filename to extract streamName, timestamp, and uniqueId
    // Format: streamName_timestamp_uniqueId.flv
    const fileNameParts = fileName.replace('.flv', '').split('_');
    if (fileNameParts.length < 3) {
      throw new Error(`Invalid filename format: ${fileName}`);
    }
    
    // The last part is the uniqueId, the second-to-last is timestamp, rest is streamName
    const uniqueId = fileNameParts.pop();
    const timestamp = fileNameParts.pop();
    const streamName = fileNameParts.join('_');
    
    console.log(`Parsed - StreamName: ${streamName}, Timestamp: ${timestamp}, UniqueId: ${uniqueId}, StreamKey: ${streamKey}`);
    
    // Create unique prefix for this stream
    const uniquePrefix = `${streamName}_${timestamp}_${uniqueId}`;
    
    // Download the FLV file to /tmp
    const localFlvPath = `/tmp/${fileName}`;
    console.log(`Downloading FLV file to: ${localFlvPath}`);
    
    const getObjectCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    const flvResponse = await s3Client.send(getObjectCommand);
    const flvData = await flvResponse.Body.transformToByteArray();
    
    fs.writeFileSync(localFlvPath, Buffer.from(flvData));
    console.log(`✅ FLV file downloaded successfully`);
    
    // Create output directory for HLS files
    const outputDir = `/tmp/hls_${uniqueId}`;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // SNAPCHAT-STYLE APPROACH: Generate 1080p first, show immediately, then process other variants in parallel
    console.log(`🚀 Using Snapchat-style approach: Generate 1080p first for instant playback`);
    
    // Step 1: Detect video dimensions
    const videoInfo = await detectVideoDimensions(localFlvPath);
    const isPortrait = videoInfo.isPortrait;
    console.log(`🎥 Video is ${isPortrait ? 'PORTRAIT' : 'LANDSCAPE'}: ${videoInfo.width}x${videoInfo.height}`);
    
    // Step 2: Generate 1080p variant first (highest quality for instant playback)
    const firstVariant = isPortrait 
      ? { name: '1080p', width: 1080, height: 1920, bitrate: '2400k', audio: '128k' }
      : { name: '1080p', width: 1920, height: 1080, bitrate: '2400k', audio: '128k' };
    
    console.log(`📹 Step 1: Generating 1080p variant first (for instant playback)...`);
    await generateSingleVariant(localFlvPath, outputDir, uniquePrefix, streamKey, firstVariant);
    
    // Step 3: Generate thumbnail in parallel with 1080p upload
    console.log(`🖼️ Step 2: Generating thumbnail...`);
    const thumbnailPromise = generateThumbnail(localFlvPath, uniquePrefix, streamKey);
    
    // Step 4: Upload 1080p variant and segments immediately (for instant playback)
    console.log(`📤 Step 3: Uploading 1080p variant immediately for instant playback...`);
    const upload1080pPromise = uploadVariantFiles(outputDir, streamKey, uniquePrefix, '1080p');
    
    // Wait for 1080p upload and thumbnail to complete
    await Promise.all([upload1080pPromise, thumbnailPromise]);
    
    // Step 5: Create initial master playlist with only 1080p (for instant playback)
    const masterPlaylistKey = `clips/${streamKey}/${uniquePrefix}_master.m3u8`;
    const initialMasterPlaylist = createMasterPlaylist([firstVariant], streamKey, uniquePrefix);
    
    console.log(`📤 Step 4: Uploading initial master playlist (1080p only) for instant playback...`);
    await outputS3Client.send(new PutObjectCommand({
      Bucket: OUTPUT_BUCKET,
      Key: masterPlaylistKey,
      Body: initialMasterPlaylist,
      ContentType: 'application/vnd.apple.mpegurl'
    }));
    console.log(`✅ Initial master playlist uploaded - video is now playable!`);
    
    // Step 6: Generate remaining variants in PARALLEL (720p, 480p, 360p)
    const remainingVariants = isPortrait
      ? [
          { name: '720p', width: 720, height: 1280, bitrate: '1200k', audio: '128k' },
          { name: '480p', width: 480, height: 854, bitrate: '600k', audio: '96k' },
          { name: '360p', width: 360, height: 640, bitrate: '300k', audio: '64k' }
        ]
      : [
          { name: '720p', width: 1280, height: 720, bitrate: '1200k', audio: '128k' },
          { name: '480p', width: 854, height: 480, bitrate: '600k', audio: '96k' },
          { name: '360p', width: 640, height: 360, bitrate: '300k', audio: '64k' }
        ];
    
    console.log(`🎬 Step 5: Generating remaining variants in PARALLEL (720p, 480p, 360p)...`);
    const variantPromises = remainingVariants.map(variant => 
      generateSingleVariant(localFlvPath, outputDir, uniquePrefix, streamKey, variant)
    );
    await Promise.all(variantPromises);
    console.log(`✅ All remaining variants generated in parallel`);
    
    // Step 7: Upload all remaining variant files in PARALLEL
    console.log(`📤 Step 6: Uploading all remaining variant files in PARALLEL...`);
    const uploadPromises = remainingVariants.map(variant =>
      uploadVariantFiles(outputDir, streamKey, uniquePrefix, variant.name)
    );
    await Promise.all(uploadPromises);
    console.log(`✅ All variant files uploaded in parallel`);
    
    // Step 8: Update master playlist with all variants
    const allVariants = [firstVariant, ...remainingVariants];
    const finalMasterPlaylist = createMasterPlaylist(allVariants, streamKey, uniquePrefix);
    
    console.log(`📤 Step 7: Updating master playlist with all variants...`);
    await outputS3Client.send(new PutObjectCommand({
      Bucket: OUTPUT_BUCKET,
      Key: masterPlaylistKey,
      Body: finalMasterPlaylist,
      ContentType: 'application/vnd.apple.mpegurl'
    }));
    console.log(`✅ Final master playlist uploaded with all variants`);
    
    // Clean up temporary files
    cleanupTempFiles(outputDir);
    fs.unlinkSync(localFlvPath);
    
    console.log(`🎉 Stream processing completed successfully`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Stream processed successfully',
        streamName,
        streamKey,
        uniquePrefix,
        masterPlaylistKey
      })
    };
    
  } catch (error) {
    console.error('❌ Error processing stream:', error);
    throw error;
  }
};

// Detect video dimensions using ffprobe
async function detectVideoDimensions(inputPath) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const ffprobe = spawn(FFPROBE_PATH, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
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
      if (code === 0) {
        try {
          const info = JSON.parse(stdout);
          const stream = info.streams && info.streams[0];
          if (stream && stream.width && stream.height) {
            const width = parseInt(stream.width);
            const height = parseInt(stream.height);
            const isPortrait = height > width;
            console.log(`📐 Video dimensions: ${width}x${height}, isPortrait: ${isPortrait}`);
            resolve({ width, height, isPortrait });
          } else {
            console.log(`⚠️ Could not parse video dimensions, defaulting to landscape`);
            resolve({ width: 1280, height: 720, isPortrait: false });
          }
        } catch (error) {
          console.log(`⚠️ Error parsing ffprobe output: ${error.message}, defaulting to landscape`);
          resolve({ width: 1280, height: 720, isPortrait: false });
        }
      } else {
        console.log(`⚠️ ffprobe failed with code ${code}: ${stderr}, defaulting to landscape`);
        resolve({ width: 1280, height: 720, isPortrait: false });
      }
    });
    
    ffprobe.on('error', (error) => {
      console.log(`⚠️ ffprobe error: ${error.message}, defaulting to landscape`);
      resolve({ width: 1280, height: 720, isPortrait: false });
    });
  });
}

// Generate a single HLS variant
async function generateSingleVariant(inputPath, outputDir, uniquePrefix, streamKey, variant) {
  console.log(`🎥 Generating ${variant.name} variant (${variant.width}x${variant.height})...`);
  
  // Build filter for scaling (no watermark overlay)
  const videoFilter = `[0:v]scale=${variant.width}:${variant.height}:force_original_aspect_ratio=decrease,pad=${variant.width}:${variant.height}:(ow-iw)/2:(oh-ih)/2:color=black[v]`;
  
  const variantArgs = [
    '-i', inputPath,
    '-filter_complex', videoFilter,
    '-map', '[v]',
    '-map', '0:a',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-preset', 'faster', // Optimized for maximum encoding speed
    '-b:v', variant.bitrate,
    '-b:a', variant.audio,
    '-f', 'hls',
    '-hls_time', '6',
    '-hls_list_size', '0',
    '-hls_segment_filename', path.join(outputDir, `${variant.name}_%03d.ts`),
    path.join(outputDir, `${variant.name}.m3u8`)
  ];
  
  await runFFmpeg(variantArgs, outputDir, `${variant.name} variant`);
  
  // Fix the individual variant playlist to use full URLs for .ts segments
  const variantPlaylistPath = path.join(outputDir, `${variant.name}.m3u8`);
  if (fs.existsSync(variantPlaylistPath)) {
    console.log(`🔧 Fixing ${variant.name} playlist URLs...`);
    let playlistContent = fs.readFileSync(variantPlaylistPath, 'utf8');
    
    // Replace relative .ts segment paths with full CloudFront URLs
    playlistContent = playlistContent.replace(
      new RegExp(`${variant.name}_\\d+\\.ts`, 'g'),
      (match) => `https://d4idc5cmwxlpy.cloudfront.net/clips/${streamKey}/${uniquePrefix}_${match}`
    );
    
    fs.writeFileSync(variantPlaylistPath, playlistContent);
    console.log(`✅ Fixed ${variant.name} playlist URLs`);
  }
}

// Upload all files for a specific variant in parallel
async function uploadVariantFiles(outputDir, streamKey, uniquePrefix, variantName) {
  const files = fs.readdirSync(outputDir).filter(file => 
    (file.endsWith('.m3u8') && file.startsWith(variantName)) ||
    (file.endsWith('.ts') && file.startsWith(variantName))
  );
  
  console.log(`📤 Uploading ${files.length} files for ${variantName} variant in parallel...`);
  
  const uploadPromises = files.map(file => {
    const filePath = path.join(outputDir, file);
    const fileKey = `clips/${streamKey}/${uniquePrefix}_${file}`;
    
    return outputS3Client.send(new PutObjectCommand({
      Bucket: OUTPUT_BUCKET,
      Key: fileKey,
      Body: fs.readFileSync(filePath),
      ContentType: file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t'
    })).then(() => {
      console.log(`✅ ${file} uploaded successfully`);
    }).catch(error => {
      console.error(`❌ Error uploading ${file}:`, error);
      throw error;
    });
  });
  
  await Promise.all(uploadPromises);
  console.log(`✅ All ${variantName} variant files uploaded in parallel`);
}

// Create master playlist content
function createMasterPlaylist(variants, streamKey, uniquePrefix) {
  let masterContent = '#EXTM3U\n#EXT-X-VERSION:3\n\n';
  
  for (const variant of variants) {
    const bandwidth = parseInt(variant.bitrate.replace('k', '')) * 1000;
    const resolution = `${variant.width}x${variant.height}`;
    const variantS3Url = `https://d4idc5cmwxlpy.cloudfront.net/clips/${streamKey}/${uniquePrefix}_${variant.name}.m3u8`;
    masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution}\n`;
    masterContent += `${variantS3Url}\n\n`;
  }
  
  return masterContent;
}

// Helper function to run FFmpeg
async function runFFmpeg(args, cwd, description) {
  return new Promise((resolve, reject) => {
    console.log(`🎥 Running FFmpeg for ${description}...`);
    console.log(`📝 Command: ${FFMPEG_PATH} ${args.join(' ')}`);
    
    const ffmpeg = spawn(FFMPEG_PATH, args, {
      cwd: cwd,
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
        console.log(`✅ FFmpeg ${description} completed successfully`);
        resolve();
      } else {
        console.error(`❌ FFmpeg ${description} failed with code ${code}`);
        console.error(`📝 FFmpeg stderr: ${stderr}`);
        reject(new Error(`FFmpeg ${description} failed with code ${code}`));
      }
    });
    
    ffmpeg.on('error', (error) => {
      console.error(`❌ FFmpeg error:`, error);
      reject(error);
    });
  });
}

// Generate thumbnail
async function generateThumbnail(inputPath, uniquePrefix, streamKey) {
  return new Promise((resolve, reject) => {
    const thumbnailPath = `/tmp/${uniquePrefix}_thumb.jpg`;
    
    // FFmpeg command to generate thumbnail (use layer path)
    const ffmpegArgs = [
      '-i', inputPath,
      '-ss', '00:00:05', // Take thumbnail at 5 seconds
      '-vframes', '1',
      '-q:v', '2',
      thumbnailPath
    ];
    
    console.log(`🎥 Running FFmpeg for thumbnail generation...`);
    console.log(`📝 Command: ${FFMPEG_PATH} ${ffmpegArgs.join(' ')}`);
    
    const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs, {
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
        console.log(`✅ Thumbnail generated successfully`);
        
        // Upload thumbnail to theprivatecollection
        const thumbnailKey = `clips/${streamKey}/${uniquePrefix}_thumb.jpg`;
        
        console.log(`📤 Uploading thumbnail: s3://${OUTPUT_BUCKET}/${thumbnailKey}`);
        
        try {
          const putThumbnailCommand = new PutObjectCommand({
            Bucket: OUTPUT_BUCKET,
            Key: thumbnailKey,
            Body: fs.readFileSync(thumbnailPath),
            ContentType: 'image/jpeg'
          });
          
          await outputS3Client.send(putThumbnailCommand);
          console.log(`✅ Thumbnail uploaded successfully`);
          
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
      console.error(`❌ FFmpeg error:`, error);
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