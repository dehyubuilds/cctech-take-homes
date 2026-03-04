// nuxt.config.ts
import { existsSync } from 'fs';
import { resolve } from 'path';

// Use env-based default when aws-exports.js is missing (e.g. Netlify); otherwise use Amplify-generated file
const awsExportsPath = resolve(process.cwd(), 'aws-exports.js');
const awsExportsDefaultPath = resolve(process.cwd(), 'aws-exports.default.js');
const awsExportsResolve = existsSync(awsExportsPath) ? awsExportsPath : awsExportsDefaultPath;

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
        "./runtimeConfig": "./runtimeConfig.browser",
        "~/aws-exports": awsExportsResolve
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