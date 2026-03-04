const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create gradient function
function createGradient(ctx, width, height, startColor, endColor) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, endColor);
  return gradient;
}

// Generate Series Preview Image
function generateSeriesPreview() {
  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bgGradient = createGradient(ctx, width, height, '#084d5d', '#000000');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // Add subtle geometric patterns
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#00d4aa';
  
  // Top left circle
  ctx.beginPath();
  ctx.arc(100, 100, 80, 0, 2 * Math.PI);
  ctx.fill();
  
  // Bottom right circle
  ctx.beginPath();
  ctx.arc(width - 150, height - 100, 60, 0, 2 * Math.PI);
  ctx.fill();
  
  // Center decorative element
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 40, 0, 2 * Math.PI);
  ctx.fill();
  
  ctx.globalAlpha = 1;

  // Primary text: "NEW SERIES"
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NEW SERIES', width / 2, height / 2 - 30);

  // Secondary text: "on Twilly"
  ctx.fillStyle = '#00d4aa';
  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.fillText('on Twilly', width / 2, height / 2 + 30);



  // Series indicators
  ctx.fillStyle = '#00d4aa';
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(150 + i * 100, height - 80, 8, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Save the image
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(__dirname, '../assets/twilly-series-preview.png');
  fs.writeFileSync(outputPath, buffer);
  console.log('✅ Generated: twilly-series-preview.png');
}

// Generate Collaborator Invite Image
function generateCollabInvite() {
  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bgGradient = createGradient(ctx, width, height, '#084d5d', '#000000');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // Add subtle geometric patterns
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#00d4aa';
  
  // Top right circle
  ctx.beginPath();
  ctx.arc(width - 100, 100, 70, 0, 2 * Math.PI);
  ctx.fill();
  
  // Bottom left circle
  ctx.beginPath();
  ctx.arc(150, height - 100, 50, 0, 2 * Math.PI);
  ctx.fill();
  
  // Center decorative element
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 35, 0, 2 * Math.PI);
  ctx.fill();
  
  ctx.globalAlpha = 1;

  // Primary text: "COLLABORATION"
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('COLLABORATION', width / 2, height / 2 - 30);

  // Secondary text: "INVITE"
  ctx.fillStyle = '#00d4aa';
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.fillText('INVITE', width / 2, height / 2 + 30);

  // User/team icons
  ctx.fillStyle = '#00d4aa';
  ctx.globalAlpha = 0.8;
  
  // Draw 3 connected user icons
  const centerX = width / 2;
  const centerY = height / 2 + 80;
  
  for (let i = 0; i < 3; i++) {
    const x = centerX - 80 + i * 80;
    const y = centerY;
    
    // User circle
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, 2 * Math.PI);
    ctx.fill();
    
    // Connection line (except for last user)
    if (i < 2) {
      ctx.strokeStyle = '#00d4aa';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 20, y);
      ctx.lineTo(x + 60, y);
      ctx.stroke();
    }
  }
  
  ctx.globalAlpha = 1;

  // Collaboration indicators
  ctx.fillStyle = '#00d4aa';
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(200 + i * 80, height - 60, 6, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Save the image
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(__dirname, '../assets/twilly-collab-invite.png');
  fs.writeFileSync(outputPath, buffer);
  console.log('✅ Generated: twilly-collab-invite.png');
}

// Main execution
console.log('🎨 Generating Twilly preview images...\n');

try {
  generateSeriesPreview();
  generateCollabInvite();
  
  console.log('\n🎉 All images generated successfully!');
  console.log('📁 Check the assets folder for the new PNG files.');
  
} catch (error) {
  console.error('❌ Error generating images:', error.message);
  process.exit(1);
} 