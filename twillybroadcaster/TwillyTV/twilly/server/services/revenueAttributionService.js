import AWS from 'aws-sdk';
import ledgerService from './ledgerService.js';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = 'Twilly';

class RevenueAttributionService {
  constructor() {
    this.ledgerService = ledgerService;
  }

  /**
   * Calculate revenue attribution based on weekly episode contributions
   * @param {string} channelId - Channel identifier
   * @param {number} totalRevenue - Total subscription revenue to split
   * @param {string} paymentPeriod - ISO date string for the payment period
   * @returns {Object} Revenue attribution breakdown
   */
  async calculateWeeklyRevenueAttribution(channelId, totalRevenue, paymentPeriod) {
    try {
      console.log(`💰 Calculating revenue attribution for channel: ${channelId}, revenue: $${totalRevenue}, period: ${paymentPeriod}`);
      
      // Get the week's episode contributions from ledger
      const weeklyContributions = await this.getWeeklyEpisodeContributions(channelId, paymentPeriod);
      
      if (weeklyContributions.length === 0) {
        console.log('📊 No episodes aired this week - using default split');
        return this.getDefaultRevenueSplit(channelId, totalRevenue);
      }

      // Get active collaborators with payout setup
      const activeCollaboratorsWithPayouts = await this.getActiveCollaboratorsWithPayouts(channelId);

      // Calculate contribution weights (only includes contributors with payout setup)
      const contributionWeights = this.calculateContributionWeights(weeklyContributions, activeCollaboratorsWithPayouts);
      
      // Apply revenue split model
      const revenueSplit = this.applyRevenueSplitModel(totalRevenue, contributionWeights);
      
      // Create ledger entry for revenue attribution
      const attributionLedgerEntry = await this.createRevenueAttributionLedgerEntry(
        channelId, 
        totalRevenue, 
        paymentPeriod, 
        revenueSplit, 
        weeklyContributions
      );

      console.log('✅ Revenue attribution calculated:', {
        channelId,
        totalRevenue,
        episodeCount: weeklyContributions.length,
        attributionLedgerId: attributionLedgerEntry.ledgerId
      });

      return {
        success: true,
        channelId,
        paymentPeriod,
        totalRevenue,
        episodeContributions: weeklyContributions.length,
        revenueSplit,
        attributionLedgerId: attributionLedgerEntry.ledgerId,
        calculationMethod: 'weekly_episode_attribution'
      };

    } catch (error) {
      console.error('❌ Error calculating revenue attribution:', error);
      throw error;
    }
  }

  /**
   * Get episodes that aired during the payment period
   */
  async getWeeklyEpisodeContributions(channelId, paymentPeriod) {
    try {
      const paymentDate = new Date(paymentPeriod);
      const weekStart = new Date(paymentDate);
      weekStart.setDate(paymentDate.getDate() - 7); // Look back 7 days
      
      console.log(`📅 Getting episodes from ${weekStart.toISOString()} to ${paymentDate.toISOString()}`);

      // Query ledger for episodes aired in this period
      const ledgerEntries = await this.ledgerService.getEntries({
        entityType: 'EPISODE',
        eventType: 'EPISODE_AIRED',
        channelId: channelId
      });

      // Filter episodes that aired within the week
      const weeklyEpisodes = ledgerEntries.entries.filter(entry => {
        const episodeDate = new Date(entry.timestamp);
        return episodeDate >= weekStart && episodeDate <= paymentDate;
      });

      console.log(`📺 Found ${weeklyEpisodes.length} episodes aired this week`);
      
      return weeklyEpisodes;

    } catch (error) {
      console.error('❌ Error getting weekly episode contributions:', error);
      return [];
    }
  }

