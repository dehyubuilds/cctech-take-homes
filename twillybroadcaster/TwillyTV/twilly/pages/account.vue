<template>
  <div class="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] pt-16 flex items-start justify-center">
    <div class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mb-4"></div>
          <p class="text-gray-400">Loading account information...</p>
        </div>
      </div>
      
      <!-- Error State -->
      <div v-else-if="error" class="text-center">
        <div class="bg-red-500/20 border border-red-500/30 rounded-xl p-6">
          <Icon name="heroicons:exclamation-triangle" class="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p class="text-red-400 text-lg">{{ error }}</p>
        </div>
      </div>
      
      <!-- Content (only shown when loaded) -->
      <div v-else>
        <!-- Header Section -->
        <div class="mb-8">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-3xl sm:text-4xl font-bold text-white mb-2">{{ pageTitle }}</h1>
              <p class="text-gray-400 text-sm sm:text-base">Manage your account settings and preferences</p>
              <div class="flex items-center gap-2 mt-2">
                <Icon name="heroicons:envelope" class="w-4 h-4 text-teal-400" />
                <span class="text-teal-300 text-sm font-medium">{{ authStore.user?.attributes?.email || authStore.user?.username || 'Loading...' }}</span>
              </div>
            </div>
            <div class="hidden sm:block">
              <div class="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center">
                <Icon name="heroicons:user-circle" class="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="mb-8">
          <div class="flex flex-wrap justify-center gap-2 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-2">
            <button
              v-for="section in sections"
              :key="section.id"
              @click="activeSection = section.id"
              class="px-6 py-3 rounded-lg transition-all duration-300 flex items-center gap-2"
              :class="[
                activeSection === section.id
                  ? 'bg-teal-500/30 text-teal-300 border border-teal-500/50'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              ]"
            >
              <Icon :name="section.icon" class="w-5 h-5" />
              {{ section.name }}
            </button>
          </div>
        </div>

        <!-- Tab Content -->
        <div class="space-y-6 mt-8">
            <!-- Username Management Section -->
            <div v-if="activeSection === 'username'" class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
              <div class="flex items-center mb-6">
                <div class="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mr-4">
                  <Icon name="heroicons:at-symbol" class="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 class="text-xl font-semibold text-white">Username Management</h2>
                  <p class="text-gray-400 text-sm">Set your unique username for sharing</p>
                </div>
              </div>
              
              <div class="space-y-6">
                <div>
                  <label class="block text-gray-300 mb-3 font-medium">Username</label>
                  <div class="flex gap-3">
                    <div class="flex-1 relative">
                      <input
                        v-model="username"
                        type="text"
                        placeholder="Enter username"
                        @input="checkUsernameAvailability"
                        class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300"
                        :class="{ 
                          'border-red-500': usernameError || (username && !isUsernameAvailable && !isCheckingUsername),
                          'border-green-500': username && isUsernameAvailable && !isCheckingUsername,
                          'border-yellow-500': isCheckingUsername
                        }"
                      />
                      <!-- Availability indicator -->
                      <div v-if="username && !isCheckingUsername" class="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div v-if="isUsernameAvailable" class="text-green-400">
                          <Icon name="heroicons:check-circle" class="w-5 h-5" />
                        </div>
                        <div v-else class="text-red-400">
                          <Icon name="heroicons:x-circle" class="w-5 h-5" />
                        </div>
                      </div>
                      <div v-if="isCheckingUsername" class="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-400"></div>
                      </div>
                    </div>
                    <button
                      @click="updateUsername"
                      :disabled="isUpdatingUsername || !username || !isUsernameAvailable || isCheckingUsername"
                      class="bg-teal-500/20 text-teal-300 border border-teal-500/30 px-6 py-3 rounded-lg hover:bg-teal-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Icon v-if="isUpdatingUsername" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                      <Icon v-else name="heroicons:check" class="w-4 h-4" />
                      <span v-if="isUpdatingUsername">Updating...</span>
                      <span v-else>Update</span>
                    </button>
                  </div>
                  
                  <!-- Status Messages -->
                  <div class="mt-3 space-y-2">
                    <div v-if="usernameError" class="flex items-center gap-2 text-red-400 text-sm">
                      <Icon name="heroicons:exclamation-triangle" class="w-4 h-4" />
                      {{ usernameError }}
                    </div>
                    <div v-if="usernameSuccess" class="flex items-center gap-2 text-green-400 text-sm">
                      <Icon name="heroicons:check-circle" class="w-4 h-4" />
                      {{ usernameSuccess }}
                    </div>
                    <div v-if="username && !isCheckingUsername && !isUsernameAvailable" class="flex items-center gap-2 text-red-400 text-sm">
                      <Icon name="heroicons:x-circle" class="w-4 h-4" />
                      This username is already taken. Please choose a different one.
                    </div>
                    <div v-if="username && !isCheckingUsername && isUsernameAvailable && isCurrentUsername" class="flex items-center gap-2 text-blue-400 text-sm">
                      <Icon name="heroicons:information-circle" class="w-4 h-4" />
                      This is your current username.
                    </div>
                    <div v-if="username && !isCheckingUsername && isUsernameAvailable && !isCurrentUsername" class="flex items-center gap-2 text-green-400 text-sm">
                      <Icon name="heroicons:check-circle" class="w-4 h-4" />
                      This username is available!
                    </div>
                  </div>
                  
                  <div class="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p class="text-blue-300 text-xs">
                      <Icon name="heroicons:information-circle" class="w-4 h-4 inline mr-1" />
                      Username will be used in your share URLs like: share.twilly.app/c/yourusername
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Security Section -->
            <div v-if="activeSection === 'security'" class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
              <div class="flex items-center mb-6">
                <div class="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center mr-4">
                  <Icon name="heroicons:shield-check" class="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 class="text-xl font-semibold text-white">Security Settings</h2>
                  <p class="text-gray-400 text-sm">Manage your account security</p>
                </div>
              </div>
              
              <div class="space-y-6">
                <div class="bg-black/20 rounded-xl p-6 border border-white/5">
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                      <Icon name="heroicons:key" class="w-5 h-5 text-teal-400" />
                      <div>
                        <h3 class="text-lg font-semibold text-white">Password</h3>
                        <p class="text-gray-400 text-sm">Change your account password</p>
                      </div>
                    </div>
                    <button 
                      @click="changePassword"
                      class="bg-teal-500/20 text-teal-300 border border-teal-500/30 px-4 py-2 rounded-lg hover:bg-teal-500/30 transition-all duration-300 flex items-center gap-2"
                    >
                      <Icon name="heroicons:arrow-right" class="w-4 h-4" />
                      Change Password
                    </button>
                  </div>
                </div>
                
                <div class="bg-black/20 rounded-xl p-6 border border-white/5">
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                      <Icon name="heroicons:device-phone-mobile" class="w-5 h-5 text-purple-400" />
                      <div>
                        <h3 class="text-lg font-semibold text-white">Two-Factor Authentication</h3>
                        <p class="text-gray-400 text-sm">Add an extra layer of security</p>
                      </div>
                    </div>
                    <button 
                      class="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-4 py-2 rounded-lg hover:bg-purple-500/30 transition-all duration-300 flex items-center gap-2"
                    >
                      <Icon name="heroicons:plus" class="w-4 h-4" />
                      Enable 2FA
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Collaborations Section -->
            <div v-if="activeSection === 'collaborations'" class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
              <div class="flex items-center mb-6">
                <div class="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mr-4">
                  <Icon name="heroicons:user-group" class="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 class="text-xl font-semibold text-white">Collaboration Management</h2>
                  <p class="text-gray-400 text-sm">Manage your channel collaborations and stream keys</p>
                </div>
              </div>
              
              <div class="space-y-6">
                <!-- Active Collaborations -->
                <div class="bg-black/20 rounded-xl p-6 border border-white/5">
                  <div class="flex items-center gap-3 mb-4">
                    <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
                    <div>
                      <h3 class="text-lg font-semibold text-white">Active Collaborations</h3>
                      <p class="text-gray-400 text-sm">Your current channel collaborations</p>
                    </div>
                  </div>
                  
                  <div v-if="collaborations.length === 0" class="text-center py-8">
                    <Icon name="heroicons:user-group" class="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p class="text-gray-400">No active collaborations</p>
                    <p class="text-gray-500 text-sm mt-2">Accept collaborator invites to see your collaborations here</p>
                  </div>
                  
                  <div v-else class="space-y-4">
                    <div v-for="collaboration in collaborations" :key="collaboration.channelId" 
                         class="bg-black/30 rounded-lg p-4 border border-white/10">
                      <div class="flex items-center justify-between">
                        <div>
                          <h4 class="text-white font-medium">{{ collaboration.channelName }}</h4>
                          <p class="text-gray-400 text-sm">Joined {{ formatDate(collaboration.joinedAt) }}</p>
                          <div class="flex items-center gap-2 mt-2">
                            <span v-if="collaboration.hasPayoutSetup" class="text-green-400 text-sm flex items-center gap-1">
                              <Icon name="heroicons:check-circle" class="w-4 h-4" />
                              Payout Ready
                            </span>
                            <span v-else class="text-yellow-400 text-sm flex items-center gap-1">
                              <Icon name="heroicons:exclamation-triangle" class="w-4 h-4" />
                              Payout Setup Required
                            </span>
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          <button 
                            v-if="collaboration.hasPayoutSetup && collaboration.streamKey"
                            @click="copyStreamKey(collaboration.streamKey)"
                            class="px-3 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded text-sm hover:bg-teal-500/30 transition-all duration-300 flex items-center gap-1"
                          >
                            <Icon name="heroicons:clipboard" class="w-4 h-4" />
                            Copy Key
                          </button>
                          <button 
                            v-else-if="!collaboration.hasPayoutSetup"
                            @click="getStreamKey(collaboration.channelId)"
                            :disabled="isGettingStreamKey"
                            class="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-sm hover:bg-blue-500/30 transition-all duration-300 flex items-center gap-1 disabled:opacity-50"
                          >
                            <Icon v-if="isGettingStreamKey" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                            <Icon v-else name="heroicons:key" class="w-4 h-4" />
                            {{ isGettingStreamKey ? 'Getting Key...' : 'Get Stream Key' }}
                          </button>
                        </div>
                      </div>
                      
                      <!-- Stream Key Display (if available) -->
                      <div v-if="collaboration.streamKey && collaboration.hasPayoutSetup" class="mt-3 p-3 bg-black/20 rounded border border-teal-500/30">
                        <div class="flex items-center justify-between mb-2">
                          <span class="text-teal-300 text-sm font-medium">Stream Key:</span>
                          <span class="text-gray-400 text-xs">rtmp://100.24.103.57:1935/live/</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <input
                            :value="collaboration.streamKey"
                            readonly
                            class="flex-1 bg-black/20 border border-teal-500/30 rounded px-3 py-2 text-white text-sm font-mono"
                          />
                          <button
                            @click="copyStreamKey(collaboration.streamKey)"
                            class="px-3 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded hover:bg-teal-500/30 transition-all duration-300"
                          >
                            <Icon name="heroicons:clipboard" class="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Collaboration Benefits -->
                <div class="bg-black/20 rounded-xl p-6 border border-white/5">
                  <div class="flex items-center gap-3 mb-4">
                    <Icon name="heroicons:star" class="w-5 h-5 text-yellow-400" />
                    <div>
                      <h3 class="text-lg font-semibold text-white">Collaboration Benefits</h3>
                      <p class="text-gray-400 text-sm">What you get as a collaborator</p>
                    </div>
                  </div>
                  
                  <div class="space-y-3 text-sm text-gray-300">
                    <div class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                      <span>Your own stream key for the channel</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                      <span>Revenue share from PPV content sales</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                      <span>Access to channel analytics and insights</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                      <span>Payouts processed automatically each month</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Purchase History Section -->
            <div v-if="activeSection === 'subscriptions'" class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
              <div class="flex items-center mb-6">
                <div class="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center mr-4">
                  <Icon name="heroicons:shopping-bag" class="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <h2 class="text-xl font-semibold text-white">Purchase History</h2>
                  <p class="text-gray-400 text-sm">View your PPV content purchases and access</p>
                </div>
              </div>
              
              <div class="space-y-6">
                <!-- Recent Purchases -->
                <div class="bg-black/20 rounded-xl p-6 border border-white/5">
                  <div class="flex items-center gap-3 mb-4">
                    <Icon name="heroicons:clock" class="w-5 h-5 text-blue-400" />
                    <div>
                      <h3 class="text-lg font-semibold text-white">Recent Purchases</h3>
                      <p class="text-gray-400 text-sm">Your latest PPV content purchases</p>
                    </div>
                  </div>
                  
                  <div v-if="recentPurchases.length === 0" class="text-center py-8">
                    <Icon name="heroicons:shopping-bag" class="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p class="text-gray-400">No purchases yet</p>
                    <p class="text-gray-500 text-sm mt-2">Buy PPV content to see your purchases here</p>
                  </div>
                  
                  <div v-else class="space-y-4">
                    <div v-for="purchase in recentPurchases" :key="purchase.id" 
                         class="bg-black/30 rounded-lg p-4 border border-white/10">
                      <div class="flex items-center justify-between">
                        <div>
                          <h4 class="text-white font-medium">{{ purchase.contentTitle }}</h4>
                          <p class="text-gray-400 text-sm">by {{ purchase.creatorUsername }}</p>
                          <p class="text-gray-500 text-xs">Purchased {{ formatDate(purchase.purchasedAt) }}</p>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="text-green-400 text-sm flex items-center gap-1">
                            <Icon name="heroicons:check-circle" class="w-4 h-4" />
                            ${{ purchase.amount }}
                          </span>
                          <button 
                            @click="viewContent(purchase.contentId)"
                            class="px-3 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded text-sm hover:bg-teal-500/30 transition-all duration-300"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- PPV Benefits -->
                <div class="bg-black/20 rounded-xl p-6 border border-white/5">
                  <div class="flex items-center gap-3 mb-4">
                    <Icon name="heroicons:star" class="w-5 h-5 text-yellow-400" />
                    <div>
                      <h3 class="text-lg font-semibold text-white">Pay-Per-View Benefits</h3>
                      <p class="text-gray-400 text-sm">Why PPV is better than subscriptions</p>
                    </div>
                  </div>
                  
                  <div class="space-y-3 text-sm text-gray-300">
                    <div class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                      <span>Pay only for content you want to watch</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                      <span>No recurring charges or commitments</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                      <span>Support creators directly for their best content</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                      <span>Lifetime access to purchased content</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Payouts Section -->
            <div v-if="activeSection === 'payouts'" class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
              <div class="flex items-center mb-6">
                <div class="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mr-4">
                  <Icon name="heroicons:credit-card" class="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h2 class="text-xl font-semibold text-white">Payout Settings</h2>
                  <p class="text-gray-400 text-sm">Set up your Stripe Connect account for receiving payouts</p>
                </div>
              </div>
              
              <div class="space-y-6">
                <!-- Stripe Connect Status -->
                <div class="bg-black/20 rounded-xl p-6 border border-white/5">
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                      <Icon name="heroicons:banknotes" class="w-5 h-5 text-green-400" />
                      <div>
                        <h3 class="text-lg font-semibold text-white">Stripe Connect Account</h3>
                        <p class="text-gray-400 text-sm">Connect your bank account to receive payouts</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span v-if="stripeAccountStatus === 'connected'" class="text-green-400 text-sm flex items-center gap-1">
                        <Icon name="heroicons:check-circle" class="w-4 h-4" />
                        Connected
                      </span>
                      <span v-else-if="stripeAccountStatus === 'pending'" class="text-yellow-400 text-sm flex items-center gap-1">
                        <Icon name="heroicons:clock" class="w-4 h-4" />
                        Pending
                      </span>
                      <span v-else class="text-red-400 text-sm flex items-center gap-1">
                        <Icon name="heroicons:x-circle" class="w-4 h-4" />
                        Not Connected
                      </span>
                    </div>
                  </div>
                  
                  <div class="space-y-4">
                    <div v-if="stripeAccountStatus === 'not_connected'">
                      <p class="text-gray-300 text-sm mb-4">
                        Set up your Stripe Connect account to receive payouts from your content. This is required to receive payments as a creator or collaborator.
                      </p>
                      <button 
                        @click="setupStripeConnect"
                        :disabled="isSettingUpStripe"
                        class="bg-green-500/20 text-green-300 border border-green-500/30 px-6 py-3 rounded-lg hover:bg-green-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Icon v-if="isSettingUpStripe" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                        <Icon v-else name="heroicons:plus" class="w-4 h-4" />
                        <span v-if="isSettingUpStripe">Setting up...</span>
                        <span v-else>Set Up Payout Account</span>
                      </button>
                    </div>
                    
                    <div v-else-if="stripeAccountStatus === 'pending'">
                      <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                        <div class="flex items-start gap-3">
                          <Icon name="heroicons:information-circle" class="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 class="text-yellow-300 font-semibold mb-2">Setup in Progress</h4>
                            <p class="text-yellow-200 text-sm mb-3">
                              Your Stripe Connect account was created but needs completion. The setup process has multiple steps:
                            </p>
                            <div class="space-y-2 text-sm text-yellow-200/80">
                              <div class="flex items-center gap-2">
                                <Icon name="heroicons:check-circle" class="w-4 h-4 text-yellow-400" />
                                <span>Step 1: Business information & verification</span>
                              </div>
                              <div class="flex items-center gap-2">
                                <Icon name="heroicons:check-circle" class="w-4 h-4 text-yellow-400" />
                                <span>Step 2: Bank account details</span>
                              </div>
                              <div class="flex items-center gap-2">
                                <Icon name="heroicons:check-circle" class="w-4 h-4 text-yellow-400" />
                                <span>Step 3: Identity verification</span>
                              </div>
                            </div>
                            <p class="text-yellow-200/70 text-xs mt-3">
                              <strong>Note:</strong> You may need to click "Complete Setup" multiple times as you progress through each step. This is normal - just continue until all steps are finished.
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div class="flex flex-col sm:flex-row gap-3">
                        <button 
                          @click="setupStripeConnect"
                          :disabled="isSettingUpStripe"
                          class="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-6 py-3 rounded-lg hover:bg-yellow-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <Icon v-if="isSettingUpStripe" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                          <Icon v-else name="heroicons:arrow-top-right-on-square" class="w-4 h-4" />
                          <span v-if="isSettingUpStripe">Setting up...</span>
                          <span v-else>Complete Setup</span>
                        </button>
                        <button 
                          @click="refreshStripeStatus"
                          :disabled="isCheckingStripe"
                          class="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-6 py-3 rounded-lg hover:bg-blue-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <Icon v-if="isCheckingStripe" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                          <Icon v-else name="heroicons:arrow-path" class="w-4 h-4" />
                          <span v-if="isCheckingStripe">Refreshing...</span>
                          <span v-else>Refresh Status</span>
                        </button>
                      </div>
                    </div>
                    
                    <div v-else-if="stripeAccountStatus === 'connected'">
                      <p class="text-green-300 text-sm mb-4">
                        Your Stripe Connect account is active and ready to receive payouts.
                      </p>
                      <div class="flex flex-col sm:flex-row gap-3">
                        <button 
                          @click="viewStripeDashboard"
                          class="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-6 py-3 rounded-lg hover:bg-blue-500/30 transition-all duration-300 flex items-center justify-center gap-2"
                        >
                          <Icon name="heroicons:chart-bar" class="w-4 h-4" />
                          View Earnings
                        </button>
                        <button 
                          @click="checkStripeConnectStatus"
                          :disabled="isCheckingStripe"
                          class="bg-green-500/20 text-green-300 border border-green-500/30 px-6 py-3 rounded-lg hover:bg-green-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <Icon v-if="isCheckingStripe" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                          <Icon v-else name="heroicons:arrow-path" class="w-4 h-4" />
                          <span v-if="isCheckingStripe">Checking...</span>
                          <span v-else>Refresh Status</span>
                        </button>
                        <button 
                          @click="deleteStripeAccount"
                          :disabled="isDeletingStripe"
                          class="bg-red-500/20 text-red-300 border border-red-500/30 px-6 py-3 rounded-lg hover:bg-red-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <Icon v-if="isDeletingStripe" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                          <Icon v-else name="heroicons:trash" class="w-4 h-4" />
                          <span v-if="isDeletingStripe">Deleting...</span>
                          <span v-else>Delete Account</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Payout Information -->
                <div class="bg-black/20 rounded-xl p-6 border border-white/5">
                  <div class="flex items-center gap-3 mb-4">
                    <Icon name="heroicons:information-circle" class="w-5 h-5 text-blue-400" />
                    <div>
                      <h3 class="text-lg font-semibold text-white">How Payouts Work</h3>
                      <p class="text-gray-400 text-sm">Understanding your revenue splits</p>
                    </div>
                  </div>
                  
                  <div class="space-y-3 text-sm text-gray-300">
                    <div class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                      <span>Platform fee: 10% of PPV revenue</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                      <span>Creator/Seller: 85% of PPV revenue</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                      <span>Affiliate marketers: 5% of PPV revenue</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <Icon name="heroicons:check-circle" class="w-4 h-4 text-green-400" />
                      <span>Payouts are processed automatically each month</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { Auth } from 'aws-amplify';
