<template>
  <div class="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] pt-16 flex items-start justify-center">
    <div class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex justify-center items-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mb-4"></div>
          <p class="text-gray-400">Loading content management...</p>
        </div>
      </div>

      <!-- Content (only shown when loaded) -->
      <div v-else>
        <!-- Header Section -->
        <div class="mb-8">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-3xl sm:text-4xl font-bold text-white mb-2 bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Manage <span class="text-teal-400">Content</span>
              </h1>
              <p class="text-gray-300 text-sm sm:text-base font-medium">
                Organize and manage your content channels with precision
              </p>
            </div>
            <div class="hidden sm:block">
              <div class="w-16 h-16 bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/25">
                <Icon name="heroicons:square-3-stack-3d" class="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>
          


        <!-- Tab Navigation -->
        <div class="mb-8">
          <div class="flex flex-wrap justify-center gap-3 bg-gradient-to-r from-white/5 via-white/10 to-white/5 backdrop-blur-sm rounded-2xl border border-white/20 p-3 shadow-lg">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              class="px-6 py-3 rounded-xl transition-all duration-300 flex items-center gap-2 font-medium"
              :class="[
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-teal-500/30 to-cyan-500/30 text-teal-200 border border-teal-400/50 shadow-lg shadow-teal-500/20'
                  : 'text-gray-300 hover:text-white hover:bg-white/15 hover:shadow-md'
              ]"
            >
              <Icon :name="tab.icon" class="w-5 h-5" />
              {{ tab.name }}
            </button>
          </div>
        </div>

        <!-- Tab Content -->
        <div class="space-y-6">


          <!-- Episodes Tab -->
          <div v-if="activeTab === 'files'" class="space-y-6">
            
            <!-- Series/Folder Selection -->
            <div class="bg-gradient-to-br from-white/5 via-white/10 to-white/5 backdrop-blur-sm border border-white/20 rounded-2xl p-6 sm:p-8 shadow-xl">
              <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Icon name="heroicons:folder" class="w-5 h-5 text-teal-400" />
                Select Channel
              </h3>
              
              <!-- Folder Row -->
              <div class="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3 mb-4">
                <!-- Select Channel Dropdown -->
                <div class="flex-1 min-w-0">
                  <select
                    v-model="selectedfolderName"
                    class="w-full rounded-xl border border-teal-500/30 bg-black/20 p-3 text-white outline-teal-500 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-400 transition-all duration-300"
                    @change="handleFolderChange"
                  >
                    <option value="default">Default Channel</option>
                    <option value="thumbnails">Thumbnails</option>
                    <option v-for="folder in fileStore.folders" :key="folder.SK" :value="folder.name">
                      {{ folder.name }}
                    </option>
                  </select>
                  

                </div>

                <!-- Action Buttons -->
                <div class="flex items-center gap-2 sm:flex-shrink-0">
                  <!-- Create Channel Button -->
                  <button
                    @click="showNewFolderModal = true"
                    class="px-3 py-2 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-300 border border-teal-500/30 rounded-xl hover:from-teal-500/30 hover:to-cyan-500/30 flex items-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg"
                    title="Create New Channel"
                  >
                    <Icon name="heroicons:plus" class="w-5 h-5" />
                    <span class="hidden sm:inline">Create Channel</span>
                  </button>

                  <!-- Delete Button -->
                  <button
                    v-if="selectedfolderName !== 'default' && selectedfolderName !== 'thumbnails'"
                    @click="deleteSelectedFolder"
                    class="px-3 py-2 bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-300 border border-red-500/30 rounded-xl hover:from-red-500/30 hover:to-pink-500/30 flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg"
                    title="Delete Folder"
                  >
                    <Icon name="heroicons:trash" class="w-5 h-5" />
                  </button>

                  <!-- Refresh Channel Button -->
                  <button
                    @click="refreshChannel"
                    :disabled="isRefreshingChannel"
                    class="px-3 py-2 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-300 border border-teal-500/30 rounded-xl hover:from-teal-500/30 hover:to-cyan-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-lg"
                    title="Refresh Channel"
                  >
                    <Icon v-if="isRefreshingChannel" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
                    <Icon v-else name="heroicons:arrow-path" class="w-5 h-5" />
                    <span v-if="!isRefreshingChannel" class="hidden sm:inline">Refresh</span>
                  </button>
                  
                  <!-- Debug Refresh Button -->
                  <button
                    @click="debugRefresh"
                    class="px-3 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30 rounded-xl hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 shadow-md hover:shadow-lg"
                    title="Debug Refresh"
                  >
                    <Icon name="heroicons:bug-ant" class="w-5 h-5" />
                    <span class="hidden sm:inline">Debug</span>
                  </button>
                  
                  <!-- Username Debug Button -->
                  <button
                    @click="debugUsername"
                    class="px-3 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border border-blue-500/30 rounded-xl hover:from-blue-500/30 hover:to-cyan-500/30 transition-all duration-300 shadow-md hover:shadow-lg"
                    title="Debug Username"
                  >
                    <Icon name="heroicons:user" class="w-5 h-5" />
                    <span class="hidden sm:inline">Username</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Channel Poster Section (Moved before File Management) -->
            <div v-if="selectedfolderName !== 'default' && selectedfolderName !== 'thumbnails' && user?.attributes?.email"
                 class="bg-gradient-to-br from-purple-500/5 via-purple-500/10 to-purple-500/5 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-6 sm:p-8 relative z-20 shadow-xl">
              <div class="flex items-center mb-6">
                <div class="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mr-4">
                  <Icon name="heroicons:photo" class="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 class="text-xl font-semibold text-white">Channel Poster</h3>
                  <p class="text-gray-400 text-sm">Customize your channel's visual identity</p>
                </div>
              </div>
              
              <!-- Channel Poster Content -->
              <div class="space-y-4">
                <!-- Current Poster Preview -->
                <div class="bg-black/20 rounded-lg p-4 border border-white/10">
                  <div class="flex items-center justify-between mb-3">
                    <span class="text-gray-300 font-medium">Current Poster:</span>
                    <span class="text-xs text-gray-400">Click to change</span>
                  </div>
                  
                  <!-- Poster Preview -->
                  <div class="flex justify-center mb-4">
                    <div class="relative w-full max-w-md">
                      <div class="aspect-video bg-black/40 rounded-lg overflow-hidden border border-white/10">
                        <img
                          :src="getCurrentChannelPosterUrl()"
                          :alt="`${selectedfolderName} Channel Poster`"
                          class="w-full h-full object-cover"
                          @error="handlePosterError"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <!-- Change Poster Button -->
                  <div class="flex justify-center">
                    <ChangeFolderPreview
                      :folder="selectedfolderName"
                      :email="user.attributes.email"
                      :category="'Mixed'"
                      @updated="handlePosterUpdate"
                      @modalOpen="hideFileManagement = true"
                      @modalClose="hideFileManagement = false"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Subscription Price Management Section -->
            <div class="mt-6">
            <div v-if="selectedfolderName !== 'default' && selectedfolderName !== 'thumbnails' && user?.attributes?.email"
                 class="bg-gradient-to-br from-green-500/5 via-green-500/10 to-green-500/5 backdrop-blur-sm border border-green-500/20 rounded-2xl p-6 sm:p-8 relative z-10 shadow-xl">
              <div class="flex items-center mb-6">
                <div class="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mr-4">
                  <Icon name="heroicons:currency-dollar" class="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 class="text-xl font-semibold text-white">Subscription Pricing</h3>
                  <p class="text-gray-400 text-sm">Set your channel's monthly subscription price</p>
                </div>
              </div>
              
              <div class="space-y-4">
                <!-- Current Price Display -->
                <div class="bg-black/20 rounded-lg p-4 border border-white/10">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-gray-300 font-medium">Current Price:</span>
                    <span class="text-white font-bold text-lg">${{ channelSubscriptionPrice }}/month</span>
                  </div>
                  <p class="text-gray-400 text-xs">This is what subscribers will pay monthly</p>
                </div>

                <!-- Price Update Form -->
                <div class="space-y-3">
                  <label class="block text-gray-300 font-medium">New Monthly Price ($)</label>
                  <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                      v-model="newSubscriptionPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      class="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-green-500 focus:outline-none transition-all duration-300"
                      placeholder="9.99"
                    />
                    <button
                      @click="updateSubscriptionPrice"
                      :disabled="isUpdatingPrice || !newSubscriptionPrice || parseFloat(newSubscriptionPrice) === channelSubscriptionPrice"
                      class="px-4 sm:px-6 py-3 bg-gradient-to-r from-green-500/20 to-green-600/20 text-green-300 border border-green-500/30 rounded-lg hover:from-green-500/30 hover:to-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Icon v-if="isUpdatingPrice" name="heroicons:arrow-path" class="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      <Icon v-else name="heroicons:check" class="w-4 h-4 sm:w-5 sm:h-5" />
                      <span v-if="!isUpdatingPrice" class="text-sm sm:text-base">Update Price</span>
                      <span v-else class="text-sm sm:text-base">Updating...</span>
                    </button>
                  </div>
                  <p class="text-gray-400 text-xs">Revenue split: 65% Producer / 20% Collaborators / 15% Platform</p>
                </div>
              </div>
            </div>
            </div>

            <!-- Channel Invite Code Generation Section -->
            <div v-if="selectedfolderName !== 'default' && selectedfolderName !== 'thumbnails' && user?.attributes?.email" class="mt-6">
              <div class="bg-gradient-to-br from-teal-500/5 via-cyan-500/10 to-blue-500/5 backdrop-blur-sm border border-teal-500/20 rounded-2xl p-6 sm:p-8 relative z-10 shadow-xl">
                <div class="flex items-center mb-6">
                  <div class="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center mr-4">
                    <Icon name="heroicons:ticket" class="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <h3 class="text-xl font-semibold text-white">Channel Invite Codes</h3>
                    <p class="text-gray-400 text-sm">Generate invite codes to allow users to stream to {{ selectedfolderName }}</p>
                  </div>
                </div>
                
                <div class="space-y-4">
                  <!-- Current Invite Code Display -->
                  <div v-if="channelInviteCodes[selectedfolderName]" class="bg-black/20 rounded-lg p-4 border border-white/10">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-gray-300 font-medium">Active Invite Code:</span>
                      <button
                        @click="copyChannelInviteCode(selectedfolderName)"
                        class="px-3 py-1.5 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300 text-sm flex items-center gap-2"
                      >
                        <Icon name="heroicons:clipboard-document" class="w-4 h-4" />
                        Copy
                      </button>
                    </div>
                    <div class="bg-black/40 rounded-lg p-3 border border-teal-500/30">
                      <code class="text-teal-300 font-mono text-lg break-all">{{ channelInviteCodes[selectedfolderName] }}</code>
                    </div>
                    <p class="text-gray-400 text-xs mt-2">Share this code with users to grant them streaming access to {{ selectedfolderName }}</p>
                    <p class="text-yellow-400 text-xs mt-1">⚠️ Generating a new code will expire this one</p>
                  </div>

                  <!-- Success/Error Messages -->
                  <div v-if="inviteSuccessMessage" class="bg-green-500/20 border border-green-500/30 rounded-lg p-3 mt-4">
                    <p class="text-green-300 text-sm">{{ inviteSuccessMessage }}</p>
                  </div>

                  <!-- Generate Invite Code Button -->
                  <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      @click="generateChannelInviteCode(selectedfolderName)"
                      :disabled="isGeneratingChannelInvite || !selectedfolderName || selectedfolderName === 'default' || selectedfolderName === 'thumbnails'"
                      class="px-6 py-3 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:from-teal-500/30 hover:to-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      <Icon v-if="isGeneratingChannelInvite" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
                      <Icon v-else name="heroicons:plus-circle" class="w-5 h-5" />
                      <span>{{ isGeneratingChannelInvite ? 'Generating...' : channelInviteCodes[selectedfolderName] ? 'Generate New Code' : 'Generate Invite Code' }}</span>
                    </button>
                    <p class="text-gray-400 text-xs sm:ml-2">Users with this code can stream to {{ selectedfolderName }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Channel Visibility Management Section -->
            <div class="mt-6">
            <div v-if="selectedfolderName !== 'default' && selectedfolderName !== 'thumbnails' && user?.attributes?.email"
                 class="bg-gradient-to-br from-blue-500/5 via-blue-500/10 to-blue-500/5 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6 sm:p-8 relative z-10 shadow-xl">
              <div class="flex items-center mb-6">
                <div class="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mr-4">
                  <Icon name="heroicons:eye" class="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 class="text-xl font-semibold text-white">Channel Visibility</h3>
                  <p class="text-gray-400 text-sm">Control who can discover and subscribe to your channel</p>
                </div>
              </div>
              
              <div class="space-y-4">
                <!-- Current Visibility Status -->
                <div class="bg-black/20 rounded-lg p-4 border border-white/10">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-gray-300 font-medium">Current Status:</span>
                    <span class="flex items-center gap-2">
                      <Icon 
                        :name="channelVisibility === 'public' ? 'heroicons:eye' : channelVisibility === 'searchable' ? 'heroicons:magnifying-glass' : 'heroicons:eye-slash'" 
                        class="w-5 h-5"
                        :class="channelVisibility === 'public' ? 'text-green-400' : channelVisibility === 'searchable' ? 'text-yellow-400' : 'text-gray-400'"
                      />
                      <span 
                        class="font-bold text-lg"
                        :class="channelVisibility === 'public' ? 'text-green-400' : channelVisibility === 'searchable' ? 'text-yellow-400' : 'text-gray-400'"
                      >
                        {{ channelVisibility === 'public' ? 'Public' : channelVisibility === 'searchable' ? 'Searchable' : 'Private' }}
                      </span>
                    </span>
                  </div>
                  <p class="text-gray-400 text-xs">
                    {{ channelVisibility === 'public' ? 'Channel appears in Explore Channels and can be subscribed to directly by viewers' : channelVisibility === 'searchable' ? 'Channel is private but can be found via search and accessed via direct link' : 'Channel is completely private and requires direct share links for access' }}
                  </p>
                </div>

                <!-- Visibility Options -->
                <div class="space-y-3">
                  <label class="block text-gray-300 font-medium">Channel Visibility</label>
                  
                  <!-- Public Option -->
                  <div 
                    @click="setChannelVisibility('public')"
                    :disabled="isUpdatingVisibility"
                    class="flex items-center justify-between p-4 bg-black/20 rounded-lg border border-white/10 cursor-pointer transition-all hover:bg-black/30"
                    :class="channelVisibility === 'public' ? 'border-green-500/50 bg-green-500/10' : ''"
                  >
                    <div class="flex items-center gap-3">
                      <Icon name="heroicons:globe-alt" class="w-5 h-5 text-green-400" />
                      <div>
                        <p class="text-white font-medium">Public</p>
                        <p class="text-gray-400 text-sm">Appears in channel guide and can be subscribed to directly</p>
                      </div>
                    </div>
                    <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                      :class="channelVisibility === 'public' ? 'border-green-400 bg-green-400' : 'border-gray-500'"
                    >
                      <Icon v-if="channelVisibility === 'public'" name="heroicons:check" class="w-3 h-3 text-white" />
                    </div>
                  </div>

                  <!-- Searchable Option -->
                  <div 
                    @click="setChannelVisibility('searchable')"
                    :disabled="isUpdatingVisibility"
                    class="flex items-center justify-between p-4 bg-black/20 rounded-lg border border-white/10 cursor-pointer transition-all hover:bg-black/30"
                    :class="channelVisibility === 'searchable' ? 'border-yellow-500/50 bg-yellow-500/10' : ''"
                  >
                    <div class="flex items-center gap-3">
                      <Icon name="heroicons:magnifying-glass" class="w-5 h-5 text-yellow-400" />
                      <div>
                        <p class="text-white font-medium">Searchable</p>
                        <p class="text-gray-400 text-sm">Private but can be found via search and accessed via direct link (like OnlyFans)</p>
                      </div>
                    </div>
                    <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                      :class="channelVisibility === 'searchable' ? 'border-yellow-400 bg-yellow-400' : 'border-gray-500'"
                    >
                      <Icon v-if="channelVisibility === 'searchable'" name="heroicons:check" class="w-3 h-3 text-white" />
                    </div>
                  </div>

                  <!-- Private Option -->
                  <div 
                    @click="setChannelVisibility('private')"
                    :disabled="isUpdatingVisibility"
                    class="flex items-center justify-between p-4 bg-black/20 rounded-lg border border-white/10 cursor-pointer transition-all hover:bg-black/30"
                    :class="channelVisibility === 'private' ? 'border-gray-500/50 bg-gray-500/10' : ''"
                  >
                    <div class="flex items-center gap-3">
                      <Icon name="heroicons:lock-closed" class="w-5 h-5 text-gray-400" />
                      <div>
                        <p class="text-white font-medium">Private</p>
                        <p class="text-gray-400 text-sm">Completely private - only accessible via direct share links</p>
                      </div>
                    </div>
                    <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                      :class="channelVisibility === 'private' ? 'border-gray-400 bg-gray-400' : 'border-gray-500'"
                    >
                      <Icon v-if="channelVisibility === 'private'" name="heroicons:check" class="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>

            <!-- Channel Description Management Section -->
            <div v-if="selectedfolderName !== 'default' && selectedfolderName !== 'thumbnails' && user?.attributes?.email"
                 class="bg-gradient-to-br from-blue-500/5 via-blue-500/10 to-blue-500/5 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6 sm:p-8 relative z-10 shadow-xl mt-6">
              <div class="flex items-center mb-6">
                <div class="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mr-4">
                  <Icon name="heroicons:chat-bubble-left-right" class="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 class="text-xl font-semibold text-white">Channel Description</h3>
                  <p class="text-gray-400 text-sm">Customize your channel's "About this channel" section</p>
                </div>
              </div>
              
              <div class="space-y-4">
                <!-- Current Description Display -->
                <div class="bg-black/20 rounded-lg p-4 border border-white/10">
                  <div class="mb-2">
                    <span class="text-gray-300 font-medium">Current Description:</span>
                  </div>
                  <p class="text-white text-sm">{{ channelDescription || 'Check out this series from ' + (currentUsername || 'this creator') }}</p>
                </div>

                <!-- Description Update Form -->
                <div class="space-y-3">
                  <label class="block text-gray-300 font-medium">New Channel Description</label>
                  <textarea
                    v-model="newChannelDescription"
                    class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-all duration-300 min-h-[100px] resize-none"
                    placeholder="Describe what your channel is about, what viewers can expect, and any other relevant information..."
                  ></textarea>
                  <div class="flex justify-between items-center">
                    <p class="text-gray-400 text-xs">This description will appear on your channel page and in social media previews</p>
                    <button
                      @click="updateChannelDescription"
                      :disabled="isUpdatingDescription || !newChannelDescription || newChannelDescription === channelDescription"
                      class="px-4 sm:px-6 py-3 bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg hover:from-blue-500/30 hover:to-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Icon v-if="isUpdatingDescription" name="heroicons:arrow-path" class="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      <Icon v-else name="heroicons:check" class="w-4 w-4 sm:w-5 sm:h-5" />
                      <span v-if="!isUpdatingDescription" class="text-sm sm:text-base">Update Description</span>
                      <span v-else class="text-sm sm:text-base">Updating...</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Episode Management Controls -->
            <div v-if="!hideFileManagement" class="bg-gradient-to-br from-white/5 via-white/10 to-white/5 backdrop-blur-sm border border-white/20 rounded-2xl p-6 sm:p-8 relative z-10 shadow-xl mt-6">
              <div class="flex items-center mb-6">
                <div class="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center mr-4">
                  <Icon name="heroicons:square-2-stack" class="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h3 class="text-xl font-semibold text-white">Episode Management</h3>
                  <p class="text-gray-400 text-sm">Organize and manage your content episodes</p>
                </div>
              </div>
              
              <!-- Add Selection Mode Toggle and Bulk Delete buttons -->
              <div class="flex justify-center gap-4 mb-4">
                <button
                  v-if="filteredFiles.length > 0"
                  @click="toggleSelectionMode"
                  class="inline-flex items-center gap-2 px-6 py-2.5 text-sm bg-teal-500/20 text-teal-300 
                         border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300
                         min-w-[140px] justify-center"
                  :class="[
                    isSelectionMode
                      ? 'bg-red-500/20 text-red-300 border-red-500/30'
                      : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                  ]"
                >
                  <Icon 
                    :name="isSelectionMode ? 'heroicons:x-mark' : 'heroicons:square-2-stack'" 
                    class="w-5 h-5" 
                  />
                  <span v-if="isSelectionMode">Cancel Selection</span>
                  <span v-else>Select Multiple</span>
                </button>
                
                <!-- Add Select All toggle -->
                <button
                  v-if="isSelectionMode && filteredFiles.length > 0"
                  @click="toggleSelectAll"
                  class="px-6 py-2 rounded-lg transition-all duration-300"
                  :class="[
                    isAllSelected
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                  ]"
                >
                  {{ isAllSelected ? 'Deselect All' : 'Select All' }}
                </button>
                
                <button
                  v-if="isSelectionMode && selectedFiles.size > 0"
                  @click="deleteSelectedFiles"
                  class="px-6 py-2 rounded-lg transition-all duration-300 flex items-center gap-2"
                  :class="[
                    isBulkDeleting
                      ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30 cursor-not-allowed'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
                  ]"
                  :disabled="isBulkDeleting"
                >
                  <Icon 
                    v-if="isBulkDeleting" 
                    name="heroicons:arrow-path" 
                    class="w-4 h-4 animate-spin" 
                  />
                  <Icon 
                    v-else 
                    name="heroicons:trash" 
                    class="w-4 h-4" 
                  />
                  {{ isBulkDeleting 
                    ? `Deleting... (${deleteProgress.current}/${deleteProgress.total})` 
                    : `Delete Selected (${selectedFiles.size})` 
                  }}
                </button>
              </div>

              <!-- File move dropdown and button -->
              <div v-if="selectedFiles.size > 0" class="flex justify-center">
                <div class="bg-black/20 rounded-lg border border-teal-500/30 p-2 flex items-center gap-2">
                  <select 
                    v-model="targetFolder"
                    class="bg-black/20 border border-teal-500/30 rounded-lg p-2 text-white outline-none
                           focus:border-teal-500 transition-all duration-300 text-sm md:text-base"

                  >
                    <option value="">Move to folder...</option>
                    <option value="default">Default Folder</option>
                    <option v-for="folder in fileStore.folders" :key="folder.SK" :value="folder.name">
                      {{ folder.name }}
                    </option>
                  </select>
                  <button
                    v-if="targetFolder"
                    @click="moveSelectedFiles"
                    :disabled="isMovingFiles"
                    class="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/20 text-teal-300 
                           border border-teal-500/30 rounded-lg hover:bg-teal-500/30 
                           transition-all duration-300 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon 
                      v-if="isMovingFiles" 
                      name="heroicons:arrow-path" 
                      class="w-4 h-4 animate-spin" 
                    />
                    <Icon 
                      v-else 
                      name="heroicons:arrow-right-circle" 
                      class="w-5 h-5" 
                    />
                    {{ isMovingFiles 
                      ? `Moving... (${moveProgress.current}/${moveProgress.total})` 
                      : `Move Selected (${selectedFiles.size})` 
                    }}
                  </button>
                </div>
              </div>
            </div>

            <!-- File Grid -->
            <div class="bg-gradient-to-br from-black/30 via-black/40 to-black/30 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-6 shadow-2xl">
              <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Icon name="heroicons:document" class="w-5 h-5 text-teal-400" />
                Episodes in "{{ selectedfolderName }}"
              </h3>
              
              <!-- Content Display -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div v-for="file in filteredFiles" :key="file.SK" 
                  class="bg-gradient-to-br from-black/30 via-black/40 to-black/30 backdrop-blur-sm rounded-2xl border border-teal-900/30 overflow-hidden group relative cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                  :class="{ 
                    'ring-2 ring-teal-500 shadow-lg shadow-teal-500/30': selectedFiles.has(file.SK),
                    'border-teal-500': selectedFiles.has(file.SK)
                  }"
                  :data-video-file="file.SK"
                  @click.stop="handleFileClick(file.SK)"
                >
                  <!-- Selection checkbox -->
                  <div v-if="isSelectionMode" 
                    class="absolute top-4 right-4 z-10"
                    @click.stop="toggleFileSelection(file.SK)"
                  >
                    <div class="w-6 h-6 rounded border-2 border-white flex items-center justify-center"
                      :class="{ 'bg-teal-500 border-teal-500': selectedFiles.has(file.SK) }"
                    >
                      <Icon v-if="selectedFiles.has(file.SK)" 
                        name="heroicons:check" 
                        class="w-4 h-4 text-white" 
                      />
                    </div>
                  </div>

                  <!-- File type badge -->
                  <div class="absolute top-4 left-4 z-10">
                    <span class="px-2 py-1 text-xs rounded-full"
                      :class="{
                        'bg-blue-500/20 text-blue-300 border border-blue-500/30': file.category === 'Videos',
                        'bg-green-500/20 text-green-300 border border-green-500/30': file.category === 'Images',
                        'bg-purple-500/20 text-purple-300 border border-purple-500/30': file.category === 'Audios',
                        'bg-orange-500/20 text-orange-300 border border-orange-500/30': file.category === 'Docs'
                      }"
                    >
                      {{ file.category }}
                    </span>
                  </div>

                  <!-- Visibility badge -->
                  <div class="absolute top-4 left-20 z-10">
                    <span class="px-2 py-1 text-xs rounded-full flex items-center gap-1"
                      :class="{
                        'bg-green-500/20 text-green-300 border border-green-500/30': file.isVisible === true,
                        'bg-red-500/20 text-red-300 border border-red-500/30': file.isVisible !== true
                      }"
                    >
                      <Icon 
                        :name="file.isVisible === true ? 'heroicons:eye' : 'heroicons:eye-slash'" 
                        class="w-3 h-3" 
                      />
                      {{ file.isVisible === true ? 'Live' : 'Draft' }}
                    </span>
                  </div>
                  
                  <!-- Airdate badge -->
                  <div v-if="file.airdate && !file.isVisible" class="absolute top-4 left-32 z-10">
                    <span class="px-2 py-1 text-xs rounded-full flex items-center gap-1 bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      <Icon name="heroicons:clock" class="w-3 h-3" />
                      {{ new Date(file.airdate).toLocaleDateString() }}
                    </span>
                  </div>

                  <!-- Price badge -->
                  <div v-if="file.price && file.price > 0" class="absolute top-4 right-4 z-10">
                    <span class="px-2 py-1 text-xs rounded-full flex items-center gap-1 bg-green-500/20 text-green-300 border border-green-500/30">
                      <Icon name="heroicons:currency-dollar" class="w-3 h-3" />
                      ${{ file.price.toFixed(2) }}
                    </span>
                  </div>

                  <!-- File preview -->
                  <div class="relative h-[300px]">
                    <!-- Video preview -->
                    <template v-if="file.category === 'Videos'">
                      <img
                        :src="getVideoThumbnail(file)"
                        :alt="file.fileName"
                        class="w-full h-full object-contain bg-black"
                        @error="handleThumbnailError"
                        @load="() => {}"
                      />
                      <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent">
                        <h3 class="absolute bottom-0 left-0 right-0 p-4 text-white text-sm font-medium truncate">
                          {{ file.title || file.fileName }}
                        </h3>
                      </div>
                      <div class="absolute bottom-4 right-4 flex gap-2">
                        <button
                          v-if="!isSelectionMode"
                          @click.stop="toggleVisibility(file)"
                          class="p-2 rounded-full transition-colors duration-300"
                          :class="[
                            file.isVisible === true 
                              ? 'bg-green-500/80 hover:bg-green-600' 
                              : 'bg-red-500/80 hover:bg-red-600'
                          ]"
                          :title="file.isVisible === true ? 'Make Draft' : 'Go Live'"
                        >
                          <Icon 
                            :name="file.isVisible === true ? 'heroicons:eye' : 'heroicons:eye-slash'" 
                            class="w-5 h-5 text-white" 
                          />
                        </button>
                        <button
                          v-if="!isSelectionMode"
                          @click.stop="playVideo(file)"
                          class="p-2 bg-teal-500/80 hover:bg-teal-600 rounded-full transition-colors duration-300"
                          title="Play Video"
                          :disabled="!file.hlsUrl || file.status === 'PROCESSING'"
                        >
                          <Icon 
                            :name="file.status === 'PROCESSING' ? 'heroicons:clock' : 'heroicons:play'" 
                            class="w-5 h-5 text-white" 
                          />
                        </button>
                                    <button
              v-if="!isSelectionMode && file.hlsUrl && (file.fileName?.toLowerCase().endsWith('.m3u8') || file.hlsUrl.includes('cloudfront.net'))"
              @click.stop="downloadVideoAsMp4(file)"
              class="p-2 bg-blue-500/80 hover:bg-blue-600 rounded-full transition-colors duration-300"
              title="Download Video"
              :disabled="downloadingFileIds[file.SK]"
            >
              <Icon 
                :name="downloadingFileIds[file.SK] ? 'heroicons:arrow-path' : 'heroicons:arrow-down-tray'" 
                class="w-5 h-5 text-white" 
                :class="{ 'animate-spin': downloadingFileIds[file.SK] }"
              />
            </button>
            

                        <button
                          v-if="!isSelectionMode"
                          @click.stop="editItem(file)"
                          class="p-2 bg-teal-500/80 hover:bg-teal-600 rounded-full transition-colors duration-300"
                          title="Edit Details"
                        >
                          <Icon name="heroicons:pencil-square" class="w-5 h-5 text-white" />
                        </button>
                        <button
                          v-if="!isSelectionMode && file.isVisible === true && file.price > 0"
                          @click.stop="createLemonSqueezyProduct(file)"
                          class="p-2 bg-purple-500/80 hover:bg-purple-600 rounded-full transition-colors duration-300"
                          title="Create Product for Sale"
                        >
                          <Icon name="heroicons:currency-dollar" class="w-5 h-5 text-white" />
                        </button>
                        <button
                          v-if="!isSelectionMode"
                          @click.stop="deleteFile(file)"
                          class="p-2 bg-red-500/80 hover:bg-red-600 rounded-full transition-colors duration-300"
                          title="Delete File"
                        >
                          <Icon name="heroicons:trash" class="w-5 h-5 text-white" />
                        </button>
                        
                        <!-- Airdate Picker -->
                                        <button
                  v-if="!isSelectionMode && !file.isVisible"
                  @click.stop="showAirdatePicker(file)"
                  class="p-2 rounded-full transition-colors duration-300"
                  :class="file.airdate && isAirdateInFuture(file.airdate) ? 'bg-orange-500/80 hover:bg-orange-600' : 'bg-blue-500/80 hover:bg-blue-600'"
                  :title="file.airdate ? 'Edit Airdate' : 'Schedule Airdate'"
                >
                  <Icon 
                    :name="file.airdate && isAirdateInFuture(file.airdate) ? 'heroicons:clock' : 'heroicons:calendar'" 
                    class="w-5 h-5 text-white" 
                  />
                </button>
                      </div>
                    </template>

                    <!-- Image preview -->
                    <template v-else-if="file.category === 'Images'">
                      <img
                        :src="getImageUrl(file)"
                        :alt="file.fileName"
                        class="w-full h-full object-contain"
                        @error="handleImageError"
                        loading="lazy"
                      />
                      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                        <h3 class="absolute bottom-0 left-0 right-0 p-4 text-white text-sm font-medium truncate">
                          {{ file.title || file.fileName }}
                        </h3>
                      </div>
                      <!-- Price badge for images -->
                      <div v-if="file.price && file.price > 0" class="absolute top-4 right-4 z-10">
                        <span class="px-2 py-1 text-xs rounded-full flex items-center gap-1 bg-green-500/20 text-green-300 border border-green-500/30">
                          <Icon name="heroicons:currency-dollar" class="w-3 h-3" />
                          ${{ file.price.toFixed(2) }}
                        </span>
                      </div>
                      <div class="absolute bottom-4 right-4 flex gap-2">
                        <button
                          v-if="!isSelectionMode"
                          @click.stop="toggleVisibility(file)"
                          class="p-2 rounded-full transition-colors duration-300"
                          :class="[
                            file.isVisible !== false 
                              ? 'bg-green-500/80 hover:bg-green-600' 
                              : 'bg-red-500/80 hover:bg-red-600'
                          ]"
                          :title="file.isVisible !== false ? 'Hide from series page' : 'Show on series page'"
                        >
                          <Icon 
                            :name="file.isVisible !== false ? 'heroicons:eye' : 'heroicons:eye-slash'" 
                            class="w-5 h-5 text-white" 
                          />
                        </button>
                        <button
                          @click="() => window.open(getImageUrl(file), '_blank')"
                          class="p-2 bg-teal-500/80 hover:bg-teal-600 rounded-full transition-colors duration-300"
                          title="View Full Size"
                        >
                          <Icon name="heroicons:arrow-top-right-on-square" class="w-5 h-5 text-white" />
                        </button>
                        <button
                          v-if="!isSelectionMode"
                          @click.stop="editItem(file)"
                          class="p-2 bg-teal-500/80 hover:bg-teal-600 rounded-full transition-colors duration-300"
                          title="Edit Details"
                        >
                          <Icon name="heroicons:pencil-square" class="w-5 h-5 text-white" />
                        </button>
                        <button
                          v-if="!isSelectionMode"
                          @click.stop="deleteFile(file)"
                          class="p-2 bg-red-500/80 hover:bg-red-600 rounded-full transition-colors duration-300"
                          title="Delete File"
                        >
                          <Icon name="heroicons:trash" class="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </template>

                    <!-- Audio preview -->
                    <template v-else-if="file.category === 'Audios'">
                      <img
                        :src="defaultAudioPreviewUrl"
                        :alt="file.fileName"
                        class="w-full h-full object-contain"
                      />
                      <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent">
                        <h3 class="absolute bottom-0 left-0 right-0 p-4 text-white text-sm font-medium truncate">
                          {{ file.title || file.fileName }}
                        </h3>
                      </div>
                      <!-- Price badge for audio -->
                      <div v-if="file.price && file.price > 0" class="absolute top-4 right-4 z-10">
                        <span class="px-2 py-1 text-xs rounded-full flex items-center gap-1 bg-green-500/20 text-green-300 border border-green-500/30">
                          <Icon name="heroicons:currency-dollar" class="w-3 h-3" />
                          ${{ file.price.toFixed(2) }}
                        </span>
                      </div>
                      <div class="absolute bottom-4 right-4 flex gap-2">
                        <button
                          v-if="!isSelectionMode"
                          @click.stop="toggleVisibility(file)"
                          class="p-2 rounded-full transition-colors duration-300"
                          :class="[
                            file.isVisible !== false 
                              ? 'bg-green-500/80 hover:bg-green-600' 
                              : 'bg-red-500/80 hover:bg-red-600'
                          ]"
                          :title="file.isVisible !== false ? 'Hide from series page' : 'Show on series page'"
                        >
                          <Icon 
                            :name="file.isVisible !== false ? 'heroicons:eye' : 'heroicons:eye-slash'" 
                            class="w-5 h-5 text-white" 
                          />
                        </button>
                        <button
                          v-if="file.hlsUrl"
                          @click="downloadAudio(file)"
                          class="p-2 bg-teal-500/80 hover:bg-teal-600 rounded-full transition-colors duration-300"
                          title="Download Audio"
                        >
                          <Icon name="heroicons:arrow-down-tray" class="w-5 h-5 text-white" />
                        </button>
                        <button
                          v-if="!isSelectionMode"
                          @click.stop="editItem(file)"
                          class="p-2 bg-teal-500/80 hover:bg-teal-600 rounded-full transition-colors duration-300"
                          title="Edit Details"
                        >
                          <Icon name="heroicons:pencil-square" class="w-5 h-5 text-white" />
                        </button>
                        <button
                          v-if="!isSelectionMode"
                          @click.stop="deleteFile(file)"
                          class="p-2 bg-red-500/80 hover:bg-red-600 rounded-full transition-colors duration-300"
                          title="Delete File"
                        >
                          <Icon name="heroicons:trash" class="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </template>

                    <!-- Doc preview -->
                    <template v-else-if="file.category === 'Docs'">
                      <img
                        :src="defaultDocPreviewUrl"
                        :alt="file.fileName"
                        class="w-full h-full object-contain"
                      />
                      <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent">
                        <h3 class="absolute bottom-0 left-0 right-0 p-4 text-white text-sm font-medium truncate">
                          {{ file.title || file.fileName }}
                        </h3>
                      </div>
                      <!-- Price badge for docs -->
                      <div v-if="file.price && file.price > 0" class="absolute top-4 right-4 z-10">
                        <span class="px-2 py-1 text-xs rounded-full flex items-center gap-1 bg-green-500/20 text-green-300 border border-green-500/30">
                          <Icon name="heroicons:currency-dollar" class="w-3 h-3" />
                          ${{ file.price.toFixed(2) }}
                        </span>
                      </div>
                      <div class="absolute bottom-4 right-4 flex gap-2">
                        <button
                          v-if="!isSelectionMode"
                          @click.stop="toggleVisibility(file)"
                          class="p-2 rounded-full transition-colors duration-300"
                          :class="[
                            file.isVisible !== false 
                              ? 'bg-green-500/80 hover:bg-green-600' 
                              : 'bg-red-500/80 hover:bg-red-600'
                          ]"
                          :title="file.isVisible !== false ? 'Hide from series page' : 'Show on series page'"
                        >
                          <Icon 
                            :name="file.isVisible !== false ? 'heroicons:eye' : 'heroicons:eye-slash'" 
                            class="w-5 h-5 text-white" 
                          />
                        </button>
                        <button
                          @click="viewDoc(file)"
                          class="p-2 bg-teal-500/80 hover:bg-teal-600 rounded-full transition-colors duration-300"
                          title="View Document"
                        >
                          <Icon name="heroicons:eye" class="w-5 h-5 text-white" />
                        </button>
                        <button
                          v-if="file.hlsUrl"
                          @click="downloadDoc(file)"
                          class="p-2 bg-teal-500/80 hover:bg-teal-600 rounded-full transition-colors duration-300"
                          title="Download Document"
                        >
                          <Icon name="heroicons:arrow-down-tray" class="w-5 h-5 text-white" />
                        </button>
                        <button
                          v-if="!isSelectionMode"
                          @click.stop="editItem(file)"
                          class="p-2 bg-teal-500/80 hover:bg-teal-600 rounded-full transition-colors duration-300"
                          title="Edit Details"
                        >
                          <Icon name="heroicons:pencil-square" class="w-5 h-5 text-white" />
                        </button>
                        <button
                          v-if="!isSelectionMode"
                          @click.stop="deleteFile(file)"
                          class="p-2 bg-red-500/80 hover:bg-red-600 rounded-full transition-colors duration-300"
                          title="Delete File"
                        >
                          <Icon name="heroicons:trash" class="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Streaming Tab -->
          <div v-if="activeTab === 'streaming'" class="space-y-8">
            <!-- Stream Key Management Section -->
            <div v-if="selectedfolderName !== 'default' && selectedfolderName !== 'thumbnails'" class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
              <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Icon name="heroicons:video-camera" class="w-5 h-5 text-teal-400" />
                Stream Key Management
              </h3>
              <!-- Add personal key warning message -->
              <div class="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-3">
                <Icon name="heroicons:exclamation-triangle" class="w-6 h-6 text-yellow-400" />
                <span class="text-yellow-200 text-sm">
                  <strong>Personal stream key is for your use only.</strong> Do not share this key with others. When you copy your personal key, a collaborator invite link will be automatically generated for you to share with others.
                </span>
              </div>
              <!-- Add Invite Creator button in Streaming tab -->
      
              
              <div class="space-y-4">
                <p class="text-gray-300 text-sm">
                  Manage personal stream key for the "<span class="text-teal-400">{{ selectedfolderName }}</span>" channel (1 personal key per channel)
                </p>
                
                <!-- Stream Keys List -->
                <div v-if="streamKeys.length > 0" class="space-y-3">
                  <div v-for="key in streamKeys" :key="key.streamKey" 
                       class="bg-black/20 rounded-lg p-4 border border-teal-500/30">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <span class="px-2 py-1 bg-teal-500/20 text-teal-300 text-xs rounded-full">
                          Personal Key
                        </span>
                        <span class="text-xs text-gray-400">
                          {{ new Date(key.createdAt).toLocaleDateString() }}
                        </span>
                      </div>
                      <button
                        @click="deactivateStreamKey(key.streamKey)"
                        class="p-1 text-orange-400 hover:text-orange-300 transition-colors"
                        title="Deactivate Key"
                      >
                        <Icon name="heroicons:pause" class="w-4 h-4" />
                      </button>
                      <button
                        @click="deleteStreamKey(key.streamKey)"
                        class="p-1 text-red-400 hover:text-red-300 transition-colors"
                        title="Delete Key"
                      >
                        <Icon name="heroicons:trash" class="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div class="flex items-center gap-2">
                      <input
                        :value="`${RTMP_SERVER_URL}/${key.streamKey}`"
                        readonly
                        class="flex-1 bg-black/20 border border-teal-500/30 rounded-lg px-3 py-2 text-white text-sm font-mono"
                      />
                      <button
                        @click="copyStreamKey(key.streamKey)"
                        class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 
                               rounded-lg hover:bg-teal-500/30 transition-all duration-300"
                        :class="{ 'bg-green-500/20 text-green-300 border-green-500/30': streamKeyCopied }"
                      >
                        <Icon 
                          :name="streamKeyCopied ? 'heroicons:check' : 'heroicons:clipboard'" 
                          class="w-4 h-4" 
                        />
                      </button>
                    </div>
                  </div>
                </div>
                
                <!-- No Keys Message -->
                <div v-else class="text-center py-6 text-gray-400">
                  <Icon name="heroicons:video-camera" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No stream keys generated yet</p>
                </div>
                
                <!-- Generate Personal Key -->
                <div class="flex gap-2">
                  <button
                    @click="generateStreamKey"
                    :disabled="isGeneratingStreamKey || streamKeys.length > 0"
                    class="flex-1 px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 
                           rounded-lg hover:bg-teal-500/30 transition-all duration-300 flex items-center justify-center gap-2
                           disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon 
                      v-if="isGeneratingStreamKey" 
                      name="heroicons:arrow-path" 
                      class="w-5 h-5 animate-spin" 
                    />
                    <Icon 
                      v-else 
                      name="heroicons:video-camera" 
                      class="w-5 h-5" 
                    />
                    {{ isGeneratingStreamKey ? 'Generating...' : (streamKeys.length > 0 ? 'Personal Key Generated' : 'Generate Personal Key') }}
                  </button>
                  
                  <button
                    v-if="streamKeys.length > 0"
                    @click="clearAllStreamKeys"
                    class="px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/30 
                           rounded-lg hover:bg-red-500/30 transition-all duration-300"
                  >
                    <Icon name="heroicons:trash" class="w-5 h-5" />
                  </button>
                </div>
                
                <!-- Key Count -->
                <div class="text-xs text-gray-400 text-center">
                  {{ streamKeys.length }}/1 personal key active
                </div>
                
                <!-- Stream Instructions -->
                <div v-if="streamKeys.length > 0" class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <h4 class="text-blue-300 font-medium mb-2">Streaming Instructions:</h4>
                  <div class="text-sm text-gray-300 space-y-1">
                    <p><strong>Complete RTMP URL:</strong> [Use your personal key above]</p>
                    <p class="text-xs text-gray-400 mt-2">
                      Copy the complete RTMP URL and paste it directly into your streaming software. This is your personal key for streaming to your channel. Share collaborator invites with others to let them stream to your channel.
                    </p>
                  </div>
                </div>


              </div>
            </div>

            <!-- No Channel Selected Message -->
            <div v-else class="text-center py-12 text-gray-400">
              <Icon name="heroicons:folder" class="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p class="text-lg mb-2">Select a channel first</p>
              <p class="text-sm">Choose a channel from the Channels tab to manage stream keys</p>
            </div>
          </div>

          <!-- Trailers Tab -->
          <div v-if="activeTab === 'trailers'" class="space-y-8">
            <!-- Trailer Management Section -->
            <div v-if="selectedfolderName !== 'default' && selectedfolderName !== 'thumbnails'" class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
              <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Icon name="heroicons:play" class="w-5 h-5 text-teal-400" />
                Channel Trailer Management
              </h3>
              
              <!-- Current Trailer Display -->
              <div v-if="currentTrailerUrl" class="mb-6">
                <h4 class="text-white font-medium mb-3">Current Trailer</h4>
                <div class="bg-black/20 rounded-lg p-4 border border-white/10">
                  <div class="flex items-center justify-between mb-3">
                    <span class="text-gray-300 text-sm">Trailer URL:</span>
                    <button
                      @click="removeTrailer"
                      class="px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all duration-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <div class="relative w-full" style="padding-bottom: 56.25%;">
                    <video 
                      :src="currentTrailerUrl" 
                      controls 
                      class="absolute top-0 left-0 w-full h-full rounded-lg"
                      preload="metadata"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              </div>

              <!-- Upload New Trailer Section -->
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <h4 class="text-white font-medium">Upload New Trailer</h4>
                  <span class="text-teal-300 text-sm bg-teal-500/20 px-3 py-1 rounded-full border border-teal-500/30">
                    Channel: {{ selectedfolderName || 'No channel selected' }}
                  </span>
                </div>
                
                <!-- File Upload Area -->
                <div class="border-2 border-dashed border-teal-500/30 rounded-lg p-6 text-center hover:border-teal-500/50 transition-colors duration-300">
                  <input
                    ref="trailerFileInput"
                    type="file"
                    accept="video/*"
                    @change="handleTrailerFileSelect"
                    class="hidden"
                  />
                  <div v-if="!isUploadingTrailer && !selectedTrailerFile" @click="$refs.trailerFileInput.click()" class="cursor-pointer">
                    <Icon name="heroicons:cloud-arrow-up" class="w-12 h-12 text-teal-400 mx-auto mb-4" />
                    <p class="text-white font-medium mb-2">Click to upload trailer video</p>
                    <p class="text-gray-400 text-sm">Supports MP4, MOV, AVI, and other video formats</p>
                  </div>
                  
                  <!-- Upload Progress -->
                  <div v-else-if="isUploadingTrailer" class="space-y-4">
                    <div class="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mx-auto"></div>
                    <p class="text-white font-medium">Uploading trailer...</p>
                    <div class="w-full bg-gray-700 rounded-full h-2">
                      <div class="bg-teal-500 h-2 rounded-full transition-all duration-300" :style="{ width: uploadProgress + '%' }"></div>
                    </div>
                    <p class="text-gray-400 text-sm">{{ uploadProgress }}% complete</p>
                  </div>
                </div>

                <!-- Video Preview Section -->
                <div v-if="selectedTrailerFile && !isUploadingTrailer" class="space-y-4">
                  <div class="bg-black/20 rounded-lg p-4 border border-white/10">
                    <div class="flex items-center justify-between mb-3">
                      <span class="text-gray-300 text-sm font-medium">Preview:</span>
                      <button
                        @click="clearSelectedTrailer"
                        class="px-3 py-1 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg hover:bg-gray-500/30 transition-all duration-300 text-sm"
                      >
                        Change File
                      </button>
                    </div>
                    <div class="relative w-full" style="padding-bottom: 56.25%;">
                      <video 
                        :src="selectedTrailerPreview" 
                        controls 
                        class="absolute top-0 left-0 w-full h-full rounded-lg"
                        preload="metadata"
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                    <div class="mt-3 text-sm text-gray-400">
                      <p><strong>File:</strong> {{ selectedTrailerFile.name }}</p>
                      <p><strong>Size:</strong> {{ formatFileSize(selectedTrailerFile.size) }}</p>
                      <p><strong>Type:</strong> {{ selectedTrailerFile.type }}</p>
                    </div>
                  </div>
                </div>

                <!-- Upload Button -->
                <button
                  v-if="selectedTrailerFile && !isUploadingTrailer"
                  @click="uploadTrailer"
                  class="w-full px-4 py-3 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:from-teal-500/30 hover:to-cyan-500/30 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Icon name="heroicons:cloud-arrow-up" class="w-5 h-5" />
                  Upload Trailer
                </button>
              </div>
            </div>

            <!-- No Channel Selected Message -->
            <div v-else class="text-center py-12">
              <Icon name="heroicons:play" class="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 class="text-xl font-semibold text-white mb-2">No Channel Selected</h3>
              <p class="text-gray-400">Choose a channel from the Episodes tab to manage trailers</p>
            </div>
          </div>

          <!-- Sharing Tab -->
          <div v-if="activeTab === 'sharing'" class="space-y-8">
            <!-- Public Channel Share Link Section -->
            <div v-if="selectedfolderName !== 'default' && selectedfolderName !== 'thumbnails' && channelVisibility === 'public'" class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
              <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Icon name="heroicons:globe-alt" class="w-5 h-5 text-teal-400" />
                Public Channel Share Link
              </h3>
              <p class="text-gray-400 text-sm mb-4">Share this link for direct subscription to your public channel</p>
              
              <!-- Username Check Warning -->
              <div v-if="!currentUsername" class="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
                <div class="flex items-center gap-3">
                  <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 text-yellow-400" />
                  <div class="flex-1">
                    <p class="text-yellow-300 font-medium">Username Required</p>
                    <p class="text-yellow-200 text-sm">You need to set a username to generate clean share links.</p>
                  </div>
                  <button
                    @click="navigateTo('/account')"
                    class="px-4 py-2 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/30 transition-all duration-300 text-sm"
                  >
                    Set Username
                  </button>
                </div>
              </div>
              
              <div v-if="!shareableLink" class="space-y-4">
                <p class="text-gray-300 text-sm">
                  Generate a shareable link for the "<span class="text-teal-400">{{ selectedfolderName }}</span>" channel
                </p>
                <button
                  @click="generateShareLink"
                  :disabled="isGeneratingLink || !currentUsername"
                  class="w-full px-6 py-3 bg-teal-500/20 text-teal-300 border border-teal-500/30 
                         rounded-lg hover:bg-teal-500/30 transition-all duration-300 flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon 
                    v-if="isGeneratingLink" 
                    name="heroicons:arrow-path" 
                    class="w-5 h-5 animate-spin" 
                  />
                  <Icon 
                    v-else 
                    name="heroicons:link" 
                    class="w-5 h-5" 
                  />
                  {{ isGeneratingLink ? 'Generating...' : 'Generate Share Link' }}
                </button>
              </div>
              
              <div v-else class="space-y-4">
                <p class="text-gray-300 text-sm">
                  Share link for the "<span class="text-teal-400">{{ selectedfolderName }}</span>" channel:
                </p>
                <div class="bg-black/20 rounded-lg p-4 border border-teal-500/30">
                  <p class="text-gray-300 text-sm mb-2">Share Link Generated!</p>
                  <div class="flex gap-2">
                    <button
                      @click="showShareModal = true"
                      class="flex-1 px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 
                             rounded-lg hover:bg-teal-500/30 transition-all duration-300"
                    >
                      <Icon name="heroicons:eye" class="w-4 h-4 mr-2" />
                      View Share Options
                    </button>
                    <button
                      @click="generateNewLink"
                      class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 
                             rounded-lg hover:bg-teal-500/30 transition-all duration-300"
                    >
                      <Icon name="heroicons:arrow-path" class="w-4 h-4" />
                    </button>
                    <button
                      @click="clearShareLink"
                      class="px-4 py-2 bg-gray-500/20 text-gray-300 border border-gray-500/30 
                             rounded-lg hover:bg-gray-500/30 transition-all duration-300"
                    >
                      <Icon name="heroicons:trash" class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Private/Searchable Channel Share Link Section -->
            <div v-if="selectedfolderName !== 'default' && selectedfolderName !== 'thumbnails' && (channelVisibility === 'private' || channelVisibility === 'searchable')" class="bg-black/30 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
              <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Icon name="heroicons:lock-closed" class="w-5 h-5 text-purple-400" />
                Private Channel Share Link
              </h3>
              <p class="text-gray-400 text-sm mb-4">Share this link for invite-only access to your private channel</p>
              
              <!-- Username Check Warning -->
              <div v-if="!currentUsername" class="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
                <div class="flex items-center gap-3">
                  <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 text-yellow-400" />
                  <div class="flex-1">
                    <p class="text-yellow-300 font-medium">Username Required</p>
                    <p class="text-yellow-200 text-sm">You need to set a username to generate clean share links.</p>
                  </div>
                  <button
                    @click="navigateTo('/account')"
                    class="px-4 py-2 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/30 transition-all duration-300 text-sm"
                  >
                    Set Username
                  </button>
                </div>
              </div>
              
              <div v-if="!shareableLink" class="space-y-4">
                <p class="text-gray-300 text-sm">
                  Generate a private share link for the "<span class="text-purple-400">{{ selectedfolderName }}</span>" channel
                </p>
                <button
                  @click="generateShareLink"
                  :disabled="isGeneratingLink || !currentUsername"
                  class="w-full px-6 py-3 bg-purple-500/20 text-purple-300 border border-purple-500/30 
                         rounded-lg hover:bg-purple-500/30 transition-all duration-300 flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon 
                    v-if="isGeneratingLink" 
                    name="heroicons:arrow-path" 
                    class="w-5 h-5 animate-spin" 
                  />
                  <Icon 
                    v-else 
                    name="heroicons:lock-closed" 
                    class="w-5 h-5" 
                  />
                  {{ isGeneratingLink ? 'Generating...' : 'Generate Private Share Link' }}
                </button>
              </div>
              
              <div v-else class="space-y-4">
                <p class="text-gray-300 text-sm">
                  Private share link for the "<span class="text-purple-400">{{ selectedfolderName }}</span>" channel:
                </p>
                <div class="bg-black/20 rounded-lg p-4 border border-purple-500/30">
                  <p class="text-gray-300 text-sm mb-2">Private Share Link Generated!</p>
                  <div class="flex gap-2">
                    <button
                      @click="showShareModal = true"
                      class="flex-1 px-4 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 
                             rounded-lg hover:bg-purple-500/30 transition-all duration-300"
                    >
                      <Icon name="heroicons:eye" class="w-4 h-4 mr-2" />
                      View Share Options
                    </button>
                    <button
                      @click="generateNewLink"
                      class="px-4 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 
                             rounded-lg hover:bg-purple-500/30 transition-all duration-300"
                    >
                      <Icon name="heroicons:arrow-path" class="w-4 h-4" />
                    </button>
                    <button
                      @click="clearShareLink"
                      class="px-4 py-2 bg-gray-500/20 text-gray-300 border border-gray-500/30 
                             rounded-lg hover:bg-gray-500/30 transition-all duration-300"
                    >
                      <Icon name="heroicons:trash" class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Collaborator Invite Link Section (Affiliates Only - Limited Channels) -->
            <div v-if="selectedfolderName !== 'default' && selectedfolderName !== 'thumbnails' && authStore.personas.affiliate && (selectedfolderName === 'Twilly TV' || selectedfolderName === 'Twilly After Dark')" class="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
              <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Icon name="heroicons:user-plus" class="w-5 h-5 text-green-400" />
                Collaborator Invite Link
              </h3>
              <div class="text-sm text-gray-300 space-y-3">
                <p>Share this link with others to invite them as collaborators:</p>
                <div v-if="collaboratorInviteLink" class="flex items-center gap-2">
                  <input
                    :value="collaboratorInviteLink"
                    readonly
                    class="flex-1 bg-black/20 border border-green-500/30 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <button
                    @click="copyInviteLinkManually"
                    class="px-4 py-2 bg-green-500/20 text-green-300 border border-green-500/30 
                           rounded-lg hover:bg-green-500/30 transition-all duration-300"
                    :class="{ 'bg-green-500/20 text-green-300 border-green-500/30': inviteLinkCopied }"
                  >
                    <Icon 
                      :name="inviteLinkCopied ? 'heroicons:check' : 'heroicons:clipboard'" 
                      class="w-4 h-4" 
                    />
                  </button>
                </div>
                <div v-else class="text-center py-4">
                  <button
                    @click="generateCollaboratorInvite(streamKeys[0]?.streamKey)"
                    :disabled="isGeneratingInvite"
                    class="w-full px-6 py-3 bg-teal-500/20 text-teal-300 border border-teal-500/30 
                           rounded-lg hover:bg-teal-500/30 transition-all duration-300 flex items-center justify-center gap-2
                           disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon v-if="isGeneratingInvite" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
                    <Icon v-else name="heroicons:plus" class="w-5 h-5" />
                    {{ isGeneratingInvite ? 'Generating...' : 'Generate Invite Link' }}
                  </button>
                </div>
                <p class="text-xs text-gray-400">
                  When collaborators accept this invite, they'll get their own stream key to use on your channel.
                </p>
              </div>
            </div>

            <!-- Collaborator Request Link Section -->
            <div v-if="selectedfolderName !== 'default' && selectedfolderName !== 'thumbnails'" class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6 mt-6">
              <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Icon name="heroicons:hand-raised" class="w-5 h-5 text-purple-400" />
                Collaborator Request Link
              </h3>
              <div class="text-sm text-gray-300 space-y-3">
                <p>Share this link to allow potential collaborators to submit applications:</p>
                <div v-if="collaboratorRequestLink" class="flex items-center gap-2">
                  <input
                    :value="collaboratorRequestLink"
                    readonly
                    class="flex-1 bg-black/20 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <button
                    @click="copyRequestLinkManually"
                    class="px-4 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 
                           rounded-lg hover:bg-purple-500/30 transition-all duration-300"
                    :class="{ 'bg-purple-500/20 text-purple-300 border-purple-500/30': requestLinkCopied }"
                  >
                    <Icon 
                      :name="requestLinkCopied ? 'heroicons:check' : 'heroicons:clipboard'" 
                      class="w-4 h-4" 
                    />
                  </button>
                </div>
                <div v-else class="text-center py-4">
                  <button
                    @click="generateCollaboratorRequest"
                    :disabled="isGeneratingRequest"
                    class="w-full px-6 py-3 bg-teal-500/20 text-teal-300 border border-teal-500/30 
                           rounded-lg hover:bg-teal-500/30 transition-all duration-300 flex items-center justify-center gap-2
                           disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon v-if="isGeneratingRequest" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
                    <Icon v-else name="heroicons:user-group" class="w-5 h-5" />
                    {{ isGeneratingRequest ? 'Generating...' : 'Generate Collaborator Request' }}
                  </button>
                </div>
                <p class="text-xs text-gray-400">
                  When potential collaborators visit this link, they can submit their application for review.
                </p>
              </div>
            </div>




            <!-- Affiliate Invite Link Section (Main Producer Only) -->
            <div v-if="isMainProducer && selectedfolderName !== 'default' && selectedfolderName !== 'thumbnails'" class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6 mt-6">
              <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Icon name="heroicons:link" class="w-5 h-5 text-purple-400" />
                Affiliate Invite Link
              </h3>
              <div class="text-sm text-gray-300 space-y-3">
                <p>Share this link to invite affiliates who can then invite collaborators to Twilly TV and Twilly After Dark:</p>
                <div v-if="affiliateInviteLink" class="flex items-center gap-2">
                  <input
                    :value="affiliateInviteLink"
                    readonly
                    class="flex-1 bg-black/20 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <button
                    @click="copyAffiliateInviteLinkManually"
                    class="px-4 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-all duration-300"
                    :class="{ 'bg-purple-500/20 text-purple-300 border-purple-500/30': affiliateInviteLinkCopied }"
                  >
                    <Icon 
                      :name="affiliateInviteLinkCopied ? 'heroicons:check' : 'heroicons:clipboard'" 
                      class="w-4 h-4" 
                    />
                  </button>
                </div>
                <div v-else class="text-center py-4">
                  <button
                    @click="generateAffiliateInvite"
                    :disabled="isGeneratingAffiliateInvite"
                    class="w-full px-6 py-3 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-all duration-300 flex items-center justify-center gap-2
                           disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon v-if="isGeneratingAffiliateInvite" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
                    <Icon v-else name="heroicons:link" class="w-5 h-5" />
                    {{ isGeneratingAffiliateInvite ? 'Generating...' : 'Generate Affiliate Invite' }}
                  </button>
                </div>
                <p class="text-xs text-gray-400">
                  Affiliates can invite collaborators to Twilly TV and Twilly After Dark channels and earn commissions.
                </p>
                <div v-if="affiliateInviteSuccessMessage" class="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-lg p-2">
                  {{ affiliateInviteSuccessMessage }}
                </div>
              </div>
            </div>

            <!-- No Channel Selected Message -->
            <div v-if="selectedfolderName === 'default' || selectedfolderName === 'thumbnails'" class="text-center py-12 text-gray-400">
              <Icon name="heroicons:folder" class="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p class="text-lg mb-2">Select a channel first</p>
              <p class="text-sm">Choose a channel from the Channels tab to share</p>
            </div>

            <!-- Role-Based Dashboard for Non-Producers -->
            <div v-if="!isMainProducer" class="space-y-6 mt-6">
              
              <!-- Default View: No Requests -->
              <div v-if="!hasSpecialRole" class="bg-gray-500/10 border border-gray-500/30 rounded-lg p-8 text-center">
                <Icon name="heroicons:user-plus" class="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 class="text-xl font-semibold text-white mb-2">No Requests Yet</h3>
                <p class="text-gray-300 mb-4">You haven't received any collaboration or casting director requests yet.</p>
                <p class="text-sm text-gray-400">Producers can invite you to collaborate or become a casting director for their channels.</p>
              </div>

              <!-- Collaborator Dashboard -->
              <div v-if="isCollaborator" class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
                <div class="flex items-center gap-3 mb-4">
                  <Icon name="heroicons:user-group" class="w-6 h-6 text-blue-400" />
                  <h3 class="text-lg font-semibold text-white">Collaborator Dashboard</h3>
                </div>
                <div class="space-y-4">
                  <div v-for="channel in userRoles.collaboratorChannels" :key="channel.channelId" class="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                    <h4 class="font-medium text-white mb-2">{{ channel.channelName }}</h4>
                    <div class="text-sm text-gray-300 space-y-1">
                      <p>Role: {{ channel.role }}</p>
                      <p>Joined: {{ new Date(channel.joinedAt).toLocaleDateString() }}</p>
                      <p>Payout Setup: {{ channel.hasPayoutSetup ? '✅ Complete' : '❌ Required' }}</p>
                    </div>
                    <div v-if="!channel.hasPayoutSetup" class="mt-3">
                      <NuxtLink to="/account" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all duration-300">
                        <Icon name="heroicons:credit-card" class="w-4 h-4" />
                        Set Up Payouts
                      </NuxtLink>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Casting Director Dashboard -->
              <div v-if="isCastingDirector" class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6">
                <div class="flex items-center gap-3 mb-4">
                  <Icon name="heroicons:user-plus" class="w-6 h-6 text-purple-400" />
                  <h3 class="text-lg font-semibold text-white">Casting Director Dashboard</h3>
                </div>
                <div class="space-y-4">
                  <div v-for="channel in userRoles.castingDirectorChannels" :key="channel.channelId" class="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
                    <h4 class="font-medium text-white mb-2">{{ channel.channelName }}</h4>
                    <div class="text-sm text-gray-300 space-y-1">
                      <p>Commission Rate: {{ (channel.commissionRate * 100).toFixed(0) }}%</p>
                      <p>Joined: {{ new Date(channel.joinedAt).toLocaleDateString() }}</p>
                      <p>Payout Setup: {{ channel.hasPayoutSetup ? '✅ Complete' : '❌ Required' }}</p>
                    </div>
                    <div class="mt-3 space-x-2">
                      <button 
                        @click="generateCastingDirectorReferralLink(channel.channelId)"
                        class="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-all duration-300"
                      >
                        <Icon name="heroicons:link" class="w-4 h-4" />
                        Get Referral Link
                      </button>
                      <div v-if="!channel.hasPayoutSetup">
                        <NuxtLink to="/account" class="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-all duration-300">
                          <Icon name="heroicons:credit-card" class="w-4 h-4" />
                          Set Up Payouts
                        </NuxtLink>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Future: Videographer and Other Talent Types -->
              <div class="bg-gray-500/10 border border-gray-500/30 rounded-lg p-6">
                <div class="flex items-center gap-3 mb-4">
                  <Icon name="heroicons:video-camera" class="w-6 h-6 text-gray-400" />
                  <h3 class="text-lg font-semibold text-white">Coming Soon</h3>
                </div>
                <div class="text-sm text-gray-300 space-y-2">
                  <p>Additional talent types will be available soon:</p>
                  <ul class="list-disc list-inside space-y-1 ml-4">
                    <li>Videographers</li>
                    <li>Editors</li>
                    <li>Sound Engineers</li>
                    <li>Graphic Designers</li>
                  </ul>
                </div>
              </div>

            </div>



          </div>
        </div>

        <!-- Add a success notification -->
        <div
          v-if="showMoveSuccess"
          class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-teal-500/90 to-cyan-500/90 backdrop-blur-sm
                 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2
                 border border-teal-400/30 z-50 animate-fade-in"
        >
          <Icon name="heroicons:check-circle" class="w-5 h-5" />
          Files moved successfully!
        </div>

        <!-- Success/Error notification -->
        <div
          v-if="showSuccessNotification"
          class="fixed bottom-4 left-1/2 transform -translate-x-1/2 backdrop-blur-sm
                 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2
                 border z-50 animate-fade-in"
          :class="[
            successMessage.startsWith('Error:')
              ? 'bg-gradient-to-r from-red-500/90 to-pink-500/90 border-red-400/30'
              : 'bg-gradient-to-r from-green-500/90 to-emerald-500/90 border-green-400/30'
          ]"
        >
          <Icon 
            :name="successMessage.startsWith('Error:') ? 'heroicons:x-circle' : 'heroicons:check-circle'" 
            class="w-5 h-5" 
          />
          {{ successMessage }}
        </div>

        <!-- Collaborator Invite Link notification -->
        <div
          v-if="inviteSuccessMessage"
          class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500/90 backdrop-blur-sm
                 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2
                 border border-blue-400/30 z-50"
        >
          <Icon name="heroicons:link" class="w-5 h-5" />
          {{ inviteSuccessMessage }}
        </div>

        <!-- Invite Link Display (for mobile fallback) -->
        <div
          v-if="collaboratorInviteLink && inviteSuccessMessage.includes('Tap to copy')"
          class="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-black/90 backdrop-blur-sm
                 text-white px-4 py-3 rounded-lg shadow-lg border border-blue-400/30 z-50 max-w-sm"
        >
          <div class="text-xs text-gray-300 mb-2">Tap to copy invite link:</div>
          <div 
            @click="copyInviteLinkManually"
            class="bg-black/20 border border-blue-500/30 rounded px-3 py-2 text-sm font-mono break-all cursor-pointer hover:bg-black/30 transition-colors"
          >
            {{ collaboratorInviteLink }}
          </div>
        </div>

        <!-- New folder modal -->
        <Modal v-if="showNewFolderModal">
          <div class="relative">
            <!-- Header -->
            <div class="mb-6 text-center">
              <h3 class="text-xl font-semibold text-white">
                Create New <span class="text-teal-400">{{ selectedName }}</span> Channel
              </h3>
            </div>
            
            <!-- Close button -->
            <button 
              @click="showNewFolderModal = false"
              class="absolute top-0 right-0 p-2 text-gray-400 hover:text-white 
                     transition-colors duration-200"
            >
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>

            <!-- Form -->
            <input 
              v-model="newFolderName"
              type="text"
              class="w-full bg-black/20 border border-teal-500/30 rounded-lg p-3 mb-4
                     text-white placeholder-gray-400 outline-none focus:border-teal-500
                     transition-all duration-300"
              placeholder="Channel name"
            />
            
            <!-- Trailer URL Input -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-300 mb-2">
                Trailer URL (Optional)
              </label>
              <input 
                v-model="newFolderTrailerUrl"
                type="url"
                class="w-full bg-black/20 border border-teal-500/30 rounded-lg p-3
                       text-white placeholder-gray-400 outline-none focus:border-teal-500
                       transition-all duration-300"
                placeholder="https://example.com/trailer.mp4"
              />
              <p class="text-xs text-gray-400 mt-1">
                Add a trailer video URL to showcase your channel
              </p>
            </div>
            <div class="flex justify-end gap-3">
              <button 
                @click="showNewFolderModal = false"
                class="px-6 py-2 text-gray-400 hover:text-white transition-colors duration-200"
              >
                Cancel
              </button>
              <button 
                @click="createNewFolder"
                class="px-6 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 
                       rounded-lg hover:bg-teal-500/30 transition-all duration-300
                       disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!newFolderName"
              >
                <div class="flex items-center gap-2">
                  <Icon name="heroicons:folder-plus" class="w-5 h-5" />
                  Create
                </div>
              </button>
            </div>
          </div>
        </Modal>

        <!-- Airdate Picker Modal -->
                        <AirdatePicker
                  v-if="showAirdateModal && selectedFile"
                  :is-open="showAirdateModal"
                  :episode-id="selectedFile.SK"
                  :user-id="authStore.user?.attributes?.email"
                  :series-name="selectedfolderName"
                  :is-visible="selectedFile.isVisible === true"
                  :current-airdate="selectedFile.airdate"
                  @close="showAirdateModal = false"
                  @scheduled="handleAirdateScheduled"
                />

        <!-- Edit Item Modal -->
        <Modal v-if="showEditModal">
          <div class="fixed inset-0 flex items-center justify-center z-[9999]">
            <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeEditModal"></div>
            <div class="relative w-full max-w-2xl mx-4 bg-black/90 border border-teal-500/30 rounded-xl p-6 shadow-xl">
              <!-- Loading State -->
              <div v-if="isEditModalLoading" class="flex items-center justify-center min-h-[200px]">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-400 border-t-transparent"></div>
              </div>

              <!-- Content (only shown when loaded) -->
              <div v-else class="space-y-6">
                <!-- Header -->
                <div class="flex items-center justify-between">
                  <h3 class="text-xl font-semibold text-white">
                    Edit <span class="text-teal-400">Item Details</span>
                  </h3>
                  <button 
                    @click="closeEditModal"
                    class="p-2 text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    <Icon name="heroicons:x-mark" class="w-5 h-5" />
                  </button>
                </div>

                <!-- Form -->
                <form @submit.prevent="updateItemDetails" class="space-y-6">
                  <div class="space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-300 mb-2">Title</label>
                      <input 
                        v-model="editingItem.title"
                        type="text"
                        class="w-full bg-black/20 border border-teal-500/30 rounded-lg px-4 py-3
                               text-white placeholder-gray-400 outline-none focus:border-teal-500
                               transition-all duration-300"
                        placeholder="Enter title"
                      />
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-300 mb-2">Description</label>
                      <textarea 
                        v-model="editingItem.description"
                        class="w-full bg-black/20 border border-teal-500/30 rounded-lg px-4 py-3
                               text-white placeholder-gray-400 outline-none focus:border-teal-500
                               transition-all duration-300 min-h-[120px] resize-none"
                        placeholder="Enter description"
                      ></textarea>
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-300 mb-2">Price ($)</label>
                      <div class="relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                        <input 
                          v-model="editingItem.price"
                          type="number"
                          step="0.01"
                          min="0"
                          class="w-full bg-black/20 border border-teal-500/30 rounded-lg pl-8 pr-4 py-3
                                 text-white placeholder-gray-400 outline-none focus:border-teal-500
                                 transition-all duration-300"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-300 mb-2">Visibility</label>
                      <div class="flex items-center gap-3">
                        <button
                          @click="editingItem.isVisible = true"
                          class="px-4 py-2 rounded-lg transition-all duration-300 flex items-center gap-2"
                          :class="[
                            editingItem.isVisible === true
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                              : 'bg-gray-500/20 text-gray-300 border border-gray-500/30 hover:bg-gray-500/30'
                          ]"
                        >
                          <Icon name="heroicons:eye" class="w-4 h-4" />
                          Visible
                        </button>
                        <button
                          @click="editingItem.isVisible = false"
                          class="px-4 py-2 rounded-lg transition-all duration-300 flex items-center gap-2"
                          :class="[
                            editingItem.isVisible === false
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-gray-500/20 text-gray-300 border border-gray-500/30 hover:bg-gray-500/30'
                          ]"
                        >
                          <Icon name="heroicons:eye-slash" class="w-4 h-4" />
                          Hidden
                        </button>
                      </div>
                      <p class="text-xs text-gray-400 mt-1">
                        Hidden items will not appear on the series page
                      </p>
                    </div>


                  </div>

                  <div class="flex justify-end gap-3 pt-4 border-t border-gray-700/30">
                    <button 
                      type="button"
                      @click="closeEditModal"
                      class="px-6 py-2 text-gray-400 hover:text-white transition-colors duration-200"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      class="px-6 py-2 rounded-lg transition-all duration-300 flex items-center gap-2"
                      :class="[
                        isEditModalLoading
                          ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30 cursor-not-allowed'
                          : 'bg-teal-500/20 text-teal-300 border border-teal-500/30 hover:bg-teal-500/30'
                      ]"
                      :disabled="isEditModalLoading"
                    >
                      <Icon 
                        v-if="isEditModalLoading" 
                        name="heroicons:arrow-path" 
                        class="w-5 h-5 animate-spin" 
                      />
                      <Icon 
                        v-else 
                        name="heroicons:check-circle" 
                        class="w-5 h-5" 
                      />
                      {{ isEditModalLoading ? 'Saving...' : 'Save Changes' }}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </div>

    <!-- Share Modal -->
    <div v-if="showShareModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-black/90 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8 max-w-2xl w-full">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-2xl font-semibold text-white">Share Channel</h3>
          <button @click="clearShareLink" class="text-gray-400 hover:text-white">
            <Icon name="heroicons:x-mark" class="w-6 h-6" />
          </button>
        </div>
        
        <p class="text-gray-300 text-base sm:text-lg mb-6">Choose your sharing option:</p>
        
        <!-- Option 1: Direct URL (Perfect for WhatsApp) -->
        <div class="mb-6 p-4 bg-teal-500/10 border border-teal-500/30 rounded-lg">
          <div class="flex items-center gap-3 mb-3">
            <Icon name="heroicons:chat-bubble-left-right" class="w-5 h-5 text-teal-400" />
            <h4 class="text-lg font-semibold text-teal-300">Direct URL (Perfect for WhatsApp)</h4>
          </div>
          <p class="text-gray-400 text-sm mb-3">Use this link for WhatsApp, Instagram, and other social media platforms. Shows preview images immediately.</p>
          <div class="flex gap-2">
            <input 
              type="text" 
              readonly 
              :value="shareableLink"
              class="flex-1 bg-black/30 border border-teal-500/30 rounded-lg p-3 text-white text-sm"
            />
            <button 
              @click="copyShareLinkToClipboard"
              class="px-4 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm"
            >
              {{ linkCopied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
        </div>
        
        <!-- Option 2: Share.twilly.app Redirect (Faster Loading) -->
        <div class="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div class="flex items-center gap-3 mb-3">
            <Icon name="heroicons:bolt" class="w-5 h-5 text-blue-400" />
            <h4 class="text-lg font-semibold text-blue-300">Share.twilly.app Redirect (Faster Loading)</h4>
          </div>
          <p class="text-gray-400 text-sm mb-3">Use this link for faster page loading. Redirects to the full URL with optimized performance.</p>
          <div class="flex gap-2">
            <input 
              type="text" 
              readonly 
              :value="shareAppLink"
              class="flex-1 bg-black/30 border border-blue-500/30 rounded-lg p-3 text-white text-sm"
            />
            <button 
              @click="copyShareAppLinkToClipboard"
              class="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
            >
              {{ shareAppLinkCopied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
        </div>
        
        <div class="flex justify-end gap-3">
          <button 
            @click="generateNewLink"
            class="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Generate New Link
          </button>
          <button 
            @click="clearShareLink"
            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { useFileStore } from '@/stores/useFileStore';
import { storeToRefs } from 'pinia';
import { Auth } from 'aws-amplify';
import CopyLink from "@/components/CopyLink.vue";
import debounce from "lodash/debounce";
import 'video.js/dist/video-js.css';
import videojs from 'video.js';
import Modal from '@/components/Modal.vue';
import ChangeFolderPreview from '@/components/ChangeFolderPreview.vue';
import ManageCollaborations from '@/components/ManageCollaborations.vue';
import { useAuthStore } from '@/stores/auth';
import { useTaskStore } from '@/stores/TaskStore';
import { useTalentRequestsStore } from '@/stores/talentRequests';
import { useChannelDescriptionStore } from '@/stores/useChannelDescriptionStore';
import { v4 as uuidv4 } from 'uuid';

const fileStore = useFileStore();
const { files } = storeToRefs(fileStore);
const authStore = useAuthStore();
const taskStore = useTaskStore();
const talentRequestsStore = useTalentRequestsStore();
const channelStore = useChannelDescriptionStore();

// Tab management
const activeTab = ref('files');
const tabs = [
  { id: 'files', name: 'Episodes', icon: 'heroicons:document' },
  { id: 'streaming', name: 'Streaming', icon: 'heroicons:video-camera' },
  { id: 'trailers', name: 'Trailers', icon: 'heroicons:play' },
  { id: 'sharing', name: 'Sharing', icon: 'heroicons:link' }
];

const selectedfolderName = ref('default');
const currentUser = ref('');
const menuPosterUrl = ref('');
const user = ref(null);
const imageLoaded = ref(false);
const videoLoaded = ref(false);
const audioLoaded = ref(false);
const docLoaded = ref(false);
const defaultAudioPreviewUrl = "https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExdXpsZDJlMmZ2aW5sYnptMW1hYzlxN2I4NmI2anV0MGk1ZnM0bmcyeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/4oMoIbIQrvCjm/giphy.gif"; 
const defaultDocPreviewUrl= "https://theprivatecollection.s3.us-east-2.amazonaws.com/pdf.png"

const twillyCloudFrontUrl = "https://d1bb6cskvno4vp.cloudfront.net";
const collectionsCloudFrontBaseUrl = "https://d26k8mraabzpiy.cloudfront.net";
const cloudFrontBaseUrl = "https://d4idc5cmwxlpy.cloudfront.net";
const inputBucketCloudFrontUrl = "https://d2qxh65v2xrci1.cloudfront.net";

const isLoading = ref(true);
const selectedFiles = ref(new Set());
const isSelectionMode = ref(false);
const error = ref(null);
// Helper to slugify channel/series names for clean URLs
const slugify = (value) => {
  if (!value) return '';
  const lower = String(value).trim().toLowerCase();
  return lower
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};


// Remove selectedItems ref since we'll use selectedFiles consistently
const isAllSelected = computed(() => {
  if (!filteredFiles.value || filteredFiles.value.length === 0) {
    return false;
  }
  return filteredFiles.value.every(file => file && file.SK && selectedFiles.value.has(file.SK));
});

const isCreator = computed(() => {
  return authStore.userType === 'creator' || authStore.userType === 'producer';
});

// CONFIGURABLE: List of producer emails that have full access
// Add new producer emails here as needed
const PRODUCER_EMAILS = [
  'dehyu.sinyan@gmail.com',
  'dehsin365@gmail.com'
  // Add more producer emails here as needed
];

// CONFIGURABLE: List of producer usernames that have full access
const PRODUCER_USERNAMES = [
  'DehSin365',
  'dehswizzy'
  // Add more producer usernames here as needed
];

// User role detection
const userRoles = ref({
  isMasterAccount: false,
  isCollaborator: false,
  isCastingDirector: false,
  collaboratorChannels: [],
  castingDirectorChannels: []
});

// Check if user is a producer (configurable list)
const isMainProducer = computed(() => {
  const userEmail = authStore.user?.attributes?.email;
  const username = currentUsername.value;
  
  // Check against configurable lists
  return PRODUCER_EMAILS.includes(userEmail) || PRODUCER_USERNAMES.includes(username);
});

// Check if user can access managefiles (Master account only)
const canAccessManagefiles = computed(() => {
  return authStore.canAccessManagefiles();
});

// Check if user is a collaborator
const isCollaborator = computed(() => {
  return userRoles.value.isCollaborator;
});

// Check if user is a casting director
const isCastingDirector = computed(() => {
  return userRoles.value.isCastingDirector;
});

// Check if user has any special role (not just a regular user)
const hasSpecialRole = computed(() => {
  return userRoles.value.isMasterAccount || userRoles.value.isCollaborator || userRoles.value.isCastingDirector;
});

// State for username
const currentUsername = ref('');

// Function to fetch username from DynamoDB
const fetchUsernameFromDynamo = async () => {
  try {
    const response = await fetch('/api/creators/get-username', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: authStore.user?.attributes?.sub,
        email: authStore.user?.attributes?.email
      })
    });

          if (response.ok) {
        const data = await response.json();
        return data.username || '';
    } else {
      console.error('Failed to fetch username from DynamoDB');
      return '';
    }
  } catch (error) {
    console.error('Error fetching username from DynamoDB:', error);
    return '';
  }
};

// Function to get username with fallbacks
const getUsernameWithFallbacks = async () => {
  // Try DynamoDB first
  let username = await fetchUsernameFromDynamo();
  
  // If DynamoDB fails, try auth store
      if (!username && authStore.user?.attributes?.username) {
      username = authStore.user.attributes.username;
    }
  
  // If still no username, try localStorage
  if (!username && process.client) {
    const currentUserId = authStore.user?.attributes?.sub;
    if (currentUserId) {
      const userSpecificKey = `userUsername_${currentUserId}`;
      username = localStorage.getItem(userSpecificKey) || '';
    }
  }
  
  return username;
};

// Function to detect user roles by checking DynamoDB
const detectUserRoles = async () => {
  if (!authStore.user?.attributes?.sub) return;
  
  try {
    const userId = authStore.user.attributes.sub;
    const userEmail = authStore.user.attributes.email;
    
    console.log('🔍 Detecting roles for user:', { userId, userEmail, username: currentUsername.value });
    
    // Check for collaborator roles
    try {
      const collaboratorResponse = await $fetch('/api/collaborations/get-user-roles', {
        method: 'POST',
        body: { userId }
      });
      
      if (collaboratorResponse.success && collaboratorResponse.roles?.length > 0) {
        userRoles.value.isCollaborator = true;
        userRoles.value.collaboratorChannels = collaboratorResponse.roles;
        console.log('✅ Found collaborator roles:', collaboratorResponse.roles);
      }
    } catch (error) {
      console.log('No collaborator roles found or error:', error.message);
    }
    
    // Check for casting director roles
    try {
      const castingDirectorResponse = await $fetch('/api/casting-directors/get-user-roles', {
        method: 'POST',
        body: { userId }
      });
      
      if (castingDirectorResponse.success && castingDirectorResponse.roles?.length > 0) {
        userRoles.value.isCastingDirector = true;
        userRoles.value.castingDirectorChannels = castingDirectorResponse.roles;
        console.log('✅ Found casting director roles:', castingDirectorResponse.roles);
      }
    } catch (error) {
      console.log('No casting director roles found or error:', error.message);
    }
    
    console.log('🎯 Final user roles detected:', userRoles.value);
    
  } catch (error) {
    console.error('Error detecting user roles:', error);
  }
};

// Function to generate casting director referral link for dashboard
const generateCastingDirectorReferralLink = async (channelId) => {
  try {
    const response = await $fetch('/api/casting-directors/get-referral-link', {
      method: 'POST',
      body: { 
        userId: authStore.user.attributes.sub,
        channelId: channelId
      }
    });
    
    if (response.success && response.referralLink) {
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(response.referralLink);
        alert('Referral link copied to clipboard!');
      } catch (e) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = response.referralLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Referral link copied to clipboard!');
      }
    } else {
      alert('Error: ' + (response.message || 'Failed to generate referral link'));
    }
  } catch (error) {
    console.error('Error generating referral link:', error);
    alert('Error generating referral link. Please try again.');
  }
};

