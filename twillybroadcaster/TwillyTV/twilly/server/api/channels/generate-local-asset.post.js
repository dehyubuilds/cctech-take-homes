import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { channelName, posterUrl, localAssetPath } = body;

    if (!channelName || !posterUrl || !localAssetPath) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: channelName, posterUrl, localAssetPath'
      });
    }

    // Extract the filename from the localAssetPath
    const filename = localAssetPath.split('/').pop();
    const assetsDir = join(process.cwd(), 'public', 'assets', 'channels');
    
    // Ensure the assets directory exists
    await mkdir(assetsDir, { recursive: true });
    
    // Full path for the new asset
    const fullAssetPath = join(assetsDir, filename);

    try {
      // Download the poster image and save it directly
      const imageResponse = await fetch(posterUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch poster image: ${imageResponse.status}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      
      // Write the image directly to the assets folder
      // This creates a local copy that WhatsApp/Instagram can reliably access
      await writeFile(fullAssetPath, Buffer.from(imageBuffer));
      
      console.log(`Successfully generated local asset for ${channelName}: ${fullAssetPath}`);
      
      return {
        success: true,
        localAssetPath: `/assets/channels/${filename}`,
        message: 'Local asset generated successfully'
      };
      
    } catch (imageError) {
      console.error('Error processing image:', imageError);
      
      // For now, return the original poster URL if we can't create a local asset
      console.log(`Using original poster URL for ${channelName}: ${posterUrl}`);
      
      return {
        success: true,
        localAssetPath: posterUrl, // Fallback to original URL
        message: 'Using original poster URL as fallback'
      };
    }
    
  } catch (error) {
    console.error('Error generating local asset:', error);
    
    return {
      success: false,
      message: error.message || 'Failed to generate local asset'
    };
  }
});