import { useRoute } from 'vue-router';

const authStore = useAuthStore();
const route = useRoute();

const loading = ref(true);
const error = ref(null);
const user = ref(null);
const userType = ref(null);
const activeSection = ref('username');
const sections = [
  { id: 'username', name: 'Username', icon: 'heroicons:at-symbol' },
  { id: 'security', name: 'Security', icon: 'heroicons:shield-check' },
  { id: 'payouts', name: 'Payouts', icon: 'heroicons:credit-card' },
  { id: 'collaborations', name: 'Collaborations', icon: 'heroicons:user-group' },
  { id: 'subscriptions', name: 'Purchases', icon: 'heroicons:shopping-bag' }
];
const form = ref({
  email: authStore.user?.attributes?.email || ''
});

// Username management
const username = ref('');
const isUpdatingUsername = ref(false);
const usernameError = ref('');
const usernameSuccess = ref('');
const isCheckingUsername = ref(false);
const isUsernameAvailable = ref(false);
const usernameCheckTimeout = ref(null);

// Stripe Connect management
const stripeAccountStatus = ref('not_connected');
const isSettingUpStripe = ref(false);
const isCheckingStripe = ref(false);
const isSyncingStripe = ref(false);
const isDeletingStripe = ref(false);
const stripeAccountId = ref('');
const stripeDashboardUrl = ref('');

