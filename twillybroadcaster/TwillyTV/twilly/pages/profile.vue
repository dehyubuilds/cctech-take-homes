<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black">
    <!-- Onboarding Flow (only for non-producers) -->
    <OnboardingFlow 
      v-if="!isMainProducer"
      :user-role="userRole" 
      :has-payout-setup="hasPayoutSetup" 
    />

    <!-- Loading State with fade-in animation -->
    <div v-if="isLoading" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400 mb-4"></div>
        <p class="text-white text-lg">Loading your account...</p>
      </div>
    </div>

    <!-- Not Authenticated State -->
    <div v-else-if="!authStore.authenticated" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-400 mb-4"></div>
        <p class="text-white text-lg">Redirecting to sign-in...</p>
        <p class="text-gray-400 text-sm mt-2">If you're not redirected automatically, <a href="/signin" class="text-blue-400 hover:text-blue-300 underline">click here</a></p>
      </div>
    </div>

    <!-- Main Content Container (only show if authenticated) -->
    <div v-if="authStore.authenticated" class="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
      <!-- Error State -->
      <div v-if="error" class="text-center mb-8">
        <div class="bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg p-4">
          {{ error }}
        </div>
      </div>

      <!-- Success/Error notification -->
      <div
        v-if="showSuccessNotification"
        class="fixed bottom-4 left-1/2 transform -translate-x-1/2 backdrop-blur-sm
               text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2
               border z-50 animate-fade-in"
        :class="[
          successMessage.startsWith('Error:')
            ? 'bg-red-500/90 border-red-400/50'
            : 'bg-green-500/90 border-green-400/50'
        ]"
      >
        <Icon 
          :name="successMessage.startsWith('Error:') ? 'heroicons:exclamation-triangle' : 'heroicons:check-circle'" 
          class="w-5 h-5" 
        />
        {{ successMessage }}
      </div>

      <!-- Content (only shown when loaded) -->
      <div v-else class="content-enter-active">
        <!-- User Info Header -->
        <div class="text-center mb-8 sm:mb-12 lg:mb-16">
          <div class="bg-black/30 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-6 sm:p-8 lg:p-12 mb-6">
            <div class="flex items-center justify-center mb-6 sm:mb-8">
              <div class="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center">
                <Icon name="heroicons:user" class="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 text-white" />
              </div>
            </div>
            <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3">
              {{ userDisplayName }}
            </h1>
            <p class="text-gray-300 mb-4 text-base sm:text-lg">{{ userEmail }}</p>
            
            <!-- Account Status -->
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-gray-500/20 text-gray-300 border border-gray-500/30">
              <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
              <span>Account Active</span>
            </div>
          </div>
        </div>

        <!-- Persona Status Section (Simplified) -->
        <div v-if="isRoleDetectionComplete" class="mb-8 sm:mb-12">
          <div class="bg-black/30 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-4 sm:p-6 lg:p-8">
            <h3 class="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
              <Icon name="heroicons:user-circle" class="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-teal-400" />
              Current Persona
            </h3>
            
            <div class="flex items-center justify-center">
              <div class="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-xl text-base sm:text-lg font-medium"
                 :class="[
                     currentPersona === 'master'
                     ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' 
                       : currentPersona === 'creator'
                       ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                       : currentPersona === 'affiliate'
                       ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                       : currentPersona === 'viewer'
                       ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                     : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                 ]">
                <!-- Master Account Icon -->
                <svg v-if="currentPersona === 'master'" class="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                <!-- Creator Icon -->
                <svg v-else-if="currentPersona === 'creator'" class="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
                </svg>
                <!-- Affiliate Icon -->
                <svg v-else-if="currentPersona === 'affiliate'" class="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd"/>
                </svg>
                <!-- Viewer Icon -->
                <svg v-else-if="currentPersona === 'viewer'" class="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                </svg>
                <!-- Default User Icon -->
                <svg v-else class="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                </svg>
                <span>{{ getPersonaDisplayName(currentPersona) }}</span>
              </div>
            </div>
            
            <!-- Active Channel Info for Creator Persona -->
            <div v-if="currentPersona === 'creator' && authStore.activeChannel" class="mt-4">
              <div class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/10 text-blue-200 border border-blue-500/20">
                <Icon name="heroicons:tv" class="w-4 h-4" />
                <span>Active Channel: {{ authStore.activeChannel }}</span>
              </div>
            </div>
            
            <!-- Available Channels Info for Creator Persona -->
            <div v-if="currentPersona === 'creator' && authStore.availableChannels.length > 1" class="mt-2">
              <div class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/10 text-blue-200 border border-blue-500/20">
                <Icon name="heroicons:user-group" class="w-4 h-4" />
                <span>{{ authStore.availableChannels.length }} channels available</span>
              </div>
              
              <!-- Quick Channel Switcher -->
              <div class="mt-3">
                <div class="flex flex-wrap gap-2 justify-center">
                  <button 
                    v-for="channel in authStore.availableChannels"
                    :key="channel.channelName"
                    @click="switchCreatorChannel(channel.channelName)"
                    :class="[
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                      channel.channelName === authStore.activeChannel
                        ? 'bg-blue-500 text-white border border-blue-400'
                        : 'bg-blue-500/20 text-blue-200 border border-blue-500/30 hover:bg-blue-500/30'
                    ]"
                  >
                    {{ channel.channelName }}
                  </button>
                </div>
              </div>
            </div>
            
            <p class="text-center text-gray-400 text-sm mt-4">
              Use the persona switcher in the navigation bar to change your active persona
            </p>
          </div>
        </div>

        <!-- Persona Activation Section Notice (Hidden for Master Accounts) -->
        <div v-if="isRoleDetectionComplete && (canActivateAffiliate || canActivateCreator) && !isMainProducer" class="mb-12 sm:mb-16">
          <div class="bg-black/30 backdrop-blur-sm rounded-2xl border border-orange-500/30 p-6 sm:p-8">
            <h3 class="text-xl sm:text-2xl font-semibold text-white mb-6 flex items-center gap-3">
              <Icon name="heroicons:plus-circle" class="w-6 h-6 sm:w-8 sm:h-8 text-orange-400" />
              Activate New Personas
            </h3>
            <p class="text-gray-300 text-sm">
              Personas are activated by accepting personal invites.
            </p>
          </div>
        </div>

        <!-- Persona Activation Section -->
        <div v-if="false && isRoleDetectionComplete && (canActivateAffiliate || canActivateCreator)" class="mb-12 sm:mb-16">
          <div class="bg-black/30 backdrop-blur-sm rounded-2xl border border-orange-500/30 p-6 sm:p-8">
            <h3 class="text-xl sm:text-2xl font-semibold text-white mb-6 flex items-center gap-3">
              <Icon name="heroicons:plus-circle" class="w-6 h-6 sm:w-8 sm:h-8 text-orange-400" />
              Activate New Personas
            </h3>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Affiliate Activation -->
              <div v-if="canActivateAffiliate" class="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6">
                <div class="flex items-center gap-3 mb-4">
                  <Icon name="heroicons:link" class="w-8 h-8 text-purple-400" />
                  <h4 class="text-lg font-semibold text-white">Become an Affiliate</h4>
                </div>
                <p class="text-gray-300 mb-4 text-sm">
                  Earn commissions by promoting content. You'll need an affiliate invite code from a creator.
                </p>
                <div class="flex flex-col sm:flex-row gap-3">
                  <input
                    v-model="affiliateInviteCode"
                    type="text"
                    placeholder="Enter affiliate invite code"
                    class="flex-1 px-4 py-3 bg-black/30 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 min-w-0"
                  />
                  <button
                    @click="activateAffiliatePersona"
                    :disabled="isActivatingAffiliate || !affiliateInviteCode.trim()"
                    class="px-6 py-3 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                  >
                    <Icon v-if="isActivatingAffiliate" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                    <span v-else>Activate</span>
                  </button>
                </div>
              </div>

              <!-- Creator Activation -->
              <div v-if="canActivateCreator" class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
                <div class="flex items-center gap-3 mb-4">
                  <Icon name="heroicons:user-group" class="w-8 h-8 text-blue-400" />
                  <h4 class="text-lg font-semibold text-white">Become a Creator</h4>
                </div>
                <p class="text-gray-300 mb-4 text-sm">
                  Create and manage content for a channel. You'll need a creator invite code from a channel owner.
                </p>
                <div class="flex flex-col sm:flex-row gap-3">
                  <input
                    v-model="creatorInviteCode"
                    type="text"
                    placeholder="Enter creator invite code"
                    class="flex-1 px-4 py-3 bg-black/30 border border-blue-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 min-w-0"
                  />
                  <button
                    @click="activateCreatorPersona"
                    :disabled="isActivatingCreator || !creatorInviteCode.trim()"
                    class="px-6 py-3 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                  >
                    <Icon v-if="isActivatingCreator" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                    <span v-else>Activate</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Role-Based Dashboard -->
        <div class="space-y-12 sm:space-y-16 lg:space-y-20">

          
          <!-- Role-Based Header -->
          <div class="text-center mb-12 sm:mb-16">
            <div class="max-w-4xl mx-auto">
              <!-- Producer Header -->
              <div v-if="isRoleDetectionComplete && isMainProducer">
                <h2 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
                  Master Account <span class="text-teal-400">Dashboard</span>
                </h2>
                <p class="text-gray-300 text-xl sm:text-2xl mb-8">
                  Manage your content, track earnings, and grow your audience
                </p>
                <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    type="button"
                    @click="refreshData"
                    :disabled="isRefreshing"
                    class="px-6 py-4 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon v-if="isRefreshing" name="heroicons:arrow-path" class="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                    <Icon v-else name="heroicons:arrow-path" class="w-5 h-5 sm:w-6 sm:h-6" />
                    {{ isRefreshing ? 'Refreshing…' : 'Refresh' }}
                  </button>
                  <nuxt-link
                    to="/managefiles"
                    class="px-6 py-4 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-xl hover:bg-teal-500/30 transition-all duration-300 flex items-center justify-center gap-3 text-base sm:text-lg"
                  >
                    <Icon name="heroicons:arrow-right" class="w-5 h-5 sm:w-6 sm:h-6" />
                    Manage Content
                  </nuxt-link>
                </div>
              </div>

              <!-- Loading State -->
              <div v-else-if="!isRoleDetectionComplete">
                <h2 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
                  Loading <span class="text-teal-400">Dashboard</span>
                </h2>
                <p class="text-gray-300 text-xl sm:text-2xl mb-8">
                  Detecting your role and permissions...
                </p>
                <div class="flex justify-center">
                  <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400"></div>
                </div>
              </div>

              <!-- Non-Producer Header -->
              <div v-else-if="isRoleDetectionComplete && !isMainProducer">
                <h2 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
                  <span v-if="userRole === 'Multi-Role'" class="text-teal-400">Multi-Role</span>
                  <span v-else-if="userRole === 'Collaborator'" class="text-teal-400">Collaborator</span>
                  <span v-else-if="userRole === 'Casting Director'" class="text-teal-400">Casting Director</span>
                  <span v-else-if="userRole === 'Viewer'" class="text-teal-400">Viewer</span>
                  <span v-else-if="userRole === 'User'" class="text-teal-400">User</span>
                  <span v-else class="text-gray-400">Account</span>
                  <span class="text-teal-400"> Dashboard</span>
                </h2>
                <p class="text-gray-300 text-xl sm:text-2xl mb-8">
                  <span v-if="userRole === 'Multi-Role'">
                    Manage your subscriptions, collaborations, and casting director activities
                  </span>
                  <span v-else-if="userRole === 'Collaborator'">
                    Manage your collaboration requests and track your earnings
                  </span>
                  <span v-else-if="userRole === 'Casting Director'">
                    Manage your casting director activities and referral links
                  </span>
                  <span v-else-if="userRole === 'Viewer'">
                    Manage your channel subscriptions and discover new content
                  </span>
                  <span v-else-if="userRole === 'User'">
                    Your account is ready! Subscribe to channels or accept invites to get started.
                  </span>
                  <span v-else>
                    Your account is ready! Subscribe to channels or accept invites to get started.
                  </span>
                </p>
                <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    type="button"
                    @click="refreshData"
                    :disabled="isRefreshing"
                    class="px-6 py-4 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon v-if="isRefreshing" name="heroicons:arrow-path" class="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                    <Icon v-else name="heroicons:arrow-path" class="w-5 h-5 sm:w-6 sm:h-6" />
                    {{ isRefreshing ? 'Refreshing…' : 'Refresh' }}
                  </button>
                  <nuxt-link
                    to="/managefiles"
                    class="px-6 py-4 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-xl hover:bg-teal-500/30 transition-all duration-300 flex items-center justify-center gap-3 text-base sm:text-lg"
                  >
                    <Icon name="heroicons:arrow-right" class="w-5 h-5 sm:w-6 sm:h-6" />
                    View Dashboard
                  </nuxt-link>
                </div>
              </div>
            </div>
          </div>

          <!-- Stats Cards (Producers Only) -->
          <div v-if="isRoleDetectionComplete && isMainProducer" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-gray-400 text-sm sm:text-base">Total Earnings</p>
                  <p class="text-3xl sm:text-4xl font-bold text-white">${{ totalEarnings.toFixed(2) }}</p>
                </div>
                <Icon name="heroicons:currency-dollar" class="w-10 h-10 sm:w-12 sm:h-12 text-teal-400" />
              </div>
            </div>

            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-gray-400 text-sm sm:text-base">Active Subscriptions</p>
                  <p class="text-3xl sm:text-4xl font-bold text-white">{{ earningsData.totalSubscriptions || 0 }}</p>
                </div>
                <Icon name="heroicons:users" class="w-10 h-10 sm:w-12 sm:h-12 text-teal-400" />
              </div>
            </div>

            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-gray-400 text-sm sm:text-base">Content Menus</p>
                  <p class="text-3xl sm:text-4xl font-bold text-white">{{ contentMenusCount }}</p>
                </div>
                <Icon name="heroicons:folder" class="w-10 h-10 sm:w-12 sm:h-12 text-teal-400" />
              </div>
            </div>

            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-gray-400 text-sm sm:text-base">Active Stream Keys</p>
                  <p class="text-3xl sm:text-4xl font-bold text-white">{{ activeStreamKeysCount }}</p>
                </div>
                <Icon name="heroicons:video-camera" class="w-10 h-10 sm:w-12 sm:h-12 text-teal-400" />
              </div>
            </div>
          </div>


          <!-- Affiliate Persona Dashboard -->
          <div v-if="isRoleDetectionComplete && isAffiliatePersona" class="space-y-8">
            <!-- Affiliate Stats -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-8">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-gray-400 text-sm sm:text-base">Total Commissions</p>
                    <p class="text-3xl sm:text-4xl font-bold text-white">${{ (authStore.commissionRate * 100).toFixed(1) }}%</p>
                  </div>
                  <Icon name="heroicons:currency-dollar" class="w-10 h-10 sm:w-12 sm:h-12 text-purple-400" />
                </div>
              </div>
              
              <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-8">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-gray-400 text-sm sm:text-base">Affiliate Code</p>
                    <p class="text-lg sm:text-xl font-bold text-white">{{ authStore.affiliateCode || 'N/A' }}</p>
                  </div>
                  <Icon name="heroicons:link" class="w-10 h-10 sm:w-12 sm:h-12 text-purple-400" />
                </div>
              </div>
              
              <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-8">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-gray-400 text-sm sm:text-base">Links Generated</p>
                    <p class="text-3xl sm:text-4xl font-bold text-white">0</p>
                  </div>
                  <Icon name="heroicons:share" class="w-10 h-10 sm:w-12 sm:h-12 text-purple-400" />
                </div>
              </div>
            </div>


            <!-- Affiliate Earnings -->
            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-8 sm:p-12">
              <h3 class="text-2xl sm:text-3xl font-semibold text-white mb-8 flex items-center gap-3">
                <Icon name="heroicons:chart-bar" class="w-8 h-8 sm:w-10 sm:h-10 text-purple-400" />
                Earnings Dashboard
              </h3>
              
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6">
                  <div class="flex items-center gap-3 mb-2">
                    <Icon name="heroicons:banknotes" class="w-6 h-6 text-purple-400" />
                    <span class="text-gray-300">Total Earnings</span>
                  </div>
                  <p class="text-2xl font-bold text-white">$0.00</p>
                </div>
                
                <div class="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6">
                  <div class="flex items-center gap-3 mb-2">
                    <Icon name="heroicons:calendar" class="w-6 h-6 text-purple-400" />
                    <span class="text-gray-300">This Month</span>
                  </div>
                  <p class="text-2xl font-bold text-white">$0.00</p>
                </div>
                
                <div class="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6">
                  <div class="flex items-center gap-3 mb-2">
                    <Icon name="heroicons:clock" class="w-6 h-6 text-purple-400" />
                    <span class="text-gray-300">Pending</span>
                  </div>
                  <p class="text-2xl font-bold text-white">$0.00</p>
                </div>
              </div>
              
              <div class="text-center text-gray-400">
                <Icon name="heroicons:chart-bar" class="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No earnings data available yet. Start promoting content to see your commissions here!</p>
              </div>
            </div>

            <!-- Generate Collaborator Invites -->
            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-4 sm:p-6 lg:p-8">
              <h3 class="text-xl sm:text-2xl lg:text-3xl font-semibold text-white mb-6 sm:mb-8 flex items-center gap-2 sm:gap-3">
                <Icon name="heroicons:user-plus" class="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-purple-400" />
                Generate Collaborator Invites
              </h3>
              
              <div class="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
                <p class="text-gray-300 mb-3 sm:mb-4 text-sm sm:text-base">
                  Create collaborator invites for your available channels.
                  <span v-if="authStore.affiliateCode" class="block mt-2">
                    Your affiliate code: 
                    <span class="font-mono bg-purple-500/20 px-2 py-1 rounded text-purple-300 text-xs sm:text-sm">{{ authStore.affiliateCode }}</span>
                  </span>
                </p>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div 
                    v-for="channel in authStore.availableChannels" 
                    :key="channel.channelName"
                    class="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 sm:p-4"
                  >
                    <h4 class="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3 flex items-center gap-2">
                      <Icon name="heroicons:tv" class="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                      {{ channel.channelName }}
                    </h4>
                    <p class="text-gray-300 text-xs sm:text-sm mb-3 sm:mb-4">Invite collaborators to {{ channel.channelName }} channel</p>
                    <button 
                      @click="generateCollaboratorInvite(channel.channelName)"
                      :disabled="generatingInviteFor === channel.channelName"
                      class="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-all duration-300 text-sm sm:text-base touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span v-if="generatingInviteFor === channel.channelName" class="flex items-center justify-center gap-2">
                        <div class="w-4 h-4 border-2 border-purple-300 border-t-transparent rounded-full animate-spin"></div>
                        Generating...
                      </span>
                      <span v-else>Generate Invite</span>
                    </button>

                    <!-- Copy box appears right under this channel's button -->
                    <div v-if="collaboratorInviteLink && generatingInviteFor === channel.channelName" class="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 sm:p-4">
                      <h5 class="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Icon name="heroicons:link" class="w-4 h-4 text-purple-400" />
                        Invite Link Generated
                      </h5>
                      <div class="flex items-center gap-2">
                        <input
                          :value="collaboratorInviteLink"
                          readonly
                          class="flex-1 bg-black/20 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm"
                        />
                        <button
                          @click="copyInviteLinkManually"
                          class="px-3 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-all duration-300"
                          :class="{ 'bg-purple-500/20 text-purple-300 border-purple-500/30': inviteLinkCopied }"
                        >
                          <Icon 
                            :name="inviteLinkCopied ? 'heroicons:check' : 'heroicons:clipboard'" 
                            class="w-4 h-4" 
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Show message if no channels available -->
                  <div v-if="authStore.availableChannels.length === 0" class="col-span-2 text-center py-8 text-gray-400">
                    <Icon name="heroicons:tv" class="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p class="text-lg mb-2">No channels available</p>
                    <p class="text-sm">You need to be a creator or collaborator to invite others to channels.</p>
                  </div>
                </div>
              </div>
              
              <div class="text-sm text-gray-400">
                <p v-if="authStore.commissionRate">• Earn {{ (authStore.commissionRate * 100).toFixed(1) }}% commission on all collaborators you invite</p>
                <p>• Track invite clicks and conversions in real-time</p>
                <p v-if="authStore.commissionRate">• Get paid monthly for your referrals</p>
              </div>
            </div>
          </div>

          <!-- Creator Persona Dashboard -->
          <div v-if="isRoleDetectionComplete && isCreatorPersona" class="space-y-6 sm:space-y-8">
            <!-- Creator Stats -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-blue-500/30 p-4 sm:p-6 lg:p-8">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-gray-400 text-sm sm:text-base">Active Channel</p>
                    <p class="text-lg sm:text-xl font-bold text-white">{{ authStore.activeChannel || 'None' }}</p>
                  </div>
                  <Icon name="heroicons:tv" class="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-blue-400" />
                </div>
              </div>
              
              <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-blue-500/30 p-4 sm:p-6 lg:p-8">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-gray-400 text-sm sm:text-base">Available Channels</p>
                    <p class="text-3xl sm:text-4xl font-bold text-white">{{ authStore.availableChannels.length }}</p>
                  </div>
                  <Icon name="heroicons:user-group" class="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-blue-400" />
                </div>
              </div>
              
              <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-blue-500/30 p-4 sm:p-6 lg:p-8">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-gray-400 text-sm sm:text-base">Content Created</p>
                    <p class="text-3xl sm:text-4xl font-bold text-white">0</p>
                  </div>
                  <Icon name="heroicons:video-camera" class="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-blue-400" />
                </div>
              </div>
            </div>

            <!-- Channel Management -->
            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-blue-500/30 p-4 sm:p-6 lg:p-8">
              <h3 class="text-xl sm:text-2xl lg:text-3xl font-semibold text-white mb-6 sm:mb-8 flex items-center gap-2 sm:gap-3">
                <Icon name="heroicons:tv" class="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-blue-400" />
                Channel Management
              </h3>
              
              <!-- Channel Selection -->
              <div class="mb-6">
                <label class="block text-gray-300 mb-3 text-sm sm:text-base font-medium">Select Channel:</label>
                <select 
                  v-model="selectedChannel"
                  @change="handleChannelChange"
                  class="w-full max-w-md px-4 py-3 bg-black/30 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm sm:text-base touch-manipulation"
                >
                  <option v-for="channel in sortedChannels" :key="channel.channelName" :value="channel.channelName">
                    {{ channel.channelName }}
                  </option>
                </select>
              </div>
              
              <!-- Channel Content Display -->
              <div v-if="selectedChannel" class="space-y-6">
                <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 sm:p-6">
                  <h4 class="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                    <Icon name="heroicons:video-camera" class="w-5 h-5 text-blue-400" />
                    Content for {{ selectedChannel }}
                  </h4>
                  
                  <!-- Content Grid -->
                  <div v-if="channelContent.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div v-for="file in channelContent" :key="file.SK" 
                      class="bg-gradient-to-br from-black/30 via-black/40 to-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 overflow-hidden group relative cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                      
                      <!-- Video Thumbnail -->
                      <div class="aspect-video bg-black/40 relative overflow-hidden">
                        <img 
                          :src="getThumbnailUrl(file)" 
                          :alt="file.fileName"
                          class="w-full h-full object-cover"
                          @error="handleImageError"
                        />
                        
                        <!-- Video Duration Badge -->
                        <div v-if="file.duration" class="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                          {{ formatDuration(file.duration) }}
                        </div>
                        
                        <!-- Visibility Status -->
                        <div class="absolute top-2 left-2">
                          <span 
                            class="px-2 py-1 text-xs rounded-full"
                            :class="file.isVisible === true ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'"
                          >
                            {{ file.isVisible === true ? 'Live' : 'Draft' }}
                          </span>
                        </div>
                      </div>
                      
                      <!-- File Info -->
                      <div class="p-4">
                        <h5 class="text-white font-medium text-sm mb-2 line-clamp-2">{{ file.fileName }}</h5>
                        <p class="text-gray-400 text-xs mb-3">
                          {{ new Date(file.createdAt).toLocaleDateString() }}
                        </p>
                        
                        <!-- Action Buttons -->
                        <div class="flex gap-2">
                          <button
                            type="button"
                            @click.prevent="toggleVisibility($event, file)"
                            class="flex-1 px-3 py-2 text-xs rounded-lg transition-all duration-300 flex items-center justify-center gap-1"
                            :class="file.isVisible === true 
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30' 
                              : 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30'"
                            :title="file.isVisible === true ? 'Hide from channel' : 'Publish to channel'"
                          >
                            <Icon 
                              :name="file.isVisible === true ? 'heroicons:eye-slash' : 'heroicons:eye'" 
                              class="w-3 h-3" 
                            />
                            {{ file.isVisible === true ? 'Hide' : 'Publish' }}
                          </button>
                          
                           <button
                             v-if="!isSelectionMode"
                             @click.stop="playVideo(file)"
                             class="px-3 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300"
                             title="Play Video"
                             :disabled="!file.hlsUrl || file.status === 'PROCESSING'"
                           >
                             <Icon 
                               :name="file.status === 'PROCESSING' ? 'heroicons:clock' : 'heroicons:play'" 
                               class="w-3 h-3" 
                             />
                           </button>
                          
                          <button
                            @click="editItem(file)"
                            class="px-3 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-all duration-300"
                            title="Edit Details"
                          >
                            <Icon name="heroicons:pencil-square" class="w-3 h-3" />
                          </button>
                          
                          <button
                            @click="deleteFile(file)"
                            class="px-3 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all duration-300"
                            title="Delete video"
                          >
                            <Icon name="heroicons:trash" class="w-3 h-3" />
                          </button>
                        </div>
                </div>
              </div>
            </div>

                  <!-- No Content Message -->
                  <div v-else class="text-center py-8 text-gray-400">
                    <Icon name="heroicons:video-camera" class="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p class="text-lg mb-2">No content found</p>
                    <p class="text-sm">No videos have been streamed to this channel yet.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Stream Key Management -->
            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-4 sm:p-6 lg:p-8">
              <h3 class="text-xl sm:text-2xl lg:text-3xl font-semibold text-white mb-6 sm:mb-8 flex items-center gap-2 sm:gap-3">
                <Icon name="heroicons:video-camera" class="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-teal-400" />
                Stream Key Management
              </h3>
              
              <div class="space-y-6">
                <p class="text-gray-300 text-sm sm:text-base">
                  View your assigned stream keys for each channel. These keys are pre-assigned to your creator account.
                </p>
                
                <!-- Channel Stream Keys -->
                <div v-for="channel in sortedChannels" :key="channel.channelName" class="bg-teal-500/5 border border-teal-500/20 rounded-lg p-4 sm:p-6">
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                      <Icon name="heroicons:tv" class="w-5 h-5 sm:w-6 sm:h-6 text-teal-400" />
                      <h4 class="text-white font-semibold text-base sm:text-lg">{{ channel.channelName }}</h4>
                    </div>
                    <div class="flex items-center gap-3">
                      <span class="px-2 py-1 bg-teal-500/20 text-teal-300 text-xs rounded-full">
                        {{ getChannelStreamKeys(channel.channelName).length }}/1 key
                      </span>
                      <button
                        v-if="getChannelStreamKeys(channel.channelName).length > 0"
                        @click="toggleStreamKeyDetails(channel.channelName)"
                        class="px-3 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300 flex items-center gap-2 text-sm"
                      >
                        <Icon 
                          :name="expandedStreamKeys[channel.channelName] ? 'heroicons:eye-slash' : 'heroicons:eye'" 
                          class="w-4 h-4" 
                        />
                        {{ expandedStreamKeys[channel.channelName] ? 'Hide' : 'Show' }} Details
                  </button>
                    </div>
                </div>
                
                  <!-- Stream Key Display (collapsible) -->
                  <div v-if="getChannelStreamKeys(channel.channelName).length > 0 && expandedStreamKeys[channel.channelName]" class="space-y-3">
                    <div v-for="key in getChannelStreamKeys(channel.channelName)" :key="key.streamKey" class="bg-black/20 rounded-lg p-4 border border-teal-500/30">
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                          <span 
                            class="px-2 py-1 text-xs rounded-full"
                            :class="key.isCollaboratorKey ? 'bg-purple-500/20 text-purple-300' : 'bg-teal-500/20 text-teal-300'"
                          >
                            {{ key.isCollaboratorKey ? 'Collaborator Key' : 'Personal Key' }}
                          </span>
                          <span class="text-xs text-gray-400">{{ new Date(key.createdAt).toLocaleDateString() }}</span>
                        </div>
                      </div>
                      
                      <div class="space-y-3">
                        <!-- Complete RTMP URL (for easy copying) -->
                        <div class="space-y-1">
                          <span class="text-gray-400 text-sm font-medium">Complete RTMP URL:</span>
                          <div class="flex items-center gap-2">
                            <code class="bg-black/30 px-3 py-2 rounded text-teal-300 text-sm font-mono flex-1 break-all">{{ getRTMPUrl(key.streamKey) }}</code>
                            <button
                              @click="copyRTMPUrl(key.streamKey)"
                              class="px-3 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300 flex items-center gap-2"
                              title="Copy Complete RTMP URL"
                            >
                              <Icon name="heroicons:clipboard" class="w-4 h-4" />
                              <span class="text-xs">Copy</span>
                  </button>
                </div>
              </div>

                        <!-- OBS Configuration Breakdown -->
                        <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                          <h5 class="text-blue-300 font-medium mb-3 text-sm">OBS Configuration:</h5>
                          <div class="space-y-2">
                            <div class="flex items-center gap-2">
                              <span class="text-gray-400 text-sm w-16">Server:</span>
                              <code class="bg-black/30 px-2 py-1 rounded text-blue-300 text-sm font-mono flex-1">{{ getRTMPServer() }}</code>
                              <button
                                @click="copyRTMPServer()"
                                class="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                                title="Copy Server URL"
                              >
                                <Icon name="heroicons:clipboard" class="w-4 h-4" />
                              </button>
            </div>
                            
                            <div class="flex items-center gap-2">
                              <span class="text-gray-400 text-sm w-16">Stream Key:</span>
                              <code class="bg-black/30 px-2 py-1 rounded text-blue-300 text-sm font-mono flex-1">{{ key.streamKey }}</code>
                              <button
                                @click="copyStreamKey(key.streamKey)"
                                class="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                                title="Copy Stream Key"
                              >
                                <Icon name="heroicons:clipboard" class="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- No Stream Key Message -->
                  <div v-else-if="getChannelStreamKeys(channel.channelName).length === 0" class="text-center py-4 text-gray-400">
                    <Icon name="heroicons:video-camera" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p class="text-sm">No stream key assigned for this channel</p>
                    <p class="text-xs mt-1">Contact support if you need a stream key for this channel</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Enhanced Viewer Persona Dashboard -->
          <div v-if="isRoleDetectionComplete && isViewerPersona" class="space-y-6 sm:space-y-8">
            <!-- Viewer Stats -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-green-500/30 p-4 sm:p-6 lg:p-8">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-gray-400 text-sm sm:text-base">Active Subscriptions</p>
                    <p class="text-3xl sm:text-4xl font-bold text-white">{{ userRoles.subscriptions?.length || 0 }}</p>
                  </div>
                  <Icon name="heroicons:heart" class="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-green-400" />
                </div>
              </div>
              
              <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-green-500/30 p-4 sm:p-6 lg:p-8">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-gray-400 text-sm sm:text-base">Content Watched</p>
                    <p class="text-3xl sm:text-4xl font-bold text-white">0</p>
                  </div>
                  <Icon name="heroicons:play" class="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-green-400" />
                </div>
              </div>
              
              <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-green-500/30 p-4 sm:p-6 lg:p-8">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-gray-400 text-sm sm:text-base">Watchlist</p>
                    <p class="text-3xl sm:text-4xl font-bold text-white">0</p>
                  </div>
                  <Icon name="heroicons:bookmark" class="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-green-400" />
                </div>
              </div>
            </div>

            <!-- Content Discovery -->
            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-green-500/30 p-4 sm:p-6 lg:p-8">
              <h3 class="text-xl sm:text-2xl lg:text-3xl font-semibold text-white mb-6 sm:mb-8 flex items-center gap-2 sm:gap-3">
                <Icon name="heroicons:magnifying-glass" class="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-green-400" />
                Discover Content
              </h3>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div class="bg-green-500/10 border border-green-500/20 rounded-xl p-4 sm:p-6">
                  <h4 class="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                    <Icon name="heroicons:fire" class="w-4 h-4 sm:w-5 sm:h-5" />
                    Trending Now
                  </h4>
                  <p class="text-gray-300 mb-3 sm:mb-4 text-xs sm:text-sm">
                    Discover the most popular content across all channels.
                  </p>
                  <button class="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-all duration-300 text-sm sm:text-base touch-manipulation">
                    Browse Trending
                  </button>
                </div>
                
                <div class="bg-green-500/10 border border-green-500/20 rounded-xl p-4 sm:p-6">
                  <h4 class="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                    <Icon name="heroicons:sparkles" class="w-4 h-4 sm:w-5 sm:h-5" />
                    Recommended for You
                  </h4>
                  <p class="text-gray-300 mb-3 sm:mb-4 text-xs sm:text-sm">
                    Personalized content recommendations based on your viewing history.
                  </p>
                  <button class="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-all duration-300 text-sm sm:text-base touch-manipulation">
                    View Recommendations
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Role-Based Dashboard Content for Non-Producers -->
          <div v-if="isRoleDetectionComplete && !isMainProducer" class="space-y-8">
            
            <!-- Default View: Unactivated Account -->
            <div v-if="!hasSpecialRole && !hasSubscriptions" class="bg-gray-500/10 border border-gray-500/30 rounded-2xl p-8 text-center">
              <Icon name="heroicons:user-plus" class="w-20 h-20 mx-auto mb-6 text-gray-400" />
              <h3 class="text-2xl font-semibold text-white mb-4">Welcome to Twilly!</h3>
              <p class="text-gray-300 mb-6 text-lg">Your account is ready, but you haven't been activated yet.</p>
              <div class="space-y-4 text-sm text-gray-400">
                <p>To get started, you can:</p>
                <ul class="list-disc list-inside space-y-2 text-left max-w-md mx-auto">
                  <li>Subscribe to a channel to become a viewer</li>
                  <li>Accept a collaborator invite to join a channel</li>
                  <li>Accept an affiliate marketer invite to earn commissions</li>
                </ul>
              </div>
            </div>


            <!-- Combined Requests Dashboard -->
            <div v-if="hasSpecialRole" class="space-y-8">
              
              <!-- Collaborator Requests -->
              <div v-if="isCollaborator" class="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-8">
                <div class="flex items-center gap-4 mb-6">
                  <Icon name="heroicons:user-group" class="w-8 h-8 text-blue-400" />
                  <h3 class="text-2xl font-semibold text-white">Collaborator Requests</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div v-for="channel in userRoles.collaboratorChannels" :key="channel.channelId" class="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6">
                    <h4 class="font-semibold text-white mb-3 text-lg">{{ channel.channelName }}</h4>
                    <div class="text-sm text-gray-300 space-y-2">
                      <p>Role: {{ channel.role }}</p>
                      <p>Joined: {{ new Date(channel.joinedAt).toLocaleDateString() }}</p>
                      <p>Payout Setup: {{ channel.hasPayoutSetup ? '✅ Complete' : '❌ Required' }}</p>
                    </div>
                    <div v-if="!channel.hasPayoutSetup" class="mt-4">
                      <NuxtLink to="/account" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all duration-300">
                        <Icon name="heroicons:credit-card" class="w-4 h-4" />
                        Set Up Payouts
                      </NuxtLink>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Casting Director Requests -->
              <div v-if="isCastingDirector" class="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-8">
                <div class="flex items-center gap-4 mb-6">
                  <Icon name="heroicons:user-plus" class="w-8 h-8 text-purple-400" />
                  <h3 class="text-2xl font-semibold text-white">Casting Director Requests</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div v-for="channel in userRoles.castingDirectorChannels" :key="channel.channelId" class="bg-purple-500/5 border border-purple-500/20 rounded-xl p-6">
                    <h4 class="font-semibold text-white mb-3 text-lg">{{ channel.channelName }}</h4>
                    <div class="text-sm text-gray-300 space-y-2">
                      <p>Commission Rate: {{ (channel.commissionRate * 100).toFixed(0) }}%</p>
                      <p>Joined: {{ new Date(channel.joinedAt).toLocaleDateString() }}</p>
                      <p>Payout Setup: {{ channel.hasPayoutSetup ? '✅ Complete' : '❌ Required' }}</p>
                    </div>
                    <div class="mt-4 space-x-2">
                      <button 
                        @click="generateCastingDirectorReferralLink(channel.channelId)"
                        class="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-all duration-300"
                      >
                        <Icon name="heroicons:link" class="w-4 h-4" />
                        Get Referral Link
                      </button>
                      <div v-if="!channel.hasPayoutSetup" class="inline-block">
                        <NuxtLink to="/account" class="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-all duration-300">
                          <Icon name="heroicons:credit-card" class="w-4 h-4" />
                          Set Up Payouts
                        </NuxtLink>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Earnings Dashboard -->
            <div v-if="hasSpecialRole" class="bg-green-500/10 border border-green-500/30 rounded-2xl p-8">
              <div class="flex items-center gap-4 mb-6">
                <Icon name="heroicons:currency-dollar" class="w-8 h-8 text-green-400" />
                <h3 class="text-2xl font-semibold text-white">Earnings Dashboard</h3>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <!-- Total Earnings -->
                <div class="bg-green-500/5 border border-green-500/20 rounded-xl p-6">
                  <div class="flex items-center gap-3 mb-2">
                    <Icon name="heroicons:banknotes" class="w-6 h-6 text-green-400" />
                    <h4 class="font-semibold text-white">Total Earnings</h4>
                  </div>
                  <p class="text-2xl font-bold text-green-400">${{ totalEarnings.toFixed(2) }}</p>
                  <p class="text-sm text-gray-400">All time</p>
                </div>

                <!-- This Month -->
                <div class="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6">
                  <div class="flex items-center gap-3 mb-2">
                    <Icon name="heroicons:calendar" class="w-6 h-6 text-blue-400" />
                    <h4 class="font-semibold text-white">This Month</h4>
                  </div>
                  <p class="text-2xl font-bold text-blue-400">${{ monthlyEarnings.toFixed(2) }}</p>
                  <p class="text-sm text-gray-400">Current month</p>
                </div>

                <!-- Pending Payouts -->
                <div class="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-6">
                  <div class="flex items-center gap-3 mb-2">
                    <Icon name="heroicons:clock" class="w-6 h-6 text-yellow-400" />
                    <h4 class="font-semibold text-white">Pending</h4>
                  </div>
                  <p class="text-2xl font-bold text-yellow-400">${{ pendingEarnings.toFixed(2) }}</p>
                  <p class="text-sm text-gray-400">Awaiting payout</p>
                </div>
              </div>

              <!-- Recent Payouts -->
              <div class="bg-black/20 rounded-xl p-6">
                <h4 class="font-semibold text-white mb-4 flex items-center gap-2">
                  <Icon name="heroicons:list-bullet" class="w-5 h-5 text-gray-400" />
                  Recent Payouts
                </h4>
                <div v-if="recentPayouts.length > 0" class="space-y-3">
                  <div v-for="payout in recentPayouts" :key="payout.id" class="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div>
                      <p class="text-white font-medium">{{ payout.channelName }}</p>
                      <p class="text-sm text-gray-400">{{ formatDate(payout.date) }}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-green-400 font-semibold">${{ payout.amount.toFixed(2) }}</p>
                      <p class="text-xs text-gray-400">{{ payout.status }}</p>
                    </div>
                  </div>
                </div>
                <div v-else class="text-center py-8 text-gray-400">
                  <Icon name="heroicons:banknotes" class="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No payouts yet</p>
                  <p class="text-sm">Earnings will appear here once you start collaborating</p>
                </div>
              </div>
            </div>

            <!-- Future: Videographer and Other Talent Types -->
            <div class="bg-gray-500/10 border border-gray-500/30 rounded-2xl p-8">
              <div class="flex items-center gap-4 mb-6">
                <Icon name="heroicons:video-camera" class="w-8 h-8 text-gray-400" />
                <h3 class="text-2xl font-semibold text-white">Coming Soon</h3>
              </div>
              <div class="text-gray-300 space-y-3">
                <p class="text-lg">Additional talent types will be available soon:</p>
                <ul class="list-disc list-inside space-y-2 ml-4">
                  <li>Videographers</li>
                  <li>Editors</li>
                  <li>Sound Engineers</li>
                  <li>Graphic Designers</li>
                </ul>
              </div>
            </div>

          </div>

          <!-- Enhanced Earnings Breakdown (Producers Only) -->
          <div v-if="isRoleDetectionComplete && isMainProducer && earningsData.totalEarnings > 0" class="bg-black/40 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8 sm:p-12">
            <h3 class="text-2xl sm:text-3xl font-semibold text-white mb-8 flex items-center gap-3">
              <Icon name="heroicons:chart-bar" class="w-8 h-8 sm:w-10 sm:h-10 text-teal-400" />
              Earnings Breakdown (Last 30 Days)
            </h3>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div class="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
                <div class="flex items-center gap-3 mb-4">
                  <Icon name="heroicons:currency-dollar" class="w-6 h-6 text-green-400" />
                  <span class="text-green-300 font-medium text-lg">Creator Share</span>
                </div>
                <p class="text-3xl sm:text-4xl font-bold text-white">${{ earningsData.creatorShare?.toFixed(2) || '0.00' }}</p>
                <p class="text-gray-400 text-sm sm:text-base">70% of revenue</p>
              </div>
              
              <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
                <div class="flex items-center gap-3 mb-4">
                  <Icon name="heroicons:users" class="w-6 h-6 text-blue-400" />
                  <span class="text-blue-300 font-medium text-lg">Collaborator Share</span>
                </div>
                <p class="text-3xl sm:text-4xl font-bold text-white">${{ earningsData.collaboratorShare?.toFixed(2) || '0.00' }}</p>
                <p class="text-gray-400 text-sm sm:text-base">20% of revenue</p>
              </div>
              
              <div class="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6">
                <div class="flex items-center gap-3 mb-4">
                  <Icon name="heroicons:building-office" class="w-6 h-6 text-purple-400" />
                  <span class="text-purple-300 font-medium text-lg">Platform Fee</span>
                </div>
                <p class="text-3xl sm:text-4xl font-bold text-white">${{ earningsData.platformFee?.toFixed(2) || '0.00' }}</p>
                <p class="text-gray-400 text-sm sm:text-base">10% of revenue</p>
              </div>
            </div>

            <!-- Recent Transactions -->
            <div v-if="earningsData.recentTransactions?.length > 0">
              <h4 class="text-xl sm:text-2xl font-semibold text-white mb-6">Recent Transactions</h4>
              <div class="space-y-4">
                <div v-for="transaction in earningsData.recentTransactions.slice(0, 5)" :key="transaction.id" 
                     class="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <div class="flex items-center gap-4">
                    <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
                    <div>
                      <p class="text-white font-medium text-lg">{{ transaction.channelName }}</p>
                      <p class="text-gray-400 text-sm sm:text-base">{{ new Date(transaction.date).toLocaleDateString() }}</p>
                    </div>
                  </div>
                  <p class="text-green-400 font-bold text-xl">+${{ transaction.amount?.toFixed(2) || '0.00' }}</p>
                </div>
              </div>
            </div>
          </div>



          <!-- Talent Requests (Producers Only) -->
          <div v-if="isRoleDetectionComplete && isMainProducer" class="bg-black/40 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-6 sm:p-8">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-2xl sm:text-3xl font-semibold text-white flex items-center gap-3">
                <Icon name="heroicons:user-group" class="w-8 h-8 sm:w-10 sm:h-10 text-teal-400" />
                Requests for Talent
              </h3>
              <div class="flex items-center gap-2 sm:gap-3">
                <NuxtLink to="/talent-request/create" class="px-3 py-2 sm:px-4 sm:py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors flex items-center gap-2 text-sm">
                  <Icon name="heroicons:plus" class="w-4 h-4" />
                  Create
                </NuxtLink>
                <button type="button" @click="refreshTalentRequests" :disabled="isRefreshingTalent" class="px-3 py-2 sm:px-4 sm:py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg transition-all duration-300 flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  <Icon :name="isRefreshingTalent ? 'heroicons:arrow-path' : 'heroicons:arrow-path'" class="w-4 h-4" :class="{ 'animate-spin': isRefreshingTalent }" />
                  {{ isRefreshingTalent ? 'Refreshing…' : 'Refresh' }}
                </button>

              </div>
            </div>

            <!-- Tabs -->
            <div class="flex items-center gap-2 mb-6 border-b border-white/10">
              <button @click="switchTalentTab('requests')" :class="['px-4 py-2 rounded-t-lg text-sm', activeTalentTab === 'requests' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white']">
                Requests ({{ talentRequestsStore.totalRequests }})
              </button>
              <button @click="switchTalentTab('applications')" :class="['px-4 py-2 rounded-t-lg text-sm', activeTalentTab === 'applications' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white']">
                Applications ({{ totalApplications }})
              </button>
            </div>



            <!-- Loading -->
            <div v-if="talentRequestsStore.isLoading" class="text-center py-8">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400 mb-4"></div>
              <p class="text-gray-300">Loading…</p>
              <!-- Debug info (remove after fixing) -->
              <div class="text-xs text-gray-500 mt-2">
                Debug: isLoading={{ talentRequestsStore.isLoading }}, hasRequests={{ talentRequestsStore.hasRequests }}, totalRequests={{ talentRequestsStore.totalRequests }}
              </div>
            </div>

            <!-- Empty state -->
            <div v-else-if="activeTalentTab === 'requests' && !talentRequestsStore.hasRequests" class="text-center py-8">
              <Icon name="heroicons:user-group" class="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 class="text-white text-xl mb-2">No talent requests yet</h3>
              <p class="text-gray-300 mb-6">Create your first talent request to recruit collaborators for your streaming series.</p>
              <!-- Debug info (remove after fixing) -->
              <div class="text-xs text-gray-500 mb-4">
                Debug: isLoading={{ talentRequestsStore.isLoading }}, hasRequests={{ talentRequestsStore.hasRequests }}, totalRequests={{ talentRequestsStore.totalRequests }}
              </div>
              <NuxtLink to="/talent-request/create" class="inline-flex items-center px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors">
                <Icon name="heroicons:plus" class="w-4 h-4 mr-2" />
                Create First Request
              </NuxtLink>
            </div>

            <!-- Requests tab -->
            <div v-else-if="activeTalentTab === 'requests'" class="space-y-4">
              <div v-for="request in talentRequestsStore.requests.filter(r => !r.SK?.includes('APPLICATION#'))" :key="request.id" class="bg-black/20 rounded-xl p-5 border border-teal-500/20 hover:border-teal-500/40 transition-all">
                <div class="flex items-center justify-between mb-3">
                  <div class="min-w-0">
                    <h4 class="text-white font-medium text-base sm:text-lg truncate">{{ request.projectTitle }}</h4>
                    <p class="text-gray-400 text-sm truncate">{{ request.channel }}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm px-3 py-1 rounded-full font-medium" :class="getTalentStatusBadgeClass(request.status)">{{ getTalentStatusText(request.status) }}</span>
                    <span class="text-gray-400 text-sm">{{ formatDate(request.createdAt) }}</span>
                  </div>
                </div>
                <p class="text-gray-300 text-sm mb-3 line-clamp-2">{{ request.showConcept }}</p>
                <div class="flex items-center justify-between">
                  <div class="text-xs text-gray-400 flex flex-wrap gap-3">
                    <span class="flex items-center gap-1"><Icon name="heroicons:clock" class="w-4 h-4" /> {{ request.streamLength }}</span>
                    <span class="flex items-center gap-1"><Icon name="heroicons:map-pin" class="w-4 h-4" /> {{ request.location }}</span>
                    <span v-if="request.applications?.length" class="flex items-center gap-1"><Icon name="heroicons:user" class="w-4 h-4" /> {{ request.applications.length }} apps</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <button @click="viewTalentRequest(request)" class="px-3 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 text-xs">View</button>
                    <button @click="editTalentRequest(request)" class="px-3 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 text-xs">Edit</button>
                    <button @click="generateTalentRequestShareLink(request)" class="px-3 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 text-xs">Share</button>
                    <button @click="() => { console.log('Button clicked!'); console.log('Request object:', request); console.log('Request.id:', request.id); console.log('Request.requestId:', request.requestId); console.log('Request.applicationId:', request.applicationId); deleteTalentApplication(request.requestId, request.applicationId); }" class="px-3 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 text-xs">Delete</button>
                  </div>
                </div>
              </div>
              
              <!-- View All Requests Button -->
              <div class="text-center pt-4">
                <button @click="viewAllRequests" class="px-6 py-3 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-all duration-300 flex items-center gap-2 mx-auto">
                  <Icon name="heroicons:eye" class="w-4 h-4" />
                  View All Requests
                </button>
              </div>
            </div>

            <!-- Applications tab -->
            <div v-else class="space-y-4">
              <div class="flex items-center justify-between mb-2">
                <p class="text-gray-300 text-sm">Total Applications: <span class="text-white font-medium">{{ totalApplications }}</span></p>
                <div class="text-gray-400 text-xs">Page {{ appPage + 1 }} / {{ appTotalPages }}</div>
              </div>
              <div v-if="pagedApplications.length === 0" class="text-center py-8 text-gray-400">No applications yet.</div>
              <div v-for="app in pagedApplications" :key="app.key" class="bg-black/20 rounded-xl p-4 border border-white/10">
                <div class="flex items-center justify-between mb-2">
                  <div class="min-w-0">
                    <p class="text-white font-medium truncate">{{ app.fullName }}</p>
                    <p class="text-gray-400 text-xs truncate">{{ app.contactInfo }}</p>
                  </div>
                  <span class="text-xs px-2 py-1 rounded-full font-medium" :class="[
                    app.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                    app.status === 'approved' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                    'bg-red-500/20 text-red-300 border border-red-500/30'
                  ]">{{ app.status }}</span>
                </div>
                <div class="text-xs text-gray-400 mb-2">For: <span class="text-gray-200">{{ app.projectTitle }}</span> • {{ formatDate(app.createdAt) }}</div>
                <div class="flex items-center gap-2">
                  <button @click="viewApplication(app)" class="px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 text-xs">View Application</button>
                  <button v-if="app.status==='pending'" @click="approveApplication(app.requestId, app.applicationId)" class="px-3 py-1.5 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-500/30 text-xs">Approve</button>
                  <button v-if="app.status==='pending'" @click="rejectApplication(app.requestId, app.applicationId)" class="px-3 py-1.5 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 text-xs">Reject</button>
                </div>
              </div>
              <div class="flex items-center justify-between pt-2">
                <button @click="prevAppPage" :disabled="appPage===0" class="px-3 py-2 bg-white/10 text-white rounded-lg disabled:opacity-40 text-sm">Prev</button>
                <button @click="nextAppPage" :disabled="appPage>=appTotalPages-1" class="px-3 py-2 bg-white/10 text-white rounded-lg disabled:opacity-40 text-sm">Next</button>
              </div>
            </div>
          </div>

          <!-- Collaborator Requests (Producers Only) -->
          <div v-if="isRoleDetectionComplete && isMainProducer" class="bg-black/40 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8 sm:p-12">
            <div class="flex items-center justify-between mb-8">
              <h3 class="text-2xl sm:text-3xl font-semibold text-white flex items-center gap-3">
                <Icon name="heroicons:user-group" class="w-8 h-8 sm:w-10 sm:h-10 text-teal-400" />
                Collaborator Requests
              </h3>
              <button
                @click="loadCollaboratorRequestsFromStore"
                class="px-6 py-4 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-xl hover:bg-teal-500/30 transition-all duration-300 flex items-center gap-3 text-base sm:text-lg"
              >
                <Icon name="heroicons:arrow-path" class="w-5 h-5 sm:w-6 sm:h-6" />
                Refresh
              </button>
            </div>
            
            <div v-if="collaboratorRequestsStore.hasRequests" class="space-y-6">
              <div v-for="request in collaboratorRequestsStore.pendingRequests" :key="request.requestId" 
                   class="bg-black/20 rounded-xl p-6 sm:p-8 border border-teal-500/20 hover:border-teal-500/40 transition-all duration-300">
                <!-- Request Header -->
                <div class="flex items-center justify-between mb-4 sm:mb-6">
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                      <Icon name="heroicons:user" class="w-4 h-4 sm:w-5 sm:h-5 text-teal-400" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <h4 class="text-white font-medium text-base sm:text-lg truncate">{{ request.fullName }}</h4>
                      <p class="text-gray-400 text-sm truncate">{{ request.channelId }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm px-3 py-1 rounded-full font-medium"
                          :class="[
                            request.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                            request.status === 'approved' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                            'bg-red-500/20 text-red-300 border border-red-500/30'
                          ]">
                      {{ request.status }}
                    </span>
                    <span class="text-gray-400 text-sm">{{ formatDate(request.createdAt) }}</span>
                  </div>
                </div>
                
                <!-- Request Details -->
                <div class="space-y-4 mb-6">
                  <div>
                    <p class="text-gray-400 text-sm mb-1">Contact Info</p>
                    <p class="text-white">{{ request.contactInfo }}</p>
                  </div>
                  
                  <div>
                    <p class="text-gray-400 text-sm mb-1">Stream Concept</p>
                    <p class="text-white">{{ request.streamConcept }}</p>
                  </div>
                  
                  <div v-if="request.contentLink">
                    <p class="text-gray-400 text-sm mb-1">Content Link</p>
                    <a :href="request.contentLink" target="_blank" class="text-teal-400 hover:text-teal-300 break-all">
                      {{ request.contentLink }}
                    </a>
                  </div>
                  
                  <div>
                    <p class="text-gray-400 text-sm mb-1">Availability</p>
                    <p class="text-white">{{ request.availability }}</p>
                  </div>
                  
                  <div v-if="request.preferredTimeSlots && request.preferredTimeSlots.length > 0">
                    <p class="text-gray-400 text-sm mb-1">Preferred Time Slots</p>
                    <div class="flex flex-wrap gap-2">
                      <span v-for="slot in request.preferredTimeSlots" :key="slot" 
                            class="px-2 py-1 bg-teal-500/20 text-teal-300 rounded text-sm">
                        {{ slot }}
                      </span>
                    </div>
                  </div>
                </div>
                
                <!-- Video Preview -->
                <div v-if="request.clipUrl" class="mb-6">
                  <p class="text-gray-400 text-sm mb-2">Pilot Clip</p>
                  <video 
                    :src="request.clipUrl" 
                    controls 
                    class="w-full max-w-md rounded-lg"
                    preload="metadata"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
                
                <!-- Action Buttons -->
                <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                  <button
                    v-if="request.status === 'pending'"
                    @click="approveRequest(request.requestId)"
                    class="px-3 py-2 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-all duration-300 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Icon name="heroicons:check" class="w-3 h-3 sm:w-4 sm:h-4" />
                    <span class="hidden sm:inline">Approve</span>
                  </button>
                  <button
                    v-if="request.status === 'pending'"
                    @click="rejectRequest(request.requestId)"
                    class="px-3 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all duration-300 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Icon name="heroicons:x-mark" class="w-3 h-3 sm:w-4 sm:h-4" />
                    <span class="hidden sm:inline">Reject</span>
                  </button>
                  <button
                    @click="viewRequest(request)"
                    class="px-3 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all duration-300 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Icon name="heroicons:eye" class="w-3 h-3 sm:w-4 sm:h-4" />
                    <span class="hidden sm:inline">View Details</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div v-else-if="collaboratorRequestsStore.isLoading" class="text-center py-16">
              <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400 mb-4"></div>
              <p class="text-gray-300 text-lg">Loading collaborator requests...</p>
            </div>
            <div v-else class="text-center py-16">
              <Icon name="heroicons:user-group" class="w-20 h-20 text-gray-400 mx-auto mb-6" />
              <h3 class="text-white text-2xl mb-4">No pending collaborator requests</h3>
              <p class="text-gray-300 text-lg">When people submit collaborator requests for your channels, they'll appear here</p>
            </div>
          </div>

                    <!-- Approved Requests Section (Producers Only) -->
          <div v-if="isRoleDetectionComplete && isMainProducer && collaboratorRequestsStore.approvedRequests.length > 0" class="bg-black/40 backdrop-blur-sm rounded-2xl border border-green-500/30 p-8 sm:p-12 mt-8">
            <div class="flex items-center justify-between mb-8">
              <h3 class="text-2xl sm:text-3xl font-semibold text-white flex items-center gap-3">
                <Icon name="heroicons:check-circle" class="w-8 h-8 sm:w-10 sm:h-10 text-green-400" />
                Approved Requests
              </h3>
            </div>
            
            <div class="space-y-6">
              <div v-for="request in collaboratorRequestsStore.approvedRequests" :key="request.requestId" 
                   :class="[
                     'rounded-xl p-6 sm:p-8 border transition-all duration-300',
                     request.notified 
                       ? 'bg-gray-800/20 border-gray-500/20 opacity-60' 
                       : 'bg-black/20 border-green-500/20 hover:border-green-500/40'
                   ]">
                <!-- Request Header -->
                <div class="flex items-center justify-between mb-4 sm:mb-6">
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <Icon name="heroicons:check" class="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <h4 class="text-white font-medium text-base sm:text-lg truncate">{{ request.fullName }}</h4>
                      <p class="text-gray-400 text-sm truncate">{{ request.channelId }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm px-3 py-1 rounded-full font-medium bg-green-500/20 text-green-300 border border-green-500/30">
                      approved
                    </span>
                    <span class="text-gray-400 text-sm">{{ formatDate(request.createdAt) }}</span>
                  </div>
                </div>
                
                <!-- Contact Info for Manual Contact -->
                <div class="space-y-4 mb-6">
                  <div>
                    <p class="text-gray-400 text-sm mb-1">Contact Info (for manual invite)</p>
                    <p class="text-white">{{ request.contactInfo }}</p>
                  </div>
                  
                  <div>
                    <p class="text-gray-400 text-sm mb-1">Stream Concept</p>
                    <p class="text-white">{{ request.streamConcept }}</p>
                  </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                  <button
                    @click="viewRequest(request)"
                    class="px-3 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all duration-300 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Icon name="heroicons:eye" class="w-3 h-3 sm:w-4 sm:h-4" />
                    <span class="hidden sm:inline">View Details</span>
                  </button>
                  <button
                    v-if="!request.notified"
                    @click="markAsNotified(request.requestId)"
                    class="px-3 py-2 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/30 transition-all duration-300 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Icon name="heroicons:bell" class="w-3 h-3 sm:w-4 sm:h-4" />
                    <span class="hidden sm:inline">Mark Notified</span>
                  </button>
                  <span v-else class="px-3 py-2 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg text-xs sm:text-sm">
                    <Icon name="heroicons:check" class="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                    <span class="hidden sm:inline">Notified</span>
                  </span>
                  <button
                    @click="deleteRequest(request.requestId)"
                    class="px-3 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all duration-300 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Icon name="heroicons:trash" class="w-3 h-3 sm:w-4 sm:h-4" />
                    <span class="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

                    <!-- Rejected Requests Section (Producers Only) -->
          <div v-if="isRoleDetectionComplete && isMainProducer && collaboratorRequestsStore.rejectedRequests.length > 0" class="bg-black/40 backdrop-blur-sm rounded-2xl border border-red-500/30 p-8 sm:p-12 mt-8">
            <div class="flex items-center justify-between mb-8">
              <h3 class="text-2xl sm:text-3xl font-semibold text-white flex items-center gap-3">
                <Icon name="heroicons:x-circle" class="w-8 h-8 sm:w-10 sm:h-10 text-red-400" />
                Rejected Requests
              </h3>
            </div>
            
            <div class="space-y-6">
              <div v-for="request in collaboratorRequestsStore.rejectedRequests" :key="request.requestId" 
                   :class="[
                     'rounded-xl p-6 sm:p-8 border transition-all duration-300',
                     request.notified 
                       ? 'bg-gray-800/20 border-gray-500/20 opacity-60' 
                       : 'bg-black/20 border-red-500/20 hover:border-red-500/40'
                   ]">
                <!-- Request Header -->
                <div class="flex items-center justify-between mb-4 sm:mb-6">
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <Icon name="heroicons:x-mark" class="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <h4 class="text-white font-medium text-base sm:text-lg truncate">{{ request.fullName }}</h4>
                      <p class="text-gray-400 text-sm truncate">{{ request.channelId }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm px-3 py-1 rounded-full font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                      rejected
                    </span>
                    <span class="text-gray-400 text-sm">{{ formatDate(request.createdAt) }}</span>
                  </div>
                </div>
                
                <!-- Contact Info for Manual Contact -->
                <div class="space-y-4 mb-6">
                  <div>
                    <p class="text-gray-400 text-sm mb-1">Contact Info (for manual notification)</p>
                    <p class="text-white">{{ request.contactInfo }}</p>
                  </div>
                  
                  <div>
                    <p class="text-gray-400 text-sm mb-1">Stream Concept</p>
                    <p class="text-white">{{ request.streamConcept }}</p>
                  </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                  <button
                    @click="viewRequest(request)"
                    class="px-3 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all duration-300 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Icon name="heroicons:eye" class="w-3 h-3 sm:w-4 sm:h-4" />
                    <span class="hidden sm:inline">View Details</span>
                  </button>
                  <button
                    v-if="!request.notified"
                    @click="markAsNotified(request.requestId)"
                    class="px-3 py-2 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/30 transition-all duration-300 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Icon name="heroicons:bell" class="w-3 h-3 sm:w-4 sm:h-4" />
                    <span class="hidden sm:inline">Mark Notified</span>
                  </button>
                  <span v-else class="px-3 py-2 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg text-xs sm:text-sm">
                    <Icon name="heroicons:check" class="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                    <span class="hidden sm:inline">Notified</span>
                  </span>
                  <button
                    @click="deleteRequest(request.requestId)"
                    class="px-3 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all duration-300 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Icon name="heroicons:trash" class="w-3 h-3 sm:w-4 sm:h-4" />
                    <span class="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Homepage QR Collaboration Applications (Producers Only) -->
          <div v-if="isRoleDetectionComplete && isMainProducer" class="bg-black/40 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-8 sm:p-12 mt-8">
            <div class="flex items-center justify-between mb-8">
              <h3 class="text-2xl sm:text-3xl font-semibold text-white flex items-center gap-3">
                <Icon name="heroicons:qr-code" class="w-8 h-8 sm:w-10 sm:h-10 text-purple-400" />
                Homepage Contact Forms
              </h3>
              <button
                @click="loadHomepageQRApplications"
                class="px-6 py-4 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl hover:bg-purple-500/30 transition-all duration-300 flex items-center gap-3 text-base sm:text-lg"
              >
                <Icon name="heroicons:arrow-path" class="w-5 h-5 sm:w-6 sm:h-6" />
                Refresh
              </button>
            </div>
            
            <div v-if="homepageQRApplications.length > 0" class="space-y-6">
              <div v-for="application in homepageQRApplications" :key="application.applicationId" 
                   class="bg-black/20 rounded-xl p-6 sm:p-8 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300">
                <!-- Application Header -->
                <div class="flex items-center justify-between mb-4 sm:mb-6">
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <Icon name="heroicons:user" class="w-4 h-4 sm:w-5 sm:w-5 text-purple-400" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <h4 class="text-white font-medium text-base sm:text-lg truncate">{{ application.fullName }}</h4>
                      <p class="text-gray-400 text-sm truncate">Via Homepage QR Code</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm px-3 py-1 rounded-full font-medium"
                          :class="[
                            application.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                            application.status === 'approved' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                            'bg-red-500/20 text-red-300 border border-red-500/30'
                          ]">
                      {{ application.status }}
                    </span>
                    <span class="text-gray-400 text-sm">{{ formatDate(application.submittedAt) }}</span>
                  </div>
                </div>
                
                <!-- Application Details -->
                <div class="space-y-4 mb-6">
                  <div>
                    <p class="text-gray-400 text-sm mb-1">Contact Info</p>
                    <p class="text-white">{{ application.contactInfo }}</p>
                  </div>
                  
                  <div>
                    <p class="text-gray-400 text-sm mb-1">Stream Concept</p>
                    <p class="text-white">{{ application.streamConcept }}</p>
                  </div>
                  
                  <div>
                    <p class="text-gray-400 text-sm mb-1">Experience Level</p>
                    <p class="text-white capitalize">{{ application.experienceLevel }}</p>
                  </div>
                  
                  <div>
                    <p class="text-gray-400 text-sm mb-1">Availability</p>
                    <p class="text-white">{{ application.availability }}</p>
                  </div>
                  
                  <div v-if="application.preferredDays && application.preferredDays.length > 0">
                    <p class="text-gray-400 text-sm mb-1">Preferred Days</p>
                    <div class="flex flex-wrap gap-2">
                      <span v-for="day in application.preferredDays" :key="day" 
                            class="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-sm capitalize">
                        {{ day }}
                      </span>
                    </div>
                  </div>
                  
                  <div v-if="application.preferredTimes && application.preferredTimes.length > 0">
                    <p class="text-gray-400 text-sm mb-1">Preferred Times</p>
                    <div class="flex flex-wrap gap-2">
                      <span v-for="time in application.preferredTimes" :key="time" 
                            class="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-sm">
                        {{ time }}
                      </span>
                    </div>
                  </div>
                  
                  <div v-if="application.contentLink">
                    <p class="text-gray-400 text-sm mb-1">Content Link</p>
                    <a :href="application.contentLink" target="_blank" class="text-purple-400 hover:text-purple-300 break-all">
                      {{ application.contentLink }}
                    </a>
                  </div>
                  
                  <div v-if="application.additionalNotes">
                    <p class="text-gray-400 text-sm mb-1">Additional Notes</p>
                    <p class="text-white">{{ application.additionalNotes }}</p>
                  </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                  <button
                    v-if="application.status === 'pending'"
                    @click="approveHomepageQRApplication(application.applicationId)"
                    class="px-3 py-2 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-all duration-300 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Icon name="heroicons:check" class="w-3 h-3 sm:w-4 sm:h-4" />
                    <span class="hidden sm:inline">Approve</span>
                  </button>
                  <button
                    v-if="application.status === 'pending'"
                    @click="rejectHomepageQRApplication(application.applicationId)"
                    class="px-3 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all duration-300 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Icon name="heroicons:x-mark" class="w-3 h-3 sm:w-4 sm:h-4" />
                    <span class="hidden sm:inline">Reject</span>
                  </button>
                  <button
                    @click="viewHomepageQRApplication(application)"
                    class="px-3 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all duration-300 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Icon name="heroicons:eye" class="w-3 h-3 sm:w-4 sm:h-4" />
                    <span class="hidden sm:inline">View Details</span>
                  </button>
                  <button
                    @click="deleteHomepageQRApplication(application.applicationId)"
                    class="px-3 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all duration-300 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Icon name="heroicons:trash" class="w-3 h-3 sm:w-4 sm:h-4" />
                    <span class="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div v-else-if="isLoadingHomepageQR" class="text-center py-16">
              <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-400 mb-4"></div>
              <p class="text-gray-300 text-lg">Loading homepage QR applications...</p>
            </div>
            <div v-else class="text-center py-16">
              <Icon name="heroicons:qr-code" class="w-20 h-20 text-gray-400 mx-auto mb-6" />
              <h3 class="text-white text-2xl mb-4">No homepage contact forms yet</h3>
              <p class="text-gray-300 text-lg">Contact forms submitted through the homepage QR code will appear here</p>
            </div>
          </div>

          <!-- Quick Actions (Producers Only) -->
          <div v-if="isRoleDetectionComplete && isMainProducer" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8 opacity-50 cursor-not-allowed">
              <div class="flex items-center gap-4 mb-6">
                <Icon name="heroicons:chart-bar" class="w-10 h-10 sm:w-12 sm:h-12 text-teal-400" />
                <h3 class="text-xl sm:text-2xl font-semibold text-white">View Analytics</h3>
              </div>
              <p class="text-gray-300 text-base sm:text-lg">Track your content performance and audience engagement</p>
            </div>

            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8 opacity-50 cursor-not-allowed">
              <div class="flex items-center gap-4 mb-6">
                <Icon name="heroicons:currency-dollar" class="w-10 h-10 sm:w-12 sm:h-12 text-teal-400" />
                <h3 class="text-xl sm:text-2xl font-semibold text-white">Earnings History</h3>
              </div>
              <p class="text-gray-300 text-base sm:text-lg">View detailed earnings reports and payout history</p>
            </div>

            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8 opacity-50 cursor-not-allowed">
              <div class="flex items-center gap-4 mb-6">
                <Icon name="heroicons:plus-circle" class="w-10 h-10 sm:w-12 sm:h-12 text-teal-400" />
                <h3 class="text-xl sm:text-2xl font-semibold text-white">Upload Content</h3>
              </div>
              <p class="text-gray-300 text-base sm:text-lg">Add new videos, images, or other content to your channels</p>
            </div>
          </div>

        </div>

        <!-- Buyer Dashboard -->
        <div v-if="authStore.userType === 'buyer' && authStore.userType !== 'producer' && authStore.userType !== 'creator'" class="space-y-12 sm:space-y-16 lg:space-y-20">
          <!-- Become a Creator CTA -->
          <div class="bg-gradient-to-r from-teal-500/20 to-teal-600/20 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8 sm:p-12 lg:p-16">
            <div class="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              <div class="flex-1 text-center lg:text-left">
                <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
                  Ready to <span class="text-teal-400">Create Content</span>?
                </h2>
                <p class="text-gray-300 text-xl sm:text-2xl mb-8">
                  Start monetizing your content and building your audience. Join thousands of creators earning on Twilly.
                </p>
                <div class="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <NuxtLink
                    to="/creator/signup"
                    class="inline-flex items-center gap-3 px-8 py-4 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-all duration-300 font-semibold text-lg"
                  >
                    <Icon name="heroicons:video-camera" class="w-6 h-6" />
                    Become a Creator
                  </NuxtLink>
                  <button
                    @click="learnMore"
                    class="inline-flex items-center gap-3 px-8 py-4 bg-transparent text-teal-300 border border-teal-500/30 rounded-xl hover:bg-teal-500/20 transition-all duration-300 font-semibold text-lg"
                  >
                    <Icon name="heroicons:information-circle" class="w-6 h-6" />
                    Learn More
                  </button>
                </div>
              </div>
              <div class="flex-shrink-0">
                <div class="w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center">
                  <Icon name="heroicons:sparkles" class="w-16 h-16 sm:w-20 sm:h-20 text-white" />
                </div>
              </div>
            </div>
          </div>

          <!-- My Purchases Section -->
          <div class="bg-black/30 backdrop-blur-sm rounded-2xl border border-blue-500/30 p-8 sm:p-12">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-8">
              <h2 class="text-2xl sm:text-3xl font-semibold text-white flex items-center">
                <Icon name="heroicons:shopping-bag" class="w-8 h-8 sm:w-10 sm:h-10 mr-4 text-blue-400" />
                My Purchases
              </h2>
              <button
                @click="refreshPurchases"
                class="px-6 py-4 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl hover:bg-blue-500/30 transition-all duration-300 flex items-center gap-3 text-base sm:text-lg"
              >
                <Icon name="heroicons:arrow-path" class="w-5 h-5 sm:w-6 sm:h-6" />
                Refresh
              </button>
            </div>
            
            <div v-if="purchases.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              <div v-for="purchase in purchases" :key="purchase.id" 
                   class="bg-black/20 rounded-xl p-6 sm:p-8 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300">
                <!-- Purchase Header -->
                <div class="flex items-center justify-between mb-4 sm:mb-6">
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Icon 
                        :name="purchase.category === 'Videos' ? 'heroicons:video-camera' : 
                               purchase.category === 'Images' ? 'heroicons:photo' :
                               purchase.category === 'Audios' ? 'heroicons:musical-note' :
                               'heroicons:document'" 
                        class="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" 
                      />
                    </div>
                    <div class="min-w-0 flex-1">
                      <h3 class="text-white font-medium text-base sm:text-lg truncate">{{ purchase.title }}</h3>
                      <p class="text-gray-400 text-sm truncate">{{ purchase.creatorName }}</p>
                    </div>
                  </div>
                  <span class="text-blue-300 text-sm sm:text-base font-medium flex-shrink-0 ml-3">${{ purchase.amount }}</span>
                </div>
                
                <!-- Purchase Details -->
                <p class="text-gray-300 text-sm sm:text-base mb-4 sm:mb-6 line-clamp-2">{{ purchase.description }}</p>
                
                <!-- Purchase Footer -->
                <div class="flex items-center justify-between">
                  <span class="text-gray-400 text-sm">{{ formatDate(purchase.purchaseDate) }}</span>
                  <div class="flex gap-2 sm:gap-3">
                    <button
                      @click="viewPurchase(purchase)"
                      class="px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all duration-300 flex items-center gap-2 text-sm"
                    >
                      <Icon name="heroicons:play" class="w-4 h-4" />
                      <span class="hidden sm:inline">Play</span>
                    </button>
                    <button
                      v-if="purchase.hlsUrl || purchase.clipUrl"
                      @click="downloadPurchase(purchase)"
                      class="px-4 py-2 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg hover:bg-gray-500/30 transition-all duration-300 flex items-center gap-2 text-sm"
                    >
                      <Icon name="heroicons:arrow-down-tray" class="w-4 h-4" />
                      <span class="hidden sm:inline">Download</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else class="text-center py-16">
              <Icon name="heroicons:shopping-bag" class="w-20 h-20 text-gray-400 mx-auto mb-6" />
              <h3 class="text-white text-2xl mb-4">No purchases yet</h3>
              <p class="text-gray-300 text-lg">Start exploring content to make your first purchase</p>
            </div>
          </div>

          <!-- Browse Content -->
          <div class="bg-black/30 backdrop-blur-sm rounded-2xl border border-blue-500/30 p-8 sm:p-12">
            <h3 class="text-xl sm:text-2xl font-semibold text-white mb-8 flex items-center">
              <Icon name="heroicons:magnifying-glass" class="w-6 h-6 sm:w-8 sm:h-8 mr-4 text-blue-400" />
              Browse Content
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div class="flex items-center p-6 sm:p-8 bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl hover:from-blue-500/30 hover:to-blue-600/30 transition-all duration-300 cursor-pointer">
                <Icon name="heroicons:magnifying-glass" class="w-8 h-8 sm:w-10 sm:h-10 text-blue-400 mr-4 sm:mr-6 flex-shrink-0" />
                <div class="min-w-0 flex-1">
                  <span class="text-white font-medium block text-base sm:text-lg">Discover Content</span>
                  <span class="text-gray-300 text-sm sm:text-base">Find creators and content</span>
                </div>
              </div>

              <div class="flex items-center p-6 sm:p-8 bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl hover:from-green-500/30 hover:to-green-600/30 transition-all duration-300 cursor-pointer">
                <Icon name="heroicons:heart" class="w-8 h-8 sm:w-10 sm:h-10 text-green-400 mr-4 sm:mr-6 flex-shrink-0" />
                <div class="min-w-0 flex-1">
                  <span class="text-white font-medium block text-base sm:text-lg">Favorites</span>
                  <span class="text-gray-300 text-sm sm:text-base">Your saved content</span>
                </div>
              </div>

              <div class="flex items-center p-6 sm:p-8 bg-gradient-to-r from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl hover:from-purple-500/30 hover:to-purple-600/30 transition-all duration-300 cursor-pointer">
                <Icon name="heroicons:bell" class="w-8 h-8 sm:w-10 sm:h-10 text-purple-400 mr-4 sm:mr-6 flex-shrink-0" />
                <div class="min-w-0 flex-1">
                  <span class="text-white font-medium block text-base sm:text-lg">Notifications</span>
                  <span class="text-gray-300 text-sm sm:text-base">New content alerts</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Viewer Dashboard (for users who are not creators or buyers) -->
        <div v-if="authStore.userType !== 'producer' && authStore.userType !== 'creator' && authStore.userType !== 'regular' && authStore.userType !== 'buyer'" class="space-y-12 sm:space-y-16 lg:space-y-20">
          <!-- Become a Creator CTA -->
          <div class="bg-gradient-to-r from-teal-500/20 to-teal-600/20 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8 sm:p-12 lg:p-16">
            <div class="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              <div class="flex-1 text-center lg:text-left">
                <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
                  Start Your <span class="text-teal-400">Creator Journey</span>
                </h2>
                <p class="text-gray-300 text-xl sm:text-2xl mb-8">
                  Transform your passion into profit. Create, share, and monetize your content with our powerful creator tools.
                </p>
                <div class="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <NuxtLink
                    to="/creator/signup"
                    class="inline-flex items-center gap-3 px-8 py-4 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-all duration-300 font-semibold text-lg"
                  >
                    <Icon name="heroicons:video-camera" class="w-6 h-6" />
                    Become a Creator
                  </NuxtLink>
                  <button
                    @click="learnMore"
                    class="inline-flex items-center gap-3 px-8 py-4 bg-transparent text-teal-300 border border-teal-500/30 rounded-xl hover:bg-teal-500/20 transition-all duration-300 font-semibold text-lg"
                  >
                    <Icon name="heroicons:information-circle" class="w-6 h-6" />
                    Learn More
                  </button>
                </div>
              </div>
              <div class="flex-shrink-0">
                <div class="w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center">
                  <Icon name="heroicons:rocket-launch" class="w-16 h-16 sm:w-20 sm:h-20 text-white" />
                </div>
              </div>
            </div>
          </div>

          <!-- Creator Benefits -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8">
              <div class="flex items-center gap-4 mb-6">
                <Icon name="heroicons:currency-dollar" class="w-10 h-10 sm:w-12 sm:h-12 text-teal-400" />
                <h3 class="text-xl sm:text-2xl font-semibold text-white">Earn Money</h3>
              </div>
              <p class="text-gray-300 text-base sm:text-lg">Get 70% of every sale instantly with Lemon Squeezy integration</p>
            </div>

            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8">
              <div class="flex items-center gap-4 mb-6">
                <Icon name="heroicons:users" class="w-10 h-10 sm:w-12 sm:h-12 text-teal-400" />
                <h3 class="text-xl sm:text-2xl font-semibold text-white">Build Audience</h3>
              </div>
              <p class="text-gray-300 text-base sm:text-lg">Connect with viewers and grow your community</p>
            </div>

            <div class="bg-black/40 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8">
              <div class="flex items-center gap-4 mb-6">
                <Icon name="heroicons:chart-bar" class="w-10 h-10 sm:w-12 sm:h-12 text-teal-400" />
                <h3 class="text-xl sm:text-2xl font-semibold text-white">Track Performance</h3>
              </div>
              <p class="text-gray-300 text-base sm:text-lg">Monitor your earnings and content analytics</p>
            </div>
          </div>

          <!-- Explore Content -->
          <div class="bg-black/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-8 sm:p-12">
            <h3 class="text-xl sm:text-2xl font-semibold text-white mb-8 flex items-center">
              <Icon name="heroicons:magnifying-glass" class="w-6 h-6 sm:w-8 sm:h-8 mr-4 text-purple-400" />
              Explore Content
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div class="flex items-center p-6 sm:p-8 bg-gradient-to-r from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl hover:from-purple-500/30 hover:to-purple-600/30 transition-all duration-300 cursor-pointer">
                <Icon name="heroicons:magnifying-glass" class="w-8 h-8 sm:w-10 sm:h-10 text-purple-400 mr-4 sm:mr-6 flex-shrink-0" />
                <div class="min-w-0 flex-1">
                  <span class="text-white font-medium block text-base sm:text-lg">Discover Content</span>
                  <span class="text-gray-300 text-sm sm:text-base">Find creators and content</span>
                </div>
              </div>

              <div class="flex items-center p-6 sm:p-8 bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl hover:from-green-500/30 hover:to-green-600/30 transition-all duration-300 cursor-pointer">
                <Icon name="heroicons:heart" class="w-8 h-8 sm:w-10 sm:h-10 text-green-400 mr-4 sm:mr-6 flex-shrink-0" />
                <div class="min-w-0 flex-1">
                  <span class="text-white font-medium block text-base sm:text-lg">Favorites</span>
                  <span class="text-gray-300 text-sm sm:text-base">Your saved content</span>
                </div>
              </div>

              <div class="flex items-center p-6 sm:p-8 bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl hover:from-blue-500/30 hover:to-blue-600/30 transition-all duration-300 cursor-pointer">
                <Icon name="heroicons:bell" class="w-8 h-8 sm:w-10 sm:h-10 text-blue-400 mr-4 sm:mr-6 flex-shrink-0" />
                <div class="min-w-0 flex-1">
                  <span class="text-white font-medium block text-base sm:text-lg">Notifications</span>
                  <span class="text-gray-300 text-sm sm:text-base">New content alerts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Request Details Modal -->
    <div v-if="showRequestModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-black/90 backdrop-blur-sm border border-teal-500/30 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-2xl font-semibold text-white">Request Details</h3>
          <button @click="closeRequestModal" class="text-gray-400 hover:text-white">
            <Icon name="heroicons:x-mark" class="w-6 h-6" />
          </button>
        </div>
        
        <div v-if="selectedRequest" class="space-y-6">
          <!-- Header -->
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center">
              <Icon name="heroicons:user" class="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <h4 class="text-white font-medium text-xl">{{ selectedRequest.fullName }}</h4>
              <p class="text-gray-400">{{ selectedRequest.channelId }}</p>
            </div>
          </div>
          
          <!-- Details Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p class="text-gray-400 text-sm mb-2">Contact Information</p>
              <p class="text-white">{{ selectedRequest.contactInfo }}</p>
            </div>
            
            <div>
              <p class="text-gray-400 text-sm mb-2">Availability</p>
              <p class="text-white">{{ selectedRequest.availability }}</p>
            </div>
            
            <div class="md:col-span-2">
              <p class="text-gray-400 text-sm mb-2">Stream Concept</p>
              <p class="text-white">{{ selectedRequest.streamConcept }}</p>
            </div>
            
            <div v-if="selectedRequest.contentLink" class="md:col-span-2">
              <p class="text-gray-400 text-sm mb-2">Content Link</p>
              <a :href="selectedRequest.contentLink" target="_blank" class="text-teal-400 hover:text-teal-300 break-all">
                {{ selectedRequest.contentLink }}
              </a>
            </div>
            
            <div v-if="selectedRequest.preferredTimeSlots && selectedRequest.preferredTimeSlots.length > 0" class="md:col-span-2">
              <p class="text-gray-400 text-sm mb-2">Preferred Time Slots</p>
              <div class="flex flex-wrap gap-2">
                <span v-for="slot in selectedRequest.preferredTimeSlots" :key="slot" 
                      class="px-3 py-1 bg-teal-500/20 text-teal-300 rounded-full text-sm">
                  {{ slot }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Video Preview -->
          <div v-if="selectedRequest.clipUrl" class="border-t border-white/10 pt-6">
            <p class="text-gray-400 text-sm mb-4">Pilot Clip</p>
            <video 
              :src="selectedRequest.clipUrl" 
              controls 
              class="w-full rounded-lg"
              preload="metadata"
            >
              Your browser does not support the video tag.
            </video>
          </div>
          
          <!-- Action Buttons -->
          <div v-if="selectedRequest.status === 'pending'" class="flex items-center gap-3 pt-6 border-t border-white/10">
            <button
              @click="approveRequest(selectedRequest.requestId)"
              class="px-6 py-3 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-all duration-300 flex items-center gap-2"
            >
              <Icon name="heroicons:check" class="w-5 h-5" />
              Approve Request
            </button>
            <button
              @click="rejectRequest(selectedRequest.requestId)"
              class="px-6 py-3 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all duration-300 flex items-center gap-2"
            >
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
              Reject Request
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Application Details Modal -->
    <div v-if="showApplicationModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-black/90 backdrop-blur-sm border border-blue-500/30 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-2xl font-semibold text-white">Application Details</h3>
          <button @click="closeApplicationModal" class="text-gray-400 hover:text-white">
            <Icon name="heroicons:x-mark" class="w-6 h-6" />
          </button>
        </div>
        
        <div v-if="selectedApplication" class="space-y-6">
          <!-- Header -->
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Icon name="heroicons:user" class="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h4 class="text-white font-medium text-xl">{{ selectedApplication.fullName }}</h4>
              <p class="text-gray-400">{{ selectedApplication.contactInfo }}</p>
            </div>
          </div>
          
          <!-- Application Details -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p class="text-gray-400 text-sm mb-2">Project Title</p>
              <p class="text-white">{{ selectedApplication.projectTitle }}</p>
            </div>
            
            <div>
              <p class="text-gray-400 text-sm mb-2">Status</p>
              <span class="px-3 py-1 rounded-full text-sm font-medium" :class="[
                selectedApplication.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                selectedApplication.status === 'approved' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                'bg-red-500/20 text-red-300 border border-red-500/30'
              ]">{{ selectedApplication.status }}</span>
            </div>
            
            <div>
              <p class="text-gray-400 text-sm mb-2">Applied Date</p>
              <p class="text-white">{{ formatDate(selectedApplication.createdAt) }}</p>
            </div>
            
            <div>
              <p class="text-gray-400 text-sm mb-2">Request ID</p>
              <p class="text-white font-mono text-sm">{{ selectedApplication.requestId }}</p>
            </div>
          </div>
          
          <!-- Interest/Experience -->
          <div v-if="selectedApplication.interest" class="border-t border-white/10 pt-6">
            <p class="text-gray-400 text-sm mb-2">Interest in Project</p>
            <p class="text-white">{{ selectedApplication.interest }}</p>
          </div>
          
          <div v-if="selectedApplication.experience" class="border-t border-white/10 pt-6">
            <p class="text-gray-400 text-sm mb-2">Relevant Experience</p>
            <p class="text-white">{{ selectedApplication.experience }}</p>
          </div>
          
          <!-- Action Buttons -->
          <div v-if="selectedApplication.status === 'pending'" class="flex items-center gap-3 pt-6 border-t border-white/10">
            <button
              @click="approveApplication(selectedApplication.requestId, selectedApplication.applicationId)"
              class="px-6 py-3 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-all duration-300 flex items-center gap-2"
            >
              <Icon name="heroicons:check" class="w-5 h-5" />
              Approve Application
            </button>
            <button
              @click="rejectApplication(selectedApplication.requestId, selectedApplication.applicationId)"
              class="px-6 py-3 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all duration-300 flex items-center gap-2"
            >
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
              Reject Application
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Talent Request Modal -->
    <div v-if="showEditModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-black/90 backdrop-blur-sm border border-teal-500/30 rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-2xl font-semibold text-white">Edit Talent Request</h3>
          <button @click="closeEditModal" class="text-gray-400 hover:text-white">
            <Icon name="heroicons:x-mark" class="w-6 h-6" />
          </button>
        </div>
        
        <form @submit.prevent="saveTalentRequest" class="space-y-6">
          <!-- Basic Information -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-gray-300 mb-2 text-sm font-medium">Project Title *</label>
              <input
                v-model="editForm.projectTitle"
                type="text"
                required
                class="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                placeholder="Enter project title"
              />
            </div>
            
            <div>
              <label class="block text-gray-300 mb-2 text-sm font-medium">Channel *</label>
              <input
                v-model="editForm.channel"
                type="text"
                required
                class="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                placeholder="Enter channel name"
              />
            </div>
            
            <div>
              <label class="block text-gray-300 mb-2 text-sm font-medium">Status</label>
              <select
                v-model="editForm.status"
                class="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none"
              >
                <option value="accepting_pilots">Accepting Pilots</option>
                <option value="casting_closed">Casting Closed</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
            
            <div>
              <label class="block text-gray-300 mb-2 text-sm font-medium">Start Date</label>
              <input
                v-model="editForm.startDate"
                type="date"
                class="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none"
              />
            </div>
            
            <div>
              <label class="block text-gray-300 mb-2 text-sm font-medium">Stream Length</label>
              <input
                v-model="editForm.streamLength"
                type="text"
                class="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                placeholder="e.g., 25 min, 1 hour"
              />
            </div>
            
            <div>
              <label class="block text-gray-300 mb-2 text-sm font-medium">Location</label>
              <input
                v-model="editForm.location"
                type="text"
                class="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                placeholder="e.g., Remote, Los Angeles, etc."
              />
            </div>
          </div>
          
          <!-- Content -->
          <div>
            <label class="block text-gray-300 mb-2 text-sm font-medium">Show Concept *</label>
            <textarea
              v-model="editForm.showConcept"
              rows="4"
              required
              class="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none"
              placeholder="Describe your show concept and what you're looking for..."
            ></textarea>
          </div>
          
          <div>
            <label class="block text-gray-300 mb-2 text-sm font-medium">Casting Needs</label>
            <textarea
              v-model="editForm.castingNeeds"
              rows="3"
              class="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none"
              placeholder="Describe the specific casting needs and requirements..."
            ></textarea>
          </div>
          
          <!-- Time Slots -->
          <div>
            <label class="block text-gray-300 mb-2 text-sm font-medium">Time Slots</label>
            <div class="space-y-2">
              <div v-for="(slot, index) in editForm.timeSlots" :key="index" class="flex items-center gap-2">
                <input
                  v-model="editForm.timeSlots[index]"
                  type="text"
                  class="flex-1 px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                  placeholder="e.g., Monday 7-9 PM EST"
                />
                <button
                  type="button"
                  @click="removeTimeSlot(index)"
                  class="px-3 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30"
                >
                  <Icon name="heroicons:trash" class="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                @click="addTimeSlot"
                class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30"
              >
                <Icon name="heroicons:plus" class="w-4 h-4 mr-2" />
                Add Time Slot
              </button>
            </div>
          </div>
          
          <!-- Tags -->
          <div>
            <label class="block text-gray-300 mb-2 text-sm font-medium">Tags</label>
            <div class="space-y-2">
              <div v-for="(tag, index) in editForm.tags" :key="index" class="flex items-center gap-2">
                <input
                  v-model="editForm.tags[index]"
                  type="text"
                  class="flex-1 px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none"
                  placeholder="e.g., adult content, after dark"
                />
                <button
                  type="button"
                  @click="removeTag(index)"
                  class="px-3 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30"
                >
                  <Icon name="heroicons:trash" class="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                @click="addTag"
                class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30"
              >
                <Icon name="heroicons:plus" class="w-4 h-4 mr-2" />
                Add Tag
              </button>
            </div>
          </div>
          
          <!-- Revenue Share -->
          <div>
            <label class="block text-gray-300 mb-2 text-sm font-medium">Revenue Share</label>
            <input
              v-model="editForm.revenueShare"
              type="text"
              class="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none"
              placeholder="e.g., 50% of revenue, $100 per episode"
            />
          </div>
          
          <!-- Channel Poster Upload -->
          <div>
            <label class="block text-gray-300 mb-2 text-sm font-medium">Channel Poster</label>
            <div class="space-y-3">
              <!-- Current poster preview -->
              <div v-if="editForm.channelPosterUrl" class="flex items-center gap-3">
                <img 
                  :src="editForm.channelPosterUrl" 
                  alt="Current poster" 
                  class="w-16 h-16 object-cover rounded-lg border border-white/10"
                />
                <div class="flex-1">
                  <p class="text-white text-sm truncate">{{ editForm.channelPosterUrl }}</p>
                  <button 
                    type="button"
                    @click="editForm.channelPosterUrl = ''"
                    class="text-red-400 text-xs hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
              
              <!-- File upload -->
              <div class="border-2 border-dashed border-white/20 rounded-lg p-4 text-center">
                <input
                  ref="posterFileInput"
                  type="file"
                  accept="image/*"
                  @change="handlePosterUpload"
                  class="hidden"
                />
                <button
                  type="button"
                  @click="$refs.posterFileInput.click()"
                  class="w-full px-4 py-3 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300"
                >
                  <Icon name="heroicons:cloud-arrow-up" class="w-5 h-5 inline mr-2" />
                  Upload New Poster Image
                </button>
                <p class="text-gray-400 text-xs mt-2">Upload a new image to replace the current poster</p>
              </div>
              
              <!-- Manual URL input -->
              <div>
                <label class="block text-gray-300 mb-2 text-xs">Or enter URL manually:</label>
                <input
                  v-model="editForm.channelPosterUrl"
                  type="url"
                  class="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none text-sm"
                  placeholder="https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/..."
                />
              </div>
            </div>
          </div>
          
          <!-- Inspiration Image URL -->
          <div>
            <label class="block text-gray-300 mb-2 text-sm font-medium">Inspiration Image URL</label>
            <input
              v-model="editForm.inspirationImage"
              type="url"
              class="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none"
              placeholder="https://example.com/image.jpg"
            />
          </div>
          
          <!-- Pilot Video URL -->
          <div>
            <label class="block text-gray-300 mb-2 text-sm font-medium">Pilot Video URL</label>
            <input
              v-model="editForm.pilotUrl"
              type="url"
              class="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none"
              placeholder="https://example.com/video.mp4"
            />
          </div>
          
          <!-- Action Buttons -->
          <div class="flex items-center gap-4 pt-6 border-t border-white/10">
            <button
              type="button"
              @click="closeEditModal"
              class="px-6 py-3 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg hover:bg-gray-500/30 transition-all duration-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isSaving"
              class="px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Icon v-if="isSaving" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
              {{ isSaving ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Share Modal -->
    <div v-if="showShareModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-black/90 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8 max-w-2xl w-full">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-2xl font-semibold text-white">Share Talent Request</h3>
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

    <!-- Homepage QR Application Modal -->
    <div v-if="showHomepageQRApplicationModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-black/90 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-2xl font-semibold text-white">Homepage QR Application Details</h3>
          <button @click="showHomepageQRApplicationModal = false" class="text-gray-400 hover:text-white">
            <Icon name="heroicons:x-mark" class="w-6 h-6" />
          </button>
        </div>
        
        <div v-if="selectedHomepageQRApplication" class="space-y-6">
          <!-- Header -->
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Icon name="heroicons:qr-code" class="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h4 class="text-white font-medium text-xl">{{ selectedHomepageQRApplication.fullName }}</h4>
              <p class="text-gray-400">Via Homepage QR Code</p>
            </div>
          </div>
          
          <!-- Details Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p class="text-gray-400 text-sm mb-2">Contact Information</p>
              <p class="text-white">{{ selectedHomepageQRApplication.contactInfo }}</p>
            </div>
            
            <div>
              <p class="text-gray-400 text-sm mb-2">Experience Level</p>
              <p class="text-white capitalize">{{ selectedHomepageQRApplication.experienceLevel }}</p>
            </div>
            
            <div class="md:col-span-2">
              <p class="text-gray-400 text-sm mb-2">Stream Concept</p>
              <p class="text-white">{{ selectedHomepageQRApplication.streamConcept }}</p>
            </div>
            
            <div class="md:col-span-2">
              <p class="text-gray-400 text-sm mb-2">Availability</p>
              <p class="text-white">{{ selectedHomepageQRApplication.availability }}</p>
            </div>
            
            <div v-if="selectedHomepageQRApplication.preferredDays && selectedHomepageQRApplication.preferredDays.length > 0" class="md:col-span-2">
              <p class="text-gray-400 text-sm mb-2">Preferred Days</p>
              <div class="flex flex-wrap gap-2">
                <span v-for="day in selectedHomepageQRApplication.preferredDays" :key="day" 
                      class="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm capitalize">
                  {{ day }}
                </span>
              </div>
            </div>
            
            <div v-if="selectedHomepageQRApplication.preferredTimes && selectedHomepageQRApplication.preferredTimes.length > 0" class="md:col-span-2">
              <p class="text-gray-400 text-sm mb-2">Preferred Times</p>
              <div class="flex flex-wrap gap-2">
                <span v-for="time in selectedHomepageQRApplication.preferredTimes" :key="time" 
                      class="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm">
                  {{ time }}
                </span>
              </div>
            </div>
            
            <div v-if="selectedHomepageQRApplication.contentLink" class="md:col-span-2">
              <p class="text-gray-400 text-sm mb-2">Content Link</p>
              <a :href="selectedHomepageQRApplication.contentLink" target="_blank" class="text-purple-400 hover:text-purple-300 break-all">
                {{ selectedHomepageQRApplication.contentLink }}
              </a>
            </div>
            
            <div v-if="selectedHomepageQRApplication.additionalNotes" class="md:col-span-2">
              <p class="text-gray-400 text-sm mb-2">Additional Notes</p>
              <p class="text-white">{{ selectedHomepageQRApplication.additionalNotes }}</p>
            </div>
            
            <div class="md:col-span-2">
              <p class="text-gray-400 text-sm mb-2">Submitted</p>
              <p class="text-white">{{ formatDate(selectedHomepageQRApplication.submittedAt) }}</p>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div v-if="selectedHomepageQRApplication.status === 'pending'" class="flex items-center gap-3 pt-6 border-t border-white/10">
            <button
              @click="approveHomepageQRApplication(selectedHomepageQRApplication.applicationId)"
              class="px-6 py-3 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-all duration-300 flex items-center gap-2"
            >
              <Icon name="heroicons:check" class="w-5 h-5" />
              Approve Application
            </button>
            <button
              @click="rejectHomepageQRApplication(selectedHomepageQRApplication.applicationId)"
              class="px-6 py-3 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all duration-300 flex items-center gap-2"
            >
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
              Reject Application
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Collaborator Invite Success/Error Notifications -->
    <div
      v-if="showCollaboratorInviteSuccess"
      class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-500/90 backdrop-blur-sm
             text-white px-4 py-3 rounded-lg shadow-lg border border-green-400/30 z-50 max-w-sm"
    >
      <div class="flex items-center gap-2">
        <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-200" />
        <span class="text-sm">{{ collaboratorInviteMessage }}</span>
      </div>
    </div>


    <div
      v-if="showCollaboratorInviteError"
      class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 backdrop-blur-sm
             text-white px-4 py-3 rounded-lg shadow-lg border border-red-400/30 z-50 max-w-sm"
    >
      <div class="flex items-center gap-2">
        <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 text-red-200" />
        <span class="text-sm">{{ collaboratorInviteMessage }}</span>
      </div>
    </div>
  </div>

  <!-- Edit Modal (same as managefiles.vue) -->
  <div v-if="showVideoEditModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
    <div class="bg-gray-900 rounded-xl border border-gray-700 p-6 w-full max-w-md mx-4">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-white text-lg font-semibold">Edit Details</h3>
        <button
          @click="closeVideoEditModal"
          class="text-gray-400 hover:text-white transition-colors duration-200"
        >
          <Icon name="heroicons:x-mark" class="w-6 h-6" />
        </button>
      </div>

      <div v-if="isVideoEditModalLoading" class="text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400 mb-4"></div>
        <p class="text-white">Loading...</p>
      </div>

      <form v-else @submit.prevent="updateItemDetails" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Title</label>
          <input
            v-model="editingVideoItem.title"
            type="text"
            class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            placeholder="Enter video title"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Description</label>
          <textarea
            v-model="editingVideoItem.description"
            rows="3"
            class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            placeholder="Enter video description"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Price ($)</label>
          <input
            v-model.number="editingVideoItem.price"
            type="number"
            step="0.01"
            min="0"
            class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            placeholder="0.00"
          />
        </div>

        <div class="flex items-center">
          <input
            v-model="editingVideoItem.isVisible"
            type="checkbox"
            id="isVisible"
            class="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-600 rounded bg-gray-800"
          />
          <label for="isVisible" class="ml-2 text-sm text-gray-300">
            Make visible on channel
          </label>
        </div>

        <div class="flex gap-3 pt-4">
          <button
            type="button"
            @click="closeVideoEditModal"
            class="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="isVideoEditModalLoading"
            class="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isVideoEditModalLoading ? 'Updating...' : 'Update' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick, onUnmounted } from "vue";
import { useRoute } from 'vue-router';
import { useAuthStore } from "~/stores/auth";
import { useFileStore } from '~/stores/useFileStore';
import { useCollaboratorRequestsStore } from '~/stores/collaboratorRequests';
import { useTalentRequestsStore } from '~/stores/talentRequests';
import { Auth } from "aws-amplify";
import { useTaskStore } from '~/stores/TaskStore';
import 'video.js/dist/video-js.css';
import videojs from 'video.js';


const authStore = useAuthStore();
const fileStore = useFileStore();
const collaboratorRequestsStore = useCollaboratorRequestsStore();
const talentRequestsStore = useTalentRequestsStore();
const taskStore = useTaskStore();

// Client-side check
const isClient = ref(false);
const isLoading = ref(true);
const error = ref(null);
const purchases = ref([]);
const isRefreshing = ref(false)
const isRefreshingTalent = ref(false)
const activeStreamKeys = ref(0);
const totalEarnings = ref(0);
const showSuccessNotification = ref(false);
const successMessage = ref('');
const isSelectionMode = ref(false);
const isTogglingVisibility = ref(false);

// CONFIGURABLE: List of producer emails that have full access
// Add new producer emails here as needed
const PRODUCER_EMAILS = [
  'dehyu.sinyan@gmail.com',
  'dehsin365@gmail.com'  // Master account
  // Add more producer emails here as needed
];

// CONFIGURABLE: List of producer usernames that have full access
const PRODUCER_USERNAMES = [
  'DehSin365'
  // Add more producer usernames here as needed
];

// User role detection
const userRoles = ref({
  isMasterAccount: false,
  isCollaborator: false,
  isCastingDirector: false,
  hasSubscriptions: false,
  collaboratorChannels: [],
  castingDirectorChannels: [],
  subscriptions: []
});

// Check if user is a master account (using auth store)
const isMainProducer = computed(() => {
  return authStore.isMasterAccount();
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

// New persona-based computed properties
const currentPersona = computed(() => {
  return authStore.activePersona;
});

const isViewerPersona = computed(() => {
  return authStore.activePersona === 'viewer';
});

const isAffiliatePersona = computed(() => {
  const result = authStore.activePersona === 'affiliate';
  return result;
});

const isCreatorPersona = computed(() => {
  return authStore.activePersona === 'creator';
});

const isMasterPersona = computed(() => {
  return authStore.activePersona === 'master';
});

const canActivateAffiliate = computed(() => {
  return !authStore.personas.affiliate;
});

const canActivateCreator = computed(() => {
  return !authStore.personas.creator;
});

// Function to get display name for persona
const getPersonaDisplayName = (persona) => {
  switch (persona) {
    case 'master':
      return 'Master Account';
    case 'creator':
      return 'Content Creator';
    case 'affiliate':
      return 'Affiliate Marketer';
    case 'viewer':
      return 'Viewer';
    default:
      return 'Unknown';
  }
};

// Computed properties for onboarding flow
const userRole = computed(() => {
  if (userRoles.value.isCollaborator && userRoles.value.isCastingDirector) return 'Multi-Role';
  if (userRoles.value.isCollaborator) return 'Collaborator';
  if (userRoles.value.isCastingDirector) return 'Casting Director';
  if (userRoles.value.hasSubscriptions) return 'Viewer';
  return 'User';
});

const hasPayoutSetup = computed(() => {
  // For master accounts, check if they have Stripe Connect setup
  if (isMainProducer.value) {
    // Master accounts are considered to have payout setup if they have Stripe Connect
    // This should be checked against actual Stripe Connect status, but for now assume true
    return true;
  }
  
  // Check if any role has payout setup
  const collaboratorHasPayout = userRoles.value.collaboratorChannels?.some(channel => channel.hasPayoutSetup);
  const castingDirectorHasPayout = userRoles.value.castingDirectorChannels?.some(channel => channel.hasPayoutSetup);
  return collaboratorHasPayout || castingDirectorHasPayout;
});

// Check if user has subscriptions (viewer role)
const hasSubscriptions = computed(() => {
  return userRoles.value.hasSubscriptions || false;
});

// Persona activation methods
const affiliateInviteCode = ref('');
const creatorInviteCode = ref('');
const isActivatingAffiliate = ref(false);
const isActivatingCreator = ref(false);

const activateAffiliatePersona = async () => {
  if (!affiliateInviteCode.value.trim()) {
    alert('Please enter an affiliate invite code');
    return;
  }
  
  isActivatingAffiliate.value = true;
  try {
    const result = await authStore.activateAffiliatePersona(affiliateInviteCode.value.trim());
    if (result.success) {
      alert('Affiliate persona activated successfully!');
      affiliateInviteCode.value = '';
      await refreshData();
    } else {
      alert(result.message || 'Failed to activate affiliate persona');
    }
  } catch (error) {
    console.error('Error activating affiliate persona:', error);
    alert('Failed to activate affiliate persona');
  } finally {
    isActivatingAffiliate.value = false;
  }
};

const activateCreatorPersona = async () => {
  if (!creatorInviteCode.value.trim()) {
    alert('Please enter a creator invite code');
    return;
  }
  
  isActivatingCreator.value = true;
  try {
    const result = await authStore.activateCreatorPersona(creatorInviteCode.value.trim());
    if (result.success) {
      alert('Creator persona activated successfully!');
      creatorInviteCode.value = '';
      await refreshData();
    } else {
      alert(result.message || 'Failed to activate creator persona');
    }
  } catch (error) {
    console.error('Error activating creator persona:', error);
    alert('Failed to activate creator persona');
  } finally {
    isActivatingCreator.value = false;
  }
};

const switchPersona = async (persona) => {
  try {
    await authStore.switchPersona(persona);
    
    await refreshData();
  } catch (error) {
    console.error('Error switching persona:', error);
    alert('Failed to switch persona');
  }
};

const switchCreatorChannel = async (channelName) => {
  try {
    console.log('🎯 Profile: Switching to channel:', channelName);
    const result = await authStore.switchCreatorChannel(channelName);
    console.log('🎯 Profile: Channel switch result:', result);
    
    if (result.success) {
      // Channel switched successfully, no need to refresh all data
      console.log('✅ Channel switched successfully to:', channelName);
    } else {
      console.error('❌ Channel switch failed:', result.message);
      alert(result.message || 'Failed to switch channel');
    }
  } catch (error) {
    console.error('❌ Profile: Error switching creator channel:', error);
    alert('Failed to switch channel');
  }
};

// State for username
const currentUsername = ref('');

// Loading state for role detection
const isRoleDetectionComplete = ref(false);

// Earnings dashboard data (for talent users)
const monthlyEarnings = ref(0);
const pendingEarnings = ref(0);
const recentPayouts = ref([]);
const isLoadingEarnings = ref(false);

// Enhanced earnings data
const earningsData = ref({
  totalEarnings: 0,
  totalSubscriptions: 0,
  totalRevenue: 0,
  platformFee: 0,
  creatorShare: 0,
  collaboratorShare: 0,
  earningsByChannel: {},
  monthlyBreakdown: {},
  recentTransactions: []
});

// Payment status for creators
const paymentStatus = ref({
  isConnected: false,
  nextPayoutDate: '',
  pendingBalance: 0,
  lastPayoutAmount: 0
});

// Modal state
const showRequestModal = ref(false);
const selectedRequest = ref(null);
const showApplicationModal = ref(false);
const selectedApplication = ref(null);
const showEditModal = ref(false);
const isSaving = ref(false);
const activeTalentTab = ref('requests')
const appPage = ref(0)
const pageSize = 10

// Edit form state
const editForm = ref({
  projectTitle: '',
  channel: '',
  status: 'accepting_pilots',
  startDate: '',
  streamLength: '',
  location: '',
  showConcept: '',
  castingNeeds: '',
  timeSlots: [],
  tags: [],
  revenueShare: '',
  channelPosterUrl: '',
  inspirationImage: '',
  pilotUrl: ''
})

// Computed properties
const userDisplayName = computed(() => {
  // Priority 1: Username from DynamoDB (stored in currentUsername or authStore)
  if (currentUsername.value) {
    return currentUsername.value;
  }
  if (authStore.user?.attributes?.username) {
    return authStore.user.attributes.username;
  }
  // Priority 2: Name attribute
  if (authStore.user?.attributes?.name) {
    return authStore.user.attributes.name;
  }
  // Priority 3: Email prefix (fallback)
  if (authStore.user?.attributes?.email) {
    return authStore.user.attributes.email.split('@')[0];
  }
  return 'User';
});

const userEmail = computed(() => {
  return authStore.user?.attributes?.email || authStore.user?.username || 'No email';
});

// Computed properties for stats that force data loading
const contentMenusCount = computed(() => {
  // If folders are empty but user is a creator, trigger data load
  if ((authStore.userType === 'producer' || authStore.userType === 'creator' || authStore.userType === 'regular') && authStore.user?.attributes?.email && (!fileStore.folders || fileStore.folders.length === 0)) {
    // Trigger data load in next tick
    nextTick(() => {
      if (authStore.user?.attributes?.email) {
        fileStore.getFiles(authStore.user.attributes.email);
      }
    });
  }
  return fileStore.folders?.length || 0;
});

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
  if (!username && isClient.value) {
    const currentUserId = authStore.user?.attributes?.sub;
    if (currentUserId) {
      const userSpecificKey = `userUsername_${currentUserId}`;
      username = localStorage.getItem(userSpecificKey) || '';
    }
  }
  
  return username || '';
};

// Initialize role detection when component loads
const initializeRoleDetection = async () => {
  if (authStore.user?.attributes?.sub) {
    try {
      isRoleDetectionComplete.value = false;
      
      // Fetch username first
      currentUsername.value = await getUsernameWithFallbacks();
      console.log('Profile: Username set to:', currentUsername.value);
      
      // Then detect roles with timeout
      const roleDetectionPromise = detectUserRoles();
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          console.log('⏰ Profile: Role detection timeout, forcing completion');
          resolve();
        }, 3000); // 3 second timeout
      });
      
      await Promise.race([roleDetectionPromise, timeoutPromise]);
      
      // Mark role detection as complete
      isRoleDetectionComplete.value = true;
      console.log('Profile: Role detection complete');
    } catch (error) {
      console.error('Profile: Error initializing role detection:', error);
      isRoleDetectionComplete.value = true; // Still mark as complete to prevent infinite loading
    }
  }
};

