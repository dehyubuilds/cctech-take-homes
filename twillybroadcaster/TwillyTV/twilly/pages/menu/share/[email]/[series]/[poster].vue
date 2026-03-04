<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black relative overflow-hidden">
    <!-- Real-time Status Indicator -->
    <div v-if="wsBrain && wsBrain.isConnected" class="fixed top-4 right-4 z-50 bg-black/80 backdrop-blur-sm border border-teal-500/30 rounded-xl p-3 shadow-xl max-w-[120px] sm:max-w-none">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
        <span class="text-xs text-teal-300 font-medium">LIVE</span>
        <span class="text-xs text-gray-400 hidden sm:inline">{{ liveViewerCount }} watching</span>
      </div>
    </div>





    <!-- Animated background pattern -->
    <div class="absolute inset-0 opacity-10">
      <div class="absolute top-20 left-20 w-32 h-32 bg-teal-400/20 rounded-full blur-xl animate-pulse"></div>
      <div class="absolute top-40 right-32 w-24 h-24 bg-cyan-400/20 rounded-full blur-lg animate-pulse delay-1000"></div>
      <div class="absolute bottom-32 left-1/3 w-40 h-40 bg-teal-500/15 rounded-full blur-2xl animate-pulse delay-2000"></div>
    </div>

    <!-- Hero Section with Creator-Focused Design -->
    <div class="relative w-full h-[50vh] sm:h-[55vh] md:h-[60vh] overflow-hidden">
      <!-- Background Image -->
      <div v-if="isLoading" class="absolute inset-0 bg-gradient-to-br from-teal-900 via-black to-purple-900 flex items-center justify-center">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-400 border-t-transparent mb-4"></div>
          <p class="text-white text-lg font-medium">Loading your streaming series...</p>
        </div>
      </div>
      <img 
        v-else
        :src="posterUrl" 
        class="w-full h-full object-cover"
        :alt="menuTitle"
        @error="handleImageError"
        :class="{ 'opacity-0': imageLoading }"
      />
      <img
        v-if="imageLoading"
        :src="getPosterUrl"
        class="absolute inset-0 w-full h-full object-cover"
        alt="Loading..."
      />
      
      <!-- Gradient Overlay for Better Text Readability -->
      <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
      
      <!-- Creator-Focused Header -->
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="text-center max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <!-- Twilly Branding -->
          <div class="mb-6">
            <div class="inline-flex items-center gap-3 bg-black/30 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
              <div class="w-8 h-8 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full flex items-center justify-center">
                <Icon name="heroicons:play" class="w-4 h-4 text-white" />
              </div>
              <span class="text-white font-semibold text-sm">Twilly Creator Series</span>
            </div>
          </div>
          
          <!-- Series Title -->
          <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-4 sm:mb-6 leading-tight">
                {{ menuTitle }}
              </h1>
          
          <!-- Creator Description -->
          <p class="text-gray-200 text-lg sm:text-xl md:text-2xl max-w-4xl mx-auto mb-6 sm:mb-8 leading-relaxed">
            {{ menuDescription || 'Record your story, share your link, and get paid when people watch.' }}
          </p>
          
          <!-- Creator Stats -->
          <div class="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            <div class="flex items-center gap-2 text-white/80">
              <Icon name="heroicons:video-camera" class="w-5 h-5 text-teal-400" />
              <span class="text-sm sm:text-base font-medium">{{ getContentCount('Videos') }} Episodes</span>
              </div>
            <div class="flex items-center gap-2 text-white/80">
              <Icon name="heroicons:users" class="w-5 h-5 text-cyan-400" />
              <span class="text-sm sm:text-base font-medium">Creator Channel</span>
              </div>
            <div class="flex items-center gap-2 text-white/80">
              <Icon name="heroicons:currency-dollar" class="w-5 h-5 text-green-400" />
              <span class="text-sm sm:text-base font-medium">Pay-Per-View</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Creator Navigation -->
    <div class="bg-black/50 backdrop-blur-sm border-b border-white/10">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
        <NuxtLink 
          to="/channel-guide"
            class="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-200 font-medium px-4 py-2 rounded-lg hover:bg-white/10 cursor-pointer"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
            <span>Explore All Series</span>
        </NuxtLink>
          
          <!-- Creator Actions -->
          <div class="flex items-center gap-3">
            <button class="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-200 font-medium px-4 py-2 rounded-lg hover:bg-white/10">
              <Icon name="heroicons:share" class="w-4 h-4" />
              <span class="hidden sm:inline">Share Series</span>
            </button>
            <button class="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-200 font-medium px-4 py-2 rounded-lg hover:bg-white/10">
              <Icon name="heroicons:heart" class="w-4 h-4" />
              <span class="hidden sm:inline">Follow</span>
            </button>
        </div>
        </div>
          </div>
        </div>
        
    <!-- Creator Series Overview -->
    <div class="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      <div class="bg-gradient-to-br from-black/80 to-black/60 backdrop-blur-xl rounded-3xl p-8 sm:p-12 border border-white/10 shadow-2xl">
        <div class="text-center mb-8">
          <div class="inline-flex items-center gap-3 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 rounded-full px-6 py-3 border border-teal-500/30 mb-6">
            <Icon name="heroicons:sparkles" class="w-5 h-5 text-teal-400" />
            <span class="text-teal-300 font-semibold text-sm">Creator Series</span>
            </div>
          <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">Your Streaming Episodes</h2>
          <p class="text-gray-300 text-lg max-w-3xl mx-auto">
            Record your story, share your link, and get paid when people watch. 
            <span class="text-teal-400 font-semibold">Join a platform built for creators — not algorithms.</span>
          </p>
          </div>
          

        
        <!-- Creator Stats Dashboard -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div class="bg-gradient-to-br from-teal-500/10 to-teal-600/5 rounded-2xl p-6 border border-teal-500/20 hover:border-teal-400/40 transition-all duration-300">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <Icon name="heroicons:video-camera" class="w-6 h-6 text-white" />
            </div>
            <div>
                <div class="text-2xl font-bold text-white">{{ getContentCount('Videos') }}</div>
                <div class="text-teal-300 text-sm font-medium">{{ getContentCount('Videos') === 1 ? 'Episode' : 'Episodes' }}</div>
            </div>
          </div>
          </div>
          
          <div class="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 rounded-2xl p-6 border border-cyan-500/20 hover:border-cyan-400/40 transition-all duration-300">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                <Icon name="heroicons:currency-dollar" class="w-6 h-6 text-white" />
            </div>
            <div>
                <div class="text-2xl font-bold text-white">Pay-Per-View</div>
                <div class="text-cyan-300 text-sm font-medium">Monetize Content</div>
            </div>
          </div>
          </div>
          
          <div class="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-2xl p-6 border border-purple-500/20 hover:border-purple-400/40 transition-all duration-300">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Icon name="heroicons:users" class="w-6 h-6 text-white" />
            </div>
            <div>
                <div class="text-2xl font-bold text-white">Creator</div>
                <div class="text-purple-300 text-sm font-medium">Built for You</div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Creator Episodes Section -->
    <div class="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      <!-- Section Header -->
      <div class="text-center mb-12">
        <h2 class="text-3xl sm:text-4xl font-bold text-white mb-4">Your Episodes</h2>
        <p class="text-gray-300 text-lg max-w-2xl mx-auto">
          Each episode is your story. Share your link, get paid when people watch.
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-16">
        <div class="inline-block animate-spin rounded-full h-16 w-16 border-4 border-teal-400 border-t-transparent mb-6"></div>
        <p class="text-gray-300 text-xl font-medium">Loading your episodes...</p>
        <p class="text-gray-500 text-sm mt-2">Preparing your creator content</p>
      </div>

      <!-- Episodes Grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8 sm:gap-10">
        <div v-for="item in menuItems" :key="item.SK" 
          class="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-black/80 to-black/60 backdrop-blur-xl border border-white/10 hover:border-teal-400/50 transition-all duration-500 hover:shadow-2xl hover:shadow-teal-500/20 hover:scale-105 transform"
          :class="{ 'opacity-75 cursor-not-allowed': item.airdate && !item.isVisible }">
          
          <!-- Creator Episode Badge -->
          <div class="absolute top-4 right-4 z-20">
            <div v-if="item.price > 0 && item.price !== '0.00' && item.price !== '0' && item.price !== 'Free' && item.price !== '0-00'" 
                 class="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg backdrop-blur-sm flex items-center gap-2 border border-white/20">
              <Icon name="heroicons:currency-dollar" class="w-4 h-4" />
              <span>${{ item.price }}</span>
            </div>
            <div v-else class="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg backdrop-blur-sm flex items-center gap-2 border border-white/20">
              <Icon name="heroicons:gift" class="w-4 h-4" />
              <span>Free</span>
            </div>
          </div>

          <!-- Episode Type Indicator - Hidden to prevent title blocking -->
          <div class="absolute top-4 left-4 z-20 hidden">
            <div class="w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center border border-white/20"
                 :class="{
                   'bg-gradient-to-br from-teal-500 to-teal-600': item.category === 'Videos',
                   'bg-gradient-to-br from-cyan-500 to-cyan-600': item.category === 'Audios',
                   'bg-gradient-to-br from-purple-500 to-purple-600': item.category === 'Images',
                   'bg-gradient-to-br from-green-500 to-green-600': item.category === 'Docs'
                 }">
              <Icon 
                :name="item.category === 'Videos' ? 'heroicons:play' : 
                       item.category === 'Audios' ? 'heroicons:musical-note' :
                       item.category === 'Images' ? 'heroicons:photo' : 'heroicons:document'"
                class="w-5 h-5 text-white" 
              />
            </div>
          </div>
          
          <!-- Scheduled indicator (only for non-visible scheduled items) -->
          <div v-if="item.airdate && !item.isVisible" class="absolute top-4 left-12 z-20">
            <div class="w-8 h-8 rounded-full bg-orange-500/80 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Icon name="heroicons:clock" class="w-4 h-4 text-white" />
            </div>
          </div>

          <!-- Episode Preview -->
          <div class="relative aspect-[4/3] overflow-hidden">
            <img
              :src="getPreviewUrl(item)"
              :alt="item.fileName"
              class="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
              :class="{ 'object-contain': item.category === 'Videos' && isPortraitVideo }"
            />
            
            <!-- Coming Soon overlay for scheduled episodes -->
            <div v-if="item.airdate && !item.isVisible" 
                 class="absolute inset-0 bg-black/90 flex items-center justify-center">
              <div class="text-center text-white p-6">
                <div class="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="heroicons:clock" class="w-8 h-8 text-white" />
              </div>
                <div class="text-lg font-bold mb-2">Episode Coming Soon</div>
                <div class="text-sm text-gray-300">{{ formatAirdate(item.airdate) }}</div>
            </div>
            </div>
            
            <!-- Episode Overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent">
              <div class="absolute bottom-0 left-0 right-0 p-8">
                <h3 class="text-white text-2xl font-bold mb-4 group-hover:text-teal-400 transition-colors duration-300 line-clamp-2">{{ item.title || item.fileName }}</h3>
                <p class="text-gray-300 text-base line-clamp-2 group-hover:text-white transition-colors duration-300 mb-4">{{ item.description || 'Your story, your way.' }}</p>
                
                <!-- Episode Status -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div v-if="item.category === 'Videos'" class="flex items-center gap-1 text-teal-400 text-sm font-medium">
                      <Icon name="heroicons:play" class="w-4 h-4" />
                      <span>Episode</span>
                    </div>
                    <div v-else-if="item.category === 'Audios'" class="flex items-center gap-1 text-cyan-400 text-sm font-medium">
                      <Icon name="heroicons:musical-note" class="w-4 h-4" />
                      <span>Audio</span>
                    </div>
                    <div v-else-if="item.category === 'Images'" class="flex items-center gap-1 text-purple-400 text-sm font-medium">
                      <Icon name="heroicons:photo" class="w-4 h-4" />
                      <span>Image</span>
                    </div>
                    <div v-else class="flex items-center gap-1 text-green-400 text-sm font-medium">
                      <Icon name="heroicons:document" class="w-4 h-4" />
                      <span>Document</span>
                  </div>
                </div>
                
                  <!-- Airdate for upcoming episodes -->
                <div v-if="item.airdate && !isVideoAvailable(item)" 
                       class="text-orange-400 text-xs font-medium">
                    {{ formatAirdate(item.airdate) }}
                  </div>
                </div>
              </div>
            </div>
            
                        <!-- Creator Action Button - Visible on both desktop and mobile -->
                        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
              <button
                @click.stop="handlePreview(item)"
                            class="p-4 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 rounded-full transition-all duration-300 transform hover:scale-110 shadow-2xl hover:shadow-teal-500/50 border border-white/20 backdrop-blur-sm"
                            :title="item.category === 'Videos' || item.category === 'Audios' ? 'Watch Episode' : 'View Content'"
              >
                <Icon 
                  :name="item.category === 'Videos' || item.category === 'Audios' ? 'heroicons:play' : 'heroicons:eye'" 
                  class="w-6 h-6 text-white" 
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Creator Empty State -->
      <div v-if="!isLoading && menuItems.length === 0" class="text-center py-20">
        <div class="inline-block p-12 rounded-3xl bg-gradient-to-br from-black/80 to-black/60 backdrop-blur-xl border border-white/10 mb-8">
          <div class="w-20 h-20 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:video-camera" class="w-10 h-10 text-white" />
        </div>
          <h3 class="text-3xl font-bold text-white mb-4">Start Your Series</h3>
          <p class="text-gray-300 max-w-lg mx-auto text-lg mb-6">
            Record your story, share your link, and get paid when people watch. 
            <span class="text-teal-400 font-semibold">Join a platform built for creators — not algorithms.</span>
          </p>
          <div class="flex items-center justify-center gap-2 text-teal-400">
            <Icon name="heroicons:sparkles" class="w-5 h-5" />
            <span class="text-sm font-medium">Your episodes will appear here</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Inline Video Player -->
    <div v-if="showVideoPlayer && previewItem" class="inline-video-player max-w-7xl mx-auto px-4 py-8">
      <div class="bg-gradient-to-br from-black/90 to-black/70 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl">
        <!-- Video Player Header -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Icon name="heroicons:play" class="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 class="text-xl font-bold text-white">{{ previewItem.title || previewItem.fileName }}</h3>
              <p class="text-gray-300 text-sm">Now Playing</p>
            </div>
          </div>
          <button
            @click="closeVideoPlayer"
            class="p-3 bg-red-500/20 hover:bg-red-500/30 rounded-full transition-all duration-300 text-red-400 hover:text-red-300"
            title="Close Video"
          >
            <Icon name="heroicons:x-mark" class="w-6 h-6" />
          </button>
        </div>
        
        <!-- Video Container -->
        <div class="relative bg-black rounded-2xl overflow-hidden" style="padding-bottom: 0; margin-bottom: 0;">
          <video
            ref="videoElement"
            class="video-js vjs-big-play-centered vjs-fluid w-full mobile-touch-controls"
            style="max-height: 70vh; padding-bottom: 0; margin-bottom: 0;"
            crossOrigin="anonymous"
            playsinline
            webkit-playsinline
            preload="metadata"
            @click="handleVideoClick"
            @touchstart="handleTouchStart"
            @touchend="handleTouchEnd"
          ></video>
          
          <!-- Video Controls Overlay -->
          <div class="absolute top-2 right-2 z-20 flex gap-2 sm:top-4 sm:right-4">
            <button
              @click="toggleFullscreen"
              class="p-2 bg-black/50 hover:bg-black/70 rounded-full transition-all duration-300 text-white backdrop-blur-sm"
              title="Fullscreen"
            >
              <Icon name="heroicons:arrows-pointing-out" class="w-5 h-5" />
            </button>
          </div>

          <!-- Custom Progress Bar -->
          <div class="absolute bottom-0 left-0 right-0 z-20 p-4">
            <div class="relative">
              <div 
                class="w-full h-1 bg-white/20 rounded-full cursor-pointer"
                @click="handleProgressClick"
                @touchstart="handleProgressTouchStart"
                @touchmove="handleProgressTouchMove"
                @touchend="handleProgressTouchEnd"
              >
                <div 
                  class="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all duration-200"
                  :style="{ width: progressPercentage + '%' }"
                ></div>
                <div 
                  class="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg cursor-pointer transition-all duration-200 hover:scale-110"
                  :style="{ left: progressPercentage + '%', marginLeft: '-8px' }"
                  @mousedown="startDragging"
                  @touchstart="startDragging"
                ></div>
              </div>
            </div>
          </div>

          <!-- Mobile Touch Play/Pause Indicator -->
          <div v-if="showTouchIndicator" class="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <div class="bg-black/70 rounded-full p-4 animate-pulse">
              <Icon 
                :name="videoPlayer && !videoPlayer.paused() ? 'heroicons:pause' : 'heroicons:play'" 
                class="w-12 h-12 text-white" 
              />
            </div>
          </div>
        </div>
        
        <!-- Video Info -->
        <div class="mt-4 flex items-center justify-between text-sm text-gray-300">
          <div class="flex items-center gap-4">
            <span class="flex items-center gap-1">
              <Icon name="heroicons:play" class="w-4 h-4 text-teal-400" />
              Episode
            </span>
            <span class="flex items-center gap-1">
              <Icon name="heroicons:clock" class="w-4 h-4 text-cyan-400" />
              {{ previewItem.duration || 'Unknown duration' }}
            </span>
          </div>
          <div v-if="previewItem.price > 0 && previewItem.price !== '0.00' && previewItem.price !== '0' && previewItem.price !== 'Free' && previewItem.price !== '0-00'"
               class="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
            ${{ previewItem.price }}
          </div>
        </div>

        <!-- Mobile Touch Instructions -->
        <div class="mt-2 text-center sm:hidden">
          <p class="text-xs text-gray-400">Tap video to play/pause</p>
        </div>
      </div>
    </div>

    <!-- Preview Modal -->
    <div v-if="showPreview" class="fixed inset-0 bg-black/95 z-50 flex items-start justify-center p-4 h-screen" @click.self="handleModalClose">
      <div class="relative w-full max-w-6xl mx-auto h-full flex items-start justify-center pt-20">
        <!-- Close button -->
        <button 
          @click="handleModalClose"
          class="absolute top-4 right-4 text-white hover:text-teal-400 z-10 transition-colors duration-300"
        >
          <Icon name="heroicons:x-mark" class="w-10 h-10" />
        </button>

        <!-- Preview content -->
        <div v-if="previewItem" class="relative w-full bg-black/50 backdrop-blur-sm rounded-xl overflow-hidden">
          <!-- Video preview -->
          <div v-if="previewItem.category === 'Videos'" class="relative w-full max-w-4xl mx-auto">
            <div class="video-container" :class="{ 'portrait-video-container': isPortraitVideo }">
              <!-- Preview image and play button overlay -->
              <div v-if="!showVideoPlayer" class="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
                <img
                  :src="getPreviewUrl(previewItem)"
                  class="w-full h-full object-cover"
                  :class="{ 'object-contain': isPortraitVideo }"
                  :alt="previewItem.title"
                />
                
                <!-- Airdate overlay for upcoming episodes -->
                <div v-if="previewItem.airdate && !isVideoAvailable(previewItem)" 
                     class="absolute inset-0 bg-black/80 flex items-center justify-center">
                  <div class="text-center text-white p-8">
                    <div class="mb-6">
                      <Icon name="heroicons:clock" class="w-16 h-16 text-teal-400 mx-auto mb-4" />
                      <h3 class="text-2xl font-bold mb-2">Coming Soon</h3>
                      <p class="text-gray-300 mb-4">{{ previewItem.title }}</p>
                    </div>
                    
                    <!-- Airdate display -->
                    <div class="bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border border-teal-500/30 rounded-lg p-4 mb-6">
                      <div class="text-sm text-teal-300 mb-1">Air Date</div>
                      <div class="text-xl font-bold">{{ formatAirdate(previewItem.airdate) }}</div>
                    </div>
                    
                    <!-- Countdown timer -->
                    <div v-if="getCountdown(previewItem.airdate)" 
                         class="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-lg p-4">
                      <div class="text-sm text-red-300 mb-1">Available In</div>
                      <div class="text-xl font-bold text-red-400">{{ getCountdown(previewItem.airdate) }}</div>
                    </div>
                  </div>
                </div>
                
                <!-- Play button (only if video is available) -->
                <button 
                  v-if="isVideoAvailable(previewItem)"
                  @click="playVideo"
                  class="p-4 bg-black/50 rounded-full hover:bg-black/70 transition-all duration-300 flex items-center justify-center"
                  style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);"
                >
                  <Icon name="heroicons:play" class="w-12 h-12 text-white" />
                </button>
              </div>
              <!-- Video player -->
              <div v-if="showVideoPlayer" class="w-full h-full relative">
                <video
                  ref="videoElement"
                  class="video-js vjs-big-play-centered vjs-fluid"
                  style="max-height: 80vh;"
                  crossOrigin="anonymous"
                  playsinline
                  webkit-playsinline
                  preload="metadata"
                ></video>
                
                  <!-- Video rotation controls -->
                  <div class="absolute top-4 right-4 z-20 flex gap-2">
                    <button
                      @click="toggleFullscreen"
                      class="p-2 bg-black/50 hover:bg-black/70 rounded-full transition-all duration-300 text-white backdrop-blur-sm"
                      title="Fullscreen"
                    >
                      <Icon name="heroicons:arrows-pointing-out" class="w-5 h-5" />
                    </button>
                  </div>
              </div>
            </div>
            <div class="video-overlay">
              <div class="video-info">
                <h3 class="video-title">{{ previewItem.title }}</h3>
                <p class="video-description">{{ previewItem.description }}</p>
              </div>
            </div>
          </div>

          <!-- Image preview -->
          <div v-else-if="previewItem.category === 'Images'" class="relative w-full max-w-4xl mx-auto">
            <div class="image-container">
              <img 
                :src="replaceS3WithCloudFront(previewItem.url)"
                class="w-full h-auto max-h-[80vh] object-contain mx-auto"
                :alt="previewItem.title"
              />
            </div>
            <div class="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent">
              <h3 class="text-white text-xl font-medium mb-2">{{ previewItem.title }}</h3>
              <p class="text-gray-300 text-sm">{{ previewItem.description }}</p>
            </div>
          </div>

          <!-- Audio preview -->
          <div v-else-if="previewItem.category === 'Audios'" class="p-8">
            <div class="bg-black/30 rounded-xl p-6 backdrop-blur-sm">
              <div class="flex items-center gap-4 mb-6">
                <div class="w-20 h-20 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <Icon name="heroicons:musical-note" class="w-10 h-10 text-teal-400" />
                </div>
                <div>
                  <h3 class="text-white text-xl font-medium mb-1">{{ previewItem.title }}</h3>
                  <p class="text-gray-300 text-sm">{{ previewItem.description }}</p>
                </div>
              </div>
              <audio 
                ref="audioPlayer"
                class="w-full"
                controls
                controlsList="nodownload"
              ></audio>
            </div>
          </div>

          <!-- Document preview -->
          <div v-else class="p-8">
            <div class="bg-black/30 rounded-xl p-6 backdrop-blur-sm">
              <div class="flex items-center gap-4 mb-6">
                <div class="w-20 h-20 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <Icon name="heroicons:document" class="w-10 h-10 text-teal-400" />
                </div>
                <div>
                  <h3 class="text-white text-xl font-medium mb-1">{{ previewItem.title }}</h3>
                  <p class="text-gray-300 text-sm">{{ previewItem.description }}</p>
                </div>
              </div>
              <div v-if="showPdfViewer" class="w-full h-[80vh] bg-black/50 rounded-lg overflow-hidden">
                <iframe 
                  :src="replaceS3WithCloudFront(previewItem.url) + '#toolbar=0&navpanes=0'"
                  class="w-full h-full"
                  frameborder="0"
                ></iframe>
              </div>
              <div class="flex justify-center gap-4 mt-4">
                <button
                  @click="viewDoc(previewItem)"
                  class="px-6 py-3 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300 flex items-center gap-2"
                >
                  <Icon name="heroicons:eye" class="w-5 h-5" />
                  View
                </button>
                <button
                  @click="downloadDoc(previewItem)"
                  class="px-6 py-3 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300 flex items-center gap-2"
                >
                  <Icon name="heroicons:arrow-down-tray" class="w-5 h-5" />
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 2FA Modal -->
    <div v-if="show2FA" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 class="text-xl font-bold text-white mb-4">Verify Your Phone for Purchase</h2>
        
        <!-- Phone Number Input -->
        <form v-if="!showVerification" @submit.prevent="sendVerification" class="mb-4">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-300 mb-1">Enter your phone number to verify your purchase</label>
            <input
              v-model="form.phone"
              type="tel"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg
                     focus:ring-2 focus:ring-teal-500 focus:border-teal-500
                     text-white bg-gray-800"
              placeholder="(123) 456-7890"
            />
          </div>
          <button
            type="submit"
            class="w-full bg-teal-600 text-white rounded-lg py-3 px-4
                   hover:bg-teal-700 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed
                   font-medium"
            :disabled="isLoading"
          >
            {{ isLoading ? 'Sending Code...' : 'Send Verification Code' }}
          </button>
        </form>

        <!-- Verification Code Input -->
        <form v-if="showVerification" @submit.prevent="verify2FA" class="mb-4">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-300 mb-1">Enter Verification Code</label>
            <input
              v-model="form.code"
              type="text"
              required
              maxlength="6"
              class="w-full text-center text-2xl tracking-wider px-3 py-2 border border-gray-300 rounded-lg
                     focus:ring-2 focus:ring-teal-500 focus:border-teal-500
                     text-white bg-gray-800"
              placeholder="123456"
            />
            <p class="text-sm text-gray-400 mt-2">
              Code sent to {{ formatPhone(form.phone) }}
            </p>
          </div>
          <button
            type="submit"
            class="w-full bg-teal-600 text-white rounded-lg py-3 px-4
                   hover:bg-teal-700 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed
                   font-medium"
            :disabled="isLoading"
          >
            {{ isLoading ? 'Verifying...' : 'Verify Code' }}
          </button>
        </form>

        <p v-if="errorMessage" class="text-red-500 text-sm mt-2">{{ errorMessage }}</p>
      </div>
    </div>

    <!-- Replace Cash App Modal with Stripe Checkout -->
    <div v-if="showPaymentModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4 border border-white/10">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-white">Complete Your Purchase</h2>
          <button @click="showPaymentModal = false" class="text-gray-400 hover:text-white">
            <Icon name="heroicons:x-mark" class="w-6 h-6" />
          </button>
        </div>
        
        <div v-if="selectedPurchaseItem" class="space-y-4">
          <!-- Item Preview -->
          <div class="relative aspect-video rounded-lg overflow-hidden bg-black/50">
            <img 
              :src="getPreviewUrl(selectedPurchaseItem)" 
              :alt="selectedPurchaseItem.title"
              class="w-full h-full object-cover"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent">
              <div class="absolute bottom-0 left-0 right-0 p-4">
                <h3 class="text-white font-medium">{{ selectedPurchaseItem.title }}</h3>
                <p class="text-gray-300 text-sm">{{ selectedPurchaseItem.description }}</p>
                <p class="text-teal-400 font-bold mt-2">${{ selectedPurchaseItem.price }}</p>
              </div>
            </div>
          </div>

          <!-- Payment Form -->
          <div class="bg-black/20 p-4 rounded-lg">
            <div id="payment-element" class="min-h-[200px]"></div>
          </div>

          <!-- Error Message -->
          <div v-if="errorMessage" class="text-red-500 text-sm mt-2 bg-red-500/10 p-3 rounded-lg">
            {{ errorMessage }}
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col gap-3">
            <button
              @click="handleStripeCheckout"
              :disabled="stripeLoading || !stripe"
              class="w-full bg-teal-600 text-white py-3 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Icon v-if="stripeLoading" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
              {{ stripeLoading ? 'Loading...' : 'Pay Now' }}
            </button>
            <button
              @click="showPaymentModal = false"
              class="w-full bg-gray-800 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Stripe Live Requirements -->
    <div v-if="creatorStripeStatus && creatorStripeStatus.requirements && creatorStripeStatus.requirements.length > 0" class="bg-yellow-900 text-yellow-200 p-4 rounded mt-4">
      <h4 class="font-bold mb-2">Stripe Live Requirements:</h4>
      <ul>
        <li v-for="req in creatorStripeStatus.requirements" :key="req">
          {{ req }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, watch, onUnmounted, h } from 'vue';
