import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', {
  state: () => ({
    userData: null,
    loading: false,
    error: null
  }),

  actions: {
    async setUserData(data) {
      this.userData = data;
    }
  }
});
