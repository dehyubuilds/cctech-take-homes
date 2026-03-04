import { defineNuxtPlugin } from "#app";
import { Amplify, Auth } from "aws-amplify";

export default defineNuxtPlugin((nuxtApp) => {
  return {
    provide: {
      auth: Auth
    }
  };
});
