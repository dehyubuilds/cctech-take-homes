import { defineStore } from 'pinia'
import { Auth } from "aws-amplify";

export const useMediaStore = defineStore('mediaStore', {
  state: () => ({
    loading: false,
  }),
  actions: {
    async deleteMedia(url, media, sk) {
      const user = await Auth.currentAuthenticatedUser();
      try {
        const res = await fetch(`/api/media`, {
          method: "DELETE",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: user.username,
            url: url,
            category: media,
            sk: sk,
          })
        });

        const data = await res.json(); 

        if (data.statusCode === 200) {
          return true;
        } else {
          // Failed deletion
          console.error('Error:', data);
          return false;
        }
      } catch (error) {
        console.error('An error occurred:', error.message);
        return false; // Return false for failed deletion
      }
    }
  }
});
