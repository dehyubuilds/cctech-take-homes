<template>
  <div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
    <div class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-teal-500/20 
                shadow-xl shadow-teal-500/10 p-6 max-w-md w-full mx-auto 
                transform transition-all duration-300 scale-95 hover:scale-100">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show: {
    type: Boolean,
    default: false
  }
});
</script> 