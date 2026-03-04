// nuxt.config.ts
export default defineNuxtConfig({
    app: {
        head: {
            link: [
                {
                    rel: 'stylesheet',
                    href: 'https://fonts.googleapis.com/icon?family=Material+Icons'
                },
                {
                    rel: 'stylesheet',
                    href: 'https://cdn.jsdelivr.net/npm/vue-toastification@2.0.0-rc.5/dist/index.css'
                }
            ],
            script: []
        }
    },
    
    alias: {
        "./runtimeConfig": "./runtimeConfig.browser"
    },
    vite: {
        define: {
            "window.global": {}
        },
        server: {
            https: true
        }
    },
    runtimeConfig: {
        public: {
            publicPath: process.env.BASE_URL || '/_nuxt/',  // Set it based on your deployment or custom path
            
            awsConfig: {
                userPoolId: process.env.COGNITO_USER_POOL_ID || 'us-east-1_ydIfTK3KE',
                userPoolWebClientId: process.env.COGNITO_CLIENT_ID || '7imkv9gnn1s0g8ri1dj61lohc0',
                authenticationFlowType: 'USER_PASSWORD_AUTH'
            }
        },

    },



    build: {
        transpile: ['@vuepic/vue-datepicker'],
        extend(config) {
            config.resolve.alias['aws-exports-2fa'] = './aws-exports-2fa.js'
        }
    },
    modules: [
        "@nuxtjs/tailwindcss",
        "@vueuse/nuxt",
        "nuxt-icon",
        "@pinia/nuxt",
        "@i2d/nuxt-pdf-frame"
    ],




});