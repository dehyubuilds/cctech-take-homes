const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const gradient = require('gradient-string');

// Configuration
const SIZES = [192, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'giggles');
const BACKGROUND_COLOR = '#FFD700'; // Cheerful yellow
const ACCENT_COLOR = '#FF6B6B'; // Playful coral

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
                <stop offset="0%" style="stop-color:#FF6B6B;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#4ECDC4;stop-opacity:1" />
            </linearGradient>
            <filter id="shadow">
                <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#333" flood-opacity="0.3"/>
            </filter>
        </defs>
        
        <!-- Background circle -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2.2}" 
                fill="${BACKGROUND_COLOR}" 
                filter="url(#shadow)" />

        <!-- Laughing face -->
        <g transform="translate(${size/2}, ${size/2}) rotate(-5)">
            <!-- Eyes (crying laughing) -->
            <path d="M-${size/5},${-size/6} 
                     c${size/25},${-size/15} ${size/12},${-size/20} ${size/8},0"
                  stroke="#333" stroke-width="${size/30}" fill="none" />
            <path d="M${size/5},${-size/6} 
                     c${-size/25},${-size/15} ${-size/12},${-size/20} ${-size/8},0"
                  stroke="#333" stroke-width="${size/30}" fill="none" />
                  
            <!-- Tears of joy -->
            <path d="M${-size/4.5},${-size/8} l${-size/20},${size/15}"
                  stroke="#4ECDC4" stroke-width="${size/30}" fill="none" />
            <path d="M${size/4.5},${-size/8} l${size/20},${size/15}"
                  stroke="#4ECDC4" stroke-width="${size/30}" fill="none" />

            <!-- Big laughing mouth -->
            <path d="M${-size/3.5},${size/8} 
                     C${-size/4},${size/3} ${size/4},${size/3} ${size/3.5},${size/8}"
                  stroke="#333" stroke-width="${size/30}" fill="#FF6B6B" />
                  
            <!-- Laugh lines -->
            <path d="M${-size/3},${-size/20} l${-size/15},${-size/15}"
                  stroke="#333" stroke-width="${size/40}" fill="none" />
            <path d="M${size/3},${-size/20} l${size/15},${-size/15}"
                  stroke="#333" stroke-width="${size/40}" fill="none" />
        </g>

        <!-- Text "GIGGLES" with fun transform -->
        <g transform="translate(${size/2}, ${size/1.3}) rotate(-5)">
            <text x="0" y="0"
                  font-family="Arial, sans-serif" 
                  font-weight="bold"
                  font-size="${size/5}"
                  fill="url(#grad)"
                  text-anchor="middle" 
                  dominant-baseline="middle"
                  filter="url(#shadow)"
                  style="letter-spacing: ${size/50}px;">
                GIGGLES
            </text>
        </g>
    </svg>`;

    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    
    await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
    
    return outputPath;
}

async function main() {
    console.log(gradient.pastel.multiline('\n😂 Generating Twilly Giggles Icons...\n'));
    
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
