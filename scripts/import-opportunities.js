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
 * Import all opportunities efficiently using location-wide search
 */
class OpportunitiesImporter {
  constructor() {
    this.apiClient = new GHLAPIClient();
    this.rateLimiter = new GHLRateLimiter({ requestsPerSecond: 7 });
    this.dbPath = path.join(__dirname, '../ghl_contacts/ghl_contacts.db');
    this.db = new Database(this.dbPath);

    this.oppCustomFieldsMap = new Map();
    this.loadExistingOppCustomFields();
  }

  loadExistingOppCustomFields() {
    try {
      const fields = this.db.prepare(
        'SELECT field_id, column_name FROM custom_fields_metadata WHERE object_type = ?'
      ).all('opportunity');

      for (const field of fields) {
        this.oppCustomFieldsMap.set(field.field_id, field.column_name);
      }
    } catch (error) {
      // Table might not exist
    }
  }

  getLostReasonName(lostReasonId) {
    if (!lostReasonId) return null;

    try {
      const result = this.db.prepare(
        'SELECT name FROM ghl_lost_reasons WHERE id = ?'
      ).get(lostReasonId);
      return result ? result.name : null;
    } catch (error) {
      return null;
    }
  }

  async run() {
    console.log('\n' + '='.repeat(80));
    console.log('📈 IMPORT ALL OPPORTUNITIES');
    console.log('='.repeat(80) + '\n');

    try {
      console.log('🔍 Fetching ALL opportunities from location...\n');

      let allOpportunities = [];
      let startAfter = null;
      let startAfterId = null;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await this.rateLimiter.executeWithRetry(async () => {
          const params = { limit };
          if (startAfter && startAfterId) {
            params.startAfter = startAfter;
            params.startAfterId = startAfterId;
          }
          return await this.apiClient.searchOpportunities(params);
        });

        if (response.opportunities && response.opportunities.length > 0) {
          allOpportunities.push(...response.opportunities);
          console.log(`  📦 Fetched ${response.opportunities.length} opportunities (Total: ${allOpportunities.length})`);

          // Get pagination params from meta (response from GHL API)
          if (response.meta) {
            startAfter = response.meta.startAfter;
            startAfterId = response.meta.startAfterId;
          }

          hasMore = response.opportunities.length === limit && response.meta && response.meta.nextPage;
        } else {
          hasMore = false;
        }
      }

      console.log(`\n✅ Total opportunities fetched: ${allOpportunities.length}\n`);

      // Analyze and add custom field columns
      console.log('🔍 Analyzing opportunity custom fields...\n');
      await this.analyzeAndAddOpportunityCustomFields(allOpportunities);

      // Import opportunities
      console.log('💾 Importing opportunities...\n');
      let imported = 0;
      let skipped = 0;

      for (const opp of allOpportunities) {
        try {
          const oppData = {
            id: opp.id,
            contact_id: opp.contactId || null,
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

          // Add custom field values
          if (opp.customFields && Array.isArray(opp.customFields)) {
            for (const field of opp.customFields) {
              if (!field.id || !this.oppCustomFieldsMap.has(field.id)) continue;

              const columnName = this.oppCustomFieldsMap.get(field.id);
              const value = field.fieldValueString || field.fieldValueArray || field.fieldValueNumber;
              oppData[columnName] = value ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : null;
            }
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
          skipped++;
          if (error.message.includes('FOREIGN KEY')) {
            // Skip silently - contact doesn't exist
          } else {
            console.error(`  ⚠️  Error importing opportunity ${opp.id}:`, error.message);
          }
        }
      }

      console.log(`\n📊 Import Summary:`);
      console.log(`   Total fetched: ${allOpportunities.length}`);
      console.log(`   Imported: ${imported}`);
      console.log(`   Skipped (no contact): ${skipped}\n`);

      // Update pipeline/stage names
      console.log('🔄 Updating pipeline/stage names...\n');
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

      console.log('='.repeat(80));
      console.log('✅ OPPORTUNITIES IMPORT COMPLETE!');
      console.log('='.repeat(80) + '\n');

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      console.error(error.stack);
    } finally {
      this.db.close();
    }
  }

  async analyzeAndAddOpportunityCustomFields(opportunities) {
    const newFields = new Map();

    for (const opp of opportunities) {
      if (!opp.customFields || !Array.isArray(opp.customFields)) continue;

      for (const field of opp.customFields) {
        if (!field.id || this.oppCustomFieldsMap.has(field.id)) continue;

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

    if (newFields.size === 0) {
      console.log('  ℹ️  No new opportunity custom fields\n');
      return;
    }

    console.log(`  🆕 Found ${newFields.size} new opportunity custom fields\n`);

    for (const [fieldId, fieldData] of newFields.entries()) {
      const columnName = `opp_cf_${fieldId.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const sqlType = 'TEXT'; // Default to TEXT for simplicity

      try {
        this.db.exec(`ALTER TABLE ghl_opportunities ADD COLUMN ${columnName} ${sqlType}`);
        console.log(`  ✅ Added column: ${columnName}`);

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
}

// Run
const importer = new OpportunitiesImporter();
importer.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
