import GHLAPIClient from './ghl-api-client.js';
import GHLContactDatabase from './ghl-contact-database.js';
import { log, logError } from '../logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * GoHighLevel Contact Export Service
 * Handles the complete export process from GHL API to local SQLite database
 */
class GHLContactExportService {
  constructor(apiKey = null, locationId = null) {
    this.api = new GHLAPIClient(apiKey, locationId);
    this.db = new GHLContactDatabase();
    this.initialized = false;
    this.exportStats = {
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * Initialize the service
   */
  async init() {
    if (this.initialized) return;

    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.db.dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      // Initialize database
      await this.db.init();

      // Test API connection
      log('🔌 Testing GHL API connection...');
      const testResult = await this.api.testConnection();

      if (!testResult.success) {
        throw new Error(`API connection failed: ${testResult.error}`);
      }

      log(`✅ Connected to GHL. Location: ${testResult.locationId}, Total contacts: ${testResult.totalContacts}`);

      this.initialized = true;
    } catch (error) {
      logError('Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Export all contacts from GHL to database
   */
  async exportAllContacts(options = {}) {
    await this.init();

    const syncLog = await this.db.startSyncLog('full');
    log(`📊 Starting full contact export (Sync ID: ${syncLog.id})...`);

    this.exportStats = {
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      startTime: new Date(),
      endTime: null
    };

    try {
      // Get total count first for progress tracking
      const initialCheck = await this.api.searchContacts({ pageLimit: 1 });
      const totalContacts = initialCheck.total || 0;

      log(`📋 Total contacts to export: ${totalContacts}`);

      await this.db.updateSyncLog(syncLog.id, {
        total_contacts: totalContacts
      });

      // Process contacts in batches
      let batchNumber = 0;

      // Extract options for API vs local processing
      const { delayBetweenBatches, ...apiOptions } = options;

      for await (const batch of this.api.contactsIterator(apiOptions)) {
        batchNumber++;
        log(`\n🔄 Processing batch ${batchNumber} (${batch.length} contacts)...`);

        // Process batch
        const batchResult = await this.processBatch(batch);

        // Update statistics
        this.exportStats.totalProcessed += batch.length;
        this.exportStats.successCount += batchResult.processed;
        this.exportStats.errorCount += batchResult.errors?.length || 0;

        // Update sync log
        await this.db.updateSyncLog(syncLog.id, {
          processed_contacts: this.exportStats.totalProcessed,
          error_count: this.exportStats.errorCount
        });

        // Log progress
        const progress = ((this.exportStats.totalProcessed / totalContacts) * 100).toFixed(1);
        log(`📈 Progress: ${this.exportStats.totalProcessed}/${totalContacts} (${progress}%)`);

        // Optional: Add delay between batches to avoid overloading
        if (delayBetweenBatches) {
          await this.delay(delayBetweenBatches);
        }
      }

      // Mark export as completed
      this.exportStats.endTime = new Date();
      const duration = (this.exportStats.endTime - this.exportStats.startTime) / 1000;

      await this.db.completeSyncLog(syncLog.id, 'completed');

      log(`\n✅ Export completed successfully!`);
      log(`📊 Final Statistics:`);
      log(`   - Total Processed: ${this.exportStats.totalProcessed}`);
      log(`   - Success: ${this.exportStats.successCount}`);
      log(`   - Errors: ${this.exportStats.errorCount}`);
      log(`   - Duration: ${duration.toFixed(2)} seconds`);

      return this.exportStats;

    } catch (error) {
      logError('Export failed:', error);

      this.exportStats.endTime = new Date();
      await this.db.completeSyncLog(syncLog.id, 'failed', error.message);

      throw error;
    }
  }

  /**
   * Export contacts by date range
   */
  async exportContactsByDateRange(startDate, endDate, options = {}) {
    await this.init();

    const syncLog = await this.db.startSyncLog('incremental');
    log(`📊 Starting incremental export from ${startDate} to ${endDate}...`);

    try {
      const contacts = await this.api.getContactsByDateRange(startDate, endDate, options);
      log(`📋 Found ${contacts.length} contacts in date range`);

      await this.db.updateSyncLog(syncLog.id, {
        total_contacts: contacts.length
      });

      // Process all contacts
      const result = await this.processBatch(contacts);

      await this.db.updateSyncLog(syncLog.id, {
        processed_contacts: result.processed,
        error_count: result.errors?.length || 0
      });

      await this.db.completeSyncLog(syncLog.id, 'completed');

      log(`✅ Incremental export completed: ${result.processed}/${contacts.length} contacts`);

      return result;

    } catch (error) {
      logError('Incremental export failed:', error);
      await this.db.completeSyncLog(syncLog.id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Export a single contact
   */
  async exportSingleContact(contactId) {
    await this.init();

    try {
      log(`📥 Exporting single contact: ${contactId}`);

      const contact = await this.api.getContact(contactId);

      if (!contact) {
        throw new Error(`Contact not found: ${contactId}`);
      }

      // Get additional data
      const [notes, tasks, appointments] = await Promise.all([
        this.api.getContactNotes(contactId).catch(() => null),
        this.api.getContactTasks(contactId).catch(() => null),
        this.api.getContactAppointments(contactId).catch(() => null)
      ]);

      // Enrich contact data
      if (notes) contact.notes = notes;
      if (tasks) contact.tasks = tasks;
      if (appointments) contact.appointments = appointments;

      // Upsert to database
      await this.db.upsertContact(contact);

      log(`✅ Contact exported successfully: ${contact.firstName} ${contact.lastName}`);

      return contact;

    } catch (error) {
      logError(`Failed to export contact ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Sync contacts (bidirectional)
   */
  async syncContacts(options = {}) {
    await this.init();

    log(`🔄 Starting bidirectional sync...`);

    try {
      // Step 1: Export new/updated contacts from GHL
      const lastSync = await this.db.getLatestSyncLog();
      let startDate = new Date(Date.now() - 24*60*60*1000); // Default: last 24 hours

      if (lastSync && lastSync.completed_at) {
        startDate = new Date(lastSync.completed_at);
      }

      log(`📥 Fetching contacts updated since ${startDate.toISOString()}`);
      await this.exportContactsByDateRange(startDate, new Date(), options);

      // Step 2: Push local changes to GHL (if enabled)
      if (options.pushLocalChanges) {
        await this.pushLocalChangesToGHL();
      }

      log(`✅ Sync completed successfully`);

    } catch (error) {
      logError('Sync failed:', error);
      throw error;
    }
  }

  /**
   * Process a batch of contacts
   */
  async processBatch(contacts) {
    try {
      const result = await this.db.bulkUpsertContacts(contacts);

      if (result.errors && result.errors.length > 0) {
        logError(`Batch processing had ${result.errors.length} errors:`, result.errors);
      }

      return result;

    } catch (error) {
      logError('Batch processing failed:', error);
      throw error;
    }
  }

  /**
   * Push local changes to GHL
   */
  async pushLocalChangesToGHL() {
    log(`📤 Pushing local changes to GHL...`);

    const pendingContacts = await this.db.getContactsBySyncStatus('pending');

    if (pendingContacts.length === 0) {
      log(`✅ No pending changes to push`);
      return;
    }

    log(`📋 Found ${pendingContacts.length} contacts with pending changes`);

    let successCount = 0;
    let errorCount = 0;

    for (const contact of pendingContacts) {
      try {
        // Prepare contact data for GHL
        const ghlContact = {
          firstName: contact.first_name,
          lastName: contact.last_name,
          email: contact.email,
          phone: contact.phone,
          address: contact.address,
          city: contact.city,
          state: contact.state,
          country: contact.country,
          postalCode: contact.postal_code,
          // Add other fields as needed
        };

        // Update or create in GHL
        if (contact.id) {
          await this.api.updateContact(contact.id, ghlContact);
        } else {
          const result = await this.api.createContact(ghlContact);
          // Update local ID
          await this.db.updateContact(contact.id, { id: result.contact.id });
        }

        // Mark as synced
        await this.db.updateContact(contact.id, { sync_status: 'synced' });
        successCount++;

      } catch (error) {
        logError(`Failed to push contact ${contact.id}:`, error);
        await this.db.updateContact(contact.id, {
          sync_status: 'error',
          sync_error: error.message
        });
        errorCount++;
      }
    }

    log(`✅ Push completed: ${successCount} success, ${errorCount} errors`);
  }

  /**
   * Get export statistics
   */
  async getStatistics() {
    await this.init();

    const [totalContacts, latestSync, syncHistory] = await Promise.all([
      this.db.getContactCount(),
      this.db.getLatestSyncLog(),
      this.db.getAllSyncLogs(10)
    ]);

    return {
      totalContacts,
      latestSync,
      syncHistory,
      apiStatus: await this.api.testConnection(),
      rateLimitStatus: this.api.getRateLimitStatus()
    };
  }

  /**
   * Search exported contacts locally
   */
  async searchLocalContacts(criteria) {
    await this.init();
    return await this.db.searchContacts(criteria);
  }

  /**
   * Get all exported contacts with pagination
   */
  async getExportedContacts(limit = 100, offset = 0) {
    await this.init();
    return await this.db.getAllContacts(limit, offset);
  }

  /**
   * Utility: Delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up resources
   */
  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

// Export class only, don't create singleton
export { GHLContactExportService };
export default GHLContactExportService;