const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create a 1200x630 canvas (standard OG image size)
const canvas = createCanvas(1200, 630);
const ctx = canvas.getContext('2d');

// Create gradient background
const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
gradient.addColorStop(0, '#084d5d'); // Dark teal
gradient.addColorStop(1, '#000000'); // Black
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 1200, 630);

// Add some subtle pattern overlay
ctx.fillStyle = 'rgba(20, 184, 166, 0.1)'; // Teal with low opacity
for (let i = 0; i < 20; i++) {
  const x = Math.random() * 1200;
  const y = Math.random() * 630;
  const size = Math.random() * 100 + 50;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
}

// Main title "Twilly" with gradient
const titleGradient = ctx.createLinearGradient(200, 200, 1000, 200);
titleGradient.addColorStop(0, '#14b8a6'); // Teal
titleGradient.addColorStop(0.5, '#06b6d4'); // Cyan
titleGradient.addColorStop(1, '#14b8a6'); // Teal

ctx.font = 'bold 120px Arial, sans-serif';
ctx.fillStyle = titleGradient;
ctx.textAlign = 'center';
ctx.fillText('Twilly', 600, 280);

// Subtitle "Collaborative Streaming Network"
ctx.font = 'bold 48px Arial, sans-serif';
ctx.fillStyle = '#14b8a6'; // Teal
ctx.fillText('Collaborative Streaming Network', 600, 350);

// Add streaming icons/visual elements
ctx.fillStyle = 'rgba(20, 184, 166, 0.3)';

// Play button icons
for (let i = 0; i < 6; i++) {
  const x = 200 + (i * 160);
  const y = 420;
  const size = 40;
  
  // Draw play button
  ctx.beginPath();
  ctx.moveTo(x, y - size/2);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size/2);
  ctx.closePath();
  ctx.fill();
}

// Add some connection lines to represent collaboration
ctx.strokeStyle = 'rgba(20, 184, 166, 0.4)';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(240, 420);
ctx.lineTo(360, 420);
ctx.moveTo(520, 420);
ctx.lineTo(640, 420);
ctx.moveTo(800, 420);
ctx.lineTo(920, 420);
ctx.stroke();

// Add small people silhouettes to represent collaboration
ctx.fillStyle = 'rgba(20, 184, 166, 0.6)';
for (let i = 0; i < 3; i++) {
  const x = 300 + (i * 300);
  const y = 500;
  
  // Simple person silhouette
  ctx.beginPath();
  ctx.arc(x, y - 15, 8, 0, Math.PI * 2); // Head
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - 7);
  ctx.lineTo(x, y + 15); // Body
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Arms
  ctx.beginPath();
  ctx.moveTo(x - 12, y);
  ctx.lineTo(x + 12, y);
  ctx.stroke();
}

// Add tagline
ctx.font = '24px Arial, sans-serif';
ctx.fillStyle = '#9ca3af'; // Gray
ctx.fillText('Start/Stop Streaming. No Editing Required.', 600, 580);

// Save the image
const outputPath = path.join(__dirname, '../assets/twilly-og.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);

console.log('✅ New OG image generated successfully!');
console.log(`📁 Saved to: ${outputPath}`);
console.log('🖼️  Image reflects the new collaborative streaming network branding'); 