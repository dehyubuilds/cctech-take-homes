<script setup>
const props = defineProps({
  folder: {
    type: String,
    required: true
  },
  ownerEmail: {
    type: String,
    default: ''
  },
  isCollab: {
    type: Boolean,
    default: false
  }
});

// Modify upload path for collaborations
const getUploadPath = (file) => {
  const baseEmail = props.isCollab ? props.ownerEmail : user.attributes.email;
  return `${baseEmail}/${props.folder}/${file.name}`;
};
</script> 