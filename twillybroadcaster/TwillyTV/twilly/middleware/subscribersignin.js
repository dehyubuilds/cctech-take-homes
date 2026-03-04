
import { Auth } from "aws-amplify";
import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware(async (to, from) => {
    const authStore = useAuthStore()

    try {
        const loggedIn = await Auth.currentAuthenticatedUser()
        if (loggedIn) {
            await authStore.loggedIn()
            return
        } else {
            return navigateTo('/')
        }

    } catch (err) {
        // An error occurred, log it and navigate to the home page after a timeout
       
        setTimeout(() => {
            navigateTo('/');
        }, 500); // Add a timeout to ensure the navigation happens after logging the error
    }
})