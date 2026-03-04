/**
 * Create Visibility Logos for Twilly TV
 * Generates two distinct logos: one with open eye (public) and one with closed eye (private)
 * 
 * Usage: node create-visibility-logos.js
 * Output: twilly-tv-public.svg and twilly-tv-private.svg
 */

const fs = require('fs');
const path = require('path');

function generatePublicLogo() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00D4AA;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#00E5FF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#00D4AA;stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background circle -->
  <circle cx="100" cy="100" r="90" fill="url(#brandGradient)" opacity="0.15"/>
  
  <!-- Open Eye -->
  <g transform="translate(100, 100)">
    <!-- Eye shape (open) -->
    <ellipse cx="0" cy="0" rx="50" ry="30" fill="url(#brandGradient)" filter="url(#glow)"/>
    <ellipse cx="0" cy="0" rx="45" ry="27" fill="#000000"/>
    <!-- Pupil -->
    <circle cx="0" cy="0" r="15" fill="url(#brandGradient)"/>
    <circle cx="0" cy="0" r="8" fill="#000000"/>
    <!-- Highlight -->
    <circle cx="-5" cy="-5" r="4" fill="#ffffff" opacity="0.8"/>
  </g>
</svg>`;
}

function generatePrivateLogo() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#FF9500;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#FF6B00;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FF9500;stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background circle -->
  <circle cx="100" cy="100" r="90" fill="url(#brandGradient)" opacity="0.15"/>
  
  <!-- Closed Eye -->
  <g transform="translate(100, 100)">
    <!-- Eye shape (closed) - horizontal line with slight curve -->
    <path d="M -50 0 Q 0 -15 50 0 Q 0 15 -50 0" 
          fill="url(#brandGradient)" 
          filter="url(#glow)"
          stroke="url(#brandGradient)" 
          stroke-width="3"/>
    <!-- Eyelashes on left -->
    <line x1="-45" y1="-8" x2="-50" y2="-15" stroke="url(#brandGradient)" stroke-width="2" stroke-linecap="round"/>
    <line x1="-40" y1="-5" x2="-42" y2="-12" stroke="url(#brandGradient)" stroke-width="2" stroke-linecap="round"/>
    <line x1="-45" y1="8" x2="-50" y2="15" stroke="url(#brandGradient)" stroke-width="2" stroke-linecap="round"/>
    <line x1="-40" y1="5" x2="-42" y2="12" stroke="url(#brandGradient)" stroke-width="2" stroke-linecap="round"/>
    <!-- Eyelashes on right -->
    <line x1="45" y1="-8" x2="50" y2="-15" stroke="url(#brandGradient)" stroke-width="2" stroke-linecap="round"/>
    <line x1="40" y1="-5" x2="42" y2="-12" stroke="url(#brandGradient)" stroke-width="2" stroke-linecap="round"/>
    <line x1="45" y1="8" x2="50" y2="15" stroke="url(#brandGradient)" stroke-width="2" stroke-linecap="round"/>
    <line x1="40" y1="5" x2="42" y2="12" stroke="url(#brandGradient)" stroke-width="2" stroke-linecap="round"/>
  </g>
</svg>`;
}

function main() {
  const outputDir = __dirname;
  const publicPath = path.join(outputDir, 'twilly-tv-public-logo.svg');
  const privatePath = path.join(outputDir, 'twilly-tv-private-logo.svg');
  
  console.log('🎨 Creating visibility logos...');
  
  // Generate public logo (open eye)
  const publicSVG = generatePublicLogo();
  fs.writeFileSync(publicPath, publicSVG, 'utf8');
  console.log('✅ Public logo (open eye) saved:', publicPath);
  
  // Generate private logo (closed eye)
  const privateSVG = generatePrivateLogo();
  fs.writeFileSync(privatePath, privateSVG, 'utf8');
  console.log('✅ Private logo (closed eye) saved:', privatePath);
  
  console.log('\n📁 Logo files ready:');
  console.log(`   - Public: ${publicPath}`);
  console.log(`   - Private: ${privatePath}`);
  console.log('\n💡 These can be converted to PNG and added to Xcode Assets if needed');
}

main();
