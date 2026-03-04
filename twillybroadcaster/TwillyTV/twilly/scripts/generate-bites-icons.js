const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'bites');
const PRIMARY_COLOR = '#FF6B6B'; // Appetizing red
const SECONDARY_COLOR = '#4ECDC4'; // Fresh mint

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
            <linearGradient id="plateGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#F0F0F0;stop-opacity:1" />
            </linearGradient>
            <filter id="shadow">
                <feDropShadow dx="2" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.2"/>
            </filter>
            <clipPath id="plateMask">
                <circle cx="${size/2}" cy="${size/2}" r="${size/2.5}" />
            </clipPath>
        </defs>
        
        <!-- Main circle (plate) -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" 
                fill="#FFFFFF"
                filter="url(#shadow)" />
                
        <!-- Plate rim detail -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.3}" 
                fill="none"
                stroke="${PRIMARY_COLOR}"
                stroke-width="${size/40}" />
                
        <!-- Plate inner circle -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.5}" 
                fill="url(#plateGrad)" />

        <!-- Fork design -->
        <g transform="translate(${size/2.8}, ${size/2}) rotate(-45)">
            <rect x="${-size/30}" y="${-size/4}" 
                  width="${size/15}" height="${size/2}"
                  fill="${PRIMARY_COLOR}"
                  rx="${size/60}" />
            <rect x="${-size/30}" y="${-size/4}" 
                  width="${size/15}" height="${size/6}"
                  fill="${PRIMARY_COLOR}"
                  rx="${size/60}" />
            <!-- Fork tines -->
            <rect x="${-size/25}" y="${-size/4}" 
                  width="${size/60}" height="${size/6}"
                  fill="${PRIMARY_COLOR}"
                  rx="${size/120}" />
            <rect x="${0}" y="${-size/4}" 
                  width="${size/60}" height="${size/6}"
                  fill="${PRIMARY_COLOR}"
                  rx="${size/120}" />
            <rect x="${size/25}" y="${-size/4}" 
                  width="${size/60}" height="${size/6}"
                  fill="${PRIMARY_COLOR}"
                  rx="${size/120}" />
        </g>

        <!-- Camera lens/plate hybrid -->
        <g transform="translate(${size/1.6}, ${size/2}) rotate(45)">
            <circle cx="0" cy="0" r="${size/8}" 
                    fill="${SECONDARY_COLOR}"
                    stroke="#FFF"
                    stroke-width="${size/40}" />
            <circle cx="0" cy="0" r="${size/12}" 
                    fill="none"
                    stroke="#FFF"
                    stroke-width="${size/80}" />
            <circle cx="0" cy="0" r="${size/20}" 
                    fill="#FFF" />
        </g>

        <!-- Steam lines -->
        <g transform="translate(${size/2}, ${size/3})">
            <path d="M${-size/8},0 q${size/16},${-size/8} 0,0" 
                  stroke="${SECONDARY_COLOR}"
                  stroke-width="${size/40}"
                  fill="none" />
            <path d="M0,${-size/20} q${size/16},${-size/8} 0,0" 
                  stroke="${SECONDARY_COLOR}"
                  stroke-width="${size/40}"
                  fill="none" />
            <path d="M${size/8},0 q${size/16},${-size/8} 0,0" 
                  stroke="${SECONDARY_COLOR}"
                  stroke-width="${size/40}"
                  fill="none" />
        </g>

        <!-- Text "BITES" -->
        <text x="${size/2}" y="${size/1.3}"
              font-family="Arial Black, Arial, sans-serif" 
              font-weight="900"
              font-size="${size/6}"
              fill="${PRIMARY_COLOR}"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#shadow)">
            BITES
        </text>
    </svg>`;

    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    
    await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
    
    return outputPath;
}

async function main() {
    console.log(gradient.pastel.multiline('\n🍽️ Generating Twilly Bites Icons...\n'));
    
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
