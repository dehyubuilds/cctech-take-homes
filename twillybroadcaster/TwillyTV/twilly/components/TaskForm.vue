<template>
  <form @submit.prevent="updateAdd" v-if="filter === 'add'">
    <input
      ref="newTaskInput"
      type="text"
      placeholder="ie. Family Pic in Cancun"
      v-model="newTask"
      class="special-input"
    />
    <button>
      <Icon
        name="grommet-icons:form-next-link"
        class="text-4xl"
        style="color: black"
      />
    </button>
    <p class="notification-text">*Enter your caption.</p>
  </form>

  <div v-if="filter === 'set' || filter === 'checkMark'">
    <form class="dateandtimepicker" @submit.prevent="handleTranslate" v-if="filter === 'set'">
      <!-- <div class="input-container"> -->
      <!-- <Icon
          name="icon-park:back"
          class="redo-icon"
          style="color: red; cursor: pointer"
          @click="handleFirstBackClick"
        /> -->
 
        <input
          ref="newTimeInput"
          v-model="newTime"
          type="datetime-local"
          placeholder="ie. Click to Select Date/Time"
          class="translate-date-time-input"
        />


      <!-- </div> -->
      <button class="buttonAdd" :disabled="loading">
        <span v-if="!loading">
          <Icon
            name="grommet-icons:form-next-link"
            class="text-4xl"
            style="color: black"
          />
        </span>
        <span v-else class="lds-ring">
          <!-- all divs needed for spinner do not remove-->
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <!-- all divs needed for spinner do not remove-->
        </span>
      </button>
      <p class="notification-text">Set Delivery Date and Time.</p>
    </form>

    <div v-if="filter === 'checkMark'">
      <form class="dateandtimepicker" @submit.prevent="pushReminder">
        <!-- <div class="input-container"> -->
        <!-- <Icon
            name="icon-park:back"
            class="redo-icon"
            style="color: red; cursor: pointer"
            @click="handleBackClick"
          /> -->
      
          <input
            ref="userModifiedTimeInput"
            type="datetime-local"
            placeholder="ie. Click to Edit Date/Time"
            v-model="userModifiedTime"
            class="translate-date-time-add"
            :disabled="editing"
          />
     
        <!-- </div> -->

        <button class="buttonCheckMark" :disabled="editing">
          <span v-if="!loading">
            <Icon
              name="grommet-icons:add"
              class="text-4xl"
              style="color: black"
            />
          </span>
          <span v-else class="lds-ring">
            <!-- all divs needed for spinner do not remove-->
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <!-- all divs needed for spinner do not remove-->
          </span>
        </button>

        <div class="task-container">
          <div class="task-icon-container">
            <p class="task-text" :disabled="!editing">
              <span v-if="!editing" style="color: #4299e1">Message: </span>
              <span v-if="editing">
                <input
                  ref="newTaskInput"
                  type="text"
                  v-model="editedTask"
                  class="new-task-edit-input"
                  @keydown.enter.prevent="finishEditing"
                />
              </span>
              <span v-if="!editing">{{ displayTaskText }}</span>
            </p>

            <div>
              <Icon
                v-if="!editing"
                @click="startEditing"
                name="mingcute:edit-line"
                class="icon-lg"
                style="color: #4299e1"
              />
              <label for="MediaInput" class="account__img-label">
                <Icon
                  v-if="!editing"
                  name="pajamas:media"
                  class="icon-lg"
                  style="color: #4299e1; cursor: pointer"
                />
              </label>

              <input
                id="MediaInput"
                type="file"
                accept="audio/*, image/*, video/*, application/pdf"
                style="display: none"
                @change="onImageUpload"
              />
            </div>

            <button
              style="margin-left: 8px"
              v-if="editing"
              @click="finishEditing"
            >
              Save
            </button>
            <div class="mb-1 ml-3 w-12" v-if="preview">
              <img :src="preview" class="img-fluid" />
            </div>
            <div
              class="mt-3 w-12"
              v-if="preview"
              @click="removeImage"
              style="color: red; font-size: 19px"
            >
              X
            </div>
          </div>
          <p class="notification-text">*Edit if incorrect. Press Enter.</p>
        </div>
      </form>
    </div>
  </div>
</template> 

