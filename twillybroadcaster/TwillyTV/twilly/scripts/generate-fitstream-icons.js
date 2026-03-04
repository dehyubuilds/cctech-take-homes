const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'fitstream');
const PRIMARY_COLOR = '#22C55E'; // Vibrant green
const SECONDARY_COLOR = '#3B82F6'; // Energetic blue
const ACCENT_COLOR = '#8B5CF6'; // Dynamic purple

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
            <linearGradient id="energyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${PRIMARY_COLOR};stop-opacity:1" />
                <stop offset="50%" style="stop-color:${SECONDARY_COLOR};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${ACCENT_COLOR};stop-opacity:1" />
            </linearGradient>
            <filter id="softShadow">
                <feDropShadow dx="2" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.15"/>
            </filter>
            <clipPath id="heartClip">
                <path d="M${size/2},${size/1.8} 
                         l${-size/8},${-size/8} 
                         a${size/16},${size/16} 0 1,1 ${size/8},${-size/8} 
                         a${size/16},${size/16} 0 1,1 ${size/8},${size/8}z" />
            </clipPath>
        </defs>
        
        <!-- Main background -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" 
                fill="url(#bgGrad)"
                filter="url(#softShadow)" />

        <!-- Dynamic wave pattern -->
        <g transform="translate(${size/2}, ${size/2})">
            ${Array.from({length: 3}, (_, i) => {
                const offset = i * (size/15);
                return `
                    <path d="M${-size/3},${offset} 
                            C${-size/6},${offset-size/10} 
                             ${size/6},${offset+size/10} 
                             ${size/3},${offset}"
                          stroke="url(#energyGrad)"
                          stroke-width="${size/30}"
                          fill="none"
                          opacity="${0.8 - i * 0.2}"
                          filter="url(#softShadow)" />
                `;
            }).join('')}
        </g>

        <!-- Heartbeat monitor line -->
        <path d="M${size/6},${size/2} 
                 h${size/6} 
                 l${size/20},${-size/6} 
                 l${size/10},${size/3} 
                 l${size/20},${-size/2.5} 
                 l${size/20},${size/4} 
                 h${size/6}"
              stroke="${PRIMARY_COLOR}"
              stroke-width="${size/40}"
              fill="none"
              filter="url(#softShadow)" />

        <!-- Fitness elements -->
        <g transform="translate(${size/2}, ${size/2.2})">
            <!-- Stylized dumbbell -->
            <rect x="${-size/4}" y="${-size/20}" 
                  width="${size/2}" height="${size/10}"
                  fill="${SECONDARY_COLOR}"
                  rx="${size/40}"
                  filter="url(#softShadow)" />
            
            <circle cx="${-size/4}" cy="0" r="${size/12}"
                    fill="${ACCENT_COLOR}"
                    filter="url(#softShadow)" />
            <circle cx="${size/4}" cy="0" r="${size/12}"
                    fill="${ACCENT_COLOR}"
                    filter="url(#softShadow)" />
        </g>

        <!-- Text "FIT" -->
        <text x="${size/2}" y="${size/1.45}"
              font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" 
              font-weight="900"
              font-size="${size/5}"
              fill="${PRIMARY_COLOR}"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#softShadow)"
              letter-spacing="${size/40}">
            FIT
        </text>

        <!-- Text "STREAM" -->
        <text x="${size/2}" y="${size/1.25}"
              font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" 
              font-weight="900"
              font-size="${size/5}"
              fill="${SECONDARY_COLOR}"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#softShadow)"
              letter-spacing="${size/40}">
            STREAM
        </text>
    </svg>`;

    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    
    await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
    
    return outputPath;
}

async function main() {
    console.log(gradient.pastel.multiline('\n💪 Generating Fit Stream Icons...\n'));
    
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
