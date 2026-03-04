<template>
    <router-link :to="to" :class="{ 'profile__tab': true, 'active': isActive }">
      <slot></slot>
    </router-link>
  </template>
  
  <script>
  export default {
    props: {
      to: {
        type: String,
        required: true,
      },
    },
    computed: {
      isActive() {
        return this.$route.path === this.to;
      },
    },
  };
  </script>
  
  <style scoped>
  /* Add your CSS styles for the AppMenu component here if needed */
  </style>
  