// Trigger role detection when user data is available
watch(() => authStore.user, async (newUser) => {
  if (newUser?.attributes?.sub) {
    await initializeRoleDetection();
  }
}, { immediate: true });

const totalFilesCount = computed(() => {
  // If files are empty but user is a creator, trigger data load
  if ((authStore.userType === 'producer' || authStore.userType === 'creator' || authStore.userType === 'regular') && authStore.user?.attributes?.email && (!fileStore.files || fileStore.files.length === 0)) {
    // Trigger data load in next tick
    nextTick(() => {
      if (authStore.user?.attributes?.email) {
        fileStore.getFiles(authStore.user.attributes.email);
      }
    });
  }
  return fileStore.files?.length || 0;
});

// Computed property for active stream keys that ensures data is loaded
const activeStreamKeysCount = computed(() => {
  // If activeStreamKeys is 0 but user is a creator, trigger data load
  if ((authStore.userType === 'producer' || authStore.userType === 'creator' || authStore.userType === 'regular') && authStore.user?.attributes?.email && activeStreamKeys.value === 0) {
    // Trigger data load in next tick
    nextTick(async () => {
      if (authStore.user?.attributes?.email) {
        try {
          const response = await fetch('/api/stream-keys/count', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: authStore.user.attributes.email
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              activeStreamKeys.value = data.count || 0;
            }
          }
        } catch (error) {
          // Ignore stream keys loading errors
        }
      }
    });
  }
  return activeStreamKeys.value;
});