// Purchase history management
const purchases = ref([]);
const isLoadingPurchases = ref(false);

// Collaboration management
const collaborations = ref([]);
const isLoadingCollaborations = ref(false);
const isGettingStreamKey = ref(false);

const pageTitle = computed(() => {
  return authStore.userType === 'producer' ? 'Creator Account' : 'Account Management';
});

const isCurrentUsername = computed(() => {
  const currentUsername = authStore.user?.attributes?.username || '';
  const isCurrent = username.value === currentUsername;
  return isCurrent;
});

const recentPurchases = computed(() => {
  console.log('Computing recentPurchases from:', purchases.value);
  // Sort by purchase date and limit to 10 most recent
  const recent = purchases.value
    .sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt))
    .slice(0, 10);
  console.log('Recent purchases found:', recent);
  return recent;
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
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to fetch username from DynamoDB:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      return '';
    }
  } catch (error) {
    console.error('Error fetching username from DynamoDB:', error);
    return '';
  }
};

onMounted(async () => {
  try {
    await authStore.checkAuth();
    user.value = authStore.currentUser;
    userType.value = authStore.userType;
    
    // Get current user info
    const currentUserEmail = authStore.user?.attributes?.email;
    const currentUserId = authStore.user?.attributes?.sub;
    
    
    // ALWAYS fetch username from DynamoDB as single source of truth
    let dynamoUsername = '';
    if (currentUserEmail && currentUserId) {
      try {
        
        dynamoUsername = await fetchUsernameFromDynamo();
        
      } catch (error) {
        console.error('Error fetching username from DynamoDB:', error);
        dynamoUsername = '';
      }
    } else {
      
    }
    
    // Clear any old localStorage keys to prevent contamination
    if (process.client) {
      localStorage.removeItem('userUsername');
    }
    
    // Use ONLY DynamoDB username - no fallbacks
    username.value = dynamoUsername || '';
    
    // Update auth store with DynamoDB username to keep them in sync
    if (dynamoUsername && authStore.user) {
      authStore.user.attributes = authStore.user.attributes || {};
      authStore.user.attributes.username = dynamoUsername;
      
    }
    
    // Update localStorage with DynamoDB username for consistency
    if (process.client && dynamoUsername) {
      const userSpecificKey = `userUsername_${currentUserId}`;
      localStorage.setItem(userSpecificKey, dynamoUsername);
      
    }
    
    
    // Check availability for the initial username
    if (username.value) {
      await checkUsernameAvailability();
    }
    
    // Check for section parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');
    if (section && sections.some(s => s.id === section)) {
      activeSection.value = section;
    }

    // Check Stripe Connect status
    await checkStripeConnectStatus();
    
    // Load user purchase history
    await loadUserPurchases();
    
    // Load user collaborations
    await loadUserCollaborations();

  } catch (err) {
    console.error('Error in onMounted:', err);
    error.value = 'Failed to load account information';
    
    // Minimal fallback - just show empty username
    try {
      if (authStore.user) {
        user.value = authStore.currentUser;
        userType.value = authStore.userType;
        username.value = ''; // Always start empty if DynamoDB fails
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
  } finally {
    loading.value = false;
  }
});

// Watch for auth store changes to keep username in sync
watch(isUsernameAvailable, (newValue, oldValue) => {
  
});

watch(username, (newValue, oldValue) => {
  
});

watch(() => authStore.user?.attributes?.username, (newUsername) => {
  if (newUsername && newUsername !== username.value) {
    
    username.value = newUsername;
    // Also update localStorage with user-specific key
    if (process.client) {
      const currentUserId = authStore.user?.attributes?.sub;
      const userSpecificKey = `userUsername_${currentUserId}`;
      localStorage.setItem(userSpecificKey, newUsername);
    }
  }
});

// Watch for active section changes to reload data when needed
watch(activeSection, (newSection) => {
  console.log('Active section changed to:', newSection);
  if (newSection === 'subscriptions') {
    console.log('Loading purchases due to section change');
    loadUserPurchases();
  } else if (newSection === 'collaborations') {
    console.log('Loading collaborations due to section change');
    loadUserCollaborations();
  }
});

// Watch for route changes to reload purchases when navigating to account page
watch(() => route.query.section, (newSection) => {
  console.log('Route section changed to:', newSection);
  if (newSection === 'subscriptions') {
    console.log('Loading purchases due to route change');
    loadUserPurchases();
  }
});

const changePassword = async () => {
  try {
    await Auth.changePassword(
      authStore.currentUser,
      'currentPassword',
      'newPassword'
    );
    // Show success message
  } catch (err) {
    console.error('Error changing password:', err);
    // Show error message
  }
};

// Check username availability with debouncing
const checkUsernameAvailability = async () => {
  // Clear previous timeout
  if (usernameCheckTimeout.value) {
    clearTimeout(usernameCheckTimeout.value);
  }

  // Reset availability state
  isUsernameAvailable.value = false;
  isCheckingUsername.value = false;

  const trimmedUsername = username.value.trim();
  
  // Basic validation
  if (!trimmedUsername) {
    return;
  }

  if (trimmedUsername.length < 3) {
    return;
  }

  if (!/^[a-zA-Z0-9_\s-]+$/.test(trimmedUsername)) {
    return;
  }

  // Don't check if it's the same as current username
  const currentUsername = authStore.user?.attributes?.username || '';
  
  
  if (trimmedUsername === currentUsername) {
    
    isUsernameAvailable.value = true;
    return;
  }

  // Debounce the API call
  usernameCheckTimeout.value = setTimeout(async () => {
    isCheckingUsername.value = true;
    
    try {
      const response = await fetch('/api/creators/check-username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: trimmedUsername,
          userId: authStore.user.attributes.sub
        })
      });

      const data = await response.json();
      
      
      if (response.ok) {
        isUsernameAvailable.value = data.available;
        
      } else {
        isUsernameAvailable.value = false;
        
      }
    } catch (error) {
      console.error('Error checking username availability:', error);
      isUsernameAvailable.value = false;
    } finally {
      isCheckingUsername.value = false;
    }
  }, 500); // 500ms debounce
};

