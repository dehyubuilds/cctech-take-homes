<script setup>
import { Auth } from "aws-amplify";
import { useAuthStore } from "~/stores/auth";
import { Authenticator } from "@aws-amplify/ui-vue";
import "@aws-amplify/ui-vue/styles.css";
import Modal from '~/components/Modal.vue';
import auth2FA from '~/utils/auth2fa';
import { useRoute } from 'vue-router';
import ProfileSwitch from '~/components/ProfileSwitch.vue';

// Get AWS config from runtime config
const runtimeConfig = useRuntimeConfig();
const awsConfig = runtimeConfig.public.awsConfig;

// Log the configuration being used

const authStore = useAuthStore();
const currentRoute = useRoute();
const showProfileMenu = ref(false);
const showAuthModal = ref(false);
const show2FAModal = ref(false);
const isLoading = ref(false);
const codeSent = ref(false);
const isVerified = ref(false);
const verificationCode = ref('');
const form = ref({
  phone: ''
});
const showPWAInstall = ref(false);

// Add new refs for retry handling
const retryCountdown = ref(0);
const retryTimer = ref(null);

// Add new ref to track if we're in account setup
const isAccountSetup = ref(false);

// Add isProducerPage computed property
const isProducerPage = computed(() => {
  return useRoute().path === '/producer';
});

// Watch for auth state changes - only log on actual changes, not on mount
watch(() => authStore.isAuthenticated, (newValue, oldValue) => {
  if (oldValue !== undefined) { // Only log if this isn't the initial setup
  }
});

// PWA Install function
const installPWA = () => {
  if (window.$pwa && window.$pwa.install) {
    window.$pwa.install();
  }
};

// Remove the auth initialization from onMounted
onMounted(() => {
  if (!process.client) return;
  
  try {
    const route = useRoute();
    if (route) {
      watch(() => route.path, (newPath) => {
        const hasTempData = localStorage.getItem('tempPhone') !== null && localStorage.getItem('tempCode') !== null;
        // Only set isAccountSetup to true if we're not authenticated and have temp data
        isAccountSetup.value = newPath === '/user/profile' && hasTempData && !authStore.authenticated;
      }, { immediate: true });
    }
  } catch (error) {
    console.error('Error setting up route watcher:', error);
  }

  // PWA install prompt listener
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    showPWAInstall.value = true;
  });
});

// Add function to start retry countdown
const startRetryCountdown = (seconds) => {
  retryCountdown.value = seconds;
  if (retryTimer.value) {
    clearInterval(retryTimer.value);
  }
  retryTimer.value = setInterval(() => {
    if (retryCountdown.value > 0) {
      retryCountdown.value--;
    } else {
      clearInterval(retryTimer.value);
      retryTimer.value = null;
    }
  }, 1000);
};

// Clean up timer on component unmount
onUnmounted(() => {
  if (retryTimer.value) {
    clearInterval(retryTimer.value);
  }
});

const avatarImageSource = computed(() => {
  return authStore.authenticated 
    ? 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjM0JGRkZGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMCIgcj0iNCIvPjxwYXRoIGQ9Ik0yMCAyMGE4IDggMCAwIDAtMTYgMCIvPjwvc3ZnPg==' 
    : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZGRkZGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMCIgcj0iNCIvPjxwYXRoIGQ9Ik0yMCAyMGE4IDggMCAwIDAtMTYgMCIvPjwvc3ZnPg==';
});

const verifyLoggedIn = async () => {
  try {
    const user = await Auth.currentAuthenticatedUser();
    if (user) {
      await authStore.loggedIn();
    }
  } catch (error) {
    const currentRoute = window.location.pathname;
    if (currentRoute.startsWith("/channel") || currentRoute.startsWith("/addcustomurl")) {
      await authStore.loggedOut();
      return;
    }
  }
};

onMounted(async () => {
  try {
    await authStore.checkAuth();
  } catch (error) {
    console.error('Error checking auth state:', error);
  }
});

const navigateToProfile = () => {
  // Safety check to ensure currentRoute exists
  if (!currentRoute || !currentRoute.path) {
    console.log('Route not available, defaulting to managefiles');
    navigateTo("/managefiles");
    return;
  }
  
  console.log('Navigation clicked! Current route:', currentRoute.path);
  
  // Simple toggle: if on profile, go to managefiles; if on managefiles, go to profile
  if (currentRoute.path === '/managefiles') {
    console.log('Currently on managefiles, navigating to profile');
    navigateTo("/profile");
  } else {
    console.log('Currently on profile (or other page), navigating to managefiles');
    navigateTo("/managefiles");
  }
};

