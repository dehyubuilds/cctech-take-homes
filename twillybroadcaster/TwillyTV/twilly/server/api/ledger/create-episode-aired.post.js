import episodeLedgerService from '~/server/services/episodeLedgerService.js';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { episodeData, triggeredBy } = body;
    
    console.log('📺 Creating episode aired ledger entry:', {
      episodeId: episodeData.SK,
      episodeTitle: episodeData.title,
      triggeredBy: triggeredBy
    });
    
    // Validate required fields
    if (!episodeData || !episodeData.SK || !triggeredBy) {
      return {
        success: false,
        message: 'Missing required fields: episodeData and triggeredBy are required'
      };
    }
    
    // Create the episode aired ledger entry
    const result = await episodeLedgerService.createEpisodeAiredEntry(episodeData, triggeredBy);
    
    return {
      success: true,
      message: 'Episode aired ledger entry created successfully',
      data: {
        ledgerId: result.ledgerId,
        blockHash: result.blockHash,
        verificationHash: result.verificationHash,
        timestamp: result.entry.timestamp,
        collaborators: result.entry.collaborators.length
      }
    };
    
  } catch (error) {
    console.error('❌ Error in create-episode-aired API:', error);
    return {
      success: false,
      message: error.message || 'Failed to create episode aired ledger entry'
    };
  }
});
