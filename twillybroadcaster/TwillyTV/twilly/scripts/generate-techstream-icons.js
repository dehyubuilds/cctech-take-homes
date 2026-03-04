const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'techstream');
const PRIMARY_COLOR = '#6366F1'; // Modern indigo
const SECONDARY_COLOR = '#10B981'; // Fresh emerald
const DARK_BG = '#1E293B'; // Slate dark

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
                <stop offset="0%" style="stop-color:#1E293B;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0F172A;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${PRIMARY_COLOR};stop-opacity:0.7" />
                <stop offset="100%" style="stop-color:${SECONDARY_COLOR};stop-opacity:0.7" />
            </linearGradient>
            <filter id="neonGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            <clipPath id="circleClip">
                <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" />
            </clipPath>
        </defs>
        
        <!-- Main background -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" 
                fill="url(#bgGrad)" />

        <!-- Circuit board pattern -->
        <g clip-path="url(#circleClip)" opacity="0.1">
            ${Array.from({length: 10}, (_, i) => {
                const y = (i * size/10);
                return `
                    <path d="M0,${y} h${size}"
                          stroke="${PRIMARY_COLOR}"
                          stroke-width="1" />
                `;
            }).join('')}
            ${Array.from({length: 10}, (_, i) => {
                const x = (i * size/10);
                return `
                    <path d="M${x},0 v${size}"
                          stroke="${PRIMARY_COLOR}"
                          stroke-width="1" />
                `;
            }).join('')}
        </g>

        <!-- Central tech element -->
        <g transform="translate(${size/2}, ${size/2})">
            <!-- Outer ring -->
            <circle cx="0" cy="0" r="${size/3.5}"
                    fill="none"
                    stroke="${PRIMARY_COLOR}"
                    stroke-width="${size/40}"
                    stroke-dasharray="${size/20},${size/40}"
                    filter="url(#neonGlow)" />

            <!-- Inner hexagon -->
            <path d="${Array.from({length: 6}, (_, i) => {
                const angle = (i * 60) * Math.PI / 180;
                const r = size/6;
                const x = r * Math.cos(angle);
                const y = r * Math.sin(angle);
                return (i === 0 ? 'M' : 'L') + x + ',' + y;
            }).join(' ') + 'Z'}"
                  fill="none"
                  stroke="${SECONDARY_COLOR}"
                  stroke-width="${size/40}"
                  filter="url(#neonGlow)" />

            <!-- Center dot -->
            <circle cx="0" cy="0" r="${size/15}"
                    fill="${SECONDARY_COLOR}"
                    filter="url(#neonGlow)" />

            <!-- Connecting lines -->
            ${Array.from({length: 3}, (_, i) => {
                const angle = (i * 120) * Math.PI / 180;
                const r = size/4;
                const x = r * Math.cos(angle);
                const y = r * Math.sin(angle);
                return `
                    <line x1="0" y1="0" x2="${x}" y2="${y}"
                          stroke="url(#glowGrad)"
                          stroke-width="${size/60}"
                          stroke-linecap="round"
                          filter="url(#neonGlow)" />
                `;
            }).join('')}
        </g>

        <!-- Text "TECH" -->
        <text x="${size/2}" y="${size/1.45}"
              font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" 
              font-weight="700"
              font-size="${size/6}"
              fill="#FFFFFF"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#neonGlow)"
              letter-spacing="${size/40}">
            TECH
        </text>

        <!-- Text "STREAM" -->
        <text x="${size/2}" y="${size/1.25}"
              font-family="'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" 
              font-weight="700"
              font-size="${size/6}"
              fill="${SECONDARY_COLOR}"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#neonGlow)"
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
    console.log(gradient.pastel.multiline('\n💻 Generating Tech Stream Icons...\n'));
    
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
