<script setup>
import logo from "@/assets/twillyhead.png";

const title = ref("Twilly");
const description = ref("Twilly App");
const ogImageUrl = logo;

// This will be reactive even you change title/description above
useHead({
  title,
  meta: [
    { hid: "description", name: "description", content: description },
    { hid: "og:title", property: "og:title", content: title },
    {
      hid: "og:description",
      property: "og:description",
      content: description,
    },
    {
      hid: "og:image",
      property: "og:image",
      content: ogImageUrl,
    },

    // twitter card
    {
      hid: "twitter:description",
      name: "twitter:description",
      content: description,
    },
    {
      hid: "twitter:image",
      name: "twitter:image",
      content: ogImageUrl,
    },
  ],
});
const error = useError();

const handleError = () => {
  clearError({
    redirect: "/",
  });
};
</script>

<template>
  <div class="flex h-screen justify-center items-center flex-col">
    <h1 class="text-9xl">{{ error.statusCode }}</h1>
    <p class="mt-7 text-4xl">{{ error.message }}</p>
    <button
      @click="handleError"
      class="rounded mt-7 text-2xl bg-blue-400 px-7 py-4 text-white"
    >
      Go Back
    </button>
  </div>
</template>