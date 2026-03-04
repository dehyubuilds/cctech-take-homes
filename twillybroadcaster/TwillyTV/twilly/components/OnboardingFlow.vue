<template>
  <div v-if="showOnboarding" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 min-h-screen" style="position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 9999 !important;">
    <div class="bg-gray-900 border border-white/20 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto transform translate-y-0">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <Icon name="heroicons:rocket-launch" class="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-white">Welcome to Twilly!</h2>
            <p class="text-gray-400 text-sm">Let's get you set up</p>
          </div>
        </div>
        <button @click="skipOnboarding" class="text-gray-400 hover:text-white transition-colors">
          <Icon name="heroicons:x-mark" class="w-6 h-6" />
        </button>
      </div>

      <!-- Progress Bar -->
      <div class="mb-8">
        <div class="flex justify-between text-sm text-gray-400 mb-2">
          <span>Step {{ currentStep }} of {{ totalSteps }}</span>
          <span>{{ Math.round((currentStep / totalSteps) * 100) }}%</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-2">
          <div 
            class="bg-gradient-to-r from-teal-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${(currentStep / totalSteps) * 100}%` }"
          ></div>
        </div>
      </div>

      <!-- Step Content -->
      <div class="mb-8">
        <!-- Step 1: Welcome -->
        <div v-if="currentStep === 1" class="text-center">
          <div class="w-20 h-20 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:hand-raised" class="w-10 h-10 text-white" />
          </div>
          <h3 class="text-2xl font-semibold text-white mb-4">Welcome to Twilly!</h3>
          <p class="text-gray-300 text-lg mb-6">
            You're now part of the Twilly network. Let's set up your account so you can start earning from your content.
          </p>
          <div class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-left">
            <h4 class="font-semibold text-blue-300 mb-2">What you'll need:</h4>
            <ul class="text-gray-300 space-y-1 text-sm">
              <li>• A Stripe account for payouts</li>
              <li>• Your bank account details</li>
              <li>• About 5 minutes of your time</li>
            </ul>
          </div>
        </div>

        <!-- Step 2: Role Explanation -->
        <div v-if="currentStep === 2" class="text-center">
          <div class="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:user-group" class="w-10 h-10 text-white" />
          </div>
          <h3 class="text-2xl font-semibold text-white mb-4">Your Role: {{ userRole }}</h3>
          <div v-if="userRole === 'Collaborator'" class="text-gray-300 text-lg mb-6">
            <p class="mb-4">As a collaborator, you'll:</p>
            <ul class="text-left space-y-2 bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
              <li class="flex items-center gap-2">
                <Icon name="heroicons:video-camera" class="w-5 h-5 text-purple-400" />
                <span>Get a unique stream key for live streaming</span>
              </li>
              <li class="flex items-center gap-2">
                <Icon name="heroicons:currency-dollar" class="w-5 h-5 text-purple-400" />
                <span>Earn a share of channel revenue based on your episodes</span>
              </li>
              <li class="flex items-center gap-2">
                <Icon name="heroicons:chart-bar" class="w-5 h-5 text-purple-400" />
                <span>Track your earnings in real-time</span>
              </li>
            </ul>
          </div>
          <div v-else-if="userRole === 'Casting Director'" class="text-gray-300 text-lg mb-6">
            <p class="mb-4">As a casting director, you'll:</p>
            <ul class="text-left space-y-2 bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
              <li class="flex items-center gap-2">
                <Icon name="heroicons:link" class="w-5 h-5 text-purple-400" />
                <span>Get unique referral links to recruit talent</span>
              </li>
              <li class="flex items-center gap-2">
                <Icon name="heroicons:currency-dollar" class="w-5 h-5 text-purple-400" />
                <span>Earn 15% commission on successful talent sign-ups</span>
              </li>
              <li class="flex items-center gap-2">
                <Icon name="heroicons:chart-bar" class="w-5 h-5 text-purple-400" />
                <span>Track your referral performance</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Step 3: Payout Setup -->
        <div v-if="currentStep === 3" class="text-center">
          <div class="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:credit-card" class="w-10 h-10 text-white" />
          </div>
          <h3 class="text-2xl font-semibold text-white mb-4">Set Up Payouts</h3>
          <p class="text-gray-300 text-lg mb-6">
            To receive payments, you'll need to set up a Stripe Connect account. This is secure and only takes a few minutes.
          </p>
          <div class="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-left mb-6">
            <h4 class="font-semibold text-green-300 mb-2">You'll need:</h4>
            <ul class="text-gray-300 space-y-1 text-sm">
              <li>• Your bank account details</li>
              <li>• A valid ID for verification</li>
              <li>• Your tax information</li>
            </ul>
          </div>
          <div v-if="!hasPayoutSetup" class="space-y-4">
            <button 
              @click="setupPayouts"
              class="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              Set Up Payouts Now
            </button>
            <p class="text-gray-400 text-sm">You can also set this up later from your account settings</p>
          </div>
          <div v-else class="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <div class="flex items-center gap-2 text-green-300">
              <Icon name="heroicons:check-circle" class="w-5 h-5" />
              <span class="font-semibold">Payouts Already Set Up!</span>
            </div>
          </div>
        </div>

        <!-- Step 4: Next Steps -->
        <div v-if="currentStep === 4" class="text-center">
          <div class="w-20 h-20 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:rocket-launch" class="w-10 h-10 text-white" />
          </div>
          <h3 class="text-2xl font-semibold text-white mb-4">You're All Set!</h3>
          <p class="text-gray-300 text-lg mb-6">
            Your account is ready. Here's what you can do next:
          </p>
          <div class="space-y-4 text-left">
            <div v-if="userRole === 'Collaborator'" class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <h4 class="font-semibold text-blue-300 mb-2">For Collaborators:</h4>
              <ul class="text-gray-300 space-y-1 text-sm">
                <li>• Get your stream key from the account page</li>
                <li>• Start streaming on your assigned channel</li>
                <li>• Track your earnings in the profile dashboard</li>
              </ul>
            </div>
            <div v-else-if="userRole === 'Casting Director'" class="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
              <h4 class="font-semibold text-purple-300 mb-2">For Casting Directors:</h4>
              <ul class="text-gray-300 space-y-1 text-sm">
                <li>• Generate referral links from your profile</li>
                <li>• Share links to recruit talent</li>
                <li>• Track your commission earnings</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <div class="flex justify-between">
        <button 
          v-if="currentStep > 1"
          @click="previousStep"
          class="px-6 py-2 text-gray-400 hover:text-white transition-colors"
        >
          <Icon name="heroicons:arrow-left" class="w-4 h-4 inline mr-2" />
          Back
        </button>
        <div v-else></div>
        
        <div class="flex gap-3">
          <button 
            v-if="currentStep < totalSteps"
            @click="nextStep"
            class="px-6 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold rounded-lg transition-all duration-300"
          >
            Next
            <Icon name="heroicons:arrow-right" class="w-4 h-4 inline ml-2" />
          </button>
          <button 
            v-else
            @click="completeOnboarding"
            class="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-lg transition-all duration-300"
          >
            Get Started!
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();

