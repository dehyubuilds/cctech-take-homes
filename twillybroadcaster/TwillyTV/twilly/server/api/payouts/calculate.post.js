import payoutCalculator from '../../services/payoutCalculator.js';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { 
      totalAmount, 
      hasAffiliate = false
    } = body;

    if (!totalAmount || totalAmount <= 0) {
      return {
        success: false,
        message: 'totalAmount is required and must be greater than 0'
      };
    }

    // Calculate PPV payout splits
    const payoutSplits = payoutCalculator.calculatePPVSplits(totalAmount, hasAffiliate);

    // Validate the splits
    const isValid = payoutCalculator.validateSplits(payoutSplits);

    return {
      success: true,
      type: 'ppv',
      input: {
        totalAmount: totalAmount,
        hasAffiliate: hasAffiliate
      },
      payoutSplits: payoutSplits,
      validation: {
        isValid: isValid,
        totalDistributed: payoutSplits.platform + payoutSplits.creator + payoutSplits.affiliate,
        difference: payoutSplits.totalAmount - (payoutSplits.platform + payoutSplits.creator + payoutSplits.affiliate)
      }
    };

  } catch (error) {
    console.error('Error calculating payouts:', error);
    return {
      success: false,
      message: 'Failed to calculate payouts',
      error: error.message
    };
  }
});
