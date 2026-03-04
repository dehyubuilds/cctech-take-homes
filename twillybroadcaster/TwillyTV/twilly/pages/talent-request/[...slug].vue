<template>
  <div class="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] pt-16">
    <!-- Loading State -->
    <div v-if="isLoading" class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
      <div class="text-center bg-black/40 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
        <div class="inline-block animate-spin rounded-full h-16 w-16 border-4 border-teal-400 border-t-transparent mb-6"></div>
        <p class="text-white text-xl font-medium">Loading amazing opportunity...</p>
        <p class="text-gray-300 text-sm mt-2">Preparing your next big break</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error || !hasValidSlug" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center backdrop-blur-sm">
        <Icon name="heroicons:exclamation-triangle" class="w-16 h-16 text-red-400 mx-auto mb-6" />
        <h3 class="text-red-200 text-2xl mb-4 font-bold">Oops! Something went wrong</h3>
        <p v-if="!hasValidSlug" class="text-red-200 mb-6 text-lg">Invalid URL structure. This talent request link appears to be malformed.</p>
        <p v-else class="text-red-200 mb-6 text-lg">{{ error }}</p>
        <button @click="retryLoad" class="px-6 py-3 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-all duration-300 font-medium">
          Try Again
        </button>
      </div>
    </div>

    <!-- Main Content (only shown when loaded, no errors, and valid slug parameters) -->
    <div v-else-if="hasValidSlug">
      <!-- Back to Profile Button for authenticated users -->
      <div v-if="authStore.user" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button 
          @click="goBackToProfile"
          class="inline-flex items-center gap-3 px-4 py-3 bg-white/5 backdrop-blur-sm text-white/80 border border-white/10 rounded-xl hover:bg-white/10 hover:text-white transition-all duration-300 text-sm font-medium group"
        >
          <Icon name="heroicons:arrow-left" class="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
          <span class="hidden sm:inline">Back to Profile</span>
          <span class="sm:hidden">Back</span>
        </button>
      </div>
      
      <div class="max-w-7xl mx-auto px-4 pb-12 sm:px-6 lg:px-8">
        <!-- Channel Hero Banner with Poster - EXACT SAME LAYOUT AS WORKING CHANNEL PAGE -->
        <div v-if="channelPosterUrl" class="mb-8 sm:mb-12">
          <div class="relative h-[48vh] w-full overflow-hidden">
            <img 
              :src="channelPosterUrl" 
              :alt="`${channel} Channel Poster`"
              class="w-full h-full object-cover"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
            <div class="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
              <div class="max-w-6xl mx-auto">
                <h1 class="text-white text-3xl sm:text-5xl font-bold mb-2">{{ channel }}</h1>
                <p class="text-gray-300 text-sm sm:text-base">Talent Request by {{ displayedCreatorName }}</p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Fallback Header when no poster -->
        <div v-else class="mb-8 sm:mb-12 text-center">
          <div class="bg-gradient-to-r from-white/5 via-white/10 to-white/5 backdrop-blur-sm rounded-3xl border border-white/20 p-8 sm:p-12 shadow-2xl">
            <div class="w-24 h-24 bg-gradient-to-br from-teal-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:video-camera" class="w-12 h-12 text-white" />
            </div>
            <h1 class="text-3xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
              {{ channel }}
            </h1>
            <p class="text-gray-300 text-lg sm:text-2xl mb-6">
              Talent Request by {{ displayedCreatorName }}
            </p>
            <div class="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full text-sm">
              <Icon name="heroicons:sparkles" class="w-4 h-4" />
              <span>Creative Opportunities Await</span>
            </div>
          </div>
        </div>

        <!-- Single Full Casting Page (when rid present) -->
        <div v-if="showSingle && singleRequest" class="bg-gradient-to-br from-white/5 via-white/10 to-white/5 backdrop-blur-sm border border-white/20 rounded-3xl p-6 sm:p-8 lg:p-12 shadow-2xl">
          <!-- Request Poster Image - Display prominently at top -->
          <div v-if="singleRequest.inspirationImage || singleRequest.channelPosterUrl" class="w-full aspect-[1200/420] bg-black/30 mb-6 sm:mb-8 rounded-2xl overflow-hidden shadow-xl">
            <img 
              :src="singleRequest.inspirationImage || singleRequest.channelPosterUrl" 
              alt="Request Poster" 
              class="w-full h-full object-cover" 
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
          </div>
          
          <!-- Project Header -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div class="flex-1">
              <h2 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 leading-tight">
                {{ singleRequest.projectTitle }}
              </h2>
              <p class="text-gray-300 text-base sm:text-lg">Ready to bring your talent to this project?</p>
            </div>
            <span :class="getStatusBadgeClass(singleRequest.status)" class="px-4 py-2 rounded-full text-sm font-semibold w-fit shadow-lg">
              {{ getStatusText(singleRequest.status) }}
            </span>
          </div>
          
          <!-- Project Description -->
          <div class="bg-black/20 backdrop-blur-sm rounded-2xl p-6 mb-6 sm:mb-8 border border-white/10">
            <h3 class="text-white font-semibold mb-4 text-lg flex items-center gap-2">
              <Icon name="heroicons:light-bulb" class="w-5 h-5 text-yellow-400" />
              Project Concept
            </h3>
            <p class="text-gray-200 text-base sm:text-lg leading-relaxed whitespace-pre-line">{{ singleRequest.showConcept }}</p>
          </div>

          <!-- Project Details Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div class="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-3 mb-2">
                <Icon name="heroicons:calendar" class="w-5 h-5 text-blue-400" />
                <span class="text-white font-medium">Start Date</span>
              </div>
              <p class="text-gray-300">{{ formatDate(singleRequest.startDate) }}</p>
            </div>
            
            <div class="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-3 mb-2">
                <Icon name="heroicons:clock" class="w-5 h-5 text-green-400" />
                <span class="text-white font-medium">Stream Length</span>
              </div>
              <p class="text-gray-300">{{ singleRequest.streamLength }}</p>
            </div>
            
            <div class="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-3 mb-2">
                <Icon name="heroicons:computer-desktop" class="w-5 h-5 text-cyan-400" />
                <span class="text-white font-medium">Stream Type</span>
              </div>
              <p class="text-gray-300">{{ getStreamTypeText(singleRequest.streamType) }}</p>
            </div>
            
            <div class="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-3 mb-2">
                <Icon name="heroicons:map-pin" class="w-5 h-5 text-red-400" />
                <span class="text-white font-medium">Location</span>
              </div>
              <p class="text-gray-300">{{ singleRequest.location }}</p>
            </div>
            
            <div class="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div class="flex items-center gap-3 mb-2">
                <Icon name="heroicons:users" class="w-5 h-5 text-purple-400" />
                <span class="text-white font-medium">Casting Needs</span>
              </div>
              <p class="text-gray-300">{{ singleRequest.castingNeeds }}</p>
            </div>
            
            <div class="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/10 sm:col-span-2 lg:col-span-1">
              <div class="flex items-center gap-3 mb-2">
                <Icon name="heroicons:clock" class="w-5 h-5 text-orange-400" />
                <span class="text-white font-medium">Time Slots</span>
              </div>
              <p class="text-gray-300">{{ (singleRequest.timeSlots || []).join(', ') }}</p>
            </div>
            
            <div v-if="singleRequest.revenueShare" class="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm rounded-xl p-4 border border-green-500/30 sm:col-span-2 lg:col-span-1">
              <div class="flex items-center gap-3 mb-2">
                <Icon name="heroicons:currency-dollar" class="w-5 h-5 text-green-400" />
                <span class="text-white font-medium">Compensation</span>
              </div>
              <p class="text-green-300 font-semibold">{{ singleRequest.revenueShare }}</p>
            </div>
          </div>
          
          <!-- Pilot Video -->
          <div v-if="singleRequest.pilotUrl" class="mb-6 sm:mb-8">
            <h3 class="text-white font-semibold mb-4 text-lg flex items-center gap-2">
              <Icon name="heroicons:play-circle" class="w-5 h-5 text-red-400" />
              Watch the Pilot
            </h3>
            <div class="bg-black/30 rounded-2xl overflow-hidden shadow-xl">
              <video :src="singleRequest.pilotUrl" controls class="w-full rounded-2xl"></video>
            </div>
          </div>
          
          <!-- Tags -->
          <div v-if="singleRequest.tags && singleRequest.tags.length" class="mb-6 sm:mb-8">
            <h3 class="text-white font-semibold mb-4 text-lg flex items-center gap-2">
              <Icon name="heroicons:tag" class="w-5 h-5 text-blue-400" />
              Project Tags
            </h3>
            <div class="flex flex-wrap gap-3">
              <span v-for="tag in singleRequest.tags" :key="tag" class="px-4 py-2 bg-white/10 backdrop-blur-sm text-white/90 rounded-full text-sm font-medium border border-white/20 hover:bg-white/20 transition-all duration-200">
                {{ tag }}
              </span>
            </div>
          </div>

          <!-- Call to Action Section -->
          <div class="bg-gradient-to-r from-teal-500/20 via-blue-500/20 to-purple-500/20 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-white/20 text-center">
            <h3 class="text-white text-xl sm:text-2xl font-bold mb-4">Ready to Join This Project?</h3>
            <p class="text-gray-200 text-base sm:text-lg mb-6">This could be your next big opportunity. Apply now and let's create something amazing together!</p>
            
            <!-- Apply Button for Talent -->
            <button 
              @click="showApplicationModal = true"
              class="w-full sm:w-auto px-8 sm:px-12 py-4 sm:py-5 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-3 mx-auto text-lg sm:text-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              <Icon name="heroicons:user-plus" class="w-5 h-5 sm:w-6 sm:h-6" />
              Apply to Collaborate
            </button>
            
            <p class="text-gray-300 text-sm mt-4">Quick application process • No commitment required</p>
          </div>

          <!-- Share Button for Owners -->
          <div v-if="isOwner" class="mt-6 sm:mt-8 text-center">
            <button 
              @click="copyShareLink"
              class="w-full sm:w-auto px-6 py-3 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-300 flex items-center justify-center gap-2 mx-auto text-sm font-medium"
            >
              <Icon name="heroicons:link" class="w-4 h-4" />
              Copy Share Link
            </button>
          </div>

          <!-- View Channel Button for Unauthenticated Users -->
          <div v-else-if="!authStore.user" class="mt-6 sm:mt-8 text-center">
            <button 
              @click="viewChannel"
              class="w-full sm:w-auto px-6 py-3 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-300 flex items-center justify-center gap-2 mx-auto text-sm font-medium"
            >
              <Icon name="heroicons:eye" class="w-4 h-4" />
              View {{ channel }}
            </button>
          </div>
        </div>

      <!-- No Request Data Available (only show when loading is complete and no data found) -->
      <div v-else-if="showSingle && !singleRequest && !isLoading" class="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 backdrop-blur-sm border border-yellow-500/30 rounded-2xl p-8 text-center shadow-xl">
        <Icon name="heroicons:exclamation-triangle" class="w-20 h-20 text-yellow-400 mx-auto mb-6" />
        <h3 class="text-yellow-200 text-2xl mb-4 font-bold">Request Not Available</h3>
        <p class="text-gray-300 mb-8 text-lg">This talent request could not be found or is not available for public viewing.</p>
        
        <!-- View Channel Button for Unauthenticated Users -->
        <div v-if="!authStore.user" class="text-center">
          <button 
            @click="viewChannel"
            class="px-8 py-4 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl hover:bg-blue-500/30 transition-all duration-300 font-medium"
          >
            <Icon name="heroicons:eye" class="w-5 h-5 inline mr-2" />
            View Channel
          </button>
        </div>
        
        <!-- Sign In Button for Unauthenticated Users -->
        <div v-if="!authStore.user" class="mt-6 text-center">
          <button 
            @click="signIn"
            class="px-8 py-4 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-xl hover:bg-teal-500/30 transition-all duration-300 font-medium"
          >
            <Icon name="heroicons:user" class="w-5 h-5 inline mr-2" />
            Sign In to View
          </button>
        </div>
      </div>

      <!-- Multiple Requests Grid View (when no rid) -->
      <div v-else class="space-y-6 sm:space-y-8">
        <!-- Header for Multiple Requests -->
        <div class="text-center mb-8">
          <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            Available Opportunities
          </h2>
          <p class="text-gray-300 text-lg sm:text-xl max-w-3xl mx-auto">
            Discover exciting projects and join our creative community. Each opportunity is waiting for someone like you!
          </p>
        </div>

        <div 
          v-for="request in filteredRequests" 
          :key="request.id"
          class="bg-gradient-to-br from-white/5 via-white/10 to-white/5 backdrop-blur-sm border border-white/20 rounded-2xl sm:rounded-3xl p-6 sm:p-8 hover:border-teal-500/40 hover:shadow-2xl transition-all duration-300 group cursor-pointer"
          @click="viewTalentRequest(request)"
        >
          <!-- Request Poster Image -->
          <div v-if="request.inspirationImage || request.channelPosterUrl" class="w-full aspect-[1200/420] bg-black/30 mb-6 rounded-2xl overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300">
            <img 
              :src="request.inspirationImage || request.channelPosterUrl" 
              alt="Request Poster" 
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
            />
          </div>
          
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div class="flex-1">
              <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                <h3 class="text-xl sm:text-2xl lg:text-3xl font-bold text-white group-hover:text-teal-300 transition-colors duration-200">
                  {{ request.projectTitle }}
                </h3>
                <div :class="getStatusBadgeClass(request.status)" class="px-4 py-2 rounded-full text-sm font-semibold w-fit shadow-lg">
                  {{ getStatusText(request.status) }}
                </div>
              </div>
              <p class="text-gray-300 mb-4 text-base sm:text-lg leading-relaxed">{{ request.castingNeeds }}</p>
              
              <!-- Project Highlights -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div class="flex items-center gap-2 text-gray-400">
                  <Icon name="heroicons:calendar" class="w-4 h-4 text-blue-400" />
                  <span class="text-sm">{{ formatDate(request.startDate) }}</span>
                </div>
                <div class="flex items-center gap-2 text-gray-400">
                  <Icon name="heroicons:clock" class="w-4 h-4 text-green-400" />
                  <span class="text-sm">{{ (request.timeSlots || []).length }} time slots</span>
                </div>
                <div class="flex items-center gap-2 text-gray-400">
                  <Icon name="heroicons:map-pin" class="w-4 h-4 text-red-400" />
                  <span class="text-sm">{{ request.location }}</span>
                </div>
                <div v-if="request.applications && (request.applications || []).length > 0" class="flex items-center gap-2 text-gray-400">
                  <Icon name="heroicons:users" class="w-4 h-4 text-purple-400" />
                  <span class="text-sm">{{ request.applications.length }} applicants</span>
                </div>
              </div>

              <!-- Project Tags -->
              <div v-if="request.tags && request.tags.length" class="flex flex-wrap gap-2 mb-4">
                <span v-for="tag in request.tags.slice(0, 4)" :key="tag" class="px-3 py-1 bg-white/10 backdrop-blur-sm text-white/80 rounded-full text-xs font-medium border border-white/20">
                  {{ tag }}
                </span>
                <span v-if="request.tags.length > 4" class="px-3 py-1 bg-white/10 backdrop-blur-sm text-white/60 rounded-full text-xs font-medium border border-white/20">
                  +{{ request.tags.length - 4 }} more
                </span>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-white/10">
            <button 
              @click.stop="viewTalentRequest(request)"
              class="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group-hover:shadow-lg transform group-hover:-translate-y-1"
            >
              <Icon name="heroicons:eye" class="w-4 h-4" />
              View Details
            </button>
            
            <button 
              v-if="isOwner"
              @click.stop="copyShareLink(request)"
              class="flex-1 sm:flex-none px-6 py-3 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Icon name="heroicons:link" class="w-4 h-4" />
              Share
            </button>
          </div>
        </div>

        <!-- Empty State for Multiple Requests -->
        <div v-if="filteredRequests.length === 0 && !isLoading" class="bg-gradient-to-r from-white/5 via-white/10 to-white/5 backdrop-blur-sm border border-white/20 rounded-2xl p-12 text-center shadow-xl">
          <div class="w-24 h-24 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:user-group" class="w-12 h-12 text-white" />
          </div>
          <h3 class="text-gray-200 text-2xl mb-4 font-bold">No Opportunities Available</h3>
          <p class="text-gray-400 text-lg mb-8">Currently there are no open talent requests for this channel. Check back later for new opportunities!</p>
          
          <!-- View Channel Button -->
          <div v-if="!authStore.user" class="text-center">
            <button 
              @click="viewChannel"
              class="px-8 py-4 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl hover:bg-blue-500/30 transition-all duration-300 font-medium"
            >
              <Icon name="heroicons:eye" class="w-5 h-5 inline mr-2" />
              View {{ channel }}
            </button>
          </div>
        </div>
      </div>

      <!-- Application Modal -->
      <div v-if="showApplicationModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-gray-900 border border-white/10 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div class="p-4 sm:p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-white">Apply to Collaborate</h3>
              <button @click="showApplicationModal = false" class="text-gray-400 hover:text-white">
                <Icon name="heroicons:x-mark" class="w-5 h-5" />
              </button>
            </div>
            
            <form @submit.prevent="submitApplication" class="space-y-4">
              <div>
                <label class="block text-gray-300 mb-2 text-sm">Full Name *</label>
                <input
                  v-model="application.fullName"
                  type="text"
                  required
                  class="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none text-sm"
                  placeholder="Your full name"
                />
              </div>
              
              <div>
                <label class="block text-gray-300 mb-2 text-sm">Contact Information *</label>
                <input
                  v-model="application.contactInfo"
                  type="text"
                  required
                  class="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none text-sm"
                  placeholder="Email, phone, or social media"
                />
              </div>
              
              <div>
                <label class="block text-gray-300 mb-2 text-sm">Interest in Project</label>
                <textarea
                  v-model="application.interest"
                  rows="3"
                  class="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none text-sm"
                  placeholder="Why are you interested in this project?"
                ></textarea>
              </div>
              
              <div>
                <label class="block text-gray-300 mb-2 text-sm">Relevant Experience</label>
                <textarea
                  v-model="application.experience"
                  rows="3"
                  class="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none text-sm"
                  placeholder="Describe your relevant experience"
                ></textarea>
              </div>
              
              <div class="flex gap-3 pt-4">
                <button
                  type="button"
                  @click="showApplicationModal = false"
                  class="flex-1 px-4 py-2 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg hover:bg-gray-500/30 transition-all duration-300 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  :disabled="isSubmitting"
                  class="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all duration-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon v-if="isSubmitting" name="heroicons:arrow-path" class="w-4 h-4 animate-spin mr-2" />
                  {{ isSubmitting ? 'Submitting...' : 'Submit Application' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Share Link Modal -->
      <div v-if="showShareModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-gray-900 border border-white/10 rounded-2xl max-w-md w-full">
          <div class="p-4 sm:p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-white">Share Talent Request</h3>
              <button @click="showShareModal = false" class="text-gray-400 hover:text-white">
                <Icon name="heroicons:x-mark" class="w-5 h-5" />
              </button>
            </div>
            
            <div class="space-y-4">
              <p class="text-gray-300 text-sm">Share this link with potential talent:</p>
              <div class="bg-black/20 rounded-lg p-4 border border-teal-500/30">
                <p class="text-gray-300 text-sm mb-2">Share Link:</p>
                <div class="flex items-center gap-2">
                  <input
                    :value="shareableLink"
                    readonly
                    class="flex-1 bg-black/20 border border-teal-500/30 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <button
                    @click="copyShareLinkToClipboard"
                    class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 
                           rounded-lg hover:bg-teal-500/30 transition-all duration-300"
                    :class="{ 'bg-green-500/20 text-green-300 border-green-500/30': linkCopied }"
                  >
                    <Icon 
                      :name="linkCopied ? 'heroicons:check' : 'heroicons:clipboard'" 
                      class="w-4 h-4" 
                    />
                  </button>
                </div>
              </div>
              
              <div class="flex gap-2">
                <button
                  @click="generateNewLink"
                  class="flex-1 px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 
                         rounded-lg hover:bg-teal-500/30 transition-all duration-300"
                >
                  Generate New Link
                </button>
                <button
                  @click="clearShareLink"
                  class="px-4 py-2 bg-gray-500/20 text-gray-300 border border-gray-500/30 
                         rounded-lg hover:bg-gray-500/30 transition-all duration-300"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
      </div> <!-- Close main content div -->
  </div>
</template>

<script setup>
import { useTalentRequestsStore } from '@/stores/talentRequests'
import { useAuthStore } from '@/stores/auth'
import { useFileStore } from '@/stores/useFileStore'


// Route parameters - handle both old and new URL structures
const route = useRoute()
const slugArray = computed(() => route.params.slug || [])

// Extract parameters from slug array (same structure as menu/share URLs)
const creatorUsername = computed(() => {
  if (slugArray.value.length >= 1) {
    return slugArray.value[0]
  }
  return null
})

const channelId = computed(() => {
  if (slugArray.value.length >= 2) {
    return slugArray.value[1]
  }
  return null
})

// Extract poster URL from slug if present (for new URL structure)
const posterUrlFromSlug = computed(() => {
  if (slugArray.value.length >= 3) {
    let posterPath = slugArray.value[2]
    
    // If the poster path contains a full URL, extract just the path part
    if (posterPath.includes('http')) {
      try {
        const url = new URL(posterPath)
        posterPath = url.pathname
      } catch (e) {
        console.warn('Could not parse poster URL, using as-is:', posterPath)
      }
    }
    
    // Decode the poster path
    posterPath = decodeURIComponent(posterPath)
    console.log('Decoded poster path from slug:', posterPath)
    
    // Keep the 'public' prefix - it's required for the image to load
    if (!posterPath.includes('public/') && posterPath.includes('series-posters/')) {
      posterPath = posterPath.replace('series-posters/', 'public/series-posters/')
      console.log('Added /public/ prefix to poster path:', posterPath)
    }
    
    // Build the full poster URL
    const fullPosterUrl = `https://d3hv50jkrzkiyh.cloudfront.net/${posterPath}`
    console.log('Full poster URL from slug:', fullPosterUrl)
    
    return fullPosterUrl
  }
  return null
})

// Twilly channel icons mapping (EXACT same as [channel].vue)
const TWILLY_CHANNEL_ICONS = {
  'twilly': '/assets/channels/icon-512.png',
  'twilly-after-dark': '/assets/channels/icon-512.png',
  'twilly-fit': '/assets/channels/twilly-fit-icon.png',
  'twilly-game-zone': '/assets/channels/twilly-game-zone-icon.png',
  'twilly-music-stream': '/assets/channels/twilly-music-stream-icon.png',
  'twilly-tech-stream': '/assets/channels/twilly-tech-stream-icon.png'
};

// Fetch channel poster server-side (same as channel page)
let channelPosterData = null;
try {
  channelPosterData = await $fetch('/api/creators/get-share-params', {
    method: 'POST',
    body: { 
      username: creatorUsername.value, 
      series: channelId.value 
    }
  });
  console.log('Server-side channel poster data:', channelPosterData);
} catch (e) {
  console.error('Server-side get-share-params failed:', e);
}

// Fetch talent request data server-side (like channel page)
let talentRequestData = null;
if (route.query.rid) {
  try {
    talentRequestData = await $fetch('/api/talent-requests/get-by-id', {
      method: 'POST',
      body: { requestId: route.query.rid }
    });
    console.log('Server-side talent request data:', talentRequestData);
  } catch (e) {
    console.error('Server-side get-by-id failed:', e);
  }
}

// Store and auth
const talentRequestsStore = useTalentRequestsStore()
const authStore = useAuthStore()
const fileStore = useFileStore()

// Reactive state
const showApplicationModal = ref(false)
const showShareModal = ref(false)
const isSubmitting = ref(false)
const shareableLink = ref('')
const linkCopied = ref(false)
const isLoading = ref(true)
const error = ref(null)
const application = ref({
  fullName: '',
  contactInfo: '',
  interest: '',
  experience: ''
 })

// Validation - ensure we have the minimum required parameters
const hasValidSlug = computed(() => {
  return slugArray.value.length >= 2 && creatorUsername.value && channelId.value
})

// Computed properties
const showSingle = computed(() => !!route.query.rid)
const singleRequest = computed(() => {
  if (!showSingle.value) return null
  const requestId = route.query.rid
  return talentRequestsStore.requests.find(r => r.id === requestId)
})

const filteredRequests = computed(() => {
  return talentRequestsStore.requests.filter(r => r.channel === channelId.value)
})

const channel = computed(() => channelId.value)

const displayedCreatorName = computed(() => {
  // Use the creator username from the route, not email
  return creatorUsername.value || 'Unknown Creator'
})

const channelPosterUrl = computed(() => {
  console.log('channelPosterUrl computed called, store poster URL:', talentRequestsStore.channelPosterUrl)
  
  // FIRST PRIORITY: Use the channel poster from the store (works for both authenticated and unauthenticated users)
  if (talentRequestsStore.channelPosterUrl) {
    console.log('Using store channel poster URL:', talentRequestsStore.channelPosterUrl)
    return talentRequestsStore.channelPosterUrl
  }
  
  // SECOND PRIORITY: For authenticated users, try to get from file store (existing logic)
  if (authStore.user?.attributes?.email) {
    try {
      // Get the folder data to find the poster URL from the file store
      const currentFolder = fileStore.folders?.find(f => f.name === channelId.value)
      if (currentFolder && currentFolder.seriesPosterUrl) {
        // Convert to public URL format (same as managefiles.vue)
        let posterUrl = currentFolder.seriesPosterUrl.replace('/series-posters/', '/public/series-posters/')
        // Fix CloudFront domain
        posterUrl = posterUrl.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net')
        console.log('Using file store poster URL:', posterUrl)
        return posterUrl
      }
    } catch (error) {
      console.log('No poster URL available for this channel')
    }
  }
  
  // THIRD PRIORITY: Fallback to request-specific poster if no channel poster found
  const firstRequest = filteredRequests.value[0]
  const fallbackUrl = firstRequest?.channelPosterUrl || ''
  console.log('Using fallback poster URL:', fallbackUrl)
  return fallbackUrl
})

const isOwner = computed(() => {
  return authStore.user?.attributes?.email === creatorUsername.value || 
         authStore.user?.attributes?.username === creatorUsername.value
})

// SEO - EXACT same pattern as working [channel].vue page
const title = talentRequestData?.request?.projectTitle 
  ? `${talentRequestData.request.projectTitle} - Talent Request`
  : `${channel.value} Talent Request - Twilly`

const description = talentRequestData?.request?.projectTitle
  ? `Submit your interest in collaborating on "${talentRequestData.request.projectTitle}" for ${channel.value}. ${talentRequestData.request.showConcept?.substring(0, 100)}...`
  : `View talent request for ${channel.value} by ${displayedCreatorName.value} on Twilly`

// For Twilly channels, use local assets so previews are reliable across platforms (EXACT same as [channel].vue)
const isTwillyChannel = computed(() => {
  const slug = (channelId.value || '').toLowerCase();
  console.log('Checking if Twilly channel:', { slug, availableKeys: Object.keys(TWILLY_CHANNEL_ICONS) });
  return Object.keys(TWILLY_CHANNEL_ICONS).includes(slug);
});

const heroImage = computed(() => {
  const slug = (channelId.value || '').toLowerCase();
  const iconPath = TWILLY_CHANNEL_ICONS[slug];
  console.log('Hero image computed:', { slug, iconPath, fallback: channelPosterData?.originalPosterUrl });
  return iconPath || channelPosterData?.originalPosterUrl || 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg';
});

const ogImage = computed(() => heroImage.value);

useHead({
  title,
  meta: [
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: ogImage.value },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: route.fullPath },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: ogImage.value }
  ],
  link: [{ rel: 'canonical', href: route.fullPath }]
});

