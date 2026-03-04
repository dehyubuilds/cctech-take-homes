const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const s3Client = new S3Client({ region: 'us-east-1' });
const OUTPUT_BUCKET = 'twilly';

exports.handler = async (event) => {
  try {
    console.log('=== VIDEO DOWNLOAD CONVERTER LAMBDA STARTED ===');
    console.log('Event:', JSON.stringify(event, null, 2));
    
    const { hlsUrl, fileName, userId } = event;
    
    if (!fileName || !userId || !hlsUrl) {
      throw new Error('Missing required parameters: fileName, userId, hlsUrl');
    }
    
    console.log('Processing HLS stream download for:', { fileName, userId });
    console.log('HLS URL:', hlsUrl);
    
    // Only process HLS streams (files that went through stream process)
    const result = await convertM3u8ToMp4(hlsUrl, fileName, userId);
    
    console.log('=== VIDEO DOWNLOAD CONVERTER LAMBDA COMPLETED ===');
    return result;
    
  } catch (error) {
    console.error('=== ERROR IN VIDEO DOWNLOAD CONVERTER ===');
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw error;
  }
};

// Convert m3u8 to MP4 using ffmpeg
async function convertM3u8ToMp4(hlsUrl, fileName, userId) {
  console.log('Starting m3u8 to MP4 conversion...');
  
  // Generate unique output filename
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9]/g, '_');
  const outputFileName = `${sanitizedFileName}_${timestamp}.mp4`;
  const localOutputPath = `/tmp/${outputFileName}`;
  
  console.log('Output file path:', localOutputPath);
  
  // Check if this is an S3 URL that needs to be downloaded first
  if (hlsUrl.includes('twilly.s3.us-east-1.amazonaws.com')) {
    console.log('S3 m3u8 file detected, downloading first then processing');
    return await convertS3M3u8ToMp4(hlsUrl, outputFileName, localOutputPath, userId);
  } else {
    console.log('CloudFront m3u8 file detected, using FFmpeg directly');
    return await convertDirectM3u8ToMp4(hlsUrl, outputFileName, localOutputPath, userId);
  }
}

// Convert direct m3u8 file to MP4
async function convertDirectM3u8ToMp4(hlsUrl, outputFileName, localOutputPath, userId) {
  return new Promise((resolve, reject) => {
    console.log('Processing direct m3u8 URL with FFmpeg:', hlsUrl);
    
    const ffmpegArgs = [
      '-i', hlsUrl,
      '-c', 'copy',           // Copy streams without re-encoding
      '-bsf:a', 'aac_adtstoasc',  // Convert AAC to MP4 compatible format
      '-movflags', '+faststart',  // Optimize for web playback
      localOutputPath
    ];
    
    console.log(`📝 Command: ffmpeg ${ffmpegArgs.join(' ')}`);
    
    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    ffmpeg.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('FFmpeg progress:', data.toString());
    });
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('FFmpeg progress:', data.toString());
    });
    
    ffmpeg.on('error', (err) => {
      console.error('FFmpeg failed to start:', err);
      reject(new Error(`FFmpeg failed to start: ${err.message}`));
    });
    
    ffmpeg.on('close', async (code) => {
      if (code === 0) {
        console.log(`✅ Direct m3u8 to MP4 conversion completed successfully`);
        
        try {
          // Upload to S3
          const finalS3Key = `downloads/${userId}/${outputFileName}`;
          console.log(`📤 Uploading MP4 to S3: s3://${OUTPUT_BUCKET}/${finalS3Key}`);
          
          const putObjectCommand = new PutObjectCommand({
            Bucket: OUTPUT_BUCKET,
            Key: finalS3Key,
            Body: fs.readFileSync(localOutputPath),
            ContentType: 'video/mp4'
          });
          
          await s3Client.send(putObjectCommand);
          console.log(`✅ MP4 uploaded successfully`);
          
          // Clean up local files
          fs.unlinkSync(localOutputPath);
          
          // Return the download URL
          const downloadUrl = `https://d1bb6cskvno4vp.cloudfront.net/${finalS3Key}`;
          resolve({ success: true, downloadUrl: downloadUrl, message: 'Video converted and uploaded successfully' });
        } catch (uploadError) {
          console.error('Error uploading converted video to S3:', uploadError);
          reject(new Error(`Failed to upload converted video: ${uploadError.message}`));
        }
      } else {
        console.error(`❌ FFmpeg conversion failed with code ${code}`);
        console.error(`📝 FFmpeg stderr: ${stderr}`);
        reject(new Error(`FFmpeg conversion failed with code ${code}`));
      }
    });
  });
}

// Convert HLS stream with segments to MP4
async function convertHlsStreamToMp4(hlsUrl, outputFileName, localOutputPath, userId) {
  return new Promise((resolve, reject) => {
    // Download segments and concatenate them
    downloadM3u8PlaylistFromS3(hlsUrl, localOutputPath, userId, resolve, reject);
  });
}

