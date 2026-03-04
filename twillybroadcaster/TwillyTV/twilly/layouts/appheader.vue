<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black">
    <!-- NavBar -->
    <NavBar />

    <!-- Main Content Area -->
    <div class="flex">
      <!-- Sidebar Navigation -->
      <div class="hidden md:block w-64 min-h-[calc(100vh-73px)] bg-black/30 backdrop-blur-sm border-r border-teal-900/30">
        <nav class="p-4 space-y-2">
          <NuxtLink 
            to="/profile" 
            class="flex items-center space-x-3 px-4 py-3 rounded-lg text-white hover:bg-teal-500/20 transition-all duration-300"
            :class="{ 'bg-teal-500/20': $route.path === '/profile' }"
          >
            <Icon name="heroicons:home" class="w-5 h-5" />
            <span>Dashboard</span>
          </NuxtLink>

          <NuxtLink 
                          to="/account" 
            class="flex items-center space-x-3 px-4 py-3 rounded-lg text-white hover:bg-teal-500/20 transition-all duration-300"
                          :class="{ 'bg-teal-500/20': $route.path === '/account' }"
          >
            <Icon name="heroicons:user-circle" class="w-5 h-5" />
            <span>Account</span>
          </NuxtLink>

          <NuxtLink 
            to="/uploadchannel" 
            class="flex items-center space-x-3 px-4 py-3 rounded-lg text-white hover:bg-teal-500/20 transition-all duration-300"
            :class="{ 'bg-teal-500/20': $route.path === '/uploadchannel' }"
          >
            <Icon name="heroicons:cloud-arrow-up" class="w-5 h-5" />
            <span>Upload</span>
          </NuxtLink>

          <NuxtLink 
            to="/managefiles" 
            class="flex items-center space-x-3 px-4 py-3 rounded-lg text-white hover:bg-teal-500/20 transition-all duration-300"
            :class="{ 'bg-teal-500/20': $route.path === '/managefiles' }"
          >
            <Icon name="heroicons:folder" class="w-5 h-5" />
            <span>Files</span>
          </NuxtLink>
        </nav>
      </div>

      <!-- Page Content -->
      <div class="flex-1">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'appheader'
});
</script>

<style scoped>
.backdrop-blur-sm {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* Hide scrollbar for Chrome, Safari and Opera */
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.hide-scrollbar {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
</style>
 