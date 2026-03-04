<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black">
    <div class="container mx-auto px-4 py-8">
      <div class="grid md:grid-cols-[1fr,2fr] gap-8">
        <!-- Sidebar -->
        <div class="space-y-4">
          <NuxtLink to="/account"
            class="block p-4 bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 hover:border-teal-400 transition-all duration-300"
                          :class="{ 'border-teal-400': $route.path === '/account' }">
            <div class="flex items-center">
              <div class="p-2 bg-teal-500/20 rounded-lg mr-4">
                <Icon name="ph:user" class="w-6 h-6 text-teal-400" />
              </div>
              <div>
                <h2 class="text-white font-semibold">Account</h2>
                <p class="text-gray-400 text-sm">Personal information</p>
              </div>
            </div>
          </NuxtLink>
        </div>

        <!-- Main Content -->
        <div class="min-h-[calc(100vh-4rem)]">
          <router-view></router-view>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop-blur-sm {
  backdrop-filter: blur(8px);
}
</style>