const logout = async () => {
  try {
    console.log('Starting logout process');
    await Auth.signOut();
    await authStore.loggedOut();
    
    // Reset all modal states and form data
    show2FAModal.value = false;
    showAuthModal.value = false;
    showProfileMenu.value = false;
    codeSent.value = false;
    isVerified.value = false;
    showPasswordInput.value = false;
    form.value.phone = '';
    verificationCode.value = '';
    password.value = '';
    
    console.log('Logout successful - forcing page reload');
    // Force a full page reload to ensure proper rendering on mobile
    if (process.client) {
      window.location.href = '/';
    }
  } catch (error) {
    console.error("Error in signOut:", error);
  }
};

const toggleProfileMenu = () => {
  showProfileMenu.value = !showProfileMenu.value;
};

const closeProfileMenu = () => {
  showProfileMenu.value = false;
};

// 2FA Functions
function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

function formatPhoneForCognito(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.startsWith('1') ? `+${cleaned}` : `+1${cleaned}`;
}

const showVerification = ref(false);

const handleSignIn = async () => {
  try {
    // Check if already authenticated
    if (authStore.authenticated) {
      console.log('User already authenticated, skipping 2FA');
      return;
    }

    isLoading.value = true;
    // Format phone number as username (E.164 format)
    const phone = form.value.phone.replace(/\D/g, '');
    const username = `+1${phone}`;
    console.log('Attempting sign in with username:', username);

    // Send verification code via Twilio
    const twilioResponse = await $fetch('/api/twilio/verify', {
      method: 'POST',
      body: {
        phone: username,
        action: 'send'
      }
    });

    if (twilioResponse.success) {
      codeSent.value = true;
      show2FAModal.value = true;
      showVerification.value = true;
      errorMessage.value = '';
    } else {
      throw new Error(twilioResponse.error || 'Failed to send verification code');
    }
  } catch (error) {
    console.error('Error during sign in:', error);
    errorMessage.value = error.message || 'An error occurred during sign in';
  } finally {
    isLoading.value = false;
  }
};

const verifyCode = async () => {
  try {
    if (!form.value.phone || !verificationCode.value) {
      errorMessage.value = 'Please enter both phone number and verification code';
      return;
    }

    console.log('Verifying code for:', form.value.phone);
    const phone = form.value.phone.replace(/\D/g, '');
    const username = `+1${phone}`;

    // Only proceed with verification if we're in the verification state
    if (!codeSent.value || !showVerification.value) {
      return;
    }

    // Verify the Twilio code
    const verifyResponse = await $fetch('/api/twilio/verify', {
      method: 'POST',
      body: {
        phone: username,
        code: verificationCode.value,
        action: 'verify'
      }
    });

    if (!verifyResponse.success) {
      throw new Error(verifyResponse.error || 'Verification failed');
    }

    // After Twilio verification, authenticate with Cognito
    const authResponse = await $fetch('/api/auth/verify', {
      method: 'POST',
      body: {
        action: 'authenticate',
        phoneNumber: username
      }
    });

    if (authResponse.success) {
      console.log('Authentication successful');
      // Create a user object with the necessary attributes
      const user = {
        username: username,
        attributes: {
          phone_number: username
        }
      };
      
      // Update auth state with user info
      authStore.user = user;
      await authStore.loggedIn(user);
      
      // Then close modals and reset form
      show2FAModal.value = false;
      showVerification.value = false;
      form.value.phone = '';
      verificationCode.value = '';
      errorMessage.value = '';
      
      // Navigate to dashboard
      navigateTo('/dashboard');
    } else {
      throw new Error(authResponse.error || 'Authentication failed');
    }
  } catch (error) {
    console.error('Error during verification:', error);
    // Only show error if we're actually in the verification process
    if (codeSent.value && showVerification.value) {
      errorMessage.value = error.message || 'An error occurred during verification';
    }
  }
};