// Methods
const goBackToProfile = () => {
  navigateTo('/profile')
}

const submitApplication = async () => {
  if (!singleRequest.value) return
  
  isSubmitting.value = true
  try {
    const result = await talentRequestsStore.submitApplication(singleRequest.value.id, application.value)
    if (result.success) {
      showApplicationModal.value = false
      application.value = { fullName: '', contactInfo: '', interest: '', experience: '' }
      // Show success message
      alert('Application submitted successfully! The creator will review your application and contact you soon.')
    } else {
      alert('Error submitting application: ' + (result.message || 'Unknown error'))
    }
  } catch (error) {
    console.error('Error submitting application:', error)
    alert('Error submitting application. Please try again.')
  } finally {
    isSubmitting.value = false
  }
}

// Share link functions - EXACT SAME LOGIC AS MANAGEFILES.VUE
const copyShareLink = async (request = null) => {
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
    // Always use production domain for share previews
    const baseShareDomain = 'https://twilly.app'
    const userId = authStore.user.attributes.email
    const seriesName = request?.channel || channelId.value || 'default'
    
    // Build CLEAN URL for sharing: /:username/:channelSlug (no params)
    const channelSlug = slugify(seriesName)
    let cleanUrl = `${baseShareDomain}/${encodeURIComponent(hasUsername)}/${encodeURIComponent(channelSlug)}`
    
    // If specific request, add query parameters
    if (request) {
      cleanUrl += `?rid=${request.id}&title=${encodeURIComponent(request.projectTitle)}&description=${encodeURIComponent(request.castingNeeds)}`
    }

    console.log('Creating CLEAN share URL (username + slug):', cleanUrl)
    shareableLink.value = cleanUrl
    showShareModal.value = true
  } catch (error) {
    console.error('Error generating share link:', error)
    alert('Error: ' + (error.message || 'Failed to generate share link'))
  }
}

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

