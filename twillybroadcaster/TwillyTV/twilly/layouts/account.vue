<template>
  <div class="vertical-container">
    <NavBar/>
    <div class="mt-16">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.vertical-container {
  height: 100vh;
  overflow-y: auto;
}

</style>
 


