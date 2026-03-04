const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'twillybeats');
const PRIMARY_COLOR = '#1F2937'; // Dark gray
const ACCENT_COLOR = '#F59E0B'; // Gold
const HIGHLIGHT_COLOR = '#EC4899'; // Hot pink
const URBAN_COLOR = '#8B5CF6'; // Purple

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
                <stop offset="0%" style="stop-color:#111827;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#1F2937;stop-opacity:1" />
            </linearGradient>
            <filter id="neonGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        
        <!-- Main background -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" 
                fill="url(#bgGrad)" />

        <!-- Headphones -->
        <g transform="translate(${size/2}, ${size/2})">
            <!-- Left ear cup -->
            <circle cx="${-size/3}" cy="0" r="${size/6}"
                    fill="${PRIMARY_COLOR}"
                    stroke="${ACCENT_COLOR}"
                    stroke-width="${size/60}"
                    filter="url(#neonGlow)" />
            
            <!-- Right ear cup -->
            <circle cx="${size/3}" cy="0" r="${size/6}"
                    fill="${PRIMARY_COLOR}"
                    stroke="${ACCENT_COLOR}"
                    stroke-width="${size/60}"
                    filter="url(#neonGlow)" />
            
            <!-- Headband -->
            <path d="M${-size/3},${-size/6} 
                     Q0,${-size/3} ${size/3},${-size/6}"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/40}"
                  fill="none"
                  filter="url(#neonGlow)" />
        </g>

        <!-- Sound waves -->
        <g transform="translate(${size/2}, ${size/2})">
            ${Array.from({length: 4}, (_, i) => {
                const offset = i * (size/15);
                return `
                    <path d="M${-size/3},${offset} 
                            C${-size/4},${offset-size/8} 
                             ${size/4},${offset+size/8} 
                             ${size/3},${offset}"
                          stroke="${HIGHLIGHT_COLOR}"
                          stroke-width="${size/40}"
                          fill="none"
                          opacity="${0.8 - i * 0.15}"
                          filter="url(#neonGlow)" />
                `;
            }).join('')}
        </g>

        <!-- Vinyl record -->
        <g transform="translate(${size/2}, ${size/1.8})">
            <circle cx="0" cy="0" r="${size/8}"
                    fill="${PRIMARY_COLOR}"
                    stroke="${URBAN_COLOR}"
                    stroke-width="${size/60}"
                    filter="url(#neonGlow)" />
            
            <!-- Record grooves -->
            ${Array.from({length: 3}, (_, i) => {
                const r = size/12 + (i * size/24);
                return `
                    <circle cx="0" cy="0" r="${r}"
                            stroke="${URBAN_COLOR}"
                            stroke-width="${size/100}"
                            fill="none"
                            opacity="0.6" />
                `;
            }).join('')}
            
            <!-- Center label -->
            <circle cx="0" cy="0" r="${size/20}"
                    fill="${ACCENT_COLOR}" />
        </g>

        <!-- Text "TWILLY" -->
        <text x="${size/2}" y="${size/1.4}"
              font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" 
              font-weight="900"
              font-size="${size/6}"
              fill="${ACCENT_COLOR}"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#neonGlow)"
              letter-spacing="${size/40}">
            TWILLY
        </text>

        <!-- Text "BEATS" -->
        <text x="${size/2}" y="${size/1.2}"
              font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" 
              font-weight="900"
              font-size="${size/6}"
              fill="${HIGHLIGHT_COLOR}"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#neonGlow)"
              letter-spacing="${size/40}">
            BEATS
        </text>

        <!-- Neon accent lines -->
        <g transform="translate(${size/2}, ${size/2})">
            ${Array.from({length: 8}, (_, i) => {
                const angle = (i * 45) * Math.PI / 180;
                const r = size/2.1;
                const x = r * Math.cos(angle);
                const y = r * Math.sin(angle);
                return `
                    <line x1="0" y1="0" x2="${x}" y2="${y}"
                          stroke="${URBAN_COLOR}"
                          stroke-width="${size/80}"
                          opacity="0.4"
                          filter="url(#neonGlow)" />
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
    console.log(gradient.pastel.multiline('\n🎵 Generating Twilly Beats Icons...\n'));
    
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
