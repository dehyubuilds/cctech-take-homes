<template>
  <div class="bg-black/30 backdrop-blur-sm rounded-lg border border-teal-500/30 p-4 sm:p-6">
    <h3 class="text-xl font-semibold text-white mb-4">
      Manage All Collaboration Requests
    </h3>
    
    <div v-if="allCollaborations.length === 0" class="text-gray-400 text-center py-4">
      No collaboration requests found
    </div>

    <div v-else class="space-y-4">
      <div v-for="collab in allCollaborations" :key="collab.SK" 
           class="flex flex-col p-4 bg-black/20 rounded-lg">
        <!-- Top section with info and approve/reject -->
        <div class="flex flex-col sm:flex-row gap-4">
          <!-- Collaborator Info -->
          <div class="flex-1">
            <p class="text-white text-sm sm:text-base">{{ collab.collaboratorEmail }}</p>
            <p class="text-sm text-teal-400 mt-1">{{ collab.folderName }}</p>
            <div class="flex flex-col sm:flex-row sm:gap-4 mt-1">
              <p class="text-sm text-gray-400">
                Status: <span :class="collab.status === 'pending' ? 'text-yellow-400' : 'text-teal-400'">
                  {{ collab.status }}
                </span>
              </p>
              <p class="text-sm text-gray-400">
                Requested: {{ new Date(collab.timestamp).toLocaleDateString() }}
              </p>
            </div>
          </div>
          
          <!-- Approve/Reject Buttons -->
          <div v-if="collab.status === 'pending'" 
               class="flex flex-col sm:flex-row gap-2 sm:self-start">
            <button @click="approveCollaboration(collab)"
                    class="w-full sm:min-w-[100px] px-4 py-2 bg-teal-500/20 text-teal-300 
                           rounded-lg hover:bg-teal-500/30 transition-all duration-300 whitespace-nowrap">
              <span class="flex items-center justify-center gap-2">
                <Icon name="heroicons:check-circle" class="w-5 h-5" />
                Approve
              </span>
            </button>
            <button @click="rejectCollaboration(collab)"
                    class="w-full sm:min-w-[100px] px-4 py-2 bg-yellow-500/20 text-yellow-300 
                           rounded-lg hover:bg-yellow-500/30 transition-all duration-300 whitespace-nowrap">
              <span class="flex items-center justify-center gap-2">
                <Icon name="heroicons:x-circle" class="w-5 h-5" />
                Reject
              </span>
            </button>
          </div>
        </div>

        <!-- Delete Button - Always at bottom -->
        <div class="mt-4 sm:mt-2 flex justify-end">
          <button @click="deleteCollaboration(collab)"
                  class="w-full sm:w-auto sm:min-w-[100px] px-4 py-2 bg-red-500/20 text-red-300 
                         rounded-lg hover:bg-red-500/30 transition-all duration-300 whitespace-nowrap">
            <span class="flex items-center justify-center gap-2">
              <Icon name="heroicons:trash" class="w-5 h-5" />
              Delete
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Auth } from 'aws-amplify';

const allCollaborations = ref([]);

const fetchAllCollaborations = async () => {
  try {
    const user = await Auth.currentAuthenticatedUser();
    const response = await fetch('/api/collaborations/list', {
      method: 'POST',
      body: JSON.stringify({
        ownerEmail: user.attributes.email
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch collaborations');
    }

    const data = await response.json();
    // Filter out invalid entries
    allCollaborations.value = (data.collaborations || []).filter(collab => 
      collab && collab.collaboratorEmail && collab.folderName
    );
  } catch (error) {
    console.error('Error fetching collaborations:', error);
    allCollaborations.value = [];
  }
};

const deleteCollaboration = async (collab) => {
  try {
    // Validate collab object
    if (!collab || !collab.collaboratorEmail || !collab.folderName) {
      console.error('Invalid collaboration data:', collab);
      alert('Invalid collaboration data');
      return;
    }

    const user = await Auth.currentAuthenticatedUser();
    const ownerEmail = user.attributes.email;

    if (!confirm(`Delete collaboration request from ${collab.collaboratorEmail} for ${collab.folderName}?`)) {
      return;
    }

    const response = await fetch('/api/collaborations/delete', {
      method: 'POST',
      body: JSON.stringify({
        ownerEmail,
        collaboratorEmail: collab.collaboratorEmail,
        folderName: collab.folderName
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete collaboration');
    }

    await fetchAllCollaborations();
    // Add success message
    alert(`Successfully deleted collaboration with ${collab.collaboratorEmail}`);
  } catch (error) {
    console.error('Error deleting collaboration:', error);
    alert('Failed to delete collaboration: ' + error.message);
  }
};

// Add approve/reject functions
const approveCollaboration = async (collab) => {
  try {
    const user = await Auth.currentAuthenticatedUser();
    const response = await fetch('/api/collaborations/approve', {
      method: 'POST',
      body: JSON.stringify({
        ownerEmail: user.attributes.email,
        collaboratorEmail: collab.collaboratorEmail,
        folderName: collab.folderName
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to approve collaboration');
    }

    await fetchAllCollaborations();
    alert(`Successfully approved collaboration with ${collab.collaboratorEmail}`);
  } catch (error) {
    console.error('Error approving collaboration:', error);
    alert('Failed to approve collaboration: ' + error.message);
  }
};

const rejectCollaboration = async (collab) => {
  try {
    const user = await Auth.currentAuthenticatedUser();
    const response = await fetch('/api/collaborations/reject', {
      method: 'POST',
      body: JSON.stringify({
        ownerEmail: user.attributes.email,
        collaboratorEmail: collab.collaboratorEmail,
        folderName: collab.folderName
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reject collaboration');
    }

    await fetchAllCollaborations();
    alert(`Successfully rejected collaboration with ${collab.collaboratorEmail}`);
  } catch (error) {
    console.error('Error rejecting collaboration:', error);
    alert('Failed to reject collaboration: ' + error.message);
  }
};

onMounted(fetchAllCollaborations);
</script> 