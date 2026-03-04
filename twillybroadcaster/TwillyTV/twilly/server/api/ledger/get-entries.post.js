import ledgerService from '~/server/services/ledgerService.js';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    console.log('📋 Getting ledger entries with filters:', body);
    
    // Get ledger entries with optional filters
    const result = await ledgerService.getEntries(body.filters || {});
    
    return {
      success: true,
      message: 'Ledger entries retrieved successfully',
      data: {
        entries: result.entries,
        count: result.count
      }
    };
    
  } catch (error) {
    console.error('❌ Error in get-entries API:', error);
    return {
      success: false,
      message: error.message || 'Failed to get ledger entries'
    };
  }
});