import { useFileStore } from '~/stores/useFileStore';
import { useAuthStore } from '~/stores/auth';
import { useRoute, useRouter } from 'vue-router';
import { useWebSocketBrain } from '~/stores/WebSocketBrain';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import TwoFactorAuth from '~/components/TwoFactorAuth.vue';
import { Auth } from 'aws-amplify';
import Hls from 'hls.js';

// Register Video.js component
const VideoPlayer = {
  name: 'VideoPlayer',
  props: {
    options: {
      type: Object,
      required: true
    }
  },
  mounted() {
    this.player = videojs(this.$el, this.options);
  },
  beforeUnmount() {
    if (this.player) {
      this.player.dispose();
    }
  },
  render() {
    return h('div', { class: 'video-js vjs-default-skin vjs-big-play-centered' });
  }
};

// Initialize stores and utilities
const fileStore = useFileStore();
const authStore = useAuthStore();
const wsBrain = useWebSocketBrain();
const route = useRoute();
const router = useRouter();

// Add isAuthenticated computed property
const isAuthenticated = computed(() => authStore.isAuthenticated);

// Define all required refs
const seriesName = ref('');
const description = ref('');
const posterUrl = ref('');
const menuItems = ref([]);

const isLoading = ref(true);
const showPreview = ref(false);
const previewItem = ref(null);
const error = ref(null);
const show2FA = ref(false);
const selectedItem = ref(null);
const showPaymentModal = ref(false);
const showPaymentPopup = ref(false);
const creatorStripeStatus = ref({
  isComplete: true, // Lemon Squeezy is always complete
  requirements: []
});
const videoPlaying = ref(false);
const player = ref(null);

