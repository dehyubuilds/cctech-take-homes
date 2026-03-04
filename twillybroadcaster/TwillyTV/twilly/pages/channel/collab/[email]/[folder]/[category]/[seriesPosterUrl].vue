<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black py-12 px-4">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <header class="text-center mb-12 bg-transparent flex flex-col items-center">
        <h1 class="text-4xl md:text-5xl font-bold text-white mb-3 bg-transparent whitespace-nowrap">
          Private Event <span class="text-teal-400">Invitation</span>
        </h1>
        <p class="text-gray-300 text-lg bg-transparent block">
          You've been invited to an event.
        </p>
      </header>

      <!-- Content -->
      <div class="max-w-xl mx-auto">
        <!-- Series Preview -->
        <div class="mb-8">
          <div class="aspect-video bg-black/40 rounded-lg overflow-hidden">
            <img
              :src="seriesPosterUrl"
              :alt="folderName"
              class="w-full h-full object-contain"
            />
          </div>
        </div>

        <!-- Invitation Details -->
        <div class="bg-black/30 backdrop-blur-sm rounded-lg border border-teal-500/30 p-6 mb-8">
          <p class="text-white mb-4">
            <!-- You have been invited by <span class="text-teal-400">{{ email }}</span>  -->
            You have been invited to <span class="text-teal-400">{{ folderName }}</span>.
          </p>
          
          <button 
            @click="show2FAModal = true"
            class="w-full px-6 py-2.5 text-sm bg-teal-500/20 text-teal-300 
                   border border-teal-500/30 rounded-lg hover:bg-teal-500/30 
                   transition-all duration-300 min-w-[140px] justify-center"
          >
            <div class="flex items-center justify-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5" />
              Accept Invitation
            </div>
          </button>
        </div>

        <!-- 2FA Modal -->
        <Modal v-if="show2FAModal" @close="show2FAModal = false" @click.self="show2FAModal = false">
          <div class="p-6 bg-black/80 rounded-lg">
            <h2 class="text-xl font-bold text-white mb-4">Two-Factor Authentication</h2>
            <p class="text-gray-300 mb-4">Please enter your phone number to receive a verification code.</p>

            <!-- Phone Number Input -->
            <form v-if="!codeSent" @submit.prevent="handleSignIn" class="form">
              <div class="form-group mb-4">
                <label class="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                <input
                  v-model="form.phone"
                  type="tel"
                  required
                  class="input w-full px-3 py-2 border border-gray-300 rounded-lg
                         focus:ring-2 focus:ring-teal-500 focus:border-teal-500
                         text-white bg-gray-800"
                  placeholder="(123) 456-7890"
                />
              </div>

              <button
                type="submit" 
                class="submit-btn w-full bg-teal-600 text-white rounded-lg py-3 px-4
                       hover:bg-teal-700 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed
                       font-medium"
                :disabled="isLoading"
              >
                {{ isLoading ? 'Sending Code...' : 'Continue' }}
              </button>
            </form>

            <!-- Verification Code Input -->
            <form v-if="codeSent" @submit.prevent="verifyCode" class="form mt-4">
              <div class="form-group mb-4">
                <label class="block text-sm font-medium text-gray-300 mb-1">Enter Verification Code</label>
                <input
                  v-model="verificationCode"
                  type="text"
                  required
                  maxlength="6"
                  class="input w-full text-center text-2xl tracking-wider px-3 py-2 border border-gray-300 rounded-lg
                         focus:ring-2 focus:ring-teal-500 focus:border-teal-500
                         text-white bg-gray-800"
                  placeholder="123456"
                />
                <p class="text-sm text-gray-600 mt-2">
                  Code sent to {{ formatPhone(form.phone) }}
                </p>
              </div>

              <div class="space-y-3">
                <button
                  type="submit" 
                  class="submit-btn w-full bg-teal-600 text-white rounded-lg py-3 px-4
                         hover:bg-teal-700 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed
                         font-medium"
                  :disabled="isLoading"
                >
                  {{ isLoading ? 'Verifying...' : 'Verify Code' }}
                </button>
              </div>
            </form>
            <p v-if="errorMessage" class="text-red-500 mt-2">{{ errorMessage }}</p>
          </div>
        </Modal>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Modal from '~/components/Modal.vue';
import { Auth } from 'aws-amplify'
import { useAuthStore } from '~/stores/auth'
import collabInvite from "@/assets/twilly-collab-invite.png";

definePageMeta({
  layout: false
});

const route = useRoute();
const router = useRouter();

const isLoading = ref(false);
const codeSent = ref(false);
const isVerified = ref(false);
const show2FAModal = ref(false);
const verificationCode = ref('');
const errorMessage = ref('');
const showVerification = ref(false);
const form = ref({
  phone: ''
});

const email = ref(route.params.email || "");
const folderName = ref(route.params.folder || "");
const title = ref(`Invitation to ${folderName.value}  `);

const authStore = useAuthStore()

// Update seriesPosterUrl to properly decode the URL
const seriesPosterUrl = computed(() => {
  const rawUrl = route.params.seriesPosterUrl || 'default';
  if (rawUrl === 'default') return 'default';
  
  // Decode the URL
  const decodedUrl = decodeURIComponent(rawUrl);
  console.log('Decoded seriesPosterUrl:', decodedUrl);
  
  // If the URL is already absolute, return it
  if (decodedUrl.startsWith('http')) {
    return decodedUrl;
  }
  
  // Remove any existing CloudFront domain if present
  const cleanUrl = decodedUrl.replace('https://d3hv50jkrzkiyh.cloudfront.net/', '');
  
  // Ensure the URL has the public/ prefix
  const formattedUrl = cleanUrl.startsWith('public/') 
    ? cleanUrl 
    : `public/${cleanUrl}`;
  
  // Construct the full CloudFront URL
  return `https://d3hv50jkrzkiyh.cloudfront.net/${formattedUrl}`;
});