// Load earnings for creators
const loadEarnings = async () => {
  if ((authStore.userType === 'producer' || authStore.userType === 'creator' || authStore.userType === 'regular') && authStore.user?.attributes?.email) {
    try {
      const response = await $fetch('/api/stripe/get-earnings', {
        method: 'POST',
        body: {
          userId: authStore.user.attributes.email,
          period: '30'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.success) {
        totalEarnings.value = response.earnings.totalEarnings || 0;
        earningsData.value = response.earnings;
      } else {
        totalEarnings.value = 0;
        earningsData.value = {};
      }
    } catch (error) {
      console.error('Error loading earnings:', error);
      totalEarnings.value = 0;
      earningsData.value = {};
    }
  }
};

// Load payment status for creators (Stripe Connect)
const loadPaymentStatus = async () => {
  if ((authStore.userType === 'producer' || authStore.userType === 'creator' || authStore.userType === 'regular') && authStore.user?.attributes?.email) {
    try {
      // Check Stripe Connect account status
      const response = await $fetch('/api/stripe/get-account-status', {
        method: 'POST',
        body: {
          userId: authStore.user?.attributes?.email || authStore.user?.username
        }
      });
      
      if (response.success) {
        if (response.status === 'not_connected') {
          paymentStatus.value = {
            isConnected: false,
            nextPayoutDate: 'Not available',
            pendingBalance: 0,
            lastPayoutAmount: 0
          };
        } else if (response.status === 'pending') {
          paymentStatus.value = {
            isConnected: false,
            nextPayoutDate: 'Under Review',
            pendingBalance: 0,
            lastPayoutAmount: 0
          };
        } else if (response.status === 'active') {
          paymentStatus.value = {
            isConnected: true,
            nextPayoutDate: 'Weekly on Fridays',
            pendingBalance: 0,
            lastPayoutAmount: 0
          };
        } else {
          paymentStatus.value = {
            isConnected: false,
            nextPayoutDate: 'Not available',
            pendingBalance: 0,
            lastPayoutAmount: 0
          };
        }
      } else {
        paymentStatus.value = {
          isConnected: false,
          nextPayoutDate: 'Not available',
          pendingBalance: 0,
          lastPayoutAmount: 0
        };
      }
    } catch (error) {
      console.error('Error loading payment status:', error);
      paymentStatus.value = {
        isConnected: false,
        nextPayoutDate: 'Not available',
        pendingBalance: 0,
        lastPayoutAmount: 0
      };
    }
  }
};

// Setup payment account
const setupPaymentAccount = async () => {
  try {
    const response = await $fetch('/api/stripe/create-connect-account', {
      method: 'POST',
      body: {
        userId: authStore.user?.attributes?.email || authStore.user?.username
      }
    });
    
    if (response.success && response.onboardingUrl) {
      window.location.href = response.onboardingUrl;
    } else {
      throw new Error('Failed to get onboarding URL');
    }
  } catch (error) {
    console.error('Error setting up payment account:', error);
    alert('Failed to start payment setup. Please try again.');
  }
};

// Methods
const refreshPurchases = async () => {
  if (authStore.user?.attributes?.email) {
    try {
      const response = await $fetch(`/api/purchases/${authStore.user.attributes.email}`);
      if (response.success) {
        purchases.value = response.purchases || [];
      }
    } catch (error) {
      // Ignore purchase refresh errors
    }
  }
};

const viewPurchase = (purchase) => {
  // Open purchase in a new tab or modal
  if (purchase.hlsUrl) {
    window.open(purchase.hlsUrl, '_blank');
  } else if (purchase.clipUrl) {
    window.open(purchase.clipUrl, '_blank');
  }
};

const downloadPurchase = (purchase) => {
  // Create a download link for the purchase
  const url = purchase.hlsUrl || purchase.clipUrl;
  if (url) {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${purchase.title}.${purchase.category === 'Videos' ? 'mp4' : 
                    purchase.category === 'Images' ? 'jpg' : 
                    purchase.category === 'Audios' ? 'mp3' : 'pdf'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Removed duplicate formatDate function

const learnMore = () => {
  // Navigate to creator benefits page
  navigateTo('/creator/benefits');
};

// Load collaborator requests using store
const loadCollaboratorRequestsFromStore = async () => {
  if ((authStore.userType === 'producer' || authStore.userType === 'creator' || authStore.userType === 'regular') && authStore.user?.attributes?.email) {
    try {
      // First get the username for the current user
      const usernameResponse = await $fetch('/api/creators/get-username', {
        method: 'POST',
        body: {
          userId: authStore.user.attributes.email,
          email: authStore.user.attributes.email
        }
      });
      
      if (usernameResponse.success && usernameResponse.username) {
        // Use store to load requests with username
        await collaboratorRequestsStore.loadRequests(null, usernameResponse.username);
      } else {
        // Fallback to using email directly
        await collaboratorRequestsStore.loadRequests(authStore.user.attributes.email);
      }
      
      // Scroll to top after loading data
      scrollToTop();
    } catch (error) {
      console.error('Error loading collaborator requests:', error);
    }
  }
};

// Load talent requests using store
const loadTalentRequestsFromStore = async () => {
  if ((authStore.userType === 'producer' || authStore.userType === 'creator' || authStore.userType === 'regular') && authStore.user?.attributes?.email) {
    // Prevent multiple simultaneous loads
    if (talentRequestsStore.isLoading) {
      console.log('Talent requests already loading, skipping...');
      return;
    }
    
    try {
      await talentRequestsStore.loadUserRequests(authStore.user.attributes.email);
      
      // Scroll to top after loading data
      scrollToTop();
    } catch (error) {
      console.error('Error loading talent requests:', error);
    }
  }
};

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

// Edit talent request
const editTalentRequest = async (request) => {
  // First, get fresh data from the database to ensure we have the latest version
  try {
    console.log('Getting fresh data for request:', request.id)
    const freshData = await talentRequestsStore.getRequestById(request.id)
    
    // Use fresh data if available, otherwise fall back to store data
    const requestData = freshData || request
    
    console.log('Using request data:', requestData)
    
    // Populate the edit form with the request data
    editForm.value = {
      projectTitle: requestData.projectTitle || '',
      channel: requestData.channel || '',
      status: requestData.status || 'accepting_pilots',
      startDate: requestData.startDate ? new Date(requestData.startDate).toISOString().split('T')[0] : '',
      streamLength: requestData.streamLength || '',
      location: requestData.location || '',
      showConcept: requestData.showConcept || '',
      castingNeeds: requestData.castingNeeds || '',
      timeSlots: [...(requestData.timeSlots || [])],
      tags: [...(requestData.tags || [])],
      revenueShare: requestData.revenueShare || '',
      channelPosterUrl: requestData.channelPosterUrl || '',
      inspirationImage: requestData.inspirationImage || '',
      pilotUrl: requestData.pilotUrl || ''
    }
    
    // Store the request ID for saving
    editForm.value.requestId = requestData.id
    
    // Show the edit modal
    showEditModal.value = true
    scrollToTop()
  } catch (error) {
    console.error('Error getting fresh request data:', error)
    // Fall back to using store data
    editForm.value = {
      projectTitle: request.projectTitle || '',
      channel: request.channel || '',
      status: request.status || 'accepting_pilots',
      startDate: request.startDate ? new Date(request.startDate).toISOString().split('T')[0] : '',
      streamLength: request.streamLength || '',
      location: request.location || '',
      showConcept: request.showConcept || '',
      castingNeeds: request.castingNeeds || '',
      timeSlots: [...(request.timeSlots || [])],
      tags: [...(request.tags || [])],
      revenueShare: request.revenueShare || '',
      channelPosterUrl: request.channelPosterUrl || '',
      inspirationImage: request.inspirationImage || '',
      pilotUrl: request.pilotUrl || ''
    }
    
    editForm.value.requestId = request.id
    showEditModal.value = true
    scrollToTop()
  }
}

// Save talent request changes
const saveTalentRequest = async () => {
  if (!editForm.value.requestId) {
    console.error('No request ID found')
    return
  }
  
  isSaving.value = true
  
  try {
    console.log('Saving talent request with data:', editForm.value)
    
    const result = await talentRequestsStore.updateRequest(editForm.value.requestId, editForm.value)
    
    console.log('Update result:', result)
    
    if (result.success) {
      console.log('Talent request updated successfully')
      showEditModal.value = false
      
      // Get fresh data for the specific request to ensure UI is updated
      const freshData = await talentRequestsStore.getRequestById(editForm.value.requestId)
      console.log('Fresh data after save:', freshData)
      console.log('Fresh data project title:', freshData?.projectTitle)
      console.log('Edit form project title:', editForm.value.projectTitle)
      
      // Also refresh all requests to ensure consistency
      await talentRequestsStore.loadUserRequests(authStore.user.attributes.email)
      
      // Check what's in the store after refresh
      const storeData = talentRequestsStore.getRequestByIdSync(editForm.value.requestId)
      console.log('Store data after refresh:', storeData)
      console.log('Store data project title:', storeData?.projectTitle)
      
      // Force a reactive update by triggering a re-render
      await nextTick()
      
      scrollToTop()
    } else {
      console.error('Failed to update talent request:', result.message)
      alert('Error: ' + (result.message || 'Failed to update request'))
    }
  } catch (error) {
    console.error('Error updating talent request:', error)
    alert('Error: ' + (error.message || 'Failed to update request'))
  } finally {
    isSaving.value = false
  }
}

// Close edit modal
const closeEditModal = () => {
  showEditModal.value = false
  editForm.value = {
    projectTitle: '',
    channel: '',
    status: 'accepting_pilots',
    startDate: '',
    streamLength: '',
    location: '',
    showConcept: '',
    castingNeeds: '',
    timeSlots: [],
    tags: [],
    revenueShare: '',
    channelPosterUrl: '',
    inspirationImage: '',
    pilotUrl: ''
  }
  scrollToTop()
}

// Add time slot
const addTimeSlot = () => {
  editForm.value.timeSlots.push('')
}

// Remove time slot
const removeTimeSlot = (index) => {
  editForm.value.timeSlots.splice(index, 1)
}

// Add tag
const addTag = () => {
  editForm.value.tags.push('')
}

// Remove tag
const removeTag = (index) => {
  editForm.value.tags.splice(index, 1)
}

// Handle poster image upload
const handlePosterUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  try {
    // Show loading state
    const uploadButton = event.target.parentElement.querySelector('button')
    const originalText = uploadButton.innerHTML
    uploadButton.innerHTML = '<Icon name="heroicons:arrow-path" class="w-5 h-5 inline mr-2 animate-spin" />Uploading...'
    uploadButton.disabled = true
    
    // Create FormData for upload
    const formData = new FormData()
    formData.append('file', file)
    formData.append('userId', authStore.user.attributes.email)
    formData.append('channel', editForm.value.channel)
    formData.append('type', 'series-poster')
    
    // Upload to S3
    const response = await $fetch('/api/uppy-s3-multipart/upload', {
      method: 'POST',
      body: formData
    })
    
    if (response.success && response.url) {
      // Convert to public URL format
      let posterUrl = response.url.replace('/series-posters/', '/public/series-posters/')
      posterUrl = posterUrl.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net')
      
      // Update the form
      editForm.value.channelPosterUrl = posterUrl
      console.log('Poster uploaded successfully:', posterUrl)
    } else {
      throw new Error('Upload failed')
    }
  } catch (error) {
    console.error('Error uploading poster:', error)
    alert('Error uploading poster: ' + (error.message || 'Upload failed'))
  } finally {
    // Reset button
    const uploadButton = event.target.parentElement.querySelector('button')
    uploadButton.innerHTML = '<Icon name="heroicons:cloud-arrow-up" class="w-5 h-5 inline mr-2" />Upload New Poster Image'
    uploadButton.disabled = false
    // Reset file input
    event.target.value = ''
  }
}

// View talent request details
const viewTalentRequest = (request) => {
  // Scroll to top before navigation
  scrollToTop();
  
  // If we only have an ID, find the full request from the store
  let fullRequest = request
  if (request.id && !request.channel) {
    fullRequest = talentRequestsStore.requests.find(r => r.id === request.id)
  }
  
  if (fullRequest && fullRequest.channel) {
    // Navigate to individual request view with share functionality for owners
    const username = fullRequest.creatorUsername || authStore.user?.attributes?.username || 'unknown'
    const channel = fullRequest.channel
    const url = `/talent-request/${username}/${channel}?rid=${fullRequest.id}&title=${encodeURIComponent(fullRequest.projectTitle)}&description=${encodeURIComponent(fullRequest.showConcept)}`
    
    // Use window.location.href as fallback if navigateTo doesn't work
    if (typeof navigateTo === 'function') {
      navigateTo(url)
    } else {
      window.location.href = url
    }
  } else {
    console.error('Could not find full request details for:', request)
    // Fallback: navigate to talent requests index
    if (typeof navigateTo === 'function') {
      navigateTo('/talent-requests')
    } else {
      window.location.href = '/talent-requests'
    }
  }
}

// View application details
const viewApplication = (application) => {
  // Scroll to top before opening modal
  scrollToTop();
  
  selectedApplication.value = application
  showApplicationModal.value = true
}

// Delete talent request
const deleteTalentRequest = async (requestId) => {
  console.log('Frontend: deleteTalentRequest called with requestId:', requestId)
  console.log('Frontend: requestId type:', typeof requestId)
  console.log('Frontend: requestId value:', requestId)
  
  // Handle null/undefined requestId
  if (!requestId) {
    console.error('Frontend: requestId is null or undefined, cannot delete')
    alert('Error: Cannot delete talent request - missing request ID')
    return
  }
  
  if (confirm('Are you sure you want to permanently delete this talent request? This action cannot be undone.')) {
    try {
      console.log('Frontend: Calling store deleteRequest with requestId:', requestId)
      const result = await talentRequestsStore.deleteRequest(requestId)
      console.log('Frontend: Store deleteRequest result:', result)
      
      if (result.success) {
        console.log('Talent request deleted successfully')
        // Scroll to top after action
        scrollToTop();
      } else {
        console.error('Failed to delete talent request:', result.message)
      }
    } catch (error) {
      console.error('Error deleting talent request:', error)
    }
  }
}

// Delete talent application
const deleteTalentApplication = async (requestId, applicationId) => {
  console.log('Frontend: deleteTalentApplication called with requestId:', requestId, 'applicationId:', applicationId)
  
  // Handle null/undefined parameters
  if (!requestId || !applicationId) {
    console.error('Frontend: requestId or applicationId is null or undefined, cannot delete')
    alert('Error: Cannot delete application - missing request ID or application ID')
    return
  }
  
  if (confirm('Are you sure you want to permanently delete this application? This action cannot be undone.')) {
    try {
      console.log('Frontend: Calling store deleteApplication with requestId:', requestId, 'applicationId:', applicationId)
      const result = await talentRequestsStore.deleteApplication(requestId, applicationId)
      console.log('Frontend: Store deleteApplication result:', result)
      
      if (result.success) {
        console.log('Application deleted successfully')
        // Scroll to top after action
        scrollToTop();
      } else {
        console.error('Failed to delete application:', result.message)
      }
    } catch (error) {
      console.error('Error deleting application:', error)
    }
  }
}

// Flatten applications across requests for Applications tab
const allApplications = computed(() => {
  const list = []
  for (const req of talentRequestsStore.requests || []) {
    if (Array.isArray(req.applications)) {
      for (const app of req.applications) {
        list.push({
          key: `${req.id}:${app.applicationId}`,
          requestId: req.id,
          projectTitle: req.projectTitle,
          createdAt: app.createdAt || req.createdAt,
          ...app
        })
      }
    }
  }
  // newest first
  return list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
})

const totalApplications = computed(() => allApplications.value.length)
const appTotalPages = computed(() => Math.max(1, Math.ceil(totalApplications.value / pageSize)))
const pagedApplications = computed(() => allApplications.value.slice(appPage.value * pageSize, appPage.value * pageSize + pageSize))
const nextAppPage = () => { 
  if (appPage.value < appTotalPages.value - 1) {
    appPage.value++;
    scrollToTop();
  }
};
const prevAppPage = () => { 
  if (appPage.value > 0) {
    appPage.value--;
    scrollToTop();
  }
};

// Approve collaborator request
const approveRequest = async (requestId) => {
  try {
    await collaboratorRequestsStore.approveRequest(requestId);
    // Close modal if open
    showRequestModal.value = false;
    selectedRequest.value = null;
    // Scroll to top after action
    scrollToTop();
  } catch (error) {
    console.error('Error approving request:', error);
  }
};

// Reject collaborator request
const rejectRequest = async (requestId) => {
  try {
    await collaboratorRequestsStore.rejectRequest(requestId);
    // Close modal if open
    showRequestModal.value = false;
    selectedRequest.value = null;
    // Scroll to top after action
    scrollToTop();
  } catch (error) {
    console.error('Error rejecting request:', error);
  }
};

// Approve talent application
const approveApplication = async (requestId, applicationId) => {
  try {
    await talentRequestsStore.approveApplication(requestId, applicationId);
    // Refresh the data
    await talentRequestsStore.loadUserRequests(authStore.user.attributes.email);
    // Close modal if open
    if (showApplicationModal.value) {
      showApplicationModal.value = false;
      selectedApplication.value = null;
    }
    // Scroll to top after action
    scrollToTop();
  } catch (error) {
    console.error('Error approving application:', error);
  }
};

// Reject talent application
const rejectApplication = async (requestId, applicationId) => {
  try {
    await talentRequestsStore.rejectApplication(requestId, applicationId);
    // Refresh the data
    await talentRequestsStore.loadUserRequests(authStore.user.attributes.email);
    // Close modal if open
    if (showApplicationModal.value) {
      showApplicationModal.value = false;
      selectedApplication.value = null;
    }
    // Scroll to top after action
    scrollToTop();
  } catch (error) {
    console.error('Error rejecting application:', error);
  }
};

// Mark as notified
const markAsNotified = async (requestId) => {
  try {
    await collaboratorRequestsStore.markAsNotified(requestId);
    // Show success feedback
    console.log('Successfully marked request as notified');
    // Scroll to top after action
    scrollToTop();
  } catch (error) {
    console.error('Error marking as notified:', error);
  }
};

// Delete request
const deleteRequest = async (requestId) => {
  if (confirm('Are you sure you want to permanently delete this request? This action cannot be undone.')) {
    try {
      await collaboratorRequestsStore.deleteRequest(requestId);
      console.log('Request deleted successfully');
      // Scroll to top after action
      scrollToTop();
    } catch (error) {
      console.error('Error deleting request:', error);
    }
  }
};

// View request details
const viewRequest = (request) => {
  // Scroll to top before opening modal
  scrollToTop();
  
  selectedRequest.value = request;
  showRequestModal.value = true;
};

const signOut = async () => {
  try {
    await Auth.signOut();
    authStore.authenticated = false;
    authStore.user = null;
    console.log('Logout successful - forcing page reload');
    // Force a full page reload to ensure proper rendering on mobile
    if (process.client) {
      window.location.href = '/';
    }
  } catch (error) {
    // Ignore sign out errors
  }
};

const deleteAccount = async () => {
  if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
    try {
      // TODO: Implement account deletion logic
    } catch (error) {
      // Ignore account deletion errors
    }
  }
};

// Set up page visibility listener
let handleVisibilityChange = null;

// Utility function for scrolling to top
const scrollToTop = () => {
  if (process.client) {
    // Multiple methods to ensure scrolling works on all browsers
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Force scroll on all scrollable elements
    const scrollableElements = document.querySelectorAll('*');
    scrollableElements.forEach(element => {
      if (element.scrollTop > 0) {
        element.scrollTop = 0;
      }
    });
    
    // Use requestAnimationFrame for smooth execution
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }
};

// Initialize auth state on mount
onMounted(async () => {
  // Set client-side flag
  isClient.value = true;
  
  // Scroll to top immediately when page loads
  scrollToTop();
  
  // Check for pending affiliate invite
  if (process.client) {
    const route = useRoute();
    if (route.query.affiliateInvite === 'true') {
      const pendingAffiliateInvite = sessionStorage.getItem('pendingAffiliateInvite');
      if (pendingAffiliateInvite) {
        try {
          const inviteData = JSON.parse(pendingAffiliateInvite);
          console.log('Processing affiliate invite on profile page:', inviteData);
          
          // Auto-activate affiliate persona with the invite code
          if (inviteData.inviteCode) {
            try {
              const result = await authStore.activateAffiliatePersona(inviteData.inviteCode);
              if (result.success) {
                alert('Welcome! Your affiliate account has been activated. You can now invite collaborators to your available channels.');
                // Clear the pending invite
                sessionStorage.removeItem('pendingAffiliateInvite');
                // Refresh the page to show updated persona
                window.location.reload();
              } else {
                alert('Error activating affiliate account: ' + result.message);
              }
            } catch (error) {
              console.error('Error activating affiliate persona:', error);
              alert('Error activating affiliate account. Please try again.');
            }
          }
        } catch (error) {
          console.error('Error parsing pending affiliate invite:', error);
        }
      }
    }
    
    // Check for pending collaborator invite
    if (route.query.collaboratorInvite === 'true') {
      const pendingCollaboratorInvite = sessionStorage.getItem('pendingCollaboratorInvite');
      if (pendingCollaboratorInvite) {
        try {
          const inviteData = JSON.parse(pendingCollaboratorInvite);
          console.log('Processing collaborator invite on profile page:', inviteData);
          
          // Auto-accept collaborator invite
          if (inviteData.inviteCode) {
            try {
              const response = await $fetch('/api/collaborations/accept-invite', {
                method: 'POST',
                body: {
                  inviteCode: inviteData.inviteCode,
                  channelName: inviteData.channelName,
                  title: inviteData.title,
                  description: inviteData.description,
                  creator: inviteData.creator,
                  poster: inviteData.poster,
                  userId: authStore.user?.attributes?.sub,
                  userEmail: authStore.user?.attributes?.email
                }
              });
              
              if (response.success) {
                // Update auth store
                authStore.personas.creator = true;
                authStore.activePersona = 'creator';
                authStore.personaData.creator = {
                  channelName: inviteData.channelName,
                  streamKey: response.streamKey,
                  status: 'active'
                };
                
                alert('Welcome! You\'ve successfully joined as a collaborator. You can now start streaming on Twilly TV.');
                // Clear the pending invite
                sessionStorage.removeItem('pendingCollaboratorInvite');
                // Refresh the page to show updated persona
                window.location.reload();
              } else {
                alert('Error accepting collaborator invite: ' + response.message);
              }
            } catch (error) {
              console.error('Error accepting collaborator invite:', error);
              alert('Error accepting collaborator invite. Please try again.');
            }
          }
        } catch (error) {
          console.error('Error parsing pending collaborator invite:', error);
        }
      }
    }
  }
  
  // Load collaborator requests from localStorage first
  collaboratorRequestsStore.loadFromLocalStorage();
  
  try {
    // First check if we already have auth state
    if (authStore.authenticated && authStore.user) {
      // Set userType to 'creator' since we're on the profile/studio page
      authStore.userType = 'creator';
      // Load persona data
      await authStore.loadPersonaData();
    } else {
      // If no auth state, try to get from AWS
      const user = await Auth.currentAuthenticatedUser();
      if (user) {
        // Check if user has email in attributes or username
        const isCreator = user?.attributes?.email || user?.username?.includes('@');
        if (isCreator) {
          authStore.authenticated = true;
          authStore.user = user;
          authStore.userType = 'creator';
        } else {
          authStore.authenticated = true;
          authStore.user = user;
          authStore.userType = 'regular';
        }
      } else {
        // If no AWS user, try to initialize from localStorage
        await authStore.initializeAuth();
      }
    }
    
    // Always mark role detection as complete after a short delay
    setTimeout(() => {
      isRoleDetectionComplete.value = true;
      console.log('Profile: Role detection completed (timeout)');
    }, 1000);

    // Load file store data for creators
    if ((authStore.userType === 'producer' || authStore.userType === 'creator' || authStore.userType === 'regular') && authStore.user?.attributes?.email) {
      const userEmail = authStore.user.attributes.email;
      
      try {
        // Always load files and folders from DynamoDB, regardless of store state
        await fileStore.getFiles(userEmail);
        
        // Wait a moment for the store to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Load stream keys count
        const response = await fetch('/api/stream-keys/count', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: userEmail
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            activeStreamKeys.value = data.count || 0;
          } else {
            activeStreamKeys.value = 0;
          }
        } else {
          activeStreamKeys.value = 0;
        }
        
        // Load earnings
        await loadEarnings();
        
        // Load payment status (Lemon Squeezy)
        await loadPaymentStatus();
        
        // Load collaborator requests using store
        await loadCollaboratorRequestsFromStore();
        
        // Load homepage QR applications
        await loadHomepageQRApplications();
        
        // Load talent requests using store
        await loadTalentRequestsFromStore();
      } catch (error) {
        // Set defaults on error
        activeStreamKeys.value = 0;
      }
    }

  // Load purchases for all users
  if (authStore.user?.attributes?.email) {
    try {
      await refreshPurchases();
    } catch (error) {
      // Ignore purchase loading errors
    }
  }
    
    // Set up page visibility listener
    handleVisibilityChange = () => {
      if (!document.hidden && (authStore.userType === 'producer' || authStore.userType === 'creator' || authStore.userType === 'regular')) {
        ensureDataLoaded();
        // Reload collaborator requests if needed
        if (collaboratorRequestsStore.shouldReload()) {
          loadCollaboratorRequestsFromStore();
        }
        
        // Reload talent requests if needed
        if (talentRequestsStore.shouldReload()) {
          loadTalentRequestsFromStore();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Final scroll to top after everything is loaded
    setTimeout(scrollToTop, 100);
    
  } catch (error) {
    // Try to initialize from localStorage
    await authStore.initializeAuth();
  } finally {
    isLoading.value = false;
    // Ensure scroll to top after loading is complete
    setTimeout(scrollToTop, 200);
  }
});

// Cleanup on unmount (moved outside async function)
onUnmounted(() => {
  if (handleVisibilityChange) {
    try {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    } catch (error) {
      // Ignore errors during cleanup
      console.log('Cleanup error (ignored):', error);
    }
  }
});

// Watch for auth state changes
watch(() => authStore.authenticated, (newVal) => {
  if (!newVal && !isLoading.value) {
    // Redirect to sign-in page if user is not authenticated
    console.log('User not authenticated, redirecting to signin...');
    try {
      navigateTo('/signin');
    } catch (error) {
      console.log('NavigateTo failed, using window.location fallback');
      window.location.href = '/signin';
    }
  }
}, { immediate: true });

// Also check authentication on mount
onMounted(async () => {
  // Wait a moment for auth to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (!authStore.authenticated) {
    console.log('User not authenticated on mount, redirecting to signin...');
    try {
      await navigateTo('/signin');
    } catch (error) {
      console.log('NavigateTo failed, using window.location fallback');
      window.location.href = '/signin';
    }
  }
});

// Watch for user authentication and load talent requests when ready
watch([() => authStore.authenticated, () => authStore.user?.attributes?.email], ([isAuthenticated, userEmail]) => {
  if (isAuthenticated && userEmail && (authStore.userType === 'producer' || authStore.userType === 'creator' || authStore.userType === 'regular')) {
    // Load talent requests when user is authenticated and has email
    // Only load if not already loading and if we haven't loaded recently
    if (!talentRequestsStore.isLoading && talentRequestsStore.shouldReload()) {
      loadTalentRequestsFromStore();
    }
  }
}, { immediate: true });

// Watch for file store data changes
watch([() => fileStore.files, () => fileStore.folders], ([newFiles, newFolders]) => {
  // console.log('File store data changed:', {
  //   filesCount: newFiles?.length || 0,
  //   foldersCount: newFolders?.length || 0
  // });
}, { immediate: true });

// Watch for available channels changes to load stream keys
watch(() => authStore.availableChannels, async (newChannels) => {
  if (newChannels && newChannels.length > 0 && authStore.authenticated) {
    // Load stream keys for all channels
    for (const channel of newChannels) {
      await loadStreamKeys(channel.channelName);
    }
    
    // Set initial selected channel to the first sorted channel (Twilly TV)
    if (sortedChannels.value.length > 0) {
      selectedChannel.value = sortedChannels.value[0].channelName;
      await loadChannelContent();
    }
  }
}, { immediate: true });

// Watch for active channel changes to update selected channel
watch(() => authStore.activeChannel, async (newActiveChannel) => {
  if (authStore.authenticated) {
    if (newActiveChannel) {
      selectedChannel.value = newActiveChannel;
    } else if (sortedChannels.value.length > 0) {
      // If no active channel is set, use the first sorted channel (Twilly TV)
      selectedChannel.value = sortedChannels.value[0].channelName;
    }
    await loadChannelContent();
  }
}, { immediate: true });

// Watch for file store changes to refresh channel content
watch(() => fileStore.files, () => {
  if (selectedChannel.value && !isTogglingVisibility.value) {
    channelContent.value = getFilteredChannelContent();
  }
}, { deep: true });

// Watch for collaborator requests store changes
watch(() => collaboratorRequestsStore.requests, (newRequests) => {
  console.log('Collaborator requests updated:', newRequests.length);
  newRequests.forEach(req => {
    console.log(`Request ${req.requestId}: status=${req.status}, notified=${req.notified}`);
  });
}, { immediate: true });

// Manual refresh method
const refreshData = async () => {
  if ((authStore.userType === 'producer' || authStore.userType === 'creator' || authStore.userType === 'regular') && authStore.user?.attributes?.email) {
    try {
      isRefreshing.value = true
      
      // Scroll to top after refresh
      scrollToTop();
      
      await fileStore.getFiles(authStore.user.attributes.email)
      const response = await fetch('/api/stream-keys/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authStore.user.attributes.email })
      })
      if (response.ok) {
        const data = await response.json();
        if (data.success) activeStreamKeys.value = data.count || 0;
      }
    } catch (error) {
      // ignore
    } finally {
      isRefreshing.value = false
    }
  }
}

const refreshTalentRequests = async () => {
  if ((authStore.userType === 'producer' || authStore.userType === 'creator' || authStore.userType === 'regular') && authStore.user?.attributes?.email) {
    try {
      isRefreshingTalent.value = true
      
      // Scroll to top after refresh
      scrollToTop();
      
      await talentRequestsStore.loadUserRequests(authStore.user.attributes.email)
    } catch (e) {
      // ignore
    } finally {
      isRefreshingTalent.value = false
    }
  }
}



// Ensure data is loaded for creators
const ensureDataLoaded = async () => {
  if ((authStore.userType === 'producer' || authStore.userType === 'creator' || authStore.userType === 'regular') && authStore.user?.attributes?.email) {
    const userEmail = authStore.user.attributes.email;
    // console.log('Ensuring data is loaded for:', userEmail);
    
    try {
      // Load files and folders
      await fileStore.getFiles(userEmail);
      
      // Load stream keys count
      const response = await fetch('/api/stream-keys/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userEmail })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          activeStreamKeys.value = data.count || 0;
        // console.log('Stream keys count updated:', activeStreamKeys.value);
      } else {
          // console.error('Failed to load stream keys count:', data);
        }
      } else {
        // console.error('Failed to load stream keys count:', response.status);
        activeStreamKeys.value = 0;
      }
      
      // Scroll to top after ensuring data is loaded
      scrollToTop();
    } catch (error) {
      // console.error('Error ensuring data is loaded:', error);
      activeStreamKeys.value = 0;
    }
  }
};

// View all requests
const viewAllRequests = () => {
  // Scroll to top before navigation
  scrollToTop();
  
  // Navigate to the talent requests index page showing all requests across all channels
  if (typeof navigateTo === 'function') {
    navigateTo('/talent-requests')
  } else {
    window.location.href = '/talent-requests'
  }
}

// Tab switching for talent requests
const switchTalentTab = (tab) => {
  activeTalentTab.value = tab;
  scrollToTop();
};

// Close modals with scroll to top
const closeRequestModal = () => {
  showRequestModal.value = false;
  selectedRequest.value = null;
  scrollToTop();
};

const closeApplicationModal = () => {
  showApplicationModal.value = false;
  selectedApplication.value = null;
  scrollToTop();
};

const generateTalentRequestShareLink = async (request) => {
  if (!authStore.user?.attributes?.email) {
    console.error('No user email available')
    return
  }

  // Check if user has a username set
  const hasUsername = authStore.user?.attributes?.username
  if (!hasUsername) {
    alert('Please set a username in your account settings to generate share links.')
    return
  }

  try {
    // Build the long talent request URL with meta info (same pattern as collaborator invite)
    const longUrl = `https://twilly.app/talent-request/${hasUsername}/${request?.channel || 'default'}`;
    
    // Add meta info as query parameters (same pattern as collaborator invite)
    const meta = {
      title: request?.channel || 'default',
      description: `Submit your interest in collaborating on ${request?.channel || 'default'}. Share your stream concept and availability.`,
      // Add request ID if available
      ...(request?.id && { rid: request.id })
    };
    
    // Append meta info as query params (same pattern as collaborator invite)
    let urlWithMeta = `${longUrl}?title=${encodeURIComponent(meta.title)}&description=${encodeURIComponent(meta.description)}`;
    if (meta.rid) {
      urlWithMeta += `&rid=${meta.rid}`;
    }
    
    console.log('Generated direct talent request URL with specific request:', urlWithMeta);
    
    // Set the direct URL (perfect for WhatsApp)
    shareableLink.value = urlWithMeta;
    console.log('Creating direct talent request share URL (no redirects):', shareableLink.value);
    
    // Generate share.twilly.app redirect link for faster loading
    try {
      // Use the same shortening logic as collaborator invite (taskStore.shortenUrl)
      const shortUrlResponse = await taskStore.shortenUrl({ url: urlWithMeta });
      
      if (shortUrlResponse && shortUrlResponse.returnResult) {
        shareAppLink.value = shortUrlResponse.returnResult;
        console.log('Generated share.twilly.app redirect link:', shareAppLink.value);
      } else {
        // Fallback to long URL if shortening fails (same pattern as collaborator invite)
        shareAppLink.value = urlWithMeta;
        console.log('Shortening failed, using long URL as fallback:', shareAppLink.value);
      }
    } catch (shortUrlError) {
      console.error('Error generating share.twilly.app redirect link:', shortUrlError);
      // Fallback to long URL if shortening fails (same pattern as collaborator invite)
      shareAppLink.value = urlWithMeta;
      console.log('Shortening failed, using long URL as fallback:', shareAppLink.value);
    }
    
    showShareModal.value = true
  } catch (error) {
    console.error('Error generating share link:', error)
    alert('Error: ' + (error.message || 'Failed to generate share link'))
  }
}

// Add the share modal state and functions
const showShareModal = ref(false)
const shareableLink = ref('')
const shareAppLink = ref('')
const linkCopied = ref(false)
const shareAppLinkCopied = ref(false)

const copyShareLinkToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(shareableLink.value)
    linkCopied.value = true
    setTimeout(() => {
      linkCopied.value = false
    }, 2000)
  } catch (error) {
    console.error('Error copying link:', error)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = shareableLink.value
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    linkCopied.value = true
    setTimeout(() => {
      linkCopied.value = false
    }, 2000)
  }
}

const copyShareAppLinkToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(shareAppLink.value)
    shareAppLinkCopied.value = true
    setTimeout(() => {
      shareAppLinkCopied.value = false
    }, 2000)
  } catch (error) {
    console.error('Error copying share.twilly.app link:', error)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = shareAppLink.value
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    shareAppLinkCopied.value = true
    setTimeout(() => {
      shareAppLinkCopied.value = false
    }, 2000)
  }
}

const generateNewLink = () => {
  shareableLink.value = ''
  shareAppLink.value = ''
  // Close modal to allow user to select a different request
  showShareModal.value = false
}

const clearShareLink = () => {
  shareableLink.value = ''
  shareAppLink.value = ''
  showShareModal.value = false
}

// Utility function for slugifying
const slugify = (text) => {
  if (!text) return ''
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

// Load homepage QR applications
const loadHomepageQRApplications = async () => {
  try {
    isLoadingHomepageQR.value = true;
    const response = await $fetch('/api/homepage-qr-applications');
    if (response.success) {
      homepageQRApplications.value = response.applications || [];
    }
  } catch (error) {
    console.error('Error loading homepage QR applications:', error);
    homepageQRApplications.value = [];
  } finally {
    isLoadingHomepageQR.value = false;
  }
};

const homepageQRApplications = ref([]);
const isLoadingHomepageQR = ref(true);

// Approve homepage QR application
const approveHomepageQRApplication = async (applicationId) => {
  try {
    const response = await $fetch(`/api/homepage-qr-applications/${applicationId}/approve`, {
      method: 'POST'
    });
    if (response.success) {
      // Refresh the data
      await loadHomepageQRApplications();
      // Show success feedback
      console.log('Homepage QR application approved successfully');
    } else {
      console.error('Error approving homepage QR application:', response.message);
    }
  } catch (error) {
    console.error('Error approving homepage QR application:', error);
  }
};

// Reject homepage QR application
const rejectHomepageQRApplication = async (applicationId) => {
  try {
    const response = await $fetch(`/api/homepage-qr-applications/${applicationId}/reject`, {
      method: 'POST'
    });
    if (response.success) {
      // Refresh the data
      await loadHomepageQRApplications();
      // Show success feedback
      console.log('Homepage QR application rejected successfully');
    } else {
      console.error('Error rejecting homepage QR application:', response.message);
    }
  } catch (error) {
    console.error('Error rejecting homepage QR application:', error);
  }
};

// View homepage QR application details
const viewHomepageQRApplication = (application) => {
  // Scroll to top before opening modal
  scrollToTop();
  
  selectedHomepageQRApplication.value = application;
  showHomepageQRApplicationModal.value = true;
};

// Delete homepage QR application
const deleteHomepageQRApplication = async (applicationId) => {
  console.log('Frontend: deleteHomepageQRApplication called with applicationId:', applicationId)
  
  // Handle null/undefined parameters
  if (!applicationId) {
    console.error('Frontend: applicationId is null or undefined, cannot delete')
    alert('Error: Cannot delete homepage QR application - missing application ID')
    return
  }
  
  if (confirm('Are you sure you want to permanently delete this application? This action cannot be undone.')) {
    try {
      console.log('Frontend: Calling store deleteHomepageQRApplication with applicationId:', applicationId)
      const result = await $fetch(`/api/homepage-qr-applications/${applicationId}`, {
        method: 'DELETE'
      })
      console.log('Frontend: Store deleteHomepageQRApplication result:', result)
      
      if (result.success) {
        console.log('Homepage QR application deleted successfully')
        // Scroll to top after action
        scrollToTop();
      } else {
        console.error('Failed to delete homepage QR application:', result.message)
      }
    } catch (error) {
      console.error('Error deleting homepage QR application:', error)
    }
  }
}

const selectedHomepageQRApplication = ref(null);
const showHomepageQRApplicationModal = ref(false);

// Collaborator invite success/error messages
const showCollaboratorInviteSuccess = ref(false);
const showCollaboratorInviteError = ref(false);
const collaboratorInviteMessage = ref('');
const generatingInviteFor = ref(null); // Track which channel is being generated
const collaboratorInviteLink = ref('');
const inviteLinkCopied = ref(false);

// Stream key management variables
const streamKeys = ref({}); // Object to store stream keys by channel
const RTMP_SERVER_URL = 'rtmp://100.24.103.57:1935/live';

// Channel management variables
const selectedChannel = ref(null);
const channelContent = ref([]);
const isLoadingContent = ref(false);

// Stream key visibility toggle
const expandedStreamKeys = ref({});

// Computed property to sort channels with Twilly TV first
const sortedChannels = computed(() => {
  if (!authStore.availableChannels) return [];
  
  return [...authStore.availableChannels].sort((a, b) => {
    // Twilly TV should always come first
    if (a.channelName === 'Twilly TV') return -1;
    if (b.channelName === 'Twilly TV') return 1;
    
    // For other channels, sort alphabetically
    return a.channelName.localeCompare(b.channelName);
  });
});

// Function to detect user roles by checking DynamoDB
const detectUserRoles = async () => {
  if (!authStore.user?.attributes?.sub) {
    return;
  }
  
  try {
    const userId = authStore.user.attributes.sub;
    const userEmail = authStore.user.attributes.email;
    
    
    // Set a timeout to ensure role detection completes even if API calls fail
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.log('⏰ Profile: Role detection timeout reached, completing with default values');
        resolve();
      }, 5000); // 5 second timeout
    });
    
    // Run all API calls with timeout
    await Promise.race([
      Promise.all([
        // Check for collaborator roles
        fetch('/api/collaborations/get-user-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        }).then(async (response) => {
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.roles?.length > 0) {
        userRoles.value.isCollaborator = true;
              userRoles.value.collaboratorChannels = data.roles;
              console.log('✅ Profile: Found collaborator roles:', data.roles);
      }
          } else {
            console.log('⚠️ Profile: Collaborator roles API returned error:', response.status);
    }
        }).catch(error => {
          console.log('Profile: No collaborator roles found or error:', error.message);
        }),
    
    // Check for casting director roles
        fetch('/api/casting-directors/get-user-roles', {
        method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        }).then(async (response) => {
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.roles?.length > 0) {
        userRoles.value.isCastingDirector = true;
              userRoles.value.castingDirectorChannels = data.roles;
              console.log('✅ Profile: Found casting director roles:', data.roles);
      }
          } else {
            console.log('⚠️ Profile: Casting director roles API returned error:', response.status);
    }
        }).catch(error => {
          console.log('Profile: No casting director roles found or error:', error.message);
        }),
    
    // Check for subscriptions (viewer role)
        fetch('/api/stripe/get-user-subscriptions', {
        method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
          subscriberId: authStore.user.attributes.email
          })
        }).then(async (response) => {
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.subscriptions?.length > 0) {
        userRoles.value.hasSubscriptions = true;
              userRoles.value.subscriptions = data.subscriptions;
              console.log('✅ Profile: Found subscriptions:', data.subscriptions.length);
            }
          } else {
            console.log('⚠️ Profile: Subscriptions API returned error:', response.status);
          }
        }).catch(error => {
          console.log('Profile: No subscriptions found or error:', error.message);
        })
      ]),
      timeoutPromise
    ]);
    
    console.log('🎯 Profile: Final user roles detected:', userRoles.value);
    
    // Load earnings data if user has special roles
    if (userRoles.value.isCollaborator || userRoles.value.isCastingDirector) {
      await loadEarningsData();
      // Check for new payouts and show notifications
      await checkForNewPayouts();
    }
    
  } catch (error) {
    console.error('Profile: Error detecting user roles:', error);
  } finally {
    // Always ensure role detection completes
    console.log('✅ Profile: Role detection completed');
  }
};

