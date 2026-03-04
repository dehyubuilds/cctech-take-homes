const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'soulkitchen');
const PRIMARY_COLOR = '#F4A261'; // Warm orange
const SECONDARY_COLOR = '#2A9D8F'; // Deep teal
const ACCENT_COLOR = '#E76F51'; // Terracotta

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
            <linearGradient id="castIronGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#264653;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#2A9D8F;stop-opacity:1" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            <filter id="shadow">
                <feDropShadow dx="2" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.3"/>
            </filter>
        </defs>
        
        <!-- Background circle -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" 
                fill="#FFF8E7"
                filter="url(#shadow)" />

        <!-- Cast Iron Skillet -->
        <g transform="translate(${size/2}, ${size/2}) rotate(-15)">
            <!-- Skillet base -->
            <circle cx="0" cy="0" r="${size/3}" 
                    fill="url(#castIronGrad)"
                    stroke="#264653"
                    stroke-width="${size/60}" />
            
            <!-- Skillet handle -->
            <rect x="${size/3.2}" y="${-size/20}" 
                  width="${size/4}" height="${size/10}"
                  fill="#264653"
                  rx="${size/40}" />
            
            <!-- Handle hole -->
            <circle cx="${size/2.5}" cy="0" r="${size/30}" 
                    fill="#FFF8E7" />
        </g>

        <!-- Steam/Aroma swirls -->
        <g transform="translate(${size/2}, ${size/2.5})">
            <path d="M${-size/6},${-size/10} 
                     c${size/15},${-size/10} ${size/8},${-size/15} ${size/6},0"
                  stroke="${PRIMARY_COLOR}"
                  stroke-width="${size/40}"
                  fill="none"
                  filter="url(#glow)" />
            
            <path d="M0,${-size/8} 
                     c${size/15},${-size/10} ${size/8},${-size/15} ${size/6},0"
                  stroke="${ACCENT_COLOR}"
                  stroke-width="${size/40}"
                  fill="none"
                  filter="url(#glow)" />
        </g>

        <!-- Seasoning sprinkles -->
        <g transform="translate(${size/2}, ${size/2})">
            ${Array.from({length: 8}, (_, i) => {
                const angle = (i * 45) * Math.PI / 180;
                const r = size/4;
                const x = r * Math.cos(angle);
                const y = r * Math.sin(angle);
                return `
                    <circle cx="${x}" cy="${y}" r="${size/60}"
                            fill="${PRIMARY_COLOR}"
                            filter="url(#glow)" />
                `;
            }).join('')}
        </g>

        <!-- Text "SOUL" -->
        <text x="${size/2}" y="${size/1.45}"
              font-family="Georgia, serif" 
              font-weight="bold"
              font-size="${size/6}"
              fill="${ACCENT_COLOR}"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#shadow)"
              style="font-style: italic;">
            SOUL
        </text>

        <!-- Text "KITCHEN" -->
        <text x="${size/2}" y="${size/1.25}"
              font-family="Georgia, serif" 
              font-weight="bold"
              font-size="${size/6}"
              fill="${SECONDARY_COLOR}"
              text-anchor="middle" 
              dominant-baseline="middle"
              filter="url(#shadow)"
              style="font-style: italic;">
            KITCHEN
        </text>
    </svg>`;

    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    
    await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
    
    return outputPath;
}

async function main() {
    console.log(gradient.pastel.multiline('\n👩‍🍳 Generating Soul Kitchen Icons...\n'));
    
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
