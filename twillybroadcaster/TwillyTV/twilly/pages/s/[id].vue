<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black flex items-center justify-center">
    <div class="text-center">
      <div class="space-y-4">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-400 border-t-transparent"></div>
        <p class="text-white text-lg">Preparing preview…</p>
      </div>
    </div>
  </div>
  
</template>

<script setup>
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const shortId = route.params.id;

// Resolve shortId to target URL on the server during SSR
let targetUrl = '';
try {
  if (shortId) {
    const resp = await $fetch('/api/redirect', { method: 'POST', body: { shortId } });
    targetUrl = resp?.longUrl || '';
  }
} catch (e) {
  console.error('[Short] Failed to resolve short URL:', e);
}

const deslugify = (v) => {
  if (!v) return '';
  try { return decodeURIComponent(String(v)).replace(/-/g, ' '); } catch { return String(v).replace(/-/g, ' '); }
};

const normalizePosterUrl = (url) => {
  if (!url) return '';
  let fixed = url;
  try { fixed = decodeURIComponent(url); } catch (_) {}
  if (fixed.includes('d4idc5cmwxlpy.cloudfront.net')) {
    fixed = fixed.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
  }
  if (fixed.includes('/series-posters/') && !fixed.includes('/public/series-posters/')) {
    fixed = fixed.replace('/series-posters/', '/public/series-posters/');
  }
  return fixed;
};

const parseMetaFromUrl = (urlStr) => {
  if (!urlStr) return { title: 'Twilly', description: 'Check out this series on Twilly', poster: '' };
  try {
    const url = new URL(urlStr, 'https://twilly.app');
    const t = url.searchParams.get('t') || url.searchParams.get('title');
    const d = url.searchParams.get('d') || url.searchParams.get('description');
    const p = url.searchParams.get('p') || url.searchParams.get('poster');
    const parts = url.pathname.split('/').filter(Boolean);
    let usernameFromPath = '';
    let seriesFromPath = '';
    let posterFromPath = '';
    const idx = parts.findIndex(p => p === 'menu');
    if (idx !== -1 && parts[idx + 1] === 'share') {
      usernameFromPath = parts[idx + 2] || '';
      seriesFromPath = parts[idx + 3] ? deslugify(parts[idx + 3]) : '';
      posterFromPath = parts[idx + 4] ? decodeURIComponent(parts[idx + 4]) : '';
    }
    const title = t || seriesFromPath || 'Twilly';
    const description = d || (usernameFromPath ? `Check out this series from ${usernameFromPath}` : 'Check out this series on Twilly');
    const poster = normalizePosterUrl(p || posterFromPath || '');
    return { title, description, poster };
  } catch {
    return { title: 'Twilly', description: 'Check out this series on Twilly', poster: '' };
  }
};

const meta = parseMetaFromUrl(targetUrl);

// Prefer local asset for certain known channels
const localAssetsMap = {
  'twilly-after-dark': '/assets/channels/twilly-after-dark-og.png'
};

// Try to infer slug from target
let inferredSlug = '';
try {
  const u = new URL(targetUrl, 'https://twilly.app');
  const parts = u.pathname.split('/').filter(Boolean);
  // If target is a clean channel URL
  const idxC = parts.findIndex(p => p === 'channel');
  if (idxC !== -1) inferredSlug = parts[idxC + 2] || '';
  // Else if long URL
  const idxM = parts.findIndex(p => p === 'menu');
  if (!inferredSlug && idxM !== -1 && parts[idxM + 1] === 'share') {
    const seriesFromPath = parts[idxM + 3] ? parts[idxM + 3] : '';
    inferredSlug = String(seriesFromPath || '').toLowerCase().replace(/\s+/g, '-');
  }
} catch {}

const ogImage = localAssetsMap[inferredSlug] || meta.poster || 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg';

// SSR: set crawler-friendly meta on the short page itself
useHead({
  title: meta.title,
  meta: [
    { property: 'og:title', content: meta.title },
    { property: 'og:description', content: meta.description },
    { property: 'og:image', content: ogImage },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: meta.title },
    { name: 'twitter:description', content: meta.description },
    { name: 'twitter:image', content: ogImage }
  ]
});

// Clients: redirect to the resolved target URL (clean or long)
onMounted(() => {
  if (targetUrl) {
    window.location.replace(targetUrl);
  } else {
    window.location.replace('/');
  }
});
</script> 