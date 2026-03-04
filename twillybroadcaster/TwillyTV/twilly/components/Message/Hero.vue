<script setup>
import logo from "@/assets/twillyhead.png";

const title = ref("Twilly - Global Content Collaboration Platform");
const description = ref("Connect, collaborate, and create web series with content creators worldwide");
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
</script>

<template>
  <div class="relative h-screen bg-gradient-to-br from-[#084d5d] to-black">
    <div class="z-10 absolute w-full h-full flex flex-col justify-center items-center px-4">
      <div class="text-center max-w-3xl mx-auto">
        <NuxtLink to="/home">
          <button class="text-lg bg-teal-500 hover:bg-teal-600 text-white font-bold py-4 px-8 rounded-lg transition duration-300">
            Get Started
          </button>
        </NuxtLink>
      </div>
    </div>
    <div class="z-1 absolute w-full h-full bg-black/40"></div>
  </div>
</template>