const handlePasswordSubmit = async () => {
  try {
    isLoading.value = true;
    const phone = form.value.phone.replace(/\D/g, '');
    const username = `+1${phone}`;
    
    const response = await $fetch('/api/auth/verify', {
      method: 'POST',
      body: {
        action: 'authenticate',
        phoneNumber: username,
        password: password.value
      }
    });

    if (response.success) {
      console.log('Authentication successful');
      await authStore.loggedIn();
      show2FAModal.value = false;
      form.value.phone = '';
      verificationCode.value = '';
      password.value = '';
      codeSent.value = false;
      showPasswordInput.value = false;
      navigateTo('/dashboard');
    } else {
      throw new Error(response.error || 'Authentication failed');
    }
  } catch (error) {
    console.error('Password sign in error:', error);
    alert(error.message || 'Invalid password');
  } finally {
    isLoading.value = false;
  }
};

// Add new refs
const showPasswordInput = ref(false);
const password = ref('');
const errorMessage = ref('');

const services = {
  async handleSignIn(formData) {
    let { username, password } = formData;
    username = username.toLowerCase();
    await Auth.signIn({
      username,
      password,
    });
    await authStore.loggedIn();
    showAuthModal.value = false;
    navigateTo("/profile");
  },
};

const handleSignOut = async () => {
  try {
    await Auth.signOut();
    await authStore.logout();
    navigateTo('/');
  } catch (error) {
    console.error('Error signing out:', error);
  }
};

const showDrawer = ref(false);

const toggleDrawer = () => {
  showDrawer.value = !showDrawer.value;
};

const closeDrawer = () => {
  showDrawer.value = false;
};

// Role switching functions
const switchToCreator = () => {
  authStore.userType = 'creator';
  // Navigate to creator dashboard
  navigateTo('/profile');
};

const switchToBuyer = () => {
  authStore.userType = 'buyer';
  // Navigate to channel guide page
  navigateTo('/channel-guide');
};

