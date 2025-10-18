/**
 * Prepare test opportunity for "Già cliente" webhook test
 *
 * This script:
 * 1. Finds Roberto's contact in GHL
 * 2. Finds or creates an opportunity for him
 * 3. Sets the opportunity to "open" status for testing
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const TEST_PHONE = '+393513416607'; // Roberto's number

console.log('🔧 Preparing test opportunity for "Già cliente" webhook test\n');

async function findContact() {
  console.log(`🔍 Finding contact with phone: ${TEST_PHONE}`);

  const response = await fetch('https://services.leadconnectorhq.com/contacts/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      locationId: GHL_LOCATION_ID,
      query: TEST_PHONE,
      pageLimit: 10
    })
  });

  const data = await response.json();

  if (data.contacts && data.contacts.length > 0) {
    const contact = data.contacts[0];
    console.log(`✅ Contact found: ${contact.firstName} ${contact.lastName} (${contact.id})\n`);
    return contact;
  }

  console.log('❌ No contact found');
  return null;
}

async function findOpportunities(contactId) {
  console.log(`🔍 Finding opportunities for contact: ${contactId}`);

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

  console.log(`✅ Found ${opportunities.length} opportunities\n`);
  return opportunities;
}

async function setOpportunityToOpen(opportunityId) {
  console.log(`🔄 Setting opportunity ${opportunityId} to "open" status...`);

  const url = `https://services.leadconnectorhq.com/opportunities/${opportunityId}/status`;

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
    console.log('✅ Opportunity set to "open" status successfully\n');
    return true;
  } else {
    console.log('❌ Failed to update opportunity:', data);
    return false;
  }
}

async function createOpportunity(contactId, contactName) {
  console.log(`📝 Creating new opportunity for ${contactName}...`);

  const response = await fetch('https://services.leadconnectorhq.com/opportunities/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      locationId: GHL_LOCATION_ID,
      contactId: contactId,
      name: `Test Opportunity - ${contactName}`,
      status: 'open',
      pipelineId: 'laHBUDaV3zAqvT0wN6RD', // Your pipeline ID from the previous test
      pipelineStageId: '5b39835e-757b-4f22-8a16-84aa6e07e061' // Your stage ID
    })
  });

  const data = await response.json();

  if (response.ok) {
    console.log(`✅ New opportunity created: ${data.opportunity?.id || data.id}\n`);
    return data.opportunity || data;
  } else {
    console.log('❌ Failed to create opportunity:', data);
    return null;
  }
}

async function prepareTestEnvironment() {
  // Step 1: Find contact
  const contact = await findContact();
  if (!contact) {
    console.log('❌ Cannot proceed without contact');
    return false;
  }

  // Step 2: Find opportunities
  let opportunities = await findOpportunities(contact.id);

  // Step 3: Ensure we have at least one opportunity
  if (opportunities.length === 0) {
    console.log('⚠️ No opportunities found, creating one...');
    const newOpp = await createOpportunity(contact.id, `${contact.firstName} ${contact.lastName}`);
    if (newOpp) {
      opportunities = [newOpp];
    } else {
      console.log('❌ Failed to create opportunity');
      return false;
    }
  }

  // Step 4: Set first opportunity to "open" status
  const testOpportunity = opportunities[0];
  console.log(`📊 Using opportunity: ${testOpportunity.name || 'Unnamed'} (${testOpportunity.id})`);
  console.log(`   Current status: ${testOpportunity.status}`);

  if (testOpportunity.status !== 'open') {
    await setOpportunityToOpen(testOpportunity.id);
  } else {
    console.log('✅ Opportunity is already in "open" status\n');
  }

  // Verify final status
  console.log('🔍 Verifying final status...');
  const updatedOpps = await findOpportunities(contact.id);
  const updatedOpp = updatedOpps.find(o => o.id === testOpportunity.id);

  if (updatedOpp) {
    console.log(`📊 Final opportunity status: ${updatedOpp.status}`);

    if (updatedOpp.status === 'open') {
      console.log('\n✅ TEST ENVIRONMENT READY!');
      console.log('   You can now run: node test-gia-cliente-webhook.js');
      console.log(`   Opportunity ID: ${updatedOpp.id}`);
      console.log(`   Contact: ${contact.firstName} ${contact.lastName}`);
      console.log(`   Phone: ${TEST_PHONE}`);
      return true;
    } else {
      console.log('\n⚠️ Warning: Opportunity is not in "open" status');
      return false;
    }
  }

  return false;
}

// Run the preparation
prepareTestEnvironment()
  .then(success => {
    if (success) {
      console.log('\n🎯 Ready for testing!');
      process.exit(0);
    } else {
      console.log('\n❌ Preparation failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });