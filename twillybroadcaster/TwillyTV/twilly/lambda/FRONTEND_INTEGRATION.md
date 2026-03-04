# Frontend Integration Guide 🚀

This guide shows how to integrate the WebSocket Brain with your Nuxt.js frontend components.

## Quick Start

### 1. Install the WebSocket Brain Store

The `WebSocketBrain` store is already created and ready to use. Import it in your components:

```javascript
import { useWebSocketBrain } from '~/stores/WebSocketBrain'
```

### 2. Basic Usage in a Component

```vue
<template>
  <div>
    <!-- Connection Status -->
    <div class="connection-status">
      <span v-if="wsBrain.isConnected" class="connected">🟢 Connected</span>
      <span v-else class="disconnected">🔴 Disconnected</span>
    </div>

    <!-- Content Display -->
    <div v-if="wsBrain.isConnected">
      <h3>Live Channels</h3>
      <div v-for="channel in channels" :key="channel.id" class="channel">
        {{ channel.name }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { useWebSocketBrain } from '~/stores/WebSocketBrain'
import { ref, onMounted, onUnmounted } from 'vue'

const wsBrain = useWebSocketBrain()
const channels = ref([])

onMounted(() => {
  // Initialize WebSocket connection
  wsBrain.initialize()
  
  // Subscribe to channel updates
  wsBrain.subscribe('channels')
  
  // Listen for channel data
  wsBrain.onMessage('channels', (data) => {
    channels.value = data
  })
})

onUnmounted(() => {
  // Clean up when component is destroyed
  wsBrain.unsubscribe('channels')
})
</script>
```

## Store Methods

### Connection Management

```javascript
// Initialize connection
wsBrain.initialize()

// Check connection status
if (wsBrain.isConnected) {
  console.log('WebSocket is connected')
}

// Manually connect/disconnect
wsBrain.connect()
wsBrain.disconnect()

// Get connection stats
const stats = wsBrain.getStats()
console.log('Connection stats:', stats)
```

### Subscriptions

```javascript
// Subscribe to content types
wsBrain.subscribe('channels')      // Channel updates
wsBrain.subscribe('featured')      // Featured content
wsBrain.subscribe('live')          // Live streams
wsBrain.subscribe('episodes')      // Episode updates
wsBrain.subscribe('series')        // Series information
wsBrain.subscribe('fire')          // Fire home page content

// Unsubscribe from specific content
wsBrain.unsubscribe('channels')

// Unsubscribe from all content
wsBrain.cleanup()
```

### Message Handling

```javascript
// Send messages to WebSocket
wsBrain.sendMessage({
  type: 'reaction',
  contentId: 'content123',
  reaction: 'like',
  userId: 'user123'
})

// Listen for specific message types
wsBrain.onMessage('channels', (data) => {
  console.log('Channel update received:', data)
})

// Listen for all messages
wsBrain.onMessage('*', (message) => {
  console.log('Message received:', message)
})
```

### Content Requests

```javascript
// Request initial data
wsBrain.requestInitialData(['channels', 'featured'])

// Request specific content
wsBrain.requestContent('channels', { userId: 'user123' })

// Refresh content
wsBrain.refreshContent('channels')
```

## Integration Examples

### 1. Channel List Component

```vue
<template>
  <div class="channels-list">
    <div class="status-bar">
      <span class="connection-status" :class="{ connected: wsBrain.isConnected }">
        {{ wsBrain.isConnected ? '🟢 Live' : '🔴 Offline' }}
      </span>
      <button @click="refreshChannels" :disabled="!wsBrain.isConnected">
        Refresh
      </button>
    </div>

    <div v-if="loading" class="loading">Loading channels...</div>
    
    <div v-else-if="channels.length > 0" class="channels-grid">
      <div v-for="channel in channels" :key="channel.id" class="channel-card">
        <h4>{{ channel.name }}</h4>
        <p>{{ channel.description }}</p>
        <div class="channel-stats">
          <span>{{ channel.viewers }} viewers</span>
          <span>{{ channel.category }}</span>
        </div>
      </div>
    </div>
    
    <div v-else class="no-channels">No channels available</div>
  </div>
</template>

<script setup>
import { useWebSocketBrain } from '~/stores/WebSocketBrain'
import { ref, onMounted, onUnmounted } from 'vue'

const wsBrain = useWebSocketBrain()
const channels = ref([])
const loading = ref(true)

onMounted(async () => {
  wsBrain.initialize()
  
  // Subscribe to channel updates
  wsBrain.subscribe('channels')
  
  // Listen for channel data
  wsBrain.onMessage('channels', (data) => {
    channels.value = data
    loading.value = false
  })
  
  // Request initial data
  await wsBrain.requestInitialData(['channels'])
})

const refreshChannels = () => {
  wsBrain.refreshContent('channels')
}

onUnmounted(() => {
  wsBrain.unsubscribe('channels')
})
</script>
```

### 2. Live Stream Component

```vue
<template>
  <div class="live-streams">
    <h3>Live Now</h3>
    
    <div v-if="liveStreams.length > 0" class="streams-grid">
      <div v-for="stream in liveStreams" :key="stream.id" class="stream-card">
        <div class="stream-thumbnail">
          <img :src="stream.thumbnail" :alt="stream.title" />
          <div class="live-badge">LIVE</div>
        </div>
        <div class="stream-info">
          <h4>{{ stream.title }}</h4>
          <p>{{ stream.channelName }}</p>
          <div class="stream-stats">
            <span>{{ stream.viewers }} watching</span>
            <span>{{ stream.duration }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="no-streams">No live streams at the moment</div>
  </div>
</template>

<script setup>
import { useWebSocketBrain } from '~/stores/WebSocketBrain'
import { ref, onMounted, onUnmounted } from 'vue'

const wsBrain = useWebSocketBrain()
const liveStreams = ref([])

onMounted(() => {
  wsBrain.initialize()
  wsBrain.subscribe('live')
  
  wsBrain.onMessage('live', (data) => {
    liveStreams.value = data
  })
  
  wsBrain.requestInitialData(['live'])
})

onUnmounted(() => {
  wsBrain.unsubscribe('live')
})
</script>
```

