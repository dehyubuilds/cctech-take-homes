export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userId } = body;

    if (!userId) {
      throw createError({
        statusCode: 400,
        message: 'User ID is required'
      });
    }

    // This would stop the current stream on your EC2 instance
    // and trigger the S3 sync process
    console.log(`Stopping stream for user: ${userId}`);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      success: true,
      message: 'Stream stopped successfully'
    };
  } catch (error) {
    console.error('Error stopping stream:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to stop stream'
    });
  }
}); 