// Function to load earnings data
const loadEarningsData = async () => {
  if (!authStore.user?.attributes?.sub) return;
  
  try {
    isLoadingEarnings.value = true;
    
    const response = await fetch('/api/earnings/get-user-earnings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: authStore.user.attributes.sub,
        userEmail: authStore.user.attributes.email
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        totalEarnings.value = data.totalEarnings || 0;
        monthlyEarnings.value = data.monthlyEarnings || 0;
        pendingEarnings.value = data.pendingEarnings || 0;
        recentPayouts.value = data.recentPayouts || [];
      }
    } else {
      console.log('⚠️ Profile: Earnings API returned error:', response.status);
    }
    
  } catch (error) {
    console.error('Error loading earnings data:', error);
  } finally {
    isLoadingEarnings.value = false;
  }
};

// Function to format dates
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

// Function to check for new payouts and show notifications
const checkForNewPayouts = async () => {
  if (!authStore.user?.attributes?.sub) return;
  
  try {
    const lastChecked = localStorage.getItem('twilly_last_payout_check') || null;
    
    const response = await fetch('/api/notifications/check-payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: authStore.user.attributes.sub,
        userEmail: authStore.user.attributes.email,
        lastChecked
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.notifications.length > 0) {
      // Show notifications for new payouts
        data.notifications.forEach(notification => {
        if (window.$notify) {
          if (notification.type === 'success') {
            window.$notify.payout(notification.amount, notification.message.split(' from ')[1]);
          } else {
            window.$notify.payoutPending(notification.amount, notification.message.split(' from ')[1]);
          }
        }
      });
      
      // Update last checked time
        localStorage.setItem('twilly_last_payout_check', data.lastChecked);
      
      // Reload earnings data to show updated amounts
      await loadEarningsData();
      }
    }
    
  } catch (error) {
    console.error('Error checking for new payouts:', error);
  }
};

