<template>
  <div>
    <h1 style="color: red; font-size: 48px;">COLLABORATOR DEBUG PAGE</h1>
    <p style="color: white; font-size: 24px;">If you can see this, the collaborator routing works!</p>
    <div style="background: red; color: white; padding: 20px; margin: 20px 0; font-size: 20px;">
      RED DEBUG BOX - PAGE LOADED SUCCESSFULLY
    </div>
  </div>
</template>

<script setup>
console.log('🔥 DEBUG COLLABORATOR PAGE SCRIPT LOADING');
console.log('🔥 DEBUG SCRIPT IS EXECUTING');

import { ref } from 'vue';

const test = ref('test');

console.log('✅ Debug page imports successful');
</script>
