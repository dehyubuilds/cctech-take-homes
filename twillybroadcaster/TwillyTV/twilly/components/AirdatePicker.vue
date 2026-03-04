<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96 max-w-md">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold text-white">{{ getModalTitle() }}</h3>
          <p class="text-xs text-gray-400">Timezone: {{ timezone }}</p>
        </div>
        <button @click="closeModal" class="text-gray-400 hover:text-white">
          <Icon name="heroicons:x-mark" class="w-6 h-6" />
        </button>
      </div>
      
      <div class="space-y-4">
        <!-- Current Schedule Display -->
        <div v-if="currentAirdate" class="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3">
          <div class="flex items-center gap-2 mb-2">
            <Icon name="heroicons:clock" class="w-5 h-5 text-blue-400" />
            <p class="text-blue-300 text-sm font-medium">{{ getAirdateLabel() }}</p>
          </div>
          <p class="text-white text-sm">{{ formatAirdate(currentAirdate) }}</p>
          <p class="text-xs text-blue-300 mt-1">{{ timezone }}</p>
          

        </div>
        
        <!-- Warning for already visible episodes -->
        <div v-if="props.isVisible" class="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
          <div class="flex items-center gap-2">
            <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 text-yellow-400" />
            <p class="text-yellow-300 text-sm">This episode is already visible. You can only schedule airdates for episodes that are not currently visible.</p>
          </div>
        </div>
        
        <!-- Date Picker -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Date</label>
          <input 
            type="date" 
            v-model="selectedDate" 
            class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
            :min="minDate"
            :disabled="props.isVisible"
          />
        </div>
        
        <!-- Time Picker -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Time (24-hour format)</label>
          <input 
            type="time" 
            v-model="selectedTime" 
            class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
            step="60"
            :disabled="props.isVisible"
          />
          <p class="text-xs text-gray-400 mt-1">Enter time in 24-hour format (e.g., 16:04 for 4:04 PM)</p>
        </div>
        
        <!-- Preview -->
        <div v-if="previewDateTime" class="bg-gray-800 rounded-lg p-3">
          <p class="text-sm text-gray-300">Scheduled for:</p>
          <p class="text-white font-medium">{{ previewDateTime }}</p>
          <p class="text-xs text-gray-400 mt-1">{{ timezone }}</p>
        </div>
        
        <!-- Buttons -->
        <div class="flex gap-3 pt-4">
          <button 
            @click="closeModal"
            class="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button 
            @click="scheduleAirdate"
            :disabled="!isValid || isScheduling || props.isVisible"
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Icon v-if="isScheduling" name="heroicons:arrow-path" class="w-4 h-4 animate-spin inline mr-2" />
            {{ isScheduling ? 'Scheduling...' : getButtonText() }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  episodeId: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  seriesName: {
    type: String,
    required: true
  },
  isVisible: {
    type: Boolean,
    default: false
  },
  currentAirdate: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'scheduled'])

const selectedDate = ref('')
const selectedTime = ref('')
const isScheduling = ref(false)

// Set default time to current date and time
onMounted(() => {
  const now = new Date()
  console.log('Current time:', now.toLocaleString())
  
  // Use local date and time as default (not UTC)
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  
  selectedDate.value = `${year}-${month}-${day}`
  selectedTime.value = `${hours}:${minutes}`
  
  console.log('Set date to:', selectedDate.value)
  console.log('Set time to:', selectedTime.value)
})

const minDate = computed(() => {
  return new Date().toISOString().split('T')[0]
})

const previewDateTime = computed(() => {
  if (!selectedDate.value || !selectedTime.value) return null
  const dateTime = new Date(`${selectedDate.value}T${selectedTime.value}`)
  console.log('Preview DateTime:', {
    selectedDate: selectedDate.value,
    selectedTime: selectedTime.value,
    dateTime: dateTime,
    localString: dateTime.toLocaleString()
  })
  return dateTime.toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
})

