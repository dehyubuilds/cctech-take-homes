const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create a 1920x1080 poster (16:9 aspect ratio)
const width = 1920;
const height = 1080;

const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Create gradient background - happy hour vibes (warm sunset colors)
const gradient = ctx.createLinearGradient(0, 0, width, height);
gradient.addColorStop(0, '#FF6B35'); // Warm orange
gradient.addColorStop(0.3, '#F7931E'); // Golden orange
gradient.addColorStop(0.6, '#FFD23F'); // Bright yellow
gradient.addColorStop(1, '#FF6B9D'); // Pink accent
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);

// Add some texture/overlay for depth
ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
for (let i = 0; i < 50; i++) {
  const x = Math.random() * width;
  const y = Math.random() * height;
  const radius = Math.random() * 100 + 50;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// Draw regular hard shell taco
function drawHardShellTaco(ctx, centerX, centerY) {
  // Add shadow for depth
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 25;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 15;
  
  // Draw hard shell taco (U-shaped crispy shell)
  // Left shell half
  ctx.beginPath();
  ctx.ellipse(centerX - 150, centerY, 180, 280, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#D4A574'; // Golden brown shell
  ctx.fill();
  
  // Right shell half
  ctx.beginPath();
  ctx.ellipse(centerX + 150, centerY, 180, 280, 0.3, 0, Math.PI * 2);
  ctx.fill();
  
  // Shell highlights for 3D effect
  ctx.fillStyle = '#F4C2A1';
  ctx.beginPath();
  ctx.ellipse(centerX - 100, centerY - 80, 100, 150, -0.3, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.beginPath();
  ctx.ellipse(centerX + 100, centerY - 80, 100, 150, 0.3, 0, Math.PI * 2);
  ctx.fill();
  
  // Reset shadow for fillings
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Simple fillings visible from the top
  // Ground meat (brown)
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY - 50, 200, 120, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Shredded lettuce (green)
  ctx.fillStyle = '#7CB342';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + 20, 220, 140, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Shredded cheese (yellow)
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY - 10, 180, 100, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Sour cream drizzle (white)
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(centerX - 120, centerY - 20);
  ctx.quadraticCurveTo(centerX - 40, centerY, centerX, centerY + 10);
  ctx.quadraticCurveTo(centerX + 40, centerY + 20, centerX + 120, centerY + 30);
  ctx.stroke();
  
  console.log('✅ Hard shell taco drawn');
}

// Create poster
function createPoster() {
  const centerX = width / 2;
  const centerY = height / 2 - 20; // Moved taco up slightly
  
  // Draw the hard shell taco
  drawHardShellTaco(ctx, centerX, centerY);

  // Add "Taco Tuesdays" text - split into two lines
  ctx.fillStyle = '#000000'; // Black text
  ctx.strokeStyle = '#FFFFFF'; // White outline
  ctx.lineWidth = 6;
  ctx.font = 'bold 80px Arial'; // Reduced from 120px to 80px
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // First line: "TACO"
  const text1 = 'TACO';
  const text1Y = centerY + 380; // Moved up from 500

  ctx.strokeText(text1, centerX, text1Y);
  ctx.fillText(text1, centerX, text1Y);

  // Second line: "TUESDAYS"
  const text2 = 'TUESDAYS';
  const text2Y = text1Y + 90; // Space between lines

  ctx.strokeText(text2, centerX, text2Y);
  ctx.fillText(text2, centerX, text2Y);

  // Add subtitle
  ctx.font = 'bold 36px Arial'; // Reduced from 48px to 36px
  ctx.fillStyle = '#FFD700';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  const subtitle = 'IRL Stream Series';
  ctx.strokeText(subtitle, centerX, text2Y + 70); // Adjusted spacing
  ctx.fillText(subtitle, centerX, text2Y + 70);

  // Add some sparkle/glow effects
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 4 + 2;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Add border glow
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, width, height);

  // Save the image
  const outputPath = path.join(__dirname, '../public/assets/channels/taco-tuesdays-poster.png');
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);

  console.log('✅ Taco Tuesdays poster created at:', outputPath);
  console.log('📐 Dimensions: 1920x1080 (16:9)');
  console.log('🎨 Ready to upload as channel poster!');
}

// Run the function
createPoster();