// Function to generate casting director referral link for dashboard
const generateCastingDirectorReferralLink = async (channelId) => {
  try {
    const response = await fetch('/api/casting-directors/get-referral-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: authStore.user.attributes.sub,
        channelId: channelId
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.referralLink) {
      // Copy to clipboard
      try {
          await navigator.clipboard.writeText(data.referralLink);
        alert('Referral link copied to clipboard!');
      } catch (e) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
          textArea.value = data.referralLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Referral link copied to clipboard!');
        }
      }
    } else {
      alert('Error: Failed to generate referral link');
    }
  } catch (error) {
    console.error('Error generating referral link:', error);
    alert('Error generating referral link. Please try again.');
  }
};

// Function to generate collaborator invite for affiliates
const generateCollaboratorInvite = async (channelName) => {
  // Allow switching to different channels, but prevent multiple clicks on same channel
  if (generatingInviteFor.value === channelName) return; // Prevent multiple clicks on same channel
  
  // Clear any previous invite link and set the current channel
  collaboratorInviteLink.value = '';
  generatingInviteFor.value = channelName;
  try {
    // Get the user's username (same logic as managefiles.vue)
    let username = await fetchUsernameFromDynamo();
    
    // If DynamoDB fails, try auth store
    if (!username && authStore.user?.attributes?.username) {
      username = authStore.user.attributes.username;
    }
    
    // If still no username, try localStorage
    if (!username && process.client) {
      const currentUserId = authStore.user?.attributes?.sub;
      if (currentUserId) {
        const storedUsername = localStorage.getItem(`username_${currentUserId}`);
        if (storedUsername) {
          username = storedUsername;
        }
      }
    }
    
    // Final fallback
    if (!username) {
      username = authStore.user?.attributes?.preferred_username || 
                authStore.user?.attributes?.email?.split('@')[0] || 
                'affiliate';
    }
    
    // Generate a unique invite code (using same format as managefiles.vue)
    const inviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Store collaborator invite information in DynamoDB (same structure as managefiles.vue)
    const collaboratorInviteRecord = {
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

    // Store the collaborator invite record
    try {
      await $fetch('/api/collaborations/store-invite', {
        method: 'POST',
        body: collaboratorInviteRecord
      });
    } catch (error) {
      console.error('Failed to store collaborator invite:', error);
    }

    // Get poster URL for the channel (same logic as managefiles.vue)
    let posterUrl = null;
    try {
      // Try to get poster from channel data if available
      const channelData = fileStore.folders?.find(f => f.name === channelName);
      if (channelData?.seriesPosterUrl) {
        posterUrl = channelData.seriesPosterUrl.replace('/series-posters/', '/public/series-posters/').replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
      }
    } catch (error) {
      console.log('Could not fetch poster URL:', error);
    }

    // Build the collaborator invite URL with meta info (same structure as affiliate invites)
    // Use the production domain for collaborator invites to ensure they work correctly
    const longUrl = `https://twilly.app/collaborator/${inviteCode}/${encodeURIComponent(channelName)}`;
    const meta = {
      title: channelName,
      description: `Join as a collaborator and stream on ${channelName} with Twilly!`,
      poster: posterUrl
    };
    
    // Append meta info as query params (same format as affiliate invites)
    // Include poster if available and not default icon
    const shouldIncludePoster = posterUrl && !posterUrl.includes('icon-512.png') && posterUrl !== '/assets/channels/icon-512.png';
    const urlWithMeta = `${longUrl}?title=${encodeURIComponent(meta.title)}&description=${encodeURIComponent(meta.description)}&creator=${encodeURIComponent(username)}${shouldIncludePoster ? `&poster=${posterUrl}` : ''}`;
    
    // Use the same shortening logic as affiliate invites
    const shortUrlResponse = await taskStore.shortenUrl({ 
      url: urlWithMeta,
      creator: username,
      series: channelName,
      userEmail: authStore.user?.attributes?.email
    });
    
    if (shortUrlResponse && shortUrlResponse.returnResult) {
      // Store the link and show it (same as managefiles.vue)
      collaboratorInviteLink.value = shortUrlResponse.returnResult;
      showCollaboratorInviteSuccess.value = true;
      collaboratorInviteMessage.value = `Collaborator invite link for ${channelName} generated! Tap to copy.`;
      setTimeout(() => {
        showCollaboratorInviteSuccess.value = false;
      }, 5000);
    } else {
      // Show error message
      showCollaboratorInviteError.value = true;
      collaboratorInviteMessage.value = 'Error: Failed to generate collaborator invite link';
      setTimeout(() => {
        showCollaboratorInviteError.value = false;
      }, 3000);
    }
  } catch (error) {
    console.error('Error generating collaborator invite:', error);
    // Show error message
    showCollaboratorInviteError.value = true;
    collaboratorInviteMessage.value = 'Error generating collaborator invite. Please try again.';
    setTimeout(() => {
      showCollaboratorInviteError.value = false;
    }, 3000);
  } finally {
    // Don't clear generatingInviteFor here - keep it so the copy box shows
    // It will be cleared when a new invite is generated
  }
};

// Manual copy function for mobile fallback (same as managefiles.vue)
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

// Stream key management functions
const loadStreamKeys = async (channelName) => {
  if (!authStore.user?.attributes?.email) {
    return;
  }

  try {
    const userEmail = authStore.user.attributes.email;
    
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

    if (response.success && response.streamKeys) {
      streamKeys.value[channelName] = response.streamKeys;
    } else {
      streamKeys.value[channelName] = [];
    }
  } catch (error) {
    console.error('Error loading stream keys:', error);
    streamKeys.value[channelName] = [];
  }
};


const getChannelStreamKeys = (channelName) => {
  return streamKeys.value[channelName] || [];
};

const getRTMPUrl = (streamKey) => {
  return `${RTMP_SERVER_URL}/${streamKey}`;
};

const getRTMPServer = () => {
  return RTMP_SERVER_URL;
};

const copyRTMPServer = async () => {
  const serverUrl = getRTMPServer();
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(serverUrl);
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = serverUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
  } catch (error) {
    console.error('Error copying RTMP server URL:', error);
  }
};

