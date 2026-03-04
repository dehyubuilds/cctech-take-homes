import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Configure AWS with existing credentials
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = 'Twilly';

/**
 * Core Ledger Service for Twilly Network
 * Creates immutable, blockchain-style ledger entries for revenue tracking
 */
class LedgerService {
  
  /**
   * Create a new ledger entry
   * @param {Object} entryData - The ledger entry data
   * @returns {Object} - Created ledger entry with ID and hash
   */
  async createEntry(entryData) {
    try {
      // Generate unique ledger ID
      const ledgerId = `ledger_${Date.now()}_${uuidv4().substring(0, 8)}`;
      
      // Get the previous entry's hash for blockchain linking
      const previousHash = await this.getLastBlockHash();
      
      // Create the ledger entry
      const ledgerEntry = {
        // Core identifiers
        PK: `LEDGER#${ledgerId}`,
        SK: 'ENTRY',
        ledgerId: ledgerId,
        blockHash: this.generateBlockHash(ledgerId, previousHash),
        previousHash: previousHash,
        
        // Entry data
        entityType: entryData.entityType, // EPISODE, COLLABORATION, SUBSCRIPTION, PAYOUT, AIRDATE
        entityId: entryData.entityId,
        eventType: entryData.eventType, // EPISODE_AIRED, REVENUE_RECEIVED, PAYOUT_ISSUED, etc.
        
        // Revenue & attribution
        amount: entryData.amount || 0,
        currency: entryData.currency || 'USD',
        
        // Channel & content context
        channelId: entryData.channelId,
        channelName: entryData.channelName,
        episodeId: entryData.episodeId,
        episodeTitle: entryData.episodeTitle,
        
        // Collaborator context
        collaborators: entryData.collaborators || [],
        
        // Subscription context
        subscriptionId: entryData.subscriptionId,
        subscriberId: entryData.subscriberId,
        paymentPeriod: entryData.paymentPeriod,
        
        // Metadata & audit
        metadata: {
          source: entryData.metadata?.source || 'manual',
          triggeredBy: entryData.metadata?.triggeredBy || 'system',
          relatedTransactions: entryData.metadata?.relatedTransactions || [],
          auditNotes: entryData.metadata?.auditNotes || '',
          ...entryData.metadata
        },
        
        // Timestamps
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        
        // Integrity
        status: 'PENDING',
        verificationHash: null // Will be set after creation
      };
      
      // Store in DynamoDB first
      await dynamodb.put({
        TableName: tableName,
        Item: ledgerEntry
      }).promise();
      
      // Generate verification hash after creation
      ledgerEntry.verificationHash = this.generateVerificationHash(ledgerEntry);
      
      // Update with verification hash and status
      await dynamodb.update({
        TableName: tableName,
        Key: {
          PK: `LEDGER#${ledgerId}`,
          SK: 'ENTRY'
        },
        UpdateExpression: 'SET #status = :status, verificationHash = :verificationHash, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'CONFIRMED',
          ':verificationHash': ledgerEntry.verificationHash,
          ':updatedAt': new Date().toISOString()
        }
      }).promise();
      
      console.log('✅ Ledger entry created:', ledgerId);
      
      return {
        success: true,
        ledgerId: ledgerId,
        blockHash: ledgerEntry.blockHash,
        verificationHash: ledgerEntry.verificationHash,
        entry: ledgerEntry
      };
      
    } catch (error) {
      console.error('❌ Error creating ledger entry:', error);
      throw new Error(`Failed to create ledger entry: ${error.message}`);
    }
  }
  
  /**
   * Get ledger entries by various filters
   * @param {Object} filters - Query filters
   * @returns {Array} - Array of ledger entries
   */
  async getEntries(filters = {}) {
    try {
      console.log('📋 Getting ledger entries with filters:', { filters });
      
      let queryParams = {
        TableName: tableName,
        FilterExpression: 'begins_with(PK, :pkPrefix)',
        ExpressionAttributeValues: {
          ':pkPrefix': 'LEDGER#'
        }
      };
      
      // Add additional filters
      if (filters.entityType) {
        queryParams.FilterExpression += ' AND entityType = :entityType';
        queryParams.ExpressionAttributeValues = {
          ...queryParams.ExpressionAttributeValues,
          ':entityType': filters.entityType
        };
      }
      
      if (filters.eventType) {
        queryParams.FilterExpression += ' AND eventType = :eventType';
        queryParams.ExpressionAttributeValues = {
          ...queryParams.ExpressionAttributeValues,
          ':eventType': filters.eventType
        };
      }
      
      if (filters.channelId) {
        queryParams.FilterExpression += ' AND channelId = :channelId';
        queryParams.ExpressionAttributeValues = {
          ...queryParams.ExpressionAttributeValues,
          ':channelId': filters.channelId
        };
      }
      
      if (filters.dateRange) {
        const { startDate, endDate } = filters.dateRange;
        queryParams.FilterExpression += ' AND #timestamp BETWEEN :startDate AND :endDate';
        if (!queryParams.ExpressionAttributeNames) {
          queryParams.ExpressionAttributeNames = {};
        }
        queryParams.ExpressionAttributeNames['#timestamp'] = 'timestamp';
        queryParams.ExpressionAttributeValues[':startDate'] = startDate;
        queryParams.ExpressionAttributeValues[':endDate'] = endDate;
      }
      
      // Debug: Log the final query parameters
      console.log('📋 Final FilterExpression:', queryParams.FilterExpression);
      console.log('📋 Final ExpressionAttributeValues:', queryParams.ExpressionAttributeValues);
      
      console.log('📋 DynamoDB query params:', queryParams);
      const result = await dynamodb.scan(queryParams).promise();
      console.log('📋 DynamoDB scan result - Items count:', result.Items.length);
      
      // Sort by timestamp (newest first)
      const entries = result.Items.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      
      console.log('📋 Filtered entries count:', entries.length);
      if (filters.channelId) {
        console.log('📋 Entries for channel:', filters.channelId, entries.map(e => ({ 
          episodeId: e.episodeId, 
          channelId: e.channelId,
          collaborators: e.collaborators?.length || 0 
        })));
      }
      
      return {
        success: true,
        entries: entries,
        count: entries.length
      };
      
    } catch (error) {
      console.error('❌ Error getting ledger entries:', error);
      throw new Error(`Failed to get ledger entries: ${error.message}`);
    }
  }
  
  /**
   * Get the hash of the last ledger entry for blockchain linking
   * @returns {string} - Previous block hash
   */
  async getLastBlockHash() {
    try {
      const result = await dynamodb.scan({
        TableName: tableName,
        FilterExpression: 'begins_with(PK, :pkPrefix)',
        ExpressionAttributeValues: {
          ':pkPrefix': 'LEDGER#'
        },
        ProjectionExpression: 'blockHash, #timestamp',
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp'
        }
      }).promise();
      
      if (result.Items.length === 0) {
        return 'genesis_block'; // First entry
      }
      
      // Get the most recent entry
      const latestEntry = result.Items.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      )[0];
      
      return latestEntry.blockHash;
      
    } catch (error) {
      console.error('❌ Error getting last block hash:', error);
      return 'genesis_block';
    }
  }
  
  /**
   * Generate a block hash for blockchain linking
   * @param {string} ledgerId - Current ledger ID
   * @param {string} previousHash - Previous block hash
   * @returns {string} - Generated block hash
   */
  generateBlockHash(ledgerId, previousHash) {
    const data = `${ledgerId}_${previousHash}_${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Generate verification hash for entry integrity
   * @param {Object} entry - The ledger entry
   * @returns {string} - Verification hash
   */
  generateVerificationHash(entry) {
    // Create a hash of all the important data (excluding verificationHash itself)
    const dataToHash = {
      ledgerId: entry.ledgerId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      eventType: entry.eventType,
      amount: entry.amount,
      channelId: entry.channelId,
      timestamp: entry.timestamp,
      collaborators: entry.collaborators,
      blockHash: entry.blockHash,
      previousHash: entry.previousHash
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(dataToHash, Object.keys(dataToHash).sort()))
      .digest('hex');
  }
  
  /**
   * Verify the integrity of a ledger entry
   * @param {string} ledgerId - Ledger entry ID to verify
   * @returns {Object} - Verification result
   */
  async verifyEntry(ledgerId) {
    try {
      const result = await dynamodb.get({
        TableName: tableName,
        Key: {
          PK: `LEDGER#${ledgerId}`,
          SK: 'ENTRY'
        }
      }).promise();
      
      if (!result.Item) {
        return {
          success: false,
          message: 'Ledger entry not found'
        };
      }
      
      const entry = result.Item;
      const expectedHash = this.generateVerificationHash(entry);
      const isValid = expectedHash === entry.verificationHash;
      
      return {
        success: true,
        isValid: isValid,
        ledgerId: ledgerId,
        expectedHash: expectedHash,
        actualHash: entry.verificationHash,
        entry: entry
      };
      
    } catch (error) {
      console.error('❌ Error verifying ledger entry:', error);
      return {
        success: false,
        message: `Verification failed: ${error.message}`
      };
    }
  }
}

// Export singleton instance
export default new LedgerService();
