<template>
  <div class="task">
    <h3>{{ displayTaskReminder }}</h3>
    <div class="icons">
      <i class="material-icons" @click="taskStore.deleteTask(task.id)">
        delete
      </i>
      <i
        class="material-icons"
        :class="{ active: task.isFav }"
        @click="taskStore.toggleFav(task.id)"
      >
        favorite
      </i>
    </div>
  </div>
</template>

<script setup>
const taskStore = useTaskStore();
const setStatus = ref(null)
setStatus.value = taskStore.setStatus

import { useTaskStore } from "../stores/TaskStore";
import '~/assets/css/reminders.css'

const props = defineProps({
  task: Object,
});

const maxDisplayLength = 40; // You can adjust this value as needed

const displayTaskReminder = computed(() => {
  return props.task.reminder.length > maxDisplayLength
    ? props.task.reminder.substring(0, maxDisplayLength) + '...' // Truncate text
    : props.task.reminder;
});
</script>

<style>
@import url("~/assets/css/reminders.css");
</style>