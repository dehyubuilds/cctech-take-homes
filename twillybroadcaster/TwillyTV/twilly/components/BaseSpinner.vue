<template>
  <div :class="`base-spinner base-spinner__${variant}`"></div>
</template>

<script>
export default {
  name: 'BaseSpinner',
  props: {
    variant: {
      type: String,
      default: 'white'
    }
  }
}
</script>

<style>
.base-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
}

.base-spinner__white:after {
  border: 2px solid #fff !important;
  border-color: #fff transparent #fff transparent !important;
}

.base-spinner__primary:after {
  border: 2px solid #4E60FF !important;
  border-color: #4E60FF transparent #4E60FF transparent !important;
}

.base-spinner__secondary:after {
  border: 2px solid #FD6D22 !important;
  border-color: #FD6D22 transparent #FD6D22 transparent !important;
}

.base-spinner:after {
  content: " ";
  display: block;
  width: 16px;
  height: 16px;
  margin: 2px;
  border-radius: 50%;
  border: 2px solid #fff;
  border-color: #fff transparent #fff transparent;
  animation: lds-dual-ring 1.2s linear infinite;
}

@keyframes lds-dual-ring {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

</style>