const form = ref({
  phone: '',
  code: ''
});
const verificationCode = ref('');
const showVerification = ref(false);
const errorMessage = ref('');

// Get URL parameters
const userId = route.params.email; // Using email param for userId
const series = route.params.series;
const poster = route.params.poster;

// Add these refs near the top of the script section
const imageLoading = ref(true);

// Add this near the top of the script section with other refs
const showCashAppModal = ref(false)
const selectedPurchaseItem = ref(null)

// Initialize payment system (Lemon Squeezy)
const stripeLoading = ref(false);
const stripeError = ref(null);

// Add these refs at the top with other refs
const elements = ref(null);
const paymentElement = ref(null);

// Purchase checking state
const isCheckingPurchase = ref(false);
const purchaseStatuses = ref({});
const showFixedBanner = ref(false);

// WebSocket reactive data
const liveViewerCount = ref(42); // Mock data for testing
const liveItems = ref([
  { id: 'item1', title: 'Live Stream 1' },
  { id: 'item2', title: 'Live Stream 2' }
]); // Mock data for testing


// Check if airdate is in the future
const isAirdateInFuture = (airdate) => {
  if (!airdate) return false;
  const now = new Date();
  const airdateDate = new Date(airdate);
  return airdateDate > now;
};

// Add countdown timer for upcoming episodes
const countdownTimer = ref(null);

// Start countdown timer for upcoming episodes
const startCountdownTimer = () => {
  if (countdownTimer.value) clearInterval(countdownTimer.value);
  
  countdownTimer.value = setInterval(() => {
    // Force reactivity update for countdown displays
    menuItems.value = [...menuItems.value];
  }, 60000); // Update every minute
};

// Stop countdown timer
const stopCountdownTimer = () => {
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value);
    countdownTimer.value = null;
  }
};

onMounted(async () => {

  // Add scroll listener for fixed banner
  if (process.client) {
    window.addEventListener('scroll', handleScroll);
  }

  // Fetch the content
  await fetchCreatorContent();
});

onUnmounted(() => {
  if (process.client) {
    window.removeEventListener('scroll', handleScroll);
  }
  stopCountdownTimer();
});

const handleScroll = () => {
  if (process.client) {
    showFixedBanner.value = window.scrollY > 200;
  }
};

