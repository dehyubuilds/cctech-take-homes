<template>
  <button
    type="button"
    :class="['Tab', { 'Tab--active': isTabActive }, { 'Tab--disabled': disabled }]"
    :disabled="disabled"
    @click="handleSelectTab"
  >
    {{ name }}

    <span class="Tab__badge" data-testid="badge" v-if="hasTotal">{{ total }}</span>
  </button>
</template>

<script setup>
import { computed, ref, inject } from 'vue'

const { name, total, disabled } = defineProps(['name', 'total', 'disabled'])
const activeTab = inject('activeTab') as ref<string>
const tabChangeEmitter = inject('tabChangeEmitter') as (a: string) => void

const isTabActive = computed(() => name === activeTab.value)
const hasTotal = computed(() => total !== undefined)

const handleSelectTab = () => {
  if (!disabled) tabChangeEmitter(name)
}
</script>

<style scoped lang="scss">
.Tab {
  width: 100%;
  min-height: 60px;
  display: flex;
  gap: 8px;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: rem(20px 28px);
  font-weight: 600;
  border: 0;
  background: var(--concept-over-background);
  color: var(--concept-text-secondary);
  transition: color 200ms, background-color 200ms, opacity 200ms;
  cursor: pointer;

  &:not(:disabled):hover {
    opacity: 0.8;
  }

  &--active {
    color: var(--concept-text-primary);
    background: var(--concept-over-background-element);

    &__badge {
      background: var(--concept-over-background);
    }
  }

  &--disabled {
    color: var(--concept-text-faded);
    cursor: not-allowed;
  }

  &__badge {
    padding: rem(3px 12px);
    font-size: rem(14px);
    line-height: 1;
    border-radius: $border-radius-m;
    background: var(--concept-over-background-element);
  }
}
</style>
