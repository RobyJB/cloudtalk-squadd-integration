/**
 * Test to verify that the "won" status was actually applied
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const OPPORTUNITY_ID = '9L5uFchEw6oO38O3F0l5'; // Roberto's opportunity

console.log('🔍 Verifying opportunity status after update...\n');

async function checkOpportunityStatus() {
  const url = `https://services.leadconnectorhq.com/opportunities/${OPPORTUNITY_ID}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (response.ok) {
    const opp = data.opportunity;
    console.log('📊 Opportunity Details:');
    console.log(`  • ID: ${opp.id}`);
    console.log(`  • Name: ${opp.name}`);
    console.log(`  • Status: ${opp.status}`);
    console.log(`  • Last Status Change: ${opp.lastStatusChangeAt}`);
    console.log(`  • Pipeline Stage: ${opp.pipelineStageId}`);

    if (opp.status === 'won') {
      console.log('\n✅ SUCCESS: Opportunity is now in "won" status!');
    } else if (opp.status === 'abandoned') {
      console.log('\n⚠️ Status is still "abandoned" - may need different approach');
    } else {
      console.log(`\n📌 Current status: ${opp.status}`);
    }

    return opp;
  } else {
    console.error('❌ Failed to get opportunity:', data);
    return null;
  }
}

// Now let's also test updating it back to "open" to prepare for another test
async function resetToOpen() {
  console.log('\n🔄 Attempting to reset opportunity to "open" status...');

  const url = `https://services.leadconnectorhq.com/opportunities/${OPPORTUNITY_ID}/status`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'open' })
  });

  const data = await response.json();

  if (response.ok) {
    console.log('✅ Successfully reset to open status');
    console.log('Response:', data);
    return true;
  } else {
    console.log('❌ Failed to reset:', data);
    return false;
  }
}

// Run the verification
(async () => {
  // Check current status
  const opportunity = await checkOpportunityStatus();

  if (opportunity) {
    // If it's won, try to reset it to open for future testing
    if (opportunity.status === 'won') {
      await resetToOpen();

      // Verify the reset worked
      console.log('\n🔍 Verifying reset...');
      await checkOpportunityStatus();
    }
  }
})();