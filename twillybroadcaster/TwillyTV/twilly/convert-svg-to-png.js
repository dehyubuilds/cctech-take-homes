#!/usr/bin/env node

/**
 * Convert SVG to PNG for app icon
 * Uses sharp library for conversion
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function convertSvgToPng() {
  try {
    const svgPath = '/Users/dehsin365/Desktop/twilly-tv-poster.svg';
    const outputPath = '/Users/dehsin365/Desktop/twilly-tv-poster-icon.png';
    
    // Read SVG file
    const svgBuffer = await fs.readFile(svgPath);
    
    // Convert to PNG at 1024x1024 (app icon size)
    // First, we need to render the SVG to a buffer
    // Since sharp can handle SVG, we'll use it directly
    await sharp(svgBuffer)
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 1 } // Black background
      })
      .png()
      .toFile(outputPath);
    
    console.log(`✅ Converted SVG to PNG: ${outputPath}`);
    console.log(`   Size: 1024x1024 pixels`);
    
    // Also create a square version (crop center)
    const squarePath = '/Users/dehsin365/Desktop/twilly-tv-poster-icon-square.png';
    await sharp(svgBuffer)
      .resize(1024, 1024, {
        fit: 'cover',
        position: 'center',
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      })
      .png()
      .toFile(squarePath);
    
    console.log(`✅ Created square version: ${squarePath}`);
    
  } catch (error) {
    console.error('❌ Error converting SVG to PNG:', error);
    console.error('\n💡 Alternative: Use an online tool like:');
    console.error('   - https://convertio.co/svg-png/');
    console.error('   - https://cloudconvert.com/svg-to-png');
    console.error('\n   Or use macOS Preview:');
    console.error('   1. Open SVG in Preview');
    console.error('   2. File > Export');
    console.error('   3. Format: PNG');
    console.error('   4. Resolution: 1024x1024');
    process.exit(1);
  }
}

convertSvgToPng();
