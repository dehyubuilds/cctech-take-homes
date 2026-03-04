import { defineStore } from 'pinia';
import { Auth } from 'aws-amplify';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    authenticated: false,
    loading: false,
    error: null,
    userType: 'viewer', // 'producer', 'regular', 'creator', 'buyer', or 'viewer'
    authMethod: null, // 'cognito' or 'google'
    
    // Enhanced persona system
    personas: {
      master: false,
      viewer: true, // Default persona
      affiliate: false,
      creator: false
    },
    activePersona: 'viewer', // Current active persona
    personaData: {
      master: null,
      viewer: null,
      affiliate: null,
      creator: null
    },
    affiliateCode: null,
    commissionRate: 0.1, // 10% default
    activeChannel: null,
    availableChannels: []
  }),

  actions: {
    async checkAuth() {
      this.loading = true;
      try {
        const user = await Auth.currentAuthenticatedUser();
        if (user) {
          await this.loggedIn(user);
        }
      } catch (error) {
        this.user = null;
        this.authenticated = false;
        this.error = error;
        // Try to initialize from localStorage
        this.initializeAuth();
      } finally {
        this.loading = false;
      }
    },

    async loggedIn(userData, userType = null) {
      this.user = userData;
      this.authenticated = true;
      this.error = null;
      
      // ALWAYS fetch username from DynamoDB as the single source of truth
      if (userData.attributes?.email && userData.attributes?.sub) {
        try {
          const response = await fetch('/api/creators/get-username', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: userData.attributes.sub,
              email: userData.attributes.email
            })
          });
          
          const data = await response.json();
          if (data.username) {
            // Update the user object with the fetched username
            this.user.attributes.username = data.username;
          }
        } catch (error) {
          console.error('Error fetching username:', error);
        }
      }

      // Determine user type
      if (userType) {
        this.userType = userType;
      } else {
        // Default logic - can be enhanced
        this.userType = 'creator';
      }

      // Set auth method
      this.authMethod = 'cognito';

      // Store in localStorage
      if (process.client) {
        localStorage.setItem('authState', JSON.stringify({
          authenticated: true,
          user: userData,
          userType: this.userType,
          authMethod: this.authMethod
        }));
      }

      // Load fresh persona data from API
      await this.loadPersonaData();

      // Create creator record if creator or producer
      if (this.userType === 'creator' || this.userType === 'producer') {
        try {
          // Generate username from email if not provided
          const username = userData.attributes?.username || userData.attributes?.email?.split('@')[0];
          
          const response = await fetch('/api/creators/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: userData.attributes.sub,
              email: userData.attributes.email,
              name: userData.attributes?.name || '',
              username: username
            })
          });

          if (response.ok) {
            // Update user attributes with username
            if (userData.attributes?.username !== username) {
              try {
                await Auth.updateUserAttributes(userData, {
                  username: username
                });
                this.user.attributes.username = username;
              } catch (updateError) {
                console.error('Error updating username attribute:', updateError);
              }
            }
          }
        } catch (error) {
          // Ignore creator record creation errors
        }
      }
    },

    async loggedOut() {
      this.user = null;
      this.authenticated = false;
      this.error = null;
      this.userType = 'creator';
      this.authMethod = null;
      
      // Reset persona system
      this.personas = {
        master: false,
        viewer: true,
        affiliate: false,
        creator: false
      };
      this.activePersona = 'viewer';
      this.personaData = {
        master: null,
        viewer: null,
        affiliate: null,
        creator: null
      };
      this.affiliateCode = null;
      this.commissionRate = 0.1;
      this.activeChannel = null;
      this.availableChannels = [];
      
      // Clear ALL auth state and username data from localStorage
      if (process.client) {
        localStorage.removeItem('authState');
        localStorage.removeItem('userUsername');
        localStorage.removeItem('personaData');
        
        // Clear all user-specific username keys
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('userUsername_')) {
            localStorage.removeItem(key);
          }
        }
      }
    },

    // Initialize auth state from localStorage
    initializeAuth() {
      if (process.client) {
        const storedAuth = localStorage.getItem('authState');
        if (storedAuth) {
          try {
            const { authenticated, user, userType, authMethod } = JSON.parse(storedAuth);
            this.authenticated = authenticated;
            this.user = user;
            this.userType = userType;
            this.authMethod = authMethod;
            
            // Clear any old generic localStorage keys to prevent contamination
            localStorage.removeItem('userUsername');
            
            // Note: We don't restore username from localStorage here
            // Username will be fetched from DynamoDB on next login
          } catch (error) {
            localStorage.removeItem('authState');
          }
        }
        
        // Load persona data from localStorage
        const storedPersonaData = localStorage.getItem('personaData');
        if (storedPersonaData) {
          try {
            const personaData = JSON.parse(storedPersonaData);
            this.personas = personaData.personas || this.personas;
            this.personaData = personaData.personaData || this.personaData;
            this.affiliateCode = personaData.affiliateCode;
            this.commissionRate = personaData.commissionRate || 0.1;
            this.activeChannel = personaData.activeChannel;
            this.availableChannels = personaData.availableChannels || [];
            this.activePersona = personaData.activePersona || 'viewer';
          } catch (error) {
            console.error('Error loading persona data from localStorage:', error);
          }
        }
      }
    },

    // Enhanced persona management
    async loadPersonaData() {
      if (!this.authenticated || !this.user) return;
      
      
      try {
        const response = await fetch('/api/personas/get', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.user.attributes.sub,
            userEmail: this.user.attributes.email
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          this.personas = data.personas;
          this.personaData = data.personaData;
          this.affiliateCode = data.affiliateCode;
          this.commissionRate = data.commissionRate || 0.1;
          this.activeChannel = data.activeChannel;
          this.availableChannels = data.availableChannels || [];
          
          // Use activePersona from API response instead of overriding
          this.activePersona = data.activePersona || 'viewer';
          
          // Clear localStorage to prevent conflicts with API data
          if (process.client) {
            localStorage.removeItem('personaData');
          }
          
          // Store in localStorage
          if (process.client) {
            const storedData = {
              personas: this.personas,
              personaData: this.personaData,
              affiliateCode: this.affiliateCode,
              commissionRate: this.commissionRate,
              activeChannel: this.activeChannel,
              availableChannels: this.availableChannels,
              activePersona: this.activePersona
            };
            localStorage.setItem('personaData', JSON.stringify(storedData));
          }
        }
      } catch (error) {
        console.error('Error loading persona data:', error);
      }
    },

    async switchPersona(persona) {
      if (!this.personas[persona]) {
        throw new Error(`Persona ${persona} is not available`);
      }
      
      this.activePersona = persona;
      
      // Store in localStorage
      if (process.client) {
        const storedData = JSON.parse(localStorage.getItem('personaData') || '{}');
        storedData.activePersona = persona;
        localStorage.setItem('personaData', JSON.stringify(storedData));
      }
      
      // Update API
      try {
        await fetch('/api/personas/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.user.attributes.sub,
            userEmail: this.user.attributes.email,
            activePersona: persona
          })
        });
        
        // Reload persona data to ensure channels are available for all personas
        // But preserve the activePersona that was just set
        const currentActivePersona = this.activePersona;
        await this.loadPersonaData();
        this.activePersona = currentActivePersona;
      } catch (error) {
        console.error('Error switching persona:', error);
      }
    },

    async refreshAuthState() {
      try {
        const user = await Auth.currentAuthenticatedUser();
        if (user) {
          this.authenticated = true;
          this.user = user;
          console.log('Auth state refreshed successfully:', user);
          return true;
        } else {
          this.authenticated = false;
          this.user = null;
          return false;
        }
      } catch (error) {
        console.log('Auth refresh failed:', error);
        this.authenticated = false;
        this.user = null;
        return false;
      }
    },

    async activateAffiliatePersona(inviteCode) {
      try {
        const response = await fetch('/api/personas/activate-affiliate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.user.attributes.sub,
            userEmail: this.user.attributes.email,
            inviteCode: inviteCode
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          this.personas.affiliate = true;
          this.affiliateCode = data.affiliateCode;
          this.commissionRate = data.commissionRate;
          this.personaData.affiliate = data.affiliateData;
          
          // If this is their first persona activation, switch to affiliate
          if (this.activePersona === 'viewer') {
            await this.switchPersona('affiliate');
          }
          
          return { success: true, message: 'Affiliate persona activated successfully' };
        } else {
          return { success: false, message: data.message };
        }
      } catch (error) {
        console.error('Error activating affiliate persona:', error);
        return { success: false, message: 'Failed to activate affiliate persona' };
      }
    },

    async activateCreatorPersona(inviteCode) {
      try {
        const response = await fetch('/api/personas/activate-creator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.user.attributes.sub,
            userEmail: this.user.attributes.email,
            inviteCode: inviteCode
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          this.personas.creator = true;
          this.activeChannel = data.activeChannel;
          this.availableChannels = data.availableChannels;
          this.personaData.creator = data.creatorData;
          
          // If this is their first persona activation, switch to creator
          if (this.activePersona === 'viewer') {
            await this.switchPersona('creator');
          }
          
          return { success: true, message: 'Creator persona activated successfully' };
        } else {
          return { success: false, message: data.message };
        }
      } catch (error) {
        console.error('Error activating creator persona:', error);
        return { success: false, message: 'Failed to activate creator persona' };
      }
    },


    async switchCreatorChannel(channelName) {
      
      if (!this.personas.creator) {
        console.error('❌ User is not a creator, cannot switch channels');
        throw new Error('User is not a creator');
      }
      
      try {
        
        const response = await fetch('/api/personas/switch-channel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.user.attributes.sub,
            userEmail: this.user.attributes.email,
            channelName: channelName
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          this.activeChannel = channelName;
          
          // Store in localStorage
          if (process.client) {
            const storedData = JSON.parse(localStorage.getItem('personaData') || '{}');
            storedData.activeChannel = channelName;
            localStorage.setItem('personaData', JSON.stringify(storedData));
          }
          
          return { success: true };
        } else {
          console.error('❌ Channel switch failed:', data.message);
          return { success: false, message: data.message };
        }
      } catch (error) {
        console.error('❌ Error switching creator channel:', error);
        return { success: false, message: 'Failed to switch channel' };
      }
    },

    // Check if user is master account
    isMasterAccount() {
      const userEmail = this.user?.attributes?.email;
      const username = this.user?.attributes?.username;
      
      // Only dehyu.sinyan@gmail.com is the master account
      const MASTER_EMAILS = ['dehyu.sinyan@gmail.com'];
      const MASTER_USERNAMES = ['DehSin365'];
      
      return MASTER_EMAILS.includes(userEmail) || MASTER_USERNAMES.includes(username);
    },

    // Check if user can access managefiles
    canAccessManagefiles() {
      return this.isMasterAccount();
    },

    // Get current persona display name
    getCurrentPersonaDisplayName() {
      switch (this.activePersona) {
        case 'master':
          return 'Master Account';
        case 'creator':
          return 'Creator';
        case 'affiliate':
          return `Affiliate (${this.affiliateCode || 'No Code'})`;
        case 'viewer':
        default:
          return 'Viewer';
      }
    }
  },

  getters: {
    isAuthenticated: (state) => state.authenticated,
    currentUser: (state) => state.user,
    isLoading: (state) => state.loading,
    authError: (state) => state.error,
    isProducer: (state) => state.userType === 'producer',
    isBuyer: (state) => state.userType === 'regular'
  }
});