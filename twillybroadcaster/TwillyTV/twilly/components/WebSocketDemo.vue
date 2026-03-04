<template>
  <div class="websocket-demo bg-gradient-to-br from-black/30 via-black/40 to-black/30 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-6 shadow-xl">
    <!-- Error Boundary -->
    <div v-if="hasError" class="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
      <div class="flex items-center gap-2 text-red-300">
        <Icon name="heroicons:exclamation-triangle" class="w-5 h-5" />
        <span>WebSocket Error: {{ errorMessage }}</span>
        <button @click="resetError" class="ml-auto px-2 py-1 bg-red-500/30 rounded text-xs hover:bg-red-500/50">
          Reset
        </button>
      </div>
    </div>
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-semibold text-white flex items-center gap-2">
        <Icon name="heroicons:signal" class="w-5 h-5 text-teal-400" />
        WebSocket Brain Demo
      </h3>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full" :class="{
            'bg-green-500': wsBrain?.isConnected,
            'bg-red-500': !wsBrain?.isConnected,
            'bg-yellow-500': wsBrain?.connectionStatus === 'connecting'
          }"></div>
          <span class="text-sm text-gray-300">
            {{ wsBrain?.connectionStatus || 'disconnected' }}
          </span>
        </div>
      </div>
    </div>

        <!-- Connection Controls -->
    <div class="flex flex-wrap gap-3 mb-6">
      <button
        v-if="isStoreReady"
        @click="wsBrain.initialize()"
        :disabled="wsBrain?.isConnected"
        class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
      >
        Initialize
      </button>
      
      <div v-else class="px-4 py-2 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-lg">
        WebSocket Store Loading...
      </div>
        
        <button
          v-if="isStoreReady"
          @click="wsBrain.disconnect()"
          :disabled="!wsBrain?.isConnected"
          class="px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        >
          Disconnect
        </button>
        
        <button
          v-if="isStoreReady"
          @click="testMessage"
          :disabled="!wsBrain?.isConnected"
          class="px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        >
          Send Test Message
        </button>
        
        <button
          v-if="isStoreReady"
          @click="testReaction"
          :disabled="!wsBrain?.isConnected"
          class="px-4 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        >
          Send Reaction
        </button>
    </div>

    <!-- Content Display -->
    <div v-if="isStoreReady" class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Channels -->
      <div class="bg-black/20 rounded-lg p-4 border border-white/10">
                  <h4 class="text-white font-medium mb-3 flex items-center gap-2">
            <Icon name="heroicons:tv" class="w-4 h-4 text-teal-400" />
                        Channels ({{ safeChannels.length }})
          </h4>
          <div class="space-y-2">
            <div v-for="channel in safeChannels" :key="channel.id" class="text-sm text-gray-300">
              {{ channel.name }} - {{ channel.description }}
            </div>
            <div v-if="safeChannels.length === 0" class="text-gray-500 text-sm">
              No channels loaded
            </div>
        </div>
        <button
          @click="loadChannels"
          :disabled="!wsBrain?.isConnected"
          class="mt-3 px-3 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded text-xs hover:bg-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        >
          Load Channels
        </button>
      </div>

      <!-- Featured Content -->
      <div class="bg-black/20 rounded-lg p-4 border border-white/10">
                  <h4 class="text-white font-medium mb-3 flex items-center gap-2">
            <Icon name="heroicons:star" class="w-4 h-4 text-yellow-400" />
                        Featured ({{ safeFeaturedContent.length }})
          </h4>
          <div class="space-y-2">
            <div v-for="item in safeFeaturedContent" :key="item.id" class="text-sm text-gray-300">
              {{ item.title }} - {{ item.type }}
            </div>
            <div v-if="safeFeaturedContent.length === 0" class="text-gray-500 text-sm">
              No featured content loaded
            </div>
        </div>
        <button
          @click="loadFeatured"
          :disabled="!wsBrain?.isConnected"
          class="mt-3 px-3 py-1 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded text-xs hover:bg-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        >
          Load Featured
        </button>
      </div>

      <!-- Live Streams -->
      <div class="bg-black/20 rounded-lg p-4 border border-white/10">
                  <h4 class="text-white font-medium mb-3 flex items-center gap-2">
            <Icon name="heroicons:video-camera" class="w-4 h-4 text-red-400" />
                        Live ({{ safeLiveStreams.length }})
          </h4>
          <div class="space-y-2">
            <div v-for="stream in safeLiveStreams" :key="stream.id" class="text-sm text-gray-300">
              {{ stream.title }} - {{ stream.viewers }} viewers
            </div>
            <div v-if="safeLiveStreams.length === 0" class="text-gray-500 text-sm">
              No live streams loaded
            </div>
        </div>
        <button
          @click="loadLive"
          :disabled="!wsBrain?.isConnected"
          class="mt-3 px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded text-xs hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        >
          Load Live
        </button>
      </div>

      <!-- Episodes -->
      <div class="bg-black/20 rounded-lg p-4 border border-white/10">
                  <h4 class="text-white font-medium mb-3 flex items-center gap-2">
            <Icon name="heroicons:play-circle" class="w-4 h-4 text-blue-400" />
                        Episodes ({{ safeRecentEpisodes.length }})
          </h4>
          <div class="space-y-2">
            <div v-for="episode in safeRecentEpisodes" :key="episode.id" class="text-sm text-gray-300">
              {{ episode.title }} - {{ episode.duration }}
            </div>
            <div v-if="safeRecentEpisodes.length === 0" class="text-gray-500 text-sm">
              No episodes loaded
            </div>
        </div>
        <button
          @click="loadEpisodes"
          :disabled="!wsBrain?.isConnected"
          class="mt-3 px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-xs hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        >
          Load Episodes
        </button>
      </div>
    </div>
    
    <!-- Fallback when store not ready -->
    <div v-else class="text-center py-8">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mx-auto mb-4"></div>
      <p class="text-gray-400">Initializing WebSocket Brain...</p>
    </div>

    <!-- Connection Stats -->
    <div v-if="isStoreReady" class="mt-6 p-4 bg-black/20 rounded-lg border border-white/10">
      <h4 class="text-white font-medium mb-3">Connection Stats</h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span class="text-gray-400">Status:</span>
          <span class="text-white ml-2">{{ wsBrain?.connectionStatus || 'disconnected' }}</span>
        </div>
        <div>
          <span class="text-gray-400">Healthy:</span>
          <span class="text-white ml-2" :class="{ 'text-green-400': wsBrain?.isHealthy, 'text-red-400': !wsBrain?.isHealthy }">
            {{ wsBrain?.isHealthy ? 'Yes' : 'No' }}
          </span>
        </div>
        <div>
          <span class="text-gray-400">Reconnect:</span>
          <span class="text-white ml-2">{{ wsBrain?.reconnectAttempts || 0 }}/{{ wsBrain?.maxReconnectAttempts || 5 }}</span>
        </div>
        <div>
          <span class="text-gray-400">Subscriptions:</span>
          <span class="text-white ml-2">{{ safeSubscriptions.size }}</span>
        </div>
      </div>
    </div>

    <!-- Connection Log -->
    <div v-if="isStoreReady" class="mt-6 p-4 bg-black/20 rounded-lg border border-white/10">
      <h4 class="text-white font-medium mb-3">Connection Log</h4>
      <div class="max-h-32 overflow-y-auto space-y-1">
        <div v-for="log in safeConnectionLog.slice(-10)" :key="log.timestamp" class="text-xs text-gray-400">
          {{ new Date(log.timestamp).toLocaleTimeString() }} - {{ log.event }}
        </div>
        <div v-if="safeConnectionLog.length === 0" class="text-gray-500 text-xs">
          No connection events logged
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useWebSocketBrain } from '~/stores/WebSocketBrain';
import { onMounted, onUnmounted, computed } from 'vue';

