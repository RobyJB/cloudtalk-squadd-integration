/**
 * Test script for debugging GHL opportunity "won" status update
 *
 * This script will test multiple approaches to update opportunity status to "won":
 * 1. Test with current implementation (PUT to /status endpoint)
 * 2. Test with base endpoint (PUT to /opportunities/{id})
 * 3. Test with PATCH method
 * 4. Test different request body formats
 */

import 'dotenv/config';
import fetch from 'node-fetch';

// Configuration
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const TEST_PHONE = '+393513416607'; // Roberto's number

console.log('🧪 =================================================================');
console.log('🧪 GHL Opportunity "WON" Status Debug Test');
console.log('🧪 =================================================================\n');

console.log('📋 Environment check:');
console.log(`  • GHL_API_KEY: ${GHL_API_KEY ? '✅ Present' : '❌ Missing'}`);
console.log(`  • GHL_LOCATION_ID: ${GHL_LOCATION_ID ? '✅ Present' : '❌ Missing'}`);
console.log('\n');

if (!GHL_API_KEY || !GHL_LOCATION_ID) {
  console.error('❌ Missing required environment variables!');
  process.exit(1);
}

/**
 * Step 1: Find contact by phone
 */
async function findContactByPhone(phone) {
  console.log(`\n🔍 Searching for contact with phone: ${phone}`);

  const response = await fetch('https://services.leadconnectorhq.com/contacts/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      locationId: GHL_LOCATION_ID,
      query: phone,
      pageLimit: 10
    })
  });

  const data = await response.json();

  if (data.contacts && data.contacts.length > 0) {
    const contact = data.contacts[0];
    console.log(`✅ Contact found: ${contact.firstName} ${contact.lastName} (${contact.id})`);
    return contact;
  }

  console.log('❌ No contact found');
  return null;
}

/**
 * Step 2: Find opportunities for contact
 */
async function findOpportunities(contactId) {
  console.log(`\n🔍 Searching for opportunities for contact: ${contactId}`);

  const url = new URL('https://services.leadconnectorhq.com/opportunities/search');
  url.searchParams.append('contact_id', contactId);
  url.searchParams.append('location_id', GHL_LOCATION_ID);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  const opportunities = data.opportunities || [];

  console.log(`✅ Found ${opportunities.length} opportunities`);

  if (opportunities.length > 0) {
    console.log('\n📊 Opportunities list:');
    opportunities.forEach((opp, i) => {
      console.log(`  ${i + 1}. ${opp.name || 'Unnamed'} (${opp.id})`);
      console.log(`     Status: ${opp.status} | Stage: ${opp.pipelineStageId || 'N/A'}`);
    });
  }

  return opportunities;
}

/**
 * Test Method 1: Current implementation (PUT to /status endpoint)
 */
