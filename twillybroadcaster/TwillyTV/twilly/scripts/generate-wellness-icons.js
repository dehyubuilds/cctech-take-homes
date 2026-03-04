const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'wellness');
const LEAF_COLOR = '#059669'; // Emerald green
const WATER_COLOR = '#0EA5E9'; // Ocean blue
const SUNSET_COLOR = '#F97316'; // Warm orange

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
                <stop offset="0%" style="stop-color:#F0FDF4;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ECFEFF;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="sunsetGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#F97316;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#FB923C;stop-opacity:1" />
            </linearGradient>
            <filter id="softShadow">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feColorMatrix in="blur" type="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 15 -4"/>
            </filter>
        </defs>
        
        <!-- Main background -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" 
                fill="url(#bgGrad)"
                filter="url(#softShadow)" />

        <!-- Zen circle -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/3}" 
                fill="none"
                stroke="${WATER_COLOR}"
                stroke-width="${size/60}"
                stroke-dasharray="${size/30},${size/60}"
                opacity="0.6" />

        <!-- Lotus flower -->
        <g transform="translate(${size/2}, ${size/2})">
            ${Array.from({length: 8}, (_, i) => {
                const angle = (i * 45) * Math.PI / 180;
                const innerR = size/8;
                const outerR = size/4;
                const cp1x = innerR * 1.5 * Math.cos(angle - 0.2);
                const cp1y = innerR * 1.5 * Math.sin(angle - 0.2);
                const cp2x = outerR * 0.8 * Math.cos(angle + 0.2);
                const cp2y = outerR * 0.8 * Math.sin(angle + 0.2);
                const endX = outerR * Math.cos(angle);
                const endY = outerR * Math.sin(angle);
                return `
                    <path d="M${innerR * Math.cos(angle)},${innerR * Math.sin(angle)} 
                            C${cp1x},${cp1y} ${cp2x},${cp2y} ${endX},${endY}"
                          stroke="${LEAF_COLOR}"
                          stroke-width="${size/60}"
                          fill="none"
                          opacity="0.8"
                          filter="url(#softShadow)" />
                `;
            }).join('')}
        </g>

        <!-- Center circle (representing mindfulness) -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/8}" 
                fill="url(#sunsetGrad)"
                filter="url(#softShadow)" />

        <!-- Flowing water/energy lines -->
        <g transform="translate(${size/2}, ${size/2})">
            ${Array.from({length: 3}, (_, i) => {
                const offset = i * (size/20);
                return `
                    <path d="M${-size/3},${offset} 
                            C${-size/4},${offset-size/10} 
                             ${size/4},${offset+size/10} 
                             ${size/3},${offset}"
                          stroke="${WATER_COLOR}"
                          stroke-width="${size/60}"
                          fill="none"
                          opacity="${0.4 - i * 0.1}"
                          filter="url(#softShadow)" />
                `;
            }).join('')}
        </g>

        <!-- Text "WELLNESS" -->
        <text x="${size/2}" y="${size/1.35}"
              font-family="'Helvetica Neue', Helvetica, sans-serif" 
              font-weight="300"
              font-size="${size/6}"
              fill="${LEAF_COLOR}"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#softShadow)"
              letter-spacing="${size/40}">
            WELLNESS
        </text>

        <!-- Text "WAY" -->
        <text x="${size/2}" y="${size/1.2}"
              font-family="'Helvetica Neue', Helvetica, sans-serif" 
              font-weight="300"
              font-size="${size/6}"
              fill="${WATER_COLOR}"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#softShadow)"
              letter-spacing="${size/40}">
            WAY
        </text>
    </svg>`;

    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    
    await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
    
    return outputPath;
}

async function main() {
    console.log(gradient.pastel.multiline('\n🌿 Generating Wellness Way Icons...\n'));
    
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
