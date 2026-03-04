const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// This script checks for RTMP recording files on the EC2 server
// Run this on the EC2 server to check if recordings exist

async function checkRTMPRecordings() {
  console.log('🔍 Checking for RTMP recording files...\n');
  
  const recordingDirs = ['/var/www/recordings', '/tmp/recordings'];
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  
  console.log('📁 Checking recording directories:\n');
  
  for (const dir of recordingDirs) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Directory: ${dir}`);
    
    if (!fs.existsSync(dir)) {
      console.log(`   ❌ Directory does not exist`);
      continue;
    }
    
    try {
      const files = fs.readdirSync(dir);
      console.log(`   ✅ Found ${files.length} file(s)`);
      
      // Filter for recent files (last 2 hours)
      const recentFiles = files
        .map(file => {
          const filePath = path.join(dir, file);
          try {
            const stats = fs.statSync(filePath);
            return { file, path: filePath, stats };
          } catch (error) {
            return null;
          }
        })
        .filter(item => item !== null)
        .filter(item => {
          const fileTime = item.stats.mtime.getTime();
          return fileTime >= twoHoursAgo;
        })
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
      
      if (recentFiles.length > 0) {
        console.log(`\n   📦 Recent files (last 2 hours): ${recentFiles.length}`);
        recentFiles.slice(0, 10).forEach((item, index) => {
          const minutesAgo = Math.floor((Date.now() - item.stats.mtime.getTime()) / 60000);
          const sizeMB = (item.stats.size / (1024 * 1024)).toFixed(2);
          console.log(`\n   [${index + 1}] ${item.file}`);
          console.log(`       Modified: ${item.stats.mtime.toISOString()} (${minutesAgo} minutes ago)`);
          console.log(`       Size: ${sizeMB} MB`);
          console.log(`       Path: ${item.path}`);
          
          // Check if this might be a 15-minute stream (larger file)
          if (item.stats.size > 50 * 1024 * 1024) { // > 50MB
            console.log(`       ⚠️ Large file - might be 15-minute stream`);
          }
        });
      } else {
        console.log(`   ⚠️ No recent files found in last 2 hours`);
      }
      
      // Also check for FLV files specifically (RTMP recordings)
      const flvFiles = files.filter(f => f.endsWith('.flv'));
      if (flvFiles.length > 0) {
        console.log(`\n   📹 FLV files (RTMP recordings): ${flvFiles.length}`);
        flvFiles.slice(0, 5).forEach((file, index) => {
          const filePath = path.join(dir, file);
          try {
            const stats = fs.statSync(filePath);
            const minutesAgo = Math.floor((Date.now() - stats.mtime.getTime()) / 60000);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`      [${index + 1}] ${file} (${sizeMB} MB, ${minutesAgo} minutes ago)`);
          } catch (error) {
            console.log(`      [${index + 1}] ${file} (error reading stats)`);
          }
        });
      }
      
    } catch (error) {
      console.error(`   ❌ Error reading directory: ${error.message}`);
    }
  }
  
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('💡 Tips:');
  console.log('   - RTMP recordings are typically FLV files');
  console.log('   - Files are created when stream starts and finalized when stream stops');
  console.log('   - If no recent files found, the stream may not have been recorded');
  console.log('   - Check NGINX configuration and streaming service logs');
}

checkRTMPRecordings().catch(console.error);
