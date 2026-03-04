const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'laughing-emoji-v3');
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

        <!-- Universal laughing emoji face -->
        <g transform="translate(${size/2}, ${size/2})">
            <!-- Left eye (simple curved line) -->
            <path d="M${-size/4},${-size/6} 
                     q${size/8},${-size/12} ${size/4},0"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/30}"
                  stroke-linecap="round"
                  fill="none" />
            
            <!-- Right eye (simple curved line) -->
            <path d="M${size/4},${-size/6} 
                     q${-size/8},${-size/12} ${-size/4},0"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/30}"
                  stroke-linecap="round"
                  fill="none" />

            <!-- Simple laughing mouth -->
            <path d="M${-size/3},${size/6} 
                     q0,${size/4} ${size/1.5},0"
                  stroke="${HIGHLIGHT_COLOR}"
                  stroke-width="${size/25}"
                  stroke-linecap="round"
                  fill="none" />

            <!-- Simple laugh lines -->
            <path d="M${-size/2.5},${-size/8} l${-size/10},${-size/10}"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/40}"
                  stroke-linecap="round" />
            <path d="M${size/2.5},${-size/8} l${size/10},${-size/10}"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/40}"
                  stroke-linecap="round" />
        </g>

        <!-- Simple sparkles -->
        ${Array.from({length: 4}, (_, i) => {
            const angle = (i * 90) * Math.PI / 180;
            const r = size/2.5;
            const x = size/2 + r * Math.cos(angle);
            const y = size/2 + r * Math.sin(angle);
            return `
                <g transform="translate(${x}, ${y})">
                    <path d="M0,${-size/50} l0,${size/25} M${-size/50},0 l${size/25},0"
                          stroke="${PRIMARY_COLOR}"
                          stroke-width="${size/70}"
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
    console.log(gradient.pastel.multiline('\n😂 Generating Laughing Emoji V3 Icons...\n'));
    
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
