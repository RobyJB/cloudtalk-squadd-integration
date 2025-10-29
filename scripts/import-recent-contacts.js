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
 * Import only contacts from last 2 days (with full data: opportunities, appointments, etc.)
 */
class RecentContactsImporter {
  constructor() {
    this.apiClient = new GHLAPIClient();
    this.rateLimiter = new GHLRateLimiter({ requestsPerSecond: 7 });
    this.dbPath = path.join(__dirname, '../ghl_contacts/ghl_contacts.db');
    this.db = new Database(this.dbPath);

    // Track custom fields
    this.customFieldsMap = new Map();
    this.loadExistingCustomFields();

    // Date filter: last 2 days
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
    this.startDate = twoDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`\n📅 Importing contacts from: ${this.startDate}`);
  }

  loadExistingCustomFields() {
    try {
      const fields = this.db.prepare(
        'SELECT field_id, column_name FROM custom_fields_metadata WHERE object_type = ?'
      ).all('contact');

      for (const field of fields) {
        this.customFieldsMap.set(field.field_id, field.column_name);
      }
    } catch (error) {
      // Table might not exist
    }
  }

  async importContacts() {
    console.log('\n' + '='.repeat(80));
    console.log('📥 IMPORT RECENT CONTACTS (Last 2 Days)');
    console.log('='.repeat(80) + '\n');

    let totalImported = 0;
    let batchCount = 0;
    const allContacts = [];

    try {
      // Fetch contacts created/updated in last 2 days
      console.log('🔍 Fetching contacts...\n');

      for await (const batch of this.apiClient.contactsIterator({ pageLimit: 100 })) {
        batchCount++;

        // Filter by date (dateAdded >= startDate)
        const recentContacts = batch.filter(contact => {
          const dateAdded = contact.dateAdded || contact.dateUpdated;
          if (!dateAdded) return false;

          const contactDate = new Date(dateAdded);
          const filterDate = new Date(this.startDate);
          return contactDate >= filterDate;
        });

        if (recentContacts.length === 0) {
          console.log(`  Batch ${batchCount}: No contacts from last 2 days, stopping...`);
          break;
        }

        allContacts.push(...recentContacts);
        console.log(`  📦 Batch ${batchCount}: Found ${recentContacts.length} recent contacts (Total: ${allContacts.length})`);

        // If we got less than full batch of recent contacts, we've likely passed the date threshold
        if (recentContacts.length < batch.length) {
          console.log(`  ✅ Reached contacts older than ${this.startDate}, stopping fetch`);
          break;
        }
      }

      console.log(`\n✅ Fetched ${allContacts.length} contacts from last 2 days\n`);

      if (allContacts.length === 0) {
        console.log('ℹ️  No recent contacts to import\n');
        return;
      }

      // Analyze and add custom field columns
      console.log('🔍 Analyzing custom fields...\n');
      await this.analyzeAndAddCustomFields(allContacts);

      // Import contacts into database
      console.log('💾 Importing contacts into database...\n');
      for (const contact of allContacts) {
        try {
          const contactData = {
            id: contact.id,
            location_id: contact.locationId,
            first_name: contact.firstName || null,
            last_name: contact.lastName || null,
            email: contact.email || null,
            phone: contact.phone || null,
            phone_label: contact.phoneLabel || null,
            additional_emails: contact.additionalEmails ? JSON.stringify(contact.additionalEmails) : null,
            additional_phones: contact.additionalPhones ? JSON.stringify(contact.additionalPhones) : null,
            address: contact.address1 || null,
            city: contact.city || null,
            state: contact.state || null,
            country: contact.country || null,
            postal_code: contact.postalCode || null,
            business_id: contact.businessId || null,
            business_name: contact.companyName || null,
            company_name: contact.companyName || null,
            website: contact.website || null,
            type: contact.type || null,
            source: contact.source || null,
            assigned_to: contact.assignedTo || null,
            followers: contact.followers ? JSON.stringify(contact.followers) : null,
            dnd: contact.dnd ? 1 : 0,
            valid_email: contact.emailValid ? 1 : 0,
            custom_fields: contact.customFields ? JSON.stringify(contact.customFields) : null,
            tags: contact.tags ? JSON.stringify(contact.tags) : null,
            date_of_birth: contact.dateOfBirth || null,
            date_added: contact.dateAdded || null,
            date_updated: contact.dateUpdated || null,
            synced_at: new Date().toISOString(),
            local_updated_at: new Date().toISOString(),
            sync_status: 'synced',
            sync_error: null
          };

          // Add custom field values
          if (contact.customFields && Array.isArray(contact.customFields)) {
            for (const field of contact.customFields) {
              if (!field.id || !this.customFieldsMap.has(field.id)) continue;

              const columnName = this.customFieldsMap.get(field.id);
              const value = field.value || field.fieldValue || field.fieldValueString || field.fieldValueArray || field.fieldValueNumber;
              contactData[columnName] = value ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : null;
            }
          }

          const columns = Object.keys(contactData).join(', ');
          const placeholders = Object.keys(contactData).map(() => '?').join(', ');
          const values = Object.values(contactData);

          this.db.prepare(`
            INSERT OR REPLACE INTO ghl_contacts (${columns})
            VALUES (${placeholders})
          `).run(...values);

          totalImported++;
        } catch (error) {
          console.error(`  ⚠️  Error importing contact ${contact.id}:`, error.message);
        }
      }

      console.log(`\n✅ Imported ${totalImported} contacts\n`);

      // Import opportunities for these contacts
      await this.importOpportunitiesForContacts(allContacts);

      console.log('\n' + '='.repeat(80));
      console.log('✅ RECENT CONTACTS IMPORT COMPLETE!');
      console.log('='.repeat(80));
      console.log(`📊 Total contacts imported: ${totalImported}`);
      console.log('='.repeat(80) + '\n');

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      console.error(error.stack);
    } finally {
      this.db.close();
    }
  }

  async analyzeAndAddCustomFields(contacts) {
    const newFields = new Map();

    for (const contact of contacts) {
      if (!contact.customFields || !Array.isArray(contact.customFields)) continue;

      for (const field of contact.customFields) {
        if (!field.id || this.customFieldsMap.has(field.id)) continue;

        if (!newFields.has(field.id)) {
          newFields.set(field.id, {
            id: field.id,
            name: field.name || field.key || 'Unknown',
            values: [],
            types: new Set()
          });
        }

        const fieldData = newFields.get(field.id);
        const value = field.value || field.fieldValue || field.fieldValueString || field.fieldValueArray || field.fieldValueNumber;
        fieldData.values.push(value);

        const valueType = Array.isArray(value) ? 'array' : typeof value;
        fieldData.types.add(valueType);
      }
    }

    if (newFields.size === 0) {
      console.log('  ℹ️  No new custom fields\n');
      return;
    }

    console.log(`  🆕 Found ${newFields.size} new custom fields\n`);

    for (const [fieldId, fieldData] of newFields.entries()) {
      const columnName = `cf_${fieldId.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const sqlType = 'TEXT';

      try {
        this.db.exec(`ALTER TABLE ghl_contacts ADD COLUMN ${columnName} ${sqlType}`);
        console.log(`  ✅ Added column: ${columnName} (${fieldData.name})`);

        this.db.prepare(`
          INSERT INTO custom_fields_metadata (field_id, field_name, column_name, sql_type, data_type, object_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(fieldId, fieldData.name, columnName, sqlType, Array.from(fieldData.types).join(','), 'contact');

        this.customFieldsMap.set(fieldId, columnName);
      } catch (error) {
        if (!error.message.includes('duplicate column name')) {
          console.error(`  ❌ Error adding column ${columnName}:`, error.message);
        }
      }
    }

    console.log('');
  }

  async importOpportunitiesForContacts(contacts) {
    console.log('📈 Importing opportunities for recent contacts...\n');

    let imported = 0;
    let skipped = 0;

    for (const contact of contacts) {
      try {
        const opportunities = await this.rateLimiter.executeWithRetry(async () => {
          return await this.apiClient.getOpportunitiesForContact(contact.id);
        });

        if (opportunities && opportunities.length > 0) {
          for (const opp of opportunities) {
            try {
              const oppData = {
                id: opp.id,
                contact_id: contact.id,
                pipeline_id: opp.pipelineId || null,
                pipeline_stage_id: opp.pipelineStageId || null,
                name: opp.name || null,
                status: opp.status || null,
                lost_reason_id: opp.lostReasonId || null,
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

              // Lookup lost_reason_name
              if (oppData.lost_reason_id) {
                const lostReason = this.db.prepare(
                  'SELECT name FROM ghl_lost_reasons WHERE id = ?'
                ).get(oppData.lost_reason_id);
                oppData.lost_reason_name = lostReason ? lostReason.name : null;
              } else {
                oppData.lost_reason_name = null;
              }

              const columns = Object.keys(oppData).join(', ');
              const placeholders = Object.keys(oppData).map(() => '?').join(', ');
              const values = Object.values(oppData);

              this.db.prepare(`
                INSERT OR REPLACE INTO ghl_opportunities (${columns})
                VALUES (${placeholders})
              `).run(...values);

              imported++;
            } catch (error) {
              console.error(`  ⚠️  Error importing opportunity ${opp.id}:`, error.message);
            }
          }
        }
      } catch (error) {
        skipped++;
        if (!error.message.includes('404')) {
          console.error(`  ⚠️  Error fetching opportunities for ${contact.id}:`, error.message);
        }
      }
    }

    console.log(`  ✅ Imported ${imported} opportunities\n`);

    // Update pipeline/stage names
    this.db.exec(`
      UPDATE ghl_opportunities
      SET pipeline_name = (
        SELECT name FROM ghl_pipelines
        WHERE ghl_pipelines.id = ghl_opportunities.pipeline_id
      )
      WHERE pipeline_id IS NOT NULL
    `);

    this.db.exec(`
      UPDATE ghl_opportunities
      SET stage_name = (
        SELECT name FROM ghl_pipeline_stages
        WHERE ghl_pipeline_stages.id = ghl_opportunities.pipeline_stage_id
      )
      WHERE pipeline_stage_id IS NOT NULL
    `);

    console.log('  ✅ Pipeline/stage names updated\n');
  }
}

// Execute
const importer = new RecentContactsImporter();
importer.importContacts().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
