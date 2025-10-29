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
 * Import only opportunities from last 2 days
 */
class RecentOpportunitiesImporter {
  constructor() {
    this.apiClient = new GHLAPIClient();
    this.rateLimiter = new GHLRateLimiter({ requestsPerSecond: 7 });
    this.dbPath = path.join(__dirname, '../ghl_contacts/ghl_contacts.db');
    this.db = new Database(this.dbPath);

    // Date filter: last 2 days
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
    this.startDate = twoDaysAgo.toISOString();

    console.log(`\n📅 Importing opportunities from: ${this.startDate}`);
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
    console.log('📈 IMPORT RECENT OPPORTUNITIES (Last 2 Days)');
    console.log('='.repeat(80) + '\n');

    try {
      console.log('🔍 Fetching recent opportunities...\n');

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
          // Filter by date (keep only recent)
          const recentOpps = response.opportunities.filter(opp => {
            const oppDate = new Date(opp.createdAt || opp.updatedAt);
            return oppDate >= new Date(this.startDate);
          });

          if (recentOpps.length === 0) {
            console.log(`  No more recent opportunities, stopping...`);
            break;
          }

          allOpportunities.push(...recentOpps);
          console.log(`  📦 Found ${recentOpps.length} recent opportunities (Total: ${allOpportunities.length})`);

          // Get pagination params
          if (response.meta) {
            startAfter = response.meta.startAfter;
            startAfterId = response.meta.startAfterId;
          }

          // If we got less than full batch of recent opps, we've likely passed the date threshold
          if (recentOpps.length < response.opportunities.length) {
            console.log(`  ✅ Reached opportunities older than ${this.startDate}, stopping`);
            break;
          }

          hasMore = response.opportunities.length === limit && response.meta && response.meta.nextPage;
        } else {
          hasMore = false;
        }
      }

      console.log(`\n✅ Total recent opportunities fetched: ${allOpportunities.length}\n`);

      if (allOpportunities.length === 0) {
        console.log('ℹ️  No recent opportunities to import\n');
        return;
      }

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
          if (!error.message.includes('FOREIGN KEY')) {
            console.error(`  ⚠️  Error importing opportunity ${opp.id}:`, error.message);
          }
        }
      }

      console.log(`\n📊 Import Summary:`);
      console.log(`   Total fetched: ${allOpportunities.length}`);
      console.log(`   Imported: ${imported}`);
      console.log(`   Skipped: ${skipped}\n`);

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
      console.log('✅ RECENT OPPORTUNITIES IMPORT COMPLETE!');
      console.log('='.repeat(80) + '\n');

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      console.error(error.stack);
    } finally {
      this.db.close();
    }
  }
}

// Run
const importer = new RecentOpportunitiesImporter();
importer.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
