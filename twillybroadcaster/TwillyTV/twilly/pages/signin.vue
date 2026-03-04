<script setup>
import { Auth } from "aws-amplify";
import { Authenticator } from "@aws-amplify/ui-vue";
import "@aws-amplify/ui-vue/styles.css";
import { useAuthStore } from "../stores/auth";
import { useRoute } from 'vue-router';
import awsExports from '~/aws-exports';

// Log the configuration being used
console.log('Creator Flow - Using configuration:', {
  userPoolId: awsExports.userPoolId,
  userPoolWebClientId: awsExports.userPoolWebClientId,
  authenticationFlowType: awsExports.authenticationFlowType,
  source: 'aws-exports.js'
});

// Configure Amplify with general settings
Auth.configure({
  ...awsExports,
  // Configure to use email as username
  usernameAttributes: ['email']
});

const title = ref("Twilly - A social streaming network");
const description = ref("Sign in to access your Twilly subscription and stream premium content across all channels");
const user = ref(null);
const authStore = useAuthStore();
const route = useRoute();
const isLoading = ref(false);

// Add reactive variables for custom confirmation
const confirmEmail = ref('');
const confirmCode = ref('');

// Custom confirmation handler
const handleCustomConfirmSignUp = async () => {
  try {
    isLoading.value = true;
    
    if (!confirmEmail.value || !confirmCode.value) {
      throw new Error('Email and verification code are required');
    }
    
    // Confirm the signup - trim whitespace from confirmation code
    await Auth.confirmSignUp(confirmEmail.value.toLowerCase(), confirmCode.value.trim());
    
    // Get the stored password
    let password = null;
    if (process.client) {
      password = sessionStorage.getItem('tempPassword');
    }
    
    // After successful confirmation, sign in the user and redirect to profile
    if (password) {
      const user = await Auth.signIn({
        username: confirmEmail.value.toLowerCase(),
        password: password
      });
      
      // Log in the user and redirect to profile
      await authStore.loggedIn(user, 'regular');
      
      // Check for pending affiliate invite
      if (process.client) {
        const pendingAffiliateInvite = sessionStorage.getItem('pendingAffiliateInvite');
        if (pendingAffiliateInvite) {
          try {
            const inviteData = JSON.parse(pendingAffiliateInvite);
            console.log('Processing pending affiliate invite:', inviteData);
            
            // Store the invite data for the profile page to handle
            sessionStorage.setItem('pendingAffiliateInvite', pendingAffiliateInvite);
            
            // Clear temporary storage
            sessionStorage.removeItem('tempPassword');
            sessionStorage.removeItem('tempEmail');
            
            // Redirect to profile with affiliate invite flag
            await navigateTo('/profile?affiliateInvite=true');
            return;
          } catch (error) {
            console.error('Error parsing pending affiliate invite:', error);
          }
        }
        
        // Check for pending collaborator invite
        const pendingCollaboratorInvite = sessionStorage.getItem('pendingCollaboratorInvite');
        if (pendingCollaboratorInvite) {
          try {
            const inviteData = JSON.parse(pendingCollaboratorInvite);
            console.log('Processing pending collaborator invite:', inviteData);
            
            // Store the invite data for the profile page to handle
            sessionStorage.setItem('pendingCollaboratorInvite', pendingCollaboratorInvite);
            
            // Clear temporary storage
            sessionStorage.removeItem('tempPassword');
            sessionStorage.removeItem('tempEmail');
            
            // Redirect to profile with collaborator invite flag
            await navigateTo('/profile?collaboratorInvite=true');
            return;
          } catch (error) {
            console.error('Error parsing pending collaborator invite:', error);
          }
        }
        
        
        // Clear temporary storage
        sessionStorage.removeItem('tempPassword');
        sessionStorage.removeItem('tempEmail');
      }
      
      await navigateTo('/profile');
    }
    
  } catch (error) {
    console.error('Custom confirm sign up error:', error);
    alert('Error confirming sign up: ' + error.message);
  } finally {
    isLoading.value = false;
  }
};

