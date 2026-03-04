/**
 * Generate Twilly TV Logo Image
 * Creates a professional Twilly TV logo image that can be used as a channel poster
 * 
 * Usage: node generate-twilly-tv-logo.js [output-path]
 * Default output: twilly-tv-logo.png
 */

const fs = require('fs');
const path = require('path');

// For Node.js, we'll create an SVG that can be converted to PNG
// Or we can use a simple approach with canvas if available
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
  
  <!-- Subtle grid pattern for depth -->
  <defs>
    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.05"/>
    </pattern>
  </defs>
  <rect width="1920" height="1080" fill="url(#grid)"/>
  
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

// Main function
function main() {
  const outputPath = process.argv[2] || path.join(__dirname, 'twilly-tv-logo.svg');
  const outputDir = path.dirname(outputPath);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Generate SVG
  const svg = generateTwillyTVLogoSVG();
  
  // Write to file
  fs.writeFileSync(outputPath, svg, 'utf8');
  
  console.log('✅ Twilly TV logo generated successfully!');
  console.log(`📁 Output: ${outputPath}`);
  console.log('');
  console.log('📝 Next steps:');
  console.log('1. Convert SVG to PNG (1920x1080) using an online tool or ImageMagick:');
  console.log('   convert twilly-tv-logo.svg -resize 1920x1080 twilly-tv-logo.png');
  console.log('');
  console.log('2. Upload to S3:');
  console.log('   - Bucket: twillyinputbucket');
  console.log('   - Path: public/series-posters/dehyu.sinyan@gmail.com/Twilly TV/poster.png');
  console.log('');
  console.log('3. Update poster via API:');
  console.log('   node update-twilly-tv-poster.js "https://d26k8mraabzpiy.cloudfront.net/public/series-posters/dehyu.sinyan@gmail.com/Twilly%20TV/poster.png"');
}

if (require.main === module) {
  main();
}

module.exports = { generateTwillyTVLogoSVG };
