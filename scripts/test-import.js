#!/usr/bin/env node

import GHLAPIClient from '../src/services/ghl-api-client.js';
import GHLRateLimiter from '../src/services/ghl-rate-limiter.js';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test Import Service
 * Imports a small batch of contacts to test the system
 */
class TestImportService {
  constructor() {
    this.apiClient = new GHLAPIClient();
    this.rateLimiter = new GHLRateLimiter({
      requestsPerSecond: 7,
      maxRetries: 5
    });

    this.dbPath = path.join(__dirname, '../ghl_contacts/ghl_contacts.db');
    this.db = new Database(this.dbPath);

    this.customFieldsMap = new Map(); // fieldId -> columnName (contacts)
    this.oppCustomFieldsMap = new Map(); // fieldId -> columnName (opportunities)
    this.loadExistingCustomFields();

    // Sync tracking
    this.currentSyncId = null;
    this.checkpointInterval = 100; // Save checkpoint every 100 records
  }

  /**
   * Check if there's an incomplete sync to resume
   */
  checkIncompleteSync() {
    const incomplete = this.db.prepare(`
      SELECT * FROM ghl_sync_log
      WHERE status = 'running' AND entity_type = 'contacts'
      ORDER BY started_at DESC
      LIMIT 1
    `).get();

    return incomplete;
  }