// Fetch creator details and content
const fetchCreatorContent = async () => {
  
  try {
    // Extract email from poster path
    const posterPath = decodeURIComponent(poster);
    
    // Handle both old and new path formats
    let email;
    if (posterPath.startsWith('https://')) {
      // Full URL format: https://domain/public/series-posters/email/series/filename
      const urlParts = posterPath.split('/');
      const publicIndex = urlParts.findIndex(part => part === 'public');
      if (publicIndex !== -1 && urlParts[publicIndex + 1] === 'series-posters') {
        email = urlParts[publicIndex + 2];
      } else {
        // Fallback for other URL formats
        const seriesPostersIndex = urlParts.findIndex(part => part === 'series-posters');
        if (seriesPostersIndex !== -1) {
          email = urlParts[seriesPostersIndex + 1];
        } else {
          // Last resort fallback
          email = urlParts[urlParts.length - 3]; // email should be 3rd from end
        }
      }
    } else if (posterPath.startsWith('public/series-posters/')) {
      // New format: public/series-posters/email/series/filename
      email = posterPath.split('/')[2];
    } else if (posterPath.startsWith('series-posters/')) {
      // Old format: series-posters/email/series/filename
      email = posterPath.split('/')[1];
    } else {
      // Fallback: try to extract from the path
      const pathParts = posterPath.split('/');
      email = pathParts[1] || pathParts[0];
    }
    
    // For the new URL format, use the email from the URL path directly
    // The URL format is /menu/share/email/series/poster
    const urlEmail = route.params.email;
    
    // Map username to actual email for file loading
    let finalEmail;
    if (urlEmail.includes('@')) {
      finalEmail = urlEmail;
    } else {
      // For usernames, we need to look up the actual email
      try {
        console.log('Looking up email for username:', urlEmail);
        const userResponse = await $fetch('/api/creators/get-by-username', {
          method: 'POST',
          body: { username: urlEmail }
        });
        
        if (userResponse.error) {
          console.error('Error looking up user:', userResponse.error);
          throw new Error('User not found');
        }
        
        finalEmail = userResponse.email;
        console.log('Found email for username:', urlEmail, '→', finalEmail);
      } catch (error) {
        console.error('Failed to look up user by username:', error);
        throw new Error('User not found');
      }
    }
    console.log('Final email to use:', finalEmail);
    

    
    // Get files using the email
    await fileStore.getFiles(finalEmail);
    
    const decodedSeries = decodeURIComponent(series);
    
    // Filter items for this series
    const filteredItems = fileStore.files.filter(file => {
      if (!file || !file.fileName) {
        return false;
      }
      
      // Skip thumbnails and any .gif files that are not thumbnails
      if (file.fileName.includes('_0.gif') || (file.fileName.endsWith('.gif') && !file.fileName.includes('_0.gif'))) {
        return false;
      }
      
      // Skip quality variant files (those with _240p, _360p, _480p, _720p, _1080p)
      if (file.fileName && /_\d{3,4}p\./.test(file.fileName)) {
        return false;
      }
      
      // For videos, only show if it has an HLS URL
      if (file.category === 'Videos' && !file.hlsUrl) {
        return false;
      }
      
      // DEBUG: Log visibility status
      console.log('=== VISIBILITY DEBUG ===');
      console.log('File:', file.fileName);
      console.log('isVisible:', file.isVisible);
      console.log('airdate:', file.airdate);
      console.log('category:', file.category);
      
      // CORRECT LOGIC:
      // 1. If visible (isVisible === true) → Always show it
      // 2. If not visible but has future airdate → Show as scheduled
      // 3. If not visible and no future airdate → Hide it
      if (file.isVisible === true || file.isVisible === 'true') {
        // Item is visible - show it regardless of airdate
        console.log('✓ Showing visible file:', file.fileName);
      } else if (file.airdate && isAirdateInFuture(file.airdate)) {
        // Item is not visible but has future airdate - show it as scheduled
        console.log('✓ Showing scheduled file with future airdate:', file.fileName);
      } else {
        // Item is not visible and has no future airdate - hide it
        console.log('✗ Hiding non-visible file:', file.fileName);
        return false;
      }
      
      // Check if the file belongs to the current series
      const fileSeriesName = file.seriesName || file.folderName;
      const decodedSeries = decodeURIComponent(series);
      
      // The URL encoding can vary; prefer title from query if present, else decoded path
      const titleFromQuery = route.query.title;

      // Strict case-insensitive equality match only (no substring matches)
      const targetSeries = (titleFromQuery || decodedSeries || '').trim().toLowerCase();
      const fileSeries = (fileSeriesName || '').trim().toLowerCase();

      return fileSeries === targetSeries;
    });

    // Filter out .jpg/.jpeg files before mapping
    const finalFilteredItems = filteredItems.filter(item => {
      const fileName = item.fileName || item.title || '';
      const url = item.url || '';
      
      // Skip if filename or URL contains .jpg or .jpeg
      if (fileName.includes('.jpg') || fileName.includes('.jpeg') || 
          url.includes('.jpg') || url.includes('.jpeg')) {
        return false;
      }
      
      return true;
    });

    // Map the filtered items to the required format and sort by upload date (newest first)
    menuItems.value = finalFilteredItems
      .map(file => {
        // Check if airdate has passed and make visible if needed
        let shouldBeVisible = file.isVisible;
        if (file.airdate && !file.isVisible) {
          const now = new Date();
          const airdate = new Date(file.airdate);
          if (airdate <= now) {
            shouldBeVisible = true;
            console.log('Airdate has passed, making episode visible:', file.fileName);
          }
        }
        
        return {
          id: file.SK,
          title: file.title || file.fileName,
          description: file.description || 'No description available',
          price: file.price === "$0.00" ? 0 : (Number(file.price) || 0),
          category: file.category || 'Mixed',
          url: file.url,
          hlsUrl: file.hlsUrl,
          thumbnailUrl: file.thumbnailUrl,
          fileExtension: file.fileExtension,
          uploadDate: file.uploadDate || file.lastModified || file.timestamp || new Date().toISOString(),
          airdate: file.airdate,
          isVisible: shouldBeVisible
        };
      })
      .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));



    // Set series details
    seriesName.value = decodedSeries;
    menuTitle.value = route.query.title || decodedSeries;
                menuDescription.value = route.query.description || `Channel content from ${decodedSeries}`;
    
    // Set poster URL
    posterUrl.value = getPosterUrl.value;
    
    // Set up optimized meta tags for social sharing
    const ogImages = getOptimizedOGImage.value;
    
    useHead({
      title: menuTitle.value,
      meta: [
        {
          hid: 'description',
          name: 'description',
          content: menuDescription.value,
        },
        {
          hid: 'og:title',
          property: 'og:title',
          content: menuTitle.value,
        },
        {
          hid: 'og:description',
          property: 'og:description',
          content: menuDescription.value,
        },
        // Primary image for WhatsApp/Instagram compatibility
        {
          hid: 'og:image',
          property: 'og:image',
          content: ogImages.primary,
        },
        // Fallback image for other platforms
        {
          hid: 'og:image:url',
          property: 'og:image:url',
          content: ogImages.fallback,
        },
        {
          hid: 'twitter:card',
          name: 'twitter:card',
          content: 'summary_large_image',
        },
        {
          hid: 'twitter:image',
          name: 'twitter:image',
          content: ogImages.primary,
        },
      ],
    });
    
    // Check purchase statuses for all paid items
    if (authStore.user?.username) {
      await checkAllPurchaseStatuses();
    }
    
    // Start countdown timer if there are upcoming episodes
    const hasUpcomingEpisodes = menuItems.value.some(item => 
      item.airdate && !isVideoAvailable(item)
    );
    if (hasUpcomingEpisodes) {
      startCountdownTimer();
    }
  } catch (err) {
    console.error('Error fetching content:', err);
    error.value = err.message || 'Unable to load content. Please try again later.';
    menuItems.value = []; // Clear any existing items
  } finally {
    isLoading.value = false;
  }
};

// Define all required refs
const menuTitle = ref('');
const menuDescription = ref('');

// Get poster URL - use the poster URL from the route directly
const getPosterUrl = computed(() => {
  if (poster === 'default') {
    imageLoading.value = false;
    // Use the actual channel poster URL based on the series
    const baseUrl = 'https://d3hv50jkrzkiyh.cloudfront.net';
    const seriesName = decodeURIComponent(route.params.series);
    const posterPath = `public/series-posters/dehyu.sinyan@gmail.com/${seriesName}/DsinyanGivzey.jpeg`;
    return `${baseUrl}/${posterPath}`;
  }
  
  // Simply decode and use the poster URL from the route
  const decodedPoster = decodeURIComponent(poster);
  
  // Fix the poster URL to include /public/ prefix if missing
  if (decodedPoster.includes('d3hv50jkrzkiyh.cloudfront.net/series-posters/')) {
    const fixedPoster = decodedPoster.replace('d3hv50jkrzkiyh.cloudfront.net/series-posters/', 'd3hv50jkrzkiyh.cloudfront.net/public/series-posters/');
    return fixedPoster;
  }
  
  return decodedPoster;
});

// Get optimized OG image for social sharing
const getOptimizedOGImage = computed(() => {
  const seriesName = decodeURIComponent(route.params.series).toLowerCase();
  
  // Channel-specific local assets for guaranteed WhatsApp/Instagram compatibility
  const localAssets = {
    'twilly after dark': '/assets/channels/twilly-after-dark-og.png',
    'default': '/assets/twilly-logo-streaming.png'
  };
  
  // Try to get local asset first, fallback to dynamic poster
  const localAsset = localAssets[seriesName] || localAssets['default'];
  const dynamicPoster = getPosterUrl.value;
  
  return {
    primary: localAsset, // For WhatsApp/Instagram compatibility
    fallback: dynamicPoster // For other platforms
  };
});

// Helper function to check if video is available (visible or past airdate)
const isVideoAvailable = (item) => {
  if (item.isVisible === true || item.isVisible === 'true') return true;
  if (item.airdate && !isAirdateInFuture(item.airdate)) return true;
  return false;
};

// Add function to format airdate in CST
const formatAirdate = (airdate) => {
  if (!airdate) return '';
  const date = new Date(airdate);
  return date.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
};