const updateUsername = async () => {
  if (!username.value.trim()) {
    usernameError.value = 'Username is required';
    return;
  }

  if (username.value.length < 3) {
    usernameError.value = 'Username must be at least 3 characters';
    return;
  }

  if (!/^[a-zA-Z0-9_\s-]+$/.test(username.value)) {
    usernameError.value = 'Username can only contain letters, numbers, spaces, hyphens, and underscores';
    return;
  }

  if (!isUsernameAvailable.value) {
    usernameError.value = 'Please choose an available username';
    return;
  }

  isUpdatingUsername.value = true;
  usernameError.value = '';
  usernameSuccess.value = '';

  try {
    const newUsername = username.value.trim();
    const currentUserId = authStore.user.attributes.sub;
    
    // Update the creator record with the new username in DynamoDB
    const response = await fetch('/api/creators/update-username', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUserId,
        username: newUsername,
        email: authStore.user.attributes.email || user.value?.attributes?.email
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update username');
    }

    // Update ALL sources consistently to prevent sync issues
    
    // 1. Update auth store user attributes
    if (authStore.user) {
      authStore.user.attributes = authStore.user.attributes || {};
      authStore.user.attributes.username = newUsername;
    }
    
    // 2. Update auth store currentUser if it exists
    if (authStore.currentUser) {
      authStore.currentUser.attributes = authStore.currentUser.attributes || {};
      authStore.currentUser.attributes.username = newUsername;
    }
    
    // 3. Update user-specific localStorage
    if (process.client) {
      const userSpecificKey = `userUsername_${currentUserId}`;
      localStorage.setItem(userSpecificKey, newUsername);
      
    }
    
    // 4. Update authState in localStorage
    if (process.client) {
      const authState = JSON.parse(localStorage.getItem('authState') || '{}');
      if (authState.user) {
        authState.user.attributes = authState.user.attributes || {};
        authState.user.attributes.username = newUsername;
        localStorage.setItem('authState', JSON.stringify(authState));
        
      }
    }
    
    // 5. Clear any old generic localStorage keys to prevent contamination
    if (process.client) {
      localStorage.removeItem('userUsername');
      
    }
    
    usernameSuccess.value = 'Username updated successfully!';
    setTimeout(() => { usernameSuccess.value = ''; }, 5000);
    
    // Reset availability check
    isUsernameAvailable.value = true;
    
    
  } catch (error) {
    console.error('Error updating username:', error);
    usernameError.value = error.message || 'Failed to update username';
  } finally {
    isUpdatingUsername.value = false;
  }
};

