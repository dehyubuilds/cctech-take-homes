<template>
  <div class="relative">
    <button 
      v-if="hasMultiplePersonas"
      @click="isOpen = !isOpen"
      class="flex items-center space-x-2 text-white hover:text-teal-400 transition-colors"
    >
      <span>{{ currentPersonaDisplayName }}</span>
      <svg 
        class="w-4 h-4" 
        :class="{ 'transform rotate-180': isOpen }" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-else class="text-white">
      {{ currentPersonaDisplayName }}
    </div>

    <div 
      v-if="isOpen && hasMultiplePersonas" 
      class="absolute right-0 mt-2 w-56 bg-black/90 backdrop-blur-sm rounded-lg shadow-lg border border-teal-900/30 py-1 z-50"
    >
      <div class="px-4 py-2 text-sm text-gray-400 border-b border-teal-900/30">
        Switch Persona
      </div>
      
      <!-- Master Account -->
      <button 
        v-if="authStore.personas.master && authStore.activePersona !== 'master'"
        @click="switchPersona('master')"
        class="w-full text-left px-4 py-2 text-sm text-white hover:bg-teal-900/30 transition-colors"
      >
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
          Master Account
        </div>
      </button>
      
      <!-- Creator Persona -->
      <button 
        v-if="authStore.personas.creator && authStore.activePersona !== 'creator'"
        @click="switchPersona('creator')"
        class="w-full text-left px-4 py-2 text-sm text-white hover:bg-teal-900/30 transition-colors"
      >
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
          </svg>
          Creator
        </div>
      </button>
      
      <!-- Affiliate Persona -->
      <button 
        v-if="authStore.personas.affiliate && authStore.activePersona !== 'affiliate'"
        @click="switchPersona('affiliate')"
        class="w-full text-left px-4 py-2 text-sm text-white hover:bg-teal-900/30 transition-colors"
      >
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd"/>
          </svg>
          Affiliate ({{ authStore.affiliateCode || 'No Code' }})
        </div>
      </button>
      
      <!-- Viewer Persona -->
      <button 
        v-if="authStore.personas.viewer && authStore.activePersona !== 'viewer'"
        @click="switchPersona('viewer')"
        class="w-full text-left px-4 py-2 text-sm text-white hover:bg-teal-900/30 transition-colors"
      >
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
          </svg>
          Viewer
        </div>
      </button>
      
      <!-- Creator Channel Switching -->
      <div v-if="authStore.personas.creator && authStore.activePersona === 'creator' && authStore.availableChannels.length > 1" class="border-t border-teal-900/30">
        <!-- Debug info -->
        <div class="px-4 py-1 text-xs text-gray-500">
          Debug: {{ authStore.availableChannels.length }} channels, active: {{ authStore.activeChannel }}
        </div>
        <div class="px-4 py-2 text-xs text-gray-400">
          Switch Channel
        </div>
        <button 
          v-for="channel in authStore.availableChannels"
          :key="channel.channelName"
          @click="switchCreatorChannel(channel.channelName)"
          :class="[
            'w-full text-left px-4 py-2 text-sm transition-colors',
            channel.channelName === authStore.activeChannel 
              ? 'text-teal-400 bg-teal-900/20' 
              : 'text-white hover:bg-teal-900/30'
          ]"
        >
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
            </svg>
            {{ channel.channelName }}
          </div>
        </button>
      </div>
      
      <div class="px-4 py-2 text-xs text-gray-500 border-t border-teal-900/30">
        {{ authStore.user?.attributes?.email || authStore.user?.username || 'No email' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const isOpen = ref(false);

const hasMultiplePersonas = computed(() => {
  const personaCount = Object.values(authStore.personas).filter(Boolean).length;
  return personaCount > 1;
});

const currentPersonaDisplayName = computed(() => {
  return authStore.getCurrentPersonaDisplayName();
});

const switchPersona = async (persona) => {
  try {
    console.log('🎭 ProfileSwitch: Switching persona to:', persona);
    await authStore.switchPersona(persona);
    isOpen.value = false;
    
    // Navigate based on persona
    switch (persona) {
      case 'master':
        await navigateTo('/managefiles');
        break;
      case 'creator':
        await navigateTo('/profile');
        break;
      case 'affiliate':
        await navigateTo('/profile');
        break;
      case 'viewer':
      default:
        await navigateTo('/channel-guide');
        break;
    }
    
  } catch (error) {
    console.error('Error switching persona:', error);
  }
};

const switchCreatorChannel = async (channelName) => {
  try {
    console.log('🎯 ProfileSwitch: Switching to channel:', channelName);
    const result = await authStore.switchCreatorChannel(channelName);
    console.log('🎯 ProfileSwitch: Channel switch result:', result);
    isOpen.value = false;
  } catch (error) {
    console.error('❌ ProfileSwitch: Error switching creator channel:', error);
  }
};

onMounted(async () => {
  // Load persona data when component mounts
  if (authStore.authenticated) {
    await authStore.loadPersonaData();
  }
});
</script>