const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'after-dark');
const BACKGROUND_COLOR = '#1a1a1a';
const ACCENT_COLOR = '#ff69b4'; // Hot pink accent

async function ensureOutputDir() {
    try {
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

async function generateIcon(size) {
    const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${ACCENT_COLOR};stop-opacity:0.8" />
                <stop offset="100%" style="stop-color:#800080;stop-opacity:0.9" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        
        <!-- Background circle with gradient -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" 
                fill="${BACKGROUND_COLOR}" />
        
        <!-- Decorative ring -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.4}" 
                stroke="url(#grad)" 
                stroke-width="${size/30}"
                fill="none"
                filter="url(#glow)" />
        
        <!-- Text "AFTER" -->
        <text x="50%" y="42%" 
              font-family="Arial, sans-serif" 
              font-weight="bold"
              font-size="${size/5}"
              fill="${ACCENT_COLOR}"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#glow)">
            AFTER
        </text>

        <!-- Text "DARK" -->
        <text x="50%" y="58%" 
              font-family="Arial, sans-serif" 
              font-weight="bold"
              font-size="${size/5}"
              fill="${ACCENT_COLOR}"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#glow)">
            DARK
        </text>
    </svg>`;

    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    
    await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
    
    return outputPath;
}

async function main() {
    console.log(gradient.pastel.multiline('\n🌙 Generating Twilly After Dark Icons...\n'));
    
    await ensureOutputDir();
    
    for (const size of SIZES) {
        try {
            const outputPath = await generateIcon(size);
            console.log(gradient.rainbow(`✓ Generated ${size}x${size} icon: ${path.basename(outputPath)}`));
        } catch (err) {
            console.error(`❌ Error generating ${size}x${size} icon:`, err);
        }
    }
    
    console.log(gradient.pastel.multiline('\n✨ Icon generation complete!\n'));
}

main().catch(console.error);