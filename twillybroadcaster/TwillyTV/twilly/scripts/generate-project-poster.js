import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DALL-E API configuration
const DALL_E_API_KEY = process.env.OPENAI_API_KEY || 'your-openai-api-key-here';
const DALL_E_API_URL = 'https://api.openai.com/v1/images/generations';

// Enhanced prompt for better image generation
const prompt = `A cinematic, high-contrast movie poster featuring five silhouetted women wearing ornate, detailed masks, each in a striking pose that clearly represents their character role: a villain with a dark, menacing stance, a hero with a confident, powerful pose, a temptress with a seductive, alluring position, a rebel with a defiant, rebellious attitude, and a spy with a mysterious, stealthy posture. Dramatic neon lighting in deep purples and rich reds creates intense shadows and highlights. A faint, blurred city skyline appears in the background. The title "Masked Desires: Mission Uncut" is displayed in bold, elegant, cinematic font at the bottom. The overall style is dark, mysterious, and highly cinematic with professional movie poster quality.`;

const generateImage = async () => {
  try {
    console.log('🎬 Generating Project Poster: "Masked Desires: Mission Uncut"');
    console.log('📝 Prompt:', prompt);
    console.log('');
    
    if (!DALL_E_API_KEY || DALL_E_API_KEY === 'your-openai-api-key-here') {
      console.log('❌ Error: OpenAI API key not found');
      console.log('');
      console.log('💡 To use this script:');
      console.log('1. Get an API key from: https://platform.openai.com/api-keys');
      console.log('2. Set it as an environment variable: export OPENAI_API_KEY="your-key-here"');
      console.log('3. Or replace the DALL_E_API_KEY variable in this script');
      console.log('');
      console.log('🔧 Alternative: Use the prompt above in:');
      console.log('   - Cursor AI (Cmd/Ctrl + K)');
      console.log('   - DALL-E web interface');
      console.log('   - Any AI image generation service');
      return;
    }

    console.log('🚀 Making API request to DALL-E...');
    
    const response = await fetch(DALL_E_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DALL_E_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        style: 'natural'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (data.data && data.data[0] && data.data[0].url) {
      const imageUrl = data.data[0].url;
      console.log('✅ Image generated successfully!');
      console.log('🖼️ Image URL:', imageUrl);
      console.log('');
      console.log('💾 To save the image:');
      console.log('1. Open the URL in your browser');
      console.log('2. Right-click and "Save image as..."');
      console.log('3. Save as "masked-desires-poster.png"');
      console.log('');
      console.log('📁 Suggested filename: masked-desires-poster.png');
      
      // Save the URL to a file for easy access
      const outputPath = path.join(__dirname, '../assets/masked-desires-poster-url.txt');
      fs.writeFileSync(outputPath, `Generated Image URL: ${imageUrl}\n\nPrompt: ${prompt}\n\nGenerated: ${new Date().toISOString()}`);
      console.log('📄 URL saved to: assets/masked-desires-poster-url.txt');
      
    } else {
      throw new Error('No image URL received from API');
    }
    
  } catch (error) {
    console.error('❌ Error generating image:', error.message);
    console.log('');
    console.log('💡 Alternative solutions:');
    console.log('1. Use the prompt in Cursor AI (Cmd/Ctrl + K)');
    console.log('2. Use DALL-E web interface directly');
    console.log('3. Check your API key and billing status');
    console.log('4. Try a different AI image service');
  }
};

// Alternative: Generate HTML file for manual generation
const generateHTMLAlternative = () => {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Masked Desires: Mission Uncut - Poster Generator</title>
    <style>
        body { 
            margin: 0; 
            padding: 20px; 
            background: #0f172a; 
            color: white; 
            font-family: Arial, sans-serif; 
        }
        .container { 
            max-width: 800px; 
            margin: 0 auto; 
            text-align: center; 
        }
        .prompt-box { 
            background: #1e293b; 
            border: 2px solid #3b82f6; 
            border-radius: 12px; 
            padding: 20px; 
            margin: 20px 0; 
            text-align: left; 
        }
        .prompt-text { 
            background: #334155; 
            padding: 15px; 
            border-radius: 8px; 
            font-family: monospace; 
            white-space: pre-wrap; 
            margin: 10px 0; 
        }
        .instructions { 
            background: #1e293b; 
            border: 2px solid #10b981; 
            border-radius: 12px; 
            padding: 20px; 
            margin: 20px 0; 
            text-align: left; 
        }
        .step { 
            margin: 10px 0; 
            padding: 10px; 
            background: #334155; 
            border-radius: 8px; 
        }
        .highlight { 
            color: #3b82f6; 
            font-weight: bold; 
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎬 Masked Desires: Mission Uncut</h1>
        <h2>Project Poster Generator</h2>
        
        <div class="prompt-box">
            <h3>📝 Copy this prompt for AI image generation:</h3>
            <div class="prompt-text">${prompt}</div>
        </div>
        
        <div class="instructions">
            <h3>🚀 How to generate your poster:</h3>
            
            <div class="step">
                <span class="highlight">Option 1: Cursor AI</span><br>
                1. Press Cmd/Ctrl + K in Cursor<br>
                2. Paste the prompt above<br>
                3. Select "Generate Image"<br>
                4. Download the generated image
            </div>
            
            <div class="step">
                <span class="highlight">Option 2: DALL-E Web</span><br>
                1. Go to https://labs.openai.com/<br>
                2. Paste the prompt above<br>
                3. Click "Generate"<br>
                4. Download the image
            </div>
            
            <div class="step">
                <span class="highlight">Option 3: Other AI Services</span><br>
                1. Use Midjourney, Stable Diffusion, etc.<br>
                2. Paste the prompt above<br>
                3. Generate and download
            </div>
        </div>
        
        <div class="prompt-box">
            <h3>💡 Tips for best results:</h3>
            <ul style="text-align: left;">
                <li>Use "cinematic movie poster" in your prompt</li>
                <li>Specify "high contrast" and "dramatic lighting"</li>
                <li>Mention "professional quality" and "detailed masks"</li>
                <li>Include "dark, mysterious atmosphere"</li>
            </ul>
        </div>
        
        <p style="margin-top: 30px; color: #94a3b8;">
            Generated on: ${new Date().toLocaleDateString()}
        </p>
    </div>
</body>
</html>
  `;

  const outputPath = path.join(__dirname, '../assets/poster-generator.html');
  fs.writeFileSync(outputPath, html);
  console.log('🌐 HTML generator created at: assets/poster-generator.html');
  console.log('📱 Open this file in your browser for easy prompt copying');
};

// Run the main function
if (DALL_E_API_KEY && DALL_E_API_KEY !== 'your-openai-api-key-here') {
  generateImage();
} else {
  console.log('🔑 No API key found, creating HTML alternative...');
  generateHTMLAlternative();
}
