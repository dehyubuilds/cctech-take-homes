import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the SVG content
const svgPath = path.join(__dirname, '../assets/twilly-logo-streaming.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

// Create HTML file for 192x192 PNG
const html192 = `
<!DOCTYPE html>
<html>
<head>
    <title>Twilly Logo 192x192</title>
    <style>
        body { margin: 0; padding: 20px; background: #f0f0f0; }
        .logo-container { 
            width: 192px; 
            height: 192px; 
            margin: 0 auto;
            background: white;
            border-radius: 50%;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .logo-container svg {
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <div class="logo-container">
        ${svgContent}
    </div>
    <div style="text-align: center; margin-top: 20px; font-family: Arial, sans-serif;">
        <h3>Twilly Logo - 192x192</h3>
        <p>Right-click on the logo above and select "Save image as..."</p>
        <p>Save as: <strong>twilly-logo-streaming-192.png</strong></p>
        <p>Replace the existing file in your assets folder</p>
    </div>
</body>
</html>
`;

// Create HTML file for full size PNG
const htmlFull = `
<!DOCTYPE html>
<html>
<head>
    <title>Twilly Logo Full Size</title>
    <style>
        body { margin: 0; padding: 20px; background: #f0f0f0; }
        .logo-container { 
            width: 400px; 
            height: 400px; 
            margin: 0 auto;
            background: white;
            border-radius: 50%;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .logo-container svg {
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <div class="logo-container">
        ${svgContent}
    </div>
    <div style="text-align: center; margin-top: 20px; font-family: Arial, sans-serif;">
        <h3>Twilly Logo - Full Size (400x400)</h3>
        <p>Right-click on the logo above and select "Save image as..."</p>
        <p>Save as: <strong>twilly-logo-streaming.png</strong></p>
        <p>Replace the existing file in your assets folder</p>
    </div>
</body>
</html>
`;

// Write the HTML files
const html192Path = path.join(__dirname, '../assets/logo-192-converter.html');
const htmlFullPath = path.join(__dirname, '../assets/logo-full-converter.html');

fs.writeFileSync(html192Path, html192);
fs.writeFileSync(htmlFullPath, htmlFull);

console.log('✅ PNG converter files created!');
console.log('📁 192x192 converter: assets/logo-192-converter.html');
console.log('📁 Full size converter: assets/logo-full-converter.html');
console.log('');
console.log('🎯 To get your PNG files:');
console.log('1. Open logo-192-converter.html in your browser');
console.log('2. Right-click on the logo and "Save image as..."');
console.log('3. Save as "twilly-logo-streaming-192.png"');
console.log('4. Open logo-full-converter.html in your browser');
console.log('5. Right-click on the logo and "Save image as..."');
console.log('6. Save as "twilly-logo-streaming.png"');
console.log('7. Replace both existing PNG files in your assets folder');
console.log('');
console.log('✨ The new logo features:');
console.log('   - Softer blue gradient background');
console.log('   - Properly sized white bubble for "STREAMING NETWORK"');
console.log('   - Background waves behind the sound waves');
console.log('   - All the original styling and elements');