// Set meta tags with proper image URL handling
useHead({
  title: title.value,
  meta: [
    { hid: "og:title", property: "og:title", content: title.value },
    { hid: "og:url", property: "og:url", content: seriesPosterUrl.value },
    { hid: "og:site_name", property: "og:site_name", content: "Twilly" },
    {
      hid: "og:description",
      property: "og:description",
      content: title.value,
    },
    { hid: "og:image", property: "og:image", content: seriesPosterUrl.value },
    { hid: "og:image:width", property: "og:image:width", content: "1200" },
    { hid: "og:image:height", property: "og:image:height", content: "630" },
    { hid: "og:type", property: "og:type", content: "website" },
    { hid: "twitter:url", name: "twitter:url", content: seriesPosterUrl.value },
    {
      hid: "twitter:description",
      name: "twitter:description",
      content: title.value,
    },
    { hid: "twitter:title", name: "twitter:title", content: title.value },
    { hid: "twitter:image", name: "twitter:image", content: seriesPosterUrl.value },
  ],
});

onMounted(() => {
  const description = `Join ${email.value}'s collaboration on ${folderName.value}`;
  const currentUrl = window.location.href;
  
  // Use dedicated collaborator invite image
  const imageUrl = collabInvite;

  useHead({
    title: title.value,
    meta: [
      // Essential Open Graph
      { property: "og:title", content: title.value },
      { property: "og:description", content: description },
      { property: "og:image", content: imageUrl },
      { property: "og:url", content: currentUrl },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Twilly" },

      // Image Specifics
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:alt", content: title.value },

      // Twitter Card
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Twilly" },
      { name: "twitter:title", content: title.value },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: imageUrl },

      // Basic SEO
      { name: "description", content: description },
      { name: "author", content: "Twilly" },
      { name: "theme-color", content: "#084d5d" }
    ],
    link: [
      { rel: 'canonical', href: currentUrl }
    ]
  });

  console.log('on Collaboration page');
  isLoading.value = false;
});

function formatPhone(phone) {
  const cleaned = (phone || '').replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return '(' + match[1] + ') ' + match[2] + '-' + match[3];
  }
  return phone;
}

const checkAuth = async () => {
  try {
    const user = await Auth.currentAuthenticatedUser();
    if (user) {
      // If we have a valid Cognito session, update the auth store
      await authStore.loggedIn(user, 'buyer');
      return true;
    }
  } catch (error) {
    // If no valid session, check if we have local state
    if (authStore.isAuthenticated) {
      // Try to refresh the session
      try {
        const refreshedUser = await Auth.currentAuthenticatedUser();
        await authStore.loggedIn(refreshedUser, 'buyer');
        return true;
      } catch (refreshError) {
        // If refresh fails, clear local state
        authStore.logout();
        return false;
      }
    }
    return false;
  }
};

const handleSignIn = async () => {
  try {
    isLoading.value = true;
    // Format phone number as username (E.164 format)
    const phone = form.value.phone.replace(/\D/g, '');
    const username = `+1${phone}`; // Ensure it's in E.164 format
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
    console.log('Verifying code for:', form.value.phone);
    const phone = form.value.phone.replace(/\D/g, '');
    const username = `+1${phone}`;

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
      show2FAModal.value = false;
      showVerification.value = false;
      form.value.phone = '';
      verificationCode.value = '';
      
      // Navigate to accept-invitation with query parameters
      navigateTo({
        path: '/accept-invitation',
        query: {
          owner: email.value,
          folder: folderName.value,
          category: route.params.category
        }
      });
    } else {
      throw new Error(authResponse.error || 'Authentication failed');
    }
  } catch (error) {
    console.error('Error during verification:', error);
    errorMessage.value = error.message || 'An error occurred during verification';
  }
};

const handlePurchase = async () => {
  try {
    // Check authentication first
    const isAuth = await checkAuth();
    if (!isAuth) {
      show2FAModal.value = true;
      return;
    }

    // If authenticated, proceed with purchase
    // ... rest of purchase logic ...
  } catch (error) {
    console.error('Purchase error:', error);
    errorMessage.value = error.message || 'Failed to process purchase';
  }
};
</script>

<style scoped>
.collaboration-invite {
  @apply min-h-screen bg-gradient-to-br from-gray-900 to-black
         flex items-center justify-center py-8 px-4;
}

.invite-content {
  @apply max-w-lg w-full bg-gray-800/90 rounded-lg
         shadow-xl p-8 backdrop-blur-sm
         border border-gray-700/50;
}

.invite-title {
  @apply text-2xl md:text-3xl font-bold text-white mb-6
         text-center;
  background: linear-gradient(to right, #fff, #94a3b8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.invite-description {
  @apply text-gray-300 text-lg mb-8 text-center;
}

.highlight {
  @apply text-blue-400 font-semibold;
}

.accept-button {
  @apply w-full py-3 px-6 bg-blue-600 hover:bg-blue-700
         text-white rounded-lg font-semibold
         transform transition-all duration-200
         hover:scale-105 focus:outline-none
         focus:ring-2 focus:ring-blue-500;
}

/* Loading State */
.loading-indicator {
  @apply w-12 h-12 border-4 border-blue-500/20
         border-t-blue-500 rounded-full
         animate-spin mx-auto;
}

/* Responsive Design */
@media (max-width: 640px) {
  .invite-content {
    @apply mx-4;
  }
}
</style>