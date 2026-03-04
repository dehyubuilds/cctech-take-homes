import ledgerService from './ledgerService.js';
import AWS from 'aws-sdk';

// Configure AWS with existing credentials
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = 'Twilly';

/**
 * Episode Ledger Service
 * Handles ledger entries for episode lifecycle events
 */
class EpisodeLedgerService {
  
  /**
   * Create ledger entry when episode becomes visible
   * @param {Object} episodeData - Episode data from managefiles.vue
   * @param {string} triggeredBy - User who triggered the visibility change
   * @returns {Object} - Ledger entry result
   */
  async createEpisodeAiredEntry(episodeData, triggeredBy) {
    try {
      console.log('📺 Creating episode aired ledger entry for:', episodeData.SK);
      
      // Get collaborators for this channel
      const collaborators = await this.getChannelCollaborators(episodeData);
      
      // Determine channel ID from episode data
      const channelId = this.extractChannelId(episodeData);
      const channelName = episodeData.folderName || episodeData.seriesName || 'Unknown Channel';
      
      // Create the ledger entry
      const ledgerEntry = await ledgerService.createEntry({
        entityType: 'EPISODE',
        entityId: episodeData.SK,
        eventType: 'EPISODE_AIRED',
        channelId: channelId,
        channelName: channelName,
        episodeId: episodeData.SK,
        episodeTitle: episodeData.title || 'Untitled Episode',
        collaborators: collaborators,
        metadata: {
          source: 'episode-visibility',
          triggeredBy: triggeredBy,
          airedMethod: episodeData.airdate ? 'SCHEDULED' : 'MANUAL',
          originalUploadDate: episodeData.timestamp,
          madeVisibleAt: new Date().toISOString(),
          episodeCategory: episodeData.category,
          episodePrice: episodeData.price || 0,
          auditNotes: `Episode made visible via managefiles.vue by ${triggeredBy}`
        }
      });
      
      console.log('✅ Episode aired ledger entry created:', ledgerEntry.ledgerId);
      return ledgerEntry;
      
    } catch (error) {
      console.error('❌ Error creating episode aired ledger entry:', error);
      throw new Error(`Failed to create episode aired ledger entry: ${error.message}`);
    }
  }
  
  /**
   * Get active collaborators for a channel
   * @param {Object} episodeData - Episode data
   * @returns {Array} - Array of collaborator objects
   */
  async getChannelCollaborators(episodeData) {
    try {
      const channelId = this.extractChannelId(episodeData);
      
      // Query for active collaborators on this channel
      const result = await dynamodb.query({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `CHANNEL#${channelId}`,
          ':sk': 'COLLABORATOR#'
        }
      }).promise();
      
      // Filter for active collaborators
      const activeCollaborators = result.Items
        .filter(collab => collab.status === 'active')
        .map(collab => ({
          userId: collab.userId,
          userEmail: collab.userEmail,
          role: collab.role,
          streamKey: collab.streamKey,
          joinedAt: collab.joinedAt,
          hasPayoutSetup: collab.hasPayoutSetup || false
        }));
      
      // Always include the producer (episode owner)
      const producer = {
        userId: episodeData.PK.replace('USER#', ''),
        userEmail: episodeData.PK.replace('USER#', ''),
        role: 'producer',
        streamKey: 'producer_main_key',
        joinedAt: episodeData.timestamp,
        hasPayoutSetup: true // Assume producer has payout setup
      };
      
      // Combine producer and collaborators
      const allContributors = [producer, ...activeCollaborators];
      
      console.log(`📋 Found ${allContributors.length} contributors for channel ${channelId}`);
      return allContributors;
      
    } catch (error) {
      console.error('❌ Error getting channel collaborators:', error);
      // Return just the producer if we can't get collaborators
      return [{
        userId: episodeData.PK.replace('USER#', ''),
        userEmail: episodeData.PK.replace('USER#', ''),
        role: 'producer',
        streamKey: 'producer_main_key',
        joinedAt: episodeData.timestamp,
        hasPayoutSetup: true
      }];
    }
  }
  
  /**
   * Extract channel ID from episode data
   * @param {Object} episodeData - Episode data
   * @returns {string} - Channel ID
   */
  extractChannelId(episodeData) {
    const userEmail = episodeData.PK.replace('USER#', '');
    const channelName = episodeData.folderName || episodeData.seriesName || 'default';
    return `${userEmail}-${channelName}`;
  }
  
  /**
   * Get episodes that aired in a specific time window
   * @param {string} channelId - Channel ID
   * @param {Date} startDate - Start of time window
   * @param {Date} endDate - End of time window
   * @returns {Array} - Array of episodes with collaborators
   */
  async getEpisodesInTimeWindow(channelId, startDate, endDate) {
    try {
      // Extract user email from channel ID
      const userEmail = channelId.split('-')[0];
      
      // Query for episodes in the time window
      const result = await dynamodb.query({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk',
        FilterExpression: 'isVisible = :visible AND updatedAt BETWEEN :startDate AND :endDate',
        ExpressionAttributeValues: {
          ':pk': `USER#${userEmail}`,
          ':visible': true,
          ':startDate': startDate.toISOString(),
          ':endDate': endDate.toISOString()
        }
      }).promise();
      
      // Get collaborators for each episode
      const episodesWithCollaborators = await Promise.all(
        result.Items.map(async (episode) => {
          const collaborators = await this.getChannelCollaborators(episode);
          return {
            ...episode,
            collaborators
          };
        })
      );
      
      return episodesWithCollaborators;
      
    } catch (error) {
      console.error('❌ Error getting episodes in time window:', error);
      return [];
    }
  }
  
  /**
   * Get weekly aired episodes for revenue attribution
   * @param {string} channelId - Channel ID
   * @returns {Array} - Array of episodes that aired in the last 7 days
   */
  async getWeeklyAiredEpisodes(channelId) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    return await this.getEpisodesInTimeWindow(channelId, startDate, endDate);
  }
}

// Export singleton instance
export default new EpisodeLedgerService();
