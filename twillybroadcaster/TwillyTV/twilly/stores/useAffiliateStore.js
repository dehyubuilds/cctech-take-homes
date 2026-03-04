import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAffiliateStore = defineStore('affiliate', () => {
  // State
  const affiliateMarketers = ref([]);
  const affiliateEarnings = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // Computed
  const totalAffiliateEarnings = computed(() => {
    return affiliateEarnings.value.reduce((total, earning) => total + earning.amount, 0);
  });

  const activeAffiliates = computed(() => {
    return affiliateMarketers.value.filter(affiliate => affiliate.status === 'active');
  });

  // Actions
  const registerAffiliate = async (affiliateData) => {
    try {
      loading.value = true;
      error.value = null;

      const response = await $fetch('/api/affiliates/register', {
        method: 'POST',
        body: affiliateData
      });

      if (response.success) {
        affiliateMarketers.value.push(response.affiliate);
        return response.affiliate;
      } else {
        throw new Error(response.message);
      }
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getAffiliateMarketers = async () => {
    try {
      loading.value = true;
      error.value = null;

      const response = await $fetch('/api/affiliates/list', {
        method: 'POST'
      });

      if (response.success) {
        affiliateMarketers.value = response.affiliates;
        return response.affiliates;
      } else {
        throw new Error(response.message);
      }
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getAffiliateEarnings = async (affiliateId) => {
    try {
      loading.value = true;
      error.value = null;

      const response = await $fetch('/api/affiliates/earnings', {
        method: 'POST',
        body: { affiliateId }
      });

      if (response.success) {
        affiliateEarnings.value = response.earnings;
        return response.earnings;
      } else {
        throw new Error(response.message);
      }
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const trackAffiliateSignup = async (affiliateId, talentData) => {
    try {
      const response = await $fetch('/api/affiliates/track-signup', {
        method: 'POST',
        body: {
          affiliateId,
          talentData
        }
      });

      if (response.success) {
        return response.trackingId;
      } else {
        throw new Error(response.message);
      }
    } catch (err) {
      error.value = err.message;
      throw err;
    }
  };

  const getAffiliateLink = (affiliateId, channelId) => {
    return `${window.location.origin}/affiliate/${affiliateId}/${channelId}`;
  };

  const clearError = () => {
    error.value = null;
  };

  return {
    // State
    affiliateMarketers,
    affiliateEarnings,
    loading,
    error,
    
    // Computed
    totalAffiliateEarnings,
    activeAffiliates,
    
    // Actions
    registerAffiliate,
    getAffiliateMarketers,
    getAffiliateEarnings,
    trackAffiliateSignup,
    getAffiliateLink,
    clearError
  };
});
