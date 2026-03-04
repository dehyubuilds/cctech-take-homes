<template>
    <div class="new-task-form " style="margin-top: -20px;" >
      <div v-if="selectedName === 'Create'">
      <header >
      
      <h1 >Create Channel</h1>
    </header>
      </div>
      <div v-else-if="selectedName === 'Manage'">
      <header >
      
      <h1 >Upload file(s)</h1>
    </header>
      </div>
  
      <div v-else>
        <header >   
      <h1 >Share Channel</h1>
    </header>
      </div>
      
    <nav class="flex justify-center items-center gap-2 mt-5">
      
      <nuxt-link
        :class="{ 'selected-button': selectedName === 'Create' }"
        class="transform rounded bg-gradient-to-br from-blue-400 to-blue-600 py-2 px-3 font-semibold text-slate-200 shadow transition hover:scale-110"
        @click="showGreeting('Create')"
        >+Create</nuxt-link
      >


      <nuxt-link
    :class="{ 'selected-button': selectedName === 'Manage' }"
    class="transform rounded bg-gradient-to-br from-orange-600 to-orange-600 py-2 px-3 font-semibold text-slate-200 shadow transition hover:scale-110"
    @click="showGreeting('Manage')"
  >
    Manage
  </nuxt-link>

      <nuxt-link
        :class="{ 'selected-button': selectedName === 'Share' }"
        class="transform rounded bg-gradient-to-br from-green-400 to-green-600 py-2 px-3 font-semibold text-slate-200 shadow transition hover:scale-110"
        @click="showGreeting('Share')"
        >Share</nuxt-link
      >



      <!-- <nuxt-link
        :class="{ 'selected-button': selectedName === 'Invite' }"
        class="transform rounded bg-gradient-to-br from-yellow-400 to-green-600 py-2 px-3 font-semibold text-slate-200 shadow transition hover:scale-110"
        @click="showGreeting('Invite')"
        >Invite</nuxt-link
      > -->
    </nav>

    <!-- Display the greeting for Create -->
    <div v-if="selectedName === 'Create'" class="text-center mt-5">
      Create
    </div>
    <div v-if="selectedName === 'Manage'" class="text-center mt-5">
      Manage
    </div>
    <!-- Display the greeting for Share -->
    <div v-if="selectedName === 'Share'" class="text-center mt-5">
      Share
    </div>

  </div>
</template>
    
  <script setup>
  definePageMeta({
  middleware: ["account"],

});
const selectedName = ref("Create");

const showGreeting = (name) => {
  selectedName.value = name;
};
</script>
    
  <style scoped>
  @import url("~/assets/css/reminders.css");
.selected-button {
  border: 2px solid #4299e1; /* Set the border color to match your design */
}
/* Your other styles go here if needed */
</style>

