<script setup>
import { Auth } from "aws-amplify";
import { useAuthStore } from "~/stores/auth";
import { useUserStore } from "~/stores/userStore";

const user = ref(null);
const defaultMessage = 'Welcome to Twilly🦋';
const authStore = useAuthStore();
const showUnverifiedMessage = ref(null);
const userStore = useUserStore();
const websocketStore = useWebSocketStore();
const scrollMessage = computed(() => {
  const messages = websocketStore.receivedMessages;
  return (messages && messages.length > 0) 
    ? messages[messages.length - 1] 
    : defaultMessage; // Use default message if no messages are present
});

const avatarImageSource = computed(() => {
  const userData = userStore.userData;
  return userData && userData.avatarUrl
    ? "https://theprivatecollection.s3.us-east-2.amazonaws.com/blank-profile-picture.jpg"
    : "https://theprivatecollection.s3.us-east-2.amazonaws.com/blank-profile-picture.jpg";
});

const verifyLoggedIn = async () => {
  try {
    user.value = await Auth.currentAuthenticatedUser();
  } catch (error) {
    const currentRoute = window.location.pathname;
    if (currentRoute.startsWith("/channel")|| currentRoute.startsWith("/addcustomurl")) {
      await authStore.loggedOut();
      return;
    } else {
      console.error("Error verifying login:", error);
      navigateTo("signin");
    }
  }
};

onMounted(async () => {
  console.log('CollabNavBar loaded')
  // verifyLoggedIn();
  await authStore.loggedIn();
  const authenticatedUser = await Auth.currentAuthenticatedUser();
  const schedulerId = authenticatedUser ? authenticatedUser.username : null;

  await userStore.getFormData(schedulerId);
  showUnverifiedMessage.value = useUserStore().getUserPhoneNumber();
  try {
    showUnverifiedMessage.value = showUnverifiedMessage.value === "Unverified";
  } catch (error) {
    showUnverifiedMessage.value = false;
  }
});

const navigateToProfile = () => {
  navigateTo("/profile");
};

const logout = async () => {
  try {
    await Auth.signOut();
    await authStore.loggedOut();
    console.log('Logout successful - forcing page reload');
    // Force a full page reload to ensure proper rendering on mobile
    if (process.client) {
      window.location.href = '/';
    }
  } catch (error) {
    console.error("Error in signOut:", error);
  }
};
</script>

<template>
  <header
    class="sticky top-0 z-50 flex justify-between items-center p-4 shadow-md tv-banner"
  >
    <!-- <button
      v-if="authStore.authenticated"
      @click="navigateToProfile"
      class="transform rounded bg-gradient-to-br py-2 px-3 font-semibold text-white transition hover:scale-110 z-10"
    >
      +Menu
    </button> -->
    
    
    <!-- <nuxt-link
      v-else
      :to="'/profile'"
      class="text-3xl font-mono tv-link"
    >
      <Icon class="header__menu--faq-icon" name="grommet-icons:channel" />
    </nuxt-link> -->
    <div class="status-messages-container">
      <p class="scrolling-text">{{ scrollMessage }}</p>
    </div>

    <!-- <div v-if="authStore.authenticated" class="flex items-center">
      <p v-if="showUnverifiedMessage" class="error-message">
        <a href="/login"> Register number to get started</a>
      </p> -->

      <!-- <NuxtLink
        class="header__menu--faq"
        to="/profile"
      > -->
        <!-- Add your icon or text here -->
      <!-- </NuxtLink> -->

      <!-- Additional links/icons can be added here -->

      <!-- <nuxt-link
        v-if="authStore.authenticated"
        class="header__menu--profile-link ml-10"
                        to="/account"
        active-class="active"
      >
        <div v-if="authStore.authenticated">
          <img class="header__menu--profile-image" :src="avatarImageSource" />
        </div>
      </nuxt-link>
    </div>

    <NuxtLink v-else to="/login" class="text-white">Sign In</NuxtLink> -->
  </header>
</template>

<style scoped>
.status-messages-container {
  flex: 1;
  display: flex;
  align-items: center;
  margin-left: 10px;
  overflow: hidden; /* Hide any overflow */
  white-space: nowrap;
  position: relative; /* Positioning to control z-index */
  z-index: 0; /* Ensure it's behind the menu button */
}
.scrolling-text {
  color:  hsl(190, 95%, 30%);
  overflow: hidden;
  animation: scroll 10s linear infinite;
  z-index: 0; 
  size: 16px;
  
}

@keyframes scroll {
  0% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(-200%); /* Further decrease to ensure full text is shown */
  }
}
.tv-banner {
  background-color: black;
  border-bottom: 3px solid black; /* Slate Blue */
  color: white;
  overflow: hidden; /* Prevent horizontal scrolling */
}.tv-link {
  color: white;
  font-weight: bold;
}

.header__menu--profile-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  overflow: hidden;
  margin-left: 5px;
  transition: outline 0.3s ease;
}

.header__menu--profile-link:hover {
  outline: 2px solid white;
}

.header__menu--profile-link.active {
  outline: 2px solid white;
}

.header__menu--profile-image {
  width: 100%;
  height: auto;
}

.header__menu--faq-icon {
  min-width: 36px;
  height: auto;
  color: white;
}
</style>