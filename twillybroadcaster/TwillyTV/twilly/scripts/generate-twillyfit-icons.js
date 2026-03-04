const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'twillyfit');
const PRIMARY_COLOR = '#14b8a6'; // Twilly teal
const ACCENT_COLOR = '#10B981'; // Emerald green
const ENERGY_COLOR = '#F59E0B'; // Amber orange

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
                <stop offset="100%" style="stop-color:#F0FDF4;stop-opacity:1" />
            </linearGradient>
            <filter id="shadow">
                <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.15"/>
            </filter>
            <clipPath id="circleClip">
                <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" />
            </clipPath>
        </defs>
        
        <!-- Main background -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" 
                fill="url(#bgGrad)"
                filter="url(#shadow)" />

        <!-- Energy rings -->
        <g transform="translate(${size/2}, ${size/2})">
            ${Array.from({length: 3}, (_, i) => {
                const radius = size/4 + (i * size/20);
                return `
                    <circle cx="0" cy="0" r="${radius}"
                            stroke="${PRIMARY_COLOR}"
                            stroke-width="${size/60}"
                            stroke-dasharray="${size/15},${size/30}"
                            fill="none"
                            opacity="${0.6 - (i * 0.15)}"
                            transform="rotate(${i * 45})" />
                `;
            }).join('')}
        </g>

        <!-- Central fitness element -->
        <g transform="translate(${size/2}, ${size/2})">
            <!-- Heart rate pulse -->
            <path d="M${-size/3},0 
                     l${size/8},0 
                     l${size/20},${-size/6} 
                     l${size/20},${size/3} 
                     l${size/20},${-size/4} 
                     l${size/20},${size/8} 
                     l${size/8},0"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/40}"
                  fill="none"
                  stroke-linecap="round"
                  filter="url(#shadow)" />

            <!-- Stylized dumbbell -->
            <g transform="translate(0, ${size/6})">
                <rect x="${-size/4}" y="${-size/30}" 
                      width="${size/2}" height="${size/15}"
                      fill="${PRIMARY_COLOR}"
                      rx="${size/60}"
                      filter="url(#shadow)" />
                
                <circle cx="${-size/4}" cy="0" r="${size/15}"
                        fill="${ENERGY_COLOR}"
                        filter="url(#shadow)" />
                <circle cx="${size/4}" cy="0" r="${size/15}"
                        fill="${ENERGY_COLOR}"
                        filter="url(#shadow)" />
            </g>
        </g>

        <!-- Motion lines -->
        <g transform="translate(${size/2}, ${size/2})">
            ${Array.from({length: 4}, (_, i) => {
                const angle = (i * 90 + 45) * Math.PI / 180;
                const r1 = size/3.5;
                const r2 = size/2.8;
                const x1 = r1 * Math.cos(angle);
                const y1 = r1 * Math.sin(angle);
                const x2 = r2 * Math.cos(angle);
                const y2 = r2 * Math.sin(angle);
                return `
                    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                          stroke="${ENERGY_COLOR}"
                          stroke-width="${size/60}"
                          stroke-linecap="round"
                          opacity="0.8" />
                `;
            }).join('')}
        </g>


    </svg>`;

    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    
    await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
    
    return outputPath;
}

async function main() {
    console.log(gradient.pastel.multiline('\n💪 Generating Twilly Fit Icons...\n'));
    
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
