<template>
  <div class="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155]">
    <div class="max-w-4xl mx-auto p-4">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="bg-black/40 backdrop-blur-sm p-8 rounded-xl border border-teal-900/30">
          <h1 class="text-4xl font-bold text-white mb-4">Join Twilly as a Collaborator</h1>
          <p class="text-xl text-gray-300 mb-6">
            You've been invited to collaborate on <span class="text-teal-400 font-semibold">{{ channelName }}</span>
          </p>
          <p class="text-lg text-gray-400">Start streaming and collaborating with other creators!</p>
        </div>
      </div>

      <!-- Channel Info with Metadata -->
      <div v-if="title || description || creator || poster" class="mb-8">
        <div class="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-teal-500/30">
          <div class="flex flex-col md:flex-row gap-6">
            <!-- Poster Image -->
            <div v-if="poster" class="flex-shrink-0">
              <img 
                :src="poster" 
                :alt="title || channelName"
                class="w-48 h-32 object-cover rounded-lg shadow-lg"
              />
            </div>
            
            <!-- Channel Details -->
            <div class="flex-1">
              <h2 class="text-2xl font-bold text-white mb-2">{{ title || channelName }}</h2>
              <p v-if="description" class="text-gray-300 mb-4">{{ description }}</p>
              <div v-if="creator" class="flex items-center gap-2 text-teal-400">
                <Icon name="heroicons:user" class="w-5 h-5" />
                <span class="font-semibold">Created by {{ creator }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Benefits -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div class="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-teal-500/30">
          <div class="w-12 h-12 bg-teal-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Icon name="heroicons:video-camera" class="w-6 h-6 text-teal-400" />
          </div>
          <h3 class="text-lg font-semibold text-white mb-2 text-center">Stream Content</h3>
          <p class="text-gray-400 text-sm text-center">Create and stream content on Twilly TV</p>
        </div>
        
        <div class="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-teal-500/30">
          <div class="w-12 h-12 bg-teal-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Icon name="heroicons:user-group" class="w-6 h-6 text-teal-400" />
          </div>
          <h3 class="text-lg font-semibold text-white mb-2 text-center">Collaborate</h3>
          <p class="text-gray-400 text-sm text-center">Work with other creators and build your audience</p>
        </div>
      </div>

      <!-- Call to Action -->
      <div class="bg-black/40 backdrop-blur-sm p-8 rounded-xl border border-teal-900/30 text-center">
        <h2 class="text-2xl font-bold text-white mb-4">Ready to Start Collaborating?</h2>
        
        <!-- Loading state while checking authentication -->
        <div v-if="isCheckingAuth" class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p class="text-gray-300">Checking authentication...</p>
        </div>
        
        <!-- For existing collaborators -->
        <div v-else-if="isAuthenticated && isAlreadyCollaborator">
          <div class="bg-green-500/20 border border-green-500/30 rounded-lg p-6 mb-6">
            <div class="flex items-center gap-3 mb-4">
              <Icon name="heroicons:check-circle" class="w-6 h-6 text-green-400" />
              <h3 class="text-lg font-semibold text-green-400">Already a Collaborator!</h3>
            </div>
            <p class="text-gray-300 mb-4">
              You're already a collaborator for <span class="font-semibold text-teal-400">{{ channelName }}</span>. 
              You can start streaming right away!
            </p>
            <div class="space-y-3">
              <div class="flex items-center gap-2 text-sm text-gray-400">
                <Icon name="heroicons:key" class="w-4 h-4" />
                <span>Stream Key: {{ existingCollaboratorData?.streamKey || 'Active' }}</span>
              </div>
              <div class="flex items-center gap-2 text-sm text-gray-400">
                <Icon name="heroicons:calendar" class="w-4 h-4" />
                <span>Status: {{ existingCollaboratorData?.status || 'Active' }}</span>
              </div>
            </div>
          </div>
          
          <div class="space-y-4">
            <button
              @click="() => router.push('/profile')"
              class="w-full bg-teal-500 hover:bg-teal-600 text-white py-4 px-8 rounded-lg font-semibold text-lg transition-colors"
            >
              Go to Profile & Start Streaming
            </button>
            
            <button
              @click="() => router.push('/managefiles')"
              class="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-6 rounded-lg font-semibold transition-colors"
            >
              Manage Content
            </button>
          </div>
        </div>

        <!-- For authenticated users (new collaborators) -->
        <div v-else-if="isAuthenticated">
          <p class="text-gray-300 mb-6">
            You're already signed in! Accept this collaborator invitation to start streaming.
          </p>
          
          <div class="space-y-4">
            <button
              @click="acceptInvite"
              :disabled="isAutoAccepting"
              class="w-full bg-teal-500 hover:bg-teal-600 text-white py-4 px-8 rounded-lg font-semibold text-lg transition-colors disabled:opacity-50"
            >
              <span v-if="isAutoAccepting">Activating...</span>
              <span v-else>Accept Collaborator Invite</span>
            </button>
            
            <button
              v-if="showManualAccept"
              @click="acceptInvite"
              class="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-6 rounded-lg font-semibold transition-colors"
            >
              Force Accept Invite
            </button>
          </div>
        </div>

        <!-- For unauthenticated users -->
        <div v-else>
          <p class="text-gray-300 mb-6">
            Sign in to accept this collaborator invitation and start streaming.
          </p>
          
          <button
            @click="navigateToSignin"
            class="w-full bg-teal-500 hover:bg-teal-600 text-white py-4 px-8 rounded-lg font-semibold text-lg transition-colors"
          >
            Sign In to Accept Invite
          </button>
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
// Disable global auth middleware for this page
definePageMeta({
  auth: false
});

import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '~/stores/auth';
import { Auth } from 'aws-amplify';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// Extract parameters and query data
const inviteCode = computed(() => route.params.inviteCode);
const channelName = computed(() => route.params.channelName ? decodeURIComponent(route.params.channelName) : '');
const title = computed(() => route.query.title || '');
const description = computed(() => route.query.description || '');
const creator = computed(() => {
  const creatorParam = route.query.creator || '';
  // If creator contains an email, extract the username part
  if (creatorParam.includes('@')) {
    return creatorParam.split('@')[0];
  }
  return creatorParam;
});
const poster = computed(() => route.query.poster || '');

// Reactive state
const isAuthenticated = ref(false);
const isAutoAccepting = ref(false);
const showManualAccept = ref(false);
const isCheckingAuth = ref(true);
const isAlreadyCollaborator = ref(false);
const existingCollaboratorData = ref(null);

// Navigation functions
const navigateToSignin = () => {
  // Store the collaborator invite info in sessionStorage for after signup
  if (process.client) {
    sessionStorage.setItem('pendingCollaboratorInvite', JSON.stringify({
      inviteCode: inviteCode.value,
      channelName: channelName.value,
      title: title.value,
      description: description.value,
      creator: creator.value,
      poster: poster.value,
      inviteType: 'collaborator'
    }));
  }
  
  // Redirect to signin page
  router.push('/signin');
};

// Accept invite directly if user is already authenticated
const acceptInviteDirectly = async () => {
  try {
    console.log('🚀 Starting direct accept invite process...');
    isAutoAccepting.value = true;
    
    const response = await $fetch('/api/collaborations/accept-invite', {
      method: 'POST',
      body: {
        inviteCode: inviteCode.value,
        channelName: channelName.value,
        title: title.value,
        description: description.value,
        creator: creator.value,
        poster: poster.value,
        userId: authStore.user?.attributes?.sub,
        userEmail: authStore.user?.attributes?.email
      }
    });

    console.log('✅ Accept invite response:', response);

    if (response.success) {
      // Activate creator persona using the proper auth store method
      try {
        console.log('🚀 Calling activateCreatorPersona with inviteCode:', inviteCode.value);
        const personaResult = await authStore.activateCreatorPersona(inviteCode.value);
        console.log('✅ Creator persona activation result:', personaResult);
        
        alert('Welcome! You\'ve successfully joined as a collaborator. You can now start streaming on Twilly TV.');
        
        // Redirect to profile page
        router.push('/profile');
      } catch (personaError) {
        console.error('❌ Failed to activate creator persona:', personaError);
        console.error('❌ Persona error details:', personaError.message);
        
        // Check if it's because user already has creator persona
        if (personaError.message && personaError.message.includes('already has creator access')) {
          console.log('ℹ️ User already has creator access, updating auth store manually');
          // User already has creator persona, just update the auth store
          authStore.personas.creator = true;
          authStore.activePersona = 'creator';
          authStore.personaData.creator = {
            channelName: channelName.value,
            streamKey: response.streamKey,
            status: 'active'
          };
          
          // Force reload persona data to ensure it's persisted
          setTimeout(async () => {
            console.log('🔄 Reloading persona data to ensure persistence...');
            await authStore.loadPersonaData();
            console.log('✅ Persona data reloaded:', {
              personas: authStore.personas,
              activePersona: authStore.activePersona,
              personaData: authStore.personaData
            });
          }, 1000);
          
          alert('You\'re already a collaborator! Your creator persona has been activated.');
        } else {
          // Fallback: manually set persona data
          authStore.personas.creator = true;
          authStore.activePersona = 'creator';
          authStore.personaData.creator = {
            channelName: channelName.value,
            streamKey: response.streamKey,
            status: 'active'
          };
          
          // Force reload persona data to ensure it's persisted
          setTimeout(async () => {
            console.log('🔄 Reloading persona data to ensure persistence...');
            await authStore.loadPersonaData();
            console.log('✅ Persona data reloaded:', {
              personas: authStore.personas,
              activePersona: authStore.activePersona,
              personaData: authStore.personaData
            });
          }, 1000);
          
          alert('Welcome! You\'ve successfully joined as a collaborator. You can now start streaming on Twilly TV.');
        }
        
        router.push('/profile');
      }
    } else {
      console.error('❌ Accept invite failed:', response.error);
      alert('Error accepting collaborator invite: ' + response.message);
    }
  } catch (error) {
    console.error('❌ Accept invite error:', error);
    alert('Error accepting collaborator invite. Please try again.');
  } finally {
    isAutoAccepting.value = false;
  }
};

// Check if user is already a collaborator for this channel
const checkExistingCollaboratorStatus = async () => {
  try {
    console.log('🔍 Checking existing collaborator status...');
    
    // Check if user already has creator persona
    if (authStore.personas.creator && authStore.personaData.creator) {
      const existingChannelName = authStore.personaData.creator.channelName;
      console.log('🔍 Existing creator persona channel:', existingChannelName);
      console.log('🔍 Current invite channel:', channelName.value);
      
      if (existingChannelName === channelName.value) {
        console.log('✅ User is already a collaborator for this channel');
        isAlreadyCollaborator.value = true;
        existingCollaboratorData.value = authStore.personaData.creator;
        return true;
      }
    }
    
    // Also check if user has any creator persona (even for different channel)
    if (authStore.personas.creator) {
      console.log('ℹ️ User has creator persona but for different channel');
      return false;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Error checking existing collaborator status:', error);
    return false;
  }
};

// Accept invite function (for manual button clicks)
const acceptInvite = async () => {
  await acceptInviteDirectly();
};

// Watch for auth store changes
watch(() => authStore.user, (newUser) => {
  if (newUser && !isAuthenticated.value) {
    console.log('👤 Auth store user changed, triggering accept invite');
    isAuthenticated.value = true;
    setTimeout(() => {
      acceptInviteDirectly();
    }, 500);
  }
});

// On mounted
onMounted(async () => {
  console.log('🔐 Starting authentication check...');
  console.log('🔐 Current authStore state:', {
    authenticated: authStore.authenticated,
    user: authStore.user,
    isAuthenticated: isAuthenticated.value
  });
  
  try {
    const user = await Auth.currentAuthenticatedUser();
    console.log('🔐 Auth.currentAuthenticatedUser result:', user);
    console.log('🔐 User attributes:', user?.attributes);
    console.log('🔐 User email:', user?.attributes?.email);
    console.log('🔐 User sub:', user?.attributes?.sub);
    
    if (user) {
      console.log('✅ User found via Auth.currentAuthenticatedUser:', user);
      isAuthenticated.value = true;
      authStore.authenticated = true;
      authStore.user = user;

      // Check if user is already a collaborator for this channel
      const isExistingCollaborator = await checkExistingCollaboratorStatus();
      
      if (isExistingCollaborator) {
        console.log('✅ User is already a collaborator for this channel');
        // Don't auto-accept, just show the existing status
      } else {
        // Auto-accept the invite directly (like affiliate page)
        setTimeout(async () => {
          try {
            console.log('🚀 Starting auto-accept process...');
            await acceptInviteDirectly();
          } catch (error) {
            console.error('❌ Auto-accept failed:', error);
            showManualAccept.value = true;
          }
        }, 1000);
      }
    } else {
      console.log('❌ No user found from Auth.currentAuthenticatedUser');
      isAuthenticated.value = false;
    }
  } catch (error) {
    console.log('❌ User not authenticated:', error);
    console.log('❌ Error details:', error.message);
    console.log('❌ Error stack:', error.stack);
    isAuthenticated.value = false;
  }
  
  console.log('✅ onMounted completed, final state:', {
    authenticated: authStore.authenticated,
    user: authStore.user,
    isAuthenticated: isAuthenticated.value
  });
  
  // Set loading to false after authentication check is complete
  isCheckingAuth.value = false;
});
</script>
