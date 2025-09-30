/**
 * Test script for GHL opportunity disqualification functionality
 *
 * This script tests:
 * 1. Finding a GHL contact by phone number (Roberto's number)
 * 2. Searching for opportunities associated with that contact
 * 3. Updating an opportunity to "lost" status with custom field
 * 4. Fallback logic if custom field fails
 * 5. Complete workflow testing
 */

import 'dotenv/config';
import { searchGHLContactByPhone } from './API Squadd/tests/search-contact-by-phone.js';
import {
  searchOpportunitiesByContact,
  updateOpportunityToLost,
  handleDisqualificationOpportunities
} from './src/services/ghl-opportunity-service.js';

// Test configuration
const TEST_CONFIG = {
  phone: '+393513416607', // Roberto's number
  tag: 'TEST - Bambino',
  correlationId: `test-${Date.now()}`
};

/**
 * Main test function for GHL opportunity update
 */
async function testGHLOpportunityUpdate() {
  console.log('🧪 =================================================================');
  console.log('🧪 Testing GHL Opportunity Disqualification');
  console.log('🧪 =================================================================\n');

  console.log('📋 Test Configuration:');
  console.log(`  • Phone: ${TEST_CONFIG.phone}`);
  console.log(`  • Tag: ${TEST_CONFIG.tag}`);
  console.log(`  • Correlation ID: ${TEST_CONFIG.correlationId}`);
  console.log(`  • Timestamp: ${new Date().toISOString()}`);
  console.log('\n');

  try {
    // ========================================
    // Step 1: Find GHL contact by phone
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 STEP 1: Finding GHL contact by phone...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const contact = await searchGHLContactByPhone(TEST_CONFIG.phone);

    if (!contact) {
      console.error('❌ Contact not found for phone:', TEST_CONFIG.phone);
      console.log('\n🔚 Test aborted: No contact to test with');
      return;
    }

    console.log(`\n✅ Contact found successfully!`);
    console.log(`  • ID: ${contact.id}`);
    console.log(`  • Name: ${contact.firstName || ''} ${contact.lastName || ''}`);
    console.log(`  • Phone: ${contact.phone}`);
    console.log(`  • Email: ${contact.email || 'N/A'}`);

    // ========================================
    // Step 2: Search opportunities for contact
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 STEP 2: Searching opportunities for contact...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  • Contact ID: ${contact.id}`);

    const opportunities = await searchOpportunitiesByContact(contact.id, TEST_CONFIG.correlationId);

    console.log(`\n✅ Found ${opportunities.length} opportunities`);

    if (opportunities.length === 0) {
      console.log('⚠️  No opportunities to test with');
      console.log('\n🔚 Test aborted: No opportunities found');
      return;
    }

    // Log all opportunities
    console.log('\n📊 All opportunities:');
    opportunities.forEach((opp, i) => {
      console.log(`  [${i + 1}/${opportunities.length}] Opportunity Details:`);
      console.log(`      • ID: ${opp.id}`);
      console.log(`      • Name: ${opp.name || 'N/A'}`);
      console.log(`      • Status: ${opp.status}`);
      console.log(`      • Pipeline Stage: ${opp.pipelineStageId || 'N/A'}`);
      console.log(`      • Created: ${opp.createdAt || 'N/A'}`);
    });

    // Filter open opportunities
    const openOpportunities = opportunities.filter(o => o.status === 'open');
    console.log(`\n📈 Open opportunities: ${openOpportunities.length}`);

    if (openOpportunities.length === 0) {
      console.log('⚠️  No open opportunities to test with');
      console.log('\n🔚 Test aborted: All opportunities are already closed');
      return;
    }

    // ========================================
    // Step 3: Try to update first OPEN opportunity
    // ========================================
    const testOpportunity = openOpportunities[0];

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 STEP 3: Updating opportunity to lost status...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  • Opportunity ID: ${testOpportunity.id}`);
    console.log(`  • Opportunity Name: ${testOpportunity.name || 'N/A'}`);
    console.log(`  • Current Status: ${testOpportunity.status}`);
    console.log(`  • New Status: lost`);
    console.log(`  • Lost Reason: ${TEST_CONFIG.tag}`);

    console.log('\n🔄 Attempting update...');
    const updateResult = await updateOpportunityToLost(
      testOpportunity.id,
      TEST_CONFIG.tag,
      TEST_CONFIG.correlationId
    );

    if (updateResult.success) {
      console.log('\n✅ UPDATE SUCCESSFUL!');
      console.log('📦 Response details:');
      console.log(JSON.stringify(updateResult, null, 2));
    } else {
      console.log('\n❌ UPDATE FAILED');
      console.log('🚨 Error details:');
      console.log(`  • Error: ${updateResult.error}`);
      console.log('📦 Full error response:');
      console.log(JSON.stringify(updateResult, null, 2));
    }

    // ========================================
    // Step 4: Test complete workflow
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 STEP 4: Testing complete disqualification workflow...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('This will handle all open opportunities for the contact');

    const workflowCorrelationId = `workflow-${Date.now()}`;
    console.log(`  • Workflow Correlation ID: ${workflowCorrelationId}`);

    console.log('\n🔄 Starting workflow...');
    const workflowResult = await handleDisqualificationOpportunities(
      TEST_CONFIG.phone,
      TEST_CONFIG.tag,
      workflowCorrelationId
    );

    console.log('\n📊 WORKFLOW RESULT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (workflowResult.success) {
      console.log('✅ Workflow completed successfully');

      if (workflowResult.skipped) {
        console.log(`⚠️  Workflow was skipped: ${workflowResult.reason}`);
      } else {
        console.log(`  • Contact ID: ${workflowResult.contact_id}`);
        console.log(`  • Opportunities updated: ${workflowResult.opportunities_updated}`);
        console.log(`  • Opportunities failed: ${workflowResult.opportunities_failed}`);
        console.log(`  • Total opportunities: ${workflowResult.total_opportunities}`);
        console.log(`  • Duration: ${workflowResult.duration_ms}ms`);

        if (workflowResult.details && workflowResult.details.length > 0) {
          console.log('\n📋 Update details:');
          workflowResult.details.forEach((detail, i) => {
            console.log(`  [${i + 1}] ${detail.opportunity_name || detail.opportunity_id}`);
            console.log(`      • Success: ${detail.success ? '✅' : '❌'}`);
            if (!detail.success) {
              console.log(`      • Error: ${detail.error}`);
            }
          });
        }
      }
    } else {
      console.log('❌ Workflow failed');
      console.log(`  • Error: ${workflowResult.error}`);
      console.log(`  • Duration: ${workflowResult.duration_ms}ms`);
    }

    console.log('\n📦 Full workflow response:');
    console.log(JSON.stringify(workflowResult, null, 2));

  } catch (error) {
    console.error('\n💥 Test failed with unexpected error:');
    console.error('  • Message:', error.message);
    console.error('  • Stack trace:');
    console.error(error.stack);
  }

  console.log('\n🧪 =================================================================');
  console.log('🧪 Test completed');
  console.log('🧪 =================================================================');
}

// ========================================
// Run the test
// ========================================
console.log('🚀 Starting GHL Opportunity Disqualification Test\n');
console.log('Environment check:');
console.log(`  • GHL_API_KEY: ${process.env.GHL_API_KEY ? '✅ Present' : '❌ Missing'}`);
console.log(`  • GHL_LOCATION_ID: ${process.env.GHL_LOCATION_ID ? '✅ Present' : '❌ Missing'}`);
console.log('\n');

if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID) {
  console.error('❌ Missing required environment variables!');
  console.error('Please ensure both GHL_API_KEY and GHL_LOCATION_ID are set in your .env file');
  process.exit(1);
}

testGHLOpportunityUpdate()
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error during test execution:', error);
    process.exit(1);
  });