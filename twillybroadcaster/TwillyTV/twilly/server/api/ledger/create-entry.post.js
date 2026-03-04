import ledgerService from '~/server/services/ledgerService.js';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    console.log('📝 Creating ledger entry with data:', body);
    
    // Validate required fields
    if (!body.entityType || !body.eventType) {
      return {
        success: false,
        message: 'Missing required fields: entityType and eventType are required'
      };
    }
    
    // Create the ledger entry
    const result = await ledgerService.createEntry(body);
    
    return {
      success: true,
      message: 'Ledger entry created successfully',
      data: {
        ledgerId: result.ledgerId,
        blockHash: result.blockHash,
        verificationHash: result.verificationHash,
        timestamp: result.entry.timestamp
      }
    };
    
  } catch (error) {
    console.error('❌ Error in create-entry API:', error);
    return {
      success: false,
      message: error.message || 'Failed to create ledger entry'
    };
  }
});
