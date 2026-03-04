
import { Auth } from "aws-amplify";
import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware (async ( to, from ) => {
    const authStore = useAuthStore()

  
    try {
        const loggedIn = await Auth.currentAuthenticatedUser()
        if (loggedIn){
            await authStore.loggedIn()
            return 
        }else {
            return navigateTo('/')
        }
        
      } catch(err) {
        
      }
})