const filteredFiles = computed(() => {
  if (!files.value || !Array.isArray(files.value)) {
    return [];
  }
  const seen = new Set();
  const filtered = files.value
    .filter(file => {
      if (!file || !file.fileName) {
        return false;
      }
      
      // Skip thumbnail files (files ending with _thumb.jpg)
      if (file.fileName.includes('_thumb.jpg')) {
        return false;
      }
      
      // Skip any .gif files that are not thumbnails
      if (file.fileName.endsWith('.gif') && !file.fileName.includes('_0.gif')) {
        return false;
      }
      
      // For any file with _0.gif in its name, only show in thumbnails folder
      if (file.fileName.includes('_0.gif')) {
        // Skip if we've already seen this thumbnail
        if (seen.has(file.fileName)) {
          return false;
        }
        seen.add(file.fileName);
        return selectedfolderName.value === 'thumbnails';
      }
      
      // For videos, only show if it has an HLS URL AND a streamKey (for stream videos)
      // CRITICAL: Match mobile app (get-content API) filtering exactly - require isVisible === true and valid thumbnail
      if (file.category === 'Videos') {
        const hasHlsUrl = file.hlsUrl;
        const hasStreamKey = file.streamKey; // Ensure it has a streamKey (stream videos)
        const isVisible = file.isVisible === true; // CRITICAL: Only show visible videos (match mobile app)
        
        // Check for valid thumbnail (match mobile app filtering exactly)
        const thumbnailUrl = file.thumbnailUrl;
        let hasValidThumbnail = false;
        
        if (thumbnailUrl) {
          // Must be a string
          if (typeof thumbnailUrl === 'string') {
            const trimmed = thumbnailUrl.trim();
            // Must not be empty, whitespace-only, or invalid string values
            if (trimmed !== '' && 
                trimmed !== 'null' && 
                trimmed !== 'undefined' &&
                trimmed !== 'None' &&
                trimmed !== 'none' &&
                !trimmed.startsWith('data:') && // Exclude data URIs (not valid image URLs)
                (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
              // Additional check: URL should have a valid structure
              try {
                const url = new URL(trimmed);
                // URL should have a hostname and path
                if (url.hostname && url.pathname) {
                  hasValidThumbnail = true;
                }
              } catch (e) {
                // Invalid URL format
                hasValidThumbnail = false;
              }
            }
          }
        }
        
        // Match by folderName OR seriesName (videos can be saved with either)
        // Also check if folderName/seriesName matches the selected folder (case-insensitive)
        const fileChannelName = file.folderName || file.seriesName;
        const folderMatch = selectedfolderName.value === 'default' ? 
          (!fileChannelName || fileChannelName === 'default' || fileChannelName.toLowerCase() === 'mixed') : 
          (fileChannelName === selectedfolderName.value || 
           (fileChannelName && fileChannelName.toLowerCase() === selectedfolderName.value.toLowerCase()));
        
        // Debug logging for ALL videos (not just ones with streamKey) to see what's being filtered
        console.log(`🔍 [managefiles] Checking video for ${selectedfolderName.value}:`, {
          fileName: file.fileName,
          streamKey: file.streamKey || 'MISSING',
          folderName: file.folderName || 'MISSING',
          seriesName: file.seriesName || 'MISSING',
          fileChannelName: fileChannelName || 'MISSING',
          selectedfolderName: selectedfolderName.value,
          hasHlsUrl: !!hasHlsUrl,
          hasStreamKey: !!hasStreamKey,
          isVisible: isVisible,
          hasValidThumbnail: hasValidThumbnail,
          folderMatch: folderMatch,
          hlsUrl: file.hlsUrl || 'MISSING',
          isCollaboratorVideo: file.isCollaboratorVideo,
          category: file.category
        });
        
        // Show collaborator videos with special handling
        if (file.isCollaboratorVideo) {
          // CRITICAL: Filter by invalid usernames to match mobile app behavior
          // Note: "dehyuusername" is a valid username for dehyubuilds@gmail.com
          const invalidUsernames = ['googoogaga', 'yess'];
          const hasInvalidUsername = file.creatorUsername && invalidUsernames.includes(file.creatorUsername.toLowerCase());
          
          if (hasInvalidUsername) {
            console.log(`🚫 [managefiles] Filtering out collaborator video with invalid username '${file.creatorUsername}':`, {
              fileName: file.fileName,
              creatorUsername: file.creatorUsername
            });
            return false;
          }
          
          // CRITICAL: Match mobile app filtering - require isVisible === true and valid thumbnail
          const shouldShow = hasHlsUrl && hasStreamKey && isVisible && hasValidThumbnail && folderMatch;
          if (!shouldShow) {
            console.log(`🚫 [managefiles] Filtering out collaborator video:`, {
              fileName: file.fileName,
              reason: !hasHlsUrl ? 'no hlsUrl' : !hasStreamKey ? 'no streamKey' : !isVisible ? 'not visible' : !hasValidThumbnail ? 'no valid thumbnail' : !folderMatch ? `folder mismatch (${fileChannelName} vs ${selectedfolderName.value})` : 'unknown'
            });
          }
          return shouldShow;
        }
        
        // Show regular videos - must have both hlsUrl and streamKey
        // CRITICAL: Also filter by invalid usernames to match mobile app behavior
        // Note: "dehyuusername" is a valid username for dehyubuilds@gmail.com
        const invalidUsernames = ['googoogaga', 'yess'];
        const hasInvalidUsername = file.creatorUsername && invalidUsernames.includes(file.creatorUsername.toLowerCase());
        
        if (hasInvalidUsername) {
          console.log(`🚫 [managefiles] Filtering out video with invalid username '${file.creatorUsername}':`, {
            fileName: file.fileName,
            creatorUsername: file.creatorUsername
          });
          return false;
        }
        
        // CRITICAL: Match mobile app filtering - require isVisible === true and valid thumbnail
        const shouldShow = hasHlsUrl && hasStreamKey && isVisible && hasValidThumbnail && folderMatch;
        if (!shouldShow) {
          console.log(`🚫 [managefiles] Filtering out video:`, {
            fileName: file.fileName,
            reason: !hasHlsUrl ? 'no hlsUrl' : !hasStreamKey ? 'no streamKey' : !isVisible ? 'not visible' : !hasValidThumbnail ? 'no valid thumbnail' : !folderMatch ? `folder mismatch (${fileChannelName} vs ${selectedfolderName.value})` : 'unknown'
          });
        }
        return shouldShow;
      }
      
      // For PDFs and other files, show in default folder if no folderName/seriesName or is 'default' or 'mixed'
      // Match by folderName OR seriesName (files can be saved with either)
      const fileChannelName = file.folderName || file.seriesName;
      if (selectedfolderName.value === 'default') {
        return !fileChannelName || 
               fileChannelName === 'default' || 
               fileChannelName.toLowerCase() === 'mixed';
      }
      
      return fileChannelName === selectedfolderName.value;
    })
    // Deduplicate by SK
    .filter(file => {
      if (seen.has(file.SK)) return false;
      seen.add(file.SK);
      return true;
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));



  return filtered;
});

const getDefaultPreview = (category) => {
  // Use relative URLs or production URLs instead of localhost
  const baseUrl = window.location.origin;
  
  switch(category) {
    case 'Videos':
      return `${baseUrl}/menu/share/e392bb8e-7f2a-4fc5-a96d-87544ecb3f34/DehCollective/public%2Fseries-posters%2Fdehyu.sinyan%40gmail.com%2FDehCollective%2FDsinyanGivzey.jpeg?title=DehCollective&description=DehCollective`;
    case 'Images':
      return `${baseUrl}/menu/share/e392bb8e-7f2a-4fc5-a96d-87544ecb3f34/DehCollective/public%2Fseries-posters%2Fdehyu.sinyan%40gmail.com%2FDehCollective%2FDsinyanGivzey.jpeg?title=DehCollective&description=DehCollective`;
    case 'Audios':
      return 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExdXpsZDJlMmZ2aW5sYnptMW1hYzlxN2I4NmI2anV0MGk1ZnM0bmcyeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/4oMoIbIQrvCjm/giphy.gif';
    case 'Docs':
      return 'https://theprivatecollection.s3.us-east-2.amazonaws.com/pdf.png';
    default:
      return `${baseUrl}/menu/share/e392bb8e-7f2a-4fc5-a96d-87544ecb3f34/DehCollective/public%2Fseries-posters%2Fdehyu.sinyan%40gmail.com%2FDehCollective%2FDsinyanGivzey.jpeg?title=DehCollective&description=DehCollective`;
  }
};

const getModifiedFileUrl = (url, fileType) => {
  if (!url) return getDefaultPreview(fileType);
  return url;
};

const isExplicitURL = (url) => {
  return url.includes("shesfreaky.com") || url.includes("xnxx");
};

const verifyLoggedIn = async () => {
  try {
    user.value = await Auth.currentAuthenticatedUser();
    return true;
  } catch (error) {
    console.error("Error verifying login:", error);
    return false;
  }
};

const noCoverPreview = ref("");

const orderedFiles = (items) => {
  return items
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

const showActions = (type) => {
  switch (type) {
    case "Image":
      imageLoaded.value = true;
      break;
    case "Video":
      videoLoaded.value = true;
      break;
    case "Audio":
      audioLoaded.value = true;
      break;
    case "Doc":
      docLoaded.value = true;
      break;
    default:
      break;
  }
};

const publicPath = useRuntimeConfig().publicPath || '/';

function replaceS3WithCloudFront(url) {
  if (!url) return "";
  
  if (url.includes("twilly.s3.us-east-1.amazonaws.com")) {
    return url.replace(
      "https://twilly.s3.us-east-1.amazonaws.com",
      twillyCloudFrontUrl
    );
  } else if (url.includes("twillyinputbucket.s3.us-east-1.amazonaws.com")) {
    return url.replace(
      "https://twillyinputbucket.s3.us-east-1.amazonaws.com", 
      inputBucketCloudFrontUrl
    );
  } else if (url.includes("tpccollections.s3.amazonaws.com")) {
    return url.replace(
      "https://tpccollections.s3.amazonaws.com", 
      collectionsCloudFrontBaseUrl
    );
  } else if (url.includes("theprivatecollection.s3.us-east-2.amazonaws.com") || 
             url.includes("theprivatecollection.s3.amazonaws.com")) {
    return url.replace(
      /https:\/\/theprivatecollection\.s3(\.us-east-2)?\.amazonaws\.com/, 
      cloudFrontBaseUrl
    );
  }

  return url;
}

const getVideoThumbnail = (video) => {

  // First check if there's a direct thumbnail URL
  if (video.thumbnailUrl) {
    const processedUrl = replaceS3WithCloudFront(video.thumbnailUrl);
    return processedUrl;
  }
  
  // For stream clips, try to construct thumbnail URL from stream name
  if (video.streamKey && video.category === 'Videos') {
    // Construct thumbnail URL based on stream key pattern
    const thumbnailUrl = `${cloudFrontBaseUrl}/clips/${video.streamKey}/${video.streamKey}_thumb.jpg`;
    return thumbnailUrl;
  }
  
  // For videos with HLS URL, try to construct thumbnail URL
  if (video.hlsUrl && video.category === 'Videos') {
    // Try to extract stream name from HLS URL path
    const hlsUrl = video.hlsUrl;
    if (hlsUrl.includes('/clips/')) {
      // Extract stream name from HLS URL path
      const match = hlsUrl.match(/\/clips\/([^\/]+)\//);
      if (match && match[1]) {
        const streamName = match[1];
        const thumbnailUrl = `${cloudFrontBaseUrl}/clips/${streamName}/${streamName}_thumb.jpg`;
        return thumbnailUrl;
      }
    }
  }
  
  // If no thumbnail found and we have HLS URL, try to generate one
  if (video.hlsUrl && !video.thumbnailUrl) {
    // Trigger thumbnail generation in the background
    generateThumbnailForVideo(video);
  }
  
  return getDefaultPreview('Videos');
};

const getImageUrl = (image) => {
  // Use preview URL for display, fallback to original URL
  const displayUrl = image.previewUrl || image.url;
  return replaceS3WithCloudFront(displayUrl);
};

const handleThumbnailError = (event) => {
  
  // Try to generate thumbnail if this is a video
  const videoElement = event.target;
  const videoCard = videoElement.closest('[data-video-file]');
  if (videoCard) {
    const fileId = videoCard.getAttribute('data-video-file');
    
    const video = files.value.find(f => f.SK === fileId);
    if (video) {
      
      // Try to refresh files to get updated thumbnail URL
      if (authStore.user?.attributes?.email) {
        fileStore.getFiles(authStore.user.attributes.email);
      }
    }
  }
  
  // Fall back to default image
  event.target.src = getDefaultPreview('Videos');
};

const handleImageError = (event) => {
  event.target.src = getDefaultPreview('Images');
};

// Function to generate thumbnail for video
// Note: Thumbnails are generated on the EC2 server during stream processing
// This function is kept for compatibility but doesn't make API calls
const generateThumbnailForVideo = async (video) => {
  try {
    if (!authStore.user?.attributes?.email) return;
    
    const userEmail = authStore.user.attributes.email;
    

    
    // Refresh the file list to check if thumbnail URL has been updated
    await fileStore.getFiles(userEmail);
    
  } catch (error) {
    console.error('Error refreshing files for thumbnail:', error);
  }
};

const playVideo = (video) => {
  if (video.status === 'PROCESSING') {
    return;
  }
  
  if (!video.hlsUrl) {
    return;
  }

  // Detect mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Create modal for video player
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black flex items-center justify-center z-50';
  
  // Create video container with explicit dimensions to prevent black screen
  const videoContainer = document.createElement('div');
  if (isMobile) {
    videoContainer.style.cssText = 'position: relative; width: 100vw; height: 90vh; min-height: 300px; display: flex; align-items: center; justify-content: center; background: #000;';
  } else {
    videoContainer.style.cssText = 'position: relative; width: 90vw; max-width: 1280px; height: auto; min-height: 400px; max-height: 80vh; margin: 0 auto; display: flex; align-items: center; justify-content: center; background: #000;';
  }
  
  // Create close button with mobile-optimized positioning
  const closeButton = document.createElement('button');
  if (isMobile) {
    closeButton.className = 'absolute top-4 right-4 text-white z-10 p-3 bg-black/70 rounded-full border border-white/30';
    closeButton.style.minWidth = '44px';
    closeButton.style.minHeight = '44px';
  } else {
    closeButton.className = 'absolute -top-10 right-0 text-white hover:text-teal-400 z-10';
  }
  closeButton.innerHTML = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
  
  // Create video element
  const videoElement = document.createElement('video');
  videoElement.className = 'video-js vjs-big-play-centered vjs-fluid';
  videoElement.id = 'my-video';
  videoElement.crossOrigin = 'anonymous';
  
  // Mobile-specific video element styling
  if (isMobile) {
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.maxHeight = '100vh';
    videoElement.style.objectFit = 'contain';
  } else {
    videoElement.style.maxHeight = '80vh';
  }
  
  videoContainer.appendChild(closeButton);
  videoContainer.appendChild(videoElement);
  modal.appendChild(videoContainer);
  document.body.appendChild(modal);

  // Initialize video.js - DON'T use fluid mode (it forces 16:9 aspect ratio)
  const playerOptions = {
    controls: true,
    fluid: false, // Disable fluid to handle portrait/landscape properly
    responsive: false, // We'll handle sizing manually
    playbackRates: [0.5, 1, 1.5, 2],
    playsinline: true, // Important for mobile
    html5: {
      vhs: {
        enableLowInitialPlaylist: true,
        overrideNative: true,
        withCredentials: false
      }
    }
  };

  // Add mobile-specific options
  if (isMobile) {
    playerOptions.controlBar = {
      children: [
        'playToggle',
        'volumePanel',
        'currentTimeDisplay',
        'timeDivider',
        'durationDisplay',
        'progressControl',
        'fullscreenToggle'
      ]
    };
    playerOptions.userActions = {
      hotkeys: true
    };
  }

  const player = videojs('my-video', playerOptions);

  // Set up player container - initial dimensions
  const playerEl = player.el();
  playerEl.style.backgroundColor = '#000';
  playerEl.style.borderRadius = '8px';
  playerEl.style.overflow = 'hidden';
  playerEl.style.position = 'relative';
  
  // Initial sizing - will be adjusted when video metadata loads
  if (isMobile) {
    playerEl.style.width = '100vw';
    playerEl.style.height = 'auto';
    playerEl.style.minHeight = '300px';
    playerEl.style.maxHeight = '90vh';
  } else {
    playerEl.style.width = 'auto';
    playerEl.style.maxWidth = '1280px';
    playerEl.style.height = 'auto';
    playerEl.style.minHeight = '400px';
    playerEl.style.maxHeight = '80vh';
  }
  
  // Function to set video dimensions based on aspect ratio
  const setVideoDimensions = () => {
    const videoWidth = player.videoWidth();
    const videoHeight = player.videoHeight();
    
    if (!videoWidth || !videoHeight) {
      return; // Wait for metadata
    }
    
    const ratio = videoWidth / videoHeight;
    const isPortrait = ratio < 1;
    
    console.log('Video dimensions:', { videoWidth, videoHeight, ratio, isPortrait });
    
    // Apply object-fit: contain to video elements (critical for preventing stretch)
    const videoTech = playerEl.querySelector('.vjs-tech');
    const videoElement = playerEl.querySelector('video');
    const videoWrapper = playerEl.querySelector('.vjs-tech-wrapper') || playerEl;
    
    // Force video.js to not use its default sizing
    playerEl.style.paddingTop = '0';
    playerEl.style.paddingBottom = '0';
    playerEl.classList.remove('vjs-fluid');
    
    if (videoTech) {
      videoTech.style.objectFit = 'contain';
      videoTech.style.width = '100%';
      videoTech.style.height = '100%';
      videoTech.style.position = 'absolute';
      videoTech.style.top = '0';
      videoTech.style.left = '0';
      videoTech.style.margin = '0';
      videoTech.style.padding = '0';
    }
    
    if (videoElement) {
      videoElement.style.objectFit = 'contain';
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.margin = '0';
      videoElement.style.padding = '0';
    }
    
    // Calculate and set container dimensions based on orientation
    if (isPortrait) {
      // Portrait video - use full screen height like landscape uses full width
      if (isMobile) {
        // On mobile, use most of the viewport height for portrait videos (similar to how landscape uses full width)
        const containerHeight = window.innerHeight * 0.9; // 90vh for mobile - almost full screen
        const calculatedWidth = (videoWidth / videoHeight) * containerHeight;
        playerEl.style.width = `${calculatedWidth}px`;
        playerEl.style.maxWidth = '100vw';
        playerEl.style.height = `${containerHeight}px`;
        playerEl.style.maxHeight = '90vh';
        playerEl.style.margin = '0 auto';
      } else {
        const containerHeight = Math.min(window.innerHeight * 0.8, 720); // Max 720px height for portrait
        const calculatedWidth = (videoWidth / videoHeight) * containerHeight;
        playerEl.style.width = `${calculatedWidth}px`;
        playerEl.style.maxWidth = '90vw';
        playerEl.style.height = `${containerHeight}px`;
        playerEl.style.maxHeight = '80vh';
        playerEl.style.margin = '0 auto';
      }
      playerEl.style.aspectRatio = `${videoWidth} / ${videoHeight}`;
      
      console.log('Set portrait dimensions:', { calculatedWidth: playerEl.style.width, calculatedHeight: playerEl.style.height });
    } else {
      // Landscape video
      if (isMobile) {
        const containerWidth = window.innerWidth;
        const calculatedHeight = (videoHeight / videoWidth) * containerWidth;
        playerEl.style.width = `${containerWidth}px`;
        playerEl.style.maxWidth = '100vw';
        playerEl.style.height = `${calculatedHeight}px`;
        playerEl.style.maxHeight = '80vh';
        playerEl.style.margin = '0';
      } else {
        const containerWidth = Math.min(1280, window.innerWidth * 0.9);
        const calculatedHeight = (videoHeight / videoWidth) * containerWidth;
        playerEl.style.width = `${containerWidth}px`;
        playerEl.style.maxWidth = '1280px';
        playerEl.style.height = `${calculatedHeight}px`;
        playerEl.style.maxHeight = '80vh';
        playerEl.style.margin = '0 auto';
      }
      playerEl.style.aspectRatio = `${videoWidth} / ${videoHeight}`;
    }
    
    // Force video.js to respect our dimensions
    player.dimensions(playerEl.offsetWidth, playerEl.offsetHeight);
  };
  
  // Ensure video respects aspect ratio and doesn't stretch
  player.ready(() => {
    // Remove fluid class and any padding it might add
    playerEl.classList.remove('vjs-fluid');
    
    // Apply object-fit immediately
    const applyObjectFit = () => {
      const videoTech = playerEl.querySelector('.vjs-tech');
      const videoElement = playerEl.querySelector('video');
      
      if (videoTech) {
        videoTech.style.objectFit = 'contain';
        videoTech.style.width = '100%';
        videoTech.style.height = '100%';
        videoTech.style.position = 'absolute';
        videoTech.style.top = '0';
        videoTech.style.left = '0';
      }
      
      if (videoElement) {
        videoElement.style.objectFit = 'contain';
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
      }
    };
    
    applyObjectFit();
    
    // Set dimensions when metadata loads
    player.on('loadedmetadata', () => {
      applyObjectFit();
      setVideoDimensions();
      player.trigger('resize');
    });
    
    // Also try on loadeddata in case loadedmetadata fires too early
    player.on('loadeddata', () => {
      applyObjectFit();
      setVideoDimensions();
      player.trigger('resize');
    });
    
    // Apply on resize to maintain aspect ratio
    player.on('resize', () => {
      applyObjectFit();
      setVideoDimensions();
    });
  });
  
  // Load the HLS source
  const hlsUrl = replaceS3WithCloudFront(video.hlsUrl);
  player.src({
    src: hlsUrl,
    type: 'application/x-mpegURL'
  });

  // Add mobile-specific event handlers
  if (isMobile) {
    // Prevent default touch behaviors that might interfere with video controls
    playerEl.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    }, { passive: false });
    
    // Handle orientation changes
    const handleOrientationChange = () => {
      setTimeout(() => {
        player.trigger('resize');
      }, 100);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Clean up orientation listener
    const cleanupOrientation = () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }

  // Handle closing
  const cleanup = () => {
    if (typeof cleanupOrientation === 'function') {
      cleanupOrientation();
    }
    player.dispose();
    document.body.removeChild(modal);
  };

  // Close button click
  closeButton.onclick = (e) => {
    e.stopPropagation();
    cleanup();
  };

  // Tap outside to close (mobile-friendly)
  modal.onclick = (e) => {
    if (e.target === modal) {
      cleanup();
    }
  };

  // Add escape key support
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      cleanup();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
};

const viewVideoInBrowser = (video) => {
  if (!video.hlsUrl) {
    alert('No video URL available for viewing');
    return;
  }

  // Open video in new tab for mobile viewing
  const videoUrl = replaceS3WithCloudFront(video.hlsUrl);
  const link = document.createElement('a');
  link.href = videoUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  successMessage.value = 'Video opened in browser for viewing.';
  showSuccessNotification.value = true;
  setTimeout(() => {
    showSuccessNotification.value = false;
  }, 3000);
};

const deleteFile = async (file) => {
  // Check if this is a collaborator video and add restrictions
  if (file.isCollaboratorVideo && !authStore.canAccessManagefiles()) {
    alert('This is a collaborator video. Only the master account can delete videos. Please contact the channel owner to delete this video.');
    return;
  }

  // Add confirmation dialog
  if (!confirm(`Are you sure you want to delete "${file.fileName}"? This action cannot be undone.`)) {
    return;
  }
  
  // Add loading state
  const loadingState = ref(true);
  
  try {
    if (!authStore.authenticated || !authStore.user?.attributes?.email) {
      throw new Error('Please sign in to delete files');
    }

    // Validate file object
    if (!file || !file.SK || !file.fileName) {
      throw new Error('Invalid file data. Missing required properties.');
    }

    const userEmail = authStore.user.attributes.email;
    


    const requestBody = {
      userId: userEmail,
      fileId: file.SK,
      fileName: file.fileName,
      folderName: file.folderName || file.seriesName // Handle both naming schemes
    };



    const response = await $fetch('/api/files/delete', {
      method: 'POST',
      body: requestBody,
      headers: {
        'Content-Type': 'application/json'
      }
    });



    if (response.success) {
      // Update local store
      fileStore.removeFile(file.SK);
      // Refresh file list using fileStore.getFiles
      await fileStore.getFiles(userEmail);
    } else {
      throw new Error(response.message || 'Failed to delete file');
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      data: error.data
    });
    alert(error.message || 'Failed to delete file');
  } finally {
    loadingState.value = false;
  }
};

const showAirdatePicker = (file) => {
  // Check if this is a collaborator video and add restrictions
  if (file.isCollaboratorVideo && !authStore.canAccessManagefiles()) {
    alert('This is a collaborator video. Only the master account can schedule airdates. Please contact the channel owner to schedule this video.');
    return;
  }

  selectedFile.value = file;
  showAirdateModal.value = true;
};

const handleAirdateScheduled = async (data) => {
  if (data.immediate) {
    successMessage.value = 'Episode made visible immediately!';
  } else {
    successMessage.value = 'Airdate scheduled successfully!';
  }
  
  showSuccessNotification.value = true;
  setTimeout(() => {
    showSuccessNotification.value = false;
  }, 3000);
  
  // Refresh files to show updated status
  if (authStore.user?.attributes?.email) {
    await fileStore.getFiles(authStore.user.attributes.email);
  }
};

// Polling mechanism for Step Function updates
let pollingInterval = null;

const startPollingForUpdates = () => {
  // Clear any existing interval
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  // Poll every 30 seconds to check for Step Function updates
  pollingInterval = setInterval(async () => {
    if (authStore.user?.attributes?.email) {
      await fileStore.getFiles(authStore.user.attributes.email);
      
      // Check if any scheduled files have become visible
      const scheduledFiles = fileStore.files.filter(f => f.airdate && !f.isVisible);
      const now = new Date();
      
      scheduledFiles.forEach(file => {
        const airdate = new Date(file.airdate);
        if (airdate <= now) {
          console.log('Found scheduled file that should be visible:', file.fileName);
          // The file should be visible now, but the Step Function might not have run yet
          // We'll let the next poll catch the update
        }
      });
    }
  }, 30000); // 30 seconds
};

const stopPollingForUpdates = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
};