  /**
   * Get active collaborators with payout setup for a channel
   */
  async getActiveCollaboratorsWithPayouts(channelId) {
    try {
      console.log(`👥 Getting active collaborators with payouts for channel: ${channelId}`);
      
      // Query for active collaborators
      const collaboratorsResult = await dynamodb.query({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: '#status = :activeStatus',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':pk': `CHANNEL#${channelId}`,
          ':sk': 'COLLABORATOR#',
          ':activeStatus': 'active'
        }
      }).promise();

      const activeCollaborators = [];
      
      // Check each collaborator's payout setup status
      for (const collab of collaboratorsResult.Items) {
        try {
          // Check Stripe Connect status using email (as stored in the system)
          const stripeResult = await dynamodb.get({
            TableName: tableName,
            Key: {
              PK: `USER#${collab.userEmail}`,
              SK: 'STRIPE_CONNECT'
            }
          }).promise();

          const hasPayoutSetup = stripeResult.Item && 
            (stripeResult.Item.status === 'connected' || stripeResult.Item.isActive);

          if (hasPayoutSetup) {
            activeCollaborators.push({
              userId: collab.userId,
              userEmail: collab.userEmail,
              role: 'collaborator',
              streamKey: collab.streamKey,
              joinedAt: collab.joinedAt,
              hasPayoutSetup: true,
              stripeAccountId: stripeResult.Item.stripeAccountId
            });
          } else {
            console.log(`⚠️ Collaborator ${collab.userEmail} has no payout setup, skipping from revenue split`);
          }
        } catch (error) {
          console.error(`❌ Error checking payout setup for collaborator ${collab.userEmail}:`, error);
        }
      }

      console.log(`✅ Found ${activeCollaborators.length} collaborators with payout setup`);
      return activeCollaborators;

    } catch (error) {
      console.error('❌ Error getting active collaborators with payouts:', error);
      return [];
    }
  }

  /**
   * Calculate contribution weights based on episode activity and payout setup
   */
  calculateContributionWeights(episodes, activeCollaboratorsWithPayouts) {
    const weights = {
      producers: new Map(),
      collaborators: new Map()
    };

    // Create a map of collaborators with payout setup for quick lookup
    const collaboratorsWithPayouts = new Map();
    activeCollaboratorsWithPayouts.forEach(collab => {
      collaboratorsWithPayouts.set(collab.userEmail, collab);
    });

    episodes.forEach(episode => {
      // Each episode gets equal weight (1.0)
      const episodeWeight = 1.0;
      
      episode.collaborators.forEach(contributor => {
        const userId = contributor.userId;
        const userEmail = contributor.userEmail;
        const role = contributor.role;
        
        if (role === 'producer') {
          // Producers always get credit (they own the channel)
          const currentWeight = weights.producers.get(userId) || 0;
          weights.producers.set(userId, currentWeight + episodeWeight);
        } else if (role === 'collaborator') {
          // Only collaborators with payout setup get credit
          if (collaboratorsWithPayouts.has(userEmail)) {
            const currentWeight = weights.collaborators.get(userId) || 0;
            weights.collaborators.set(userId, currentWeight + episodeWeight);
          } else {
            console.log(`⚠️ Collaborator ${userEmail} has no payout setup, not included in revenue split`);
          }
        }
      });
    });

    // Convert to arrays for easier processing
    const producerWeights = Array.from(weights.producers.entries()).map(([userId, weight]) => ({
      userId,
      weight,
      role: 'producer'
    }));

    const collaboratorWeights = Array.from(weights.collaborators.entries()).map(([userId, weight]) => ({
      userId,
      weight,
      role: 'collaborator'
    }));

    console.log('⚖️ Contribution weights calculated:', {
      producers: producerWeights.length,
      collaborators: collaboratorWeights.length,
      totalEpisodes: episodes.length,
      collaboratorsWithPayouts: activeCollaboratorsWithPayouts.length
    });

    return {
      producers: producerWeights,
      collaborators: collaboratorWeights,
      totalWeight: producerWeights.reduce((sum, p) => sum + p.weight, 0) + 
                   collaboratorWeights.reduce((sum, c) => sum + c.weight, 0)
    };
  }

  /**
   * Apply the revenue split model based on contribution weights
   */
  applyRevenueSplitModel(totalRevenue, contributionWeights) {
    // Revenue split model: 10% Platform, 70% Contributors, 20% Affiliate (future)
    const platformFee = Math.round(totalRevenue * 0.10);
    const contributorRevenue = Math.round(totalRevenue * 0.70);
    const affiliateRevenue = totalRevenue - platformFee - contributorRevenue;

    // Split contributor revenue based on episode contributions
    const contributorSplits = [];
    const totalWeight = contributionWeights.totalWeight;

    if (totalWeight > 0) {
      // Split among producers and collaborators based on their episode contributions
      [...contributionWeights.producers, ...contributionWeights.collaborators].forEach(contributor => {
        const share = Math.round((contributor.weight / totalWeight) * contributorRevenue);
        contributorSplits.push({
          userId: contributor.userId,
          role: contributor.role,
          weight: contributor.weight,
          share: share,
          percentage: Math.round((contributor.weight / totalWeight) * 100 * 100) / 100 // Round to 2 decimal places
        });
      });
    }

    const revenueSplit = {
      totalRevenue,
      platformFee,
      contributorRevenue,
      affiliateRevenue,
      contributorSplits,
      summary: {
        platformPercentage: 10,
        contributorPercentage: 70,
        affiliatePercentage: 20,
        totalContributors: contributorSplits.length,
        totalEpisodes: contributionWeights.producers.length + contributionWeights.collaborators.length
      }
    };

    console.log('💸 Revenue split calculated:', {
      total: totalRevenue,
      platform: platformFee,
      contributors: contributorRevenue,
      affiliate: affiliateRevenue,
      contributorCount: contributorSplits.length
    });

    return revenueSplit;
  }

  /**
   * Get default revenue split when no episodes aired
   */
  async getDefaultRevenueSplit(channelId, totalRevenue) {
    // When no episodes aired, give 100% to the channel owner
    const [producerId] = channelId.split('-');
    
    const platformFee = Math.round(totalRevenue * 0.10);
    const ownerShare = totalRevenue - platformFee;

    return {
      totalRevenue,
      platformFee,
      contributorRevenue: ownerShare,
      affiliateRevenue: 0,
      contributorSplits: [{
        userId: producerId,
        role: 'producer',
        weight: 1.0,
        share: ownerShare,
        percentage: 100
      }],
      summary: {
        platformPercentage: 10,
        contributorPercentage: 90,
        affiliatePercentage: 0,
        totalContributors: 1,
        totalEpisodes: 0
      }
    };
  }

  /**
   * Create ledger entry for revenue attribution calculation
   */
  async createRevenueAttributionLedgerEntry(channelId, totalRevenue, paymentPeriod, revenueSplit, episodes) {
    const payload = {
      eventType: 'REVENUE_ATTRIBUTION_CALCULATED',
      entityType: 'CHANNEL',
      entityId: channelId,
      amount: totalRevenue,
      currency: 'USD',
      channelId: channelId,
      channelName: channelId.split('-')[1] || 'Unknown Channel',
      subscriptionId: `attribution_${Date.now()}`,
      subscriberId: 'system',
      paymentPeriod: paymentPeriod,
      metadata: {
        source: 'revenue-attribution-service',
        calculationMethod: 'weekly_episode_attribution',
        episodeCount: episodes.length,
        contributorCount: revenueSplit.contributorSplits.length,
        platformFee: revenueSplit.platformFee,
        contributorRevenue: revenueSplit.contributorRevenue,
        affiliateRevenue: revenueSplit.affiliateRevenue,
        contributorBreakdown: revenueSplit.contributorSplits,
        episodes: episodes.map(ep => ({
          episodeId: ep.episodeId,
          episodeTitle: ep.episodeTitle,
          airedAt: ep.timestamp,
          contributors: ep.collaborators.length
        }))
      }
    };

    return await this.ledgerService.createEntry(payload);
  }

  /**
   * Preview revenue attribution without creating ledger entry
   */
  async previewRevenueAttribution(channelId, totalRevenue, paymentPeriod) {
    try {
      const weeklyContributions = await this.getWeeklyEpisodeContributions(channelId, paymentPeriod);
      
      if (weeklyContributions.length === 0) {
        return this.getDefaultRevenueSplit(channelId, totalRevenue);
      }

      // Get active collaborators with payout setup
      const activeCollaboratorsWithPayouts = await this.getActiveCollaboratorsWithPayouts(channelId);

      const contributionWeights = this.calculateContributionWeights(weeklyContributions, activeCollaboratorsWithPayouts);
      const revenueSplit = this.applyRevenueSplitModel(totalRevenue, contributionWeights);

      return {
        success: true,
        channelId,
        paymentPeriod,
        totalRevenue,
        episodeContributions: weeklyContributions.length,
        activeCollaboratorsWithPayouts: activeCollaboratorsWithPayouts.length,
        revenueSplit,
        calculationMethod: 'weekly_episode_attribution',
        preview: true
      };

    } catch (error) {
      console.error('❌ Error previewing revenue attribution:', error);
      throw error;
    }
  }
}

export default new RevenueAttributionService();