// Stripe Connect functions
const setupStripeConnect = async () => {
  if (!authStore.user) {
    console.error('User not authenticated');
    return;
  }

  isSettingUpStripe.value = true;
  
  try {
    const response = await fetch('/api/stripe/create-connect-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: authStore.user.attributes.email || authStore.user.username,
        username: authStore.user.attributes.username || '',
        email: authStore.user.attributes.email
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      // Redirect to Stripe onboarding
      if (data.onboardingUrl) {
        window.open(data.onboardingUrl, '_blank');
        stripeAccountStatus.value = 'pending';
        stripeAccountId.value = data.accountId;
      }
    } else {
      console.error('Failed to create Stripe Connect account:', data.message);
    }
  } catch (error) {
    console.error('Error setting up Stripe Connect:', error);
  } finally {
    isSettingUpStripe.value = false;
  }
};

const checkStripeStatus = async () => {
  if (!stripeAccountId.value) {
    console.error('No Stripe account ID found');
    return;
  }

  isCheckingStripe.value = true;
  
  try {
    const response = await fetch('/api/stripe/check-account-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountId: stripeAccountId.value
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      const previousStatus = stripeAccountStatus.value;
      stripeAccountStatus.value = data.status;
      if (data.status === 'connected') {
        stripeDashboardUrl.value = data.dashboardUrl;
        
        // If status changed to connected, refresh role data
        if (previousStatus !== 'connected') {
          console.log('Stripe status changed to connected, refreshing role data...');
          await refreshUserRoles();
        }
      }
    }
  } catch (error) {
    console.error('Error checking Stripe status:', error);
  } finally {
    isCheckingStripe.value = false;
  }
};

