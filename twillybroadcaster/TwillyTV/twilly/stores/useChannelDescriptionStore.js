import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useChannelDescriptionStore = defineStore('channelDescriptions', () => {
  const channelDescriptions = ref(new Map()); // Map of channelId -> description
  const loading = ref(false);
  const error = ref(null);

  // Get channel description by channelId
  const getChannelDescription = async (channelId, channelName, creatorUsername) => {
    // Check if we already have it in cache
    if (channelDescriptions.value.has(channelId)) {
      return channelDescriptions.value.get(channelId);
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch('/api/channels/get-description', {
        method: 'POST',
        body: {
          channelId,
          channelName,
          creatorUsername
        }
      });

      if (response.success) {
        const description = response.description || '';
        channelDescriptions.value.set(channelId, description);
        return description;
      } else {
        throw new Error(response.message || 'Failed to get channel description');
      }
    } catch (err) {
      console.error('Error getting channel description:', err);
      error.value = err.message;
      // Return default description
      const defaultDescription = `Check out this series from ${creatorUsername || 'this creator'}`;
      channelDescriptions.value.set(channelId, defaultDescription);
      return defaultDescription;
    } finally {
      loading.value = false;
    }
  };

  // Update channel description
  const updateChannelDescription = async (channelId, channelName, creatorUsername, newDescription) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch('/api/channels/update-description', {
        method: 'POST',
        body: {
          channelId,
          channelName,
          creatorUsername,
          newDescription
        }
      });

      if (response.success) {
        // Update local cache
        channelDescriptions.value.set(channelId, newDescription);
        return response;
      } else {
        throw new Error(response.message || 'Failed to update channel description');
      }
    } catch (err) {
      console.error('Error updating channel description:', err);
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // Get description from cache (no API call)
  const getCachedDescription = (channelId) => {
    return channelDescriptions.value.get(channelId) || '';
  };

  // Clear cache for a specific channel
  const clearChannelCache = (channelId) => {
    channelDescriptions.value.delete(channelId);
  };

  // Clear all cache
  const clearAllCache = () => {
    channelDescriptions.value.clear();
  };

  return {
    channelDescriptions,
    loading,
    error,
    getChannelDescription,
    updateChannelDescription,
    getCachedDescription,
    clearChannelCache,
    clearAllCache
  };
});
