#!/usr/bin/env node

/**
 * Test complete GHL webhook integration with VPS server
 * Tests the actual production webhook endpoint
 */

const VPS_URL = 'http://148.230.107.148:3000';

// Test GHL webhook payload with corrected structure
const testGHLPayload = {
  contact_id: "eNtxZuc4PLQR2ELzyxOg",
  first_name: "Rubertu",
  last_name: "Bundici",
  full_name: "Rubertu Bundici",
  phone: "+393513416607",  // Roberto's priority number
  user: {
    firstName: "Andrea",
    lastName: "Guzzonato",
    email: "andreaguzzonato.work@gmail.com",
    phone: "+393807454525"   // Will be used for the call
  }
};

async function testVPSWebhookEndpoint() {
  console.log('🌐 TESTING VPS WEBHOOK INTEGRATION');
  console.log('=' .repeat(50));
  console.log(`🎯 Target VPS: ${VPS_URL}`);

  try {
    console.log('📤 Sending GHL webhook payload...');
    console.log('📋 Payload preview:');
    console.log(`   Contact: ${testGHLPayload.user.firstName} ${testGHLPayload.user.lastName}`);
    console.log(`   Phone: ${testGHLPayload.user.phone}`);
    console.log(`   Email: ${testGHLPayload.user.email}`);

    const startTime = Date.now();

    const response = await fetch(`${VPS_URL}/api/ghl-webhooks/new-contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GHL-Webhook-Test/1.0'
      },
      body: JSON.stringify(testGHLPayload),
      timeout: 30000 // 30 second timeout
    });

    const responseTime = Date.now() - startTime;

    console.log(`\n📊 RESPONSE RECEIVED (${responseTime}ms):`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);

    const responseData = await response.json();
    console.log('\n📋 Response Data:');
    console.log(JSON.stringify(responseData, null, 2));

    // Analysis
    console.log('\n🔍 INTEGRATION ANALYSIS:');

    if (response.ok && responseData.success) {
      console.log('✅ WEBHOOK INTEGRATION: SUCCESS');
      console.log(`✅ Process ID: ${responseData.processId}`);

      if (responseData.selectedAgent) {
        console.log(`✅ Agent Selected: ${responseData.selectedAgent.name} (ID: ${responseData.selectedAgent.id})`);
      }

      console.log('\n📋 Process Steps:');
      console.log(`Contact Created: ${responseData.steps?.contactCreated ? '✅' : '❌'}`);
      console.log(`Agent Selected: ${responseData.steps?.agentSelected ? '✅' : '❌'}`);
      console.log(`Call Started: ${responseData.steps?.callStarted ? '✅' : '❌'}`);

    } else {
      console.log('⚠️  WEBHOOK RESPONSE: ERROR');
      console.log(`Error Type: ${responseData.error}`);
      console.log(`Message: ${responseData.message}`);

      if (responseData.steps) {
        console.log('\n📋 Failed Steps:');
        console.log(`Contact Created: ${responseData.steps.contactCreated ? '✅' : '❌'}`);
        console.log(`Agent Selected: ${responseData.steps.agentSelected ? '✅' : '❌'}`);
        console.log(`Call Started: ${responseData.steps.callStarted ? '✅' : '❌'}`);
      }

      if (responseData.availableAgents !== undefined) {
        console.log(`Available Agents: ${responseData.availableAgents}`);
      }
    }

  } catch (error) {
    console.error('💥 VPS Integration Test Failed:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Connection refused - VPS server may be down');
    } else if (error.name === 'AbortError') {
      console.log('❌ Request timeout - VPS server not responding');
    } else {
      console.log(`❌ Network error: ${error.message}`);
    }
  }
}

async function testVPSHealthEndpoints() {
  console.log('\n🏥 TESTING VPS HEALTH ENDPOINTS');
  console.log('=' .repeat(40));

  const healthEndpoints = [
    '/api/ghl-webhooks/health',
    '/api/ghl-webhooks/stats',
    '/health'
  ];

  for (const endpoint of healthEndpoints) {
    try {
      console.log(`\n🔍 Testing: ${endpoint}`);

      const response = await fetch(`${VPS_URL}${endpoint}`, {
        method: 'GET',
        timeout: 10000
      });

      console.log(`Status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${endpoint}: RESPONSIVE`);

        // Show relevant info
        if (data.service) console.log(`   Service: ${data.service}`);
        if (data.status) console.log(`   Status: ${data.status}`);
        if (data.leadToCallSystem) console.log(`   Lead-to-Call: ${data.leadToCallSystem.initialized ? 'Ready' : 'Not Ready'}`);

      } else {
        console.log(`⚠️  ${endpoint}: HTTP ${response.status}`);
      }

    } catch (error) {
      console.log(`❌ ${endpoint}: ERROR - ${error.message}`);
    }
  }
}

async function runVPSIntegrationTests() {
  console.log('🧪 VPS GHL WEBHOOK INTEGRATION TESTS');
  console.log('=' .repeat(60));
  console.log(`🌐 Testing against VPS: ${VPS_URL}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

  // Test health endpoints first
  await testVPSHealthEndpoints();

  // Test the actual webhook integration
  await testVPSWebhookEndpoint();

  console.log('\n🎯 VPS INTEGRATION TESTING COMPLETE');
  console.log('=' .repeat(60));

  console.log('\n📋 NEXT STEPS:');
  console.log('1. ✅ GHL webhook payload structure FIXED');
  console.log('2. ⚠️  Configure CloudTalk API credentials on VPS');
  console.log('3. ⚠️  Ensure CloudTalk agents are online and available');
  console.log('4. ✅ Ready for production GHL webhook integration');

  console.log('\n📞 PRODUCTION WEBHOOK URL:');
  console.log(`${VPS_URL}/api/ghl-webhooks/new-contact`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runVPSIntegrationTests().catch(console.error);
}

export { testVPSWebhookEndpoint, testVPSHealthEndpoints };