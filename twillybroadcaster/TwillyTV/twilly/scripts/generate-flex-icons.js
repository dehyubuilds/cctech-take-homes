const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'flex');
const PRIMARY_COLOR = '#0EA5E9'; // Vibrant sky blue
const ACCENT_COLOR = '#EC4899'; // Hot pink
const DARK_BG = '#0F172A'; // Slate dark

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
                <stop offset="0%" style="stop-color:${DARK_BG};stop-opacity:1" />
                <stop offset="100%" style="stop-color:#1E293B;stop-opacity:1" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        
        <!-- Main background -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" 
                fill="url(#bgGrad)" />

        <!-- Abstract fitness person -->
        <g transform="translate(${size/2}, ${size/2})">
            <!-- Dynamic arc (movement path) -->
            <path d="M${-size/3},0 
                     A${size/3},${size/3} 0 0,1 ${size/3},0"
                  stroke="${PRIMARY_COLOR}"
                  stroke-width="${size/40}"
                  fill="none"
                  stroke-linecap="round"
                  filter="url(#glow)" />

            <!-- Abstract figure -->
            <circle cx="0" cy="${-size/4}" r="${size/12}"
                    fill="${ACCENT_COLOR}"
                    filter="url(#glow)" />
                    
            <!-- Arms -->
            <path d="M${-size/6},${-size/6} 
                     L0,${-size/4} 
                     L${size/6},${-size/6}"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/30}"
                  stroke-linecap="round"
                  fill="none"
                  filter="url(#glow)" />
                  
            <!-- Body -->
            <line x1="0" y1="${-size/4}" 
                  x2="0" y2="${size/8}"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/30}"
                  stroke-linecap="round"
                  filter="url(#glow)" />
                  
            <!-- Legs -->
            <path d="M0,${size/8} 
                     L${-size/8},${size/3}"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/30}"
                  stroke-linecap="round"
                  filter="url(#glow)" />
            <path d="M0,${size/8} 
                     L${size/8},${size/3}"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/30}"
                  stroke-linecap="round"
                  filter="url(#glow)" />
        </g>

        <!-- Energy rings -->
        <g transform="translate(${size/2}, ${size/2})">
            ${Array.from({length: 3}, (_, i) => {
                const radius = size/4 + (i * size/15);
                return `
                    <circle cx="0" cy="0" r="${radius}"
                            stroke="${PRIMARY_COLOR}"
                            stroke-width="${size/100}"
                            stroke-dasharray="${size/20},${size/20}"
                            fill="none"
                            opacity="${0.3 - (i * 0.1)}"
                            filter="url(#glow)" />
                `;
            }).join('')}
        </g>

        <!-- Text "FLEX" -->
        <text x="${size/2}" y="${size/1.3}"
              font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" 
              font-weight="900"
              font-size="${size/4}"
              fill="#FFFFFF"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#glow)"
              letter-spacing="${size/25}">
            FLEX
        </text>
    </svg>`;

    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    
    await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
    
    return outputPath;
}

async function main() {
    console.log(gradient.pastel.multiline('\n💪 Generating Flex Icons...\n'));
    
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