// Function to refresh user roles after Stripe setup
const refreshUserRoles = async () => {
  try {
    // Refresh collaborator roles
    const collaboratorResponse = await $fetch('/api/collaborations/update-payout-status', {
      method: 'POST',
      body: { 
        userId: authStore.user.attributes.sub,
        userEmail: authStore.user.attributes.email
      }
    });
    
    // Refresh casting director roles
    const castingDirectorResponse = await $fetch('/api/casting-directors/update-payout-status', {
      method: 'POST',
      body: { 
        userId: authStore.user.attributes.sub,
        userEmail: authStore.user.attributes.email
      }
    });
    
    console.log('User roles refreshed after Stripe setup');
    
    // Reload collaborations to show updated payout status
    await loadCollaborations();
    
  } catch (error) {
    console.error('Error refreshing user roles:', error);
  }
};

const viewStripeDashboard = () => {
  console.log('viewStripeDashboard called - redirecting to profile page');
  
  // Redirect to profile page instead of trying to open Stripe dashboard
  navigateTo('/profile');
};

// Check Stripe Connect status on mount
const checkStripeConnectStatus = async () => {
  console.log('checkStripeConnectStatus called');
  if (!authStore.user) {
    console.log('No auth user found');
    return;
  }
  
  isCheckingStripe.value = true;
  console.log('Checking status for user:', authStore.user.attributes.email || authStore.user.username);
  
  try {
    const response = await fetch('/api/stripe/get-account-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: authStore.user.attributes.email || authStore.user.username
      })
    });

    const data = await response.json();
    console.log('Response:', data);
    
    if (response.ok && data.success) {
      stripeAccountStatus.value = data.status;
      stripeAccountId.value = data.accountId || '';
      stripeDashboardUrl.value = data.dashboardUrl || '';
      console.log('Updated status to:', data.status);
    } else {
      // If no account found, set to not_connected
      stripeAccountStatus.value = 'not_connected';
      console.log('No account found, set to not_connected');
    }
  } catch (error) {
    console.error('Error checking Stripe Connect status:', error);
    // Set to not_connected on error
    stripeAccountStatus.value = 'not_connected';
  } finally {
    isCheckingStripe.value = false;
  }
};

