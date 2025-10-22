/**
 * Test script for "Già cliente" tag webhook processing
 *
 * This simulates a CloudTalk webhook when the "Già cliente" tag is applied to a contact.
 * It should trigger the opportunity status update to "won" in GHL.
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = 'http://localhost:3000/api/cloudtalk-webhooks/new-tag';

// Simulate CloudTalk new-tag webhook payload
const webhookPayload = {
  event_type: 'new-tag',
  tag_name: 'Già cliente',
  tag_id: 'tag-123',
  contact_id: 'ct-contact-456',
  external_number: '+393513416607', // Roberto's number
  contact_name: 'Roberto Bondici',
  agent_id: 'agent-789',
  agent_name: 'Test Agent',
  call_id: `test-call-${Date.now()}`,
  timestamp: new Date().toISOString(),
  location_id: process.env.GHL_LOCATION_ID
};

console.log('🧪 =================================================================');
console.log('🧪 Testing "Già cliente" Tag Webhook Processing');
console.log('🧪 =================================================================\n');

console.log('📋 Webhook Payload:');
console.log(JSON.stringify(webhookPayload, null, 2));
console.log('\n');

async function testWebhook() {
  console.log(`📤 Sending webhook to: ${WEBHOOK_URL}\n`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CloudTalk-Signature': 'test-signature',
        'User-Agent': 'CloudTalk-Test/1.0'
      },
      body: JSON.stringify(webhookPayload)
    });

    const responseData = await response.json();

    console.log(`📨 Response Status: ${response.status}`);
    console.log('\n📦 Response Body:');
    console.log(JSON.stringify(responseData, null, 2));

    if (response.ok && responseData.success) {
      console.log('\n✅ SUCCESS!');

      if (responseData.customerProcessing) {
        const processing = responseData.customerProcessing;
        console.log('\n📊 Customer Processing Results:');
        console.log(`  • Success: ${processing.success}`);
        console.log(`  • Contact ID: ${processing.contact_id || 'N/A'}`);
        console.log(`  • Opportunities Updated: ${processing.opportunities_updated || 0}`);
        console.log(`  • Opportunities Failed: ${processing.opportunities_failed || 0}`);
        console.log(`  • Total Opportunities: ${processing.total_opportunities || 0}`);
        console.log(`  • Duration: ${processing.duration_ms || 0}ms`);

        if (processing.skipped) {
          console.log(`  • ⚠️ Skipped: ${processing.reason}`);
        }

        if (processing.details && processing.details.length > 0) {
          console.log('\n  📋 Opportunity Update Details:');
          processing.details.forEach((detail, i) => {
            console.log(`    ${i + 1}. ${detail.opportunity_name || detail.opportunity_id}`);
            console.log(`       Status: ${detail.success ? '✅ Updated to WON' : '❌ Failed'}`);
            if (!detail.success && detail.error) {
              console.log(`       Error: ${detail.error}`);
            }
          });
        }
      }
    } else {
      console.log('\n❌ FAILED!');
      console.log(`  Error: ${responseData.error || 'Unknown error'}`);
    }

  } catch (error) {
    console.error('\n💥 Request failed:', error.message);
  }
}

// Check if server is running
console.log('🔍 Checking if server is running...');
fetch('http://localhost:3000/api/cloudtalk-webhooks/health')
  .then(res => {
    if (res.ok) {
      console.log('✅ Server is running!\n');
      return testWebhook();
    } else {
      throw new Error('Server health check failed');
    }
  })
  .catch(err => {
    console.error('❌ Server is not running!');
    console.error('   Please start the server with: npm run dev');
    console.error('   Error:', err.message);
    process.exit(1);
  });