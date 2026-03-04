<template>
  <div>
    <h1>COLLABORATOR SIMPLE PAGE</h1>
    <p>If you can see this, the collaborator routing works!</p>
    <div style="background: red; color: white; padding: 10px; margin: 10px 0;">
      RED DEBUG BOX - PAGE LOADED
    </div>
  </div>
</template>

<script setup>
console.log('🔥 SIMPLE COLLABORATOR PAGE SCRIPT LOADING');
console.log('🔥 SIMPLE SCRIPT IS EXECUTING');

import { ref } from 'vue';

const test = ref('test');

console.log('✅ Simple page imports successful');
</script>
