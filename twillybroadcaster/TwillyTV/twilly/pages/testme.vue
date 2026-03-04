<template>
    <main>
      <!-- heading -->
      <header>
        <!-- <img src="https://theprivatecollection.s3.us-east-2.amazonaws.com/twillybee.png" alt="twilly logo" /> -->
        <h1>Schedule Delivery</h1>
      </header>
  
      <!-- new task form -->
      <div class="new-task-form">
        <TaskForm />
      </div>
  
      <!-- filter -->
      <nav class="filter">
        <button @click="filter = 'upcoming'">Scheduled</button>
        <button @click="filter = 'favs'">Past</button>
        <button @click="filter = 'upcoming'">Docs</button>
        <button @click="filter = 'favs'">Audio</button>
      </nav>
  
      <!-- loading -->
      <!-- <div class="loading" v-if="loading">Loading reminders...</div> -->
  
      <div class="task-list" v-if="filter === 'upcoming'">
        <p>You've scheduled {{ totalCount }} messages.</p>
        <div v-for="task in tasks.slice().reverse()" :key="task.id">
          <TaskDetails :task="task" />
        </div>
      </div>
  
      <div class="task-list" v-if="filter === 'past'">
        <p>You have {{ totalCount }} past reminders.</p>
        <div v-for="task in taskStore.favs.slice().reverse()" :key="task.id">
          <TaskDetails :task="task" />
        </div>
      </div>
  
      <div class="task-list" v-if="filter === 'favs'">
        <p>You have {{ favCount }} favs in your favs list.</p>
        <div v-for="task in taskStore.favs.slice().reverse()" :key="task.id">
          <TaskDetails :task="task" />
        </div>
      </div>
  
      <!-- <button @click="taskStore.$reset">reset the state</button> -->
    </main>
  </template>
    
    
    
    
  <script setup>
  import { useTaskStore } from "../stores/TaskStore";
  import { Auth } from "aws-amplify";
  import "@aws-amplify/ui-vue/styles.css";
  import { useAuthStore } from "~/stores/auth";
  import { useUserStore } from "~/stores/userStore";
  import { storeToRefs } from "pinia";
  import logo from "@/assets/twillyhead.png";
  
  const title = ref("Twilly");
  const description = ref("Twilly App");
  const ogImageUrl = logo;
  const userStore = useUserStore();
  
  // This will be reactive even you change title/description above
  useHead({
    title,
    meta: [
      { hid: "description", name: "description", content: description },
      { hid: "og:title", property: "og:title", content: title },
      {
        hid: "og:description",
        property: "og:description",
        content: description,
      },
      {
        hid: "og:image",
        property: "og:image",
        content: ogImageUrl,
      },
  
      // twitter card
      {
        hid: "twitter:description",
        name: "twitter:description",
        content: description,
      },
      {
        hid: "twitter:image",
        name: "twitter:image",
        content: ogImageUrl,
      },
    ],
  });
  
  definePageMeta({
    middleware: ["account"],
  });
  
  
  const taskStore = useTaskStore();
  
  // const getTasks = ref(null)
  // // fetch tasks
  // getTasks.value = taskStore.getTasks();
  
  const { tasks, loading, favs, totalCount, favCount } = storeToRefs(taskStore);
  
  const user = ref(null);
  // const isLoading = ref(null);
  
  // isLoading.value = taskStore.tasks;
  
  const verifyLoggedIn = async () => {
    try {
      user.value = await Auth.currentAuthenticatedUser();
      const schedulerId = user.value ? user.value.username : null;
  
      // Conditionally fetch tasks only if the user is not null
      if (user.value) {
        taskStore.getTasks(user.value.username);
        await userStore.getFormData(schedulerId);
      }
    } catch (error) {
      // Handle the error here
      console.error("Error verifying login:", error);
  
      // Assuming you are using some kind of router to navigate
      // Redirect to the /login route on error
      // Replace this line with the correct navigation logic based on your router setup
      navigateTo('/signin')
    }
  };
  const filter = ref("upcoming");
  
  onMounted(() => {
    // Call the verifyLoggedIn function when the component is mounted
    verifyLoggedIn();
  });
  </script> 
    
    <style>
  @import url("~/assets/css/reminders.css");
  </style>