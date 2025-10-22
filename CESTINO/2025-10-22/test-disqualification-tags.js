/**
 * Test script for disqualification tag webhook processing
 *
 * This tests various disqualification tags that should trigger opportunity status update to "lost"
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = 'http://localhost:3000/api/cloudtalk-webhooks/new-tag';

// Test different disqualification tags
const disqualificationTags = [
  'Non risponde',
  'Bambino',
  'Numero errato',
  'Segreteria'
];

async function testDisqualificationTag(tagName) {
  console.log(`\n🏷️ Testing "${tagName}" tag...`);

  const webhookPayload = {
    event_type: 'new-tag',
    tag_name: tagName,
    tag_id: `tag-${Date.now()}`,
    contact_id: 'ct-contact-456',
    external_number: '+393513416607', // Roberto's number
    contact_name: 'Roberto Bondici',
    agent_id: 'agent-789',
    agent_name: 'Test Agent',
    call_id: `test-call-${Date.now()}`,
    timestamp: new Date().toISOString(),
    location_id: process.env.GHL_LOCATION_ID
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CloudTalk-Signature': 'test-signature'
      },
      body: JSON.stringify(webhookPayload)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log(`  ✅ SUCCESS - Tag "${tagName}" processed`);

      if (data.disqualificationProcessing) {
        const proc = data.disqualificationProcessing;
        console.log(`     • Opportunities marked as LOST: ${proc.opportunities_updated || 0}`);
        console.log(`     • Total opportunities: ${proc.total_opportunities || 0}`);

        if (proc.skipped) {
          console.log(`     • ⚠️ Skipped: ${proc.reason}`);
        }
      }
    } else {
      console.log(`  ❌ FAILED - ${data.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.log(`  💥 ERROR - ${error.message}`);
  }
}

async function prepareOpportunity() {
  console.log('🔧 Preparing opportunity for test...');

  // Reset opportunity to open for testing
  const response = await fetch(`https://services.leadconnectorhq.com/opportunities/9L5uFchEw6oO38O3F0l5/status`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'open' })
  });

  if (response.ok) {
    console.log('✅ Opportunity reset to "open" status\n');
    return true;
  } else {
    console.log('❌ Failed to reset opportunity\n');
    return false;
  }
}

async function runTests() {
  console.log('🧪 =================================================================');
  console.log('🧪 Testing Disqualification Tags Webhook Processing');
  console.log('🧪 =================================================================');

  // Load environment variables
  await import('dotenv/config');

  // Test each disqualification tag
  for (const tag of disqualificationTags) {
    // Prepare opportunity for each test
    await prepareOpportunity();

    // Test the tag
    await testDisqualificationTag(tag);

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n✅ All disqualification tag tests completed!');
}

// Check if server is running first
fetch('http://localhost:3000/api/cloudtalk-webhooks/health')
  .then(res => {
    if (res.ok) {
      console.log('✅ Server is running!\n');
      return runTests();
    } else {
      throw new Error('Server health check failed');
    }
  })
  .catch(err => {
    console.error('❌ Server is not running!');
    console.error('   Please start the server with: npm run dev');
    process.exit(1);
  });