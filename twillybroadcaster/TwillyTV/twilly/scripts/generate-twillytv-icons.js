const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'twillytv');
const PRIMARY_COLOR = '#14b8a6'; // Twilly's brand teal
const SECONDARY_COLOR = '#084d5d'; // Darker teal for depth

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
                <stop offset="0%" style="stop-color:${PRIMARY_COLOR};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${SECONDARY_COLOR};stop-opacity:1" />
            </linearGradient>
            <filter id="softShadow">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                <feOffset dx="2" dy="2" result="offsetblur"/>
                <feComponentTransfer>
                    <feFuncA type="linear" slope="0.5"/>
                </feComponentTransfer>
                <feMerge> 
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            <clipPath id="screenMask">
                <rect x="${size/6}" y="${size/4}" 
                      width="${size/1.5}" height="${size/2}"
                      rx="${size/20}" ry="${size/20}" />
            </clipPath>
        </defs>
        
        <!-- Main circle background -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" 
                fill="#FFFFFF"
                filter="url(#softShadow)" />

        <!-- TV Screen shape with gradient -->
        <rect x="${size/6}" y="${size/4}" 
              width="${size/1.5}" height="${size/2}"
              rx="${size/20}" ry="${size/20}"
              fill="url(#grad)"
              filter="url(#softShadow)" />

        <!-- Dynamic lines animation effect -->
        <g clip-path="url(#screenMask)">
            <path d="M${size/6},${size/3} 
                     l${size/1.5},0 
                     l0,${size/20}"
                  stroke="#FFFFFF"
                  stroke-width="${size/80}"
                  stroke-opacity="0.3"
                  fill="none" />
            
            <path d="M${size/6},${size/2} 
                     l${size/1.5},0 
                     l0,${size/20}"
                  stroke="#FFFFFF"
                  stroke-width="${size/80}"
                  stroke-opacity="0.3"
                  fill="none" />
                  
            <path d="M${size/6},${size/1.5} 
                     l${size/1.5},0 
                     l0,${size/20}"
                  stroke="#FFFFFF"
                  stroke-width="${size/80}"
                  stroke-opacity="0.3"
                  fill="none" />
        </g>

        <!-- TWILLY text -->
        <text x="${size/2}" y="${size/1.45}"
              font-family="Arial Black, Arial, sans-serif" 
              font-weight="900"
              font-size="${size/6}"
              fill="#FFFFFF"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#softShadow)">
            TWILLY
        </text>

        <!-- TV text -->
        <text x="${size/2}" y="${size/1.25}"
              font-family="Arial Black, Arial, sans-serif" 
              font-weight="900"
              font-size="${size/6}"
              fill="#FFFFFF"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#softShadow)">
            TV
        </text>

        <!-- Decorative antenna lines -->
        <path d="M${size/2.2},${size/4} 
                 l${-size/8},${-size/8}"
              stroke="${PRIMARY_COLOR}"
              stroke-width="${size/40}"
              stroke-linecap="round"
              fill="none" />
              
        <path d="M${size/1.8},${size/4} 
                 l${size/8},${-size/8}"
              stroke="${PRIMARY_COLOR}"
              stroke-width="${size/40}"
              stroke-linecap="round"
              fill="none" />
    </svg>`;

    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    
    await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
    
    return outputPath;
}

async function main() {
    console.log(gradient.pastel.multiline('\n📺 Generating Twilly TV Icons...\n'));
    
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
