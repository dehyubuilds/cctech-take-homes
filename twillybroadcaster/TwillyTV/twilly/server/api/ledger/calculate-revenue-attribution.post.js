import revenueAttributionService from '../../services/revenueAttributionService.js';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { channelId, totalRevenue, paymentPeriod, preview = false } = body;

    if (!channelId || !totalRevenue || !paymentPeriod) {
      return {
        success: false,
        message: 'Missing required fields: channelId, totalRevenue, paymentPeriod'
      };
    }

    console.log('💰 Revenue attribution request:', { channelId, totalRevenue, paymentPeriod, preview });

    let result;
    if (preview) {
      result = await revenueAttributionService.previewRevenueAttribution(channelId, totalRevenue, paymentPeriod);
    } else {
      result = await revenueAttributionService.calculateWeeklyRevenueAttribution(channelId, totalRevenue, paymentPeriod);
    }

    return {
      success: true,
      message: preview ? 'Revenue attribution preview generated' : 'Revenue attribution calculated and logged',
      data: result
    };

  } catch (error) {
    console.error('❌ Error in revenue attribution API:', error);
    
    return {
      success: false,
      message: 'Failed to calculate revenue attribution',
      error: error.message
    };
  }
});
