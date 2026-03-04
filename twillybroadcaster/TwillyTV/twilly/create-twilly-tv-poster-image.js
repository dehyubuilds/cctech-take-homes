/**
 * Create Twilly TV Poster Image
 * Generates a high-quality Twilly TV logo image for manual upload
 * 
 * Usage: node create-twilly-tv-poster-image.js
 * Output: twilly-tv-poster.png (or .svg if ImageMagick not available)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function generateTwillyTVLogoSVG() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background gradient -->
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#000000;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a26;stop-opacity:1" />
    </linearGradient>
    
    <!-- Twilly brand gradient -->
    <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00D4AA;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#00E5FF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#00D4AA;stop-opacity:1" />
    </linearGradient>
    
    <!-- Glow filter -->
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1920" height="1080" fill="url(#bgGradient)"/>
  
  <!-- Main content area -->
  <g transform="translate(960, 540)">
    <!-- TV Icon Circle Background -->
    <circle cx="0" cy="-80" r="120" fill="url(#brandGradient)" opacity="0.2" filter="url(#glow)"/>
    
    <!-- TV Icon -->
    <g transform="translate(0, -80)">
      <!-- TV Screen -->
      <rect x="-80" y="-50" width="160" height="100" rx="8" fill="url(#brandGradient)" opacity="0.3"/>
      <rect x="-75" y="-45" width="150" height="90" rx="6" fill="#000000"/>
      
      <!-- TV Stand -->
      <rect x="-20" y="50" width="40" height="15" rx="4" fill="url(#brandGradient)"/>
      <rect x="-30" y="65" width="60" height="8" rx="4" fill="url(#brandGradient)"/>
    </g>
    
    <!-- Twilly TV Text -->
    <text x="0" y="120" font-family="Arial, sans-serif" font-size="120" font-weight="900" 
          text-anchor="middle" fill="url(#brandGradient)" filter="url(#glow)">
      Twilly TV
    </text>
    
    <!-- Subtitle -->
    <text x="0" y="200" font-family="Arial, sans-serif" font-size="36" font-weight="600" 
          text-anchor="middle" fill="#888888" letter-spacing="2">
      A Premium streaming network
    </text>
  </g>
  
  <!-- Decorative elements -->
  <circle cx="200" cy="200" r="3" fill="#00E5FF" opacity="0.3"/>
  <circle cx="1720" cy="880" r="3" fill="#00D4AA" opacity="0.3"/>
  <circle cx="150" cy="900" r="2" fill="#00E5FF" opacity="0.2"/>
  <circle cx="1770" cy="180" r="2" fill="#00D4AA" opacity="0.2"/>
</svg>`;
}

function main() {
  const outputDir = __dirname;
  const svgPath = path.join(outputDir, 'twilly-tv-poster.svg');
  const pngPath = path.join(outputDir, 'twilly-tv-poster.png');
  
  console.log('🎨 Creating Twilly TV poster image...');
  
  // Generate SVG
  const svg = generateTwillyTVLogoSVG();
  fs.writeFileSync(svgPath, svg, 'utf8');
  console.log('✅ SVG saved:', svgPath);
  
  // Try to convert to PNG if ImageMagick is available
  try {
    execSync(`which convert`, { stdio: 'ignore' });
    console.log('🔄 Converting to PNG (1920x1080)...');
    execSync(`convert "${svgPath}" -resize 1920x1080 -background none "${pngPath}"`, { stdio: 'inherit' });
    console.log('✅ PNG saved:', pngPath);
    console.log('\n📁 Files ready for upload:');
    console.log(`   - SVG: ${svgPath}`);
    console.log(`   - PNG: ${pngPath}`);
  } catch (error) {
    console.log('⚠️  ImageMagick not available - PNG conversion skipped');
    console.log('💡 You can convert the SVG to PNG using:');
    console.log('   - Online: https://cloudconvert.com/svg-to-png');
    console.log('   - Or install ImageMagick: brew install imagemagick');
    console.log('\n📁 SVG file ready:');
    console.log(`   ${svgPath}`);
  }
  
  console.log('\n📤 Next steps:');
  console.log('1. Upload the image to your web interface');
  console.log('2. Or use the update script:');
  console.log(`   node update-twilly-tv-poster.js --upload "${pngPath || svgPath}"`);
}

main();