const generateNewLink = () => {
  shareableLink.value = ''
  // Regenerate link for the current request or channel
  if (singleRequest.value) {
    copyShareLink(singleRequest.value)
  } else {
    copyShareLink()
  }
}

const clearShareLink = () => {
  shareableLink.value = ''
  showShareModal.value = false
}

// Utility functions
const getStatusBadgeClass = (status) => {
  const classes = {
    'accepting_pilots': 'bg-green-500/20 text-green-400 border border-green-500/30',
    'casting_closed': 'bg-red-500/20 text-red-400 border border-red-500/30',
    'scheduled': 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
  }
  return classes[status] || 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
}

const getStatusText = (status) => {
  const texts = {
    'accepting_pilots': 'Accepting Pilots',
    'casting_closed': 'Casting Closed',
    'scheduled': 'Scheduled'
  }
  return texts[status] || status
}

const getStreamTypeText = (streamType) => {
  const texts = {
    'Desktop': 'Desktop Only',
    'IRL': 'In-Person Only',
    'Hybrid': 'Desktop & IRL',
    'desktop': 'Desktop Only',
    'irl': 'In-Person Only',
    'hybrid': 'Desktop & IRL'
  }
  return texts[streamType] || streamType || 'Not specified'
}

const formatDate = (date) => {
  if (!date) return 'TBD'
  // Use consistent date formatting to avoid timezone issues
  // Convert to local date string in YYYY-MM-DD format first, then format for display
  const dateObj = new Date(date)
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  return `${month}/${day}/${year}`
}

