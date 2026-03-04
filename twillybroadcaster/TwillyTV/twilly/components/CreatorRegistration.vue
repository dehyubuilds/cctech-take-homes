<template>
  <div class="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
    <h2 class="text-2xl font-bold mb-6">Become a Creator</h2>
    
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Personal Information -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Personal Information</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">First Name</label>
            <input
              v-model="form.firstName"
              type="text"
              required
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Last Name</label>
            <input
              v-model="form.lastName"
              type="text"
              required
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      <!-- Bank Account Information -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Bank Account Information</h3>
        <div>
          <label class="block text-sm font-medium text-gray-700">Account Holder Name</label>
          <input
            v-model="form.accountHolderName"
            type="text"
            required
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Routing Number</label>
          <input
            v-model="form.routingNumber"
            type="text"
            required
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Account Number</label>
          <input
            v-model="form.accountNumber"
            type="text"
            required
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
          />
        </div>
      </div>

      <!-- Terms and Conditions -->
      <div class="flex items-center">
        <input
          v-model="form.acceptTerms"
          type="checkbox"
          required
          class="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
        />
        <label class="ml-2 block text-sm text-gray-700">
          I agree to the platform's terms and conditions and understand that Twilly takes a 20% platform fee on all transactions.
        </label>
      </div>

      <!-- Submit Button -->
      <div>
        <button
          type="submit"
          :disabled="isLoading"
          class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
        >
          {{ isLoading ? 'Processing...' : 'Register as Creator' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useFileStore } from '~/stores/useFileStore';

const authStore = useAuthStore();
const fileStore = useFileStore();

const isLoading = ref(false);
const form = ref({
  firstName: '',
  lastName: '',
  accountHolderName: '',
  routingNumber: '',
  accountNumber: '',
  acceptTerms: false
});

const handleSubmit = async () => {
  try {
    isLoading.value = true;
    
    // Create Stripe account for the creator
    const stripeResponse = await fetch('/api/create-stripe-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: authStore.user.email,
        firstName: form.value.firstName,
        lastName: form.value.lastName,
        accountHolderName: form.value.accountHolderName,
        routingNumber: form.value.routingNumber,
        accountNumber: form.value.accountNumber
      })
    });

    if (!stripeResponse.ok) {
      throw new Error('Failed to create Stripe account');
    }

    const { stripeAccountId } = await stripeResponse.json();

    // Save creator information to DynamoDB
    await fileStore.createCreator({
      email: authStore.user.email,
      stripeAccountId,
      firstName: form.value.firstName,
      lastName: form.value.lastName,
      accountHolderName: form.value.accountHolderName,
      routingNumber: form.value.routingNumber,
      accountNumber: form.value.accountNumber
    });

    // Show success message
    alert('Successfully registered as a creator!');
  } catch (error) {
    console.error('Error registering creator:', error);
    alert('Failed to register as creator. Please try again.');
  } finally {
    isLoading.value = false;
  }
};
</script> 