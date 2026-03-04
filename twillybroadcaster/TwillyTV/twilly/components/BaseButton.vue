<template>
  <button
    :class="'base-btn base-btn-' + variant"
    :disabled="disabled"
    @click="handleClick"
  >
    <BaseSpinner v-if="loading" />
    <slot v-else />
  </button>
</template>

<script>
export default {
  name: "BaseButton",
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
    variant: {
      type: String,
      default: "primary",
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    handleClick() {
      this.$emit("onClick");
    },
  },
};
</script>

<style>
.base-btn {
  cursor: pointer;
  font-size: 14px;
  line-height: 20px;
  font-family: "Nunito", sans-serif;
  font-weight: bold;
  padding: 12px 16px;
  border-radius: 8px;
  color: #fff;
  background-color: #4e60ff;
  border: none;
  transition: box-shadow 0.15s ease-in-out;
  margin-bottom: 20px;
}

.verifyBtn {
  padding: 8px 12px;
  /* Add any specific styles for the "Submit Code" button */
}

.base-btn:hover {
  box-shadow: 0px 8px 20px rgba(0, 0, 0, 0.16);
}

.base-btn-primary {
  background-color: #4e60ff;
  border: none;
  color: #fff;
}

.base-btn-primary-outline {
  background-color: #fff;
  border: 1px solid #4e60ff;
  box-shadow: none;
  color: #4e60ff;
}



.account__btns-discardBtn {
  background-color: red
}

.base-btn-danger {
  background-color: #ff5c60;
  border: none;
  color: #fff;
}

.base-btn-danger-outline {
  background-color: #fff;
  border: 1px solid #ff5c60;
  box-shadow: none;
  color: #ff5c60;
}

.base-btn-none {
  cursor: pointer;
  border: none;
  background: none;
  font-family: "Nunito", sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0.3px;
  margin-left: 32px;
  color: #83859c;
}

.base-btn:disabled {
  cursor: not-allowed;
  background-color: #fff;
  border: 1px solid #83859c;
  box-shadow: none;
  color: #83859c;
}
</style>
