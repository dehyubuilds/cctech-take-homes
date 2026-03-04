<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black">
    <!-- Clip Header -->
    <div class="sticky top-0 z-20 bg-black/80 backdrop-blur-sm border-b border-teal-500/30">
      <div class="max-w-7xl mx-auto px-4 py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button @click="goBack" class="p-2 text-gray-300 hover:text-white transition-colors">
              <Icon name="heroicons:arrow-left" class="w-5 h-5" />
            </button>
            <h1 class="text-white font-semibold text-lg">{{ clipTitle }}</h1>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-gray-300 text-sm">{{ formatDuration(clipDuration) }}</span>
            <button @click="toggleFullscreen" class="p-2 text-gray-300 hover:text-white transition-colors">
              <Icon name="heroicons:arrows-pointing-out" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <!-- Main Video Player -->
        <div class="lg:col-span-3">
          <div class="bg-black rounded-xl overflow-hidden">
            <!-- Video Player -->
            <div class="relative aspect-video bg-black">
              <video
                ref="videoPlayer"
                :src="clipUrl"
                :poster="clipThumbnail"
                class="w-full h-full"
                controls
                @loadedmetadata="onVideoLoad"
                @timeupdate="onTimeUpdate"
                @ended="onVideoEnd"
              >
                Your browser does not support the video tag.
              </video>
              
              <!-- Clip Overlay -->
              <div class="absolute top-4 left-4 flex items-center gap-2">
                <div class="bg-teal-500 text-white px-2 py-1 rounded text-xs font-medium">
                  CLIP
                </div>
                <div class="bg-black/50 text-white px-2 py-1 rounded text-xs">
                  {{ formatDuration(currentTime) }} / {{ formatDuration(clipDuration) }}
                </div>
              </div>

              <!-- Quality Selector -->
              <div class="absolute top-4 right-4">
                <select 
                  v-model="selectedQuality"
                  @change="changeQuality"
                  class="bg-black/50 text-white px-3 py-1 rounded text-sm border border-gray-600"
                >
                  <option value="auto">Auto</option>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                </select>
              </div>

              <!-- Purchase Overlay -->
              <div v-if="!hasAccess && clipPrice > 0" class="absolute inset-0 bg-black/80 flex items-center justify-center">
                <div class="text-center p-8">
                  <Icon name="heroicons:lock-closed" class="w-16 h-16 text-teal-400 mx-auto mb-4" />
                  <h3 class="text-white text-xl font-bold mb-2">Premium Content</h3>
                  <p class="text-gray-300 mb-6">Purchase access to watch this exclusive clip</p>
                  <div class="text-teal-400 text-2xl font-bold mb-6">${{ clipPrice }}</div>
                  <button 
                    @click="purchaseAccess"
                    class="px-8 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-medium"
                  >
                    <Icon name="heroicons:credit-card" class="w-5 h-5 inline mr-2" />
                    Purchase Access
                  </button>
                </div>
              </div>
            </div>

            <!-- Clip Info -->
            <div class="p-6">
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h2 class="text-xl font-bold text-white mb-2">{{ clipTitle }}</h2>
                  <p class="text-gray-300 text-sm mb-3">{{ clipDescription }}</p>
                  <div class="flex items-center gap-4 text-sm text-gray-400">
                    <span>{{ formatDate(clipCreatedAt) }}</span>
                    <span>{{ clipViews }} views</span>
                    <span>{{ formatDuration(clipDuration) }}</span>
                    <span v-if="clipPrice > 0" class="text-teal-400 font-bold">${{ clipPrice }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button 
                    @click="toggleLike"
                    :class="isLiked ? 'text-red-500' : 'text-gray-400'"
                    class="p-2 hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <Icon name="heroicons:heart" class="w-5 h-5" />
                  </button>
                  <button 
                    @click="shareClip"
                    class="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <Icon name="heroicons:share" class="w-5 h-5" />
                  </button>
                  <button 
                    @click="downloadClip"
                    class="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <Icon name="heroicons:arrow-down-tray" class="w-5 h-5" />
                  </button>
                </div>
              </div>

              <!-- Clip Actions -->
              <div class="flex items-center gap-4 pt-4 border-t border-gray-700">
                <button 
                  @click="toggleComments"
                  :class="showComments ? 'bg-teal-500 text-white' : 'bg-gray-700 text-gray-300'"
                  class="px-4 py-2 rounded-lg transition-colors"
                >
                  <Icon name="heroicons:chat-bubble-left-right" class="w-4 h-4 inline mr-2" />
                  Comments ({{ comments.length }})
                </button>
                <button 
                  @click="addToPlaylist"
                  class="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <Icon name="heroicons:plus" class="w-4 h-4 inline mr-2" />
                  Add to Playlist
                </button>
                <button 
                  v-if="clipPrice > 0 && !hasAccess"
                  @click="purchaseAccess"
                  class="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                >
                  <Icon name="heroicons:credit-card" class="w-4 h-4 inline mr-2" />
                  Purchase Access
                </button>
              </div>
            </div>
          </div>

          <!-- Comments Section -->
          <div v-if="showComments" class="mt-6 bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-6">
            <h3 class="text-white font-semibold mb-4">Comments</h3>
            
            <!-- Add Comment -->
            <div class="mb-6">
              <form @submit.prevent="addComment" class="flex gap-3">
                <div class="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span class="text-white text-sm font-medium">U</span>
                </div>
                <div class="flex-1">
                  <textarea
                    v-model="newComment"
                    placeholder="Add a comment..."
                    class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500 resize-none"
                    rows="2"
                  ></textarea>
                  <div class="flex justify-end mt-2">
                    <button 
                      type="submit"
                      class="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm"
                    >
                      Post Comment
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <!-- Comments List -->
            <div class="space-y-4">
              <div v-for="comment in comments" :key="comment.id" class="flex gap-3">
                <div class="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span class="text-white text-sm font-medium">{{ comment.user.charAt(0).toUpperCase() }}</span>
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-white text-sm font-medium">{{ comment.user }}</span>
                    <span class="text-gray-400 text-xs">{{ formatTime(comment.timestamp) }}</span>
                  </div>
                  <p class="text-gray-300 text-sm mb-2">{{ comment.text }}</p>
                  <div class="flex items-center gap-4 text-xs">
                    <button @click="likeComment(comment.id)" class="text-gray-400 hover:text-white">
                      <Icon name="heroicons:hand-thumb-up" class="w-4 h-4 inline mr-1" />
                      {{ comment.likes }}
                    </button>
                    <button @click="replyToComment(comment.id)" class="text-gray-400 hover:text-white">
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="lg:col-span-1">
          <!-- Creator Info -->
          <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-4 mb-6">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center">
                <span class="text-white font-medium">{{ clipCreator.charAt(0).toUpperCase() }}</span>
              </div>
              <div>
                <h4 class="text-white font-medium">{{ clipCreator }}</h4>
                <p class="text-gray-400 text-sm">{{ creatorFollowers }} followers</p>
              </div>
            </div>
            <button 
              @click="followCreator"
              :class="isFollowing ? 'bg-gray-700 text-gray-300' : 'bg-teal-500 text-white'"
              class="w-full px-4 py-2 rounded-lg transition-colors"
            >
              {{ isFollowing ? 'Following' : 'Follow' }}
            </button>
          </div>

          <!-- Related Clips -->
          <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-4">
            <h4 class="text-white font-semibold mb-4">Related Clips</h4>
            <div class="space-y-3">
              <div v-for="clip in relatedClips" :key="clip.id" 
                   class="flex gap-3 cursor-pointer hover:bg-gray-800/50 rounded-lg p-2 transition-colors"
                   @click="navigateToClip(clip.id)"
              >
                <div class="relative w-20 h-12 rounded overflow-hidden flex-shrink-0">
                  <img :src="clip.thumbnail" :alt="clip.title" class="w-full h-full object-cover" />
                  <div class="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1 rounded">
                    {{ formatDuration(clip.duration) }}
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <h5 class="text-white text-sm font-medium truncate">{{ clip.title }}</h5>
                  <p class="text-gray-400 text-xs">{{ clip.creator }}</p>
                  <div class="flex items-center gap-2 text-xs text-gray-500">
                    <span>{{ clip.views }} views</span>
                    <span v-if="clip.price > 0" class="text-teal-400">${{ clip.price }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Purchase Modal -->
    <Modal v-if="showPurchaseModal">
      <div class="relative max-w-md mx-auto">
        <div class="mb-6 text-center">
          <h3 class="text-xl font-semibold text-white">
            Purchase <span class="text-teal-400">Clip Access</span>
          </h3>
        </div>
        
        <button 
          @click="showPurchaseModal = false"
          class="absolute top-0 right-0 p-2 text-gray-400 hover:text-white transition-colors duration-200"
        >
          <Icon name="heroicons:x-mark" class="w-5 h-5" />
        </button>

        <div class="text-center mb-6">
          <div class="relative w-32 h-20 rounded-lg overflow-hidden mx-auto mb-4">
            <img :src="clipThumbnail" :alt="clipTitle" class="w-full h-full object-cover" />
          </div>
          <h4 class="text-white font-medium mb-2">{{ clipTitle }}</h4>
          <p class="text-gray-300 text-sm mb-4">{{ clipDescription }}</p>
          <div class="text-teal-400 text-3xl font-bold">${{ clipPrice }}</div>
        </div>

        <div class="space-y-4">
          <button 
            @click="processPurchase"
            class="w-full px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-medium"
          >
            <Icon name="heroicons:credit-card" class="w-5 h-5 inline mr-2" />
            Purchase with Card
          </button>
          <button 
            @click="processPurchase"
            class="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            <Icon name="heroicons:credit-card" class="w-5 h-5 inline mr-2" />
            Purchase with PayPal
          </button>
        </div>

        <div class="mt-4 text-center text-xs text-gray-400">
          <p>By purchasing, you agree to our terms of service</p>
          <p>Access granted immediately after payment</p>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import Modal from '@/components/Modal.vue';

const route = useRoute();
const videoPlayer = ref(null);

// Clip data
const clipId = route.params.id;
const clipTitle = ref('Dark Knights Opening Ceremony');
const clipDescription = ref('Exclusive footage from the opening ceremony of the Dark Knights event. Watch as the performers take the stage and the crowd goes wild.');
const clipUrl = ref('https://your-cloudfront.net/events/dark-knights-1/playlist.m3u8');
const clipThumbnail = ref('https://via.placeholder.com/400x225/14b8a6/ffffff?text=Dark+Knights+Clip');
const clipDuration = ref(1800); // 30 minutes
const clipPrice = ref(5.99);
const clipViews = ref(1247);
const clipCreatedAt = ref(new Date('2024-01-15'));
const clipCreator = ref('DarkKnightEvents');
const creatorFollowers = ref(15420);

// Player state
const selectedQuality = ref('auto');
const currentTime = ref(0);
const isLiked = ref(false);
const showComments = ref(false);
const hasAccess = ref(false);
const isFollowing = ref(false);
const showPurchaseModal = ref(false);

// Comments
const comments = ref([
  {
    id: 1,
    user: 'StreamFan123',
    text: 'Amazing performance! The energy was incredible 🔥',
    timestamp: new Date(Date.now() - 3600000),
    likes: 24
  },
  {
    id: 2,
    user: 'DarkKnightLover',
    text: 'Worth every penny! Can\'t wait for more content',
    timestamp: new Date(Date.now() - 7200000),
    likes: 18
  }
]);
const newComment = ref('');

// Related clips
const relatedClips = ref([
  {
    id: 'clip2',
    title: 'Main Event Highlights',
    creator: 'DarkKnightEvents',
    thumbnail: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Main+Event',
    duration: 2400,
    views: 892,
    price: 7.99
  },
  {
    id: 'clip3',
    title: 'Behind the Scenes',
    creator: 'DarkKnightEvents',
    thumbnail: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Behind+Scenes',
    duration: 900,
    views: 567,
    price: 3.99
  }
]);

// Video player events
const onVideoLoad = () => {
  console.log('Video loaded');
  clipDuration.value = videoPlayer.value?.duration || clipDuration.value;
};

const onTimeUpdate = () => {
  if (videoPlayer.value) {
    currentTime.value = videoPlayer.value.currentTime;
  }
};

const onVideoEnd = () => {
  console.log('Video ended');
};

// Player controls
const toggleFullscreen = () => {
  if (videoPlayer.value) {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoPlayer.value.requestFullscreen();
    }
  }
};

const changeQuality = () => {
  console.log('Quality changed to:', selectedQuality.value);
};

const goBack = () => {
  navigateTo('/streams');
};

// Interaction functions
const toggleLike = () => {
  isLiked.value = !isLiked.value;
};

const shareClip = () => {
  const shareData = {
    title: clipTitle.value,
    text: clipDescription.value,
    url: window.location.href
  };
  
  if (navigator.share) {
    navigator.share(shareData);
  } else {
    navigator.clipboard.writeText(window.location.href);
    alert('Clip link copied to clipboard!');
  }
};

const downloadClip = () => {
  if (!hasAccess.value && clipPrice.value > 0) {
    alert('Purchase access to download this clip');
    return;
  }
  // Implement download logic
  alert('Download started...');
};

const toggleComments = () => {
  showComments.value = !showComments.value;
};

const addToPlaylist = () => {
  alert('Added to playlist!');
};

const purchaseAccess = () => {
  showPurchaseModal.value = true;
};

const processPurchase = () => {
  // Simulate payment processing
  setTimeout(() => {
    hasAccess.value = true;
    showPurchaseModal.value = false;
    alert('Purchase successful! You now have access to this clip.');
  }, 2000);
};

const followCreator = () => {
  isFollowing.value = !isFollowing.value;
  alert(isFollowing.value ? 'Following creator!' : 'Unfollowed creator');
};

// Comment functions
const addComment = () => {
  if (newComment.value.trim()) {
    comments.value.unshift({
      id: Date.now(),
      user: 'You',
      text: newComment.value,
      timestamp: new Date(),
      likes: 0
    });
    newComment.value = '';
  }
};

const likeComment = (commentId) => {
  const comment = comments.value.find(c => c.id === commentId);
  if (comment) {
    comment.likes++;
  }
};

const replyToComment = (commentId) => {
  // Implement reply functionality
  alert('Reply feature coming soon!');
};

const navigateToClip = (clipId) => {
  navigateTo(`/streams/play/${clipId}`);
};

// Utility functions
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString();
};

const formatTime = (date) => {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

onMounted(() => {
  // Check if user has access to this clip
  // For demo purposes, set hasAccess to false for paid clips
  if (clipPrice.value > 0) {
    hasAccess.value = false;
  } else {
    hasAccess.value = true;
  }
});
</script>

<style scoped>
.aspect-video {
  aspect-ratio: 16 / 9;
}

.backdrop-blur-sm {
  backdrop-filter: blur(8px);
}
</style> 