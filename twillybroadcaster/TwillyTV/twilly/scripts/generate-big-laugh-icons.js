const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'big-laugh');
const PRIMARY_COLOR = '#14b8a6'; // Twilly teal
const ACCENT_COLOR = '#F59E0B'; // Amber orange
const HIGHLIGHT_COLOR = '#EC4899'; // Hot pink

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
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#F8FAFC;stop-opacity:1" />
            </linearGradient>
            <filter id="shadow">
                <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.15"/>
            </filter>
        </defs>
        
        <!-- Main background -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" 
                fill="url(#bgGrad)"
                filter="url(#shadow)" />

        <!-- Big laughing emoji face -->
        <g transform="translate(${size/2}, ${size/2})">
            <!-- Left eye (big laughing) -->
            <path d="M${-size/4},${-size/5} 
                     c${size/20},${-size/10} ${size/10},${-size/15} ${size/6},0"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/25}"
                  stroke-linecap="round"
                  fill="none" />
            
            <!-- Right eye (big laughing) -->
            <path d="M${size/4},${-size/5} 
                     c${-size/20},${-size/10} ${-size/10},${-size/15} ${-size/6},0"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/25}"
                  stroke-linecap="round"
                  fill="none" />

            <!-- Big laughing mouth -->
            <path d="M${-size/2.5},${size/6} 
                     C${-size/3},${size/2} 
                      ${size/3},${size/2} 
                      ${size/2.5},${size/6}"
                  fill="${HIGHLIGHT_COLOR}" />

            <!-- Big teeth -->
            ${Array.from({length: 6}, (_, i) => {
                const x = -size/2.5 + (i * size/5);
                return `
                    <rect x="${x - size/20}" y="${size/6}" 
                          width="${size/10}" height="${size/4}"
                          fill="white"
                          rx="${size/40}" />
                `;
            }).join('')}

            <!-- Laugh lines -->
            <path d="M${-size/2},${-size/6} l${-size/8},${-size/8}"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/35}"
                  stroke-linecap="round" />
            <path d="M${size/2},${-size/6} l${size/8},${-size/8}"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/35}"
                  stroke-linecap="round" />
        </g>

        <!-- Energy sparkles -->
        ${Array.from({length: 6}, (_, i) => {
            const angle = (i * 60) * Math.PI / 180;
            const r = size/2.3;
            const x = size/2 + r * Math.cos(angle);
            const y = size/2 + r * Math.sin(angle);
            return `
                <g transform="translate(${x}, ${y})">
                    <path d="M0,${-size/40} l0,${size/20} M${-size/40},0 l${size/20},0"
                          stroke="${PRIMARY_COLOR}"
                          stroke-width="${size/50}"
                          stroke-linecap="round" />
                </g>
            `;
        }).join('')}
    </svg>`;

    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    
    await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
    
    return outputPath;
}

async function main() {
    console.log(gradient.pastel.multiline('\n😂 Generating Big Laugh Icons...\n'));
    
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
