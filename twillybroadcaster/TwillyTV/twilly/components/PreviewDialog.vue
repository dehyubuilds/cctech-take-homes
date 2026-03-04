<template>
  <div class="dialog-backdrop" @click.self="close">
    <div class="dialog-content">
      <header class="dialog-header">
        <slot name="title"></slot>
      </header>
      <div class="dialog-body">
        <slot name="body"></slot>
      </div>
      <footer class="dialog-footer">
        <slot name="footer"></slot>
      </footer>
    </div>
  </div>
</template>
  
  <script setup>
import { defineProps, defineEmits } from "vue";

const props = defineProps({
  show: {
    type: Boolean,
    required: false,
  },
});
const emits = defineEmits(["close"]);

const close = () => {
  emits("close");
};
</script>
  
  <style scoped>
.dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 2000;
}
.dialog-content {
  background: white;
  border-radius: 5px;
  overflow: hidden;
  width: 400px;
  max-width: 90%;
}
.dialog-header,
.dialog-footer {
  padding: 10px;
  background: #f1f1f1;
}
.dialog-body {
  padding: 20px;
}
</style>
  