// Initialize auth state on mount
onMounted(async () => {
  try {
    console.log('🔍 managefiles: onMounted started');
    console.log('🔍 managefiles: authStore.authenticated:', authStore.authenticated);
    console.log('🔍 managefiles: authStore.user:', authStore.user);
    
    // First check if we already have auth state
    if (authStore.authenticated && authStore.user) {
      console.log('🔍 managefiles: Using existing auth state');
      
      // Check if user can access managefiles (Master account only)
      if (!authStore.canAccessManagefiles()) {
        console.log('🔍 managefiles: User is not a master account, redirecting to profile');
        await navigateTo('/profile');
        return;
      }
      
      user.value = authStore.user;
      // Always load files from master account for managefiles (single source of truth)
      currentUser.value = 'dehyu.sinyan@gmail.com';
      console.log('🔍 managefiles: Loading files for master account:', currentUser.value);
      
      await fileStore.getFiles(currentUser.value);
      console.log('🔍 managefiles: Files loaded, folders count:', fileStore.folders?.length);
      console.log('🔍 managefiles: Folders:', fileStore.folders);
      console.log('🔍 managefiles: Total files loaded:', fileStore.files?.length);
      console.log('🔍 managefiles: First 5 files:', fileStore.files?.slice(0, 5));
      console.log('🔍 managefiles: Videos count:', fileStore.files?.filter(f => f.category === 'Videos').length);
      
      // Start polling for Step Function updates
      startPollingForUpdates();
      
      // Fetch username with fallbacks
      try {
        currentUsername.value = await getUsernameWithFallbacks();
        console.log('🔍 managefiles: Username set to:', currentUsername.value);
      } catch (error) {
        console.error('Error fetching username in managefiles, continuing without it:', error);
        currentUsername.value = '';
      }
      
      // Detect user roles (collaborator, casting director, etc.)
      try {
        await detectUserRoles();
        console.log('🔍 managefiles: User roles detected:', userRoles.value);
      } catch (error) {
        console.error('Error detecting user roles in managefiles, continuing without role detection:', error);
      }
      
      // Load stream keys for the selected folder
      if (selectedfolderName.value && selectedfolderName.value !== 'default' && selectedfolderName.value !== 'thumbnails') {
        await loadStreamKeys();
      }
      
      // Load current active invite code for selected channel
      if (selectedfolderName.value && selectedfolderName.value !== 'default' && selectedfolderName.value !== 'thumbnails') {
        await fetchActiveChannelInviteCode(selectedfolderName.value);
      }
      
      // Debug: Log file data to check for inconsistencies
      const visibleFiles = fileStore.files.filter(f => f.isVisible === true);
      const scheduledFiles = fileStore.files.filter(f => f.airdate && !f.isVisible);
      
      isLoading.value = false;
      return;
    }

    // If no auth state, try to get from AWS
    const cognitoUser = await Auth.currentAuthenticatedUser();
    if (cognitoUser) {

      // Check if user has email in attributes or username
      const isProducer = cognitoUser?.attributes?.email || cognitoUser?.username?.includes('@');
      if (isProducer) {
        authStore.authenticated = true;
        authStore.user = cognitoUser;
        authStore.userType = 'producer';

        // Check if user can access managefiles (Master account only)
        if (!authStore.canAccessManagefiles()) {
          console.log('🔍 managefiles: User is not a master account, redirecting to profile');
          await navigateTo('/profile');
          return;
        }

        user.value = cognitoUser;
        // Always load files from master account for managefiles (single source of truth)
        currentUser.value = 'dehyu.sinyan@gmail.com';
        await fileStore.getFiles(currentUser.value);
        
        // Start polling for Step Function updates
        startPollingForUpdates();
        
        // Fetch username with fallbacks
        try {
          currentUsername.value = await getUsernameWithFallbacks();
        } catch (error) {
          console.error('Error fetching username in managefiles, continuing without it:', error);
          currentUsername.value = '';
        }
      } else {
        authStore.authenticated = true;
        authStore.user = cognitoUser;
        authStore.userType = 'regular';

        navigateTo('/profile');
      }
    } else {
      // If no AWS user, try to initialize from localStorage
      console.log('🔍 managefiles: Trying to initialize from localStorage');
      await authStore.initializeAuth();
      console.log('🔍 managefiles: After initializeAuth - authenticated:', authStore.authenticated, 'user:', authStore.user);
      
      if (authStore.authenticated && authStore.user) {
        console.log('🔍 managefiles: Using localStorage auth state');
        user.value = authStore.user;
        // Always load files from master account for managefiles (single source of truth)
        currentUser.value = 'dehyu.sinyan@gmail.com';
        console.log('🔍 managefiles: Loading files for master account:', currentUser.value);
        
        await fileStore.getFiles(currentUser.value);
        console.log('🔍 managefiles: Files loaded, folders count:', fileStore.folders?.length);
        console.log('🔍 managefiles: Folders:', fileStore.folders);
        
        // Debug: Check what files were loaded
        debugFiles();
        
        // Start polling for Step Function updates
        startPollingForUpdates();
        
        // Fetch username with fallbacks
        try {
          currentUsername.value = await getUsernameWithFallbacks();
        } catch (error) {
          console.error('Error fetching username in managefiles, continuing without it:', error);
          currentUsername.value = '';
        }
      }
    }
  } catch (error) {

    // Try to initialize from localStorage
    await authStore.initializeAuth();
    if (authStore.authenticated && authStore.user) {
      user.value = authStore.user;
      currentUser.value = user.value.attributes.email;
      await fileStore.getFiles(currentUser.value);
      
      // Start polling for Step Function updates
      startPollingForUpdates();
      
      // Fetch username with fallbacks
      try {
        currentUsername.value = await getUsernameWithFallbacks();
      } catch (error) {
        console.error('Error fetching username in managefiles, continuing without it:', error);
        currentUsername.value = '';
      }
    }
  } finally {
    isLoading.value = false;
  }
});