// Close drawer when clicking outside
const handleClickOutside = (event) => {
  const drawer = document.getElementById('nav-drawer');
  const button = document.getElementById('nav-button');
  if (drawer && !drawer.contains(event.target) && !button.contains(event.target)) {
    closeDrawer();
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <header
    class="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-3 sm:px-4 py-2 sm:py-3 bg-black/20 backdrop-blur-md border-b border-white/10"
  >
    <button
      v-if="authStore.authenticated"
      @click="navigateToProfile"
      type="button"
      class="flex items-center space-x-2 text-white/80 hover:text-white transition-all duration-300 transform hover:scale-105 cursor-pointer"
    >
      <Icon 
        class="w-6 h-6 sm:w-7 sm:h-7" 
        :name="currentRoute.path === '/managefiles' ? 'heroicons:user' : 'heroicons:square-3-stack-3d'" 
      />
    </button>
    
    <nuxt-link
      v-else
      to="/home"
      class="text-white/80 hover:text-white transition-all duration-300 transform hover:scale-105"
    >
      <div class="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-r from-teal-400 to-cyan-400 rounded flex items-center justify-center">
        <div class="flex items-end gap-0.5 h-3">
          <div class="w-0.5 bg-black rounded-sm bar-1" style="height:4px;animation:stream-pulse 1.5s ease-in-out infinite;"></div>
          <div class="w-0.5 bg-black rounded-sm bar-2" style="height:6px;animation:stream-pulse 1.5s ease-in-out infinite 0.1s;"></div>
          <div class="w-0.5 bg-black rounded-sm bar-3" style="height:8px;animation:stream-pulse 1.5s ease-in-out infinite 0.2s;"></div>
          <div class="w-0.5 bg-black rounded-sm bar-4" style="height:5px;animation:stream-pulse 1.5s ease-in-out infinite 0.3s;"></div>
          <div class="w-0.5 bg-black rounded-sm bar-5" style="height:4px;animation:stream-pulse 1.5s ease-in-out infinite 0.4s;"></div>
          <div class="w-0.5 bg-black rounded-sm bar-6" style="height:7px;animation:stream-pulse 1.5s ease-in-out infinite 0.5s;"></div>
          <div class="w-0.5 bg-black rounded-sm bar-7" style="height:3px;animation:stream-pulse 1.5s ease-in-out infinite 0.6s;"></div>
          <div class="w-0.5 bg-black rounded-sm bar-8" style="height:8px;animation:stream-pulse 1.5s ease-in-out infinite 0.7s;"></div>
          <div class="w-0.5 bg-black rounded-sm bar-9" style="height:4px;animation:stream-pulse 1.5s ease-in-out infinite 0.8s;"></div>
        </div>
      </div>
    </nuxt-link>

    <div class="flex items-center space-x-3 sm:space-x-4">
      <!-- PWA Install Button -->
      <button
        v-if="showPWAInstall"
        @click="installPWA"
        class="px-3 py-1.5 text-xs bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 hover:text-teal-200 transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[32px] touch-manipulation mr-2"
      >
        <Icon name="heroicons:arrow-down-tray" class="w-3 h-3 mr-1" />
        <span class="hidden sm:inline">Install</span>
      </button>
      
      <!-- Role Switcher for Authenticated Users -->
      <div v-if="authStore.authenticated" class="flex items-center space-x-2">
        <button
          @click="switchToCreator"
          class="px-2 py-1 text-xs rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[32px] touch-manipulation"
          :class="[
            authStore.userType === 'creator' 
              ? 'bg-white/20 text-white border border-white/30' 
              : 'bg-white/10 text-white/60 border border-white/20 hover:bg-white/15 hover:text-white/80'
          ]"
        >
          <Icon name="heroicons:bars-3" class="w-3 h-3 mr-1" />
          <span class="hidden sm:inline">Studio</span>
        </button>
        
        <button
          @click="switchToBuyer"
          class="px-2 py-1 text-xs rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[32px] touch-manipulation"
          :class="[
            authStore.userType === 'buyer' 
              ? 'bg-white/20 text-white border border-white/30' 
              : 'bg-white/10 text-white/60 border border-white/20 hover:bg-white/15 hover:text-white/80'
          ]"
        >
          <Icon name="heroicons:map" class="w-3 h-3 mr-1" />
          <span class="hidden sm:inline">Channel Guide</span>
        </button>
      </div>
      
      <ProfileSwitch v-if="authStore.authenticated" />
      
      <button
        v-if="!authStore.authenticated && !isAccountSetup && !isProducerPage"
        @click="navigateTo('/signin')"
        class="px-3 py-1.5 text-xs bg-white/10 text-white/80 border border-white/20 rounded-lg hover:bg-white/15 hover:text-white transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[32px] touch-manipulation"
      >
        Sign In
      </button>
      <button
        v-else-if="authStore.authenticated"
        @click="logout"
        class="px-3 py-1.5 text-xs bg-white/10 text-white/80 border border-white/20 rounded-lg hover:bg-white/15 hover:text-white transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[32px] touch-manipulation"
      >
        Sign Out
      </button>

      <div v-if="authStore.authenticated" class="relative">
        <button
          id="profile-button"
          @click.stop="toggleProfileMenu"
          class="header__menu--profile-link"
        >
          <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-white/20 hover:border-white/40 transition-all duration-300 transform hover:scale-105">
            <img 
              class="w-full h-full object-cover transform rotate-0"
              :src="avatarImageSource" 
              alt="Profile"
            />
          </div>
        </button>

        <!-- Dropdown Menu -->
        <div
          v-if="showProfileMenu"
          id="profile-menu"
          class="absolute right-0 mt-2 w-48 rounded-xl bg-black/95 backdrop-blur-sm border border-teal-900/30 shadow-lg py-2 z-50"
        >
          <nuxt-link
            to="/account"
            @click="closeProfileMenu"
            class="block w-full text-left px-4 py-2 text-white hover:bg-teal-500/20 transition-all duration-300"
          >
            Account Settings
          </nuxt-link>


          <button
            @click="logout"
            class="block w-full text-left px-4 py-2 text-red-400 hover:bg-red-500/20 transition-all duration-300"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>

    <!-- Navigation Drawer -->
    <div
      v-if="showDrawer"
      id="nav-drawer"
      class="fixed inset-0 z-50 overflow-hidden"
    >
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeDrawer"></div>
      
      <div 
        class="absolute inset-y-0 right-0 w-full max-w-md bg-gradient-to-br from-[#084d5d] to-black transform transition-transform duration-300 ease-in-out"
        :class="showDrawer ? 'translate-x-0' : 'translate-x-full'"
      >
        <div class="flex flex-col h-full">
          <!-- Header -->
          <div class="p-6 border-b border-teal-900/30">
            <h2 class="text-2xl font-bold text-white">
              <span class="text-teal-400">Content Creator</span> Studio
            </h2>
            <p class="text-gray-300 mt-2">Manage your content and collaborations</p>
          </div>

          <!-- Navigation Items -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <!-- Create Content Section -->
            <div class="space-y-4">
              <h3 class="text-xl font-semibold text-white flex items-center">
                <Icon name="ph:pencil-simple" class="w-6 h-6 mr-3 text-teal-400" />
                Create Content
              </h3>
              <div class="space-y-3">
                <nuxt-link
                  to="/uploadchannel"
                  @click="closeDrawer"
                  class="flex items-center justify-between p-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-300 group transform hover:scale-105 active:scale-95"
                >
                  <span class="flex items-center">
                    <Icon name="material-symbols:upload" class="w-5 h-5 mr-3" />
                    Upload New Content
                  </span>
                  <Icon name="heroicons:arrow-right" class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </nuxt-link>

                <nuxt-link
                  to="/managefiles"
                  @click="closeDrawer"
                  class="flex items-center justify-between p-4 bg-gradient-to-r from-[#084d5d] to-[#0a5d70] text-white rounded-lg hover:from-[#0a5d70] hover:to-[#0c6d84] transition-all duration-300 group transform hover:scale-105 active:scale-95"
                >
                  <span class="flex items-center">
                    <Icon name="material-symbols:folder" class="w-5 h-5 mr-3" />
                    Manage Content
                  </span>
                  <Icon name="heroicons:arrow-right" class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </nuxt-link>

                <nuxt-link
                  to="/rtmp-keys"
                  @click="closeDrawer"
                  class="flex items-center justify-between p-4 bg-gradient-to-r from-[#084d5d] to-[#0a5d70] text-white rounded-lg hover:from-[#0a5d70] hover:to-[#0c6d84] transition-all duration-300 group transform hover:scale-105 active:scale-95"
                >
                  <span class="flex items-center">
                    <Icon name="heroicons:key" class="w-5 h-5 mr-3" />
                    RTMP Keys
                  </span>
                  <Icon name="heroicons:arrow-right" class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </nuxt-link>
              </div>
            </div>

            <!-- Insights Section -->
            <div class="space-y-4">
              <h3 class="text-xl font-semibold text-white flex items-center">
                <Icon name="ph:chart-line-up" class="w-6 h-6 mr-3 text-teal-400" />
                Insights
              </h3>
              <div class="space-y-3">
                <nuxt-link
                  to="/analytics"
                  @click="closeDrawer"
                  class="flex items-center justify-between p-4 bg-gradient-to-r from-[#084d5d] to-[#0a5d70] text-white rounded-lg hover:from-[#0a5d70] hover:to-[#0c6d84] transition-all duration-300 group transform hover:scale-105 active:scale-95"
                >
                  <span class="flex items-center">
                    <Icon name="material-symbols:analytics" class="w-5 h-5 mr-3" />
                    View Analytics
                  </span>
                  <Icon name="heroicons:arrow-right" class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </nuxt-link>

                <nuxt-link
                  to="/collaborations"
                  @click="closeDrawer"
                  class="flex items-center justify-between p-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-300 group transform hover:scale-105 active:scale-95"
                >
                  <span class="flex items-center">
                    <Icon name="material-symbols:group" class="w-5 h-5 mr-3" />
                    Manage Collaborations
                  </span>
                  <Icon name="heroicons:arrow-right" class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </nuxt-link>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-6 border-t border-teal-900/30">
            <button
              @click="logout"
              class="w-full flex items-center justify-center p-4 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[44px] touch-manipulation"
            >
              <Icon name="heroicons:arrow-left-on-rectangle" class="w-5 h-5 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Auth Modal -->
    <Modal v-if="showAuthModal" @close="showAuthModal = false" @click.self="showAuthModal = false">
      <div class="p-6 bg-black/80 backdrop-blur-sm rounded-xl border border-teal-900/30">
        <h2 class="text-xl font-bold text-white mb-4">Sign In</h2>
        <div class="bg-black/30 backdrop-blur-sm rounded-xl shadow-lg border border-teal-900/30">
          <Authenticator :services="services" :login-mechanisms="['email']" />
        </div>
      </div>
    </Modal>

    <!-- 2FA Modal -->
    <Modal v-if="show2FAModal" @close="show2FAModal = false" @click.self="show2FAModal = false">
      <div class="p-4 sm:p-6 bg-black/80 backdrop-blur-sm rounded-xl border border-teal-900/30 max-w-md w-full mx-4">
        <h2 class="text-xl font-bold text-white mb-3">Two-Factor Authentication</h2>
        <p class="text-gray-300 mb-4 text-sm">Please enter your phone number to receive a verification code.</p>

        <!-- Phone Number Input -->
        <form v-if="!codeSent" @submit.prevent="handleSignIn" class="space-y-4">
          <div class="form-group">
            <label class="block text-sm font-medium text-gray-300 mb-1">Phone</label>
            <input
              v-model="form.phone"
              type="tel"
              required
              class="w-full px-3 py-2 border border-teal-500/30 rounded-lg
                     focus:ring-2 focus:ring-teal-500 focus:border-teal-500
                     text-white bg-black/20 backdrop-blur-sm
                     transition-all duration-300"
              placeholder="(123) 456-7890"
            />
          </div>

          <button
            type="submit" 
            class="w-full bg-teal-500/20 text-teal-300 rounded-lg py-2 px-3
                   hover:bg-teal-500/30 transition-all duration-300
                   disabled:opacity-50 disabled:cursor-not-allowed
                   font-medium text-sm whitespace-nowrap
                   border border-teal-500/30 hover:border-teal-400/50
                   transform hover:scale-105 active:scale-95
                   min-h-[44px] touch-manipulation"
            :disabled="isLoading"
          >
            {{ isLoading ? 'Sending Code...' : 'Continue' }}
          </button>
        </form>

        <!-- Verification Code Input -->
        <form v-if="codeSent" @submit.prevent="verifyCode" class="space-y-4">
          <div class="form-group">
            <label class="block text-sm font-medium text-gray-300 mb-1">Enter Verification Code</label>
            <input
              v-model="verificationCode"
              type="text"
              required
              maxlength="6"
              class="w-full text-center text-2xl tracking-wider px-3 py-2 border border-teal-500/30 rounded-lg
                     focus:ring-2 focus:ring-teal-500 focus:border-teal-500
                     text-white bg-black/20 backdrop-blur-sm
                     transition-all duration-300"
              placeholder="123456"
            />
            <p class="text-xs text-gray-500 mt-1">
              Code sent to {{ formatPhone(form.phone) }}
            </p>
          </div>

          <button
            type="submit" 
            class="w-full bg-teal-500/20 text-teal-300 rounded-lg py-2 px-3
                   hover:bg-teal-500/30 transition-all duration-300
                   disabled:opacity-50 disabled:cursor-not-allowed
                   font-medium text-sm whitespace-nowrap
                   border border-teal-500/30 hover:border-teal-400/50
                   transform hover:scale-105 active:scale-95
                   min-h-[44px] touch-manipulation"
            :disabled="isLoading"
          >
            {{ isLoading ? 'Verifying...' : 'Verify Code' }}
          </button>
        </form>
        <p v-if="errorMessage" class="text-red-500 mt-2 text-sm">{{ errorMessage }}</p>
      </div>
    </Modal>
  </header>
