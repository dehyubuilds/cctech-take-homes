<template>
  <div class="base-input">
    <label class="base-input__label" for="email">{{ label }}</label>

    <div :class="`base-input__wrapper ${!!error ? 'has-error' : ''}`">
      <input
        class="base-input__input"
        :value="value"
        :type="
          type === 'password' ? (showPassword ? 'text' : 'password') : type
        "
        :placeholder="placeholder"
        @input="handleInputChange"
        required
        :disabled="disabled"
      />

      <div v-if="type === 'password'" class="base-input__append">
        <button
          v-if="showPassword"
          class="base-input__password-toggle"
          @click="togglePasswordShow"
        >
          <!-- <font-awesome-icon icon="fa-eye" /> -->
          <Icon name="grommet-icons:View" />
        </button>

        <button
          v-else
          class="base-input__password-toggle"
          @click="togglePasswordShow"
        >
          <!-- <font-awesome-icon icon="fa-eye-slash" /> -->
          <Icon name="grommet-icons:Hide" />
        </button>
      </div>
    </div>
    <div v-if="!!error" class="base-input__error">
      {{ error }}
    </div>
  </div>
</template>

<script>
export default {
  name: "BaseInput",
  props: {
    label: {
      type: String,
      default: "",
    },
    value: {
      type: String,
      default: "",
    },
    placeholder: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      default: "",
    },
    showPassword: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    error: {
      type: String,
      default: "",
    },
  },
  methods: {
    togglePasswordShow() {
      this.$emit("onPasswordToggle");
    },
    handleInputChange(e) {
      this.$emit("onInput", e.target.value);
    },
  },
};
</script>

<style>
.base-input {
  width: 100%;
  padding: 1px 16px 32px 0;
  margin-bottom: 12px;
  font-size: 12px;
}

.base-input__label {
  display: block;
  font-family: "Nunito", sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 16px;
  margin-bottom: 8px;
  color: #545563;
}

.base-input__wrapper {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto;
  border: 1px solid #83859c;
  border-radius: 8px;
  box-sizing: border-box;
  overflow: hidden;
}

.base-input__wrapper.has-error {
  border: 1px solid #ff5c60;
}

.base-input__wrapper:hover {
  border: 1px solid #2b2b43;
}

.base-input__input {
  color: #2b2b43;
  width: 100%;
  height: 44px;
  border: none;
  outline: none;
  padding: 12px 4px 12px 12px;
  letter-spacing: 0.1px;
  font-family: "Nunito", sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 20px;
}
.profile-notifications__wrapper.disabled {
  opacity: 0.5; /* Adjust the opacity or other styles as needed */
  pointer-events: none; /* Disable pointer events */
}

.base-input__input:disabled {
  color: #2b2b43 !important;
}

.base-input__append {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
}

.base-input__password-toggle {
  cursor: pointer;
  padding: 0;
  margin: 0;
  border: none;
  background: unset;
  transition: color 0.25s ease-in-out;
  color: #83859c;
}

.base-input__password-toggle:hover {
  color: #545563;
}

.base-input__password-toggle:focus-visible {
  outline: 2px solid #4e60ff;
}

.base-input__error {
  font-family: "Nunito", sans-serif;
  font-size: 12px;
  font-weight: 700;
  padding: 0 8px;
  margin-top: 4px;
  color: #ff5c60;
}

@media screen and (max-width: 768px) {
  .base-input__input {
    font-size: 10px;
  }
}
</style>