// Add function to get countdown for upcoming episodes
const getCountdown = (airdate) => {
  if (!airdate) return null;
  const now = new Date();
  const airdateTime = new Date(airdate);
  const diff = airdateTime - now;
  
  if (diff <= 0) return null; // Already aired
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// Add this function in the script section
const handleImageError = (error) => {
  console.error('Error loading image:', error);
  imageLoading.value = false; // Don't show loading state for failed images
  // Use a fallback image that actually exists
  const fallbackImage = 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/dehyu.sinyan@gmail.com/DehCollective/DsinyanGivzey.jpeg';
  if (posterUrl.value !== fallbackImage) {
    posterUrl.value = fallbackImage;
  }
};

// Add onMounted hook to handle image loading
onMounted(() => {
  if (process.client) {
    const img = new Image();
    img.onload = () => {
      imageLoading.value = false;
    };
    img.onerror = () => {
      imageLoading.value = false;
    };
    img.src = posterUrl.value;
  }
});

// Function to check if user has purchased content
const checkPurchaseStatus = async (contentId) => {
  try {
    if (!authStore.user?.username) {
      return false; // Not authenticated, can't have purchased
    }

    const response = await $fetch('/api/purchases/check-access', {
      method: 'POST',
      body: {
        userId: authStore.user.username,
        contentId: contentId
      }
    });

    if (response.success) {
      return response.data.hasAccess;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking purchase status:', error);
    return false;
  }
};

// Function to check purchase status for all items
const checkAllPurchaseStatuses = async () => {
  if (!authStore.user?.username) return;
  
  isCheckingPurchase.value = true;
  
  try {
    const paidItems = menuItems.value.filter(item => item.price > 0);
    
    for (const item of paidItems) {
      const hasPurchased = await checkPurchaseStatus(item.id);
      purchaseStatuses.value[item.id] = hasPurchased;
      
      // Update the item directly
      const menuItem = menuItems.value.find(mi => mi.id === item.id);
      if (menuItem) {
        menuItem.hasPurchased = hasPurchased;
      }
    }
  } catch (error) {
    console.error('Error checking purchase statuses:', error);
  } finally {
    isCheckingPurchase.value = false;
  }
};



// Get preview URL for items
const getPreviewUrl = (item) => {
  if (item.thumbnailUrl) {
    return replaceS3WithCloudFront(item.thumbnailUrl);
  }
  if (item.category === 'Videos') {
    return replaceS3WithCloudFront(item.thumbnailUrl) || 'https://d4idc5cmwxlpy.cloudfront.net/Screenshot+2025-07-04+at+10.13.36%E2%80%AFPM.png';
  }
  if (item.category === 'Images') {
    return replaceS3WithCloudFront(item.url);
  }
  if (item.category === 'Audios') {
    return 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExdXpsZDJlMmZ2aW5sYnptMW1hYzlxN2I4NmI2anV0MGk1ZnM0bmcyeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/4oMoIbIQrvCjm/giphy.gif';
  }
  if (item.category === 'Docs') {
    return 'https://theprivatecollection.s3.us-east-2.amazonaws.com/pdf.png';
  }
  return 'https://d4idc5cmwxlpy.cloudfront.net/Screenshot+2025-07-04+at+10.13.36%E2%80%AFPM.png';
};

// Add video player ref
const videoPlayer = ref(null);
const audioPlayer = ref(null);

// Add a ref for the video element
const videoElement = ref(null);

// Add video rotation state and aspect ratio detection
const videoRotation = ref(0); // 0, 90, 180, 270 degrees
const videoAspectRatio = ref('landscape'); // 'landscape', 'portrait', 'square'
const isPortraitVideo = ref(false);

// Function to detect video aspect ratio
const detectVideoAspectRatio = (videoElement) => {
  if (!videoElement) return;
  
  videoElement.addEventListener('loadedmetadata', () => {
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    
    if (videoWidth && videoHeight) {
      const ratio = videoWidth / videoHeight;
      
      if (ratio < 0.8) {
        videoAspectRatio.value = 'portrait';
        isPortraitVideo.value = true;
      } else if (ratio > 1.2) {
        videoAspectRatio.value = 'landscape';
        isPortraitVideo.value = false;
      } else {
        videoAspectRatio.value = 'square';
        isPortraitVideo.value = false;
      }
      
      console.log(`Video aspect ratio detected: ${videoAspectRatio.value} (${videoWidth}x${videoHeight})`);
    }
  });
};

// Watch for video rotation changes and apply transform
watch(videoRotation, (newRotation) => {
  if (videoPlayer.value && videoPlayer.value.el()) {
    const videoEl = videoPlayer.value.el();
    const videoTech = videoEl.querySelector('.vjs-tech');
    if (videoTech) {
      videoTech.style.transform = `rotate(${newRotation}deg)`;
      videoTech.style.transformOrigin = 'center center';
      
      // Adjust container size based on rotation and aspect ratio
      if (newRotation === 90 || newRotation === 270) {
        // Rotated - adjust for portrait videos
        if (isPortraitVideo.value) {
          videoEl.style.width = '100%';
          videoEl.style.height = 'calc(100vh - 120px)';
          videoEl.style.maxWidth = '90vw';
          videoEl.style.maxHeight = '90vh';
        } else {
          videoEl.style.width = '720px';
          videoEl.style.height = '1280px';
          videoEl.style.maxWidth = '90vw';
          videoEl.style.maxHeight = '90vh';
        }
      } else {
        // Normal orientation
        if (isPortraitVideo.value) {
          videoEl.style.width = '100%';
          videoEl.style.height = 'calc(100vh - 120px)';
          videoEl.style.maxWidth = '90vw';
          videoEl.style.maxHeight = '90vh';
        } else {
          videoEl.style.width = '100%';
          videoEl.style.height = '720px';
          videoEl.style.maxWidth = '1280px';
          videoEl.style.maxHeight = '720px';
        }
      }
    }
  }
});

// Update handlePreview to show the modal and set the preview item, but do not autoplay yet
const showVideoPlayer = ref(false);

const handlePreview = (item) => {
  // Check if video is available for preview
  if (item.airdate && !item.isVisible) {
    console.log('Video not available for preview yet:', item.title);
    return; // Don't open preview for scheduled items
  }
  
  // For videos, play inline instead of opening modal
  if (item.category === 'Videos' && isVideoAvailable(item)) {
    console.log('Video is available, opening inline video player');
    previewItem.value = item;
    playVideo();
    return;
  }
  
  previewItem.value = item;
  showPreview.value = true;
  videoPlaying.value = false;
  showVideoPlayer.value = false;
  videoRotation.value = 0; // Reset rotation when opening new video
  progressPercentage.value = 0; // Reset progress when opening new video
};

// Function to rotate video - REMOVED as requested

// Fullscreen toggle function
const toggleFullscreen = () => {
  if (!videoPlayer.value) return;
  
  try {
    if (videoPlayer.value.isFullscreen()) {
      videoPlayer.value.exitFullscreen();
    } else {
      videoPlayer.value.requestFullscreen();
    }
  } catch (error) {
    console.error('Fullscreen error:', error);
    // Fallback to native fullscreen
    const videoElement = videoPlayer.value.el();
    if (videoElement.requestFullscreen) {
      videoElement.requestFullscreen();
    } else if (videoElement.webkitRequestFullscreen) {
      videoElement.webkitRequestFullscreen();
    } else if (videoElement.msRequestFullscreen) {
      videoElement.msRequestFullscreen();
    }
  }
};

// Progress bar functions
const handleProgressClick = (event) => {
  if (!videoPlayer.value) return;
  
  const progressBar = event.currentTarget;
  const rect = progressBar.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const percentage = (clickX / rect.width) * 100;
  
  const duration = videoPlayer.value.duration();
  if (duration) {
    const newTime = (percentage / 100) * duration;
    videoPlayer.value.currentTime(newTime);
    progressPercentage.value = percentage;
  }
};

const handleProgressTouchStart = (event) => {
  event.preventDefault();
  isDragging.value = true;
  handleProgressClick(event);
};

const handleProgressTouchMove = (event) => {
  if (!isDragging.value || !videoPlayer.value) return;
  
  event.preventDefault();
  const progressBar = event.currentTarget;
  const rect = progressBar.getBoundingClientRect();
  const touchX = event.touches[0].clientX - rect.left;
  const percentage = Math.max(0, Math.min(100, (touchX / rect.width) * 100));
  
  const duration = videoPlayer.value.duration();
  if (duration) {
    const newTime = (percentage / 100) * duration;
    videoPlayer.value.currentTime(newTime);
    progressPercentage.value = percentage;
  }
};

const handleProgressTouchEnd = (event) => {
  isDragging.value = false;
};

const startDragging = (event) => {
  event.preventDefault();
  isDragging.value = true;
  
  const handleMouseMove = (e) => {
    if (!isDragging.value || !videoPlayer.value) return;
    
    const progressBar = document.querySelector('.w-full.h-1.bg-white\\/20');
    if (!progressBar) return;
    
    const rect = progressBar.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (mouseX / rect.width) * 100));
    
    const duration = videoPlayer.value.duration();
    if (duration) {
      const newTime = (percentage / 100) * duration;
      videoPlayer.value.currentTime(newTime);
      progressPercentage.value = percentage;
    }
  };
  
  const handleMouseUp = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

// Function to close inline video player
const closeVideoPlayer = () => {
  console.log('Closing inline video player');

  // Stop and dispose of the video player
  if (videoPlayer.value) {
    try {
      videoPlayer.value.pause();
      videoPlayer.value.dispose();
      videoPlayer.value = null;
    } catch (error) {
      console.error('Error disposing video player:', error);
    }
  }

  // Reset video state
  showVideoPlayer.value = false;
  videoPlaying.value = false;
  videoRotation.value = 0;
  previewItem.value = null;
};

// Mobile touch controls
const touchStartTime = ref(0);
const touchStartY = ref(0);
const showTouchIndicator = ref(false);
const progressPercentage = ref(0);
const isDragging = ref(false);

const handleTouchStart = (event) => {
  // Don't handle touch if it's on the progress bar
  if (event.target.closest('.w-full.h-1.bg-white\\/20') || event.target.closest('[class*="progress"]')) {
    return;
  }
  
  touchStartTime.value = Date.now();
  touchStartY.value = event.touches[0].clientY;
  console.log('Touch start detected');
};

const handleTouchEnd = (event) => {
  // Don't handle touch if it's on the progress bar
  if (event.target.closest('.w-full.h-1.bg-white\\/20') || event.target.closest('[class*="progress"]')) {
    return;
  }
  
  const touchDuration = Date.now() - touchStartTime.value;
  const touchEndY = event.changedTouches[0].clientY;
  const touchDistance = Math.abs(touchEndY - touchStartY.value);
  
  console.log('Touch end detected:', { touchDuration, touchDistance });
  
  // If it's a quick tap (less than 200ms) and minimal movement (less than 10px), toggle play/pause
  if (touchDuration < 200 && touchDistance < 10) {
    console.log('Toggling video play/pause');
    toggleVideoPlay();
  }
};

const handleVideoClick = (event) => {
  // Don't handle click if it's on controls or progress bar
  if (event.target.closest('button') || event.target.closest('.w-full.h-1.bg-white\\/20') || event.target.closest('[class*="progress"]')) {
    return;
  }
  
  console.log('Video clicked, toggling play/pause');
  toggleVideoPlay();
};

const toggleVideoPlay = () => {
  if (videoPlayer.value) {
    if (videoPlayer.value.paused()) {
      videoPlayer.value.play();
      console.log('Video playing');
    } else {
      videoPlayer.value.pause();
      console.log('Video paused');
    }
    
    // Show touch indicator briefly
    showTouchIndicator.value = true;
    setTimeout(() => {
      showTouchIndicator.value = false;
    }, 1000);
  }
};

const playVideo = async () => {
  // Check if video is available for playback
  if (!isVideoAvailable(previewItem.value)) {
    console.log('Video not available for playback yet:', previewItem.value.title);
    return;
  }
  
  showVideoPlayer.value = true;
  await nextTick();
  
  // Scroll to the inline video player smoothly
  const videoPlayerElement = document.querySelector('.inline-video-player');
  if (videoPlayerElement) {
    videoPlayerElement.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
  }
  
  if (videoElement.value) {
    try {
      // Clean up any existing player first
      if (videoPlayer.value) {
        videoPlayer.value.dispose();
        videoPlayer.value = null;
      }

      // Get the HLS URL
      const hlsUrl = replaceS3WithCloudFront(previewItem.value.hlsUrl);
      console.log('Loading video from URL:', hlsUrl);

      // Initialize video.js with mobile-optimized configuration
      const player = videojs(videoElement.value, {
        controls: true,
        fluid: true,
        responsive: true,
        width: '100%',
        height: 'auto',
        playsinline: true, // Important for mobile
        preload: 'metadata',
        html5: {
          vhs: {
            enableLowInitialPlaylist: true,
            overrideNative: true,
            withCredentials: false
          },
          nativeControlsForTouch: false // Use Video.js controls on mobile
        },
        crossOrigin: 'anonymous',
        techOrder: ['html5'] // Force HTML5 tech
      });

      // Set up error handling
      player.on('error', (error) => {
        console.error('Video.js error:', error);
        const errorDetails = player.error();
        console.error('Error details:', errorDetails);
        errorMessage.value = 'Error loading video. Please try again later.';
      });

      // Set up ready handler
      player.on('ready', () => {
        console.log('Player is ready');
        console.log('Screen width:', window.innerWidth);
        console.log('Is mobile:', window.innerWidth <= 768);
        
        // Apply basic styling
      const playerEl = player.el();
      playerEl.style.width = '100%';
        playerEl.style.height = 'auto';
      playerEl.style.backgroundColor = '#000';
      playerEl.style.borderRadius = '0.5rem';
      playerEl.style.overflow = 'hidden';
      
        // Set max height based on screen size
      if (window.innerWidth <= 768) {
        playerEl.style.maxHeight = '50vh';
          console.log('Applied mobile styling - max height: 50vh');
      } else {
          playerEl.style.maxHeight = '70vh';
          console.log('Applied desktop styling - max height: 70vh');
        }
        
        console.log('Player element styled:', playerEl);
        console.log('Player element dimensions:', {
          width: playerEl.offsetWidth,
          height: playerEl.offsetHeight,
          maxHeight: playerEl.style.maxHeight
        });
      });

      // Add loadstart event to see when video starts loading
      player.on('loadstart', () => {
        console.log('Video load started');
      });

      // Add loadedmetadata event to see when video metadata is loaded
      player.on('loadedmetadata', () => {
        console.log('Video metadata loaded');
        console.log('Video dimensions:', player.videoWidth(), 'x', player.videoHeight());
      });

      // Add canplay event to see when video can start playing
      player.on('canplay', () => {
        console.log('Video can start playing');
      });

      // Add timeupdate event to update progress bar
      player.on('timeupdate', () => {
        if (!isDragging.value) {
          const currentTime = player.currentTime();
          const duration = player.duration();
          if (duration > 0) {
            progressPercentage.value = (currentTime / duration) * 100;
          }
        }
      });

      // Set the video source
      player.src({
        src: hlsUrl,
        type: 'application/x-mpegURL',
        withCredentials: false
      });

      // Handle player events
      player.on('play', () => {
        console.log('Video started playing');
        videoPlaying.value = true;
      });

      player.on('pause', () => {
        console.log('Video paused');
        videoPlaying.value = false;
      });

      player.on('ended', () => {
        console.log('Video ended');
        videoPlaying.value = false;
        showVideoPlayer.value = false;
      });

      // Store player instance for cleanup
      videoPlayer.value = player;

      // Try to play the video
      try {
        await player.play();
      } catch (playError) {
        console.error('Error playing video:', playError);
        errorMessage.value = 'Error playing video. Please try again later.';
      }

    } catch (error) {
      console.error('Error initializing video player:', error);
      showVideoPlayer.value = false;
      errorMessage.value = 'Error loading video. Please try again later.';
    }
  }
};

// Update the cleanup function
onUnmounted(() => {
  if (videoPlayer.value) {
    try {
      videoPlayer.value.pause();
      videoPlayer.value.dispose();
      videoPlayer.value = null;
    } catch (error) {
      console.error('Error cleaning up video player:', error);
    }
  }
});

// Update the modal close handler
const handleModalClose = () => {
  if (videoPlayer.value) {
    try {
      videoPlayer.value.pause();
      videoPlayer.value.dispose();
      videoPlayer.value = null;
    } catch (error) {
      console.error('Error cleaning up video player:', error);
    }
  }
  showPreview.value = false;
  showVideoPlayer.value = false;
  videoPlaying.value = false;
};

// Update video player related code
function onPlayerReady(event) {
  player.value = event;
  
  // Add fullscreen change event listener
  player.value.on('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      // When exiting fullscreen, pause the video and show thumbnail
      player.value.pause();
      videoPlaying.value = false;
    }
  });
}