async function testMethod1_StatusEndpoint(opportunityId) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Method 1: PUT to /opportunities/{id}/status');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const url = `https://services.leadconnectorhq.com/opportunities/${opportunityId}/status`;
  const body = { status: 'won' };

  console.log(`URL: ${url}`);
  console.log(`Body: ${JSON.stringify(body)}`);

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    console.log(`Response Status: ${response.status}`);
    console.log(`Response Headers:`, Object.fromEntries(response.headers.entries()));
    console.log(`Response Body:`, JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('✅ Method 1 SUCCEEDED!');
      return { success: true, data };
    } else {
      console.log('❌ Method 1 FAILED');
      return { success: false, error: data };
    }
  } catch (error) {
    console.log(`❌ Method 1 ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test Method 2: Base endpoint (PUT to /opportunities/{id})
 */
async function testMethod2_BaseEndpoint(opportunityId) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Method 2: PUT to /opportunities/{id} with status field');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const url = `https://services.leadconnectorhq.com/opportunities/${opportunityId}`;
  const body = { status: 'won' };

  console.log(`URL: ${url}`);
  console.log(`Body: ${JSON.stringify(body)}`);

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    console.log(`Response Status: ${response.status}`);
    console.log(`Response Body:`, JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('✅ Method 2 SUCCEEDED!');
      return { success: true, data };
    } else {
      console.log('❌ Method 2 FAILED');
      return { success: false, error: data };
    }
  } catch (error) {
    console.log(`❌ Method 2 ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test Method 3: PATCH to /status endpoint
 */
async function testMethod3_PatchStatus(opportunityId) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Method 3: PATCH to /opportunities/{id}/status');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const url = `https://services.leadconnectorhq.com/opportunities/${opportunityId}/status`;
  const body = { status: 'won' };

  console.log(`URL: ${url}`);
  console.log(`Body: ${JSON.stringify(body)}`);

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    console.log(`Response Status: ${response.status}`);
    console.log(`Response Body:`, JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('✅ Method 3 SUCCEEDED!');
      return { success: true, data };
    } else {
      console.log('❌ Method 3 FAILED');
      return { success: false, error: data };
    }
  } catch (error) {
    console.log(`❌ Method 3 ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test Method 4: Different body format
 */
async function testMethod4_DifferentBody(opportunityId) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Method 4: PUT with different body formats');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Try different body formats
  const bodyFormats = [
    { status: 'Won' }, // Capital W
    { status: 'WON' }, // All caps
    { opportunity_status: 'won' }, // Different field name
    { opportunityStatus: 'won' }, // Camel case field
  ];

  for (const body of bodyFormats) {
    console.log(`\n📦 Testing body format: ${JSON.stringify(body)}`);

    const url = `https://services.leadconnectorhq.com/opportunities/${opportunityId}/status`;

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`  ✅ SUCCESS with format: ${JSON.stringify(body)}`);
        console.log(`  Response:`, JSON.stringify(data, null, 2));
        return { success: true, data, workingFormat: body };
      } else {
        console.log(`  ❌ Failed: ${response.status} - ${data.message || JSON.stringify(data)}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  return { success: false, error: 'All body formats failed' };
}

/**
 * Test Method 5: Check if opportunity needs to be in a specific stage first
 */
async function testMethod5_CheckStageRequirement(opportunityId) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Method 5: Get opportunity details to check requirements');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const url = `https://services.leadconnectorhq.com/opportunities/${opportunityId}`;

  console.log(`Getting opportunity details from: ${url}`);

  try {
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
      console.log('✅ Opportunity details retrieved:');
      console.log(`  • ID: ${data.opportunity?.id || data.id}`);
      console.log(`  • Name: ${data.opportunity?.name || data.name}`);
      console.log(`  • Status: ${data.opportunity?.status || data.status}`);
      console.log(`  • Pipeline ID: ${data.opportunity?.pipelineId || data.pipelineId}`);
      console.log(`  • Pipeline Stage: ${data.opportunity?.pipelineStageId || data.pipelineStageId}`);
      console.log(`  • Assigned To: ${data.opportunity?.assignedTo || data.assignedTo}`);

      console.log('\n📦 Full opportunity object:');
      console.log(JSON.stringify(data, null, 2));

      return { success: true, data };
    } else {
      console.log('❌ Failed to get opportunity details');
      console.log(JSON.stringify(data, null, 2));
      return { success: false, error: data };
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main test function
 */
async function runTests() {
  try {
    // Step 1: Find contact
    const contact = await findContactByPhone(TEST_PHONE);
    if (!contact) {
      console.log('\n❌ Cannot proceed without a contact');
      return;
    }

    // Step 2: Find opportunities
    const opportunities = await findOpportunities(contact.id);
    if (opportunities.length === 0) {
      console.log('\n❌ No opportunities found to test with');
      return;
    }

    // Find an open opportunity to test with
    let testOpportunity = opportunities.find(o => o.status === 'open');

    if (!testOpportunity) {
      console.log('\n⚠️ No open opportunities found, using first opportunity');
      testOpportunity = opportunities[0];
    }

    console.log(`\n🎯 Testing with opportunity: ${testOpportunity.name || 'Unnamed'} (${testOpportunity.id})`);
    console.log(`   Current status: ${testOpportunity.status}`);

    // Run all test methods
    const results = [];

    // First get details to understand the structure
    console.log('\n' + '='.repeat(65));
    const detailsResult = await testMethod5_CheckStageRequirement(testOpportunity.id);
    results.push({ method: 'Get Details', ...detailsResult });

    // Then test all update methods
    console.log('\n' + '='.repeat(65));
    const method1Result = await testMethod1_StatusEndpoint(testOpportunity.id);
    results.push({ method: 'PUT /status', ...method1Result });

    if (!method1Result.success) {
      console.log('\n' + '='.repeat(65));
      const method2Result = await testMethod2_BaseEndpoint(testOpportunity.id);
      results.push({ method: 'PUT /opportunities', ...method2Result });

      if (!method2Result.success) {
        console.log('\n' + '='.repeat(65));
        const method3Result = await testMethod3_PatchStatus(testOpportunity.id);
        results.push({ method: 'PATCH /status', ...method3Result });

        if (!method3Result.success) {
          console.log('\n' + '='.repeat(65));
          const method4Result = await testMethod4_DifferentBody(testOpportunity.id);
          results.push({ method: 'Different body formats', ...method4Result });
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(65));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(65));

    const successfulMethod = results.find(r => r.success && r.method !== 'Get Details');

    if (successfulMethod) {
      console.log('\n✅ SUCCESS! Working method found:');
      console.log(`   Method: ${successfulMethod.method}`);
      if (successfulMethod.workingFormat) {
        console.log(`   Working format: ${JSON.stringify(successfulMethod.workingFormat)}`);
      }
    } else {
      console.log('\n❌ All update methods failed');
      console.log('\nFailed methods:');
      results.filter(r => !r.success && r.method !== 'Get Details').forEach(r => {
        console.log(`   • ${r.method}: ${r.error?.message || JSON.stringify(r.error)}`);
      });
    }

  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
  }
}

// Run the tests
runTests()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });