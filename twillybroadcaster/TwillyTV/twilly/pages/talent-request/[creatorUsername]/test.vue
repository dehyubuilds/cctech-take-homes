<template>
  <div>
    <h1>Talent Request Test Page</h1>
    <p>Creator: {{ creatorUsername }}</p>
    <p>Channel: {{ channelId }}</p>
  </div>
</template>

<script setup>
const route = useRoute()
const creatorUsername = route.params.creatorUsername
const channelId = route.params.channelId
</script>