</template>

<style>
/* Ensure proper styling initialization */
:root {
  --tw-bg-opacity: 1;
  --tw-text-opacity: 1;
}

/* Prevent layout shifts */
input, button {
  min-height: 44px;
}

/* Ensure proper backdrop blur */
.bg-black\/80 {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Profile menu transitions */
#profile-menu {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

#profile-menu.enter-active,
#profile-menu.leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

#profile-menu.enter-from,
#profile-menu.leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Drawer animations */
#nav-drawer {
  transition: opacity 0.3s ease;
}

#nav-drawer .absolute.right-0 {
  transition: transform 0.3s ease-in-out;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  #nav-drawer .absolute.right-0 {
    width: 100%;
    max-width: none;
  }
}

/* Streaming bars animation */
@keyframes stream-pulse {
  0%, 100% {
    height: 4px;
    opacity: 0.7;
  }
  50% {
    height: 8px;
    opacity: 1;
  }
}

.bar-1 { animation: stream-pulse 1.5s ease-in-out infinite; }
.bar-2 { animation: stream-pulse 1.5s ease-in-out infinite 0.1s; }
.bar-3 { animation: stream-pulse 1.5s ease-in-out infinite 0.2s; }
.bar-4 { animation: stream-pulse 1.5s ease-in-out infinite 0.3s; }
.bar-5 { animation: stream-pulse 1.5s ease-in-out infinite 0.4s; }
.bar-6 { animation: stream-pulse 1.5s ease-in-out infinite 0.5s; }
.bar-7 { animation: stream-pulse 1.5s ease-in-out infinite 0.6s; }
.bar-8 { animation: stream-pulse 1.5s ease-in-out infinite 0.7s; }
.bar-9 { animation: stream-pulse 1.5s ease-in-out infinite 0.8s; }
</style>