const refreshStripeStatus = async () => {
  console.log('refreshStripeStatus called');
  if (!authStore.user) {
    console.log('No auth user found');
    return;
  }
  
  isCheckingStripe.value = true;
  console.log('Refreshing status for user:', authStore.user.attributes.email || authStore.user.username);
  
  try {
    // First, check the local status from DynamoDB
    const localResponse = await fetch('/api/stripe/get-account-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: authStore.user.attributes.email || authStore.user.username
      })
    });

    const localData = await localResponse.json();
    console.log('Local status response:', localData);
    
    if (localResponse.ok && localData.success) {
      // If status is still pending, sync from Stripe
      if (localData.status === 'pending') {
        console.log('Status is pending, syncing from Stripe...');
        
        const syncResponse = await fetch('/api/stripe/sync-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: authStore.user.attributes.email || authStore.user.username
          })
        });

        const syncData = await syncResponse.json();
        console.log('Sync response:', syncData);
        
        if (syncResponse.ok && syncData.success) {
          stripeAccountStatus.value = syncData.status;
          stripeAccountId.value = syncData.accountId || '';
          console.log('Synced status to:', syncData.status);
        } else {
          console.log('Sync failed:', syncData.message);
          // Keep the local status if sync fails
          stripeAccountStatus.value = localData.status;
          stripeAccountId.value = localData.accountId || '';
        }
      } else {
        // Use the local status if it's not pending
        stripeAccountStatus.value = localData.status;
        stripeAccountId.value = localData.accountId || '';
        stripeDashboardUrl.value = localData.dashboardUrl || '';
        console.log('Updated status to:', localData.status);
      }
    } else {
      // If no account found, set to not_connected
      stripeAccountStatus.value = 'not_connected';
      console.log('No account found, set to not_connected');
    }
  } catch (error) {
    console.error('Error refreshing Stripe status:', error);
    // Set to not_connected on error
    stripeAccountStatus.value = 'not_connected';
  } finally {
    isCheckingStripe.value = false;
  }
};

