/**
 * Centralized Payout Calculator Service
 * Ensures consistent revenue splits for PPV (Pay-Per-View) purchases
 * 
 * Revenue Split Model for PPV Content (OnlyFans-style):
 * - Platform Fee: 10%
 * - Creator/Seller: 85%
 * - Affiliate Marketers: 5%
 */

class PayoutCalculator {
  constructor() {
    this.PLATFORM_FEE_RATE = 0.10; // 10%
    this.CREATOR_RATE = 0.85; // 85%
    this.AFFILIATE_RATE = 0.05; // 5%
  }

  /**
   * Calculate PPV payout splits for a given amount (OnlyFans-style)
   * @param {number} totalAmount - Total PPV revenue amount in cents
   * @param {boolean} hasAffiliate - Whether there's an affiliate involved
   * @returns {Object} PPV payout breakdown
   */
  calculatePPVPayoutSplits(totalAmount, hasAffiliate = false) {
    const amount = Math.round(totalAmount);
    
    // Calculate base splits
    const platformFee = Math.round(amount * this.PLATFORM_FEE_RATE);
    const creatorShare = Math.round(amount * this.CREATOR_RATE);
    const affiliateShare = hasAffiliate ? Math.round(amount * this.AFFILIATE_RATE) : 0;
    
    // Calculate total distributed
    const totalDistributed = platformFee + creatorShare + affiliateShare;
    const remainder = amount - totalDistributed;
    
    // Add remainder to platform fee to ensure we don't lose money
    const finalPlatformFee = platformFee + remainder;
    
    return {
      totalAmount: amount,
      platformFee: finalPlatformFee,
      creatorShare: creatorShare,
      affiliateShare: affiliateShare,
      hasAffiliate: hasAffiliate,
      remainder: remainder,
      splits: {
        platform: finalPlatformFee,
        creator: creatorShare,
        affiliate: affiliateShare
      },
      percentages: {
        platform: (finalPlatformFee / amount * 100).toFixed(2),
        creator: (creatorShare / amount * 100).toFixed(2),
        affiliate: (affiliateShare / amount * 100).toFixed(2)
      }
    };
  }

  /**
   * Calculate PPV (Pay-Per-View) splits - Main method for all PPV purchases
   * @param {number} totalAmount - Total PPV amount in cents
   * @param {boolean} hasAffiliate - Whether there's an affiliate involved
   * @returns {Object} PPV payout breakdown
   */
  calculatePPVSplits(totalAmount, hasAffiliate = false) {
    return this.calculatePPVPayoutSplits(totalAmount, hasAffiliate);
  }

  /**
   * Validate that splits add up correctly
   * @param {Object} splits - Payout splits object
   * @returns {boolean} Whether splits are valid
   */
  validateSplits(splits) {
    const total = splits.platform + splits.creator + splits.affiliate;
    return Math.abs(total - splits.totalAmount) <= 1; // Allow 1 cent rounding difference
  }

  /**
   * Get revenue split model information
   * @returns {Object} Revenue split model details
   */
  getRevenueSplitModel() {
    return {
      platform: {
        rate: this.PLATFORM_FEE_RATE,
        percentage: '10%',
        description: 'Platform fee for hosting, processing, and maintenance'
      },
      creator: {
        rate: this.CREATOR_RATE,
        percentage: '85%',
        description: 'Revenue share for creator/seller on PPV purchases'
      },
      affiliate: {
        rate: this.AFFILIATE_RATE,
        percentage: '5%',
        description: 'Commission for affiliate marketers on PPV purchases'
      }
    };
  }
}

// Export singleton instance
export default new PayoutCalculator();