const copyStreamKey = async (streamKey) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(streamKey);
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = streamKey;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
  } catch (error) {
    console.error('Error copying stream key:', error);
  }
};

const copyRTMPUrl = async (streamKey) => {
  const rtmpUrl = getRTMPUrl(streamKey);
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(rtmpUrl);
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = rtmpUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
  } catch (error) {
    console.error('Error copying RTMP URL:', error);
  }
};

const deactivateStreamKey = async (streamKey, channelName) => {
  // This would need to be implemented in the backend
  console.log('Deactivate stream key:', streamKey, 'for channel:', channelName);
};

const toggleStreamKeyDetails = (channelName) => {
  expandedStreamKeys.value[channelName] = !expandedStreamKeys.value[channelName];
};

// Channel management functions
const handleChannelChange = async () => {
  if (selectedChannel.value) {
    await loadChannelContent();
  }
};

const loadChannelContent = async () => {
  if (!selectedChannel.value || !authStore.user?.attributes?.email) {
    return;
  }

  isLoadingContent.value = true;
  
  try {
    // Check if user is master account
    const isMaster = authStore.canAccessManagefiles();
    
    if (isMaster) {
      // For master account, always load from master account (single source of truth)
      await fileStore.getFiles('dehyu.sinyan@gmail.com');
      channelContent.value = getFilteredChannelContent();
    } else {
      // For collaborators, fetch filtered files from master account
      const response = await $fetch('/api/files/collaborator-files', {
        method: 'POST',
        body: {
          userEmail: authStore.user.attributes.email,
          channelName: selectedChannel.value
        }
      });

      if (response.success) {
        channelContent.value = response.files || [];
        console.log(`Loaded ${response.files?.length || 0} collaborator files for channel ${selectedChannel.value}`);
      } else {
        console.error('Failed to load collaborator files:', response.message);
        channelContent.value = [];
      }
    }
  } catch (error) {
    console.error('Error loading channel content:', error);
    channelContent.value = [];
  } finally {
    isLoadingContent.value = false;
  }
};

