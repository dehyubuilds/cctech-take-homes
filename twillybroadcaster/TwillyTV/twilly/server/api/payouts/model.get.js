import payoutCalculator from '../../services/payoutCalculator.js';

export default defineEventHandler(async (event) => {
  try {
    const revenueSplitModel = payoutCalculator.getRevenueSplitModel();
    
    return {
      success: true,
      model: revenueSplitModel,
      description: 'Twilly PPV Revenue Split Model',
      lastUpdated: new Date().toISOString(),
      summary: {
        platform: '10% - Platform fee for hosting, processing, and maintenance',
        creator: '85% - Revenue share for creator/seller on PPV purchases',
        affiliate: '5% - Commission for affiliate marketers on PPV purchases'
      }
    };
  } catch (error) {
    console.error('Error getting payout model:', error);
    return {
      success: false,
      message: 'Failed to get payout model',
      error: error.message
    };
  }
});
