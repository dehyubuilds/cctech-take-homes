import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const convertSvgToPng = async () => {
  try {
    const svgPath = path.join(__dirname, '../assets/twilly-logo-streaming.svg');
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    
    console.log('🔄 Converting SVG to PNG files...');
    
    // Convert to 192x192 PNG
    console.log('📱 Creating 192x192 PNG...');
    await sharp(Buffer.from(svgContent))
      .resize(192, 192)
      .png()
      .toFile(path.join(__dirname, '../assets/twilly-logo-streaming-192.png'));
    
    // Convert to full size PNG (400x400)
    console.log('🖼️ Creating full-size PNG...');
    await sharp(Buffer.from(svgContent))
      .resize(400, 400)
      .png()
      .toFile(path.join(__dirname, '../assets/twilly-logo-streaming.png'));
    
    console.log('✅ Conversion complete!');
    console.log('📁 Files created:');
    console.log('   - assets/twilly-logo-streaming-192.png (192x192)');
    console.log('   - assets/twilly-logo-streaming.png (400x400)');
    console.log('');
    console.log('🎯 Both PNG files are ready to use!');
    
  } catch (error) {
    console.error('❌ Error converting SVG to PNG:', error.message);
    
    if (error.message.includes('sharp')) {
      console.log('');
      console.log('💡 Sharp library not installed. Installing now...');
      console.log('Run: npm install sharp');
    }
  }
};

convertSvgToPng();
