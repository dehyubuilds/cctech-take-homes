<template>
  <div class="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] pt-16">
    <div class="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <!-- Header Section -->
      <div class="text-center mb-12">
        <div class="flex items-center justify-center mb-6">
          <div class="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center">
            <Icon name="heroicons:chat-bubble-left-right" class="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 class="text-3xl sm:text-4xl font-bold text-white mb-4">
          <span class="text-teal-400">Get in Touch</span> with Twilly
        </h1>
        <p class="text-gray-300 text-lg sm:text-xl max-w-2xl mx-auto">
          Share your contact information and we'll follow up with you about Twilly. We'd love to hear from you!
        </p>
      </div>

      <!-- Form Section -->
      <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
        <div class="flex items-center mb-8">
          <div class="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center mr-4">
            <Icon name="heroicons:document-text" class="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h2 class="text-2xl font-semibold text-white">Contact Form</h2>
            <p class="text-gray-400 text-sm">Tell us about yourself</p>
          </div>
        </div>
        
        <form @submit.prevent="submitApplication" class="space-y-6">
          <!-- Full Name -->
          <div>
            <label class="block text-gray-300 mb-3 font-medium">Full Name *</label>
            <input
              v-model="form.fullName"
              type="text"
              required
              placeholder="Enter your full name"
              class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300"
            />
          </div>

          <!-- Contact Information -->
          <div>
            <label class="block text-gray-300 mb-3 font-medium">Contact Information *</label>
            <input
              v-model="form.contactInfo"
              type="text"
              required
              placeholder="Email, phone, or social media handle"
              class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300"
            />
          </div>

          <!-- What Do You Do -->
          <div>
            <label class="block text-gray-300 mb-3 font-medium">What Do You Do? *</label>
            <textarea
              v-model="form.whatDoYouDo"
              required
              rows="4"
              placeholder="Tell us about your work, interests, or what brings you to Twilly..."
              class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none transition-all duration-300 resize-none"
            ></textarea>
          </div>

          <!-- Submit Button -->
          <div class="pt-6">
            <button
              type="submit"
              :disabled="isSubmitting"
              class="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
            >
              <div v-if="isSubmitting" class="flex items-center justify-center gap-3">
                <Icon name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
                Submitting...
              </div>
              <div v-else class="flex items-center justify-center gap-3">
                <Icon name="heroicons:paper-airplane" class="w-5 h-5" />
                Send Message
              </div>
            </button>
          </div>
        </form>
      </div>

      <!-- About Twilly Section -->
      <div class="mt-12 text-center">
        <h3 class="text-2xl font-semibold text-white mb-6">About Twilly</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
            <div class="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Icon name="heroicons:play" class="w-6 h-6 text-teal-400" />
            </div>
            <h4 class="text-lg font-semibold text-white mb-2">Premium Content</h4>
            <p class="text-gray-400 text-sm">Exclusive streaming channels with high-quality content</p>
          </div>
          
          <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
            <div class="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Icon name="heroicons:users" class="w-6 h-6 text-teal-400" />
            </div>
            <h4 class="text-lg font-semibold text-white mb-2">Creator Network</h4>
            <p class="text-gray-400 text-sm">Join our community of content creators and streamers</p>
          </div>
          
          <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
            <div class="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Icon name="heroicons:sparkles" class="w-6 h-6 text-teal-400" />
            </div>
            <h4 class="text-lg font-semibold text-white mb-2">Innovation</h4>
            <p class="text-gray-400 text-sm">Cutting-edge streaming technology and features</p>
          </div>
        </div>
      </div>

      <!-- Back to Home -->
      <div class="mt-12 text-center">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors"
        >
          <Icon name="heroicons:arrow-left" class="w-4 h-4" />
          Back to Home
        </NuxtLink>
      </div>
    </div>

    <!-- Success Modal -->
    <div v-if="showSuccessModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-black/90 backdrop-blur-sm border border-teal-500/30 rounded-2xl p-8 max-w-md w-full text-center">
        <div class="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="heroicons:check" class="w-8 h-8 text-green-400" />
        </div>
        <h3 class="text-2xl font-semibold text-white mb-4">Message Sent!</h3>
        <p class="text-gray-300 mb-6">Thank you for reaching out! We've received your message and will follow up with you soon about Twilly.</p>
        <button
          @click="showSuccessModal = false"
          class="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

// Form data
const form = ref({
  fullName: '',
  contactInfo: '',
  whatDoYouDo: ''
});

// Form state
const isSubmitting = ref(false);
const showSuccessModal = ref(false);

// Submit application
const submitApplication = async () => {
  if (isSubmitting.value) return;
  
  isSubmitting.value = true;
  
  try {
    // Validate required fields
    if (!form.value.fullName || !form.value.contactInfo || !form.value.whatDoYouDo) {
      throw new Error('Please fill in all required fields');
    }
    
    // Submit to API
    const response = await $fetch('/api/collaborations/submit-application', {
      method: 'POST',
      body: {
        ...form.value,
        submittedAt: new Date().toISOString(),
        source: 'homepage-qr'
      }
    });
    
    if (response.success) {
      // Show success modal
      showSuccessModal.value = true;
      
      // Reset form
      form.value = {
        fullName: '',
        contactInfo: '',
        whatDoYouDo: ''
      };
    } else {
      throw new Error(response.message || 'Failed to submit application');
    }
  } catch (error) {
    console.error('Error submitting application:', error);
    alert('Error: ' + (error.message || 'Failed to submit application. Please try again.'));
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
/* Custom checkbox styling */
input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 1.2rem;
  height: 1.2rem;
  border: 2px solid #14b8a6;
  border-radius: 0.25rem;
  background-color: rgba(0, 0, 0, 0.5);
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

input[type="checkbox"]:checked {
  background-color: #14b8a6;
  border-color: #14b8a6;
}

input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 0.75rem;
  font-weight: bold;
}

input[type="checkbox"]:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.3);
}
</style>
