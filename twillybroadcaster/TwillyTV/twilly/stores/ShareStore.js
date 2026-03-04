import { defineStore } from 'pinia'

export const useShareStore = defineStore('shareStore', {
  state: () => ({
    shareParams: {},
    loading: false,
    error: null
  }),

  getters: {
    getShareParams: (state) => (username, series) => {
      const key = `${username}-${series}`;
      return state.shareParams[key] || null;
    }
  },

  actions: {
    async fetchShareParams(username, series) {
      const key = `${username}-${series}`;
      
      // Check if we already have it cached
      if (this.shareParams[key]) {
        console.log('[ShareStore] Using cached params for:', key);
        return this.shareParams[key];
      }

      this.loading = true;
      this.error = null;

      try {
        console.log('[ShareStore] Fetching params for:', username, series);
        
        const response = await fetch('/api/creators/get-share-params', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, series }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch share parameters');
        }

        const data = await response.json();
        
        // Cache the result
        this.shareParams[key] = data;
        
        console.log('[ShareStore] Cached params for:', key, data);
        
        return data;
      } catch (error) {
        console.error('[ShareStore] Error fetching params:', error);
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    clearCache() {
      this.shareParams = {};
    },

    clearCacheForUser(username) {
      // Remove all cached entries for a specific username
      Object.keys(this.shareParams).forEach(key => {
        if (key.startsWith(`${username}-`)) {
          delete this.shareParams[key];
        }
      });
    }
  }
}) 