const wsBrain = useWebSocketBrain();

// Error handling
const hasError = ref(false);
const errorMessage = ref('');

// Safe computed properties to prevent undefined errors
const isStoreReady = computed(() => wsBrain && typeof wsBrain === 'object');
const safeChannels = computed(() => isStoreReady.value ? (wsBrain.channels || []) : []);
const safeFeaturedContent = computed(() => isStoreReady.value ? (wsBrain.featuredContent || []) : []);
const safeLiveStreams = computed(() => isStoreReady.value ? (wsBrain.liveStreams || []) : []);
const safeRecentEpisodes = computed(() => isStoreReady.value ? (wsBrain.recentEpisodes || []) : []);
const safeSubscriptions = computed(() => isStoreReady.value ? (wsBrain.subscriptions || new Set()) : new Set());
const safeConnectionLog = computed(() => isStoreReady.value ? (wsBrain.connectionLog || []) : []);

// Error handling functions
const resetError = () => {
  hasError.value = false;
  errorMessage.value = '';
};

const handleError = (error) => {
  console.error('WebSocket Demo Error:', error);
  hasError.value = true;
  errorMessage.value = error.message || 'Unknown error occurred';
};

// Test functions
const testMessage = () => {
  try {
    if (wsBrain?.publishMessage) {
      wsBrain.publishMessage('Hello from WebSocket Brain!', 'demo');
    }
  } catch (error) {
    handleError(error);
  }
};

const testReaction = () => {
  try {
    if (wsBrain?.sendReaction) {
      wsBrain.sendReaction('🔥', 'demo');
    }
  } catch (error) {
    handleError(error);
  }
};

const loadChannels = () => {
  try {
    if (wsBrain?.requestInitialData) {
      wsBrain.requestInitialData(['channels']);
    }
  } catch (error) {
    handleError(error);
  }
};

const loadFeatured = () => {
  try {
    if (wsBrain?.requestInitialData) {
      wsBrain.requestInitialData(['featured']);
    }
  } catch (error) {
    handleError(error);
  }
};

const loadLive = () => {
  try {
    if (wsBrain?.requestInitialData) {
    wsBrain.requestInitialData(['live']);
    }
  } catch (error) {
    handleError(error);
  }
};

const loadEpisodes = () => {
  try {
    if (wsBrain?.requestInitialData) {
      wsBrain.requestInitialData(['episodes']);
    }
  } catch (error) {
    handleError(error);
  }
};

// Global error handler for Vue rendering errors
const handleVueError = (error) => {
  console.error('Vue rendering error:', error);
  handleError(error);
};

// Auto-initialize on mount
onMounted(() => {
  try {
    if (wsBrain?.initialize) {
      wsBrain.initialize();
    }
  } catch (error) {
    handleError(error);
  }
  
  // Add global error handler
  window.addEventListener('error', handleVueError);
  window.addEventListener('unhandledrejection', (event) => handleVueError(event.reason));
});

// Cleanup on unmount
onUnmounted(() => {
  try {
    if (wsBrain?.cleanup) {
      wsBrain.cleanup();
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  
  // Remove global error handlers
  window.removeEventListener('error', handleVueError);
  window.removeEventListener('unhandledrejection', (event) => handleVueError(event.reason));
});
</script>

<style scoped>
.websocket-demo {
  max-width: 100%;
}

/* Custom scrollbar for connection log */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(20, 184, 166, 0.5);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(20, 184, 166, 0.7);
}
</style>
