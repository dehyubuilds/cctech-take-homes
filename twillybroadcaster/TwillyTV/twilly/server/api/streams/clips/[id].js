export default defineEventHandler(async (event) => {
  const method = event.method;
  const clipId = event.context.params.id;
  
  try {
    switch (method) {
      case 'PUT':
        return await updateClip(event, clipId);
      case 'DELETE':
        return await deleteClip(event, clipId);
      default:
        throw createError({
          statusCode: 405,
          message: 'Method not allowed'
        });
    }
  } catch (error) {
    console.error(`Error in clip API (${method}):`, error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});

async function updateClip(event, clipId) {
  const body = await readBody(event);
  const { title, description, price } = body;

  if (!title) {
    throw createError({
      statusCode: 400,
      message: 'Title is required'
    });
  }

  // This would update the clip in your database
  console.log(`Updating clip ${clipId}:`, { title, description, price });

  const updatedClip = {
    id: clipId,
    title,
    description: description || '',
    price: parseFloat(price) || 0,
    updatedAt: new Date().toISOString()
  };

  return {
    success: true,
    clip: updatedClip
  };
}

async function deleteClip(event, clipId) {
  // This would delete the clip from your database
  console.log(`Deleting clip ${clipId}`);

  return {
    success: true,
    message: 'Clip deleted successfully'
  };
} 