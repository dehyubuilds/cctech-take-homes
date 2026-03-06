import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
    // Performance optimizations
    experimental: {
      payloadExtraction: false,
      inlineSSRStyles: false,
      viewTransition: false
    },
    
    // Route-based optimizations
    routeRules: {
      '/': { redirect: '/home' },
      '/signin': { redirect: '/producer' },
      // Prerender static pages
      '/legal/**': { prerender: true },
      '/faq': { prerender: true },
      // ISR for dynamic content
      '/home': { isr: 60 },
      '/subscription': { isr: 300 }
    },

    app: {
      head: {
        charset: 'utf-8',
        viewport: 'width=device-width, initial-scale=1, user-scalable=no, viewport-fit=cover',
        meta: [
          { 'http-equiv': 'x-ua-compatible', content: 'IE=edge' },
          { name: 'format-detection', content: 'telephone=no' },
          { name: 'theme-color', content: '#14b8a6' },
          { name: 'apple-mobile-web-app-capable', content: 'yes' },
          { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
          { name: 'apple-mobile-web-app-title', content: 'Twilly' },
          { name: 'apple-touch-fullscreen', content: 'yes' },
          { name: 'mobile-web-app-capable', content: 'yes' },
          { name: 'msapplication-TileColor', content: '#14b8a6' },
          { name: 'msapplication-config', content: '/browserconfig.xml' },
          { name: 'description', content: 'Premium streaming network with 5 exclusive channels. Watch high-quality content anytime, anywhere.' },
          { name: 'keywords', content: 'streaming, premium content, fitness, gaming, music, tech, entertainment' },
          { name: 'author', content: 'Twilly' },
          { name: 'robots', content: 'index, follow' },
          { property: 'og:type', content: 'website' },
          { property: 'og:url', content: 'https://twilly.app' },
          { property: 'og:site_name', content: 'Twilly' },
          { name: 'twitter:card', content: 'summary_large_image' }
        ],
        link: [
          { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
          { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
          { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/favicon-48x48.png' },
          { rel: 'apple-touch-icon', href: '/favicon-32x32.png' },
          { rel: 'shortcut icon', href: '/favicon.ico' },
          { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
          { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }
        ]
      },
      // Global scroll behavior configuration
      pageTransition: {
        name: 'page',
        mode: 'out-in'
      }
    },

    // Global scroll behavior - always start at top
    router: {
      scrollBehavior(to, from, savedPosition) {
        // Always scroll to top on route change
        return { top: 0, left: 0, behavior: 'instant' }
      }
    },

    ssr: true,

    // Add nitro configuration for server routes (netlify preset on Netlify so .output/public exists for deploy)
      nitro: {
    preset: process.env.NITRO_PRESET || (process.env.NETLIFY ? 'netlify' : 'node-server'),
    routeRules: {
      '/api/**': { cors: true }
    },
    // Increase body size limit for file uploads
    bodyLimit: '2gb',
    experimental: {
      payloadExtraction: false,
      wasm: false
    },
    compressPublicAssets: true
  },

    // Add runtime config for server
    runtimeConfig: {
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      awsAccountId: process.env.AWS_ACCOUNT_ID || '142770202579',
      lemonSqueezyApiKey: process.env.LEMON_SQUEEZY_API_KEY,
      lemonSqueezyStoreId: process.env.LEMON_SQUEEZY_STORE_ID,
      lemonSqueezyWebhookSecret: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET,
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
      vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
      websocketApiEndpoint: process.env.WEBSOCKET_API_ENDPOINT || 'wss://kwt0i091yd.execute-api.us-east-1.amazonaws.com/dev',
      public: {
        stripePk: process.env.STRIPE_PUBLISHABLE_KEY,
        EC2_IP: process.env.EC2_IP || '54.144.99.23',
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY
      }
    },

    modules: [
      '@nuxtjs/tailwindcss',
      '@vueuse/nuxt',
      'nuxt-icon',
      '@pinia/nuxt',
      '@i2d/nuxt-pdf-frame',
      '@nuxtjs/pwa'
    ],

    pwa: {
      registerType: 'autoUpdate',
      // Use our custom service worker instead of workbox
      workbox: false,
      // Disable automatic manifest generation to avoid conflicts
      manifest: false
    },

    plugins: [
      '~/plugins/scroll-reset.client.js',
      '~/plugins/videojs.client.js',
      '~/plugins/manifest.client.js',
      '~/plugins/pwa.client.js',
      '~/plugins/push-notifications.client.js',
      '~/plugins/pwa-debug.client.js'
    ]
  }) 