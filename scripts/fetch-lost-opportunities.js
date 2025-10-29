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
 * Fetch lost opportunities directly from API
 */
class LostOpportunitiesFetcher {
  constructor() {
    this.apiClient = new GHLAPIClient();
    this.rateLimiter = new GHLRateLimiter({ requestsPerSecond: 7 });
    this.dbPath = path.join(__dirname, '../ghl_contacts/ghl_contacts.db');
    this.db = new Database(this.dbPath);
  }

  async run(limit = 100) {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 FETCHING LOST OPPORTUNITIES');
    console.log('='.repeat(80) + '\n');

    try {
      console.log(`📊 Fetching up to ${limit} lost opportunities...\n`);

      // Fetch lost opportunities directly
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.apiClient.searchOpportunities({
          status: 'lost',
          limit: limit
        });
      });

      if (!response.opportunities || response.opportunities.length === 0) {
        console.log('⚠️  No lost opportunities found.\n');
        return;
      }

      console.log(`✅ Fetched ${response.opportunities.length} lost opportunities\n`);

      // Log the FULL structure of first opportunity
      console.log('🔍 First lost opportunity FULL structure:\n');
      console.log(JSON.stringify(response.opportunities[0], null, 2));
      console.log('\n' + '='.repeat(80) + '\n');

      // Analyze all opportunities for lost_reason field
      console.log('📋 Analyzing opportunities for lost_reason field...\n');

      let foundLostReason = 0;
      const lostReasons = new Set();

      for (const opp of response.opportunities) {
        // Check if lost_reason exists as a direct field
        if (opp.lost_reason || opp.lostReason || opp.reason || opp.lossReason) {
          foundLostReason++;
          const reason = opp.lost_reason || opp.lostReason || opp.reason || opp.lossReason;
          lostReasons.add(reason);
          console.log(`  ✅ Found lost_reason: "${reason}" (opp: ${opp.name || opp.id})`);
        }

        // Check in custom fields
        if (opp.customFields && Array.isArray(opp.customFields)) {
          for (const field of opp.customFields) {
            const fieldName = (field.name || '').toLowerCase();
            const fieldId = field.id;

            if (fieldName.includes('lost') || fieldName.includes('reason') || fieldName.includes('motivo')) {
              console.log(`  🔎 Custom field with 'lost/reason': ${field.name || fieldId} = ${field.fieldValueString || JSON.stringify(field.fieldValueArray)}`);
            }
          }
        }
      }

      console.log(`\n📊 Summary:`);
      console.log(`   Total lost opportunities: ${response.opportunities.length}`);
      console.log(`   Opportunities with lost_reason field: ${foundLostReason}`);
      console.log(`   Unique lost reasons: ${lostReasons.size}`);

      if (lostReasons.size > 0) {
        console.log(`\n📋 All lost reasons found:`);
        for (const reason of lostReasons) {
          console.log(`   - ${reason}`);
        }
      }

      // Save raw data to file for manual inspection
      const fs = await import('fs');
      const outputPath = path.join(__dirname, 'lost-opportunities-raw.json');
      fs.writeFileSync(outputPath, JSON.stringify(response.opportunities, null, 2));
      console.log(`\n💾 Full data saved to: ${outputPath}\n`);

      console.log('='.repeat(80));
      console.log('✅ ANALYSIS COMPLETE');
      console.log('='.repeat(80) + '\n');

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      console.error(error.stack);
    } finally {
      this.db.close();
    }
  }
}

// Main execution
const limit = parseInt(process.argv[2]) || 100;
const fetcher = new LostOpportunitiesFetcher();
fetcher.run(limit).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