// Check if airdate is in the future
const isAirdateInFuture = (airdate) => {
  if (!airdate) return false;
  const now = new Date();
  const airdateTime = new Date(airdate);
  return airdateTime > now;
};

// Debug function to check file data
const debugFiles = () => {
  console.log('=== DEBUG FILES ===');
  console.log('Total files loaded:', fileStore.files.length);
  console.log('All files with visibility:');
  fileStore.files.forEach((file, index) => {
    console.log(`File ${index}:`, {
      fileName: file.fileName,
      SK: file.SK,
      isVisible: file.isVisible,
      isVisibleType: typeof file.isVisible,
      airdate: file.airdate,
      folderName: file.folderName
    });
  });
  
  const visibleFiles = fileStore.files.filter(f => f.isVisible === true);
  const scheduledFiles = fileStore.files.filter(f => f.airdate && !f.isVisible);
  
  console.log('Visible files:', visibleFiles.length);
  console.log('Scheduled files:', scheduledFiles.length);
  console.log('=== END DEBUG ===');
};

// Watch for auth state changes
watch(() => authStore.authenticated, (newVal) => {
  if (!newVal && !isLoading.value) {
    // Only redirect if we're sure the user is not authenticated
    navigateTo('/home');
  }
}, { immediate: true });

// Watch for folder changes to load stream keys
watch(selectedfolderName, async (newFolderName) => {
      // Load invite code for the newly selected channel
      if (newFolderName && newFolderName !== 'default' && newFolderName !== 'thumbnails') {
        await fetchActiveChannelInviteCode(newFolderName);
      }
  if (newFolderName && authStore.authenticated) {
    // Clear the shareable link when switching channels
    shareableLink.value = '';
    linkCopied.value = false;
    
    await loadStreamKeys();
    if (newFolderName !== 'default' && newFolderName !== 'thumbnails') {
      await getChannelSubscriptionPrice();
      // Load channel talent requests
      await loadChannelTalentRequests();
    } else {
      channelSubscriptionPrice.value = 9.99;
      newSubscriptionPrice.value = '';
    }
  }
});

// Watch for activeTab changes to load stream keys when switching to streaming tab
watch(activeTab, async (newTab) => {

  
  // Load stream keys when switching to streaming tab
  if (newTab === 'streaming' && selectedfolderName.value && 
      selectedfolderName.value !== 'default' && selectedfolderName.value !== 'thumbnails' && 
      authStore.authenticated) {

    await loadStreamKeys();
  }
});

// Add a more detailed auth state watcher
watch(() => authStore.authenticated, (newVal, oldVal) => {
  if (!process.client) return;
  
  // Only log if this isn't the initial setup
  if (oldVal !== undefined) {

  }
  
  if (newVal && authStore.user) {
    user.value = authStore.user;
    currentUser.value = user.value.attributes.email;
  }
}, { immediate: true });

const updateMenuPosterUrl = debounce((newFolderName) => {
  if (!newFolderName || !fileStore.folders?.value) return;
  
  // Search for folder across all categories
  const folderWithPoster = fileStore.folders.value.find(
    (folder) => {
      if (!folder?.SK) return false;
      // Check if the folder name matches, regardless of category
      const folderName = folder.SK.split('#').pop();
      return folderName === newFolderName;
    }
  );
  
  menuPosterUrl.value =
    folderWithPoster?.MenuPoster ||
    "https://theprivatecollection.s3.us-east-2.amazonaws.com/0731.gif";
}, 300);

watch(selectedfolderName, (newFolderName) => {
  updateMenuPosterUrl(newFolderName);
  loadCurrentTrailer();
});

const getFileUrl = (file) => {
  switch (file.category) {
    case 'Videos':
      return replaceS3WithCloudFront(file.hlsUrl);
    case 'Images':
      // For full-size image viewing, use original URL
      return replaceS3WithCloudFront(file.url);
    default:
      return replaceS3WithCloudFront(file.url);
  }
};

const getAudioUrl = (audio) => {
  return replaceS3WithCloudFront(audio.url);
};

const decodeFileName = (fileName) => {
  if (!fileName) return '';
  return decodeURIComponent(fileName.replace(/\+/g, ' '));
};

