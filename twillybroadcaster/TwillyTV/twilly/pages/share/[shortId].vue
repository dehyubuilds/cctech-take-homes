<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black">
    <!-- Loading State -->
    <div v-if="isLoading" class="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-400 border-t-transparent mb-4"></div>
        <p class="text-white text-lg font-medium">Loading exclusive content...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <div class="bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg p-8 mx-4 max-w-md">
          <h1 class="text-2xl font-bold mb-4">Content Not Found</h1>
          <p>{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div v-else-if="shareData" class="min-h-screen">
      <!-- Header with Poster -->
      <div class="relative h-[50vh] w-full overflow-hidden">
        <img 
          :src="shareData.posterUrl" 
          class="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
          :alt="shareData.title"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
        <div class="absolute bottom-0 left-0 right-0 p-6 sm:p-8 md:p-12">
          <div class="max-w-7xl mx-auto">
            <div class="flex flex-col gap-4">
              <div>
                <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 leading-tight">
                  {{ shareData.title }}
                </h1>
                <p class="text-gray-300 text-base sm:text-lg md:text-xl max-w-2xl">{{ shareData.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Menu Items Grid -->
      <div class="max-w-7xl mx-auto px-4 py-6 -mt-8 sm:-mt-12">
        <div v-if="shareData.items && shareData.items.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="item in shareData.items" :key="item.SK"
               class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 overflow-hidden hover:border-teal-500/50 transition-all duration-300">
            <!-- Item Image -->
            <div class="aspect-video relative">
              <img 
                :src="item.thumbnailUrl || item.url || '/images/coming-soon.jpg'"
                :alt="item.title || 'Coming Soon'"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div v-if="item.price" class="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <span class="text-teal-400 font-semibold text-sm sm:text-base">${{ item.price }}</span>
              </div>
            </div>

            <!-- Item Details -->
            <div class="p-4 sm:p-6">
              <h3 class="text-lg sm:text-xl font-semibold text-white mb-2">
                {{ item.title || 'Coming Soon' }}
              </h3>
              <p class="text-gray-400 text-sm mb-3 sm:mb-4 line-clamp-3">
                {{ item.description || 'Description coming soon...' }}
              </p>
              <div v-if="item.price" class="flex items-center justify-between">
                <span class="text-teal-400 font-semibold text-base sm:text-lg">${{ item.price }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-8 sm:py-12">
          <Icon name="heroicons:square-2-stack" class="w-10 h-10 sm:w-12 sm:h-12 text-teal-400/50 mx-auto mb-4" />
          <h3 class="text-lg sm:text-xl font-semibold text-white mb-2">No Items Available</h3>
          <p class="text-gray-400 text-sm sm:text-base">This menu is currently empty</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const isLoading = ref(true);
const error = ref(null);
const shareData = ref(null);

onMounted(async () => {
  const shortId = route.params.shortId;
  
  console.log('[Share Page] Loading content for shortId:', shortId);
  
  try {
    // Single API call to get all data from DynamoDB
    const response = await fetch('/api/share/content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shortId }),
    });

    console.log('[Share Page] API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Share Page] Failed to fetch content:', response.status, response.statusText, errorText);
      error.value = 'Failed to load content. Please check the link and try again.';
      return;
    }

    const data = await response.json();
    console.log('[Share Page] API response data:', data);

    if (data.error) {
      error.value = data.error;
      return;
    }

    // Check if this is a casting director URL by looking at the longUrl
    if (data.longUrl && data.longUrl.includes('/casting-director/')) {
      console.log('[Share Page] Detected casting director URL, redirecting to casting director page');
      // Redirect to the actual casting director page after a short delay to show the preview
      setTimeout(() => {
        window.location.href = data.longUrl;
      }, 2000);
    }

    // Set the share data
    shareData.value = {
      title: data.title || 'Exclusive Content',
      description: data.description || 'Check out this exclusive content',
      posterUrl: data.posterUrl || 'https://d4idc5cmwxlpy.cloudfront.net/Screenshot+2025-07-04+at+10.13.36%E2%80%AFPM.png',
      items: data.items || []
    };

    // Set up metadata for link previews
    const currentUrl = window.location.href;
    const imageUrl = shareData.value.posterUrl;
    
    // Ensure image URL is absolute
    const absoluteImageUrl = imageUrl.startsWith('http') 
      ? imageUrl 
      : `https://d3hv50jkrzkiyh.cloudfront.net${imageUrl}`;

    useHead({
      title: shareData.value.title,
      meta: [
        // Essential Open Graph
        { property: "og:title", content: shareData.value.title },
        { property: "og:description", content: shareData.value.description },
        { property: "og:image", content: absoluteImageUrl },
        { property: "og:url", content: currentUrl },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Twilly" },

        // Image Specifics
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:alt", content: shareData.value.title },

        // Twitter Card
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:site", content: "@Twilly" },
        { name: "twitter:title", content: shareData.value.title },
        { name: "twitter:description", content: shareData.value.description },
        { name: "twitter:image", content: absoluteImageUrl },

        // Basic SEO
        { name: "description", content: shareData.value.description },
        { name: "author", content: "Twilly" },
        { name: "theme-color", content: "#084d5d" }
      ],
      link: [
        { rel: 'canonical', href: currentUrl }
      ]
    });

  } catch (err) {
    console.error('[Share Page] Error:', err);
    error.value = 'Failed to load content. Please try again.';
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
.backdrop-blur-sm {
  backdrop-filter: blur(8px);
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style> 