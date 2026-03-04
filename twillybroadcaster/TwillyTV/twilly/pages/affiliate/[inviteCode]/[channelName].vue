<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black p-4">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="bg-black/40 backdrop-blur-sm p-8 rounded-xl border border-orange-900/30">
          <h1 class="text-4xl font-bold text-white mb-4">Join Twilly as an Affiliate</h1>
          <p class="text-xl text-gray-300 mb-6">You've been invited to promote <span class="text-orange-400 font-semibold">{{ channelName }}</span></p>
          <p class="text-lg text-gray-400">Earn commissions by inviting collaborators to Twilly TV and Twilly After Dark!</p>
        </div>
      </div>

      <!-- Benefits -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-orange-500/30">
          <div class="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Icon name="heroicons:currency-dollar" class="w-6 h-6 text-orange-400" />
          </div>
          <h3 class="text-lg font-semibold text-white mb-2 text-center">Earn Commission</h3>
          <p class="text-gray-400 text-sm text-center">Get commissions for every collaborator you invite</p>
        </div>
        
        <div class="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-orange-500/30">
          <div class="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Icon name="heroicons:user-group" class="w-6 h-6 text-orange-400" />
          </div>
          <h3 class="text-lg font-semibold text-white mb-2 text-center">Invite Collaborators</h3>
          <p class="text-gray-400 text-sm text-center">Send collaborator invites to Twilly TV and Twilly After Dark</p>
        </div>
        
        <div class="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-orange-500/30">
          <div class="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Icon name="heroicons:chart-bar" class="w-6 h-6 text-orange-400" />
          </div>
          <h3 class="text-lg font-semibold text-white mb-2 text-center">Track Performance</h3>
          <p class="text-gray-400 text-sm text-center">Monitor your referrals and earnings in real-time</p>
        </div>
      </div>

      <!-- Call to Action -->
      <div class="bg-black/40 backdrop-blur-sm p-8 rounded-xl border border-orange-900/30 text-center">
        <h2 class="text-2xl font-bold text-white mb-4">Ready to Start Earning?</h2>
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

      <!-- Footer -->
      <div class="text-center mt-12 text-gray-400 text-sm">
        <p>© 2025 Twilly. All rights reserved.</p>
        <div class="flex justify-center gap-6 mt-4">
          <a href="/legal/terms-of-service" class="hover:text-white transition-colors">Terms of Service</a>
          <a href="/legal/privacy-policy" class="hover:text-white transition-colors">Privacy Policy</a>
          <a href="/legal/community-guidelines" class="hover:text-white transition-colors">Community Guidelines</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const inviteCode = route.params.inviteCode;
const channelName = ref(route.params.channelName || 'Twilly Channel');

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

onMounted(() => {
  // Decode the channel name if it's URL encoded
  if (channelName.value) {
    channelName.value = decodeURIComponent(channelName.value);
  }
});
</script>