const downloadAudio = (audio) => {
  const url = getAudioUrl(audio);
  const link = document.createElement('a');
  link.href = url;
  link.download = decodeFileName(audio.fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const getDocUrl = (doc) => {
  return replaceS3WithCloudFront(doc.url);
};

const downloadDoc = (doc) => {
  const url = getDocUrl(doc);
  const link = document.createElement('a');
  link.href = url;
  link.download = decodeFileName(doc.fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const viewDoc = (doc) => {
  const url = getDocUrl(doc);
  window.open(url, '_blank');
};

const toggleSelectAll = () => {
  if (!filteredFiles.value || filteredFiles.value.length === 0) {
    return;
  }

  if (isAllSelected.value) {
    selectedFiles.value.clear();
  } else {
    filteredFiles.value.forEach(file => {
      if (file && file.SK) {
        selectedFiles.value.add(file.SK);
      }
    });
  }
};

// Trailer management functions
const selectedTrailerPreview = ref(null);

const handleTrailerFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    selectedTrailerFile.value = file;
    console.log('Selected trailer file:', file.name, file.type, file.size);
    
    // Create preview URL for the selected file
    if (selectedTrailerPreview.value) {
      URL.revokeObjectURL(selectedTrailerPreview.value);
    }
    selectedTrailerPreview.value = URL.createObjectURL(file);
  }
};

const uploadTrailer = async () => {
  if (!selectedTrailerFile.value || !authStore.user?.attributes?.email || !selectedfolderName.value) {
    alert('Please select a channel first');
    return;
  }
  
  try {
    isUploadingTrailer.value = true;
    uploadProgress.value = 0;
    
    const userEmail = authStore.user.attributes.email;
    const channelName = selectedfolderName.value;
    const creatorUsername = authStore.user.username || 'Unknown';
    
    // Step 1: Get presigned URL from the collaborations API (same as talent requests)
    const presignResponse = await $fetch('/api/collaborations/get-s3-presigned-url', {
      method: 'POST',
      body: {
        filename: selectedTrailerFile.value.name,
        contentType: selectedTrailerFile.value.type,
        creatorUsername: creatorUsername
      }
    });
    
    if (!presignResponse.success) {
      throw new Error(presignResponse.message || 'Failed to get upload URL');
    }
    
    uploadProgress.value = 25;
    
    // Step 2: Upload file directly to S3 using presigned URL
    const uploadResponse = await fetch(presignResponse.url, {
      method: 'PUT',
      body: selectedTrailerFile.value,
      headers: {
        'Content-Type': selectedTrailerFile.value.type
      }
    });
    
    if (!uploadResponse.ok) {
      throw new Error('Upload failed');
    }
    
    uploadProgress.value = 75;
    
    // Step 3: Generate CloudFront URL (same pattern as talent requests)
    const cloudFrontUrl = `https://d3hv50jkrzkiyh.cloudfront.net/${presignResponse.key}`;
    
    // Step 4: Update folder with trailer URL
    await updateFolderTrailer(cloudFrontUrl, channelName);
    
    uploadProgress.value = 100;
    
    // Update local state
    currentTrailerUrl.value = cloudFrontUrl;
    selectedTrailerFile.value = null;
    
    // Clear preview
    if (selectedTrailerPreview.value) {
      URL.revokeObjectURL(selectedTrailerPreview.value);
      selectedTrailerPreview.value = null;
    }
    
    // Reset file input
    if (document.querySelector('input[type="file"]')) {
      document.querySelector('input[type="file"]').value = '';
    }
    
    // Refresh fileStore data to ensure persistence
    await fileStore.getFiles(userEmail);
    
    console.log('Trailer uploaded successfully:', cloudFrontUrl);
    
    // Show success message
    alert(`Trailer uploaded successfully for channel "${channelName}"!`);
    
  } catch (error) {
    console.error('Error uploading trailer:', error);
    alert('Failed to upload trailer: ' + error.message);
  } finally {
    isUploadingTrailer.value = false;
    uploadProgress.value = 0;
  }
};

const updateFolderTrailer = async (trailerUrl, channelName = null) => {
  const folderName = channelName || selectedfolderName.value;
  if (!authStore.user?.attributes?.email || !folderName) return;
  
  try {
    const userEmail = authStore.user.attributes.email;
    
    // Get existing folder data to preserve poster URL
    const folderData = fileStore.folders.find(f => f.name === folderName);
    let existingPosterUrl = folderData?.seriesPosterUrl || '';
    
    // If no poster URL found, use the standard pattern
    if (!existingPosterUrl) {
      existingPosterUrl = `https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/${userEmail}/${folderName}/1.png`;
    }
    
    // Update folder record with trailer URL while preserving poster URL
    await $fetch('/api/folders/updateMetadata', {
      method: 'POST',
      body: {
        userId: userEmail,
        folderName: folderName,
        metadata: {
          seriesPosterUrl: existingPosterUrl
        },
        trailerUrl: trailerUrl
      }
    });
    
    // Also update series metadata with trailer URL (without changing description)
    try {
      const seriesId = `${userEmail}-${folderName}`;
      await $fetch('/api/creators/update-description', {
        method: 'POST',
        body: {
          username: authStore.user.username || 'Unknown',
          series: folderName,
          description: null, // Don't change the description
          trailerUrl: trailerUrl
        }
      });
    } catch (error) {
      console.error('Error updating series metadata:', error);
      // Don't throw - this is not critical
    }
    
    console.log('Trailer URL updated successfully');
    
  } catch (error) {
    console.error('Error updating trailer URL:', error);
    throw error;
  }
};

const removeTrailer = async () => {
  if (!confirm('Are you sure you want to remove this trailer?')) return;
  
  try {
    await updateFolderTrailer(null, selectedfolderName.value);
    currentTrailerUrl.value = null;
    
    // Refresh fileStore data to ensure persistence
    if (authStore.user?.attributes?.email) {
      await fileStore.getFiles(authStore.user.attributes.email);
    }
    
    console.log('Trailer removed successfully');
  } catch (error) {
    console.error('Error removing trailer:', error);
    alert('Failed to remove trailer: ' + error.message);
  }
};

const loadCurrentTrailer = async () => {
  if (!authStore.user?.attributes?.email || !selectedfolderName.value) return;
  
  try {
    const userEmail = authStore.user.attributes.email;
    const folderName = selectedfolderName.value;
    
    // Get folder data to check for trailer URL
    const folderData = fileStore.folders.find(f => f.name === folderName);
    if (folderData && folderData.trailerUrl) {
      currentTrailerUrl.value = folderData.trailerUrl;
    } else {
      currentTrailerUrl.value = null;
    }
  } catch (error) {
    console.error('Error loading current trailer:', error);
  }
};

const clearSelectedTrailer = () => {
  selectedTrailerFile.value = null;
  if (selectedTrailerPreview.value) {
    URL.revokeObjectURL(selectedTrailerPreview.value);
    selectedTrailerPreview.value = null;
  }
  // Reset file input
  if (document.querySelector('input[type="file"]')) {
    document.querySelector('input[type="file"]').value = '';
  }
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const showNewFolderModal = ref(false);
const newFolderName = ref('');
const newFolderTrailerUrl = ref('');
const targetFolder = ref('');
const showMoveSuccess = ref(false);
const selectedName = ref('');

// Trailer management variables
const currentTrailerUrl = ref(null);
const selectedTrailerFile = ref(null);
const isUploadingTrailer = ref(false);
const uploadProgress = ref(0);

const createNewFolder = async () => {
  if (!newFolderName.value) return;
  
  try {
    // Check auth state first
    if (!authStore.authenticated || !authStore.user) {
      throw new Error('Please sign in to create a menu');
    }

    const user = authStore.user;
    if (!user?.attributes?.email) {
      throw new Error('User email not found');
    }



    // Create folder with Mixed category and old format SK
    await fileStore.createFolder(
      user.attributes.email, 
      newFolderName.value,
      'Mixed',  // Set category to Mixed
      newFolderTrailerUrl.value || null  // Pass trailer URL
    );


    await fileStore.getFiles(user.attributes.email);
    showNewFolderModal.value = false;
    newFolderName.value = '';
    newFolderTrailerUrl.value = '';
  } catch (error) {
    console.error('Error creating menu:', {
      error,
      message: error.message,
      stack: error.stack
    });
    alert('Failed to create menu: ' + (error.message || 'Please sign in to create a menu'));
  }
};

const moveSelectedFiles = async () => {


  if (selectedFiles.value.size === 0) {
    alert('Please select files to move');
    return;
  }

  if (!targetFolder.value) {
    alert('Please select a target folder');
    return;
  }

  if (!authStore.authenticated || !authStore.user?.attributes?.email) {
    alert('Please sign in to move files');
    return;
  }

  const userEmail = authStore.user.attributes.email;
  const selectedCount = selectedFiles.value.size;
  const targetFolderName = targetFolder.value; // Store the target folder name
  

  
  if (!confirm(`Are you sure you want to move ${selectedCount} file(s) to "${targetFolderName}"?`)) {
    return;
  }

  isMovingFiles.value = true;
  moveProgress.value = { current: 0, total: selectedCount };

  try {
    const filesToMove = Array.from(selectedFiles.value);
    


    // Process files one by one to avoid overwhelming the server
    for (const fileId of filesToMove) {
      const file = fileStore.files?.find(f => f?.SK === fileId);
      if (!file) {
        console.error('File not found:', fileId);
        moveProgress.value.current++;
        continue;
      }



      try {
        await fileStore.moveFile(userEmail, fileId, targetFolderName);

      } catch (fileError) {
        console.error(`Error moving file ${file.fileName}:`, fileError);
        // Continue with other files instead of stopping
      }
      
      moveProgress.value.current++;
    }

    // Clear selection and refresh
    selectedFiles.value.clear();
    targetFolder.value = '';
    await fileStore.getFiles(userEmail);
    
    // Show success message using the stored target folder name
    successMessage.value = `Successfully moved ${selectedCount} file(s) to "${targetFolderName}"!`;
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 3000);
  } catch (error) {
    console.error('Error in bulk move operation:', error);
    alert('Some files may not have been moved. Please refresh the page to see the current state.');
  } finally {
    isMovingFiles.value = false;
    moveProgress.value = { current: 0, total: 0 };
  }
};

const deleteSelectedFolder = async () => {
  if (!selectedfolderName.value || selectedfolderName.value === 'default') return;
  
  if (!confirm(`Are you sure you want to delete the menu "${selectedfolderName.value}"? This cannot be undone.`)) {
    return;
  }
  
  try {
    // Check auth state first
    if (!authStore.authenticated || !authStore.user) {
      throw new Error('Please sign in to delete menu');
    }

    const user = authStore.user;
    if (!user?.attributes?.email) {
      throw new Error('User email not found');
    }



    await fileStore.deleteFolder(
      user.attributes.email, 
      selectedfolderName.value,
      'Mixed' // Explicitly pass category
    );
    
    // Reset to default folder
    selectedfolderName.value = 'default';
    fileStore.setCurrentFolder('default');
    
    // Refresh the file list to ensure UI is updated
    await fileStore.getFiles(user.attributes.email);
    
    alert('Channel deleted successfully');
  } catch (error) {
    console.error('Error deleting menu:', {
      error,
      message: error.message,
      stack: error.stack
    });
    if (error.message && error.message.includes('contains files')) {
      alert('Cannot delete menu that contains files. Please move or delete the files first.');
    } else {
      alert('Failed to delete menu: ' + (error.message || 'An error occurred while deleting the menu'));
    }
  }
};

const showMoveDialog = (fileId) => {
  selectedFiles.value.clear();
  selectedFiles.value.add(fileId);
  targetFolder.value = '';
  
  // Only run on client side
  if (process.client) {
    // Smooth scroll to move controls
    const moveControls = document.createElement('div');
    moveControls.className = 'move-controls';
    document.body.appendChild(moveControls);
    moveControls.scrollIntoView({ behavior: 'smooth' });
    document.body.removeChild(moveControls);
  }
};

const handleFileClick = (fileId) => {
  if (isSelectionMode.value) {
    toggleFileSelection(fileId);
  } else {
    // If file is already selected, deselect it
    if (selectedFiles.value.has(fileId)) {
      selectedFiles.value.delete(fileId);
      // Reset target folder when no files are selected
      if (selectedFiles.value.size === 0) {
        targetFolder.value = '';
      }
    } else {
      showMoveDialog(fileId);
    }
  }
};

const handlePosterUpdate = async (imageUrl) => {
  try {
    // Check if fileStore exists
    if (!fileStore) {
      console.error('fileStore is undefined');
      return;
    }

    // Check if folders array exists and is not empty
    if (!Array.isArray(fileStore.folders) || fileStore.folders.length === 0) {

      return;
    }

    // Construct the correct SK format with Mixed category
    const folderSK = `FOLDER#Mixed#${selectedfolderName.value}`;


    const folder = fileStore.folders.find(f => f?.SK === folderSK);
    
    if (!folder) {

      return;
    }

    // Update the folder in place - use seriesPosterUrl, not menuPosterUrl
    folder.seriesPosterUrl = imageUrl;
    

  } catch (error) {
    console.error('Error updating folder preview:', {
      error,
      message: error.message,
      stack: error.stack,
      fileStore,
      selectedfolderName: selectedfolderName.value
    });
    // Show error to user
    alert(`Error updating poster: ${error.message || 'Unknown error occurred'}`);
  }
};

// Get current channel poster URL for display
const getCurrentChannelPosterUrl = () => {
  if (!selectedfolderName.value || !fileStore?.folders) {
    console.log('🔍 [getCurrentChannelPosterUrl] No selectedfolderName or folders:', {
      selectedfolderName: selectedfolderName.value,
      hasFolders: !!fileStore?.folders,
      foldersLength: fileStore?.folders?.length
    });
    return 'https://d3hv50jkrzkiyh.cloudfront.net/No_Image_Available.jpg';
  }

  try {
    // Find the folder with exact match
    const folderSK = `FOLDER#Mixed#${selectedfolderName.value}`;
    console.log('🔍 [getCurrentChannelPosterUrl] Looking for folder with SK:', folderSK);
    console.log('🔍 [getCurrentChannelPosterUrl] Available folders:', fileStore.folders.map(f => ({
      SK: f.SK,
      name: f.name,
      hasPoster: !!f.seriesPosterUrl
    })));
    
    const folder = fileStore.folders.find(f => f?.SK === folderSK);
    
    if (folder) {
      console.log('🔍 [getCurrentChannelPosterUrl] Found folder:', {
        SK: folder.SK,
        name: folder.name,
        seriesPosterUrl: folder.seriesPosterUrl,
        seriesPosterUrlType: typeof folder.seriesPosterUrl
      });
      
      if (folder.seriesPosterUrl) {
        // Handle both string and object formats for seriesPosterUrl
        const seriesPosterUrl = folder.seriesPosterUrl;
        const url = typeof seriesPosterUrl === 'object' ? seriesPosterUrl.S : seriesPosterUrl;
        
        if (url) {
          // Fix CloudFront domain to use the working one
          let finalUrl = url.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
          finalUrl = finalUrl.replace('d26k8mraabzpiy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
          
          // Ensure the URL has the public prefix
          if (!finalUrl.includes('/public/series-posters/')) {
            finalUrl = finalUrl.replace('/series-posters/', '/public/series-posters/');
          }
          
          console.log('🔍 [getCurrentChannelPosterUrl] Returning poster URL:', finalUrl);
          return finalUrl;
        }
      } else {
        console.log('🔍 [getCurrentChannelPosterUrl] Folder found but no seriesPosterUrl');
      }
    } else {
      console.log('🔍 [getCurrentChannelPosterUrl] Folder not found for SK:', folderSK);
    }
  } catch (error) {
    console.error('Error getting current channel poster URL:', error);
  }

  // Return default poster if no custom poster found
  console.log('🔍 [getCurrentChannelPosterUrl] Returning default poster');
  return 'https://d3hv50jkrzkiyh.cloudfront.net/No_Image_Available.jpg';
};

// Handle poster image loading errors
const handlePosterError = (event) => {
  console.log('Poster image failed to load, using fallback');
  event.target.src = 'https://d4idc5cmwxlpy.cloudfront.net/No_Image_Available.jpg';
};

const toggleSelectionMode = () => {
  isSelectionMode.value = !isSelectionMode.value;
  
  if (!isSelectionMode.value) {
    selectedFiles.value.clear();
  }
};

const toggleFileSelection = (fileId) => {

  
  if (selectedFiles.value.has(fileId)) {
    selectedFiles.value.delete(fileId);
  } else {
    selectedFiles.value.add(fileId);
  }
};

// Function to automatically update visibility for items with passed airdates
const updateVisibilityForPassedAirdates = async () => {
  try {
    const now = new Date();
    const itemsWithPassedAirdates = files.value.filter(file => 
      file.airdate && 
      new Date(file.airdate) <= now && 
      file.isVisible !== true
    );

    if (itemsWithPassedAirdates.length === 0) {
      return;
    }

    console.log('Found items with passed airdates:', itemsWithPassedAirdates.length);

    for (const file of itemsWithPassedAirdates) {
      try {
        const response = await $fetch('/api/files/update-details', {
          method: 'PUT',
          body: {
            fileId: file.SK,
            PK: file.PK,
            isVisible: true,
            airdate: null // Clear the airdate since it's passed
          }
        });

        if (response.success) {
          // Update local state
          const fileIndex = files.value.findIndex(f => f.SK === file.SK);
          if (fileIndex !== -1) {
            files.value[fileIndex] = {
              ...files.value[fileIndex],
              isVisible: true,
              airdate: null
            };
          }
          console.log('Updated visibility for:', file.fileName);
        }
      } catch (error) {
        console.error('Failed to update visibility for:', file.fileName, error);
      }
    }
  } catch (error) {
    console.error('Error updating visibility for passed airdates:', error);
  }
};

// Track in-flight visibility toggles to prevent race conditions
const visibilityToggleInProgress = new Set();

const toggleVisibility = async (file) => {
  try {
    if (!authStore.authenticated || !authStore.user?.attributes?.email) {
      throw new Error('Please sign in to toggle visibility');
    }

    // Check if this is a collaborator video and add restrictions
    if (file.isCollaboratorVideo && !authStore.canAccessManagefiles()) {
      // For collaborator videos, show a message that they need master account approval
      alert('This is a collaborator video. Only the master account can control visibility. Please contact the channel owner to make this video live.');
      return;
    }

    // Prevent duplicate toggles on the same file
    const fileId = file.SK;
    if (visibilityToggleInProgress.has(fileId)) {
      console.log('Toggle already in progress for:', fileId);
      return;
    }
    
    visibilityToggleInProgress.add(fileId);

    // Capture current state from the actual file in the array, not the parameter
    // This ensures we're reading the latest state, not a stale closure value
    const fileIndex = files.value.findIndex(f => f.SK === fileId);
    if (fileIndex === -1) {
      visibilityToggleInProgress.delete(fileId);
      return;
    }
    
    const currentFile = files.value[fileIndex];
    const currentVisibility = currentFile.isVisible === true;
    const newVisibility = !currentVisibility;
    

    
    // If changing from scheduled (has airdate but not visible) to visible, cancel the airdate
    if (currentFile.airdate && !currentVisibility && newVisibility) {
      const cancelResponse = await $fetch('/api/episodes/cancel-airdate', {
        method: 'POST',
        body: {
          episodeId: fileId,
          userId: authStore.user.attributes.email,
          seriesName: currentFile.folderName || currentFile.seriesName
        }
      });
      
      if (!cancelResponse.success) {
        console.error('Failed to cancel airdate:', cancelResponse.message);
        // Continue with the visibility update even if cancel fails
      }
    }
    
    // If making visible and has airdate, clear the airdate
    const updateBody = {
      fileId: fileId,
      PK: currentFile.PK,
      isVisible: newVisibility,
      streamKey: currentFile.streamKey // Include streamKey for duplicate record updates
    };
    
    // Clear airdate when making visible (scheduled → visible)
    if (newVisibility && currentFile.airdate) {
      updateBody.airdate = null;
    }
    
    const response = await $fetch('/api/files/update-details', {
      method: 'PUT',
      body: updateBody
    });

    if (response.success) {
      // Update local state immediately - use the fileId we captured earlier
      const updatedFiles = [...files.value];
      const targetFileIndex = updatedFiles.findIndex(f => f.SK === fileId);
      
      if (targetFileIndex !== -1) {
        updatedFiles[targetFileIndex] = {
          ...updatedFiles[targetFileIndex],
          isVisible: newVisibility,
          // Clear airdate if making visible immediately
          airdate: newVisibility ? null : updatedFiles[targetFileIndex].airdate
        };
        files.value = updatedFiles;
      }
      
      // Remove from in-progress set
      visibilityToggleInProgress.delete(fileId);
      
      // 🎬 NEW: Create ledger entry when episode becomes visible
      if (newVisibility) {
        try {
          console.log('📝 Creating ledger entry for episode visibility change');
          
          // Prepare episode data for ledger entry - use current file from array
          const currentFileForLedger = files.value.find(f => f.SK === fileId) || file;
          const episodeData = {
            ...currentFileForLedger,
            isVisible: newVisibility,
            airdate: newVisibility ? null : currentFileForLedger.airdate
          };
          
          // Create ledger entry via API
          const ledgerResponse = await $fetch('/api/ledger/create-episode-aired', {
            method: 'POST',
            body: {
              episodeData: episodeData,
              triggeredBy: authStore.user.attributes.email
            }
          });
          
          if (ledgerResponse.success) {
            console.log('✅ Ledger entry created:', ledgerResponse.data.ledgerId);
          } else {
            console.warn('⚠️ Failed to create ledger entry:', ledgerResponse.message);
          }
        } catch (ledgerError) {
          console.error('❌ Error creating ledger entry:', ledgerError);
          // Don't fail the visibility toggle if ledger creation fails
        }
      }
      
      // Show success notification
      const currentFileForMessage = files.value.find(f => f.SK === fileId) || file;
      const message = newVisibility 
        ? (currentFileForMessage.airdate ? 'Item made visible immediately (scheduled airdate canceled)' : 'Item made visible successfully!')
        : 'Item hidden successfully!';
      successMessage.value = message;
      showSuccessNotification.value = true;
      setTimeout(() => {
        showSuccessNotification.value = false;
      }, 3000);
    } else {
      visibilityToggleInProgress.delete(fileId);
      throw new Error(response.message || 'Failed to toggle visibility');
    }
  } catch (error) {
    console.error('Error toggling visibility:', error);
    // Remove from in-progress set on error
    const fileId = file?.SK;
    if (fileId) {
      visibilityToggleInProgress.delete(fileId);
    }
    successMessage.value = `Error: ${error.message || 'Failed to toggle visibility'}`;
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 5000);
  }
};

const deleteSelectedFiles = async () => {
  if (selectedFiles.value.size === 0) return;
  
  const selectedCount = selectedFiles.value.size;
  if (!confirm(`Are you sure you want to delete ${selectedCount} file(s)? This action cannot be undone.`)) {
    return;
  }
  
  isBulkDeleting.value = true;
  deleteProgress.value = { current: 0, total: selectedCount };
  
  try {
    if (!authStore.authenticated || !authStore.user?.attributes?.email) {
      throw new Error('Please sign in to delete files');
    }

    const userEmail = authStore.user.attributes.email;
    const filesToDelete = Array.from(selectedFiles.value);
    


    // Process files one by one to avoid overwhelming the server
    for (const fileId of filesToDelete) {
      const file = fileStore.files?.find(f => f?.SK === fileId);
      if (!file) {
        console.error('File not found:', fileId);
        deleteProgress.value.current++;
        continue;
      }

      // Validate file object
      if (!file.SK || !file.fileName) {
        console.error('Invalid file data for fileId:', fileId, file);
        deleteProgress.value.current++;
        continue;
      }

      try {
        const requestBody = {
          userId: userEmail,
          fileId: file.SK,
          fileName: file.fileName,
          folderName: file.folderName || file.seriesName // Handle both naming schemes
        };



        const response = await $fetch('/api/files/delete', {
          method: 'POST',
          body: requestBody,
          headers: {
            'Content-Type': 'application/json'
          }
        });



        if (!response.success) {
          console.error(`Failed to delete file: ${file.fileName}`, response.message);
          // Continue with other files instead of stopping
        } else {
          // Update local store
          fileStore.removeFile(file.SK);
        }
      } catch (fileError) {
        console.error(`Error deleting file ${file.fileName}:`, fileError);
        // Continue with other files instead of stopping
      }
      
      // Update progress
      deleteProgress.value.current++;
    }

    // Clear selection and refresh
    selectedFiles.value.clear();
    await fileStore.getFiles(userEmail);
    
    // Show success message
    successMessage.value = `Successfully deleted ${selectedCount} file(s)!`;
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 3000);
  } catch (error) {
    console.error('Error in bulk delete operation:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      data: error.data
    });
    alert('Some files may not have been deleted. Please refresh the page to see the current state.');
  } finally {
    isBulkDeleting.value = false;
    deleteProgress.value = { current: 0, total: 0 };
  }
};

// Add new refs for edit modal
const showEditModal = ref(false);
const hideFileManagement = ref(false);
const editingItem = ref({
  id: null,
  title: '',
  description: '',
  price: 0,
  isVisible: true
});

// Add new ref for edit modal loading state
const isEditModalLoading = ref(true);
const isBulkDeleting = ref(false);
const deleteProgress = ref({ current: 0, total: 0 });
const isMovingFiles = ref(false);
const moveProgress = ref({ current: 0, total: 0 });
const showSuccessNotification = ref(false);
const successMessage = ref('');
const showAirdateModal = ref(false);
const selectedFile = ref(null);

// Share link functionality
const shareableLink = ref('');
const shareAppLink = ref('');
const showShareModal = ref(false);
const linkCopied = ref(false);
const shareAppLinkCopied = ref(false);

// Subscription price management
const channelSubscriptionPrice = ref(9.99);
const newSubscriptionPrice = ref('');
const isUpdatingPrice = ref(false);
const isGeneratingLink = ref(false);

// Channel visibility management (private, searchable, public)
const channelVisibility = ref('private'); // 'private', 'searchable', or 'public'
const isUpdatingVisibility = ref(false);

// Channel description management
const channelDescription = ref('');
const newChannelDescription = ref('');
const isUpdatingDescription = ref(false);

// Stream Key Management
const streamKeys = ref([]);
const isGeneratingStreamKey = ref(false);
const streamKeyCopied = ref(false);

const RTMP_SERVER_URL = 'rtmp://100.24.103.57:1935/live';

// Update edit function
const editItem = async (file) => {
  // Check if this is a collaborator video and add restrictions
  if (file.isCollaboratorVideo && !authStore.canAccessManagefiles()) {
    alert('This is a collaborator video. Only the master account can edit video details. Please contact the channel owner to make changes.');
    return;
  }

  isEditModalLoading.value = true;
  showEditModal.value = true;
  // Set the editing item data synchronously
  editingItem.value = {
    id: file.SK || file.id,
    SK: file.SK,
    PK: file.PK,
    title: file.title || '',
    description: file.description || '',
    price: file.price || 0,
    isVisible: file.isVisible !== false // Default to true if not explicitly set to false
  };
  // Remove nextTick and setTimeout, just set loading to false immediately
  isEditModalLoading.value = false;
};

// Replace the closeEditModal function with:
const closeEditModal = () => {
  isEditModalLoading.value = true;
  showEditModal.value = false;
};

// Update update function
const updateItemDetails = async () => {
  try {
    isEditModalLoading.value = true;
    
    // Validate required fields
    if (!editingItem.value.title?.trim()) {
      throw new Error('Title is required');
    }
    const response = await $fetch('/api/files/update-details', {
      method: 'PUT',
      body: {
        fileId: editingItem.value.SK,
        PK: editingItem.value.PK,
        title: editingItem.value.title,
        description: editingItem.value.description,
        price: parseFloat(editingItem.value.price) || 0,
        isVisible: editingItem.value.isVisible
      }
    });

    if (response.success) {
      // Update local state immediately
      const updatedFiles = [...files.value];
      const fileIndex = updatedFiles.findIndex(f => f.SK === editingItem.value.SK);
      
      if (fileIndex !== -1) {
        updatedFiles[fileIndex] = {
          ...updatedFiles[fileIndex],
          title: editingItem.value.title,
          description: editingItem.value.description,
          price: parseFloat(editingItem.value.price) || 0,
          isVisible: editingItem.value.isVisible
        };
        files.value = updatedFiles;
      }
      
      // Refresh the file list from the server to ensure we have the latest data
      if (authStore.user?.attributes?.email) {
        await fileStore.getFiles(authStore.user.attributes.email);
      }
      
      closeEditModal();
      
      // Show success notification
      successMessage.value = 'Item details updated successfully!';
      showSuccessNotification.value = true;
      setTimeout(() => {
        showSuccessNotification.value = false;
      }, 3000);
    } else {
      throw new Error(response.message || 'Failed to update item details');
    }
  } catch (error) {
    console.error('Error updating item details:', error);
    // Show error notification instead of alert
    successMessage.value = `Error: ${error.message || 'Failed to update item details. Please try again.'}`;
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 5000); // Show error for longer
  } finally {
    isEditModalLoading.value = false;
  }
};



// Universal local asset system using proven Twilly assets
const getLocalAssetForChannel = (channelName) => {
  if (!channelName) {
    return null;
  }

  // Use the same proven assets that Twilly channels use
  // This ensures WhatsApp/Instagram compatibility for ALL channels
  const twillyAssets = {
    'twilly': '/assets/channels/icon-512.png',
    'twilly-after-dark': '/assets/channels/icon-512.png',
    'twilly-fit': '/assets/channels/twilly-fit-icon.png',
    'twilly-game-zone': '/assets/channels/twilly-game-zone-icon.png',
    'twilly-music-stream': '/assets/channels/twilly-music-stream-icon.png',
    'twilly-tech-stream': '/assets/channels/twilly-tech-stream-icon.png'
  };

  // For Twilly channels, use their specific assets
  if (twillyAssets[channelName.toLowerCase()]) {
    return twillyAssets[channelName.toLowerCase()];
  }

  // For all other channels, return null so we can fetch the actual channel poster
  // This ensures we get the real channel poster instead of the default icon
  return null;
};

// Enhanced getChannelPosterUrl that uses proven local assets
const getChannelPosterUrlWithLocalAsset = async (channelName) => {
  if (!channelName || !authStore.user?.attributes?.email) {
    return '';
  }

  try {
    // For non-default channels, try to get the actual channel poster first
    if (channelName !== 'default' && channelName !== 'thumbnails') {
      // Get the poster URL from the current folder/series - try multiple matching strategies
      const currentFolder = fileStore.folders?.find(f => 
        f?.name === channelName || 
        f?.folderName === channelName ||
        f?.series === channelName
      );
      
      let posterUrl = '';
      if (currentFolder?.seriesPosterUrl) {
        // Convert to public URL format (same as other share pages)
        posterUrl = currentFolder.seriesPosterUrl.replace('/series-posters/', '/public/series-posters/');
        // Fix CloudFront domain to use the working one
        posterUrl = posterUrl.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
        
        console.log(`Using actual channel poster for ${channelName}:`, posterUrl);
        return posterUrl;
      } else {
        // Try to construct poster URL from channel name and user email
        const userEmail = authStore.user.attributes.email;
        const encodedChannelName = encodeURIComponent(channelName);
        
        // Use the working CloudFront domain
        const cloudFrontBaseUrl = 'https://d3hv50jkrzkiyh.cloudfront.net';
        
        // Try different email formats (username vs full email)
        const emailVariants = [userEmail];
        if (userEmail === 'dehsin365') {
          emailVariants.push('dehyu.sinyan@gmail.com');
        }
        
        // Try to find a folder with a poster URL using different email formats
        for (const email of emailVariants) {
          const folderWithPoster = fileStore.folders?.find(f => 
            f?.name === channelName && 
            f?.seriesPosterUrl &&
            f.PK?.includes(email)
          );
          
          if (folderWithPoster?.seriesPosterUrl) {
            posterUrl = folderWithPoster.seriesPosterUrl.replace('/series-posters/', '/public/series-posters/');
            posterUrl = posterUrl.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
            console.log(`Using found poster URL for ${channelName}:`, posterUrl);
            return posterUrl;
          }
        }
        
        // Fallback to constructed URL
        const fallbackPosterPath = `public/series-posters/${userEmail}/${encodedChannelName}/default-poster.jpg`;
        posterUrl = `${cloudFrontBaseUrl}/${fallbackPosterPath}`;
        console.log(`Using constructed poster URL for ${channelName}:`, posterUrl);
        return posterUrl;
      }
    }
    
    // For default/thumbnails, use proven local assets
    const localAsset = getLocalAssetForChannel(channelName);
    if (localAsset) {
      console.log(`Using proven local asset for ${channelName}:`, localAsset);
      return localAsset;
    }
    
    // If no local asset found, return empty string to let the invite page fetch the actual poster
    return '';
    
  } catch (error) {
    console.log('Error getting poster URL for channel:', channelName, error);
    return '';
  }
};

// Share link functions
const generateShareLink = async () => {
  if (!authStore.user?.attributes?.email) {
    console.error('No user email available');
    return;
  }

  // Check if user has a username set
  const hasUsername = currentUsername.value;
  if (!hasUsername) {
    // Redirect to account page to set username
    successMessage.value = 'Please set a username in your account settings to generate share links.';
    showSuccessNotification.value = true;
    setTimeout(() => { showSuccessNotification.value = false; }, 5000);
    return;
  }

  isGeneratingLink.value = true;

  try {
    // Always use production domain for share previews
    const baseShareDomain = 'https://twilly.app';
    const seriesName = selectedfolderName.value;
    
    // Use the unified helper function to get poster URL for ALL channels - await it properly
    const posterUrl = await getChannelPosterUrlWithLocalAsset(seriesName);
    
    // Build clean share URL (same format as working channels) - This is the WhatsApp URL
    const channelSlug = slugify(seriesName);
    const cleanUrl = `${baseShareDomain}/${encodeURIComponent(hasUsername)}/${encodeURIComponent(channelSlug)}`;

    console.log('Creating clean share URL (WhatsApp):', cleanUrl);
    console.log('Channel poster URL available for server:', posterUrl);

    // Generate shortened redirect URL (like share.twilly.app/abc123) that redirects to channel page
    let shortUrl = '';
    try {
      // Use the same shortening logic as collaborator invite links - pass required parameters
      shortUrl = await taskStore.shortenUrl({ 
        url: cleanUrl,
        creator: hasUsername,
        series: seriesName,
        userEmail: authStore.user.attributes.email
      });
      
      if (shortUrl && shortUrl.returnResult) {
        console.log('Generated shortened redirect URL:', shortUrl.returnResult);
        // Store URLs separately like profile.vue does
        shareableLink.value = cleanUrl; // Direct WhatsApp URL
        shareAppLink.value = shortUrl.returnResult; // Shortened redirect URL
      } else {
        console.log('Shortening failed, using clean URL as fallback');
        shareableLink.value = cleanUrl;
        shareAppLink.value = cleanUrl; // Fallback to same URL
      }
    } catch (shortUrlError) {
      console.error('Error generating shortened redirect URL:', shortUrlError);
      console.log('Shortening failed, using clean URL as fallback');
      shareableLink.value = cleanUrl;
      shareAppLink.value = cleanUrl; // Fallback to same URL
    }
    
  } catch (error) {
    console.error('Error generating share link:', error);
    successMessage.value = 'Error: ' + (error.message || 'Failed to generate share link');
    showSuccessNotification.value = true;
    setTimeout(() => { showSuccessNotification.value = false; }, 5000);
  } finally {
    isGeneratingLink.value = false;
  }
};

const copyShareLinkToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(shareableLink.value);
    linkCopied.value = true;
    setTimeout(() => {
      linkCopied.value = false;
    }, 2000);
  } catch (error) {
    console.error('Error copying link:', error);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = shareableLink.value;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    linkCopied.value = true;
    setTimeout(() => {
      linkCopied.value = false;
    }, 2000);
  }
};

const copyShareAppLinkToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(shareAppLink.value);
    shareAppLinkCopied.value = true;
    setTimeout(() => {
      shareAppLinkCopied.value = false;
    }, 2000);
  } catch (error) {
    console.error('Error copying share.twilly.app link:', error);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = shareAppLink.value;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    shareAppLinkCopied.value = true;
    setTimeout(() => {
      shareAppLinkCopied.value = false;
    }, 2000);
  }
};

const generateNewLink = () => {
  shareableLink.value = '';
  shareAppLink.value = '';
  showShareModal.value = false;
  generateShareLink();
};

const clearShareLink = () => {
  shareableLink.value = '';
  shareAppLink.value = '';
  showShareModal.value = false;
  linkCopied.value = false;
  shareAppLinkCopied.value = false;
};

// Get current subscription price for the selected channel
const getChannelSubscriptionPrice = async () => {
  if (!selectedfolderName.value || selectedfolderName.value === 'default' || selectedfolderName.value === 'thumbnails') {
    return;
  }

  try {
    const channelId = `${authStore.user.attributes.email}-${selectedfolderName.value}`;
    const response = await fetch('/api/channels/get-subscription-price', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId: channelId,
        channelName: selectedfolderName.value,
        creatorUsername: authStore.user.attributes.email
      })
    });

    const data = await response.json();
    if (data.success) {
      channelSubscriptionPrice.value = data.price;
      newSubscriptionPrice.value = data.price.toString();
    }
  } catch (error) {
    console.error('Error getting subscription price:', error);
  }
};

// Get current channel description for the selected channel
const getChannelDescription = async () => {
  if (!selectedfolderName.value || selectedfolderName.value === 'default' || selectedfolderName.value === 'thumbnails') {
    return;
  }

  try {
    const channelId = `${authStore.user.attributes.email}-${selectedfolderName.value}`;
         // Use the SAME API endpoint as the view channel page for consistency
     const result = await $fetch('/api/creators/get-share-params', {
       method: 'POST',
       body: { 
         username: currentUsername.value, 
         series: selectedfolderName.value 
       }
     });
     
     const description = result?.description || '';
    
    channelDescription.value = description;
    newChannelDescription.value = description;
  } catch (error) {
    console.error('Error getting channel description:', error);
    // Set default description if API fails
    channelDescription.value = '';
    newChannelDescription.value = '';
  }
};

// Handle folder selection change
const handleFolderChange = () => {
  fileStore.setCurrentFolder(selectedfolderName.value);
  // Load subscription price for the selected channel
  getChannelSubscriptionPrice();
  // Load channel description for the selected channel
  getChannelDescription();
  // Load channel visibility for the selected channel
  getChannelVisibility();
};

// Update subscription price for the selected channel
const updateSubscriptionPrice = async () => {
  if (!selectedfolderName.value || !newSubscriptionPrice.value) {
    return;
  }

  isUpdatingPrice.value = true;

  try {
    const response = await fetch('/api/channels/update-subscription-price', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId: `${authStore.user.attributes.email}-${selectedfolderName.value}`,
        channelName: selectedfolderName.value,
        creatorUsername: authStore.user.attributes.email,
        newPrice: parseFloat(newSubscriptionPrice.value)
      })
    });

    const data = await response.json();
    if (data.success) {
      channelSubscriptionPrice.value = parseFloat(newSubscriptionPrice.value);
      successMessage.value = `Subscription price updated to $${newSubscriptionPrice.value}/month`;
      showSuccessNotification.value = true;
      setTimeout(() => { showSuccessNotification.value = false; }, 5000);
    } else {
      throw new Error(data.message || 'Failed to update subscription price');
    }
  } catch (error) {
    console.error('Error updating subscription price:', error);
    successMessage.value = 'Error: ' + (error.message || 'Failed to update subscription price');
    showSuccessNotification.value = true;
    setTimeout(() => { showSuccessNotification.value = false; }, 5000);
  } finally {
    isUpdatingPrice.value = false;
  }
};

// Get current channel visibility for the selected channel
const getChannelVisibility = async () => {
  if (!selectedfolderName.value || selectedfolderName.value === 'default' || selectedfolderName.value === 'thumbnails') {
    return;
  }

  try {
    const channelId = `${authStore.user.attributes.email}-${selectedfolderName.value}`;
    const response = await fetch('/api/channels/get-visibility', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId: channelId,
        channelName: selectedfolderName.value,
        creatorUsername: authStore.user.attributes.email
      })
    });

    const data = await response.json();
    if (data.success) {
      // Support both old boolean format and new string format
      if (typeof data.visibility === 'string') {
        channelVisibility.value = data.visibility;
      } else if (data.isPublic === true) {
        // Migrate old boolean to new format
        channelVisibility.value = 'public';
      } else {
        channelVisibility.value = 'private';
      }
    }
  } catch (error) {
    console.error('Error getting channel visibility:', error);
    // Default to private if API fails
    channelVisibility.value = 'private';
  }
};

// Set channel visibility (private, searchable, or public)
const setChannelVisibility = async (visibility) => {
  if (!selectedfolderName.value || isUpdatingVisibility.value) {
    return;
  }

  if (channelVisibility.value === visibility) {
    return; // Already set to this visibility
  }

  isUpdatingVisibility.value = true;

  try {
    const response = await fetch('/api/channels/update-visibility', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId: `${authStore.user.attributes.email}-${selectedfolderName.value}`,
        channelName: selectedfolderName.value,
        creatorUsername: authStore.user.attributes.email,
        visibility: visibility,
        isPublic: visibility === 'public' // Keep for backward compatibility
      })
    });

    const data = await response.json();
    if (data.success) {
      channelVisibility.value = visibility;
      const visibilityLabels = {
        'public': 'Public',
        'searchable': 'Searchable',
        'private': 'Private'
      };
      successMessage.value = `Channel visibility updated to ${visibilityLabels[visibility]}`;
      showSuccessNotification.value = true;
      setTimeout(() => { showSuccessNotification.value = false; }, 5000);
    } else {
      throw new Error(data.message || 'Failed to update channel visibility');
    }
  } catch (error) {
    console.error('Error updating channel visibility:', error);
    successMessage.value = 'Error: ' + (error.message || 'Failed to update channel visibility');
    showSuccessNotification.value = true;
    setTimeout(() => { showSuccessNotification.value = false; }, 5000);
  } finally {
    isUpdatingVisibility.value = false;
  }
};

// Test local asset system for a channel
const testLocalAssetGeneration = async () => {
  if (!selectedfolderName.value || selectedfolderName.value === 'default' || selectedfolderName.value === 'thumbnails') {
    successMessage.value = 'Please select a non-default channel to test preview generation.';
    showSuccessNotification.value = true;
    setTimeout(() => { showSuccessNotification.value = false; }, 3000);
    return;
  }

  try {
    successMessage.value = 'Testing local asset system...';
    showSuccessNotification.value = true;
    
    const posterUrl = await getChannelPosterUrlWithLocalAsset(selectedfolderName.value);
    
    if (posterUrl && posterUrl.startsWith('/assets/')) {
      successMessage.value = `✅ Using proven local asset! Preview should now work on WhatsApp/Instagram.`;
    } else {
      successMessage.value = `⚠️ Using fallback poster URL. Local asset system may have failed.`;
    }
    
    showSuccessNotification.value = true;
    setTimeout(() => { showSuccessNotification.value = false; }, 5000);
    
  } catch (error) {
    console.error('Error testing local asset system:', error);
    successMessage.value = 'Error: Failed to test local asset system';
    showSuccessNotification.value = true;
    setTimeout(() => { showSuccessNotification.value = false; }, 5000);
  }
};

// Update channel description for the selected channel
const updateChannelDescription = async () => {
  if (!selectedfolderName.value || !newChannelDescription.value) {
    return;
  }

  isUpdatingDescription.value = true;

  try {
    // Use the SAME API endpoint as the view channel page for consistency
    // First, try to update through the creators API if it exists
    try {
      const result = await $fetch('/api/creators/update-description', {
        method: 'POST',
        body: { 
          username: currentUsername.value, 
          series: selectedfolderName.value,
          description: newChannelDescription.value
        }
      });
      
      if (result.success) {
        console.log('✅ Description updated via creators API');
      } else {
        throw new Error(result.message || 'Failed to update description');
      }
    } catch (error) {
      console.log('⚠️ Creators API update failed, trying channel store as fallback:', error.message);
      
      // Fallback to channel store
      const channelId = `${authStore.user.attributes.email}-${selectedfolderName.value}`;
      await channelStore.updateChannelDescription(
        channelId,
        selectedfolderName.value,
        currentUsername.value, // Use username, not email
        newChannelDescription.value
      );
    }

    channelDescription.value = newChannelDescription.value;
    successMessage.value = 'Channel description updated successfully!';
    showSuccessNotification.value = true;
    setTimeout(() => { showSuccessNotification.value = false; }, 5000);
  } catch (error) {
    console.error('Error updating channel description:', error);
    successMessage.value = 'Error: ' + (error.message || 'Failed to update channel description');
    showSuccessNotification.value = true;
    setTimeout(() => { showSuccessNotification.value = false; }, 5000);
  } finally {
    isUpdatingDescription.value = false;
  }
};

// Stream Key Management Functions
const loadStreamKeys = async () => {


  if (!authStore.user?.attributes?.email || !selectedfolderName.value || 
      selectedfolderName.value === 'default' || selectedfolderName.value === 'thumbnails') {

    streamKeys.value = [];
    return;
  }

  try {
    const userEmail = authStore.user.attributes.email;
    const channelName = selectedfolderName.value;
    

    
    const response = await $fetch('/api/stream-keys/get', {
      method: 'POST',
      body: {
        userEmail: userEmail,
        channelName: channelName
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });



    if (response.success) {
      streamKeys.value = response.streamKeys || [];

          } else {

            streamKeys.value = [];
          }
  } catch (error) {
    console.error('Error loading stream keys:', error);
    streamKeys.value = [];
  }
};

const generateStreamKey = async () => {
  if (!authStore.user?.attributes?.email) {
    console.error('No user email available for stream key generation');
    return;
  }

  isGeneratingStreamKey.value = true;

  try {
    const userEmail = authStore.user.attributes.email;
    const channelName = selectedfolderName.value;
    
    const response = await $fetch('/api/stream-keys/generate', {
      method: 'POST',
      body: {
        userEmail: userEmail,
        channelName: channelName
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.success) {

      // Reload all stream keys to get the updated list
      await loadStreamKeys();
      
      // Generate collaborator invite link automatically when stream key is created
      await generateCollaboratorInvite(response.streamKey);
    } else {
      throw new Error(response.message || 'Failed to generate stream key');
    }
  } catch (error) {
    console.error('Error generating stream key:', error);
    // Show error notification instead of showToast
    successMessage.value = `Error: ${error.message || 'Failed to generate stream key'}`;
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 5000);
  } finally {
    isGeneratingStreamKey.value = false;
  }
};



const copyStreamKey = async (streamKey) => {
  try {
    const fullPath = `${RTMP_SERVER_URL}/${streamKey}`;
    
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(fullPath);
      streamKeyCopied.value = true;
    } else {
      // Fallback for older browsers and mobile
      const textArea = document.createElement('textarea');
      textArea.value = fullPath;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        streamKeyCopied.value = true;
      } else {
        console.error('Copy failed on mobile');
      }
    }
    
    setTimeout(() => {
      streamKeyCopied.value = false;
    }, 2000);
    
    // Generate collaborator invite link automatically
    await generateCollaboratorInvite(streamKey);
  } catch (error) {
    console.error('Error copying stream key:', error);
    // Final fallback
    const textArea = document.createElement('textarea');
    textArea.value = `${RTMP_SERVER_URL}/${streamKey}`;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    streamKeyCopied.value = true;
    setTimeout(() => {
      streamKeyCopied.value = false;
    }, 2000);
    
    // Generate collaborator invite link automatically
    await generateCollaboratorInvite(streamKey);
  }
};

const deactivateStreamKey = async (streamKey) => {

  
  if (!streamKey) {
    console.error('No streamKey provided to deactivateStreamKey');
    successMessage.value = 'Error: No stream key provided';
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 3000);
    return;
  }
  
  if (!confirm('Are you sure you want to deactivate this stream key? This will disable streaming for this key.')) {
    return;
  }

  try {
    const response = await $fetch('/api/stream-keys/deactivate', {
      method: 'POST',
      body: {
        streamKey: streamKey
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.success) {

      // Reload all stream keys to get the updated list
      await loadStreamKeys();
      // Show success notification
      successMessage.value = 'Stream key deactivated successfully!';
      showSuccessNotification.value = true;
      setTimeout(() => {
        showSuccessNotification.value = false;
      }, 3000);
    } else {
      throw new Error(response.message || 'Failed to deactivate stream key');
    }
  } catch (error) {
    console.error('Error deactivating stream key:', error);
    // Show error notification
    successMessage.value = `Error: ${error.message || 'Failed to deactivate stream key'}`;
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 5000);
  }
};

const deleteStreamKey = async (streamKey) => {

  
  if (!streamKey) {
    console.error('No streamKey provided to deleteStreamKey');
    successMessage.value = 'Error: No stream key provided';
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 3000);
    return;
  }
  
  if (!confirm('Are you sure you want to DELETE this stream key? This action cannot be undone and will permanently remove the key.')) {
    return;
  }

  try {
    const response = await $fetch('/api/stream-keys/delete', {
      method: 'POST',
      body: {
        streamKey: streamKey,
        userEmail: authStore.user.attributes.email
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.success) {

      // Reload all stream keys to get the updated list
      await loadStreamKeys();
      // Show success notification
      successMessage.value = 'Stream key deleted successfully!';
      showSuccessNotification.value = true;
      setTimeout(() => {
        showSuccessNotification.value = false;
      }, 3000);
    } else {
      throw new Error(response.message || 'Failed to delete stream key');
    }
  } catch (error) {
    console.error('Error deleting stream key:', error);
    // Show error notification
    successMessage.value = `Error: ${error.message || 'Failed to delete stream key'}`;
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 5000);
  }
};

const clearAllStreamKeys = async () => {
  if (!confirm('Are you sure you want to clear all stream keys? This will disable streaming for all keys in this menu.')) {
    return;
  }

  try {
    if (!authStore.user?.attributes?.email) {
      throw new Error('No user email available for stream key clearing');
    }

    const userId = authStore.user.attributes.email;
    const seriesName = selectedfolderName.value;

    const response = await $fetch('/api/stream-keys/clear', {
      method: 'POST',
      body: {
        userId: userId,
        seriesName: seriesName
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.success) {
      streamKeys.value = [];

      // Show success notification
      successMessage.value = 'All stream keys cleared successfully!';
      showSuccessNotification.value = true;
      setTimeout(() => {
        showSuccessNotification.value = false;
      }, 3000);
    } else {
      throw new Error(response.message || 'Failed to clear stream keys');
    }
  } catch (error) {
    console.error('Error clearing stream keys:', error);
    // Show error notification
    successMessage.value = `Error: ${error.message || 'Failed to clear stream keys'}`;
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 5000);
  }
};

const isRefreshingChannel = ref(false);
const refreshChannel = async () => {
  if (!authStore.user?.attributes?.email) return;
  isRefreshingChannel.value = true;
  try {
    await fileStore.getFiles(authStore.user.attributes.email);
    // Debug: Check what files were loaded after refresh
    debugFiles();
  } catch (e) {
    console.error('Error refreshing channel:', e);
  } finally {
    isRefreshingChannel.value = false;
  }
};

// Add new refs for invite modal
const collaboratorInviteLink = ref('');
const isGeneratingInvite = ref(false);

// Collaborator request link variables
const collaboratorRequestLink = ref('');
const talentRequestLink = ref('');
const isGeneratingRequest = ref(false);
const requestLinkCopied = ref(false);
const talentRequestLinkCopied = ref(false);
const inviteSuccessMessage = ref('');
const inviteLinkCopied = ref(false);

// Affiliate invite link variables
const affiliateInviteLink = ref('');
const isGeneratingAffiliateInvite = ref(false);
const affiliateInviteLinkCopied = ref(false);
const affiliateInviteSuccessMessage = ref('');

// Channel Invite Code Management (per channel)
const channelInviteCodes = ref({});
const isGeneratingChannelInvite = ref(false);

// Download video state
const downloadingFileIds = ref({});

// Mobile detection
const isMobile = computed(() => {
  if (process.client) {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  return false;
});

const generateCollaboratorInvite = async (streamKey) => {
  if (!authStore.user?.attributes?.email) return;
  
  // Check if user has a username set
  if (!currentUsername.value) {
    console.error('No username found for collaborator invite. currentUsername.value:', currentUsername.value);
    inviteSuccessMessage.value = 'Please set a username in your account settings to generate collaborator invite links.';
    setTimeout(() => {
      inviteSuccessMessage.value = '';
    }, 3000);
    return;
  }
  
  console.log('Generating collaborator invite with username:', currentUsername.value);
  
  isGeneratingInvite.value = true;
  inviteSuccessMessage.value = '';
  collaboratorInviteLink.value = '';
  
  try {
    // Generate a unique invite code on the frontend
    const inviteCode = uuidv4();
    
    // Use the selected folder name directly since that's what was used to generate the stream key
    const channelName = selectedfolderName.value;
    if (!channelName || channelName === 'default' || channelName === 'thumbnails') {
      console.error('No valid channel name found for collaborator invite');
      return;
    }
    
    // Use the unified helper function to get poster URL for ALL channels
    const posterUrl = await getChannelPosterUrlWithLocalAsset(channelName);
    
    // Encode the poster URL for use in query parameters
    const encodedPosterUrl = posterUrl ? encodeURIComponent(posterUrl) : '';
    
    // Store invite information in DynamoDB
    const inviteRecord = {
      PK: 'INVITE',
      SK: inviteCode,
      channelName: channelName,
      channelOwnerEmail: authStore.user.attributes.email,
      channelOwnerId: authStore.user.attributes.sub,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      status: 'active',
      // Track which affiliate created this invite for payout attribution
      invitedByAffiliate: authStore.user.attributes.email,
      affiliateUserId: authStore.user.attributes.sub,
      inviteType: 'collaborator'
    };

    // Store the invite record
    try {
      await $fetch('/api/collaborations/store-invite', {
        method: 'POST',
        body: inviteRecord
      });
    } catch (error) {
      console.error('Failed to store invite:', error);
    }

    // Build the long collaborator invite URL with meta info
    // Use the production domain for collaborator invites to ensure they work correctly
    const longUrl = `https://twilly.app/collaborator/${inviteCode}/${encodeURIComponent(channelName)}`;
    const meta = {
      title: channelName, // just the channel name!
      description: `Join as a collaborator and stream on ${channelName} with Twilly!`,
      poster: posterUrl
    };
    
    // Append meta info as query params (include poster if available and not default icon)
    // Also include creator username for poster fetching
    const shouldIncludePoster = posterUrl && !posterUrl.includes('icon-512.png') && posterUrl !== '/assets/channels/icon-512.png';
    console.log('🔗 Collaborator - shouldIncludePoster:', shouldIncludePoster);
    console.log('🔗 Collaborator - posterUrl check:', { posterUrl, hasIcon: posterUrl?.includes('icon-512.png'), isDefault: posterUrl === '/assets/channels/icon-512.png' });
    
    const urlWithMeta = `${longUrl}?title=${encodeURIComponent(meta.title)}&description=${encodeURIComponent(meta.description)}&creator=${encodeURIComponent(currentUsername.value)}${shouldIncludePoster ? `&poster=${posterUrl}` : ''}`;
    console.log('🔗 Collaborator - Final URL with meta:', urlWithMeta);
    
    // Use the same shortening logic as Generate Share Link
    let shortUrl = '';
    try {
      shortUrl = await taskStore.shortenUrl({ url: urlWithMeta });
    } catch (e) {
      shortUrl = { returnResult: urlWithMeta };
    }
    
    collaboratorInviteLink.value = shortUrl.returnResult || urlWithMeta;
    inviteSuccessMessage.value = 'Collaborator invite link generated! Copy it to share with others.';
    
    // Auto-copy the invite link to clipboard with mobile fallback
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(collaboratorInviteLink.value);
        inviteSuccessMessage.value = 'Stream key and invite link copied!';
      } else {
        // Fallback for older browsers and mobile
        const textArea = document.createElement('textarea');
        textArea.value = collaboratorInviteLink.value;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          inviteSuccessMessage.value = 'Stream key and invite link copied!';
        } else {
          inviteSuccessMessage.value = 'Stream key copied! Invite link generated.';
        }
      }
    } catch (e) {
      console.error('Clipboard copy failed:', e);
      inviteSuccessMessage.value = 'Stream key copied! Invite link generated.';
    }
    
    // Clear success message after 5 seconds
    setTimeout(() => {
      inviteSuccessMessage.value = '';
    }, 5000);
    
  } catch (error) {
    console.error('Error generating collaborator invite:', error);
    inviteSuccessMessage.value = 'Error generating invite link.';
    setTimeout(() => {
      inviteSuccessMessage.value = '';
    }, 3000);
  } finally {
    isGeneratingInvite.value = false;
  }
};

// Fetch current active invite code for a channel
const fetchActiveChannelInviteCode = async (channelName) => {
  if (!channelName || channelName === 'default' || channelName === 'thumbnails') {
    return;
  }
  
  try {
    const response = await $fetch('/api/collaborations/get-active-invite-code', {
      method: 'POST',
      body: {
        channelName: channelName
      }
    });

    if (response.success && response.inviteCode) {
      channelInviteCodes.value[channelName] = response.inviteCode;
      console.log(`✅ Loaded active invite code for ${channelName}:`, response.inviteCode);
    } else {
      console.log(`ℹ️ No active invite code found for ${channelName}`);
      channelInviteCodes.value[channelName] = '';
    }
  } catch (error) {
    console.error(`Error fetching active invite code for ${channelName}:`, error);
    channelInviteCodes.value[channelName] = '';
  }
};

// Generate Channel Invite Code (with rotation - expires old codes)
const generateChannelInviteCode = async (channelName) => {
  if (!authStore.user?.attributes?.email || !authStore.user?.attributes?.sub) {
    console.error('User not authenticated');
    return;
  }

  if (!channelName || channelName === 'default' || channelName === 'thumbnails') {
    alert('Please select a valid channel');
    return;
  }

  // Warn user that generating a new code will expire old codes
  if (channelInviteCodes.value[channelName]) {
    const confirmed = confirm(
      `Generating a new invite code will expire all previous invite codes for ${channelName}.\n\n` +
      'Users with old codes will no longer be able to join.\n\n' +
      'Do you want to continue?'
    );
    
    if (!confirmed) {
      return;
    }
  }

  isGeneratingChannelInvite.value = true;
  try {
    const channelOwnerEmail = authStore.user.attributes.email;
    const channelOwnerId = authStore.user.attributes.sub;

    // Use the store-invite-with-metadata API to generate invite code
    // This API will automatically expire old codes for the channel
    const response = await $fetch('/api/collaborations/store-invite-with-metadata', {
      method: 'POST',
      body: {
        channelName,
        channelOwnerEmail,
        channelOwnerId,
        title: channelName,
        description: `Stream to ${channelName} with this invite code`,
        creator: currentUsername.value || '',
        poster: '',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year expiration
      }
    });

    if (response.success && response.inviteCode) {
      channelInviteCodes.value[channelName] = response.inviteCode;
      console.log(`✅ ${channelName} invite code generated (old codes expired):`, response.inviteCode);
      
      // Show success message
      inviteSuccessMessage.value = `New invite code generated for ${channelName}! Old codes have been expired.`;
      setTimeout(() => {
        inviteSuccessMessage.value = '';
      }, 5000);
    } else {
      throw new Error(response.message || 'Failed to generate invite code');
    }
  } catch (error) {
    console.error(`Error generating ${channelName} invite code:`, error);
    alert('Failed to generate invite code. Please try again.');
  } finally {
    isGeneratingChannelInvite.value = false;
  }
};

// Copy Channel Invite Code
const copyChannelInviteCode = async (channelName) => {
  const code = channelInviteCodes.value[channelName];
  if (!code) return;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(code);
      // Show temporary success message
      const originalCode = code;
      channelInviteCodes.value[channelName] = 'Copied!';
      setTimeout(() => {
        channelInviteCodes.value[channelName] = originalCode;
      }, 1000);
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  } catch (error) {
    console.error('Failed to copy invite code:', error);
  }
};

// Manual copy function for mobile fallback
const copyInviteLinkManually = async () => {
  try {
    await navigator.clipboard.writeText(collaboratorInviteLink.value);
    inviteLinkCopied.value = true;
    setTimeout(() => {
      inviteLinkCopied.value = false;
    }, 2000);
  } catch (error) {
    console.error('Error copying invite link:', error);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = collaboratorInviteLink.value;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    inviteLinkCopied.value = true;
    setTimeout(() => {
      inviteLinkCopied.value = false;
    }, 2000);
  }
};

