const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'laughtrack');
const BACKGROUND_COLOR = '#2A2A72'; // Deep blue
const ACCENT_COLOR = '#FF4081'; // Bright pink

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
                <stop offset="0%" style="stop-color:#FF4081;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#00E5FF;stop-opacity:1" />
            </linearGradient>
            <filter id="neon">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            <filter id="shadow">
                <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
            </filter>
        </defs>
        
        <!-- Background circle -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" 
                fill="${BACKGROUND_COLOR}" />

        <!-- Retro TV shape -->
        <rect x="${size/6}" y="${size/4}" 
              width="${size/1.5}" height="${size/2}"
              rx="${size/20}" ry="${size/20}"
              fill="none" 
              stroke="url(#grad)"
              stroke-width="${size/40}"
              filter="url(#neon)" />

        <!-- Sound wave lines -->
        <path d="M${size/4},${size/2} 
                 Q${size/3},${size/2.5} ${size/2.5},${size/2}
                 T${size/1.7},${size/2}"
              stroke="${ACCENT_COLOR}"
              stroke-width="${size/40}"
              fill="none"
              filter="url(#neon)" />
              
        <path d="M${size/4},${size/1.8} 
                 Q${size/3},${size/1.6} ${size/2.5},${size/1.8}
                 T${size/1.7},${size/1.8}"
              stroke="#00E5FF"
              stroke-width="${size/40}"
              fill="none"
              filter="url(#neon)" />

        <!-- Microphone icon -->
        <g transform="translate(${size/2}, ${size/2.2}) scale(${size/500})">
            <path d="M-15,-25 h30 v50 h-30 z" 
                  fill="#FFF"
                  filter="url(#shadow)" />
            <rect x="-5" y="25" width="10" height="15" 
                  fill="#FFF" />
            <rect x="-15" y="40" width="30" height="5" 
                  fill="#FFF" />
        </g>

        <!-- Text "LAUGH" -->
        <text x="${size/2}" y="${size/1.45}"
              font-family="Arial Black, Arial, sans-serif" 
              font-weight="900"
              font-size="${size/8}"
              fill="#FFF"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#neon)">
            LAUGH
        </text>

        <!-- Text "TRACK" -->
        <text x="${size/2}" y="${size/1.25}"
              font-family="Arial Black, Arial, sans-serif" 
              font-weight="900"
              font-size="${size/8}"
              fill="url(#grad)"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#neon)">
            TRACK
        </text>
    </svg>`;

    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    
    await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
    
    return outputPath;
}

async function main() {
    console.log(gradient.pastel.multiline('\n🎭 Generating The Laugh Track Icons...\n'));
    
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