function onPlayerPlay(event) {
  videoPlaying.value = true;
  // Use videoElement.value and check for null
  if (videoElement.value) {
    videoElement.value.controls = true; // This is usually not needed, but safe
  }
}

function onPlayerPause(event) {
  videoPlaying.value = false;
  if (player.value) {
    player.value.currentTime(0); // Reset to beginning
  }
}

function onPlayerEnded(event) {
  videoPlaying.value = false;
  if (player.value) {
    player.value.currentTime(0); // Reset to beginning
  }
}

function onPlayerTimeupdate(event) {
  // Handle time update if needed
  console.log('Current time:', event.target.currentTime);
}

const videoOptions = {
  autoplay: false,
  controls: true,
  responsive: true,
  fluid: true,
  playbackRates: [0.5, 1, 1.5, 2],
  controlBar: {
    children: [
      'playToggle',
      'volumePanel',
      'currentTimeDisplay',
      'timeDivider',
      'durationDisplay',
      'progressControl',
      'playbackRateMenuButton',
      'fullscreenToggle'
    ]
  },
  html5: {
    vhs: {
      enableLowInitialPlaylist: true,
      overrideNative: true,
      withCredentials: false
    },
    nativeControlsForTouch: false
  },
  userActions: {
    hotkeys: true,
    doubleClick: true
  }
};

