import { defineStore } from 'pinia'

export const useCollaboratorRequestsStore = defineStore('collaboratorRequests', {
  state: () => ({
    requests: [],
    isLoading: false,
    error: null,
    lastLoaded: null
  }),



  getters: {
    pendingRequests: (state) => state.requests.filter(r => r.status === 'pending'),
    approvedRequests: (state) => state.requests.filter(r => r.status === 'approved'),
    rejectedRequests: (state) => state.requests.filter(r => r.status === 'rejected'),
    totalRequests: (state) => state.requests.length,
    hasRequests: (state) => state.requests.length > 0
  },

  actions: {
    async loadRequests(userEmail, username = null) {
      this.isLoading = true
      this.error = null
      
      try {
        let response
        
        if (username) {
          // Use username to find requests
          response = await $fetch('/api/collaborations/get-requests', {
            method: 'POST',
            body: { username }
          })
        } else {
          // Use email directly
          response = await $fetch('/api/collaborations/get-requests', {
            method: 'POST',
            body: { userEmail }
          })
        }
        
        if (response.success) {
          this.requests = response.requests || []
          this.lastLoaded = new Date().toISOString()
          this.saveToLocalStorage()
          console.log('Loaded collaborator requests:', this.requests.length)
        } else {
          this.requests = []
          this.error = response.message || 'Failed to load requests'
        }
      } catch (error) {
        console.error('Error loading collaborator requests:', error)
        this.error = error.message || 'Failed to load requests'
        this.requests = []
      } finally {
        this.isLoading = false
      }
    },

    async updateRequestStatus(requestId, status) {
      try {
        const response = await $fetch('/api/collaborations/update-status', {
          method: 'POST',
          body: { requestId, status }
        })
        
        if (response.success) {
          // Update the request in local state
          const requestIndex = this.requests.findIndex(r => r.requestId === requestId)
          if (requestIndex !== -1) {
            if (status === 'notified') {
              // Add notified field without changing status
              this.requests[requestIndex].notified = true
              this.requests[requestIndex].updatedAt = new Date().toISOString()
            } else {
              // Update status
              this.requests[requestIndex].status = status
              this.requests[requestIndex].updatedAt = new Date().toISOString()
            }
          }
          return { success: true }
        } else {
          throw new Error(response.message || 'Failed to update request')
        }
      } catch (error) {
        console.error('Error updating request status:', error)
        throw error
      }
    },

    async approveRequest(requestId) {
      return await this.updateRequestStatus(requestId, 'approved')
    },

    async rejectRequest(requestId) {
      return await this.updateRequestStatus(requestId, 'rejected')
    },

    async markAsNotified(requestId) {
      return await this.updateRequestStatus(requestId, 'notified')
    },

    async deleteRequest(requestId) {
      try {
        const response = await $fetch('/api/collaborations/delete-request', {
          method: 'POST',
          body: { requestId }
        })
        
        if (response.success) {
          // Remove the request from local state
          this.requests = this.requests.filter(r => r.requestId !== requestId)
          return { success: true }
        } else {
          throw new Error(response.message || 'Failed to delete request')
        }
      } catch (error) {
        console.error('Error deleting request:', error)
        throw error
      }
    },

    // Check if we need to reload (e.g., if data is stale)
    shouldReload() {
      if (!this.lastLoaded) return true
      
      const now = new Date()
      const lastLoaded = new Date(this.lastLoaded)
      const diffInMinutes = (now - lastLoaded) / (1000 * 60)
      
      // Reload if data is older than 5 minutes
      return diffInMinutes > 5
    },

    // Save to localStorage
    saveToLocalStorage() {
      if (process.client) {
        localStorage.setItem('collaboratorRequests', JSON.stringify({
          requests: this.requests,
          lastLoaded: this.lastLoaded
        }))
      }
    },

    // Load from localStorage
    loadFromLocalStorage() {
      if (process.client) {
        try {
          const saved = localStorage.getItem('collaboratorRequests')
          if (saved) {
            const data = JSON.parse(saved)
            this.requests = data.requests || []
            this.lastLoaded = data.lastLoaded || null
            console.log('Loaded collaborator requests from localStorage:', this.requests.length)
          }
        } catch (error) {
          console.error('Error loading from localStorage:', error)
        }
      }
    },

    // Clear all data
    clear() {
      this.requests = []
      this.isLoading = false
      this.error = null
      this.lastLoaded = null
      if (process.client) {
        localStorage.removeItem('collaboratorRequests')
      }
    }
  }
}) 