// Props
const props = defineProps({
  userRole: {
    type: String,
    default: 'Collaborator'
  },
  hasPayoutSetup: {
    type: Boolean,
    default: false
  }
});

// State
const showOnboarding = ref(false);
const currentStep = ref(1);
const totalSteps = 4;

// Check if user needs onboarding
const needsOnboarding = computed(() => {
  // Show onboarding for new users or users without payout setup
  return !props.hasPayoutSetup;
});

// Methods
const nextStep = () => {
  if (currentStep.value < totalSteps) {
    currentStep.value++;
  }
};

const previousStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
};

const setupPayouts = () => {
  // Navigate to account page with payouts section
  navigateTo('/account?section=payouts');
};

const completeOnboarding = () => {
  showOnboarding.value = false;
  // Store that user has completed onboarding
  localStorage.setItem('twilly_onboarding_completed', 'true');
};

const skipOnboarding = () => {
  showOnboarding.value = false;
  localStorage.setItem('twilly_onboarding_completed', 'true');
};

// Check if onboarding should be shown
onMounted(() => {
  const hasCompletedOnboarding = localStorage.getItem('twilly_onboarding_completed');
  if (!hasCompletedOnboarding && needsOnboarding.value) {
    showOnboarding.value = true;
  }
});
</script>

<style scoped>
/* Ensure the onboarding modal is always properly positioned relative to viewport */
.fixed.inset-0 {
  position: fixed !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  z-index: 9999 !important; /* Higher z-index to ensure it's above everything */
  width: 100vw !important;
  height: 100vh !important;
  height: 100dvh !important; /* Dynamic viewport height for mobile */
}

/* Ensure proper centering on all screen sizes */
.fixed.inset-0.flex.items-center.justify-center {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-height: 100vh !important;
  min-height: 100dvh !important; /* Dynamic viewport height for mobile */
}

/* Ensure the modal content is always visible and properly positioned */
.bg-gray-900.border.border-white\/20.rounded-2xl {
  position: relative !important;
  top: 0 !important;
  transform: translateY(0) !important;
  margin: 0 !important;
}

/* Override any layout container constraints */
:deep(.vertical-container) {
  overflow: visible !important;
}

:deep(.main-content) {
  overflow: visible !important;
}

/* Mobile-specific positioning fixes */
@media (max-width: 768px) {
  .fixed.inset-0 {
    /* Ensure proper mobile positioning */
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    height: 100dvh !important;
    /* Prevent mobile browser UI from affecting positioning */
    min-height: 100vh !important;
    min-height: 100dvh !important;
  }
  
  /* Ensure modal content is properly sized on mobile */
  .bg-gray-900.border.border-white\/20.rounded-2xl {
    max-height: 85vh !important;
    max-height: 85dvh !important;
    margin: 1rem !important;
  }
}

/* Ensure the modal is always above any other content */
.fixed.inset-0 {
  /* Force it to be above everything */
  z-index: 9999 !important;
  /* Ensure it's not affected by any parent transforms */
  transform: none !important;
}
</style>