// Add this to check authentication status and redirect if needed
onMounted(async () => {
  try {
    // CRITICAL FIX: Don't show loading overlay on mount - only show when actually signing in
    // This prevents flickering when user is already authenticated
    const user = await Auth.currentAuthenticatedUser();
    if (user) {
      // Check for pending affiliate invite first
      if (process.client) {
        const pendingAffiliateInvite = sessionStorage.getItem('pendingAffiliateInvite');
        if (pendingAffiliateInvite) {
          try {
            const inviteData = JSON.parse(pendingAffiliateInvite);
            console.log('Processing pending affiliate invite on signin:', inviteData);
            
            // Log in the user first
            await authStore.loggedIn(user, 'regular');
            
            // Auto-activate affiliate persona with the invite code
            if (inviteData.inviteCode) {
              try {
                const result = await authStore.activateAffiliatePersona(inviteData.inviteCode);
                if (result.success) {
                  alert('Welcome! Your affiliate account has been activated. You can now invite collaborators to Twilly TV and Twilly After Dark.');
                  // Clear the pending invite
                  sessionStorage.removeItem('pendingAffiliateInvite');
                  // Redirect to profile
                  await navigateTo('/profile');
                  return;
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
        
        // Check for pending collaborator invite
        const pendingCollaboratorInvite = sessionStorage.getItem('pendingCollaboratorInvite');
        if (pendingCollaboratorInvite) {
          try {
            const inviteData = JSON.parse(pendingCollaboratorInvite);
            console.log('Processing pending collaborator invite on signin:', inviteData);
            
            // Log in the user first
            await authStore.loggedIn(user, 'regular');
            
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
                    userId: user.attributes.sub,
                    userEmail: user.attributes.email
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
                  // Redirect to profile
                  await navigateTo('/profile');
                  return;
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
      
      // Check for return URL from query params first
      const returnUrl = route.query.returnUrl;
      const isSubscription = route.query.subscription;
      console.log('Signin page - Received returnUrl:', returnUrl);
      console.log('Signin page - subscription:', isSubscription);
      console.log('Signin page - route.query:', route.query);
      
      if (returnUrl) {
        // If there's a return URL, just log in without setting user type
        await authStore.loggedIn(user);
        // Use the return URL as-is to preserve exact encoding
        console.log('Return URL (onMounted):', returnUrl);
        
        // Convert localhost URLs to current domain
        let processedReturnUrl = returnUrl;
        if (returnUrl.includes('localhost:3000')) {
          processedReturnUrl = returnUrl.replace('http://localhost:3000', window.location.origin);
          console.log('Converted returnUrl from localhost to:', processedReturnUrl);
        }
        
        // Add a small delay to ensure auth state is fully updated
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if it's a relative URL (starts with /)
        if (processedReturnUrl.startsWith('/') || processedReturnUrl.startsWith('http://localhost') || processedReturnUrl.startsWith('https://localhost') || processedReturnUrl.startsWith(window.location.origin)) {
          // Use window.location.href to preserve exact URL encoding
          console.log('Redirecting to (onMounted):', processedReturnUrl);
          window.location.href = processedReturnUrl;
        } else {
          // If it's external, use external navigation
          await navigateTo(processedReturnUrl, { external: true });
        }
      } else if (isSubscription) {
        // If this is a subscription flow, log in and redirect to profile
        await authStore.loggedIn(user, 'regular');
        await navigateTo('/profile');
      } else {
        // Set user type to regular since we're in the general signin route
        await authStore.loggedIn(user, 'regular');
        // User is already authenticated, redirect to profile
        await navigateTo('/profile');
      }
    }
  } catch (error) {
    // User is not authenticated, continue showing signin page
    console.log('User not authenticated');
  } finally {
    isLoading.value = false;
  }
  
  // Replace "Enter your username" with "Enter your Email" for both sign-in and create account
  const replaceUsernameText = () => {
    if (process.client) {
      // Find and replace any text that contains "Enter your username"
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.includes('Enter your username')) {
          node.textContent = node.textContent.replace('Enter your username', 'Enter your Email');
        }
        if (node.textContent.includes('Username')) {
          node.textContent = node.textContent.replace('Username', 'Email');
        }
        // Also replace any "Preferred Username" with "Preferred Email" for create account
        if (node.textContent.includes('Preferred Username')) {
          node.textContent = node.textContent.replace('Preferred Username', 'Preferred Email');
        }
        if (node.textContent.includes('Enter your Preferred Username')) {
          node.textContent = node.textContent.replace('Enter your Preferred Username', 'Enter your Preferred Email');
        }
        
        // Replace input placeholder text
        const inputs = document.querySelectorAll('input[placeholder*="username"], input[placeholder*="Username"]');
        inputs.forEach(input => {
          if (input.placeholder.includes('username') || input.placeholder.includes('Username')) {
            input.placeholder = input.placeholder.replace(/username/i, 'email');
          }
        });
      }
    }
  };
  
  // Run immediately and then periodically to catch re-renders
  setTimeout(replaceUsernameText, 1000);
  setInterval(replaceUsernameText, 1000);
});

const services = {
  async handleSignUp(formData) {
    try {
      isLoading.value = true;
      
      // Handle different possible field names from Amplify
      let email = formData.email || formData.username || formData['email'] || formData['username'];
      let password = formData.password || formData['password'];
      let confirm_password = formData.confirm_password || formData['confirm_password'];
      
      if (!email) {
        throw new Error('Email is required');
      }
      
      if (!password) {
        throw new Error('Password is required');
      }
      
      email = email.toLowerCase();
      
      // Sign up with email as username and include email attribute
      const signUpResult = await Auth.signUp({
        username: email,
        password,
        attributes: {
          email: email
        },
        // Custom validation data
        validationData: {
          'custom:source': 'twilly-web'
        }
      });
      
      // Store the password temporarily for confirmation
      if (process.client) {
        sessionStorage.setItem('tempPassword', password);
        sessionStorage.setItem('tempEmail', email);
        // Set the confirm email for the custom form
        confirmEmail.value = email;
      }
      
      return signUpResult;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  },
  
  async handleConfirmSignUp(formData) {
    try {
      isLoading.value = true;
      
      // Handle different possible field names from Amplify
      let email = formData.email || formData.username || formData['email'] || formData['username'];
      let confirmation_code = formData.confirmation_code || formData['confirmation_code'] || formData.code || formData['code'];
      
      if (!email || !confirmation_code) {
        throw new Error('Email and confirmation code are required');
      }
      
      // Confirm the signup - trim whitespace from confirmation code
      await Auth.confirmSignUp(email.toLowerCase(), confirmation_code.trim());
      
      // Get the stored password and email
      let password = null;
      if (process.client) {
        password = sessionStorage.getItem('tempPassword');
        email = sessionStorage.getItem('tempEmail') || email;
      }
      
      // After successful confirmation, sign in the user and redirect to profile
      if (password) {
        const user = await Auth.signIn({
          username: email.toLowerCase(),
          password: password
        });
        
        // Log in the user and redirect to profile
        await authStore.loggedIn(user, 'regular');
        
        // Clear temporary storage
        if (process.client) {
          sessionStorage.removeItem('tempPassword');
          sessionStorage.removeItem('tempEmail');
        }
        
        // Redirect to profile
        await navigateTo('/profile');
      }
      
    } catch (error) {
      console.error('Confirm sign up error:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  },
  
  async handleSignIn(formData) {
    try {
      isLoading.value = true;
      
      // Handle different possible field names from Amplify
      let email = formData.email || formData.username || formData['email'] || formData['username'];
      let password = formData.password || formData['password'];
      
      // Handle case where email might be undefined
      if (!email) {
        throw new Error('Email is required');
      }
      
      // Handle case where password might be undefined
      if (!password) {
        throw new Error('Password is required');
      }
      
      email = email.toLowerCase();
      
      const user = await Auth.signIn({
        username: email,
        password,
      });
      
      // Check for return URL from query params first
      const returnUrl = route.query.returnUrl;
      const isSubscription = route.query.subscription;
      console.log('🔍 SIGNIN: returnUrl from route.query:', returnUrl);
      console.log('🔍 SIGNIN: isSubscription:', isSubscription);
      console.log('🔍 SIGNIN: route.query:', route.query);
      
      if (returnUrl) {
        console.log('🔍 SIGNIN: Processing returnUrl:', returnUrl);
        // If there's a return URL, just log in without setting user type
        await authStore.loggedIn(user);
        
        // Convert localhost URLs to current domain
        let processedReturnUrl = returnUrl;
        if (returnUrl.includes('localhost:3000')) {
          processedReturnUrl = returnUrl.replace('http://localhost:3000', window.location.origin);
          console.log('🔍 SIGNIN: Converted returnUrl from localhost to:', processedReturnUrl);
        }
        
        // Add a small delay to ensure auth state is fully updated
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if it's a relative URL (starts with /)
        if (processedReturnUrl.startsWith('/') || processedReturnUrl.startsWith('http://localhost') || processedReturnUrl.startsWith('https://localhost') || processedReturnUrl.startsWith(window.location.origin)) {
          // Use window.location.href to preserve exact URL encoding
          console.log('🔍 SIGNIN: Redirecting to:', processedReturnUrl);
          window.location.href = processedReturnUrl;
        } else {
          // If it's external, use external navigation
          console.log('🔍 SIGNIN: External redirect to:', processedReturnUrl);
          await navigateTo(processedReturnUrl, { external: true });
        }
      } else if (isSubscription) {
        // If this is a subscription flow, log in and redirect to profile
        console.log('🔍 SIGNIN: Subscription flow, redirecting to profile');
        await authStore.loggedIn(user, 'regular');
        await navigateTo('/profile');
      } else {
        // Pass the user type explicitly for general flow
        console.log('🔍 SIGNIN: No returnUrl, default redirect to profile');
        await authStore.loggedIn(user, 'regular');
        // Default redirect to profile with smooth transition
        await navigateTo("/profile", { replace: true });
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black flex items-center justify-center p-4">
    <!-- Loading overlay for smooth transition -->
    <div v-if="isLoading" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400 mb-4"></div>
        <p class="text-white text-lg">Signing you in...</p>
      </div>
    </div>
    
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <h1 class="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight tracking-tight">
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-500 drop-shadow-2xl">Twilly</span>
        </h1>
        <h2 class="text-base sm:text-lg font-bold text-teal-400 mb-3 tracking-wide uppercase">
          A social streaming network
        </h2>
        <p class="text-sm sm:text-base text-gray-300 mt-4 max-w-sm mx-auto leading-relaxed">
          {{ route.query.subscription ? 'Sign in to complete your purchase' : (route.query.returnUrl ? 'Sign in to continue' : 'Sign in to access free and pay-per-view content') }}
        </p>
      </div>

      <!-- AWS Amplify Authenticator -->
      <div class="bg-black/40 backdrop-blur-sm rounded-xl p-6 sm:p-8 border border-teal-900/30 shadow-2xl">
        <Authenticator
          :services="services"
          :initial-state="'signIn'"
        >
          <template v-slot="{ user, signOut }">
            <div>
              <h2>Hello {{ user.username }}</h2>
              <button @click="signOut">Sign Out</button>
            </div>
          </template>
          
          <!-- Custom confirmation template -->
          <template v-slot:confirm-sign-up="{ signUp, confirmSignUp, resendCode, isPending }">
            <div class="space-y-4">
              <h2 class="text-xl font-semibold text-white">Confirm your email</h2>
              <p class="text-gray-300 text-sm">Enter the verification code sent to your email</p>
              
              <form @submit.prevent="handleCustomConfirmSignUp">
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Email</label>
                    <input 
                      v-model="confirmEmail" 
                      type="email" 
                      class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-teal-400 focus:outline-none"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Verification Code</label>
                    <input 
                      v-model="confirmCode" 
                      type="text" 
                      class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-teal-400 focus:outline-none"
                      placeholder="Enter verification code"
                      required
                    />
                  </div>
                  
                  <button 
                    type="submit"
                    :disabled="isPending"
                    class="w-full px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ isPending ? 'Confirming...' : 'Confirm Sign Up' }}
                  </button>
                </div>
              </form>
              
              <button 
                @click="resendCode"
                class="w-full px-4 py-2 bg-transparent text-teal-400 border border-teal-400 rounded-lg hover:bg-teal-400/10"
              >
                Resend Code
              </button>
            </div>
          </template>
          

        </Authenticator>
      </div>
    </div>

  </div>
</template>

<style>
/* Amplify theme customization */
:root {
  --amplify-colors-background-primary: #1f2937;
  --amplify-colors-background-secondary: #111827;
  --amplify-colors-background-tertiary: #374151;
  --amplify-colors-border-primary: #4b5563;
  --amplify-colors-border-secondary: #6b7280;
  --amplify-colors-border-focus: #14b8a6;
  --amplify-colors-font-primary: #ffffff;
  --amplify-colors-font-secondary: #9ca3af;
  --amplify-colors-font-interactive: #14b8a6;
  --amplify-colors-brand-primary: #14b8a6;
  --amplify-colors-brand-secondary: #0d9488;
  --amplify-components-button-primary-background-color: #14b8a6;
  --amplify-components-button-primary-hover-background-color: #0d9488;
  --amplify-components-button-primary-focus-background-color: #0f766e;
  --amplify-components-button-primary-active-background-color: #0f766e;
  --amplify-components-button-primary-disabled-background-color: #374151;
  --amplify-components-fieldcontrol-border-color: #4b5563;
  --amplify-components-fieldcontrol-focus-border-color: #14b8a6;
  --amplify-components-fieldcontrol-focus-box-shadow: 0 0 0 2px rgba(20, 184, 166, 0.2);
  --amplify-components-tabs-item-active-color: #14b8a6;
  --amplify-components-tabs-item-active-border-color: #14b8a6;
  --amplify-components-tabs-item-hover-color: #0d9488;
  --amplify-components-tabs-item-color: #9ca3af;
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

/* Override Amplify text to show Email instead of Username */
[data-amplify-authenticator] label[for="username"],
[data-amplify-authenticator] label:contains("Username"),
[data-amplify-authenticator] [data-amplify-label] {
  display: none !important;
}

[data-amplify-authenticator] label[for="username"]::before,
[data-amplify-authenticator] label:contains("Username")::before {
  content: "Email" !important;
  display: inline !important;
}

/* Make verification code messages white */
[data-amplify-authenticator] div[data-amplify-text],
[data-amplify-authenticator] p,
[data-amplify-authenticator] span {
  color: white !important;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .max-w-md {
    width: 100%;
    padding: 0 1rem;
  }
  
  /* Ensure buttons are touch-friendly */
  button {
    min-height: 44px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  
  /* Better text readability on mobile */
  h1, h2, h3 {
    word-wrap: break-word;
    hyphens: auto;
    line-height: 1.2;
  }
  
  /* Improve backdrop blur for mobile performance */
  .backdrop-blur-sm {
    backdrop-filter: blur(4px);
  }
  
  /* Better touch feedback */
  .touch-manipulation {
    touch-action: manipulation;
  }
  
  /* Optimize for mobile browsers */
  input, textarea, select {
    font-size: 16px;
  }
  
  /* Better viewport handling */
  .min-h-screen {
    min-height: 100dvh;
  }
}
</style> 