// Download m3u8 playlist from S3 and process it locally
async function downloadM3u8PlaylistFromS3(hlsUrl, outputPath, userId, resolve, reject) {
  try {
    console.log('Downloading video segments from URL:', hlsUrl);
    
    // Check if it's an S3 URL or CloudFront URL
    let baseUrl, s3Key, basePath;
    
    if (hlsUrl.includes('twilly.s3.us-east-1.amazonaws.com')) {
      // S3 URL - extract S3 key
      baseUrl = 'https://twilly.s3.us-east-1.amazonaws.com/';
      s3Key = hlsUrl.replace(baseUrl, '');
      basePath = s3Key.replace(/\/[^\/]+\.m3u8$/, '');
      console.log('S3 Base path:', basePath);
      
      // Extract the video filename from the path
      const pathParts = basePath.split('/');
      const videoFileName = pathParts[pathParts.length - 1]; // Get the last part (e.g., "IMG_0157.mov")
      console.log('Video filename:', videoFileName);
      
      // Download all .ts segments from S3
      const segments = [];
      let segmentIndex = 1;
      
      while (true) {
        const segmentKey = `${basePath}/${videoFileName}_hls_${segmentIndex.toString().padStart(5, '0')}.ts`;
        console.log(`Trying to download segment: ${segmentKey}`);
        
        try {
          const getSegmentCommand = new GetObjectCommand({
            Bucket: OUTPUT_BUCKET,
            Key: segmentKey
          });
          
          const segmentResponse = await s3Client.send(getSegmentCommand);
          const segmentData = await segmentResponse.Body.transformToByteArray();
          const localSegmentPath = `/tmp/segment_${segmentIndex}.ts`;
          fs.writeFileSync(localSegmentPath, Buffer.from(segmentData));
          
          segments.push(localSegmentPath);
          console.log(`Downloaded segment ${segmentIndex} (${segmentData.length} bytes) to ${localSegmentPath}`);
          segmentIndex++;
        } catch (error) {
          if (error.name === 'NoSuchKey') {
            console.log(`No more segments found at index ${segmentIndex}`);
            break;
          } else {
            throw error;
          }
        }
      }
      
      if (segments.length === 0) {
        throw new Error('No video segments found');
      }
      
      console.log(`Downloaded ${segments.length} segments`);
      
      // Concatenate all segments into a single file
      const concatenatedPath = '/tmp/concatenated.ts';
      const concatenatedStream = fs.createWriteStream(concatenatedPath);
      
      for (const segmentPath of segments) {
        const segmentData = fs.readFileSync(segmentPath);
        concatenatedStream.write(segmentData);
      }
      concatenatedStream.end();
      
      console.log(`Concatenated ${segments.length} segments into: ${concatenatedPath}`);
      
      // Convert the concatenated .ts file to MP4
      console.log('Converting concatenated TS to MP4...');
      const ffmpegArgs = [
        '-i', concatenatedPath,
        '-c', 'copy',           // Copy streams without re-encoding
        '-bsf:a', 'aac_adtstoasc',  // Convert AAC to MP4 compatible format
        '-movflags', '+faststart',  // Optimize for web playback
        outputPath
      ];
      
      console.log(`📝 Command: ffmpeg ${ffmpegArgs.join(' ')}`);
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      ffmpeg.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('FFmpeg progress:', data.toString());
      });
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('FFmpeg progress:', data.toString());
      });
      
      ffmpeg.on('error', (err) => {
        console.error('FFmpeg failed to start:', err);
        reject(new Error(`FFmpeg failed to start: ${err.message}`));
      });
      
      ffmpeg.on('close', async (code) => {
        if (code === 0) {
          console.log(`✅ Video to MP4 conversion completed successfully`);
          
          try {
            // Upload to S3
            const fileName = outputPath.split('/').pop();
            const finalS3Key = `downloads/${userId}/${fileName}`;
            console.log(`📤 Uploading MP4 to S3: s3://${OUTPUT_BUCKET}/${finalS3Key}`);
            
            const putObjectCommand = new PutObjectCommand({
              Bucket: OUTPUT_BUCKET,
              Key: finalS3Key,
              Body: fs.readFileSync(outputPath),
              ContentType: 'video/mp4'
            });
            
            await s3Client.send(putObjectCommand);
            console.log(`✅ MP4 uploaded successfully`);
            
            // Clean up local files
            fs.unlinkSync(outputPath);
            fs.unlinkSync(concatenatedPath);
            
            // Clean up segment files
            for (const segmentPath of segments) {
              try {
                fs.unlinkSync(segmentPath);
              } catch (error) {
                console.log(`Could not clean up ${segmentPath}:`, error);
              }
            }
            
            // Return the download URL
            const downloadUrl = `https://d1bb6cskvno4vp.cloudfront.net/${finalS3Key}`;
            resolve({ success: true, downloadUrl: downloadUrl, message: 'Video converted and uploaded successfully' });
          } catch (uploadError) {
            console.error('Error uploading converted video to S3:', uploadError);
            reject(new Error(`Failed to upload converted video: ${uploadError.message}`));
          }
        } else {
          console.error(`❌ FFmpeg conversion failed with code ${code}`);
          console.error(`📝 FFmpeg stderr: ${stderr}`);
          reject(new Error(`FFmpeg conversion failed with code ${code}`));
        }
      });
      
    } else {
      // CloudFront URL - use FFmpeg directly on the m3u8 URL
      console.log('Processing CloudFront m3u8 URL directly with FFmpeg...');
      
      const ffmpegArgs = [
        '-i', hlsUrl,
        '-c', 'copy',           // Copy streams without re-encoding
        '-bsf:a', 'aac_adtstoasc',  // Convert AAC to MP4 compatible format
        '-movflags', '+faststart',  // Optimize for web playback
        outputPath
      ];
      
      console.log(`📝 Command: ffmpeg ${ffmpegArgs.join(' ')}`);
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      ffmpeg.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('FFmpeg progress:', data.toString());
      });
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('FFmpeg progress:', data.toString());
      });
      
      ffmpeg.on('error', (err) => {
        console.error('FFmpeg failed to start:', err);
        reject(new Error(`FFmpeg failed to start: ${err.message}`));
      });
      
      ffmpeg.on('close', async (code) => {
        if (code === 0) {
          console.log(`✅ Video to MP4 conversion completed successfully`);
          
          try {
            // Upload to S3
            const fileName = outputPath.split('/').pop();
            const finalS3Key = `downloads/${userId}/${fileName}`;
            console.log(`📤 Uploading MP4 to S3: s3://${OUTPUT_BUCKET}/${finalS3Key}`);
            
            const putObjectCommand = new PutObjectCommand({
              Bucket: OUTPUT_BUCKET,
              Key: finalS3Key,
              Body: fs.readFileSync(outputPath),
              ContentType: 'video/mp4'
            });
            
            await s3Client.send(putObjectCommand);
            console.log(`✅ MP4 uploaded successfully`);
            
            // Clean up local files
            fs.unlinkSync(outputPath);
            
            // Return the download URL
            const downloadUrl = `https://d1bb6cskvno4vp.cloudfront.net/${finalS3Key}`;
            resolve({ success: true, downloadUrl: downloadUrl, message: 'Video converted and uploaded successfully' });
          } catch (uploadError) {
            console.error('Error uploading converted video to S3:', uploadError);
            reject(new Error(`Failed to upload converted video: ${uploadError.message}`));
          }
        } else {
          console.error(`❌ FFmpeg conversion failed with code ${code}`);
          console.error(`📝 FFmpeg stderr: ${stderr}`);
          reject(new Error(`FFmpeg conversion failed with code ${code}`));
        }
      });
    }
    
  } catch (error) {
    console.error('Error downloading video segments:', error);
    reject(new Error(`Failed to download video segments: ${error.message}`));
  }
}