// Generate collaborator request link
const generateCollaboratorRequest = async () => {
  if (!authStore.user?.attributes?.email || !selectedfolderName.value) {
    successMessage.value = 'Please sign in and select a channel to generate a request link.';
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 3000);
    return;
  }

  // Check if user has a username set
  const hasUsername = currentUsername.value;
  if (!hasUsername) {
    successMessage.value = 'Please set a username in your account settings to generate collaborator request links.';
    showSuccessNotification.value = true;
    setTimeout(() => { showSuccessNotification.value = false; }, 5000);
    return;
  }

  isGeneratingRequest.value = true;
  collaboratorRequestLink.value = '';

  try {
    // Get the channel ID for the selected folder
    const channelId = selectedfolderName.value;
    const creatorUsername = hasUsername; // Use the actual username, not email prefix

    // Use the unified helper function to get poster URL for ALL channels - await it properly
    const posterUrl = await getChannelPosterUrlWithLocalAsset(selectedfolderName.value);

    // Create the full URL with poster if available
    const baseUrl = window.location.origin;
    let fullUrl = `${baseUrl}/collaborator-request/${creatorUsername}/${channelId}`;
    
    // Add meta info as query parameters (like collaborator invite)
    const title = channelId;
    const description = `Submit your interest in collaborating on ${channelId}. Share your stream concept and availability.`;
    
    // Build query parameters
    const queryParams = `title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;
    
    // Add poster URL as query parameter if available
    // Also include creator username for poster fetching
    if (posterUrl) {
      fullUrl += `?${queryParams}&poster=${encodeURIComponent(posterUrl)}&creator=${encodeURIComponent(creatorUsername)}`;
    } else {
      fullUrl += `?${queryParams}&creator=${encodeURIComponent(creatorUsername)}`;
    }

    // Use the same shortening logic as other links
    const shortUrlResponse = await taskStore.shortenUrl({ url: fullUrl });
    
    if (shortUrlResponse && shortUrlResponse.returnResult) {
      collaboratorRequestLink.value = shortUrlResponse.returnResult;
      successMessage.value = 'Collaborator request link generated! Copy it to share with potential collaborators.';
      showSuccessNotification.value = true;
      setTimeout(() => {
        showSuccessNotification.value = false;
      }, 3000);

      // Auto-copy the request link to clipboard
      try {
        await navigator.clipboard.writeText(collaboratorRequestLink.value);
        successMessage.value = 'Collaborator request link copied to clipboard!';
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        // Fallback for mobile
        const textArea = document.createElement('textarea');
        textArea.value = collaboratorRequestLink.value;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        successMessage.value = 'Collaborator request link copied!';
      }
    } else {
      throw new Error('Failed to generate short URL');
    }
  } catch (error) {
    console.error('Error generating collaborator request link:', error);
    successMessage.value = 'Error: ' + (error.message || 'Failed to generate collaborator request link');
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 3000);
  } finally {
    isGeneratingRequest.value = false;
  }
};

// Copy collaborator request link manually
const copyRequestLinkManually = async () => {
  try {
    await navigator.clipboard.writeText(collaboratorRequestLink.value);
    requestLinkCopied.value = true;
    setTimeout(() => {
      requestLinkCopied.value = false;
    }, 2000);
  } catch (error) {
    console.error('Error copying request link:', error);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = collaboratorRequestLink.value;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    requestLinkCopied.value = true;
    setTimeout(() => {
      requestLinkCopied.value = false;
    }, 2000);
  }
};

// Copy talent request link
const copyTalentRequestLink = async () => {
  try {
    await navigator.clipboard.writeText(talentRequestLink.value);
    talentRequestLinkCopied.value = true;
    setTimeout(() => {
      talentRequestLinkCopied.value = false;
    }, 2000);
  } catch (error) {
    console.error('Error copying talent request link:', error);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = talentRequestLink.value;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    talentRequestLinkCopied.value = true;
    setTimeout(() => {
      talentRequestLinkCopied.value = false;
    }, 2000);
  }
};



// Generate affiliate invite link
const generateAffiliateInvite = async () => {
  if (!authStore.user?.attributes?.email || !selectedfolderName.value) {
    affiliateInviteSuccessMessage.value = 'Please sign in and select a channel to generate an affiliate invite link.';
    setTimeout(() => {
      affiliateInviteSuccessMessage.value = '';
    }, 3000);
    return;
  }

  // Check if user has a username set
  const hasUsername = currentUsername.value;
  if (!hasUsername) {
    affiliateInviteSuccessMessage.value = 'Please set a username in your account settings to generate affiliate invite links.';
    setTimeout(() => {
      affiliateInviteSuccessMessage.value = '';
    }, 5000);
    return;
  }

  isGeneratingAffiliateInvite.value = true;
  affiliateInviteLink.value = '';
  affiliateInviteSuccessMessage.value = '';

  try {
    // Generate a unique invite code on the frontend
    const inviteCode = uuidv4();
    
    // Use the selected folder name directly
    const channelName = selectedfolderName.value;
    if (!channelName || channelName === 'default' || channelName === 'thumbnails') {
      console.error('No valid channel name found for affiliate invite');
      return;
    }
    
    // Use the unified helper function to get poster URL for ALL channels
    const posterUrl = await getChannelPosterUrlWithLocalAsset(channelName);
    console.log('🔗 Affiliate - Raw poster URL:', posterUrl);
    
    // Encode the poster URL for use in query parameters
    const encodedPosterUrl = posterUrl ? encodeURIComponent(posterUrl) : '';
    console.log('🔗 Affiliate - Encoded poster URL:', encodedPosterUrl);
    
    // Store affiliate invite information in DynamoDB
    const affiliateInviteRecord = {
      PK: 'AFFILIATE_INVITE',
      SK: inviteCode,
      channelName: channelName,
      channelOwnerEmail: authStore.user.attributes.email,
      channelOwnerId: authStore.user.attributes.sub,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      status: 'active',
      commissionRate: 0.1 // 10% commission for affiliates
    };

    // Store the affiliate invite record
    try {
      await $fetch('/api/affiliates/store-invite', {
        method: 'POST',
        body: affiliateInviteRecord
      });
    } catch (error) {
      console.error('Failed to store affiliate invite:', error);
    }

    // Build the affiliate invite URL with meta info
    // Use the production domain for affiliate invites to ensure they work correctly
    const longUrl = `https://twilly.app/affiliate/${inviteCode}/${channelName}`;
    const meta = {
      title: channelName,
      description: `Join as an affiliate and earn commissions by inviting collaborators to ${channelName} with Twilly!`,
      poster: posterUrl
    };
    
    // Append meta info as query params (include poster if available)
    // Also include creator username for poster fetching
    const shouldIncludePoster = posterUrl && !posterUrl.includes('icon-512.png') && posterUrl !== '/assets/channels/icon-512.png';
    console.log('🔗 Affiliate - shouldIncludePoster:', shouldIncludePoster);
    console.log('🔗 Affiliate - posterUrl check:', { posterUrl, hasIcon: posterUrl?.includes('icon-512.png'), isDefault: posterUrl === '/assets/channels/icon-512.png' });
    
    const urlWithMeta = `${longUrl}?title=${encodeURIComponent(meta.title)}&description=${encodeURIComponent(meta.description)}&creator=${encodeURIComponent(currentUsername.value)}${shouldIncludePoster ? `&poster=${posterUrl}` : ''}`;
    console.log('🔗 Affiliate - Final URL with meta:', urlWithMeta);
    
    // Use the same shortening logic as collaborator invites (exact same approach)
    let shortUrl = '';
    try {
      shortUrl = await taskStore.shortenUrl({ 
        url: urlWithMeta,
        creator: currentUsername.value,
        series: channelName,
        userEmail: authStore.user.attributes.email
      });
    } catch (e) {
      shortUrl = { returnResult: urlWithMeta };
    }
    
    affiliateInviteLink.value = shortUrl.returnResult || urlWithMeta;
    affiliateInviteSuccessMessage.value = 'Affiliate invite link generated! Copy it to share with potential affiliates.';
    
    // Auto-copy the invite link to clipboard with mobile fallback
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(affiliateInviteLink.value);
        affiliateInviteSuccessMessage.value = 'Affiliate invite link copied!';
      } else {
        // Fallback for older browsers and mobile
        const textArea = document.createElement('textarea');
        textArea.value = affiliateInviteLink.value;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          affiliateInviteSuccessMessage.value = 'Affiliate invite link copied!';
        } else {
          affiliateInviteSuccessMessage.value = 'Affiliate invite link generated!';
        }
      }
    } catch (e) {
      console.error('Error copying affiliate invite link:', e);
      affiliateInviteSuccessMessage.value = 'Affiliate invite link generated!';
    }
    
  } catch (error) {
    console.error('Error generating affiliate invite:', error);
    affiliateInviteSuccessMessage.value = 'Error: ' + (error.message || 'Failed to generate affiliate invite link');
  } finally {
    isGeneratingAffiliateInvite.value = false;
  }
};

// Copy affiliate invite link manually
const copyAffiliateInviteLinkManually = async () => {
  try {
    await navigator.clipboard.writeText(affiliateInviteLink.value);
    affiliateInviteLinkCopied.value = true;
    setTimeout(() => {
      affiliateInviteLinkCopied.value = false;
    }, 2000);
  } catch (error) {
    console.error('Error copying affiliate invite link:', error);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = affiliateInviteLink.value;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    affiliateInviteLinkCopied.value = true;
    setTimeout(() => {
      affiliateInviteLinkCopied.value = false;
    }, 2000);
  }
};

// Talent request form variables
const talentRequestForm = ref({
  projectTitle: '',
  streamType: '',
  showConcept: '',
  castingNeeds: '',
  streamLength: '',
  startDate: '',
  location: '',
  timeSlots: [],
  revenueShare: '',
  tags: [],
  isPublic: true
});

const isCreatingTalentRequest = ref(false);

// Channel talent requests
const channelTalentRequests = ref([]);

// Talent request helper functions
const getTalentStatusBadgeClass = (status) => {
  const classes = {
    'accepting_pilots': 'bg-green-500/20 text-green-400 border border-green-500/30',
    'casting_closed': 'bg-red-500/20 text-red-400 border border-red-500/30',
    'scheduled': 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
  }
  return classes[status] || 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
}

const getTalentStatusText = (status) => {
  const texts = {
    'accepting_pilots': 'Accepting Pilots',
    'casting_closed': 'Casting Closed',
    'scheduled': 'Scheduled'
  }
  return texts[status] || status
}

// Create talent request
const createTalentRequest = async () => {
  if (!authStore.user?.attributes?.email || !selectedfolderName.value) {
    successMessage.value = 'Please sign in and select a channel to create a talent request.';
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 3000);
    return;
  }

  // Validate required fields
  if (!talentRequestForm.value.projectTitle || !talentRequestForm.value.streamType || 
      !talentRequestForm.value.showConcept || !talentRequestForm.value.castingNeeds ||
      !talentRequestForm.value.streamLength || !talentRequestForm.value.startDate ||
      !talentRequestForm.value.location || talentRequestForm.value.timeSlots.length === 0) {
    successMessage.value = 'Please fill in all required fields.';
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 3000);
    return;
  }

  isCreatingTalentRequest.value = true;

  try {
    const response = await $fetch('/api/talent-requests/create', {
      method: 'POST',
      body: {
        ...talentRequestForm.value,
        channel: selectedfolderName.value,
        creatorEmail: authStore.user.attributes.email,
        creatorUsername: currentUsername.value || authStore.user?.attributes?.username || authStore.user?.attributes?.preferred_username || authStore.user?.attributes?.email?.split('@')[0] || 'Unknown'
      }
    });

    if (response.success) {
      successMessage.value = 'Talent request created successfully!';
      showSuccessNotification.value = true;
      setTimeout(() => {
        showSuccessNotification.value = false;
      }, 3000);

      // Clear the form
      clearTalentRequestForm();
      
      // Generate the share link automatically
      await generateTalentRequest();
    } else {
      successMessage.value = 'Error: ' + (response.message || 'Failed to create talent request');
      showSuccessNotification.value = true;
      setTimeout(() => {
        showSuccessNotification.value = false;
      }, 3000);
    }
  } catch (error) {
    console.error('Error creating talent request:', error);
    successMessage.value = 'Error: ' + (error.message || 'Failed to create talent request');
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 3000);
  } finally {
    isCreatingTalentRequest.value = false;
  }
};

// Clear talent request form
const clearTalentRequestForm = () => {
  talentRequestForm.value = {
    projectTitle: '',
    streamType: '',
    showConcept: '',
    castingNeeds: '',
    streamLength: '',
    startDate: '',
    location: '',
    timeSlots: [],
    revenueShare: '',
    tags: [],
    isPublic: true
  };
};

// Load channel talent requests
const loadChannelTalentRequests = async () => {
  if (authStore.user?.attributes?.email && selectedfolderName.value) {
    try {
      await talentRequestsStore.loadRequestsByChannel(authStore.user.attributes.email, selectedfolderName.value);
      channelTalentRequests.value = talentRequestsStore.requests;
    } catch (error) {
      console.error('Error loading channel talent requests:', error);
      channelTalentRequests.value = [];
    }
  }
};

// Generate talent request link for a specific request
const generateTalentRequestForRequest = async (request) => {
  if (!authStore.user?.attributes?.email || !request) {
    successMessage.value = 'Please sign in and select a request to generate a link.';
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 3000);
    return;
  }

  // Check if user has a username set
  const hasUsername = currentUsername.value;
  if (!hasUsername) {
    successMessage.value = 'Please set a username in your account settings to generate talent request links.';
    showSuccessNotification.value = true;
    setTimeout(() => { showSuccessNotification.value = false; }, 5000);
    return;
  }

  isGeneratingRequest.value = true;
  talentRequestLink.value = '';

  try {
    // Get the channel ID and creator username
    const channelId = request.channel;
    const creatorUsername = hasUsername;

    // Use the unified helper function to get poster URL for ALL channels - await it properly
    const posterUrl = await getChannelPosterUrlWithLocalAsset(channelId);

    // Create the full URL with poster if available
    const baseUrl = window.location.origin;
    let fullUrl = `${baseUrl}/talent-request/${creatorUsername}/${channelId}`;
    
    // Add meta info as query parameters
    const title = request.projectTitle;
    const description = `Submit your interest in collaborating on ${request.projectTitle}. Share your stream concept and availability.`;
    
    // Build query parameters
    const queryParams = `title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;
    
    // Add poster URL as query parameter if available
    // Also include creator username for poster fetching
    if (posterUrl) {
      fullUrl += `?${queryParams}&poster=${encodeURIComponent(posterUrl)}&creator=${encodeURIComponent(creatorUsername)}`;
    } else {
      fullUrl += `?${queryParams}&creator=${encodeURIComponent(creatorUsername)}`;
    }

    // Use the same shortening logic as other links
    const shortUrlResponse = await taskStore.shortenUrl({ url: fullUrl });
    
    if (shortUrlResponse && shortUrlResponse.returnResult) {
      talentRequestLink.value = shortUrlResponse.returnResult;
      successMessage.value = 'Talent request link generated! Copy it to share with potential collaborators.';
      showSuccessNotification.value = true;
      setTimeout(() => {
        showSuccessNotification.value = false;
      }, 3000);

      // Auto-copy the request link to clipboard
      try {
        await navigator.clipboard.writeText(talentRequestLink.value);
        successMessage.value = 'Talent request link copied to clipboard!';
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        // Fallback for mobile
        const textArea = document.createElement('textarea');
        textArea.value = talentRequestLink.value;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        successMessage.value = 'Talent request link copied!';
      }
    } else {
      throw new Error('Failed to generate short URL');
    }
  } catch (error) {
    console.error('Error generating talent request link:', error);
    successMessage.value = 'Error: ' + (error.message || 'Failed to generate talent request link');
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 3000);
  } finally {
    isGeneratingRequest.value = false;
  }
};

// Cleanup timers on unmount
onUnmounted(() => {
  stopPollingForUpdates();
});

// Manual refresh function to test data updates
const manualRefresh = async () => {
  if (!authStore.user?.attributes?.email) return;
  
  console.log('Manual refresh triggered');
  await fileStore.getFiles(currentUser.value);
  debugFiles();
};

// Debug refresh function to help troubleshoot
const debugRefresh = async () => {
  console.log('🔍 Debug refresh triggered');
  console.log('🔍 Current auth state:', {
    authenticated: authStore.authenticated,
    user: authStore.user,
    userType: authStore.userType
  });
  
  if (authStore.authenticated && authStore.user?.attributes?.email) {
    console.log('🔍 User email:', authStore.user.attributes.email);
    console.log('🔍 Attempting to load files...');
    
    try {
      await fileStore.getFiles(authStore.user.attributes.email);
      console.log('🔍 Files loaded successfully');
      console.log('🔍 Folders count:', fileStore.folders?.length);
      console.log('🔍 Folders:', fileStore.folders);
      console.log('🔍 Files count:', fileStore.files?.length);
    } catch (error) {
      console.error('🔍 Error loading files:', error);
    }
  } else {
    console.log('🔍 Not authenticated, trying to initialize...');
    try {
      await authStore.initializeAuth();
      console.log('🔍 After initializeAuth:', {
        authenticated: authStore.authenticated,
        user: authStore.user
      });
    } catch (error) {
      console.error('🔍 Error initializing auth:', error);
    }
  }
};

// Debug username function to help troubleshoot username issues
const debugUsername = async () => {
  console.log('🔍 Debug username triggered');
  console.log('🔍 Current username state:', {
    currentUsername: currentUsername.value,
    currentUsernameType: typeof currentUsername.value,
    currentUsernameLength: currentUsername.value?.length
  });
  
  console.log('🔍 Auth store username:', authStore.user?.attributes?.username);
  console.log('🔍 Auth store email:', authStore.user?.attributes?.email);
  
  try {
    console.log('🔍 Attempting to fetch username with fallbacks...');
    const username = await getUsernameWithFallbacks();
    console.log('🔍 Fetched username:', username);
    
    if (username) {
      currentUsername.value = username;
      console.log('🔍 Updated currentUsername.value to:', currentUsername.value);
    }
  } catch (error) {
    console.error('🔍 Error fetching username:', error);
  }
};

// In the <script setup> section, add:
const downloadVideoAsMp4 = async (video) => {
  // Check if this is a collaborator video and add restrictions
  if (video.isCollaboratorVideo && !authStore.canAccessManagefiles()) {
    alert('This is a collaborator video. Only the master account can download videos. Please contact the channel owner to download this video.');
    return;
  }

  if (!video.hlsUrl && !video.url) {
    alert('No video URL available for download');
    return;
  }

  try {
    downloadingFileIds.value[video.SK] = true;

    // Show progress notification
    successMessage.value = 'Processing video download...';
    showSuccessNotification.value = true;

    // Prepare the request body based on URL type
    const requestBody = {
      fileName: video.fileName || video.title || 'video',
      userId: authStore.user?.attributes?.email
    };

    // Add the appropriate URL to the request
    if (video.hlsUrl) {
      requestBody.hlsUrl = video.hlsUrl;
    } else if (video.url) {
      requestBody.videoUrl = video.url;
    }

    // Call the server API to process the video
    const response = await $fetch('/api/files/download-video', {
      method: 'POST',
      body: requestBody
    });

    if (response.success && response.downloadUrl) {
      try {
        // Fetch the file as a blob
        const fileResponse = await fetch(response.downloadUrl);
        if (!fileResponse.ok) {
          throw new Error(`Failed to fetch file: ${fileResponse.status}`);
        }
        
        const blob = await fileResponse.blob();
        
        // Simple logic: use original filename unless it's m3u8
        let fileName = video.fileName || video.title || 'video';
        
        // Only change extension if it's m3u8 (convert to mp4)
        if (fileName.toLowerCase().endsWith('.m3u8') || fileName.toLowerCase().endsWith('.m3u')) {
          fileName = fileName.replace(/\.(m3u8|m3u)$/i, '.mp4');
        }
        
        // Mobile-specific download handling
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
          // For mobile devices, show options to view or download
          const shouldDownload = confirm('Would you like to download the video? Click "OK" to download, "Cancel" to view in browser.');
          
          if (shouldDownload) {
            // Standard mobile download - fetch as blob and download
            try {
              const videoResponse = await fetch(response.downloadUrl);
              if (!videoResponse.ok) {
                throw new Error('Failed to fetch video');
              }
              
              const videoBlob = await videoResponse.blob();
              const videoUrl = URL.createObjectURL(videoBlob);
              
              const link = document.createElement('a');
              link.href = videoUrl;
              link.download = fileName;
              link.style.display = 'none';
              
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              
              // Cleanup
              setTimeout(() => {
                URL.revokeObjectURL(videoUrl);
              }, 1000);
              
              successMessage.value = 'Video download started! Check your Downloads folder.';
            } catch (error) {
              console.error('Download failed, opening in browser:', error);
              // Fallback to browser view
              const link = document.createElement('a');
              link.href = response.downloadUrl;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              
              successMessage.value = 'Video opened in browser. Use browser save option.';
            }
          } else {
            // View in browser option
            const link = document.createElement('a');
            link.href = response.downloadUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            successMessage.value = 'Video opened in browser for viewing.';
          }
        } else {
          // Desktop download with blob
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = fileName;
          link.style.display = 'none';
          
          // Add to DOM, click, and cleanup
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up the blob URL
          setTimeout(() => {
            URL.revokeObjectURL(link.href);
          }, 100);

          successMessage.value = 'Video downloaded successfully!';
        }
      } catch (downloadError) {
        console.error('Error downloading file:', downloadError);
        // Fallback to direct link if fetch fails
        const link = document.createElement('a');
        link.href = response.downloadUrl;
        link.download = fileName; // Use the same filename
        link.target = '_blank'; // Open in new tab for direct link fallback
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        successMessage.value = 'Video download started!';
      }
    } else {
      throw new Error(response.message || 'Failed to process video');
    }
  } catch (error) {
    console.error('Error downloading video:', error);
    successMessage.value = `Error: ${error.message || 'Failed to download video'}`;
  } finally {
    downloadingFileIds.value[video.SK] = false;
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 3000);
  }
};

// Generate talent request link
const generateTalentRequest = async () => {
  if (!authStore.user?.attributes?.email || !selectedfolderName.value) {
    successMessage.value = 'Please sign in and select a channel to generate a talent request link.';
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 3000);
    return;
  }

  // Check if user has a username set
  const hasUsername = currentUsername.value;
  if (!hasUsername) {
    successMessage.value = 'Please set a username in your account settings to generate talent request links.';
    showSuccessNotification.value = true;
    setTimeout(() => { showSuccessNotification.value = false; }, 5000);
    return;
  }

  isGeneratingRequest.value = true;
  talentRequestLink.value = '';

  try {
    // Get the channel ID for the selected folder
    const channelId = selectedfolderName.value;
    const creatorUsername = hasUsername; // Use the actual username, not email prefix

    // Use the unified helper function to get poster URL for ALL channels - await it properly
    const posterUrl = await getChannelPosterUrlWithLocalAsset(selectedfolderName.value);

    // Create the full URL with poster if available
    const baseUrl = window.location.origin;
    let fullUrl = `${baseUrl}/talent-request/${creatorUsername}/${channelId}`;
    
    // Add meta info as query parameters (like collaborator invite)
    const title = channelId;
    const description = `Submit your interest in collaborating on ${channelId}. Share your stream concept and availability.`;
    
    // Build query parameters
    const queryParams = `title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;
    
    // Add poster URL as query parameter if available
    // Also include creator username for poster fetching
    if (posterUrl) {
      fullUrl += `?${queryParams}&poster=${encodeURIComponent(posterUrl)}&creator=${encodeURIComponent(creatorUsername)}`;
    } else {
      fullUrl += `?${queryParams}&creator=${encodeURIComponent(creatorUsername)}`;
    }

    // Use the same shortening logic as other links
    const shortUrlResponse = await taskStore.shortenUrl({ url: fullUrl });
    
    if (shortUrlResponse && shortUrlResponse.returnResult) {
      talentRequestLink.value = shortUrlResponse.returnResult;
      successMessage.value = 'Talent request link generated! Copy it to share with potential collaborators.';
      showSuccessNotification.value = true;
      setTimeout(() => {
        showSuccessNotification.value = false;
      }, 3000);

      // Auto-copy the request link to clipboard
      try {
        await navigator.clipboard.writeText(talentRequestLink.value);
        successMessage.value = 'Talent request link copied to clipboard!';
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        // Fallback for mobile
        const textArea = document.createElement('textarea');
        textArea.value = talentRequestLink.value;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        successMessage.value = 'Talent request link copied!';
      }
    } else {
      throw new Error('Failed to generate short URL');
    }
  } catch (error) {
    console.error('Error generating talent request link:', error);
    successMessage.value = 'Error: ' + (error.message || 'Failed to generate talent request link');
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 3000);
  } finally {
    isGeneratingRequest.value = false;
  }
};

</script>

<style scoped>
.aspect-video {
  aspect-ratio: 16 / 9;
}

/* Video player aspect ratio fixes - prevent stretching */
:deep(.video-js .vjs-tech),
:deep(.video-js video) {
  object-fit: contain !important;
  width: 100% !important;
  height: 100% !important;
}

/* Remove padding-top from video.js fluid mode if present */
:deep(.video-js.vjs-fluid) {
  padding-top: 0 !important;
  height: auto !important;
}

/* Remove any conflicting styles from reminders.css if necessary */
.group {
  cursor: pointer;
}

/* Smooth transitions */
* {
  transition: all 0.2s ease;
}

/* Card hover effects */
.bg-white\/5:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

/* Input focus animations */
input:focus, select:focus {
  transform: scale(1.02);
}

/* Button animations */
button:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

button:not(:disabled):active {
  transform: translateY(0);
}

/* Loading spinner animation */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Gradient text effect */
.gradient-text {
  background: linear-gradient(135deg, #14b8a6, #06b6d4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Glass morphism effect */
.glass {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* Responsive design improvements */
@media (max-width: 640px) {
  .pt-16 {
    padding-top: 6rem;
  }
}

/* Smooth page transitions */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}
</style>
