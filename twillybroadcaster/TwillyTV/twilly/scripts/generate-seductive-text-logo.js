import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('💋 Generating Seductive Text Logo...');
console.log('');

// Create a seductive text-only logo
const createSeductiveTextLogo = () => {
  const svg = `
<svg width="800" height="400" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Dark, mysterious background -->
    <linearGradient id="darkBackground" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f0f23;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#1a0f2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f0f23;stop-opacity:1" />
    </linearGradient>
    
    <!-- Seductive pink gradient -->
    <linearGradient id="seductivePink" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#ec4899;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#be185d;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#9d174d;stop-opacity:1" />
    </linearGradient>
    
    <!-- Gold accent -->
    <linearGradient id="goldAccent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
    </linearGradient>
    
    <!-- Glow effect -->
    <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    
    <!-- Shadow effect -->
    <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="3" dy="3" stdDeviation="2" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="800" height="400" fill="url(#darkBackground)" rx="20"/>
  
  <!-- Decorative top border -->
  <rect x="0" y="0" width="800" height="4" fill="url(#seductivePink)" opacity="0.8"/>
  
  <!-- Main title: MASKED DESIRES -->
  <text x="400" y="140" text-anchor="middle" fill="url(#seductivePink)" 
        font-family="Georgia, serif" font-size="48" font-weight="bold" 
        filter="url(#textGlow)" letter-spacing="2">
    MASKED DESIRES
  </text>
  
  <!-- Subtitle: MISSION UNCUT -->
  <text x="400" y="200" text-anchor="middle" fill="url(#goldAccent)" 
        font-family="Georgia, serif" font-size="36" font-weight="bold" 
        filter="url(#textGlow)" letter-spacing="1">
    MISSION UNCUT
  </text>
  
  <!-- Decorative line -->
  <line x1="200" y1="280" x2="600" y2="280" stroke="url(#seductivePink)" stroke-width="2" opacity="0.6"/>
  
  <!-- Decorative corner elements -->
  <circle cx="50" cy="50" r="8" fill="url(#seductivePink)" opacity="0.6"/>
  <circle cx="750" cy="50" r="8" fill="url(#seductivePink)" opacity="0.6"/>
  <circle cx="50" cy="350" r="8" fill="url(#goldAccent)" opacity="0.6"/>
  <circle cx="750" cy="350" r="8" fill="url(#goldAccent)" opacity="0.6"/>
</svg>
  `;

  const outputPath = path.join(__dirname, '../assets/seductive-text-logo.svg');
  fs.writeFileSync(outputPath, svg);
  console.log('✅ Seductive text logo created: assets/seductive-text-logo.svg');
  
  return outputPath;
};

// Create a more compact, icon-style version
const createCompactTextLogo = () => {
  const svg = `
<svg width="300" height="300" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Dark background -->
    <linearGradient id="compactBackground" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f0f23;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a0f2e;stop-opacity:1" />
    </linearGradient>
    
    <!-- Pink accent -->
    <linearGradient id="compactPink" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#ec4899;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#be185d;stop-opacity:1" />
    </linearGradient>
    
    <!-- Gold accent -->
    <linearGradient id="compactGold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="150" cy="150" r="140" fill="url(#compactBackground)" stroke="url(#compactPink)" stroke-width="3"/>
  
  <!-- Main title: MD -->
  <text x="150" cy="120" text-anchor="middle" fill="url(#compactPink)" 
        font-family="Georgia, serif" font-size="48" font-weight="bold" letter-spacing="2">
    MD
  </text>
  
  <!-- Subtitle: MU -->
  <text x="150" cy="160" text-anchor="middle" fill="url(#compactGold)" 
        font-family="Georgia, serif" font-size="32" font-weight="bold" letter-spacing="1">
    MU
  </text>
  
  <!-- Decorative line -->
  <line x1="100" y1="180" x2="200" y2="180" stroke="url(#compactPink)" stroke-width="1" opacity="0.6"/>
  
  <!-- Bottom text -->
  <text x="150" cy="210" text-anchor="middle" fill="#cbd5e1" 
        font-family="Georgia, serif" font-size="12" font-weight="bold" letter-spacing="1">
    MASKED DESIRES
  </text>
  <text x="150" cy="230" text-anchor="middle" fill="#cbd5e1" 
        font-family="Georgia, serif" font-size="12" font-weight="bold" letter-spacing="1">
    MISSION UNCUT
  </text>
</svg>
  `;

  const outputPath = path.join(__dirname, '../assets/compact-text-logo.svg');
  fs.writeFileSync(outputPath, svg);
  console.log('✅ Compact text logo created: assets/compact-text-logo.svg');
  
  return outputPath;
};

