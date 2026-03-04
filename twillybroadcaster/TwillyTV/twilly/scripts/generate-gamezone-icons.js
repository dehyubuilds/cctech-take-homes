const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'gamezone');
const PRIMARY_COLOR = '#7C3AED'; // Gaming purple
const SPORTS_COLOR = '#F97316'; // Sports orange
const ACCENT_COLOR = '#06B6D4'; // Cyan blue

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
                <stop offset="0%" style="stop-color:#1E1B4B;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#312E81;stop-opacity:1" />
            </linearGradient>
            <filter id="neonGlow">
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

        <!-- Gaming controller base -->
        <g transform="translate(${size/2}, ${size/2.2})">
            <!-- Controller body -->
            <rect x="${-size/3}" y="${-size/8}" 
                  width="${size/1.5}" height="${size/4}"
                  rx="${size/15}" ry="${size/15}"
                  fill="${PRIMARY_COLOR}"
                  filter="url(#neonGlow)" />
            
            <!-- D-pad -->
            <g transform="translate(${-size/5}, 0)">
                <rect x="${-size/40}" y="${-size/20}" 
                      width="${size/20}" height="${size/10}"
                      fill="${ACCENT_COLOR}"
                      filter="url(#neonGlow)" />
                <rect x="${-size/20}" y="${-size/40}" 
                      width="${size/10}" height="${size/20}"
                      fill="${ACCENT_COLOR}"
                      filter="url(#neonGlow)" />
            </g>
            
            <!-- Action buttons -->
            <g transform="translate(${size/5}, 0)">
                <circle cx="${-size/25}" cy="${-size/25}" r="${size/40}"
                        fill="${SPORTS_COLOR}"
                        filter="url(#neonGlow)" />
                <circle cx="${size/25}" cy="${-size/25}" r="${size/40}"
                        fill="${SPORTS_COLOR}"
                        filter="url(#neonGlow)" />
                <circle cx="${-size/25}" cy="${size/25}" r="${size/40}"
                        fill="${SPORTS_COLOR}"
                        filter="url(#neonGlow)" />
                <circle cx="${size/25}" cy="${size/25}" r="${size/40}"
                        fill="${SPORTS_COLOR}"
                        filter="url(#neonGlow)" />
            </g>
        </g>

        <!-- Sports ball -->
        <g transform="translate(${size/1.6}, ${size/2.8})">
            <circle cx="0" cy="0" r="${size/12}"
                    fill="${SPORTS_COLOR}"
                    filter="url(#neonGlow)" />
            <!-- Soccer ball pattern -->
            <path d="M${-size/20},${-size/20} 
                     L0,${-size/15} 
                     L${size/20},${-size/20} 
                     L${size/15},0 
                     L${size/20},${size/20} 
                     L0,${size/15} 
                     L${-size/20},${size/20} 
                     L${-size/15},0 Z"
                  fill="none"
                  stroke="#FFF"
                  stroke-width="${size/80}" />
        </g>

        <!-- Digital pixel elements -->
        <g transform="translate(${size/2}, ${size/2})">
            ${Array.from({length: 12}, (_, i) => {
                const angle = (i * 30) * Math.PI / 180;
                const r = size/2.8;
                const x = r * Math.cos(angle);
                const y = r * Math.sin(angle);
                return `
                    <rect x="${x - size/60}" y="${y - size/60}" 
                          width="${size/30}" height="${size/30}"
                          fill="${ACCENT_COLOR}"
                          opacity="0.6"
                          filter="url(#neonGlow)" />
                `;
            }).join('')}
        </g>

        <!-- Text "GAME" -->
        <text x="${size/2}" y="${size/1.45}"
              font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" 
              font-weight="900"
              font-size="${size/6}"
              fill="${PRIMARY_COLOR}"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#neonGlow)"
              letter-spacing="${size/40}">
            GAME
        </text>

        <!-- Text "ZONE" -->
        <text x="${size/2}" y="${size/1.25}"
              font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" 
              font-weight="900"
              font-size="${size/6}"
              fill="${SPORTS_COLOR}"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#neonGlow)"
              letter-spacing="${size/40}">
            ZONE
        </text>
    </svg>`;

    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    
    await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
    
    return outputPath;
}

async function main() {
    console.log(gradient.pastel.multiline('\n🎮 Generating Game Zone Icons...\n'));
    
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
