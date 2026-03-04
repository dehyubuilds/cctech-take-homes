<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black p-4">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="bg-black/40 backdrop-blur-sm p-8 rounded-xl border border-orange-900/30">
          <h1 class="text-4xl font-bold text-white mb-4">Join Twilly as an Affiliate</h1>
          <p class="text-xl text-gray-300 mb-6">
            You've been invited to promote <span class="text-orange-400 font-semibold">{{ channelName }}</span>
          </p>
          <p class="text-lg text-gray-400">Earn commissions by inviting collaborators to Twilly TV and Twilly After Dark!</p>
        </div>
      </div>

      <!-- Benefits -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div class="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-orange-500/30">
          <div class="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Icon name="heroicons:user-group" class="w-6 h-6 text-orange-400" />
          </div>
          <h3 class="text-lg font-semibold text-white mb-2 text-center">Invite Collaborators</h3>
          <p class="text-gray-400 text-sm text-center">Send collaborator invites to Twilly TV and Twilly After Dark</p>
        </div>
        
        <div class="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-orange-500/30">
          <div class="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Icon name="heroicons:currency-dollar" class="w-6 h-6 text-orange-400" />
          </div>
          <h3 class="text-lg font-semibold text-white mb-2 text-center">Earn Commission</h3>
          <p class="text-gray-400 text-sm text-center">Get commissions for every collaborator you invite</p>
        </div>
      </div>

      <!-- Call to Action -->
      <div class="bg-black/40 backdrop-blur-sm p-8 rounded-xl border border-orange-900/30 text-center">
        <h2 class="text-2xl font-bold text-white mb-4">Ready to Start Earning?</h2>
        
        <!-- For authenticated users -->
        <div v-if="isAuthenticated">
          <p class="text-gray-300 mb-6">
            You're already signed in! Accept this affiliate invitation to start earning commissions.
          </p>
          
          <div class="space-y-4">
            <button
              @click="acceptInviteDirectly"
              class="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 px-8 rounded-lg font-semibold text-lg transition-colors"
            >
              Accept Affiliate Invite
            </button>
          </div>
        </div>
        
        <!-- For non-authenticated users -->
        <div v-else>
          <p class="text-gray-300 mb-6">
            Create your account to accept this affiliate invitation and start earning commissions.
          </p>
          
          <div class="space-y-4">
            <button
              @click="goToSignin"
              class="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 px-8 rounded-lg font-semibold text-lg transition-colors"
            >
              Create Account & Accept Invite
            </button>
            
            <p class="text-sm text-gray-400">
              Already have an account? 
              <button @click="goToSignin" class="text-orange-400 hover:text-orange-300 underline">
                Sign in here
              </button>
            </p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="text-center mt-8 text-gray-400 text-sm">
        <p>© 2025 Twilly. All rights reserved.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '~/stores/auth';
import { Auth } from 'aws-amplify';

const route = useRoute();
const router = useRouter();

const inviteCode = route.params.affiliateId; // This is actually the invite code
const channelId = route.params.channelId;
const channelName = ref('Twilly Channel');

// Check if user is already authenticated
const isAuthenticated = ref(false);
const authStore = useAuthStore();

// Store the invite information for after signup
const goToSignin = () => {
  // Store the affiliate invite info in sessionStorage for after signup
  if (process.client) {
    sessionStorage.setItem('pendingAffiliateInvite', JSON.stringify({
      inviteCode,
      channelName: channelName.value,
      inviteType: 'affiliate'
    }));
  }
  
  // Redirect to signin page
  router.push('/signin');
};

// Accept invite directly if user is already authenticated
const acceptInviteDirectly = async () => {
  try {
    const result = await authStore.activateAffiliatePersona(inviteCode);
    if (result.success) {
      alert('Welcome! Your affiliate account has been activated. You can now invite collaborators to Twilly TV and Twilly After Dark.');
      // Redirect to profile
      router.push('/profile');
    } else {
      alert('Error activating affiliate account: ' + result.message);
    }
  } catch (error) {
    console.error('Error activating affiliate persona:', error);
    alert('Error activating affiliate account. Please try again.');
  }
};

onMounted(async () => {
  // Check if user is already authenticated
  try {
    const user = await Auth.currentAuthenticatedUser();
    if (user) {
      isAuthenticated.value = true;
      authStore.authenticated = true;
      authStore.user = user;
    }
  } catch (error) {
    // User not authenticated
    isAuthenticated.value = false;
  }
  
  // Decode the channel name
  if (channelId) {
    channelName.value = decodeURIComponent(channelId);
  }
});
</script>