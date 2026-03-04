<template>
    <div>
      <button
        @click="openDialog"
        class="text-sm text-white px-4 py-2 rounded-md bg-teal-500 hover:bg-teal-600 transition-colors duration-300 ease-in-out shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:ring-opacity-50 mt-4"     >
        Collaborators
      </button>
      <CollaboratorDialog v-if="showDialog" @close="closeDialog">
        <template #title>Share Collaborator link</template>
        <template #body>
          <div class="flex items-center space-x-2">
            <span class="border rounded p-2 w-full truncate">{{
              collaboratorLink
            }}</span>
          </div>
        </template>
        <template #footer>
          <div class="flex items-center space-x-2">
            <button
              @click="copyToClipboard"
              :class="buttonClass"
              class="rounded-md px-4 py-2"
            >
              Copy Link
            </button>
            <span v-if="buttonClicked" class="text-red-600">Link copied</span>
          </div>
        </template>
      </CollaboratorDialog>
    </div>
  </template>
  
  <script setup>
  import { useTaskStore } from "~/stores/TaskStore";
  import { ref, computed } from "vue";
  import { defineProps } from "vue";
  import { Auth } from "aws-amplify";
  import { $fetch } from "ohmyfetch";
  
  const taskStore = useTaskStore();
  const props = defineProps(["folder", "category", "email","seriesPosterUrl"]);
  
  const showDialog = ref(false);
  const collaboratorLink = ref("");
  const buttonClicked = ref(false);
  const selectedUsers = ref([]);
  
  const openDialog = async () => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      
      // Create collaboration record
      const collaborationData = {
        producerId: user.attributes.email,
        folderName: props.folder,
        category: props.category,
        collaborators: selectedUsers.value.map(u => ({
          email: u,
          status: 'PENDING',
          permissions: {
            canUpload: true,
            requiresApproval: true
          }
        })),
        settings: {
          autoApprove: false,
          notifyOnUpload: true
        }
      };

      // Save collaboration to DynamoDB
      await $fetch('/api/collaborations/create', {
        method: 'POST',
        body: collaborationData
      });

      // Generate and save short URL for sharing
      const shareUrl = `${window.location.origin}/channel/collab/${encodeURIComponent(user.attributes.email)}/${encodeURIComponent(props.folder)}/${props.category}/${encodeURIComponent(props.seriesPosterUrl)}`;
      
      // Send invitations
      await Promise.all(selectedUsers.value.map(email => 
        $fetch('/api/collaborations/invite', {
          method: 'POST',
          body: {
            producerId: user.attributes.email,
            collaboratorEmail: email,
            folderName: props.folder,
            category: props.category,
            shareUrl
          }
        })
      ));

      alert('Invitations sent successfully!');
    } catch (error) {
      console.error('Error sharing folder:', error);
      alert('Failed to share folder: ' + error.message);
    }
  };
  
  const closeDialog = () => {
    showDialog.value = false;
    collaboratorLink.value = "";
    buttonClicked.value = false;
    document.body.classList.remove("dialog-open");
  };
  
  const copyToClipboard = () => {
    if (!collaboratorLink.value) {
      console.error("No link to copy.");
      return;
    }
    const el = document.createElement("textarea");
    el.value = collaboratorLink.value;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    buttonClicked.value = true;
  
    // Hide the notification after 3 seconds
    setTimeout(() => {
      buttonClicked.value = false;
    }, 3000);
  };
  
  function constructShareableLink(folder, category, email,seriesPosterUrl) {
    const encodedFolder = encodeURIComponent(folder.trim());
    const encodedCategory = encodeURIComponent(category.trim());
    const encodedSeriesPosterUrl = encodeURIComponent(seriesPosterUrl.trim())
    console.log(encodedSeriesPosterUrl)
    return `https://twilly.app/channel/collab/${email}/${encodedFolder}/${encodedCategory}/${encodedSeriesPosterUrl}`;
  }
  
  const buttonClass = computed(() => {
    return buttonClicked.value
      ? "bg-green-600"
      : "bg-blue-400 hover:bg-blue-400";
  });
  </script>
  
  <style scoped>
  .dialog-content {
    background: white;
    border-radius: 5px;
    padding: 20px;
    z-index: 2001; /* Ensure content is above backdrop */
  }
  </style>
  

<style scoped>
.dialog-content {
  background: white;
  border-radius: 5px;
  padding: 20px;
  z-index: 2001; /* Ensure content is above backdrop */
}
</style>