const getFilteredChannelContent = () => {
  if (!fileStore.files || !selectedChannel.value) {
    return [];
  }

  // Get the user's stream keys for this channel
  const userStreamKeys = getChannelStreamKeys(selectedChannel.value);
  const userStreamKeyValues = userStreamKeys.map(key => key.streamKey);

  return fileStore.files.filter(file => {
    // Only show videos
    if (file.category !== 'Videos' || !file.hlsUrl) {
      return false;
    }

    // Filter by channel (folderName or seriesName)
    const channelMatch = file.folderName === selectedChannel.value || 
                        file.seriesName === selectedChannel.value;
    
    if (!channelMatch) {
      return false;
    }

    // For master accounts, show all content for the channel
    if (authStore.canAccessManagefiles()) {
      return true;
    }

    // For collaborators, only show content streamed with their stream keys
    // Check if the file was streamed with one of the user's stream keys
    return userStreamKeyValues.some(streamKey => 
      file.streamKey === streamKey || 
      file.fileName?.includes(streamKey) ||
      file.hlsUrl?.includes(streamKey)
    );
  });
};

const getThumbnailUrl = (file) => {
  // Use the same logic as managefiles.vue
  if (file.thumbnailUrl) {
    return file.thumbnailUrl;
  }
  
  // Try to construct thumbnail URL from stream key
  if (file.streamKey && file.category === 'Videos') {
    const cloudFrontBaseUrl = 'https://d1a370vz8x8p8f.cloudfront.net';
    return `${cloudFrontBaseUrl}/clips/${file.streamKey}/${file.streamKey}_thumb.jpg`;
  }
  
  // Default thumbnail
  return 'https://theprivatecollection.s3.us-east-2.amazonaws.com/0731.gif';
};

const formatDuration = (duration) => {
  if (!duration) return '';
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const handleImageError = (event) => {
  event.target.src = 'https://theprivatecollection.s3.us-east-2.amazonaws.com/0731.gif';
};

const toggleVisibility = async (event, file) => {
  // Prevent any default behavior and event bubbling
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  
  console.log('Toggle visibility clicked for file:', file.fileName);
  console.log('Current isVisible state:', file.isVisible);
  
  // Update the reactive data first (same logic as managefiles.vue)
  const currentVisibility = file.isVisible === true;
  const newVisibility = !currentVisibility;
  file.isVisible = newVisibility;
  
  // Update the channelContent array to trigger reactivity
  const fileIndex = channelContent.value.findIndex(f => f.SK === file.SK);
  if (fileIndex !== -1) {
    channelContent.value[fileIndex].isVisible = newVisibility;
  }
  
  // Update the button state immediately by directly manipulating the DOM
  const button = event.target.closest('button');
  if (newVisibility) {
    button.innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"></path><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"></path></svg> Hide`;
    button.className = 'flex-1 px-3 py-2 text-xs rounded-lg transition-all duration-300 flex items-center justify-center gap-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30';
  } else {
    button.innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"></path></svg> Show`;
    button.className = 'flex-1 px-3 py-2 text-xs rounded-lg transition-all duration-300 flex items-center justify-center gap-1 bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30';
  }
  
  console.log('New isVisible state:', newVisibility);
  console.log('Button state updated successfully');
  
  // Now save to database (like managefiles.vue does)
  try {
    const updateBody = {
      fileId: file.SK,
      PK: file.PK,
      isVisible: newVisibility,
      streamKey: file.streamKey // Include streamKey for duplicate record updates
    };
    
    const response = await $fetch('/api/files/update-details', {
      method: 'PUT',
      body: updateBody
    });

    if (response.success) {
      console.log('✅ Visibility updated in database successfully');
      // Show success notification
      const message = newVisibility ? 'Item made visible successfully!' : 'Item hidden successfully!';
      successMessage.value = message;
      showSuccessNotification.value = true;
      setTimeout(() => {
        showSuccessNotification.value = false;
      }, 3000);
    } else {
      console.error('❌ Failed to update visibility in database:', response.message);
      // Revert the local changes if database update failed
      file.isVisible = !newVisibility;
      if (fileIndex !== -1) {
        channelContent.value[fileIndex].isVisible = !newVisibility;
      }
      // Revert button state
      if (!newVisibility) {
        button.innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"></path><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"></path></svg> Hide`;
        button.className = 'flex-1 px-3 py-2 text-xs rounded-lg transition-all duration-300 flex items-center justify-center gap-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30';
      } else {
        button.innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"></path></svg> Show`;
        button.className = 'flex-1 px-3 py-2 text-xs rounded-lg transition-all duration-300 flex items-center justify-center gap-1 bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30';
      }
    }
  } catch (error) {
    console.error('❌ Error updating visibility in database:', error);
    // Revert the local changes if database update failed
    file.isVisible = !newVisibility;
    if (fileIndex !== -1) {
      channelContent.value[fileIndex].isVisible = !newVisibility;
    }
    // Revert button state
    if (!newVisibility) {
      button.innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"></path><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"></path></svg> Hide`;
      button.className = 'flex-1 px-3 py-2 text-xs rounded-lg transition-all duration-300 flex items-center justify-center gap-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30';
    } else {
      button.innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"></path></svg> Show`;
      button.className = 'flex-1 px-3 py-2 text-xs rounded-lg transition-all duration-300 flex items-center justify-center gap-1 bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30';
    }
  }
};

const deleteFile = async (file) => {
  // Collaborators can delete their own videos
  // No restrictions needed - collaborators should be able to delete their own content

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

    // For collaborators, use master account email (single source of truth)
    const userEmail = authStore.canAccessManagefiles() 
      ? authStore.user.attributes.email 
      : 'dehyu.sinyan@gmail.com';
    
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
      // Update local state immediately (remove from channelContent)
      const fileIndex = channelContent.value.findIndex(f => f.SK === file.SK);
      if (fileIndex !== -1) {
        channelContent.value.splice(fileIndex, 1);
      }
      
      // Update local store (same as managefiles.vue)
      fileStore.removeFile(file.SK);
      
      console.log('✅ File deleted from database successfully');
      // Show success notification
      successMessage.value = 'File deleted successfully!';
      showSuccessNotification.value = true;
      setTimeout(() => {
        showSuccessNotification.value = false;
      }, 3000);
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
    
    // Revert local changes if database delete failed
    const fileIndex = channelContent.value.findIndex(f => f.SK === file.SK);
    if (fileIndex === -1) {
      // File was removed locally but database delete failed, add it back
      channelContent.value.push(file);
    }
    
    successMessage.value = `Error: ${error.message || 'Failed to delete file'}`;
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 5000);
  } finally {
    loadingState.value = false;
  }
};

// Helper functions for video management (same as managefiles.vue)
const getImageUrl = (file) => {
  if (file.thumbnailUrl) {
    return file.thumbnailUrl;
  }
  if (file.url) {
    return file.url;
  }
  return 'https://theprivatecollection.s3.us-east-2.amazonaws.com/0731.gif';
};

const openVideoInNewTab = (file) => {
  if (process.client && window) {
    // Use the same playVideo logic as managefiles.vue
    playVideo(file);
  }
};

// Video player function (simplified version without video.js)
const playVideo = (video) => {
  if (video.status === 'PROCESSING') {
    return;
  }
  if (!video.hlsUrl) {
    return;
  }

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black flex items-center justify-center z-50';
  
  // Create video container
  const videoContainer = document.createElement('div');
  videoContainer.className = 'relative w-full h-full flex items-center justify-center';
  
  // Create close button
  const closeButton = document.createElement('button');
  closeButton.className = 'absolute top-4 right-4 z-10 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors';
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

  // Initialize video.js with mobile-optimized configuration
  const playerOptions = {
    controls: true,
    fluid: true,
    responsive: true,
    playbackRates: [0.5, 1, 1.5, 2],
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
    playerOptions.fluid = false;
    playerOptions.responsive = false;
    playerOptions.width = '100%';
    playerOptions.height = '100%';
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

  // Check if video.js is available
  if (typeof videojs === 'undefined') {
    console.log('Video.js not available, using native video player');
    // Fallback to native video player
    videoElement.controls = true;
    videoElement.src = replaceS3WithCloudFront(video.hlsUrl);
    
    // Handle closing for native player
    const cleanup = () => {
      videoElement.pause();
      videoElement.src = '';
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
    
    return;
  }

  const player = videojs('my-video', playerOptions);

  // Add custom styles for mobile
  const playerEl = player.el();
  if (isMobile) {
    playerEl.style.width = '100%';
    playerEl.style.height = '100%';
    playerEl.style.maxHeight = '100vh';
    playerEl.style.backgroundColor = '#000';
  } else {
    playerEl.style.maxHeight = '80vh';
  }
  
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

// Helper function to get proper file URL (same as managefiles.vue)
const getFileUrl = (file) => {
  switch (file.category) {
    case 'Videos':
      return replaceS3WithCloudFront(file.hlsUrl || file.url);
    case 'Images':
      return replaceS3WithCloudFront(file.url);
    default:
      return replaceS3WithCloudFront(file.url);
  }
};

// CloudFront URLs (same as managefiles.vue)
const twillyCloudFrontUrl = "https://d1bb6cskvno4vp.cloudfront.net";
const collectionsCloudFrontBaseUrl = "https://d26k8mraabzpiy.cloudfront.net";
const cloudFrontBaseUrl = "https://d4idc5cmwxlpy.cloudfront.net";
const inputBucketCloudFrontUrl = "https://d2qxh65v2xrci1.cloudfront.net";

// CloudFront URL replacement function (same as managefiles.vue)
function replaceS3WithCloudFront(url) {
  if (!url) return "";
  
  if (url.includes("twilly.s3.us-east-1.amazonaws.com")) {
    return url.replace("https://twilly.s3.us-east-1.amazonaws.com", twillyCloudFrontUrl);
  } else if (url.includes("twillyinputbucket.s3.us-east-1.amazonaws.com")) {
    return url.replace("https://twillyinputbucket.s3.us-east-1.amazonaws.com", inputBucketCloudFrontUrl);
  } else if (url.includes("tpccollections.s3.amazonaws.com")) {
    return url.replace("https://tpccollections.s3.amazonaws.com", collectionsCloudFrontBaseUrl);
  } else if (url.includes("theprivatecollection.s3.us-east-2.amazonaws.com") || url.includes("theprivatecollection.s3.amazonaws.com")) {
    return url.replace(/https:\/\/theprivatecollection\.s3(\.us-east-2)?\.amazonaws\.com/, cloudFrontBaseUrl);
  }
  
  return url;
};

// Download video functionality (same as managefiles.vue)
const downloadingFileIds = ref({});

const downloadVideoAsMp4 = async (video) => {
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
      fileName: video.fileName || 'video',
      userId: authStore.user.attributes.email
    };

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
            } catch (error) {
              console.error('Mobile download error:', error);
              // Fallback: open in new tab
              window.open(response.downloadUrl, '_blank');
            }
          } else {
            // Open in browser
            window.open(response.downloadUrl, '_blank');
          }
        } else {
          // Desktop download
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = fileName;
          link.style.display = 'none';
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Cleanup
          setTimeout(() => {
            URL.revokeObjectURL(link.href);
          }, 1000);
        }
        
        successMessage.value = 'Video downloaded successfully!';
        showSuccessNotification.value = true;
        setTimeout(() => {
          showSuccessNotification.value = false;
        }, 3000);
        
      } catch (error) {
        console.error('Download error:', error);
        successMessage.value = 'Error downloading video. Opening in browser...';
        showSuccessNotification.value = true;
        setTimeout(() => {
          showSuccessNotification.value = false;
        }, 3000);
        
        // Fallback: open in new tab
        window.open(response.downloadUrl, '_blank');
      }
    } else {
      throw new Error(response.message || 'Failed to process video for download');
    }
  } catch (error) {
    console.error('Download error:', error);
    successMessage.value = `Error: ${error.message || 'Failed to download video'}`;
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 5000);
  } finally {
    downloadingFileIds.value[video.SK] = false;
  }
};

// Edit functionality (same as managefiles.vue)
const showVideoEditModal = ref(false);
const isVideoEditModalLoading = ref(false);
const editingVideoItem = ref({
  id: '',
  SK: '',
  PK: '',
  title: '',
  description: '',
  price: 0,
  isVisible: true
});

const editItem = async (file) => {
  isVideoEditModalLoading.value = true;
  showVideoEditModal.value = true;
  
  // Set the editing item data
  editingVideoItem.value = {
    id: file.SK || file.id,
    SK: file.SK,
    PK: file.PK,
    title: file.title || '',
    description: file.description || '',
    price: file.price || 0,
    isVisible: file.isVisible !== false // Default to true if not explicitly set to false
  };
  
  isVideoEditModalLoading.value = false;
};

const updateItemDetails = async () => {
  if (!editingVideoItem.value.SK || !editingVideoItem.value.PK) {
    successMessage.value = 'Error: Missing file information';
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 5000);
    return;
  }

  isVideoEditModalLoading.value = true;

  try {
    const updateBody = {
      fileId: editingVideoItem.value.SK,
      PK: editingVideoItem.value.PK,
      title: editingVideoItem.value.title,
      description: editingVideoItem.value.description,
      price: parseFloat(editingVideoItem.value.price) || 0,
      isVisible: editingVideoItem.value.isVisible
    };

    const response = await $fetch('/api/files/update-details', {
      method: 'PUT',
      body: updateBody
    });

    if (response.success) {
      // Update local state immediately
      const fileIndex = channelContent.value.findIndex(f => f.SK === editingVideoItem.value.SK);
      if (fileIndex !== -1) {
        channelContent.value[fileIndex] = {
          ...channelContent.value[fileIndex],
          title: editingVideoItem.value.title,
          description: editingVideoItem.value.description,
          price: editingVideoItem.value.price,
          isVisible: editingVideoItem.value.isVisible
        };
      }
      
      showVideoEditModal.value = false;
      
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
    successMessage.value = `Error: ${error.message || 'Failed to update item details. Please try again.'}`;
    showSuccessNotification.value = true;
    setTimeout(() => {
      showSuccessNotification.value = false;
    }, 5000);
  } finally {
    isVideoEditModalLoading.value = false;
  }
};

const closeVideoEditModal = () => {
  showVideoEditModal.value = false;
  editingVideoItem.value = {
    id: '',
    SK: '',
    PK: '',
    title: '',
    description: '',
    price: 0,
    isVisible: true
  };
};
</script>

<style scoped>
.backdrop-blur-sm {
  backdrop-filter: blur(8px);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Page transitions */
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

/* Smooth content loading */
.content-enter-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.content-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.content-enter-to {
  opacity: 1;
  transform: translateY(0);
}
</style>