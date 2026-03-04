<template>
  <div>
    <button class="tag-button" @click="toggleDrawer">EDIT</button>
    <div class="drawer" v-show="showDrawer">
      <div class="bold-header">Series Name</div>
      <input
        type="text"
        class="tag-input"
        placeholder="Add Series Name"
        v-model="folderName"
      />
      <div class="bold-header">Title</div>
      <textarea
        type="text"
        class="tag-input"
        placeholder="Add Title"
        v-model="title"
      ></textarea>
      <div class="bold-header">Description</div>
      <textarea
        class="tag-input"
        placeholder="Add Description"
        v-model="description"
      ></textarea>

      <div class="bold-header">Price (USD)</div>
      <div class="price-box">
        <input
          type="text"
          class="tag-input"
          placeholder="Enter Price (e.g. 2.50)"
          v-model="payPerViewPrice"
          @input="handlePriceInput"
        />
      </div>
      
      <div class="button-group">
        <button class="save-button" @click="saveChanges">Save</button>
        <button class="cancel-button" @click="cancelChanges">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watchEffect } from "vue";
import { Auth, Storage, Amplify } from "aws-amplify";
import awsmobile from "~/aws-exports";

Amplify.configure(awsmobile);

Storage.configure({
  bucket: awsmobile.s3.bucket,
  region: awsmobile.s3.region,
});

const props = defineProps([
  "fileId",
  "url",
  "category",
  "folderName",
  "description",
  "title",
  "price",
  "previewImage"
]);

const user = ref(null);
const showDrawer = ref(false);
const folderName = ref("");
const title = ref("");
const description = ref("");
const payPerViewPrice = ref(""); // Initialize as an empty string
const category = ref(null);
const fileId = ref(null);
const previewImage = ref("")


const verifyAuth = async () => {
  try {
    user.value = await Auth.currentAuthenticatedUser();
  } catch (error) {
    console.log(error);
  }
};

onMounted(async () => {
  verifyAuth();
});

const toggleDrawer = () => {
  showDrawer.value = !showDrawer.value;
};

const handlePriceInput = (event) => {
  let value = event.target.value;
  // Remove any non-numeric characters except for the decimal point
  value = value.replace(/[^0-9.]/g, '');
  payPerViewPrice.value = value;
};

const saveChanges = async () => {
  if (!folderName.value || !title.value || !description.value) {
    alert("You must enter all fields");
  } else if (folderName.value.trim() === "default") {
    alert("You cannot use 'default' as the folder name.");
  } else if (!validatePrice(payPerViewPrice.value)) {
    alert("Price must be a positive number in the format of dollar.cents (e.g., 2.50).");
  } else {
    const trimmedfolderName = folderName.value.trim();
    const formattedfolderName = trimmedfolderName;
    const body = {
      folderName: formattedfolderName,
      Title: title.value,
      Description: description.value,
      scheduler_id: user.value.username,
      url: props.url,
      category: props.category,
      fileId: fileId.value,
      previewImage: previewImage.value,
      price: payPerViewPrice.value || "Free", // If price is empty, default to "Free"
    };

    try {
      const response = await $fetch("/api/meta/uploader", {
        method: "post",
        body,
      });

      if (response.data && response.data.StatusCode === 200) {
        showDrawer.value = false;
      } else {
        console.error("Save operation failed:", response);
      }
    } catch (error) {
      console.error("Error during save operation:", error);
    }
  }
};

const cancelChanges = () => {
  showDrawer.value = false;
};

watchEffect(() => {
  folderName.value = props.folderName;
  title.value = props.title;
  description.value = props.description;
  payPerViewPrice.value = props.price || ""; // Default to empty string if price is not provided
  category.value = props.category;
  fileId.value = props.fileId;
  previewImage.value = props.previewImage
  
});

const validatePrice = (price) => {
  return price === "" || (!isNaN(price) && parseFloat(price) >= 0);
};
</script>

<style scoped>
@media (min-width: 768px) {
  .bold-header {
    font-weight: 600;
    margin-top: 5px;
    font-size: 15px;
  }
  .notification-text {
    margin-top: 10px;
    color: #d32f2f;
  }
  .schedule-episode {
    margin-top: 10px;
    color: #d32f2f;
  }

  .pay-per-view-episode {
    margin-top: 10px;
    color: blue;
  }

  .free-episode {
    margin-top: 10px;
    color: orange;
  }

  .schedule-episode {
    margin-top: 10px;
  }

  .schedule-button {
    color: green;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    font-size: 15px;
    font-weight: bold;
    margin-top: -20px;
  }

  .tag-button {
    color: yellow;
    padding: 10px 20px;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
    margin-left: 150px;
    transition: box-shadow 0.3s, text-shadow 0.3s; /* Add transition for smooth effect */
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5); /* Add shadow effect */
  }

  .tag-button:hover {
    text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.7); /* Enhance shadow on hover */
  }
}

@media (max-width: 767px) {
  .bold-header {
    font-weight: 600;
    margin-top: 20px;
    font-size: 15px;
  }
  .schedule-episode {
    margin-top: 10px;
    color: #d32f2f;
  }

  .pay-per-view-episode {
    margin-top: 10px;
    color: blue;
  }

  .free-episode {
    margin-top: 10px;
    color: orange;
  }

  .tag-button {
    color: yellow;
    padding: 10px 20px;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    font-size: 14px;
    margin-left: 150px;
    font-weight: bold;
    transition: box-shadow 0.3s, text-shadow 0.3s; /* Add transition for smooth effect */
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5); /* Add shadow effect */
  }

  .tag-button:hover {
    text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.7); /* Enhance shadow on hover */
  }

  .price-box {
    margin-bottom: 10px; /* Added margin for space between inputs and buttons */
  }
}

.drawer {
  position: fixed; /* Fixed position ensures it's always in view */
  top: 600%;
  left: 80%;
  transform: translate(-50%, -50%); /* Center the drawer */
  width: 270px;
  background-color: #f4f4f4;
  box-shadow: 0px 8px 16px 0px rgba(0, 0, 0, 0.2);
  padding: 20px;
  transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out; /* Smooth appearance */
  /* Ensure it's on top of other content */
}

.tag-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
}

.price-box {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
  margin-bottom: 5px;
}

.date-input {
  width: 100%;
  padding: 10px;
  border-radius: 6px;
  font-size: 1em;
  border: 3px solid hsl(190, 95%, 30%) !important;
}

.button-group {
  display: flex;
  justify-content: space-between;
}

.save-button,
.cancel-button {
  padding: 8px 16px;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-size: 12px;
}

.save-button {
  background-color: #4caf50;
  color: white;
}

.save-button:hover {
  background-color: #45a049;
}

.cancel-button {
  background-color: #f44336;
  color: white;
}

.cancel-button:hover {
  background-color: #d32f2f;
}
</style>