<script setup>
import { useTaskStore } from "../stores/TaskStore";
import "~/assets/css/reminders.css";
import { Auth } from "aws-amplify";
import { ref } from "vue";
import { useUserStore } from "../stores/userStore";

const taskStore = useTaskStore();
const user = ref(null);
const newTask = ref(null);

const getDefaultDateTime = () => {
  const currentTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();

  // Set the timezone for the Date object
  now.toLocaleString("en-US", { timeZone: currentTimeZone });

  // Extract components of the date
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Month is zero-based
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  // Create the desired format
  const defaultDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

  return defaultDateTime;
};

const newTime = ref(getDefaultDateTime());
const editing = ref(false);
const readyToSet = ref(false);
const translateTime = ref(false);
const filter = ref("add");
const newTimestamp = ref(null);
const loading = ref(false);
const showUnverifiedMessage = ref(null);
const userModifiedTime = ref(null);
const newTaskInput = ref(null);
const newTimeInput = ref(null);
const userModifiedTimeInput = ref(null);
const editedTask = ref(null);
const focusOnUserModifiedTime = ref(true);
const image = ref(null);
const preview = ref(null);
const selectedFile = ref(null);

const supabase = useSupabaseClient();

const maxDisplayLength = 40; // You can adjust this value as needed

const displayTaskText = computed(() => {
  return newTask.value.length > maxDisplayLength
    ? newTask.value.substring(0, maxDisplayLength) + "..." // Truncate text
    : newTask.value;
});

watch(
  () => filter.value,
  (newFilter) => {
    const focusedInputRef = getFocusedInputRef();
  }
);

const onImageUpload = (event) => {
  selectedFile.value = event.target.files[0];
  const input = event.target;
  if (input.files) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.value = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
};

const removeImage = () => {
  preview.value = null; // Remove the image preview
  title.value = null; // Clear the selected image
};

const startEditing = () => {
  focusOnUserModifiedTime.value = !focusOnUserModifiedTime.value;
  editing.value = true;
  editedTask.value = newTask.value;

  // Use nextTick to wait for the DOM update
  nextTick(() => {
    const inputRef = getFocusedInputRef();
    if (inputRef && inputRef.value) {
      inputRef.value.focus();
    }
  });
};

const finishEditing = () => {
  editing.value = false;

  // Toggle focus between userModifiedTimeInput and newTaskInput
  focusOnUserModifiedTime.value = !focusOnUserModifiedTime.value;

  filter.value = "checkMark";
  nextTick(() => {
    const inputRef = getFocusedInputRef();
    if (inputRef && inputRef.value) {
      inputRef.value.focus();
    }
  });

  const inputRef = getFocusedInputRef();
  if (inputRef && inputRef.value) {
    inputRef.value.focus();

    // Update newTask with the edited text
    if (filter.value === "checkMark") {
      newTask.value = editedTask.value;
    }
  }
};

const getFocusedInputRef = () => {
  switch (filter.value) {
    case "add":
      return newTaskInput;
    case "set":
      return newTimeInput;
    case "checkMark":
      return focusOnUserModifiedTime.value
        ? userModifiedTimeInput
        : newTaskInput;
    default:
      console.warn(`Unexpected filter value: ${filter.value}`);
      return null;
  }
};

onMounted(async () => {
  try {
    nextTick(() => {
      const inputRef = getFocusedInputRef();
      if (inputRef && inputRef.value) {
        inputRef.value.focus();
      }
    });
    user.value = await Auth.currentAuthenticatedUser();
  } catch (error) {
    console.error(error);
    user.value = null; // Handle error appropriately
  }
});

const openFileUploader = () => {
  const fileInput = $refs.fileInput;

  // Trigger a click event on the hidden file input
  if (fileInput) {
    fileInput.click();
  }
};

// const handleFileChange = (event) => {
//   const selectedFile = event.target.files[0];

//   // Handle the selected file as needed, for example, you can upload it or process it
//   console.log("Selected File:", selectedFile);

//   // Add logic to handle the selected file, for example, you can upload it or process it
// };

const handleBackClick = () => {
  // Clear userModifiedTime
  filter.value = "set";
  nextTick(() => {
    const inputRef = getFocusedInputRef();
    if (inputRef && inputRef.value) {
      inputRef.value.focus();
    }
  });
  newTime.value = "";
  userModifiedTime.value = "";
  // Navigate to the specified div
};