const deleteStripeAccount = async () => {
  if (!authStore.user) {
    console.error('User not authenticated');
    return;
  }

  if (!confirm('Are you sure you want to delete your Stripe Connect account? This action cannot be undone. You will need to set up a new account to receive payouts.')) {
    return;
  }

  isDeletingStripe.value = true;
  
  try {
    const response = await fetch('/api/stripe/delete-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: authStore.user.attributes.email || authStore.user.username
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('Stripe Connect account deleted successfully');
      // Reset the status
      stripeAccountStatus.value = 'not_connected';
      stripeAccountId.value = '';
      stripeDashboardUrl.value = '';
      alert('Stripe Connect account deleted successfully. You can now set up a new payout account.');
    } else {
      console.error('Failed to delete Stripe Connect account:', data.message);
      alert('Failed to delete account: ' + data.message);
    }
  } catch (error) {
    console.error('Error deleting Stripe Connect account:', error);
    alert('Error deleting account: ' + error.message);
  } finally {
    isDeletingStripe.value = false;
  }
};

// Load user purchase history
const loadUserPurchases = async () => {
  console.log('loadUserPurchases called');
  if (!authStore.user?.attributes?.email) {
    console.log('No user email found, skipping purchase load');
    return;
  }

  isLoadingPurchases.value = true;
  
  try {
    console.log('Fetching purchases for:', authStore.user.attributes.email);
    const response = await fetch('/api/purchases/get-user-purchases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        buyerEmail: authStore.user.attributes.email
      })
    });

    const data = await response.json();
    console.log('Purchase API response:', data);
    
    if (response.ok && data.success) {
      purchases.value = data.purchases || [];
      console.log('Updated purchases:', purchases.value);
    } else {
      console.error('Failed to load purchases:', data.message);
    }
  } catch (error) {
    console.error('Error loading purchases:', error);
  } finally {
    isLoadingPurchases.value = false;
  }
};

// Load user collaborations
const loadUserCollaborations = async () => {
  console.log('loadUserCollaborations called');
  if (!authStore.user?.attributes?.sub) {
    console.log('No user ID found, skipping collaboration load');
    return;
  }

  isLoadingCollaborations.value = true;
  
  try {
    console.log('Fetching collaborations for user:', authStore.user.attributes.sub);
    
    // Query DynamoDB for user's collaborations
    const response = await fetch('/api/collaborations/get-user-collaborations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: authStore.user.attributes.sub
      })
    });

    const data = await response.json();
    console.log('Collaboration API response:', data);
    
    if (response.ok && data.success) {
      collaborations.value = data.collaborations || [];
      console.log('Updated collaborations:', collaborations.value);
    } else {
      console.error('Failed to load collaborations:', data.message);
    }
  } catch (error) {
    console.error('Error loading collaborations:', error);
  } finally {
    isLoadingCollaborations.value = false;
  }
};

// Get stream key for a collaboration
const getStreamKey = async (channelId) => {
  if (!authStore.user?.attributes?.sub) {
    console.error('No user ID found');
    return;
  }

  isGettingStreamKey.value = true;
  
  try {
    const response = await fetch('/api/collaborations/get-stream-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId: channelId,
        userId: authStore.user.attributes.sub
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      // Update the collaboration with the stream key
      const collaborationIndex = collaborations.value.findIndex(c => c.channelId === channelId);
      if (collaborationIndex !== -1) {
        collaborations.value[collaborationIndex].streamKey = data.streamKey;
        collaborations.value[collaborationIndex].hasPayoutSetup = true;
        collaborations.value[collaborationIndex].payoutSetupRequired = false;
      }
      
      // Show success message
      alert('Stream key retrieved successfully!');
    } else {
      if (data.errorCode === 'PAYOUT_SETUP_REQUIRED') {
        alert('Please set up your payout account first to get your stream key.');
        // Redirect to payouts section
        activeSection.value = 'payouts';
      } else {
        alert('Failed to get stream key: ' + (data.message || 'Unknown error'));
      }
    }
  } catch (error) {
    console.error('Error getting stream key:', error);
    alert('Error getting stream key: ' + error.message);
  } finally {
    isGettingStreamKey.value = false;
  }
};

// Copy stream key to clipboard
const copyStreamKey = async (streamKey) => {
  try {
    const fullPath = `rtmp://100.24.103.57:1935/live/${streamKey}`;
    
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(fullPath);
      alert('Stream key copied to clipboard!');
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
        alert('Stream key copied to clipboard!');
      } else {
        alert('Copy failed. Please copy manually: ' + fullPath);
      }
    }
  } catch (error) {
    console.error('Error copying stream key:', error);
    alert('Error copying stream key: ' + error.message);
  }
};

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return 'Unknown date';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

// View purchased content
const viewContent = (contentId) => {
  console.log('Viewing content:', contentId);
  // Navigate to the content page
  // This would typically navigate to the content viewer
  navigateTo(`/content/${contentId}`);
};
</script>

<style scoped>
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

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

::-webkit-scrollbar-thumb {
  background: rgba(20, 184, 166, 0.5);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(20, 184, 166, 0.7);
}

/* Form focus states */
input:focus, button:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(20, 184, 166, 0.5);
}

/* Section transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style> 