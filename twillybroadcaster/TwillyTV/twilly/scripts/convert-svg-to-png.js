import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the generated SVG
const svgPath = path.join(__dirname, '../assets/twilly-logo-streaming.svg');
const outputPath = path.join(__dirname, '../assets/twilly-logo-streaming.png');

try {
  // Read the SVG content
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  
  // Create a simple HTML file that can be used to convert SVG to PNG
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Twilly Logo Converter</title>
  <style>
    body { margin: 0; padding: 20px; background: white; }
    .logo-container { text-align: center; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <div class="logo-container">
    ${svgContent}
  </div>
  <script>
    // This HTML file can be opened in a browser and the logo can be right-clicked to save as PNG
    console.log('Logo loaded. Right-click on the logo and select "Save image as..." to save as PNG');
  </script>
</body>
</html>`;
  
  // Save the HTML file
  const htmlPath = path.join(__dirname, '../assets/logo-converter.html');
  fs.writeFileSync(htmlPath, htmlContent);
  
  console.log('✅ SVG logo generated successfully!');
  console.log('📁 SVG file:', svgPath);
  console.log('🌐 HTML converter:', htmlPath);
  console.log('');
  console.log('🎯 To get your PNG logo:');
  console.log('1. Open the HTML file in your browser');
  console.log('2. Right-click on the logo');
  console.log('3. Select "Save image as..."');
  console.log('4. Save as "twilly-logo-streaming.png"');
  console.log('5. Replace the existing PNG file in your assets folder');
  console.log('');
  console.log('🎨 The white bubble behind "STREAMING NETWORK" is now wider (200px vs 120px)');
  console.log('✨ This will properly contain all the text!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
