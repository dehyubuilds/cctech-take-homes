<template>
    <div class="new-task-form">
        <div v-if="selectedName === 'Upload'">
            <header>
                <h1>Upload Media</h1>
            </header>
        </div>
        <div v-else>
            <header>
                <h1>My Media</h1>
            </header>
        </div>

        <nav class="flex justify-center items-center gap-2 mt-5">
            <nuxt-link
                :class="{ 'selected-button': selectedName === 'Upload' }"
                class="transform rounded bg-gradient-to-br from-blue-400 to-blue-600 py-2 px-3 font-semibold text-slate-200 shadow transition hover:scale-110"
                @click="showGreeting('Upload')"
            >
                Upload
            </nuxt-link>

            <nuxt-link
                :class="{ 'selected-button': selectedName === 'Share' }"
                class="transform rounded bg-gradient-to-br from-green-400 to-green-600 py-2 px-3 font-semibold text-slate-200 shadow transition hover:scale-110"
                @click="showGreeting('Share')"
            >
                Share
            </nuxt-link>
        </nav>

        <!-- Display the greeting for Upload -->
        <div v-if="selectedName === 'Upload'" class="text-center mt-5">
            Upload
        </div>

        <!-- Display the greeting for Share -->
        <div v-if="selectedName === 'Share'" class="text-center mt-5">
            Media
        </div>
    </div>
</template>

<script setup>
    definePageMeta({
        middleware: ["account"],
    });
    const selectedName = ref("Upload");

    const showGreeting = (name) => {
        selectedName.value = name;
    };
</script>

<style scoped>
    @import url("~/assets/css/reminders.css");
    .selected-button {
        border: 2px solid #4299e1; /* Set the border color to match your design */
    }

    /* Your other styles go here if needed */
</style>
