import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎬 Generating "Masked Desires: Mission Uncut" Poster...');
console.log('');

// The enhanced prompt for the poster
const prompt = `A cinematic, high-contrast movie poster featuring five silhouetted women wearing ornate, detailed masks, each in a striking pose that clearly represents their character role: a villain with a dark, menacing stance, a hero with a confident, powerful pose, a temptress with a seductive, alluring position, a rebel with a defiant, rebellious attitude, and a spy with a mysterious, stealthy posture. Dramatic neon lighting in deep purples and rich reds creates intense shadows and highlights. A faint, blurred city skyline appears in the background. The title "Masked Desires: Mission Uncut" is displayed in bold, elegant, cinematic font at the bottom. The overall style is dark, mysterious, and highly cinematic with professional movie poster quality.`;

console.log('📝 Enhanced Prompt:');
console.log(prompt);
console.log('');

// Create an SVG version of the poster as a fallback
const createSVGPoster = () => {
  const svg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Gradients for dramatic lighting -->
    <linearGradient id="backgroundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#0f0f23;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#1a0f2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2d0f3a;stop-opacity:1" />
    </linearGradient>
    
    <!-- Neon purple gradient -->
    <linearGradient id="neonPurple" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#c084fc;stop-opacity:1" />
    </linearGradient>
    
    <!-- Neon red gradient -->
    <linearGradient id="neonRed" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#dc2626;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ef4444;stop-opacity:1" />
    </linearGradient>
    
    <!-- Glow filter -->
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1024" height="1024" fill="url(#backgroundGradient)"/>
  
  <!-- City skyline silhouette -->
  <path d="M 0 800 L 100 750 L 150 780 L 200 720 L 250 760 L 300 700 L 350 740 L 400 680 L 450 720 L 500 660 L 550 700 L 600 640 L 650 680 L 700 620 L 750 660 L 800 600 L 850 640 L 900 580 L 950 620 L 1024 560 L 1024 1024 L 0 1024 Z" fill="#000000" opacity="0.3"/>
  
  <!-- Neon lighting effects -->
  <rect x="0" y="200" width="1024" height="4" fill="url(#neonPurple)" filter="url(#glow)" opacity="0.8"/>
  <rect x="0" y="400" width="1024" height="4" fill="url(#neonRed)" filter="url(#glow)" opacity="0.8"/>
  <rect x="0" y="600" width="1024" height="4" fill="url(#neonPurple)" filter="url(#glow)" opacity="0.8"/>
  
  <!-- Five masked women silhouettes -->
  <!-- Villain (left) -->
  <ellipse cx="150" cy="300" rx="40" ry="60" fill="#000000" opacity="0.8"/>
  <path d="M 130 280 Q 150 260 170 280 Q 150 300 130 280" fill="url(#neonRed)" filter="url(#glow)"/>
  <text x="150" y="380" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="14" font-weight="bold">VILLAIN</text>
  
  <!-- Hero (center-left) -->
  <ellipse cx="300" cy="280" rx="45" ry="65" fill="#000000" opacity="0.8"/>
  <path d="M 280 260 Q 300 240 320 260 Q 300 280 280 260" fill="url(#neonPurple)" filter="url(#glow)"/>
  <text x="300" y="360" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="14" font-weight="bold">HERO</text>
  
  <!-- Temptress (center) -->
  <ellipse cx="512" cy="250" rx="50" ry="70" fill="#000000" opacity="0.8"/>
  <path d="M 492 230 Q 512 210 532 230 Q 512 250 492 230" fill="url(#neonRed)" filter="url(#glow)"/>
  <text x="512" y="330" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="14" font-weight="bold">TEMPTRESS</text>
  
  <!-- Rebel (center-right) -->
  <ellipse cx="724" cy="280" rx="45" ry="65" fill="#000000" opacity="0.8"/>
  <path d="M 704 260 Q 724 240 744 260 Q 724 280 704 260" fill="url(#neonPurple)" filter="url(#glow)"/>
  <text x="724" y="360" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="14" font-weight="bold">REBEL</text>
  
  <!-- Spy (right) -->
  <ellipse cx="874" cy="300" rx="40" ry="60" fill="#000000" opacity="0.8"/>
  <path d="M 854 280 Q 874 260 894 280 Q 874 300 854 280" fill="url(#neonRed)" filter="url(#glow)"/>
  <text x="874" y="380" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="14" font-weight="bold">SPY</text>
  
  <!-- Title -->
  <text x="512" y="900" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="48" font-weight="bold" filter="url(#glow)">
    MASKED DESIRES
  </text>
  <text x="512" y="950" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="32" font-weight="bold" filter="url(#glow)">
    MISSION UNCUT
  </text>
  
  <!-- Subtitle -->
  <text x="512" y="980" text-anchor="middle" fill="#c084fc" font-family="Arial, sans-serif" font-size="18" font-weight="bold">
    A CINEMATIC EXPERIENCE
  </text>
</svg>
  `;

  const outputPath = path.join(__dirname, '../assets/masked-desires-poster.svg');
  fs.writeFileSync(outputPath, svg);
  console.log('✅ SVG poster created: assets/masked-desires-poster.svg');
  
  return outputPath;
};

// Create HTML converter for the SVG
const createHTMLConverter = (svgPath) => {
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Masked Desires: Mission Uncut - Poster</title>
    <style>
        body { 
            margin: 0; 
            padding: 20px; 
            background: #0f0f23; 
            color: white; 
            font-family: Arial, sans-serif; 
            text-align: center;
        }
        .poster-container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: #1a0f2e; 
            border-radius: 20px; 
            padding: 20px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        }
        .poster { 
            width: 100%; 
            max-width: 600px; 
            height: auto; 
            border-radius: 15px; 
            box-shadow: 0 10px 30px rgba(139, 92, 246, 0.3);
        }
        .download-info {
            margin-top: 20px;
            padding: 15px;
            background: #2d0f3a;
            border-radius: 10px;
            border: 2px solid #8b5cf6;
        }
        .download-btn {
            display: inline-block;
            background: linear-gradient(45deg, #8b5cf6, #c084fc);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
            margin: 10px;
            transition: transform 0.2s;
        }
        .download-btn:hover {
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="poster-container">
        <h1>🎬 Masked Desires: Mission Uncut</h1>
        <h2>Cinematic Poster</h2>
        
        <div class="poster">
            ${svgContent}
        </div>
        
        <div class="download-info">
            <h3>💾 Download Your Poster</h3>
            <p>Right-click on the poster above and select "Save image as..."</p>
            <p>Save as: <strong>masked-desires-poster.png</strong></p>
            
            <a href="#" onclick="downloadSVG()" class="download-btn">Download SVG</a>
            <a href="#" onclick="downloadPNG()" class="download-btn">Download PNG</a>
        </div>
        
        <div style="margin-top: 20px; color: #c084fc;">
            <p><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Size:</strong> 1024x1024 pixels</p>
        </div>
    </div>
    
    <script>
        function downloadSVG() {
            const svg = document.querySelector('.poster svg');
            const svgData = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
            const svgUrl = URL.createObjectURL(svgBlob);
            const downloadLink = document.createElement('a');
            downloadLink.href = svgUrl;
            downloadLink.download = 'masked-desires-poster.svg';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
        
        function downloadPNG() {
            const svg = document.querySelector('.poster svg');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            canvas.width = 1024;
            canvas.height = 1024;
            
            img.onload = function() {
                ctx.drawImage(img, 0, 0, 1024, 1024);
                const pngUrl = canvas.toDataURL('image/png');
                const downloadLink = document.createElement('a');
                downloadLink.href = pngUrl;
                downloadLink.download = 'masked-desires-poster.png';
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            };
            
            const svgData = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
            img.src = URL.createObjectURL(svgBlob);
        }
    </script>
</body>
</html>
  `;

  const htmlPath = path.join(__dirname, '../assets/poster-downloader.html');
  fs.writeFileSync(htmlPath, html);
  console.log('🌐 HTML downloader created: assets/poster-downloader.html');
  
  return htmlPath;
};

// Main execution
console.log('🎨 Creating your poster...');
const svgPath = createSVGPoster();
const htmlPath = createHTMLConverter(svgPath);

console.log('');
console.log('🎭 Your "Masked Desires: Mission Uncut" poster has been created!');
console.log('');
console.log('📁 Files created:');
console.log(`   • ${svgPath}`);
console.log(`   • ${htmlPath}`);
console.log('');
console.log('🚀 To get your poster:');
console.log('1. Open poster-downloader.html in your browser');
console.log('2. Use the download buttons to save as SVG or PNG');
console.log('3. Or right-click on the poster and "Save image as..."');
console.log('');
console.log('✨ Your cinematic poster is ready to use!');