### 3. User Interaction Component

```vue
<template>
  <div class="user-interactions">
    <div class="reaction-buttons">
      <button @click="sendReaction('like')" class="reaction-btn like">
        👍 {{ reactions.like }}
      </button>
      <button @click="sendReaction('love')" class="reaction-btn love">
        ❤️ {{ reactions.love }}
      </button>
      <button @click="sendReaction('laugh')" class="reaction-btn laugh">
        😂 {{ reactions.laugh }}
      </button>
    </div>
    
    <div class="status-indicator">
      <span class="status-dot" :class="userStatus"></span>
      {{ userStatus }}
    </div>
  </div>
</template>

<script setup>
import { useWebSocketBrain } from '~/stores/WebSocketBrain'
import { ref, onMounted } from 'vue'

const wsBrain = useWebSocketBrain()
const reactions = ref({ like: 0, love: 0, laugh: 0 })
const userStatus = ref('online')

onMounted(() => {
  wsBrain.initialize()
  
  // Listen for reaction updates
  wsBrain.onMessage('reaction', (data) => {
    if (data.contentId === 'current-content') {
      reactions.value[data.reaction] = (reactions.value[data.reaction] || 0) + 1
    }
  })
})

const sendReaction = (reaction) => {
  wsBrain.sendMessage({
    type: 'reaction',
    contentId: 'current-content',
    reaction,
    userId: 'current-user'
  })
}

const updateStatus = (status) => {
  userStatus.value = status
  wsBrain.sendMessage({
    type: 'status',
    userId: 'current-user',
    status
  })
}
</script>
```

## Error Handling

```javascript
// Listen for connection errors
wsBrain.onError((error) => {
  console.error('WebSocket error:', error)
  
  // Show user-friendly error message
  if (error.code === 'CONNECTION_FAILED') {
    showNotification('Connection failed. Retrying...', 'error')
  }
})

// Handle reconnection
wsBrain.onReconnect(() => {
  console.log('WebSocket reconnected')
  showNotification('Connection restored!', 'success')
  
  // Resubscribe to content
  wsBrain.subscribe('channels')
  wsBrain.subscribe('featured')
})
```

## Performance Tips

### 1. Lazy Loading

```javascript
// Only initialize WebSocket when component is visible
const { isVisible } = useIntersectionObserver()

watch(isVisible, (visible) => {
  if (visible && !wsBrain.isConnected) {
    wsBrain.initialize()
  }
})
```

### 2. Debounced Updates

```javascript
import { debounce } from 'lodash-es'

// Debounce frequent updates
const debouncedUpdate = debounce((data) => {
  channels.value = data
}, 300)

wsBrain.onMessage('channels', debouncedUpdate)
```

### 3. Selective Subscriptions

```javascript
// Only subscribe to content you need
onMounted(() => {
  if (route.name === 'channels') {
    wsBrain.subscribe('channels')
  } else if (route.name === 'live') {
    wsBrain.subscribe('live')
  }
})
```

## Testing

### 1. Mock WebSocket for Testing

```javascript
// In your test setup
import { createPinia, setActivePinia } from 'pinia'

beforeEach(() => {
  setActivePinia(createPinia())
})

// Mock WebSocket
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url
    this.readyState = WebSocket.CONNECTING
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      this.onopen?.()
    }, 100)
  }
  
  send(data) {
    console.log('Mock WebSocket sent:', data)
  }
  
  close() {
    this.readyState = WebSocket.CLOSED
    this.onclose?.()
  }
}
```

### 2. Test Connection States

```javascript
import { useWebSocketBrain } from '~/stores/WebSocketBrain'

test('should connect to WebSocket', async () => {
  const wsBrain = useWebSocketBrain()
  
  await wsBrain.initialize()
  
  expect(wsBrain.isConnected).toBe(true)
})

test('should handle disconnection', async () => {
  const wsBrain = useWebSocketBrain()
  
  await wsBrain.initialize()
  wsBrain.disconnect()
  
  expect(wsBrain.isConnected).toBe(false)
})
```

## Troubleshooting

### Common Issues

1. **Connection not established**
   - Check if WebSocket URL is correct
   - Verify Lambda function is deployed
   - Check CloudWatch logs for errors

2. **Messages not received**
   - Ensure you're subscribed to the correct content type
   - Check message format matches expected structure
   - Verify Lambda function is processing messages correctly

3. **Performance issues**
   - Monitor connection count and message volume
   - Implement message batching for high-frequency updates
   - Use selective subscriptions to reduce unnecessary data

### Debug Mode

Enable debug logging in the store:

```javascript
// In your component
const wsBrain = useWebSocketBrain()
wsBrain.enableDebug() // This will log all WebSocket activity
```

## Next Steps

1. **Deploy the Lambda function** using `deploy-websocket-brain.sh`
2. **Test the WebSocket connection** with a simple component
3. **Integrate with existing pages** like home, channels, and streams
4. **Monitor performance** and adjust as needed
5. **Add error handling** and user feedback
6. **Implement advanced features** like real-time notifications

For more information, see the main [README.md](./README.md) file.