const isValid = computed(() => {
  if (!selectedDate.value || !selectedTime.value) return false
  const dateTime = new Date(`${selectedDate.value}T${selectedTime.value}`)
  // Allow current time for display, but user should set future time
  return dateTime >= new Date()
})

const isPastAirdate = computed(() => {
  if (!props.currentAirdate) return false
  const airdate = new Date(props.currentAirdate)
  const now = new Date()
  return airdate <= now
})

const timezone = computed(() => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
})

// Add function to format airdate
const formatAirdate = (airdate) => {
  if (!airdate) return '';
  const date = new Date(airdate);
  return date.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
};

const closeModal = () => {
  emit('close')
}

const getModalTitle = () => {
  return props.currentAirdate ? 'Edit Airdate' : 'Schedule Airdate'
}

const getAirdateLabel = () => {
  if (!props.currentAirdate) return 'Last Airdate';
  const now = new Date();
  const airdate = new Date(props.currentAirdate);
  return airdate > now ? 'Future Airdate' : 'Last Airdate';
};

const getButtonText = () => {
  if (props.isVisible) return 'Already Visible'
  if (props.currentAirdate) return 'Update Schedule'
  return 'Schedule'
}

const scheduleAirdate = async () => {
  if (!isValid.value) return
  
  isScheduling.value = true
  
  try {
    const dateTime = new Date(`${selectedDate.value}T${selectedTime.value}`)
    const now = new Date()
    const isPastOrCurrent = dateTime <= now
    
    console.log('Time comparison:', {
      scheduledTime: dateTime.toISOString(),
      currentTime: now.toISOString(),
      isPastOrCurrent
    })
    
    if (isPastOrCurrent) {
      // For immediate visibility, update the episode directly like the eye button
      console.log('Airdate is in the past or current time, making episode visible immediately')
      
      const updatePayload = {
        fileId: props.episodeId,
        PK: `USER#${props.userId}`,
        title: '', // Keep existing title
        description: '', // Keep existing description
        price: 0, // Keep existing price
        isVisible: true // Make visible immediately
      }
      
      console.log('Making episode visible with payload:', updatePayload)
      
      const response = await $fetch('/api/files/update-details', {
        method: 'PUT',
        body: updatePayload
      })
      
      if (response.success) {
        emit('scheduled', { immediate: true, episodeId: props.episodeId })
        closeModal()
      } else {
        throw new Error(response.message || 'Failed to make episode visible')
      }
    } else {
      // For future airdates, update the airdate in DynamoDB AND trigger Step Function
      console.log('Airdate is in the future, updating airdate and scheduling Step Function')
      
      // First update the airdate in DynamoDB
      const updatePayload = {
        fileId: props.episodeId,
        PK: `USER#${props.userId}`,
        airdate: dateTime.toISOString()
      }
      
      console.log('Updating airdate with payload:', updatePayload)
      
      const updateResponse = await $fetch('/api/files/update-details', {
        method: 'PUT',
        body: updatePayload
      })
      
      if (!updateResponse.success) {
        throw new Error(updateResponse.message || 'Failed to update airdate')
      }
      
      // Then trigger the Step Function for future scheduling
      const schedulePayload = {
        episodeId: props.episodeId,
        userId: props.userId,
        seriesName: props.seriesName,
        airdate: dateTime.toISOString()
      }
      
      console.log('Triggering Step Function with payload:', schedulePayload)
      
      const scheduleResponse = await $fetch('/api/episodes/schedule-airdate', {
        method: 'POST',
        body: schedulePayload
      })
      
      if (scheduleResponse.success) {
        emit('scheduled', { immediate: false, episodeId: props.episodeId, airdate: dateTime.toISOString() })
        closeModal()
      } else {
        throw new Error(scheduleResponse.message || 'Failed to schedule airdate')
      }
    }
  } catch (error) {
    console.error('Error scheduling airdate:', error)
    alert(`Error: ${error.message || 'Failed to schedule airdate'}`)
  } finally {
    isScheduling.value = false
  }
}
</script> 