// Extract S3 key from m3u8 URL
function extractS3KeyFromM3u8Url(m3u8Url) {
  // Example: https://twilly.s3.us-east-1.amazonaws.com/dehyu.sinyan@gmail.com/videos/hls/IMG_0162.mov/IMG_0162.m3u8
  // Extract: dehyu.sinyan@gmail.com/videos/IMG_0162.mov
  
  // Remove the base URL to get the path
  const baseUrl = 'https://twilly.s3.us-east-1.amazonaws.com/';
  const path = m3u8Url.replace(baseUrl, '');
  
  // Split by '/' to get path components
  const pathParts = path.split('/');
  
  // The structure is: userEmail/videos/hls/filename/filename.m3u8
  // We want: userEmail/videos/filename (for original video) or userEmail/videos/hls/filename/filename.m3u8 (for playlist)
  // For original video, we need to go up one level from the m3u8 file and remove the hls/ part
  if (pathParts.length >= 4) {
    const userEmail = pathParts[0]; // dehyu.sinyan@gmail.com
    const originalFileNameWithExt = pathParts[3]; // IMG_0162.mov
    
    return `${userEmail}/videos/${originalFileNameWithExt}`;
  }
  
  throw new Error(`Invalid m3u8 URL format for original file extraction: ${m3u8Url}`);
}

// Download video file from S3
async function downloadVideoFromS3(s3Key, fileName) {
  console.log(`📥 Downloading video from S3: s3://${OUTPUT_BUCKET}/${s3Key}`);
  
  try {
    const getObjectCommand = new GetObjectCommand({
      Bucket: OUTPUT_BUCKET,
      Key: s3Key
    });
    
    const response = await s3Client.send(getObjectCommand);
    const videoData = await response.Body.transformToByteArray();
    console.log('S3 download successful, size:', videoData.length);
    
    // Save to local file
    const localPath = `/tmp/${fileName}`;
    fs.writeFileSync(localPath, Buffer.from(videoData));
    console.log('Video saved to local path:', localPath);
    
    return localPath;
  } catch (error) {
    console.error('Error downloading from S3:', error);
    throw new Error(`Failed to download video from S3: ${error.message}`);
  }
}

