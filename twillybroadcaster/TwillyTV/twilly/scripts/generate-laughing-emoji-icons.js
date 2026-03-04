const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'laughing-emoji');
const PRIMARY_COLOR = '#14b8a6'; // Twilly teal
const ACCENT_COLOR = '#FB923C'; // Fun orange
const HIGHLIGHT_COLOR = '#F472B6'; // Playful pink

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
                <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.2"/>
            </filter>
        </defs>
        
        <!-- Main background -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" 
                fill="url(#bgGrad)"
                filter="url(#shadow)" />

        <!-- Laughing emoji face -->
        <g transform="translate(${size/2}, ${size/2}) rotate(-5)">
            <!-- Left eye (laughing closed) -->
            <path d="M${-size/5},${-size/6} 
                     c${size/25},${-size/15} ${size/12},${-size/20} ${size/8},0"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/30}"
                  stroke-linecap="round"
                  fill="none" />

            <!-- Right eye (laughing closed) -->
            <path d="M${size/5},${-size/6} 
                     c${-size/25},${-size/15} ${-size/12},${-size/20} ${-size/8},0"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/30}"
                  stroke-linecap="round"
                  fill="none" />

            <!-- Big laughing mouth -->
            <path d="M${-size/3},${size/8} 
                     C${-size/4},${size/3} 
                      ${size/4},${size/3} 
                      ${size/3},${size/8}"
                  fill="${HIGHLIGHT_COLOR}" />

            <!-- Teeth lines -->
            ${Array.from({length: 4}, (_, i) => {
                const x = -size/3 + (i * size/6);
                return `
                    <line x1="${x}" y1="${size/8}"
                          x2="${x}" y2="${size/4}"
                          stroke="white"
                          stroke-width="${size/60}" />
                `;
            }).join('')}

            <!-- Laugh lines -->
            <path d="M${-size/2.5},${-size/8} l${-size/15},${-size/15}"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/40}"
                  stroke-linecap="round" />
            <path d="M${size/2.5},${-size/8} l${size/15},${-size/15}"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/40}"
                  stroke-linecap="round" />
        </g>

        <!-- Little stars/sparkles -->
        ${Array.from({length: 5}, (_, i) => {
            const angle = (i * 72) * Math.PI / 180;
            const r = size/2.8;
            const x = size/2 + r * Math.cos(angle);
            const y = size/2 + r * Math.sin(angle);
            return `
                <path d="M${x},${y-size/40} l0,${size/20} M${x-size/40},${y} l${size/20},0"
                      stroke="${HIGHLIGHT_COLOR}"
                      stroke-width="${size/60}"
                      stroke-linecap="round" />
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
    console.log(gradient.pastel.multiline('\n😂 Generating Laughing Emoji Icons...\n'));
    
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
