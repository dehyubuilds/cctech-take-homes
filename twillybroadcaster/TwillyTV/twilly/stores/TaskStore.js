import { defineStore } from 'pinia'
import { Auth } from "aws-amplify";
import { useUserStore } from './userStore';

export const useTaskStore = defineStore('taskStore', {
  state: () => ({
    tasks: [],
    url: [],
    loading: false,
    setStatus: false
  }),
  getters: {
    favs() {
      return this.tasks.filter(t => t.isFav)
    },
    favCount() {
      return this.tasks.reduce((p, c) => {
        return c.isFav ? p + 1 : p
      }, 0)
    },
    totalCount: (state) => {
      return state.tasks.length
    }
  },
  actions: {
    async getTasks(user) {
      this.loading = true
      const data = await $fetch(
        `/api/message/listings/user/${user}`
      );
      this.tasks = data.listings;
      this.loading = false
    },
async shortenUrl(url, creator, series, userEmail) {
  
  this.loading = true;
  let urlToShorten = url || '';
  
  try {
    let creatorName = creator;
    let seriesName = series;
    
    if (typeof url === 'object' && url.url) {
      urlToShorten = url.url;
      // If the object has creator and series, use them
      if (url.creator && url.series) {
        creatorName = url.creator;
        seriesName = url.series;
      } else {
        creatorName = null;
        seriesName = null;
      }
    }
    
    // TEMPORARY: Use Nuxt API proxy to avoid CORS issues
    if (creatorName && seriesName && userEmail) {
      
      const requestBody = { 
        url: urlToShorten, 
        creator: creatorName, 
        series: seriesName,
        userEmail: userEmail
      };
      
    const response = await fetch('/api/message/shortenUrl', {
      method: 'POST',
        body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' }
    });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

    const data = await response.json();

    if (data && data.returnResult) {
        this.url = data.returnResult;
        return { returnResult: data.returnResult };
      } else {
        console.error('❌ Failed to get valid short URL from Nuxt API response.');
        console.error('❌ Response was:', data);
        return { returnResult: urlToShorten };
      }
    } else {
      
      const requestBody = { url: urlToShorten };
      
      const response = await fetch('/api/message/shortenUrl', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.returnResult) {
        this.url = data.returnResult;
        return { returnResult: data.returnResult };
      } else {
        console.error('❌ Failed to get valid short URL from Nuxt API response.');
        console.error('❌ Response was:', data);
        return { returnResult: urlToShorten };
      }
    }
  } catch (error) {
    console.error('❌ Error in shortenUrl:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    return { returnResult: urlToShorten || '' };
  } finally {
    this.loading = false;
  }
},
    async pnoTranslate(input) {
   
      try {
        const userPhoneNumber = useUserStore().getUserPhoneNumber(); // Access the user's phone number

        if (userPhoneNumber === 'Unverified') {
        
          return 'Unverified';
        }

        const inputWithPhoneNumber = {
          ...input,
          phoneNumber: userPhoneNumber,
        };

        const res = await fetch('/api/message/listings', {
          method: 'POST',
          body: JSON.stringify(inputWithPhoneNumber),
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
          const errorData = await res.json();
          console.error('Error:', errorData);
        } else {
      
        }
      } catch (error) {
        console.error('An error occurred:', error.message);
      }
    },
    async addTask(task) {
     
      try {
        const userPhoneNumber = useUserStore().getUserPhoneNumber();

        if (userPhoneNumber === 'Unverified') {
         
          return 'Unverified';
        }

        if (
          task.reminder &&
          (task.reminder.includes("shesfreaky.com") ||
            task.reminder.includes("xnxx.com") ||
       
            task.reminder.includes("instagram.com"))
        ) {
      
          const translationRes = await fetch('/api/message/listings/translatepno', {
            method: 'POST',
            body: JSON.stringify({ reminder: task.reminder }),
            headers: { 'Content-Type': 'application/json' }
          });

          if (!translationRes.ok) {
            const translationError = await translationRes.json();
            console.error('Error translating reminder:', translationError);
            return; // Optionally, handle the error as needed
          }

          const translationData = await translationRes.json();
          const updated_pno_link = translationData.responseBody;

          task.reminder = updated_pno_link;
          
        }

  

        if (!task.title) {
          task.title = 'do not send';
        }

        const taskWithPhoneNumber = {
          ...task,
          phoneNumber: userPhoneNumber,
        };

        const res = await fetch('/api/message/listings', {
          method: 'POST',
          body: JSON.stringify(taskWithPhoneNumber),
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
          const errorData = await res.json();
          console.error('Error:', errorData);
        } else {
          this.tasks.push(task);
      
        }
      } catch (error) {
        console.error('An error occurred:', error.message);
      }
    }
    ,

    async requestCode(phone) {
      try {
        const res = await fetch('/api/message/authchallenge', {
          method: 'POST',
          body: JSON.stringify(phone),
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
          const errorData = await res.json();
          console.error('Error:', errorData);
        } else {
     
        }
      } catch (error) {
        console.error('An error occurred:', error.message);
      }
    },
    async submitCode(verificationCode, phoneNumber) {
      try {
        const res = await fetch('/api/message/sendchallenge', {
          method: 'POST',
          body: JSON.stringify({ phoneNumber, verificationCode }),
          headers: { 'Content-Type': 'application/json' },
        });

   
        if (res.status === 200) {
          // Log the response body as text
          const responseBodyText = await res.text();
   

          // Check the response body and return true if it equals the string "200"
          if (responseBodyText === '200') {
            return true;
          } else if (responseBodyText === '500') {
            // Return false if the response body equals the string "500"
            return false;
          } else {
            // Handle other cases as needed
            // You might want to return true/false based on different response values
            return true; // Placeholder, modify as per your requirements
          }
        } else {
          // Handle non-200 status codes here if needed
          console.error('Non-200 status code:', res.status);
          return false;
        }
      } catch (error) {
        console.error('An error occurred:', error.message);
        // Return false in case of an error
        return false;
      }
    },
    async deleteTask(id) {
      this.tasks = this.tasks.filter(t => t.id !== id);
   

      const user = await Auth.currentAuthenticatedUser();
      

      try {
        const res = await fetch(`/api/message/listings/${id}`, {
          method: "DELETE",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username: user.username }) // Send the username as a JSON object
        });

        if (!res.ok) {
          const errorData = await res.json();
          console.error('Error:', errorData);
        } else {
  
        }
      } catch (error) {
        console.error('An error occurred:', error.message);
      }
    },
    async toggleFav(id) {
      const task = this.tasks.find(t => t.id === id);
      task.isFav = !task.isFav;

      const user = await Auth.currentAuthenticatedUser();
      try {
        const res = await $fetch(`/api/message/update/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            username: user.username,
            isFav: task.isFav
          }), // Send the username and isFav in the body as a JSON string
        });

        if (res.error) {
    
        }
      } catch (error) {
        console.error("An error occurred while toggling the favorite:", error);
      }
    }

  }
})