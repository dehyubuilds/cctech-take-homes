import { defineStore } from 'pinia'

export const useTalentRequestsStore = defineStore('talentRequests', {
  state: () => ({
    requests: [],
    isLoading: false,
    error: null,
    lastLoaded: null,
    channelPosterUrl: null
  }),

  getters: {
    acceptingPilots: (state) => state.requests.filter(r => r.status === 'accepting_pilots' && !r.SK?.includes('APPLICATION#')),
    castingClosed: (state) => state.requests.filter(r => r.status === 'casting_closed' && !r.SK?.includes('APPLICATION#')),
    scheduled: (state) => state.requests.filter(r => r.status === 'scheduled' && !r.SK?.includes('APPLICATION#')),
    totalRequests: (state) => state.requests.filter(r => !r.SK?.includes('APPLICATION#')).length,
    hasRequests: (state) => state.requests.filter(r => !r.SK?.includes('APPLICATION#')).length > 0,
    
    // Get requests by status
    getRequestsByStatus: (state) => (status) => {
      return state.requests.filter(r => r.status === status && !r.SK?.includes('APPLICATION#'))
    },
    

    
    // Get requests by channel
    getRequestsByChannel: (state) => (channel) => {
      return state.requests.filter(r => r.channel === channel && !r.SK?.includes('APPLICATION#'))
    },
    
    // Get request by ID from store (synchronous)
    getRequestFromStore: (state) => (id) => {
      return state.requests.find(r => r.id === id && !r.SK?.includes('APPLICATION#'))
    }
  },

  actions: {
    async loadUserRequests(userEmail) {
      this.isLoading = true
      this.error = null
      
      try {
        const response = await $fetch('/api/talent-requests/get-user-requests', {
          method: 'POST',
          body: { userEmail }
        })
        
        if (response.success) {
          this.requests = response.talentRequests || []
          this.lastLoaded = new Date().toISOString()
          this.saveToLocalStorage()
          console.log('Loaded talent requests:', this.requests.length)
        } else {
          this.requests = []
          this.error = response.message || 'Failed to load requests'
        }
      } catch (error) {
        console.error('Error loading talent requests:', error)
        this.error = error.message || 'Failed to load requests'
        this.requests = []
      } finally {
        this.isLoading = false
      }
    },

    async loadRequestsByChannel(userEmail, channel) {
      this.isLoading = true
      this.error = null
      
      try {
        const response = await $fetch('/api/talent-requests/get-user-requests', {
          method: 'POST',
          body: { userEmail }
        })
        
        if (response.success) {
          // Filter requests by channel
          this.requests = (response.talentRequests || []).filter(r => r.channel === channel)
          this.lastLoaded = new Date().toISOString()
          this.saveToLocalStorage()
          console.log('Loaded talent requests for channel:', channel, this.requests.length)
        } else {
          this.requests = []
          this.error = response.message || 'Failed to load requests'
        }
      } catch (error) {
        console.error('Error loading talent requests by channel:', error)
        this.error = error.message || 'Failed to load requests'
        this.requests = []
      } finally {
        this.isLoading = false
      }
    },

    async loadPublicRequestsByChannel(creatorUsername, channel) {
      this.isLoading = true
      this.error = null
      
      try {
        const response = await $fetch('/api/talent-requests/public-by-channel', {
          method: 'POST',
          body: { creatorUsername, channel }
        })
        
        if (response.success) {
          this.requests = response.requests || []
          this.lastLoaded = new Date().toISOString()
          this.saveToLocalStorage()
          
          // Store the channel poster URL for public access
          this.channelPosterUrl = response.channelPosterUrl || null
          
          console.log('Loaded public talent requests by channel:', this.requests.length)
          console.log('Channel poster URL:', this.channelPosterUrl)
        } else {
          this.requests = []
          this.error = response.message || 'Failed to load public requests'
        }
      } catch (error) {
        console.error('Error loading public talent requests by channel:', error)
        this.error = error.message || 'Failed to load public requests'
        this.requests = []
      } finally {
        this.isLoading = false
      }
    },

    async createRequest(requestData) {
      try {
        const response = await $fetch('/api/talent-requests/create', {
          method: 'POST',
          body: requestData
        })
        
        if (response.success) {
          // Add the new request to the store
          const newRequest = {
            ...requestData,
            id: response.requestId,
            slug: response.slug,
            status: 'accepting_pilots',
            applications: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          
          this.requests.unshift(newRequest)
          this.saveToLocalStorage()
          
          return { success: true, request: newRequest }
        } else {
          return { success: false, message: response.message }
        }
      } catch (error) {
        console.error('Error creating talent request:', error)
        return { success: false, message: error.message || 'Failed to create request' }
      }
    },

    async updateRequestStatus(requestId, newStatus) {
      try {
        const response = await $fetch('/api/talent-requests/update-status', {
          method: 'POST',
          body: { requestId, status: newStatus }
        })
        
        if (response.success) {
          // Update the request in the store
          const requestIndex = this.requests.findIndex(r => r.id === requestId)
          if (requestIndex !== -1) {
            this.requests[requestIndex].status = newStatus
            this.requests[requestIndex].updatedAt = new Date().toISOString()
            this.saveToLocalStorage()
          }
          
          return { success: true }
        } else {
          return { success: false, message: response.message }
        }
      } catch (error) {
        console.error('Error updating request status:', error)
        return { success: false, message: error.message || 'Failed to update status' }
      }
    },

    async updateRequest(requestId, requestData) {
      try {
        console.log('Store: Updating request with data:', { requestId, requestData })
        
        // Extract only the form fields, excluding requestId
        const { requestId: _, ...formFields } = requestData
        
        console.log('Store: Form fields being sent to API:', formFields)
        console.log('Store: Project title being sent:', formFields.projectTitle)
        
        const response = await $fetch('/api/talent-requests/update', {
          method: 'POST',
          body: { requestId, ...formFields }
        })
        
        console.log('Store: API response:', response)
        
        if (response.success) {
          // Update the request in the store
          const requestIndex = this.requests.findIndex(r => r.id === requestId)
          if (requestIndex !== -1) {
            this.requests[requestIndex] = {
              ...this.requests[requestIndex],
              ...requestData,
              updatedAt: new Date().toISOString()
            }
            this.saveToLocalStorage()
            console.log('Store: Request updated in store:', this.requests[requestIndex])
          } else {
            console.log('Store: Request not found in store for ID:', requestId)
          }
          
          return { success: true }
        } else {
          return { success: false, message: response.message }
        }
      } catch (error) {
        console.error('Error updating talent request:', error)
        return { success: false, message: error.message || 'Failed to update request' }
      }
    },

    // Get request by ID from database (async, updates store)
    async getRequestById(requestId) {
      try {
        console.log('Store: Fetching fresh request data for ID:', requestId)
        
        const response = await $fetch('/api/talent-requests/get-by-id', {
          method: 'POST',
          body: { requestId }
        })
        
        console.log('Store: Get by ID response:', response)
        
        if (response.success && response.request) {
          // Update the request in the store if it exists
          const requestIndex = this.requests.findIndex(r => r.id === requestId)
          if (requestIndex !== -1) {
            this.requests[requestIndex] = response.request
            this.saveToLocalStorage()
            console.log('Store: Request updated in store from fresh data')
          }
          
          return response.request
        } else {
          console.log('Store: Request not found in database')
          return null
        }
      } catch (error) {
        console.error('Error fetching request by ID:', error)
        return null
      }
    },
    
    // Get request by ID from store (synchronous, immediate access)
    getRequestByIdSync(requestId) {
      return this.requests.find(r => r.id === requestId)
    },

    async deleteRequest(requestId) {
      try {
        console.log('Store: deleteRequest called with requestId:', requestId)
        console.log('Store: requestId type:', typeof requestId)
        console.log('Store: requestId value:', requestId)
        
        // Handle null/undefined requestId
        if (!requestId) {
          console.error('Store: requestId is null or undefined, cannot delete')
          return { success: false, message: 'Request ID is required' }
        }
        
        console.log('Store: Sending request body:', { requestId })
        
        console.log('Store: About to make $fetch call with body:', { requestId })
        const response = await $fetch('/api/talent-requests/delete', {
          method: 'POST',
          body: { requestId }
        })
        
        console.log('Store: API response:', response)
        
        if (response.success) {
          // Remove the request from the store
          this.requests = this.requests.filter(r => r.id !== requestId)
          this.saveToLocalStorage()
          
          return { success: true }
        } else {
          return { success: false, message: response.message }
        }
      } catch (error) {
        console.error('Error deleting talent request:', error)
        return { success: false, message: error.message || 'Failed to delete request' }
      }
    },

    async deleteApplication(requestId, applicationId) {
      try {
        console.log('Store: deleteApplication called with requestId:', requestId, 'applicationId:', applicationId)
        
        // Handle null/undefined parameters
        if (!requestId || !applicationId) {
          console.error('Store: requestId or applicationId is null or undefined, cannot delete')
          return { success: false, message: 'Request ID and Application ID are required' }
        }
        
        console.log('Store: Sending request body:', { requestId, applicationId })
        
        const response = await $fetch('/api/talent-requests/delete-application', {
          method: 'POST',
          body: { requestId, applicationId }
        })
        
        console.log('Store: API response:', response)
        
        if (response.success) {
          // Remove the application from the store
          const request = this.requests.find(r => r.id === requestId)
          if (request && request.applications) {
            request.applications = request.applications.filter(a => a.applicationId !== applicationId)
            this.saveToLocalStorage()
          }
          
          return { success: true }
        } else {
          return { success: false, message: response.message }
        }
      } catch (error) {
        console.error('Error deleting application:', error)
        return { success: false, message: error.message || 'Failed to delete application' }
      }
    },

    async getApplications(requestId) {
      try {
        const response = await $fetch('/api/talent-requests/get-applications', {
          method: 'POST',
          body: { requestId }
        })
        
        if (response.success) {
          return { success: true, applications: response.applications }
        } else {
          return { success: false, message: response.message }
        }
      } catch (error) {
        console.error('Error getting applications:', error)
        return { success: false, message: error.message || 'Failed to get applications' }
      }
    },

    async approveApplication(requestId, applicationId) {
      try {
        const response = await $fetch('/api/talent-requests/approve-application', {
          method: 'POST',
          body: { requestId, applicationId }
        })
        
        if (response.success) {
          // Update the application status in the store
          const request = this.requests.find(r => r.id === requestId)
          if (request && request.applications) {
            const application = request.applications.find(a => a.applicationId === applicationId)
            if (application) {
              application.status = 'approved'
              application.updatedAt = new Date().toISOString()
              this.saveToLocalStorage()
            }
          }
          
          return { success: true }
        } else {
          return { success: false, message: response.message }
        }
      } catch (error) {
        console.error('Error approving application:', error)
        return { success: false, message: error.message || 'Failed to approve application' }
      }
    },

    async rejectApplication(requestId, applicationId) {
      try {
        const response = await $fetch('/api/talent-requests/reject-application', {
          method: 'POST',
          body: { requestId, applicationId }
        })
        
        if (response.success) {
          // Update the application status in the store
          const request = this.requests.find(r => r.id === requestId)
          if (request && request.applications) {
            const application = request.applications.find(a => a.applicationId === applicationId)
            if (application) {
              application.status = 'rejected'
              application.updatedAt = new Date().toISOString()
              this.saveToLocalStorage()
            }
          }
          
          return { success: true }
        } else {
          return { success: false, message: response.message }
        }
      } catch (error) {
        console.error('Error rejecting application:', error)
        return { success: false, message: error.message || 'Failed to reject application' }
      }
    },

    async submitApplication(requestId, applicationData) {
      try {
        const response = await $fetch('/api/talent-requests/submit-application', {
          method: 'POST',
          body: { 
            requestId, 
            ...applicationData 
          }
        })
        
        if (response.success) {
          // Add the application to the request in the store
          const request = this.requests.find(r => r.id === requestId)
          if (request) {
            if (!request.applications) {
              request.applications = []
            }
            
            const newApplication = {
              applicationId: response.applicationId,
              ...applicationData,
              status: 'pending',
              submittedAt: new Date().toISOString()
            }
            
            request.applications.push(newApplication)
            this.saveToLocalStorage()
          }
          
          return { success: true, applicationId: response.applicationId }
        } else {
          return { success: false, message: response.message }
        }
      } catch (error) {
        console.error('Error submitting application:', error)
        return { success: false, message: error.message || 'Failed to submit application' }
      }
    },

    // Local storage persistence
    saveToLocalStorage() {
      if (process.client) {
        try {
          localStorage.setItem('talentRequests', JSON.stringify({
            requests: this.requests,
            lastLoaded: this.lastLoaded
          }))
        } catch (error) {
          console.error('Error saving to localStorage:', error)
        }
      }
    },

    loadFromLocalStorage() {
      if (process.client) {
        try {
          const stored = localStorage.getItem('talentRequests')
          if (stored) {
            const data = JSON.parse(stored)
            this.requests = data.requests || []
            this.lastLoaded = data.lastLoaded
          }
        } catch (error) {
          console.error('Error loading from localStorage:', error)
        }
      }
    },

    // Clear store
    clear() {
      this.requests = []
      this.error = null
      this.lastLoaded = null
      if (process.client) {
        localStorage.removeItem('talentRequests')
      }
    },

    // Check if data should be reloaded
    shouldReload() {
      if (!this.lastLoaded) return true
      const now = new Date()
      const lastLoaded = new Date(this.lastLoaded)
      const diffInMinutes = (now - lastLoaded) / (1000 * 60)
      return diffInMinutes > 5 // Reload if data is older than 5 minutes
    }
  }
})