const formatRelativeDate = (date) => {
  if (!date) return 'Unknown'
  const now = new Date()
  const requestDate = new Date(date)
  const diffTime = Math.abs(now - requestDate)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`
  return `${Math.ceil(diffDays / 365)} years ago`
}

const slugify = (text) => {
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

// Load data function
const loadData = async () => {
  try {
    isLoading.value = true
    error.value = null
    
    // Always try to load data, regardless of authentication
    if (authStore.user?.attributes?.email) {
      await talentRequestsStore.loadUserRequests(authStore.user.attributes.email)
      // Also load file store data to get channel poster
      await fileStore.getFiles(authStore.user.attributes.email)
      
      // If we have a specific request ID (rid), also fetch that individual request
      if (route.query.rid) {
        console.log('Loading specific individual request for authenticated user:', route.query.rid);
        try {
          const individualRequest = await talentRequestsStore.getRequestById(route.query.rid);
          if (individualRequest) {
            console.log('Individual request loaded for authenticated user:', individualRequest.projectTitle);
            // Add the individual request to the store if it's not already there
            const existingIndex = talentRequestsStore.requests.findIndex(r => r.id === route.query.rid);
            if (existingIndex === -1) {
              talentRequestsStore.requests.push(individualRequest);
              console.log('Added individual request to store for authenticated user');
            } else {
              talentRequestsStore.requests[existingIndex] = individualRequest;
              console.log('Updated existing request in store for authenticated user');
            }
          } else {
            console.log('Failed to load individual request for authenticated user');
          }
        } catch (error) {
          console.error('Error loading individual request for authenticated user:', error);
        }
      }
      
      // Ensure all requests have required properties to prevent template errors
      talentRequestsStore.requests.forEach(request => {
        if (!request.timeSlots) request.timeSlots = []
        if (!request.applications) request.applications = []
        if (!request.tags) request.tags = []
        if (!request.castingNeeds) request.castingNeeds = 'No casting needs specified'
        if (!request.location) request.location = 'Location not specified'
        if (!request.startDate) request.startDate = new Date().toISOString()
        if (!request.streamLength) request.streamLength = 'Duration not specified'
      })
    } else {
      // For unauthenticated users, load public data using the SAME API as the public channel page
      console.log('Loading public view for unauthenticated user')
      console.log('Using same API as public channel page: /api/creators/get-share-params')
      
      try {
        // Use the talent requests public API which also returns the channel poster URL
        await talentRequestsStore.loadPublicRequestsByChannel(creatorUsername.value, channelId.value)
        
        console.log('Talent requests loaded:', talentRequestsStore.requests.length);
        console.log('Channel poster URL from talent requests API:', talentRequestsStore.channelPosterUrl);
        
        // If no channel poster from talent requests API, try the creators API as fallback
        if (!talentRequestsStore.channelPosterUrl) {
          console.log('No channel poster from talent requests API, trying creators API...');
          try {
            const fetched = await $fetch('/api/creators/get-share-params', {
              method: 'POST',
              body: { 
                username: creatorUsername.value, 
                series: channelId.value 
              }
            });
            
            if (fetched?.originalPosterUrl) {
              talentRequestsStore.channelPosterUrl = fetched.originalPosterUrl;
              console.log('Channel poster URL from creators API fallback:', talentRequestsStore.channelPosterUrl);
            }
          } catch (fallbackError) {
            console.log('Creators API fallback failed:', fallbackError);
          }
        }
        
        // If we have a specific request ID (rid), also fetch that individual request
        if (route.query.rid) {
          console.log('Loading specific individual request:', route.query.rid);
          try {
            const individualRequest = await talentRequestsStore.getRequestById(route.query.rid);
            if (individualRequest) {
              console.log('Individual request loaded:', individualRequest.projectTitle);
              // Add the individual request to the store if it's not already there
              const existingIndex = talentRequestsStore.requests.findIndex(r => r.id === route.query.rid);
              if (existingIndex === -1) {
                talentRequestsStore.requests.push(individualRequest);
                console.log('Added individual request to store');
              } else {
                talentRequestsStore.requests[existingIndex] = individualRequest;
                console.log('Updated existing request in store');
              }
            } else {
              console.log('Failed to load individual request');
            }
          } catch (error) {
            console.error('Error loading individual request:', error);
          }
        }
        
        // Debug: Log what data was loaded
        console.log('Talent requests data loaded:', talentRequestsStore.requests.length)
        console.log('Channel poster URL from store:', talentRequestsStore.channelPosterUrl)
        
        // Ensure all requests have required properties to prevent template errors
        talentRequestsStore.requests.forEach(request => {
          if (!request.timeSlots) request.timeSlots = []
          if (!request.applications) request.applications = []
          if (!request.tags) request.tags = []
          if (!request.castingNeeds) request.castingNeeds = 'No casting needs specified'
          if (!request.location) request.location = 'Location not specified'
          if (!request.startDate) request.startDate = new Date().toISOString()
          if (!request.streamLength) request.streamLength = 'Duration not specified'
        })
      } catch (error) {
        console.error('Error loading public channel data:', error);
      }
    }
  } catch (err) {
    console.error('Error loading data:', err)
    error.value = 'Failed to load talent request data. Please try again.'
  } finally {
    isLoading.value = false
  }
}

// Retry loading
const retryLoad = () => {
  loadData()
}

// View channel function for unauthenticated users
const viewChannel = () => {
  // Navigate to the public channel page (like https://twilly.app/DehSin365/dark-knights-presents-vip-house-party)
  // This shows the channel overview, not the talent request page
  const url = `/${creatorUsername.value}/${channelId.value}`
  console.log('Navigating to public channel page:', url)
  
  if (typeof navigateTo === 'function') {
    navigateTo(url)
  } else {
    window.location.href = url
  }
}

// Sign in function for unauthenticated users
const signIn = () => {
  // Navigate to sign in page
  if (typeof navigateTo === 'function') {
    navigateTo('/auth/signin')
  } else {
    window.location.href = '/auth/signin'
  }
}

// View talent request function for unauthenticated users
const viewTalentRequest = (request) => {
  // Scroll to top before navigation
  if (process.client) {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
  
  const url = `/talent-request/${creatorUsername.value}/${channelId.value}?rid=${request.id}&title=${encodeURIComponent(request.projectTitle)}&description=${encodeURIComponent(request.castingNeeds)}`
  console.log('Navigating to talent request page:', url)
  if (typeof navigateTo === 'function') {
    navigateTo(url)
  } else {
    window.location.href = url
  }
}

// Scroll to top function
const scrollToTop = () => {
  if (process.client) {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
};

// Load data on mount
onMounted(async () => {
  // Scroll to top immediately when page loads
  scrollToTop();
  
  try {
    isLoading.value = true;
    error.value = null;
    
    // Check if we have a specific request ID
    const requestId = route.query.rid;
    if (requestId) {
      showSingle.value = true;
      await loadData(); // This will now load a single request
    } else {
      showSingle.value = false;
      await loadData(); // This will now load all requests for the channel
    }
  } catch (err) {
    console.error('Error loading talent request data:', err);
    error.value = 'Failed to load talent request data. Please try again.';
  } finally {
    isLoading.value = false;
    // Ensure scroll to top after loading
    setTimeout(scrollToTop, 100);
  }
});
</script>

<style scoped>
/* Enhanced mobile optimization and smooth animations */
.backdrop-blur-sm {
  backdrop-filter: blur(8px);
}

.backdrop-blur-md {
  backdrop-filter: blur(12px);
}

/* Smooth transitions for all interactive elements */
* {
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}

/* Enhanced hover effects */
.group:hover .group-hover\:text-teal-300 {
  color: rgb(94 234 212);
}

.group:hover .group-hover\:scale-105 {
  transform: scale(1.05);
}

.group:hover .group-hover\:-translate-y-1 {
  transform: translateY(-4px);
}

.group:hover .group-hover\:shadow-xl {
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
}

.group:hover .group-hover\:shadow-2xl {
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
}

/* Enhanced button hover effects */
button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1);
}

/* Smooth image hover effects */
img {
  transition: transform 0.3s ease-in-out;
}

/* Enhanced mobile responsiveness */
@media (max-width: 640px) {
  .text-7xl {
    font-size: 2.5rem;
    line-height: 1.2;
  }
  
  .text-6xl {
    font-size: 2rem;
    line-height: 1.3;
  }
  
  .text-5xl {
    font-size: 1.75rem;
    line-height: 1.4;
  }
  
  .text-4xl {
    font-size: 1.5rem;
    line-height: 1.5;
  }
  
  .text-3xl {
    font-size: 1.25rem;
    line-height: 1.6;
  }
  
  .text-2xl {
    font-size: 1.125rem;
    line-height: 1.7;
  }
  
  .text-xl {
    font-size: 1rem;
    line-height: 1.8;
  }
}

/* Enhanced loading animation */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Enhanced backdrop blur effects */
.backdrop-blur-sm {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.backdrop-blur-md {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Enhanced shadow effects */
.shadow-2xl {
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
}

.shadow-xl {
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Enhanced focus states for accessibility */
button:focus,
a:focus {
  outline: 2px solid rgb(94 234 212);
  outline-offset: 2px;
}

/* Enhanced mobile touch targets */
@media (max-width: 640px) {
  button,
  a {
    min-height: 44px;
    min-width: 44px;
  }
}

/* Enhanced gradient text */
.bg-gradient-to-r {
  background-image: linear-gradient(to right, var(--tw-gradient-stops));
}

/* Enhanced border radius for modern look */
.rounded-3xl {
  border-radius: 1.5rem;
}

.rounded-2xl {
  border-radius: 1rem;
}

.rounded-xl {
  border-radius: 0.75rem;
}

/* Enhanced spacing for mobile */
@media (max-width: 640px) {
  .p-12 {
    padding: 2rem;
  }
  
  .p-8 {
    padding: 1.5rem;
  }
  
  .p-6 {
    padding: 1.25rem;
  }
  
  .mb-12 {
    margin-bottom: 2rem;
  }
  
  .mb-8 {
    margin-bottom: 1.5rem;
  }
  
  .mb-6 {
    margin-bottom: 1.25rem;
  }
}
</style>