// Purchase or access item
const handlePurchase = async (item) => {
  try {
    // If user has already purchased, show the content
    if (item.hasPurchased) {
      handlePreview(item);
      return;
    }

    // Require authentication for purchases
    if (!isAuthenticated.value) {
      errorMessage.value = 'Please sign in to purchase content';
      // Store the current route path to redirect back after login
      const returnUrl = route.fullPath;
      console.log('Purchase redirect - Current fullPath:', returnUrl);
      console.log('Purchase redirect - Encoded returnUrl:', encodeURIComponent(returnUrl));
      await navigateTo(`/signin?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    // Check if user is authenticated and has email
    if (!authStore.user?.attributes?.email) {
      errorMessage.value = 'Please sign in to make purchases';
      return;
    }

    // Create Stripe checkout session for this item
    const checkoutData = {
      creatorId: userId, // The creator's email
      clipId: item.id,
      title: item.title,
      description: item.description,
      price: item.price,
      clipUrl: item.url || item.hlsUrl,
      thumbnailUrl: item.thumbnailUrl,
      category: item.category
    };

    console.log('Creating Stripe checkout session:', checkoutData);

    const response = await $fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      body: checkoutData
    });

    if (response.success) {
      console.log('Stripe checkout session created:', response);
      
      // Redirect to Stripe checkout
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      } else {
        throw new Error('No checkout URL received');
      }
    } else {
      throw new Error(response.message || 'Failed to create checkout session');
    }
  } catch (error) {
    console.error('Error handling purchase:', error);
    errorMessage.value = error.message || 'Error processing purchase. Please try again.';
  }
};

// Update the handleStripeCheckout function
const handleStripeCheckout = async () => {
  try {
    console.log('=== STARTING PAYMENT PROCESS ===');
    console.log('Selected item:', selectedPurchaseItem.value);

    if (!selectedPurchaseItem.value) {
      console.error('No item selected for purchase');
      throw new Error('No item selected for purchase');
    }

    stripeLoading.value = true;
    errorMessage.value = '';

    console.log('Creating payment intent with:', {
      amount: Math.round(selectedPurchaseItem.value.price * 100),
      currency: 'usd',
              stripeAccountId: creatorStripeStatus?.stripeAccountId
    });

    // Create payment intent
    const response = await $fetch('/api/stripe/create-payment-intent', {
      method: 'POST',
      body: {
        amount: Math.round(selectedPurchaseItem.value.price * 100), // Convert to cents
        currency: 'usd',
        stripeAccountId: creatorStripeStatus?.stripeAccountId
      }
    });

    console.log('Payment intent response:', response);

    if (!response.clientSecret) {
      console.error('No client secret received from server');
      throw new Error('No client secret received from server');
    }

    // Initialize Stripe Elements if not already initialized
    if (!elements.value) {
      await initializeStripeElements(response.clientSecret);
    }

    console.log('Confirming payment...');
    // Confirm the payment
    const { error, paymentIntent } = await stripe.value.confirmPayment({
      elements: elements.value,
      confirmParams: {
        return_url: `${window.location.origin}/payment/success`,
        payment_method_data: {
          billing_details: {
            name: selectedPurchaseItem.value.title,
          },
        },
      },
    });

    if (error) {
      console.error('Payment confirmation error:', error);
      throw error;
    }

    console.log('Payment successful:', paymentIntent);
    // If we get here, the payment was successful
    showPaymentModal.value = false;
    await navigateTo('/payment/success');
  } catch (error) {
    console.error('Payment error:', error);
    console.error('Error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      decline_code: error.decline_code
    });
    errorMessage.value = error.message || 'Error processing payment. Please try again.';
  } finally {
    stripeLoading.value = false;
  }
};

// Update the initializeStripeElements function
const initializeStripeElements = async (clientSecret) => {
  try {
    console.log('Initializing Stripe Elements with client secret:', clientSecret);
    const config = useRuntimeConfig();
    const stripe = await loadStripe(config.public.stripePk);
    
    elements.value = stripe.elements({
      clientSecret,
      appearance: {
        theme: 'night',
        variables: {
          colorPrimary: '#14b8a6',
          colorBackground: '#1a1a1a',
          colorText: '#ffffff',
          colorDanger: '#ef4444',
          fontFamily: 'system-ui, sans-serif',
          spacingUnit: '4px',
          borderRadius: '8px'
        }
      }
    });

    // Create and mount the Payment Element
    paymentElement.value = elements.value.create('payment');
    await nextTick();
    paymentElement.value.mount('#payment-element');
    console.log('Payment element mounted successfully');
  } catch (error) {
    console.error('Error initializing Stripe Elements:', error);
    throw error;
  }
};

const verify2FA = async () => {
  try {
    isLoading.value = true;
    errorMessage.value = '';

    // Get the phone number from the form
    const phone = form.value.phone;
    const code = form.value.code;

    console.log('Starting verification with form state:', {
      phone,
      code,
      form: form.value
    });

    // Make sure we have both phone and code
    if (!phone || !code) {
      console.error('Missing required fields:', {
        phone: phone || 'missing',
        code: code || 'missing'
      });
      errorMessage.value = 'Phone number and code are required';
      return;
    }

    console.log('Verifying with Twilio:', { phone, code });

    // Verify with Twilio
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone,
        code,
        action: 'verify'
      })
    });

    const data = await response.json();
    console.log('Twilio verification response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to verify code');
    }

    // If verification successful, show Cash App modal
    show2FA.value = false;
    showVerification.value = false;
    form.value.phone = '';
    form.value.code = '';
    
    // Show Cash App modal for the selected item
    selectedPurchaseItem.value = selectedItem.value;
    showCashAppModal.value = true;

  } catch (err) {
    console.error('Verification error:', err);
    errorMessage.value = err.message || 'Failed to verify code. Please try again.';
  } finally {
    isLoading.value = false;
  }
};

// Update sendVerification to store the phone number
const sendVerification = async () => {
  try {
    isLoading.value = true;
    errorMessage.value = '';

    const phone = form.value.phone.replace(/\D/g, '');
    const username = `+1${phone}`;

    console.log('Sending verification code to:', username);

    const response = await $fetch('/api/twilio/verify', {
      method: 'POST',
      body: {
        phone: username,
        action: 'send'
      }
    });

    if (response.success) {
      console.log('Verification code sent successfully');
      showVerification.value = true;
    } else {
      throw new Error(response.error || 'Failed to send verification code');
    }
  } catch (error) {
    console.error('Error sending verification code:', error);
    errorMessage.value = error.message || 'Failed to send verification code';
  } finally {
    isLoading.value = false;
  }
};

const handle2FASuccess = async () => {
  show2FA.value = false;
  if (selectedItem.value) {
    // Proceed with purchase after successful 2FA
    console.log('Proceeding with purchase:', selectedItem.value);
    // This will be implemented when we add Stripe integration
  }
};

// Add this computed property
const title = computed(() => `${decodeURIComponent(route.query.title || seriesName.value)}`);

// Get the poster URL directly from the route parameter
const posterUrlFromRoute = computed(() => {
  if (poster === 'default') {
    return 'https://d4idc5cmwxlpy.cloudfront.net/public/series-posters/dehyu.sinyan@gmail.com/DehCollective/DsinyanGivzey.jpeg';
  }
  return decodeURIComponent(poster);
});

// First useHead outside onMounted - use the poster URL directly from route
useHead({
  title: title.value,
  meta: [
    { property: "og:title", content: title.value },
    { property: "og:description", content: description.value },
    { property: "og:image", content: posterUrlFromRoute.value },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://twilly.app" },
    { property: "og:site_name", content: "Twilly" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:alt", content: title.value },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:site", content: "@Twilly" },
    { name: "twitter:title", content: title.value },
    { name: "twitter:description", content: description.value },
    { name: "twitter:image", content: posterUrlFromRoute.value },
    { name: "description", content: description.value },
    { name: "author", content: "Twilly" },
    { name: "theme-color", content: "#084d5d" }
  ],
});

onMounted(async () => {
  await fetchCreatorContent();
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

// Second useHead (at the bottom of the script)
const currentUrl = computed(() => window?.location?.href);

watch([menuTitle, posterUrlFromRoute], () => {
  const imageUrl = posterUrlFromRoute.value;

  useHead({
    title: menuTitle.value,
    meta: [
      // Essential Open Graph
      { property: "og:title", content: menuTitle.value },
      { property: "og:description", content: description.value },
      { property: "og:image", content: imageUrl },
      { property: "og:url", content: currentUrl.value },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Twilly" },

      // Image Specifics
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:alt", content: menuTitle.value },

      // Twitter Card
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Twilly" },
      { name: "twitter:title", content: menuTitle.value },
      { name: "twitter:description", content: description.value },
      { name: "twitter:image", content: imageUrl },

      // Basic SEO
      { name: "description", content: description.value },
      { name: "author", content: "Twilly" },
      { name: "theme-color", content: "#084d5d" }
    ],
    link: [
      { rel: 'canonical', href: currentUrl.value }
    ]
  });
});

// Add these functions to the script section
const showPdfViewer = ref(false);

const viewDoc = (doc) => {
  showPdfViewer.value = true;
};

const downloadDoc = (doc) => {
  const url = replaceS3WithCloudFront(doc.url);
  const link = document.createElement('a');
  link.href = url;
  link.download = doc.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Add a watch to reset the PDF viewer when the preview modal closes
watch(showPreview, (newVal) => {
  if (!newVal) {
    showPdfViewer.value = false;
  }
});

// Add this function in the script section
const playAudio = (audio) => {
  if (!audio.url) return;
  
  // Create modal for audio player
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black flex items-center justify-center z-50';
  
  // Create audio container with max width for mobile
  const audioContainer = document.createElement('div');
  audioContainer.className = 'relative w-full mx-4 sm:max-w-lg md:max-w-xl lg:max-w-2xl bg-black/90 p-6 rounded-xl border border-teal-500/30';
  
  // Create close button
  const closeButton = document.createElement('button');
  closeButton.className = 'absolute -top-10 right-0 text-white hover:text-teal-400 z-10';
  closeButton.innerHTML = '<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
  
  // Create audio element
  const audioElement = document.createElement('audio');
  audioElement.className = 'w-full';
  audioElement.controls = true;
  audioElement.crossOrigin = 'anonymous';
  
  // Create source element
  const source = document.createElement('source');
  source.src = audio.url;
  source.type = 'audio/mpeg';
  
  audioElement.appendChild(source);
  audioContainer.appendChild(closeButton);
  audioContainer.appendChild(audioElement);
  modal.appendChild(audioContainer);
  document.body.appendChild(modal);

  // Handle closing
  const cleanup = () => {
    audioElement.pause();
    document.body.removeChild(modal);
  };

  closeButton.onclick = cleanup;
  modal.onclick = (e) => {
    if (e.target === modal) cleanup();
  };
};

// Helper function to format phone number
const formatPhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
};

// Add this computed property to the script section
const getContentCount = (type) => {
  return menuItems.value.filter(item => item.category === type).length;
};

// Helper function to replace S3 URLs with CloudFront URLs
const replaceS3WithCloudFront = (url) => {
  if (!url) return '';
  
  if (url.includes("twilly.s3.us-east-1.amazonaws.com")) {
    return url.replace(
      "https://twilly.s3.us-east-1.amazonaws.com",
      "https://d1bb6cskvno4vp.cloudfront.net"
    );
  } else if (url.includes("twillyinputbucket.s3.us-east-1.amazonaws.com")) {
    return url.replace(
      "https://twillyinputbucket.s3.us-east-1.amazonaws.com", 
      "https://d2qxh65v2xrci1.cloudfront.net"
    );
  } else if (url.includes("tpccollections.s3.amazonaws.com")) {
    return url.replace(
      "https://tpccollections.s3.amazonaws.com", 
      "https://d26k8mraabzpiy.cloudfront.net"
    );
  } else if (url.includes("theprivatecollection.s3.us-east-2.amazonaws.com") || 
             url.includes("theprivatecollection.s3.amazonaws.com")) {
    return url.replace(
      /https:\/\/theprivatecollection\.s3(\.us-east-2)?\.amazonaws\.com/, 
      "https://d4idc5cmwxlpy.cloudfront.net"
    );
  }

  return url;
};

// Add keyboard event handler
const handleKeyDown = (event) => {
  if (event.key === 'Escape' && showPreview.value) {
    // First stop the video and reset its state
    if (player.value) {
      player.value.pause();
      player.value.currentTime(0);
      videoPlaying.value = false;
      
      // Clean up the player
      const videoElement = document.querySelector('.video-js');
      if (videoElement) {
        player.value.dispose();
        videoElement.innerHTML = ''; // Clear the video element
      }
      player.value = null;
    }
    
    // Then close the modal
    showPreview.value = false;
  }
};

// Payment functionality will be implemented with Stripe split payments later

// Watch for when the preview modal is shown and the preview item is a video
watch([showPreview, previewItem], async ([show, item]) => {
  if (show && item && item.category === 'Videos') {
    const videoSrc = replaceS3WithCloudFront(item.hlsUrl);

    await nextTick(); // Ensure the video element is in the DOM
    if (videoElement.value) {
      // If HLS is supported natively (Safari/iOS), just set the src
      if (videoElement.value.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.value.src = videoSrc;
      } else if (Hls.isSupported()) {
        // If not, use hls.js for Chrome/Android
        const hls = new Hls();
        hls.loadSource(videoSrc);
        hls.attachMedia(videoElement.value);
      } else {
        // Fallback: try to set src directly
        videoElement.value.src = videoSrc;
      }
    }
  }
});

// Update the watch function for route.query.verified
watch(() => route.query.verified, (newVal) => {
  if (newVal === 'true') {
    const purchaseItemId = route.query.purchaseItem;
    if (purchaseItemId) {
      const item = menuItems.value.find(item => item.id === purchaseItemId);
      if (item) {
        selectedPurchaseItem.value = item;
        showCashAppModal.value = true;
      } else {
        console.error('Item not found in menuItems:', purchaseItemId);
      }
    } else {
      console.log('No purchase item ID found in query params');
    }
  }
}, { immediate: true });

// Add this function in the script section
const confirmCashAppPayment = async () => {
  try {
    if (!selectedPurchaseItem.value) return;
    
    // Here you would typically make an API call to verify the payment
    // For now, we'll just show a success message and redirect
    showCashAppModal.value = false;
    
    // Redirect to the purchased content page
    await navigateTo('/dashboard');
  } catch (error) {
    console.error('Error confirming payment:', error);
    errorMessage.value = 'Error confirming payment. Please try again.';
  }
};

// Add cleanup on modal close
watch(showPaymentModal, (newVal) => {
  if (!newVal && paymentElement.value) {
    paymentElement.value.destroy();
    paymentElement.value = null;
    elements.value = null;
  }
});



// Add this function to the script section
const sendChatMessage = () => {
  if (chatMessage.value.trim()) {
    console.log('Sending chat message:', chatMessage.value);
    // Here you would typically send the message to your backend
    // For now, we'll just clear the input
    chatMessage.value = '';
  }
};

// Add this function to the script section
const toggleLike = () => {
  isLiked.value = !isLiked.value;
  likeCount.value += isLiked.value ? 1 : -1;
  console.log('Toggling like:', isLiked.value);
};

// Add this function to the script section
const shareChannel = () => {
  shareCount.value += 1;
  console.log('Sharing channel');
  // Here you would implement actual sharing functionality
  if (navigator.share) {
    navigator.share({
      title: 'Check out this Twilly channel!',
      text: 'Amazing collaborative streaming content',
      url: window.location.href
    });
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(window.location.href);
    console.log('URL copied to clipboard');
  }
};

// Add this function to the script section
const toggleSubscribe = () => {
  isSubscribed.value = !isSubscribed.value;
  subscriberCount.value += isSubscribed.value ? 1 : -1;
  console.log('Toggling subscribe:', isSubscribed.value);
};

// Add this function to the script section
const showComments = () => {
  console.log('Showing comments');
  // Here you would implement a comments modal or section
};

// Add this function to the script section
const joinLiveStream = () => {
  console.log('Joining live stream');
  // Here you would implement live stream functionality
  // This could open a new tab or modal with the live stream
};

// Add this function to the script section
const navigateToInvite = () => {
  console.log('Navigating to invite');
  // Navigate to the invite page for this channel
  const inviteUrl = `/invite/${series}`;
  window.open(inviteUrl, '_blank');
};

// WebSocket functions
// Watch for WebSocket connection changes (with debounce to prevent excessive logging)
let lastConnectionState = null;
watch(() => wsBrain?.isConnected, (connected) => {
  // Only log if the state actually changed
  if (lastConnectionState !== connected) {
    lastConnectionState = connected;
    if (connected) {
      console.log('✅ [Menu Share Poster] WebSocket connected');
    }
  }
}, { immediate: true });

// Watch for WebSocket data updates
watch(() => wsBrain?.liveStreams, (streams) => {
  if (streams && streams.length > 0) {
    liveViewerCount.value = streams.reduce((total, stream) => total + (stream.viewers || 0), 0);
  }
}, { deep: true });



// Initialize WebSocket connection for real-time content
onMounted(() => {
  if (process.client) {
    const { $switchToChannel } = useNuxtApp();
    
    // Switch to this channel using the plugin
    $switchToChannel(route.params.email);
  }
});
</script>

<style scoped>
.backdrop-blur-sm {
  backdrop-filter: blur(8px);
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Custom scrollbar for the preview modal */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
}

::-webkit-scrollbar-thumb {
  background: rgba(20, 184, 166, 0.5);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(20, 184, 166, 0.7);
}

/* Video container styles */
.video-container {
  position: relative;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16/9;
}

/* Video.js player styles */
.video-js {
  width: 100% !important;
  height: auto !important;
  background: #000 !important;
  min-height: 300px !important;
}

.video-js .vjs-tech {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
}

/* Ensure video displays properly */
.video-js.vjs-fluid {
  padding-top: 56.25% !important;
}

.video-js .vjs-poster {
  background-size: contain !important;
  background-position: center !important;
}

.video-js .vjs-big-play-button {
  display: none !important;
}

.video-js .vjs-big-play-button:hover {
  background-color: rgba(20, 184, 166, 1) !important;
  transform: translate(-50%, -50%) scale(1.1) !important;
}

.video-js .vjs-control-bar {
  display: none !important;
}

.video-js .vjs-play-progress {
  background-color: #14b8a6;
}

.video-js .vjs-slider {
  background-color: rgba(255, 255, 255, 0.2);
}

.video-js .vjs-volume-level {
  background-color: #14b8a6;
}

/* Hide all controls except fullscreen */
.video-js .vjs-play-progress,
.video-js .vjs-slider,
.video-js .vjs-current-time,
.video-js .vjs-duration,
.video-js .vjs-remaining-time,
.video-js .vjs-play-control,
.video-js .vjs-mute-control,
.video-js .vjs-volume-panel,
.video-js .vjs-progress-control,
.video-js .vjs-playback-rate,
.video-js .vjs-chapters-button,
.video-js .vjs-descriptions-button,
.video-js .vjs-subs-caps-button,
.video-js .vjs-audio-button,
.video-js .vjs-picture-in-picture-control {
  display: none !important;
}

/* Keep only fullscreen button visible */
.video-js .vjs-fullscreen-control {
  display: block !important;
}

/* Mobile responsive video */
@media (max-width: 768px) {
  .video-js {
    max-height: 50vh !important;
    width: 100% !important;
    height: auto !important;
  }
  
  .video-container {
    aspect-ratio: 16/9;
    max-height: 50vh;
  }
  
  /* Ensure video plays inline on mobile */
  .video-js video {
    object-fit: contain !important;
    width: 100% !important;
    height: 100% !important;
  }
  
  /* Mobile-specific video player container */
  .video-js.vjs-fluid {
    padding-top: 56.25% !important;
    position: relative !important;
  }
}

/* Video overlay styles */
.video-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1.5rem;
  background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, transparent 100%);
  z-index: 200;
  pointer-events: none;
}

.video-info {
  max-width: 90%;
  margin: 0 auto;
  position: relative;
  z-index: 101;
}

.video-title {
  color: white;
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.video-description {
  color: rgba(255,255,255,0.9);
  font-size: 0.875rem;
  line-height: 1.5;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

/* Desktop video player styles */
@media (min-width: 768px) {
  .video-container {
    margin-top: 2rem;
    max-height: calc(100vh - 200px);
    width: 90%;
  }

  .video-overlay {
    padding: 2rem;
  }

  .video-title {
    font-size: 1.75rem;
  }

  .video-description {
    font-size: 1rem;
  }

  :deep(.video-js) {
    width: 100%;
    height: 100%;
    padding-top: 0;
    position: relative;
    z-index: 1;
  }

  :deep(.video-js .vjs-tech) {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    z-index: 1;
  }

  :deep(.video-js .vjs-control-bar) {
    display: none !important;
  }
}

/* Prevent pull-down and ensure proper scrolling */
html, body {
  overscroll-behavior: none;
  overflow-x: hidden;
  position: fixed;
  width: 100%;
  height: 100%;
}

/* Allow scrolling within the main content area */
#__nuxt {
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Mobile-specific fixes for pull-down prevention */
@media (max-width: 767px) {
  html, body {
    position: fixed !important;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
    overscroll-behavior: none !important;
    -webkit-overflow-scrolling: auto !important;
    touch-action: none !important;
  }
  
  #__nuxt {
    height: 100vh !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    -webkit-overflow-scrolling: touch !important;
    position: relative !important;
  }
  
  /* Prevent iOS Safari bounce */
  body {
    -webkit-user-select: none !important;
    user-select: none !important;
    -webkit-touch-callout: none !important;
    -webkit-tap-highlight-color: transparent !important;
  }
}

/* Mobile-specific video player styles */
@media (max-width: 767px) {
  .video-container {
    margin-top: 0;
    aspect-ratio: 16/9;
    width: 100%;
    max-width: 100%;
    border-radius: 0;
    overflow: hidden;
    position: relative;
  }

  .video-overlay {
    padding: 1rem;
    background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 50%, transparent 100%);
    z-index: 100;
  }

  .video-title {
    font-size: 1.25rem;
    margin-bottom: 0.25rem;
  }

  .video-description {
    font-size: 0.875rem;
    line-height: 1.4;
  }

  /* Enhanced mobile video player */
  :deep(.video-js) {
    width: 100% !important;
    height: 100% !important;
    padding-top: 0 !important;
    position: relative !important;
    z-index: 1 !important;
    border-radius: 0 !important;
  }

  :deep(.video-js .vjs-tech) {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
    z-index: 1 !important;
  }

  /* Mobile-optimized control bar */
  :deep(.video-js .vjs-control-bar) {
    display: none !important;
  }

  /* Larger touch targets for mobile */
  :deep(.video-js .vjs-button) {
    width: 3em !important;
    height: 3em !important;
    border-radius: 50% !important;
    margin: 0 0.25em !important;
  }

  :deep(.video-js .vjs-play-control) {
    width: 3.5em !important;
    height: 3.5em !important;
    background: rgba(20, 184, 166, 0.8) !important;
    border-radius: 50% !important;
  }

  :deep(.video-js .vjs-play-control:hover) {
    background: rgba(20, 184, 166, 1) !important;
    transform: scale(1.1) !important;
  }

  /* Enhanced progress bar */
  :deep(.video-js .vjs-progress-control) {
    position: absolute !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    height: 0.75em !important;
    top: -0.75em !important;
  }

  :deep(.video-js .vjs-progress-holder) {
    height: 0.75em !important;
    background: rgba(255,255,255,0.3) !important;
    border-radius: 0.375em !important;
  }

  :deep(.video-js .vjs-play-progress) {
    background: linear-gradient(90deg, #14b8a6, #06b6d4) !important;
    border-radius: 0.375em !important;
  }

  /* Volume controls */
  :deep(.video-js .vjs-volume-panel) {
    width: 4em !important;
  }

  :deep(.video-js .vjs-volume-control) {
    width: 3em !important;
  }

  /* Time display */
  :deep(.video-js .vjs-time-control) {
    font-size: 1.1em !important;
    padding: 0 0.75em !important;
    font-weight: 600 !important;
  }

  /* Fullscreen button enhancement */
  :deep(.video-js .vjs-fullscreen-control) {
    background: rgba(255,255,255,0.1) !important;
    border-radius: 50% !important;
  }

  :deep(.video-js .vjs-fullscreen-control:hover) {
    background: rgba(255,255,255,0.2) !important;
  }

  /* Big play button enhancement */
  :deep(.video-js .vjs-big-play-button) {
    display: none !important;
  }

  :deep(.video-js .vjs-big-play-button:hover) {
    background: rgba(20, 184, 166, 1) !important;
    transform: translate(-50%, -50%) scale(1.1) !important;
  }

  /* Loading spinner */
  :deep(.video-js .vjs-loading-spinner) {
    border: 3px solid rgba(20, 184, 166, 0.3) !important;
    border-top-color: #14b8a6 !important;
    width: 3em !important;
    height: 3em !important;
  }

  :deep(.video-js .vjs-big-play-button) {
    display: none !important;
  }

  :deep(.video-js .vjs-big-play-button:hover) {
    background-color: rgba(20, 184, 166, 0.9) !important;
  }

  :deep(.video-js .vjs-control) {
    min-width: 2.5em !important;
  }

  :deep(.video-js .vjs-play-progress) {
    background-color: #14b8a6 !important;
  }

  :deep(.video-js .vjs-slider) {
    background-color: rgba(255, 255, 255, 0.2) !important;
  }

  :deep(.video-js .vjs-volume-level) {
    background-color: #14b8a6 !important;
  }

  /* Ensure controls are always visible and touch-friendly */
  :deep(.video-js .vjs-control-bar) {
    display: none !important;
  }

  :deep(.video-js .vjs-control) {
    cursor: pointer !important;
    -webkit-tap-highlight-color: transparent !important;
    touch-action: manipulation !important;
  }

  :deep(.video-js .vjs-progress-control) {
    touch-action: none !important;
  }
}

/* Preview modal styles */
.preview-modal {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

@media (min-width: 768px) {
  .preview-modal {
    padding: 4rem;
  }
}

.image-container {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.image-container img {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
}

/* Portrait video container styling */
.portrait-video-container {
  max-width: 400px !important;
  margin: 0 auto;
  aspect-ratio: 9/16;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.portrait-video-container img {
  object-fit: contain !important;
  background: #000;
}

/* Mobile portrait video optimization */
@media (max-width: 768px) {
  .portrait-video-container {
    max-width: 300px !important;
    aspect-ratio: 9/16;
  }
}

/* Desktop positioning */
@media (min-width: 768px) {
  .image-container {
    margin-top: 2rem;
  }
}

/* Mobile video player controls positioning */
@media (max-width: 640px) {
  .video-js {
    padding: 0 !important;
    padding-bottom: 0 !important;
    margin-bottom: 0 !important;
  }
  
  /* Hide the bottom control bar on mobile */
  .video-js .vjs-control-bar {
    display: none !important;
  }
  
  /* Make video element fully touchable */
  .mobile-touch-controls {
    cursor: pointer !important;
    touch-action: manipulation !important;
  }
  
  /* Ensure video element is touchable */
  .video-js.mobile-touch-controls {
    touch-action: manipulation !important;
    cursor: pointer !important;
  }
  
  .video-js.mobile-touch-controls video {
    touch-action: manipulation !important;
    cursor: pointer !important;
  }
  
  /* Keep the big play button for initial play */
  .video-js .vjs-big-play-button {
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    width: 4rem !important;
    height: 4rem !important;
    border-radius: 50% !important;
    background: rgba(0,0,0,0.7) !important;
    border: 2px solid rgba(255,255,255,0.8) !important;
  }
  
  .video-js .vjs-big-play-button:before {
    font-size: 1.5rem !important;
    line-height: 1 !important;
  }
  
  /* Fix for inline video player on mobile */
  .inline-video-player .video-js {
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
  }
  
  .inline-video-player .video-container {
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
  }
  
  .inline-video-player {
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
  }
  
  .inline-video-player .bg-gradient-to-br {
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
  }
  
  /* Ensure video player has proper bottom spacing for controls */
  .inline-video-player .relative.bg-black {
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
  }
  
  /* Add bottom margin to the entire inline video player container */
  .inline-video-player {
    margin-bottom: 1rem !important;
  }
  
  /* Ensure the video player container has enough space for controls */
  .inline-video-player .relative.bg-black.rounded-2xl {
    margin-bottom: 0.5rem !important;
    padding-bottom: 0 !important;
  }
  
  /* Make sure the video element itself doesn't clip the controls */
  .inline-video-player video {
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
  }
}
</style>