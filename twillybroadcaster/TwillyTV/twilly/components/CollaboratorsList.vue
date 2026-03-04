<template>
  <div class="bg-black/30 backdrop-blur-sm rounded-lg border border-teal-500/30 p-4 sm:p-6">
    <h3 class="text-xl font-semibold text-white mb-4">
      Pending Collaborators
    </h3>
    
    <div v-if="pendingCollaborators.length === 0" class="text-gray-400 text-center py-4">
      No pending collaboration requests
    </div>

    <div v-else class="space-y-4">
      <div v-for="collab in pendingCollaborators" :key="collab.SK" 
           class="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-black/20 rounded-lg">
        <!-- Collaborator Info -->
        <div class="flex-1">
          <p class="text-white break-all">{{ collab.collaboratorEmail }}</p>
          <p class="text-sm text-gray-400 mt-1">
            Requested: {{ new Date(collab.timestamp).toLocaleDateString() }}
          </p>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button @click="approveCollaborator(collab)"
                  class="w-full sm:w-auto px-4 py-2 bg-teal-500/20 text-teal-300 
                         rounded-lg hover:bg-teal-500/30 transition-all duration-300">
            <span class="flex items-center justify-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5" />
              Approve
            </span>
          </button>
          <button @click="rejectCollaborator(collab)"
                  class="w-full sm:w-auto px-4 py-2 bg-red-500/20 text-red-300 
                         rounded-lg hover:bg-red-500/30 transition-all duration-300">
            <span class="flex items-center justify-center gap-2">
              <Icon name="heroicons:x-circle" class="w-5 h-5" />
              Reject
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Auth } from 'aws-amplify';

const props = defineProps({
  folderName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  }
});

const pendingCollaborators = ref([]);

// Fetch pending collaborators for this folder
const fetchPendingCollaborators = async () => {
  try {
    const user = await Auth.currentAuthenticatedUser();
    console.log('CollaboratorsList props:', {
      ownerEmail: user.attributes.email,
      folderName: props.folderName,
      category: props.category
    });

    const response = await fetch('/api/collaborations/pending', {
      method: 'POST',
      body: JSON.stringify({
        ownerEmail: user.attributes.email,
        folderName: props.folderName,
        category: props.category
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('Pending collaborators response:', data);
    pendingCollaborators.value = data.collaborators;
  } catch (error) {
    console.error('Error in fetchPendingCollaborators:', error);
  }
};

// Approve a collaborator
const approveCollaborator = async (collab) => {
  try {
    const response = await fetch('/api/collaborations/approve', {
      method: 'POST',
      body: JSON.stringify({
        collaboratorEmail: collab.collaboratorEmail,
        folderName: props.folderName,
        category: props.category
      })
    });
    
    if (response.ok) {
      await fetchPendingCollaborators(); // Refresh the list
    }
  } catch (error) {
    console.error('Error approving collaborator:', error);
  }
};

// Reject a collaborator
const rejectCollaborator = async (collab) => {
  try {
    const response = await fetch('/api/collaborations/reject', {
      method: 'POST',
      body: JSON.stringify({
        collaboratorEmail: collab.collaboratorEmail,
        folderName: props.folderName,
        category: props.category
      })
    });
    
    if (response.ok) {
      await fetchPendingCollaborators(); // Refresh the list
    }
  } catch (error) {
    console.error('Error rejecting collaborator:', error);
  }
};

// Fetch collaborators when component mounts
onMounted(() => {
  fetchPendingCollaborators();
  const interval = setInterval(fetchPendingCollaborators, 10000);
  onUnmounted(() => clearInterval(interval));
});
</script> 