// Create HTML viewer
const createHTMLViewer = (logo1Path, logo2Path) => {
  const logo1Content = fs.readFileSync(logo1Path, 'utf8');
  const logo2Content = fs.readFileSync(logo2Path, 'utf8');
  
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Seductive Text Logo Collection</title>
    <style>
        body { 
            margin: 0; 
            padding: 20px; 
            background: #0f0f23; 
            color: white; 
            font-family: Georgia, serif; 
            text-align: center;
        }
        .container { 
            max-width: 1000px; 
            margin: 0 auto; 
        }
        .logo-section { 
            background: #1a0f2e; 
            border-radius: 20px; 
            padding: 30px; 
            margin: 20px 0; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            border: 2px solid #ec4899;
        }
        .logo-display { 
            width: 100%;
            max-width: 600px;
            height: auto;
            margin: 20px auto;
            display: block;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(236, 72, 153, 0.3);
        }
        .compact-display {
            width: 200px;
            height: 200px;
            margin: 20px auto;
            display: block;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(236, 72, 153, 0.3);
        }
        .download-btn {
            display: inline-block;
            background: linear-gradient(45deg, #ec4899, #be185d);
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: bold;
            margin: 10px;
            transition: all 0.3s;
            border: none;
            cursor: pointer;
        }
        .download-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 25px rgba(236, 72, 153, 0.4);
        }
        .description {
            background: #2d0f3a;
            padding: 20px;
            border-radius: 15px;
            margin: 20px 0;
            border: 1px solid #ec4899;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>💋 Seductive Text Logo Collection</h1>
        <h2>MASKED DESIRES • MISSION UNCUT</h2>
        
        <div class="description">
            <h3>✨ What Makes These Logos Seductive:</h3>
            <ul style="text-align: left; line-height: 1.8;">
                <li><strong>Elegant Typography:</strong> Georgia serif font for sophistication</li>
                <li><strong>Seductive Colors:</strong> Pink gradients with gold accents</li>
                <li><strong>Mysterious Background:</strong> Deep, dark tones for intrigue</li>
                <li><strong>Glowing Effects:</strong> Subtle shadows and highlights</li>
                <li><strong>Clean Design:</strong> No distractions, just pure elegance</li>
            </ul>
        </div>
        
        <!-- Main Logo -->
        <div class="logo-section">
            <h3>🎨 Main Logo (800x400)</h3>
            <p>Full "Masked Desires, Mission Uncut" in seductive typography</p>
            <svg class="logo-display" viewBox="0 0 800 400">
                ${logo1Content}
            </svg>
            
            <div>
                <button onclick="downloadSVG('main-logo', 'seductive-text-logo.svg')" class="download-btn">Download SVG</button>
                <button onclick="downloadPNG('main-logo', 'seductive-text-logo.png', 800, 400)" class="download-btn">Download PNG</button>
            </div>
        </div>
        
        <!-- Compact Version -->
        <div class="logo-section">
            <h3>🔘 Compact Version (300x300)</h3>
            <p>Icon-style with "MD MU" initials and full text below</p>
            <svg class="compact-display" viewBox="0 0 300 300">
                ${logo2Content}
            </svg>
            
            <div>
                <button onclick="downloadSVG('compact', 'compact-text-logo.svg')" class="download-btn">Download SVG</button>
                <button onclick="downloadPNG('compact', 'compact-text-logo.png', 300, 300)" class="download-btn">Download PNG</button>
            </div>
        </div>
        
        <div style="margin-top: 30px; color: #ec4899;">
            <p><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Seductive, mysterious, and ready to use!</strong></p>
        </div>
    </div>
    
    <script>
        function downloadSVG(type, filename) {
            let svgElement;
            if (type === 'main-logo') {
                svgElement = document.querySelector('.logo-section:first-child svg');
            } else {
                svgElement = document.querySelector('.logo-section:last-child svg');
            }
            
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
            const svgUrl = URL.createObjectURL(svgBlob);
            const downloadLink = document.createElement('a');
            downloadLink.href = svgUrl;
            downloadLink.download = filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
        
        function downloadPNG(type, filename, width, height) {
            let svgElement;
            if (type === 'main-logo') {
                svgElement = document.querySelector('.logo-section:first-child svg');
            } else {
                svgElement = document.querySelector('.logo-section:last-child svg');
            }
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = width;
            canvas.height = height;
            
            // Create a data URL from the SVG
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
            const svgUrl = URL.createObjectURL(svgBlob);
            
            const img = new Image();
            img.onload = function() {
                // Clear canvas and draw the image
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to PNG and download
                try {
                    const pngUrl = canvas.toDataURL('image/png');
                    const downloadLink = document.createElement('a');
                    downloadLink.href = pngUrl;
                    downloadLink.download = filename;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    
                    // Clean up
                    URL.revokeObjectURL(svgUrl);
                } catch (error) {
                    console.error('PNG generation failed:', error);
                    alert('PNG generation failed. Please try downloading as SVG instead.');
                }
            };
            
            img.onerror = function() {
                console.error('Failed to load SVG image');
                alert('Failed to generate PNG. Please try downloading as SVG instead.');
                URL.revokeObjectURL(svgUrl);
            };
            
            img.src = svgUrl;
        }
    </script>
</body>
</html>
  `;

  const htmlPath = path.join(__dirname, '../assets/seductive-text-viewer.html');
  fs.writeFileSync(htmlPath, html);
  console.log('🌐 HTML viewer created: assets/seductive-text-viewer.html');
  
  return htmlPath;
};

// Main execution
console.log('💋 Creating seductive text logos...');
const logo1Path = createSeductiveTextLogo();
const logo2Path = createCompactTextLogo();
const htmlPath = createHTMLViewer(logo1Path, logo2Path);

console.log('');
console.log('💋 Your seductive text logos are ready!');
console.log('');
console.log('📁 Files created:');
console.log(`   • ${logo1Path}`);
console.log(`   • ${logo2Path}`);
console.log(`   • ${htmlPath}`);
console.log('');
console.log('🚀 To view and download:');
console.log('1. Open seductive-text-viewer.html in your browser');
console.log('2. Use the download buttons for SVG or PNG');
console.log('3. Choose between main logo or compact version');
console.log('');
console.log('✨ Seductive, mysterious text logos ready!');
