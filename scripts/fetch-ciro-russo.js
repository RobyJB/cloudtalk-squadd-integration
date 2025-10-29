#!/usr/bin/env node

import GHLAPIClient from '../src/services/ghl-api-client.js';
import GHLRateLimiter from '../src/services/ghl-rate-limiter.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Fetch Ciro Russo opportunity to verify lost_reason field
 */
async function fetchCiroRusso() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 FETCHING CIRO RUSSO OPPORTUNITY');
  console.log('='.repeat(80) + '\n');

  const apiClient = new GHLAPIClient();
  const rateLimiter = new GHLRateLimiter({ requestsPerSecond: 7 });

  try {
    // Step 1: Search for contact by phone
    console.log('📞 Step 1: Searching for contact with phone +393336484056...\n');

    const contact = await rateLimiter.executeWithRetry(async () => {
      return await apiClient.searchContactByPhone('+393336484056');
    });

    if (!contact) {
      console.log('❌ Contact not found!\n');
      return;
    }

    console.log(`✅ Found contact: ${contact.firstName || ''} ${contact.lastName || ''}`);
    console.log(`   Contact ID: ${contact.id}`);
    console.log(`   Email: ${contact.email || 'N/A'}`);
    console.log(`   Phone: ${contact.phone}\n`);

    // Step 2: Fetch opportunities for this contact
    console.log('🔍 Step 2: Fetching opportunities...\n');

    const oppsResponse = await rateLimiter.executeWithRetry(async () => {
      return await apiClient.getContactOpportunities(contact.id);
    });

    if (!oppsResponse.opportunities || oppsResponse.opportunities.length === 0) {
      console.log('⚠️  No opportunities found for this contact.\n');
      return;
    }

    console.log(`✅ Found ${oppsResponse.opportunities.length} opportunity(ies)\n`);

    // Step 3: Display opportunities with focus on lost_reason
    console.log('📋 Opportunity Details:\n');
    console.log('='.repeat(80) + '\n');

    for (const opp of oppsResponse.opportunities) {
      console.log(`📄 Opportunity: ${opp.name || opp.id}`);
      console.log(`   ID: ${opp.id}`);
      console.log(`   Status: ${opp.status}`);
      console.log(`   Pipeline ID: ${opp.pipelineId || 'N/A'}`);
      console.log(`   Stage ID: ${opp.pipelineStageId || 'N/A'}`);
      console.log(`   Monetary Value: ${opp.monetaryValue || 0}`);

      // IMPORTANT: Check for lostReasonId
      if (opp.lostReasonId) {
        console.log(`   🎯 LOST REASON ID: ${opp.lostReasonId}`);
      } else {
        console.log(`   ⚠️  lostReasonId: NOT FOUND`);
      }

      // Check for lost_reason variations
      const variations = ['lost_reason', 'lostReason', 'reason', 'lossReason'];
      for (const key of variations) {
        if (opp[key]) {
          console.log(`   Found "${key}": ${opp[key]}`);
        }
      }

      // Check custom fields for lost reason
      if (opp.customFields && Array.isArray(opp.customFields)) {
        console.log(`   Custom Fields Count: ${opp.customFields.length}`);
        for (const field of opp.customFields) {
          const fieldName = (field.name || '').toLowerCase();
          if (fieldName.includes('lost') || fieldName.includes('reason') || fieldName.includes('motivo')) {
            const value = field.fieldValueString || field.fieldValueArray || field.fieldValueNumber;
            console.log(`   📌 Custom Field: ${field.name || field.id} = ${value}`);
          }
        }
      }

      console.log('\n' + '-'.repeat(80) + '\n');
    }

    // Step 4: Show FULL raw structure of first opportunity
    console.log('🔍 FULL RAW STRUCTURE OF FIRST OPPORTUNITY:\n');
    console.log(JSON.stringify(oppsResponse.opportunities[0], null, 2));
    console.log('\n' + '='.repeat(80));

    console.log('\n✅ FETCH COMPLETE\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run
fetchCiroRusso().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
