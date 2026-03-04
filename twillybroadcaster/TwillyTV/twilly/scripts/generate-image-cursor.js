import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎬 Generating "Masked Desires: Mission Uncut" Poster...');
console.log('');

// The enhanced prompt for the poster
const prompt = `A cinematic, high-contrast movie poster featuring five silhouetted women wearing ornate, detailed masks, each in a striking pose that clearly represents their character role: a villain with a dark, menacing stance, a hero with a confident, powerful pose, a temptress with a seductive, alluring position, a rebel with a defiant, rebellious attitude, and a spy with a mysterious, stealthy posture. Dramatic neon lighting in deep purples and rich reds creates intense shadows and highlights. A faint, blurred city skyline appears in the background. The title "Masked Desires: Mission Uncut" is displayed in bold, elegant, cinematic font at the bottom. The overall style is dark, mysterious, and highly cinematic with professional movie poster quality.`;

console.log('📝 Enhanced Prompt:');
console.log(prompt);
console.log('');

console.log('🚀 To generate this image in Cursor:');
console.log('1. Press Cmd/Ctrl + K to open AI command palette');
console.log('2. Paste the prompt above');
console.log('3. Select "Generate Image"');
console.log('4. Wait for your cinematic poster!');
console.log('');

console.log('💡 Alternative methods:');
console.log('• Use DALL-E: https://labs.openai.com/');
console.log('• Use Midjourney: /imagine command');
console.log('• Use Bing Image Creator');
console.log('');

// Create a markdown file with the prompt for easy copying
const markdownContent = `# Masked Desires: Mission Uncut - Poster Generation

## 🎬 Enhanced AI Prompt

Copy this prompt and use it in any AI image generation service:

\`\`\`
${prompt}
\`\`\`

## 🚀 Quick Generation Methods

### Cursor AI (Recommended)
1. Press \`Cmd/Ctrl + K\` in Cursor
2. Paste the prompt above
3. Select "Generate Image"
4. Download your poster

### DALL-E Web
1. Go to https://labs.openai.com/
2. Paste the prompt
3. Click "Generate"
4. Download the image

### Midjourney
1. Use \`/imagine\` command
2. Paste the prompt
3. Wait for generation
4. Download your poster

## 🎯 What This Will Create

- **Five distinct masked women** with clear character roles
- **Cinematic lighting** with purple/red neon effects  
- **Professional movie poster quality** with high contrast
- **Dark, mysterious atmosphere** perfect for your project
- **Elegant typography** for the title

## 💡 Tips for Best Results

- The prompt is optimized for **cinematic quality**
- **High contrast** ensures dramatic visual impact
- **Detailed masks** will create unique character identities
- **City skyline background** adds urban sophistication

---

*Generated on: ${new Date().toLocaleDateString()}*
`;

const outputPath = path.join(__dirname, '../assets/poster-generation-guide.md');
fs.writeFileSync(outputPath, markdownContent);

console.log('📄 Created: assets/poster-generation-guide.md');
console.log('📱 Open this file in Cursor for easy prompt copying');
console.log('');

// Also create a simple text file with just the prompt
const promptOnlyPath = path.join(__dirname, '../assets/poster-prompt.txt');
fs.writeFileSync(promptOnlyPath, prompt);

console.log('📝 Created: assets/poster-prompt.txt (prompt only)');
console.log('');

console.log('🎭 Your "Masked Desires: Mission Uncut" poster is ready to be generated!');
console.log('✨ Use any of the methods above to create your cinematic masterpiece!');
