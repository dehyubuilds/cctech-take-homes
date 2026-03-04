<template>
  <div class="base-checkbox__wrapper">
    <div
      :class="[
        'base-checkbox__checkbox',
        { isChecked: checked },
        { disabled: disabled },
      ]"
      @click="toggleCheckbox"
    >
      <!-- <font-awesome-icon class="base-checkbox__icon" icon="fa-solid fa-check" /> -->
      <Icon name="grommet-icons:checkmark" class="base-checkbox__icon" />
    </div>

    <div
      v-if="label"
      :class="['base-checkbox__label', { disabled: disabled }]"
      @click="toggleCheckbox"
    >
      {{ label }}
    </div>
  </div>
</template>

<script>
export default {
  name: "BaseCheckbox",
  props: {
    label: {
      type: String,
      default: "",
    },
    checked: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    toggleCheckbox() {
      if (!this.disabled) {
        this.$emit("onChange", !this.checked);
      }
    },
  },
};
</script>

<style>
.base-checkbox__wrapper {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0 12px;
}

.base-checkbox__label {
  color: #2b2b43;
  font-family: "Nunito", sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0.1px;
}

.base-checkbox__icon {
  color: #fff;
  display: none;
}

.base-checkbox__checkbox {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #c7c8d2;
  border-radius: 4px;
}

.base-checkbox__checkbox.isChecked {
  background-color: #4e60ff;
  border: 2px solid #4e60ff;
}

.base-checkbox__checkbox.disabled {
  background-color: #c7c8d2; /* Set the desired background color */
  border: 2px solid #c7c8d2; /* Border color for disabled state */
  cursor: not-allowed;
}

.base-checkbox__checkbox:hover:not(.disabled),
.base-checkbox__label:hover {
  cursor: pointer;
}
</style>