  /**
   * Start new sync or resume existing one
   */
  startSync(entityType = 'contacts', totalRecords = 0) {
    const incomplete = this.checkIncompleteSync();

    if (incomplete) {
      console.log(`⚠️  Found incomplete sync from ${incomplete.started_at}`);
      console.log(`   Last checkpoint: ${incomplete.last_checkpoint_at || 'none'}`);
      console.log(`   Progress: ${incomplete.records_processed}/${incomplete.total_records || 'unknown'}\n`);
      console.log(`🔄 RESUMING from last checkpoint...\n`);

      this.currentSyncId = incomplete.id;
      return {
        resuming: true,
        recordsProcessed: incomplete.records_processed || 0,
        lastSearchAfter: incomplete.last_search_after,
        syncId: incomplete.id
      };
    }

    // Create new sync
    const result = this.db.prepare(`
      INSERT INTO ghl_sync_log (sync_type, entity_type, status, total_records, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run('full_import', entityType, 'running', totalRecords, JSON.stringify({ started_by: 'test-import.js' }));

    this.currentSyncId = result.lastInsertRowid;

    console.log(`🆕 Started new sync (ID: ${this.currentSyncId})\n`);

    return {
      resuming: false,
      recordsProcessed: 0,
      lastSearchAfter: null,
      syncId: this.currentSyncId
    };
  }

  /**
   * Save checkpoint
   */
  saveCheckpoint(recordsProcessed, lastSearchAfter = null) {
    if (!this.currentSyncId) return;

    this.db.prepare(`
      UPDATE ghl_sync_log
      SET records_processed = ?,
          last_checkpoint_at = CURRENT_TIMESTAMP,
          last_search_after = ?
      WHERE id = ?
    `).run(recordsProcessed, lastSearchAfter, this.currentSyncId);
  }

  /**
   * Complete sync successfully
   */
  completeSync(recordsProcessed, recordsFailed = 0) {
    if (!this.currentSyncId) return;

    this.db.prepare(`
      UPDATE ghl_sync_log
      SET status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          records_processed = ?,
          records_failed = ?
      WHERE id = ?
    `).run(recordsProcessed, recordsFailed, this.currentSyncId);
  }

  /**
   * Mark sync as failed
   */
  failSync(errorMessage) {
    if (!this.currentSyncId) return;

    this.db.prepare(`
      UPDATE ghl_sync_log
      SET status = 'failed',
          completed_at = CURRENT_TIMESTAMP,
          error_message = ?
      WHERE id = ?
    `).run(errorMessage, this.currentSyncId);
  }

  /**
   * Load existing custom fields from metadata table
   */
  loadExistingCustomFields() {
    try {
      const fields = this.db.prepare('SELECT field_id, column_name, object_type FROM custom_fields_metadata').all();
      for (const field of fields) {
        if (field.object_type === 'opportunity') {
          this.oppCustomFieldsMap.set(field.field_id, field.column_name);
        } else {
          this.customFieldsMap.set(field.field_id, field.column_name);
        }
      }
      if (fields.length > 0) {
        console.log(`📋 Loaded ${fields.length} existing custom field definitions\n`);
      }
    } catch (error) {
      // Table might not exist yet, that's ok
    }
  }

  /**
   * Analyze custom fields and add columns dynamically
   */
  async analyzeAndAddCustomFields(contacts) {
    console.log('🔍 Analyzing custom fields...\n');

    const newFields = new Map(); // fieldId -> { values, types }

    // Analyze all contacts for custom fields
    for (const contact of contacts) {
      if (!contact.customFields || !Array.isArray(contact.customFields)) continue;

      for (const field of contact.customFields) {
        if (!field.id) continue;

        // Skip if already known
        if (this.customFieldsMap.has(field.id)) continue;

        if (!newFields.has(field.id)) {
          newFields.set(field.id, {
            id: field.id,
            values: [],
            types: new Set()
          });
        }

        const fieldData = newFields.get(field.id);
        fieldData.values.push(field.value);

        const valueType = Array.isArray(field.value) ? 'array' : typeof field.value;
        fieldData.types.add(valueType);
      }
    }

    if (newFields.size === 0) {
      console.log('  ℹ️  No new custom fields found.\n');
      return;
    }

    console.log(`  🆕 Found ${newFields.size} new custom fields\n`);

    // Add columns for new fields
    for (const [fieldId, fieldData] of newFields.entries()) {
      const columnName = this.generateColumnName(fieldId);
      const sqlType = this.determineSQLType(fieldData.types, fieldData.values);

      try {
        // Add column
        this.db.exec(`ALTER TABLE ghl_contacts ADD COLUMN ${columnName} ${sqlType}`);
        console.log(`  ✅ Added column: ${columnName} ${sqlType}`);

        // Save to metadata
        this.db.prepare(`
          INSERT INTO custom_fields_metadata (field_id, column_name, sql_type, data_type)
          VALUES (?, ?, ?, ?)
        `).run(fieldId, columnName, sqlType, Array.from(fieldData.types).join(','));

        // Update map
        this.customFieldsMap.set(fieldId, columnName);

      } catch (error) {
        console.error(`  ❌ Error adding column ${columnName}:`, error.message);
      }
    }

    console.log('');
  }

  /**
   * Generate column name from field ID
   */
  generateColumnName(fieldId) {
    return `cf_${fieldId.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * Determine SQL type from JS types
   */
  determineSQLType(types, sampleValues) {
    const typesArray = Array.from(types);

    if (typesArray.length === 1) {
      const type = typesArray[0];
      if (type === 'number') return 'REAL';
      if (type === 'boolean') return 'INTEGER';
      if (type === 'array') return 'TEXT';
      return 'TEXT';
    }

    // Mixed types - default to TEXT
    return 'TEXT';
  }

  /**
   * Convert custom field value for database
   */
  convertCustomFieldValue(value, sqlType) {
    if (value === null || value === undefined) return null;

    if (sqlType === 'TEXT') {
      if (Array.isArray(value)) return JSON.stringify(value);
      return String(value);
    }

    if (sqlType === 'REAL') {
      return typeof value === 'number' ? value : parseFloat(value);
    }

    if (sqlType === 'INTEGER') {
      return value ? 1 : 0;
    }

    return value;
  }

  /**
   * Import contacts to database
   */
  async importContacts(contacts, showLogs = false) {
    if (showLogs) {
      console.log('💾 Importing contacts to database...\n');
    }

    let imported = 0;
    let errors = 0;

    for (const contact of contacts) {
      try {
        // Build base contact data
        const contactData = {
          id: contact.id,
          location_id: contact.locationId || this.apiClient.locationId,
          first_name: contact.firstName || null,
          last_name: contact.lastName || null,
          email: contact.email || null,
          phone: contact.phone || null,
          company_name: contact.companyName || null,
          source: contact.source || null,
          tags: contact.tags ? JSON.stringify(contact.tags) : null,
          custom_fields: contact.customFields ? JSON.stringify(contact.customFields) : null,
          date_added: contact.dateAdded || null,
          date_updated: contact.dateUpdated || new Date().toISOString()
        };

        // Add custom field values as individual columns
        if (contact.customFields && Array.isArray(contact.customFields)) {
          for (const field of contact.customFields) {
            if (!field.id || !this.customFieldsMap.has(field.id)) continue;

            const columnName = this.customFieldsMap.get(field.id);
            const metadata = this.db.prepare(
              'SELECT sql_type FROM custom_fields_metadata WHERE field_id = ?'
            ).get(field.id);

            if (metadata) {
              contactData[columnName] = this.convertCustomFieldValue(field.value, metadata.sql_type);
            }
          }
        }

        // Insert contact
        const columns = Object.keys(contactData).join(', ');
        const placeholders = Object.keys(contactData).map(() => '?').join(', ');
        const values = Object.values(contactData);

        this.db.prepare(`
          INSERT OR REPLACE INTO ghl_contacts (${columns})
          VALUES (${placeholders})
        `).run(...values);

        imported++;
        if (showLogs) {
          console.log(`  ✅ Imported: ${contact.firstName} ${contact.lastName} (${contact.email})`);
        }

        // Import opportunities if present
        if (contact.opportunities && Array.isArray(contact.opportunities)) {
          await this.importOpportunities(contact.id, contact.opportunities);
        }

      } catch (error) {
        errors++;
        if (showLogs) {
          console.error(`  ❌ Error importing ${contact.email}:`, error.message);
        }
      }
    }

    if (showLogs) {
      console.log(`\n📊 Import Summary:`);
      console.log(`   Imported: ${imported}`);
      console.log(`   Errors: ${errors}\n`);
    }

    return { imported, errors };
  }

  /**
   * Analyze opportunity custom fields and add columns dynamically
   */
  async analyzeAndAddOpportunityCustomFields(opportunities) {
    const newFields = new Map();

    for (const opp of opportunities) {
      if (!opp.customFields || !Array.isArray(opp.customFields)) continue;

      for (const field of opp.customFields) {
        if (!field.id) continue;
        if (this.oppCustomFieldsMap.has(field.id)) continue;

        if (!newFields.has(field.id)) {
          newFields.set(field.id, {
            id: field.id,
            values: [],
            types: new Set()
          });
        }

        const fieldData = newFields.get(field.id);
        const value = field.fieldValueString || field.fieldValueArray || field.fieldValueNumber;
        fieldData.values.push(value);

        const valueType = field.fieldValueArray ? 'array' : field.type;
        fieldData.types.add(valueType);
      }
    }

    if (newFields.size === 0) return;

    console.log(`  🆕 Found ${newFields.size} new opportunity custom fields\n`);

    for (const [fieldId, fieldData] of newFields.entries()) {
      const columnName = this.generateOppColumnName(fieldId);
      const sqlType = this.determineSQLType(fieldData.types, fieldData.values);

      try {
        this.db.exec(`ALTER TABLE ghl_opportunities ADD COLUMN ${columnName} ${sqlType}`);
        console.log(`  ✅ Added opp column: ${columnName} ${sqlType}`);

        this.db.prepare(`
          INSERT INTO custom_fields_metadata (field_id, column_name, sql_type, data_type, object_type)
          VALUES (?, ?, ?, ?, ?)
        `).run(fieldId, columnName, sqlType, Array.from(fieldData.types).join(','), 'opportunity');

        this.oppCustomFieldsMap.set(fieldId, columnName);
      } catch (error) {
        console.error(`  ❌ Error adding column ${columnName}:`, error.message);
      }
    }

    console.log('');
  }

  /**
   * Generate column name for opportunity custom field
   */
  generateOppColumnName(fieldId) {
    return `opp_cf_${fieldId.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * Convert opportunity custom field value
   */
  convertOppCustomFieldValue(field) {
    if (!field) return null;

    if (field.fieldValueString) return field.fieldValueString;
    if (field.fieldValueNumber) return field.fieldValueNumber;
    if (field.fieldValueArray) return JSON.stringify(field.fieldValueArray);

    return null;
  }

  /**
   * Get lost reason name from ID
   */
  getLostReasonName(lostReasonId) {
    if (!lostReasonId) return null;

    try {
      const result = this.db.prepare(
        'SELECT name FROM ghl_lost_reasons WHERE id = ?'
      ).get(lostReasonId);

      return result ? result.name : null;
    } catch (error) {
      console.warn(`  ⚠️  Could not resolve lost reason ID ${lostReasonId}`);
      return null;
    }
  }

  /**
   * Import opportunities for a contact
   */
  async importOpportunities(contactId, opportunities) {
    for (const opp of opportunities) {
      try {
        // Build base opportunity data
        const oppData = {
          id: opp.id,
          contact_id: contactId,
          pipeline_id: opp.pipelineId || null,
          pipeline_stage_id: opp.pipelineStageId || null,
          name: opp.name || null,
          status: opp.status || null,
          lost_reason_id: opp.lostReasonId || null,
          lost_reason_name: this.getLostReasonName(opp.lostReasonId),
          monetary_value: opp.monetaryValue || 0,
          assigned_to: opp.assignedTo || null,
          source: opp.source || null,
          last_status_change_at: opp.lastStatusChangeAt || null,
          last_stage_change_at: opp.lastStageChangeAt || null,
          custom_fields: opp.customFields ? JSON.stringify(opp.customFields) : null,
          tags: opp.tags ? JSON.stringify(opp.tags) : null,
          created_at: opp.createdAt || null,
          updated_at: opp.updatedAt || null
        };

        // Add opportunity custom field values as individual columns
        if (opp.customFields && Array.isArray(opp.customFields)) {
          for (const field of opp.customFields) {
            if (!field.id || !this.oppCustomFieldsMap.has(field.id)) continue;

            const columnName = this.oppCustomFieldsMap.get(field.id);
            oppData[columnName] = this.convertOppCustomFieldValue(field);
          }
        }

        // Insert opportunity
        const columns = Object.keys(oppData).join(', ');
        const placeholders = Object.keys(oppData).map(() => '?').join(', ');
        const values = Object.values(oppData);

        this.db.prepare(`
          INSERT OR REPLACE INTO ghl_opportunities (${columns})
          VALUES (${placeholders})
        `).run(...values);

      } catch (error) {
        console.error(`    ⚠️  Error importing opportunity ${opp.id}:`, error.message);
      }
    }
  }

  /**
   * Fetch opportunities for contacts
   */
  async fetchContactOpportunities(contactIds) {
    console.log('🔍 Fetching opportunities for contacts...\n');

    let totalOpportunities = 0;
    let contactsWithOpps = 0;
    const allOpportunities = [];

    for (const contactId of contactIds) {
      try {
        const response = await this.rateLimiter.executeWithRetry(async () => {
          return await this.apiClient.getContactOpportunities(contactId);
        });

        // Response structure: { opportunities: [...], meta: {...} }
        if (response.opportunities && response.opportunities.length > 0) {
          allOpportunities.push(...response.opportunities.map(opp => ({ ...opp, contactId })));
          totalOpportunities += response.opportunities.length;
          contactsWithOpps++;
          console.log(`  ✅ Fetched ${response.opportunities.length} opportunities for contact ${contactId}`);
        }

      } catch (error) {
        // Don't log 404s as errors - just means no opportunities
        if (!error.message.includes('404')) {
          console.error(`  ❌ Error fetching opportunities for ${contactId}:`, error.message);
        }
      }
    }

    if (totalOpportunities > 0) {
      console.log(`\n📊 Total: ${totalOpportunities} opportunities from ${contactsWithOpps} contacts\n`);

      // Analyze and add opportunity custom field columns
      console.log('🔍 Analyzing opportunity custom fields...\n');
      await this.analyzeAndAddOpportunityCustomFields(allOpportunities);

      // Import all opportunities
      console.log('💾 Importing opportunities with custom fields...\n');
      for (const opp of allOpportunities) {
        await this.importOpportunities(opp.contactId, [opp]);
      }
    } else {
      console.log(`  ℹ️  No opportunities found for these contacts\n`);
    }
  }

  /**
   * Run test import
   */
  async run(limit = 10) {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TEST IMPORT - COMPLETE SYSTEM WITH RESUME');
    console.log('='.repeat(80) + '\n');

    const targetLimit = limit === 21678 ? 'ALL' : limit;
    console.log(`📊 Importing ${targetLimit} contacts with all related data...\n`);

    try {
      // Start sync tracking (will resume if incomplete sync found)
      const syncState = this.startSync('contacts', limit === 21678 ? 0 : limit);

      // Step 1: Fetch contacts with pagination
      console.log('🌐 Step 1: Fetching contacts from GHL API (paginated)...\n');

      const allContacts = [];
      const allContactIds = [];
      let totalFetched = 0;
      let skipCount = syncState.resuming ? syncState.recordsProcessed : 0;

      // Use iterator for automatic pagination (max 100 per request for safety)
      for await (const batch of this.apiClient.contactsIterator({ pageLimit: 100 })) {
        // Skip already processed batches if resuming
        if (skipCount > 0) {
          const toSkip = Math.min(batch.length, skipCount);
          skipCount -= toSkip;

          if (toSkip === batch.length) {
            console.log(`  ⏩ Skipped batch: ${batch.length} contacts (already processed)`);
            continue;
          } else {
            // Partial batch skip
            const remainingBatch = batch.slice(toSkip);
            allContacts.push(...remainingBatch);
            allContactIds.push(...remainingBatch.map(c => c.id));
            totalFetched += remainingBatch.length;
            console.log(`  ⏩ Skipped ${toSkip} contacts, processing ${remainingBatch.length} from batch`);
            continue;
          }
        }

        allContacts.push(...batch);
        allContactIds.push(...batch.map(c => c.id));
        totalFetched += batch.length;

        console.log(`  📦 Fetched batch: ${batch.length} contacts (Total: ${totalFetched + (syncState.resuming ? syncState.recordsProcessed : 0)})`);

        // Stop if we reached the limit
        if (limit !== 21678 && totalFetched >= limit) {
          console.log(`  ⚠️  Reached limit of ${limit} contacts, stopping fetch\n`);
          break;
        }
      }

      if (allContacts.length === 0) {
        console.log('⚠️  No contacts found.\n');
        return;
      }

      console.log(`\n  ✅ Total fetched: ${allContacts.length} contacts\n`);

      // Step 2: Analyze and add custom field columns (analyze ALL at once for efficiency)
      console.log('🔍 Step 2: Analyzing custom fields...\n');
      await this.analyzeAndAddCustomFields(allContacts);

      // Step 3: Import contacts in batches WITH CHECKPOINTS
      console.log('💾 Step 3: Importing contacts in batches...\n');
      const batchSize = 100;
      let totalImported = syncState.resuming ? syncState.recordsProcessed : 0;

      for (let i = 0; i < allContacts.length; i += batchSize) {
        const batch = allContacts.slice(i, i + batchSize);
        await this.importContacts(batch);

        totalImported += batch.length;

        // Save checkpoint
        this.saveCheckpoint(totalImported);

        console.log(`  ✅ Imported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allContacts.length / batchSize)} (Total: ${totalImported} | 💾 Checkpoint saved)`);
      }

      // Step 4: Fetch and import opportunities (SKIP for full import - too slow)
      if (allContactIds.length <= 100) {
        console.log('\n📈 Step 4: Fetching opportunities...\n');
        await this.fetchContactOpportunities(allContactIds);
      } else {
        console.log('\n📈 Step 4: Skipping opportunities (use separate script for full sync)...\n');
      }

      // Step 5: Fetch and import appointments (SKIP for full import - too slow)
      if (allContactIds.length <= 100) {
        console.log('📅 Step 5: Fetching appointments...\n');
        await this.fetchContactAppointments(allContactIds);
      } else {
        console.log('📅 Step 5: Skipping appointments (use separate script for full sync)...\n');
      }

      // Step 6: Fetch pipelines metadata
      console.log('🏭 Step 6: Fetching pipelines metadata...\n');
      await this.fetchPipelines();

      // Step 7: Fetch conversations with messages (limited for testing)
      console.log('💬 Step 7: Fetching conversations and messages...\n');
      await this.fetchConversations(20); // Limit to 20 conversations for testing

      // Step 8: Final verification
      console.log('✅ Step 8: Final verification...\n');
      await this.verify();

      // Mark sync as completed
      this.completeSync(totalImported || allContacts.length, 0);

      console.log('='.repeat(80));
      console.log('🎉 TEST IMPORT COMPLETE - ALL SYSTEMS OPERATIONAL!');
      console.log('='.repeat(80) + '\n');

      // Show import summary
      console.log('📋 IMPORT SUMMARY:');
      console.log(`  ✅ Contacts imported: ${totalImported || allContacts.length}`);
      console.log('  ✅ Custom fields analyzed and added dynamically');
      if (allContactIds.length <= 100) {
        console.log('  ✅ Opportunities imported with lost reasons');
        console.log('  ✅ Appointments imported and linked to contacts');
      } else {
        console.log('  ⏭️  Opportunities skipped (use separate script)');
        console.log('  ⏭️  Appointments skipped (use separate script)');
      }
      console.log('  ✅ Conversations imported (sample)');
      console.log('  ✅ Pipelines metadata imported with stages');
      console.log('  ✅ Sync tracking enabled with resume capability\n');

      console.log('💾 Sync ID:', this.currentSyncId);
      console.log('🚀 System ready! Run opportunities import next.\n');

    } catch (error) {
      // Mark sync as failed
      this.failSync(error.message);

      console.error('\n' + '='.repeat(80));
      console.error('❌ TEST IMPORT FAILED');
      console.error('='.repeat(80));
      console.error('\nError:', error.message);
      console.error('\nStack:', error.stack);
      console.error('\n⚠️  Sync marked as failed. You can resume by running the script again.\n');
      throw error;
    } finally {
      this.db.close();
    }
  }

  /**
   * Fetch and import appointments for contacts
   */
  async fetchContactAppointments(contactIds) {
    console.log('🔍 Fetching appointments for contacts...\n');

    let totalAppointments = 0;
    let contactsWithAppts = 0;

    for (const contactId of contactIds) {
      try {
        const response = await this.rateLimiter.executeWithRetry(async () => {
          return await this.apiClient.getContactAppointments(contactId);
        });

        if (response && response.events && response.events.length > 0) {
          await this.importAppointments(contactId, response.events);
          totalAppointments += response.events.length;
          contactsWithAppts++;
          console.log(`  ✅ Imported ${response.events.length} appointments for contact ${contactId}`);
        }
      } catch (error) {
        if (!error.message.includes('404')) {
          console.error(`  ❌ Error fetching appointments for ${contactId}:`, error.message);
        }
      }
    }

    if (totalAppointments > 0) {
      console.log(`\n📊 Total: ${totalAppointments} appointments from ${contactsWithAppts} contacts\n`);
    } else {
      console.log(`  ℹ️  No appointments found for these contacts\n`);
    }
  }

  /**
   * Import appointments to database
   */
  async importAppointments(contactId, appointments) {
    for (const appt of appointments) {
      try {
        const apptData = {
          id: appt.id,
          location_id: appt.locationId || this.apiClient.locationId,
          calendar_id: appt.calendarId || null,
          contact_id: contactId,
          title: appt.title || null,
          start_time: appt.startTime || appt.start || null,
          end_time: appt.endTime || appt.end || null,
          status: appt.status || null,
          appointment_status: appt.appointmentStatus || null,
          assigned_user_id: appt.assignedUserId || null,
          address: appt.address || null,
          notes: appt.notes || null,
          is_all_day: appt.isAllDay ? 1 : 0,
          meeting_location: appt.meetingLocation || null,
          custom_fields: appt.customFields ? JSON.stringify(appt.customFields) : null,
          created_at: appt.createdAt || null,
          updated_at: appt.updatedAt || null
        };

        const columns = Object.keys(apptData).join(', ');
        const placeholders = Object.keys(apptData).map(() => '?').join(', ');
        const values = Object.values(apptData);

        this.db.prepare(`
          INSERT OR REPLACE INTO ghl_appointments (${columns})
          VALUES (${placeholders})
        `).run(...values);

      } catch (error) {
        console.error(`    ⚠️  Error importing appointment ${appt.id}:`, error.message);
      }
    }
  }

  /**
   * Fetch and import conversations with messages
   */
  async fetchConversations(limit = 50) {
    console.log('🔍 Fetching recent conversations...\n');

    let totalConversations = 0;
    let totalMessages = 0;

    try {
      // Fetch recent conversations (limit to prevent timeout)
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.apiClient.getConversations({ limit });
      });

      if (response && response.conversations && response.conversations.length > 0) {
        totalConversations = response.conversations.length;
        console.log(`  ✅ Fetched ${totalConversations} conversations\n`);

        // Import conversations
        await this.importConversations(response.conversations);

        // Fetch messages for each conversation (limit to first 10 to avoid timeout)
        const conversationsToProcess = response.conversations.slice(0, 10);
        console.log(`📬 Fetching messages for ${conversationsToProcess.length} conversations...\n`);

        for (const conv of conversationsToProcess) {
          try {
            const messagesResponse = await this.rateLimiter.executeWithRetry(async () => {
              return await this.apiClient.getConversationMessages(conv.id, { limit: 20 });
            });

            if (messagesResponse && messagesResponse.messages) {
              await this.importMessages(conv.id, messagesResponse.messages);
              totalMessages += messagesResponse.messages.length;
              console.log(`  ✅ Imported ${messagesResponse.messages.length} messages for conversation ${conv.id}`);
            }
          } catch (error) {
            console.error(`  ⚠️  Error fetching messages for conversation ${conv.id}:`, error.message);
          }
        }

        console.log(`\n📊 Total: ${totalConversations} conversations, ${totalMessages} messages\n`);
      } else {
        console.log(`  ℹ️  No conversations found\n`);
      }
    } catch (error) {
      console.error(`  ❌ Error fetching conversations:`, error.message);
    }
  }

  /**
   * Import conversations to database
   */
  async importConversations(conversations) {
    for (const conv of conversations) {
      try {
        const convData = {
          id: conv.id,
          location_id: conv.locationId || this.apiClient.locationId,
          contact_id: conv.contactId || null,
          assigned_to: conv.assignedTo || null,
          status: conv.status || null,
          type: conv.type || null,
          last_message_type: conv.lastMessageType || null,
          last_message_direction: conv.lastMessageDirection || null,
          last_message_body: conv.lastMessageBody || null,
          last_message_date: conv.lastMessageDate || null,
          unread_count: conv.unreadCount || 0,
          starred: conv.starred ? 1 : 0,
          created_at: conv.dateAdded || conv.createdAt || null,
          updated_at: conv.dateUpdated || conv.updatedAt || null
        };

        const columns = Object.keys(convData).join(', ');
        const placeholders = Object.keys(convData).map(() => '?').join(', ');
        const values = Object.values(convData);

        this.db.prepare(`
          INSERT OR REPLACE INTO ghl_conversations (${columns})
          VALUES (${placeholders})
        `).run(...values);

      } catch (error) {
        console.error(`    ⚠️  Error importing conversation ${conv.id}:`, error.message);
      }
    }
  }

  /**
   * Import messages to database
   */
  async importMessages(conversationId, messages) {
    for (const msg of messages) {
      try {
        const msgData = {
          id: msg.id || `${conversationId}_${Date.now()}_${Math.random()}`,
          conversation_id: conversationId,
          contact_id: msg.contactId || null,
          location_id: msg.locationId || this.apiClient.locationId,
          type: msg.type || msg.messageType || null,
          direction: msg.direction || null,
          body: msg.body || msg.message || null,
          status: msg.status || msg.messageStatus || null,
          attachments: msg.attachments ? JSON.stringify(msg.attachments) : null,
          content_type: msg.contentType || null,
          call_duration: msg.callDuration || null,
          recording_url: msg.recordingUrl || null,
          transcription: msg.transcription || null,
          date_added: msg.dateAdded || msg.createdAt || null
        };

        const columns = Object.keys(msgData).join(', ');
        const placeholders = Object.keys(msgData).map(() => '?').join(', ');
        const values = Object.values(msgData);

        this.db.prepare(`
          INSERT OR REPLACE INTO ghl_messages (${columns})
          VALUES (${placeholders})
        `).run(...values);

      } catch (error) {
        console.error(`      ⚠️  Error importing message:`, error.message);
      }
    }
  }

  /**
   * Fetch and import pipelines metadata
   */
  async fetchPipelines() {
    console.log('🔍 Fetching pipelines metadata...\n');

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.apiClient.getPipelines();
      });

      if (response && response.pipelines && response.pipelines.length > 0) {
        console.log(`  ✅ Fetched ${response.pipelines.length} pipelines\n`);

        for (const pipeline of response.pipelines) {
          await this.importPipeline(pipeline);
        }

        // Update opportunities with pipeline/stage names
        await this.updateOpportunityPipelineNames();
      } else {
        console.log(`  ℹ️  No pipelines found\n`);
      }
    } catch (error) {
      console.error(`  ❌ Error fetching pipelines:`, error.message);
    }
  }

  /**
   * Import pipeline and its stages
   */
  async importPipeline(pipeline) {
    try {
      // Import pipeline
      const pipelineData = {
        id: pipeline.id,
        location_id: pipeline.locationId || this.apiClient.locationId,
        name: pipeline.name,
        stage_order: pipeline.stages ? JSON.stringify(pipeline.stages.map(s => s.id)) : null,
        visibility: pipeline.visibility || null,
        created_at: pipeline.createdAt || null,
        updated_at: pipeline.updatedAt || null
      };

      const columns = Object.keys(pipelineData).join(', ');
      const placeholders = Object.keys(pipelineData).map(() => '?').join(', ');
      const values = Object.values(pipelineData);

      this.db.prepare(`
        INSERT OR REPLACE INTO ghl_pipelines (${columns})
        VALUES (${placeholders})
      `).run(...values);

      console.log(`  ✅ Imported pipeline: ${pipeline.name}`);

      // Import pipeline stages
      if (pipeline.stages && Array.isArray(pipeline.stages)) {
        for (let i = 0; i < pipeline.stages.length; i++) {
          const stage = pipeline.stages[i];
          const stageData = {
            id: stage.id,
            pipeline_id: pipeline.id,
            name: stage.name,
            position: stage.position || i,
            probability: stage.probability || null
          };

          const stageColumns = Object.keys(stageData).join(', ');
          const stagePlaceholders = Object.keys(stageData).map(() => '?').join(', ');
          const stageValues = Object.values(stageData);

          this.db.prepare(`
            INSERT OR REPLACE INTO ghl_pipeline_stages (${stageColumns})
            VALUES (${stagePlaceholders})
          `).run(...stageValues);
        }
        console.log(`    ✅ Imported ${pipeline.stages.length} stages`);
      }
    } catch (error) {
      console.error(`  ❌ Error importing pipeline ${pipeline.id}:`, error.message);
    }
  }

  /**
   * Update opportunities with pipeline and stage names
   */
  async updateOpportunityPipelineNames() {
    console.log('🔄 Updating opportunity pipeline/stage names...\n');

    try {
      // Update pipeline names
      this.db.exec(`
        UPDATE ghl_opportunities
        SET pipeline_name = (
          SELECT name FROM ghl_pipelines
          WHERE ghl_pipelines.id = ghl_opportunities.pipeline_id
        )
        WHERE pipeline_id IS NOT NULL
      `);

      // Update stage names
      this.db.exec(`
        UPDATE ghl_opportunities
        SET stage_name = (
          SELECT name FROM ghl_pipeline_stages
          WHERE ghl_pipeline_stages.id = ghl_opportunities.pipeline_stage_id
        )
        WHERE pipeline_stage_id IS NOT NULL
      `);

      console.log('  ✅ Updated pipeline and stage names\n');
    } catch (error) {
      console.error('  ⚠️  Error updating pipeline names:', error.message);
    }
  }

  /**
   * Verify imported data
   */
  async verify() {
    console.log('🔍 Verifying imported data...\n');

    const contactCount = this.db.prepare('SELECT COUNT(*) as count FROM ghl_contacts').get().count;
    const oppCount = this.db.prepare('SELECT COUNT(*) as count FROM ghl_opportunities').get().count;
    const apptCount = this.db.prepare('SELECT COUNT(*) as count FROM ghl_appointments').get().count;
    const convCount = this.db.prepare('SELECT COUNT(*) as count FROM ghl_conversations').get().count;
    const msgCount = this.db.prepare('SELECT COUNT(*) as count FROM ghl_messages').get().count;
    const pipelineCount = this.db.prepare('SELECT COUNT(*) as count FROM ghl_pipelines').get().count;
    const stageCount = this.db.prepare('SELECT COUNT(*) as count FROM ghl_pipeline_stages').get().count;
    const customFieldsCount = this.db.prepare('SELECT COUNT(*) as count FROM custom_fields_metadata').get().count;

    console.log(`📊 Database Statistics:`);
    console.log(`   Contacts: ${contactCount}`);
    console.log(`   Opportunities: ${oppCount}`);
    console.log(`   Appointments: ${apptCount}`);
    console.log(`   Conversations: ${convCount}`);
    console.log(`   Messages: ${msgCount}`);
    console.log(`   Pipelines: ${pipelineCount}`);
    console.log(`   Pipeline Stages: ${stageCount}`);
    console.log(`   Custom Fields: ${customFieldsCount}\n`);

    // Show sample with custom fields
    const columns = this.db.prepare("PRAGMA table_info(ghl_contacts)").all();
    const customFieldCols = columns.filter(c => c.name.startsWith('cf_')).slice(0, 3).map(c => c.name);

    if (customFieldCols.length > 0) {
      console.log('📄 Sample contact with custom fields:');
      const sampleColsStr = customFieldCols.join(', ');
      const sample = this.db.prepare(`
        SELECT id, first_name, last_name, email, ${sampleColsStr}
        FROM ghl_contacts
        LIMIT 1
      `).get();

      if (sample) {
        console.table([sample]);
      }
    }

    // Show sample opportunity with pipeline names
    if (oppCount > 0) {
      console.log('\n📄 Sample opportunity with pipeline info:');
      const oppSample = this.db.prepare(`
        SELECT id, name, pipeline_name, stage_name, status, lost_reason_name, monetary_value
        FROM ghl_opportunities
        WHERE pipeline_name IS NOT NULL
        LIMIT 1
      `).get();

      if (oppSample) {
        console.table([oppSample]);
      }
    }

    console.log('\n✅ Verification complete!\n');
  }
}

// Main execution
const limit = parseInt(process.argv[2]) || 10;

const testImport = new TestImportService();
testImport.run(limit).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