const handleFirstBackClick = () => {
  // Clear userModifiedTime
  filter.value = "add";

  nextTick(() => {
    const inputRef = getFocusedInputRef();
    if (inputRef && inputRef.value) {
      inputRef.value.focus();
    }
  });

  newTime.value = "";
  userModifiedTime.value = "";

  // Navigate to the specified div
};

const handleTranslation = async (timezone) => {
  loading.value = true;

  const body = {
    newTask: newTime.value,
    timezone: timezone,
  };

  try {
    const response = await $fetch("/api/message/translate", {
      method: "post",
      body,
    });

    const result = JSON.parse(response.data.Payload);
    const responseAsObject = JSON.parse(result.body);
    const timestamp = responseAsObject.parsed_date;

    if (timestamp === "Date not recognized") {
      filter.value = "set";
      newTime.value = "Invalid Entry. Re-Enter.";

      setTimeout(() => {
        newTime.value = ""; // Clear the Invalid Entry after 1 second
      }, 1000);

      return; // Exit the method
    }
    const parsedTimestamp = new Date(timestamp);
    const humanReadableFormat = parsedTimestamp.toLocaleString();

    // Store both the original translated date and the user-modified date
    newTime.value = timestamp;
    userModifiedTime.value = newTime.value;
    newTimestamp.value = timestamp;
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }

  filter.value = "checkMark";
  nextTick(() => {
    const inputRef = getFocusedInputRef();
    if (inputRef && inputRef.value) {
      inputRef.value.focus();
    }
  });
};

const handleTranslate = async () => {
  const currentTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    await handleTranslation(currentTimeZone);
  } catch (error) {
    console.error(error);
  }
};

const pushReminder = async () => {

  loading.value = true;

  showUnverifiedMessage.value = useUserStore().getUserPhoneNumber();

  // Use userModifiedTime if it has been modified; otherwise, use newTime
  const timestampToUse =
    userModifiedTime.value.length > 0 ? userModifiedTime.value : newTime.value;

  if (newTask.value.length > 0 && timestampToUse.length) {
    try {

      const newISO8601Timestamp = new Date(timestampToUse).toISOString();

      let imageValue = ""; // Variable to store the image URL

      if (selectedFile.value) {
        // If a file is selected, upload it
        const fileName = Math.floor(
          Math.random() * 10000000000000000000000000000000000000000
        );

        const { data, error } = await supabase.storage
          .from("twillyprofileimages")
          .upload("public/" + fileName, selectedFile.value);

     

        if (!error) {
          // If upload is successful, set the image URL
          imageValue = `https://robnzvmxloirfrqknunn.supabase.co/storage/v1/object/public/twillyprofileimages/public/${fileName}`;
        }
      }

      await taskStore.addTask({
        id: new Date().getTime().toString(),
        reminder: newTask.value,
        title: imageValue, // Use the image URL, whether it's empty or not
        schedulerId: user.value.username,
        isFav: false,
        timestamp: newISO8601Timestamp,
      });

      // Reset values
      newTask.value = "";
      userModifiedTime.value = "";
      newTime.value = "";
      title.value = "";
      preview.value = "";
      selectedFile.value = "";
      filter.value = "add";
    } catch (error) {
      console.error(error);
    } finally {
      loading.value = false;
      // Set focus to newTaskInput after the task is added
      nextTick(() => {
        const inputRef = getFocusedInputRef();
        if (inputRef && inputRef.value) {
          inputRef.value.focus();
        }
      });
    }
  }
};

const updateAdd = () => {
  filter.value = "set";

  // nextTick(() => {
  //   const inputRef = getFocusedInputRef();
  //   if (inputRef && inputRef.value) {
  //     inputRef.value.focus();
  //   }
  // });
};

const uploadToS3 = async () => {
  try {
    // TODO: Implement AWS S3 upload logic
    console.log('Uploading to AWS S3...');
    alert('S3 upload functionality coming soon!');
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    alert('Upload failed: ' + error.message);
  }
};
</script> 

<style>
@import url("~/assets/css/reminders.css");
</style>