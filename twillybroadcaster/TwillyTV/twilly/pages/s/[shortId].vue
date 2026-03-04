<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black flex items-center justify-center">
    <div class="text-center">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-400 border-t-transparent mb-4"></div>
      <p class="text-white text-lg font-medium">Redirecting...</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import seriesPreview from "@/assets/twilly-series-preview.png";

const route = useRoute();
const router = useRouter();
const shareData = ref(null);

// Set up meta tags for WhatsApp preview
useHead(() => {
  const currentUrl = window.location.href;
  // Use dedicated series image
  const imageUrl = seriesPreview;

      return {
      title: shareData.value?.title || 'New Series on Twilly',
      meta: [
        // Essential Open Graph
        { property: "og:title", content: shareData.value?.title || 'New Series on Twilly' },
        { property: "og:description", content: 'Check out this new series on Twilly - exclusive content from your favorite creators' },
      { property: "og:image", content: imageUrl },
      { property: "og:url", content: currentUrl },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Twilly" },

      // Image Specifics
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:alt", content: shareData.value?.title || 'Exclusive Content' },

      // Twitter Card
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Twilly" },
      { name: "twitter:title", content: shareData.value?.title || 'Exclusive Content' },
      { name: "twitter:description", content: shareData.value?.description || 'Check out this exclusive content' },
      { name: "twitter:image", content: imageUrl },

      // Basic SEO
      { name: "description", content: shareData.value?.description || 'Check out this exclusive content' },
      { name: "author", content: "Twilly" },
      { name: "theme-color", content: "#084d5d" }
    ],
    link: [
      { rel: 'canonical', href: currentUrl }
    ]
  };
});

onMounted(async () => {
  const shortId = route.params.shortId;
  console.log('[Short URL] Loading shortId:', shortId);
  
  try {
    // First, get the share content data for meta tags
    const contentResponse = await fetch('/api/share/content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shortId }),
    });

    if (contentResponse.ok) {
      const contentData = await contentResponse.json();
      if (!contentData.error) {
        shareData.value = {
          title: contentData.title || 'Exclusive Content',
          description: contentData.description || 'Check out this exclusive content',
          posterUrl: contentData.posterUrl || 'https://d4idc5cmwxlpy.cloudfront.net/Screenshot+2025-07-04+at+10.13.36%E2%80%AFPM.png'
        };
      }
    }

    // Call API to get the redirect URL for this short ID
    const response = await fetch('/api/share/redirect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shortId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get redirect URL (${response.status})`);
    }

    const data = await response.json();
    console.log('[Short URL] Redirect data:', data);

    if (data.redirectUrl) {
      // Redirect to the API Gateway URL
      const apiGatewayUrl = `https://twilly.app${data.redirectUrl}`;
      console.log('[Short URL] Redirecting to API Gateway:', apiGatewayUrl);
      window.location.href = apiGatewayUrl;
    } else {
      // Show error
      router.push('/error?message=Link not found');
    }
  } catch (error) {
    console.error('[Short URL] Error:', error);
    router.push('/error?message=Failed to load link');
  }
});
</script> 