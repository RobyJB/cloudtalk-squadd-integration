/**
 * Google Sheets Integration Test Script
 * Tests the complete CloudTalk → Google Sheets integration with queue management
 *
 * Usage:
 *   node test-google-sheets-integration.js
 *
 * Requirements:
 *   - Server running on localhost:3000
 *   - GOOGLE_SHEETS_APPS_SCRIPT_URL configured in .env
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';
const DELAY_BETWEEN_TESTS = 2000; // 2 seconds

/**
 * Test configuration
 */
const TEST_CONFIG = {
  // Roberto's priority number for testing
  testPhoneNumber: '+393513416607',
  testAgentId: 493933,
  testInternalNumber: '393520441984'
};

/**
 * Utility function to make HTTP requests
 */
async function makeRequest(url, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.text();

    return {
      status: response.status,
      ok: response.ok,
      data: data ? JSON.parse(data) : null
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test 1: Health Check
 */
async function testHealthCheck() {
  console.log('\n🏥 Test 1: Health Check');
  console.log('=' .repeat(50));

  const result = await makeRequest(`${BASE_URL}/api/google-sheets-webhooks/health`);

  if (result.ok) {
    console.log('✅ Health check passed');
    console.log(`📊 Status: ${result.data.status}`);
    console.log(`📋 Queue Size: ${result.data.stats.queued_currently || 0}`);
    console.log(`🔧 Google Sheets Configured: ${result.data.configuration.google_sheets_url_configured}`);

    if (!result.data.configuration.google_sheets_url_configured) {
      console.log('⚠️  WARNING: GOOGLE_SHEETS_APPS_SCRIPT_URL not configured');
      console.log('   Set this environment variable to enable actual Google Sheets integration');
    }
  } else {
    console.log('❌ Health check failed');
    console.log(`Error: ${result.error || result.data?.error}`);
    return false;
  }

  return true;
}

/**
 * Test 2: Queue Statistics
 */
async function testQueueStats() {
  console.log('\n📊 Test 2: Queue Statistics');
  console.log('=' .repeat(50));

  const result = await makeRequest(`${BASE_URL}/api/google-sheets-webhooks/queue-stats`);

  if (result.ok) {
    console.log('✅ Queue stats retrieved');
    console.log(`📋 Current Queue Size: ${result.data.queue.current_size}`);
    console.log(`🔄 Active Requests: ${result.data.queue.active_requests}/${result.data.queue.max_concurrent}`);
    console.log(`📈 Total Processed: ${result.data.performance.total_processed}`);
    console.log(`❌ Total Failed: ${result.data.performance.total_failed}`);
    console.log(`🎯 Success Rate: ${result.data.performance.success_rate.toFixed(2)}%`);
    console.log(`⏱️  Avg Processing Time: ${result.data.performance.average_processing_time_ms}ms`);
  } else {
    console.log('❌ Queue stats failed');
    console.log(`Error: ${result.error || result.data?.error}`);
    return false;
  }

  return true;
}

/**
 * Test 3: Simple Queue Test
 */
async function testSimpleQueue() {
  console.log('\n🧪 Test 3: Simple Queue Test');
  console.log('=' .repeat(50));

  const result = await makeRequest(`${BASE_URL}/api/google-sheets-webhooks/test`, 'POST');

  if (result.ok) {
    console.log('✅ Queue test successful');
    console.log(`📋 Started Queue ID: ${result.data.queue_ids.started}`);
    console.log(`📋 Ended Queue ID: ${result.data.queue_ids.ended}`);
    console.log(`📊 Queue Size After: ${result.data.queue_status.current_size}`);
    console.log('💡 Check Google Sheets for new test rows');
  } else {
    console.log('❌ Queue test failed');
    console.log(`Error: ${result.error || result.data?.error}`);
    return false;
  }

  return true;
}

/**
 * Test 4: CloudTalk Call Started Webhook
 */
async function testCallStartedWebhook() {
  console.log('\n📞 Test 4: CloudTalk Call Started Webhook');
  console.log('=' .repeat(50));

  const callUuid = `test-integration-${Date.now()}`;
  const callStartedData = {
    call_uuid: callUuid,
    external_number: TEST_CONFIG.testPhoneNumber,
    contact_name: 'Roberto Bondici (Integration Test)',
    agent_first_name: 'Roberto',
    agent_last_name: 'Bondici',
    agent_id: TEST_CONFIG.testAgentId,
    internal_number: TEST_CONFIG.testInternalNumber
  };

  console.log(`📋 Call UUID: ${callUuid}`);
  console.log(`📞 External Number: ${TEST_CONFIG.testPhoneNumber}`);

  const result = await makeRequest(`${BASE_URL}/api/cloudtalk-webhooks/call-started`, 'POST', callStartedData);

  if (result.ok) {
    console.log('✅ Call started webhook processed');
    console.log(`📊 Google Sheets Tracking: ${result.data.googleSheetsTracking.success ? '✅' : '❌'}`);
    console.log(`🔗 GHL Integration: ${result.data.ghlIntegration.success ? '✅' : '❌'}`);

    if (result.data.googleSheetsTracking.queueId) {
      console.log(`📋 Queue ID: ${result.data.googleSheetsTracking.queueId}`);
    }

    // Return call UUID for call-ended test
    return callUuid;
  } else {
    console.log('❌ Call started webhook failed');
    console.log(`Error: ${result.error || result.data?.error}`);
    return false;
  }
}

/**
 * Test 5: CloudTalk Call Ended Webhook
 */
async function testCallEndedWebhook(callUuid) {
  console.log('\n📞 Test 5: CloudTalk Call Ended Webhook');
  console.log('=' .repeat(50));

  if (!callUuid) {
    console.log('⚠️  Skipping call-ended test (no call UUID from call-started)');
    return false;
  }

  const callEndedData = {
    call_uuid: callUuid,
    call_id: Date.now(),
    external_number: TEST_CONFIG.testPhoneNumber,
    contact_name: 'Roberto Bondici (Integration Test)',
    agent_first_name: 'Roberto',
    agent_last_name: 'Bondici',
    agent_id: TEST_CONFIG.testAgentId,
    internal_number: TEST_CONFIG.testInternalNumber,
    talking_time: 67,
    waiting_time: 8
  };

  console.log(`📋 Call UUID: ${callUuid}`);
  console.log(`⏱️  Talking Time: ${callEndedData.talking_time}s`);
  console.log(`⏱️  Waiting Time: ${callEndedData.waiting_time}s`);

  const result = await makeRequest(`${BASE_URL}/api/cloudtalk-webhooks/call-ended`, 'POST', callEndedData);

  if (result.ok) {
    console.log('✅ Call ended webhook processed');
    console.log(`📊 Google Sheets Tracking: ${result.data.googleSheetsTracking.success ? '✅' : '❌'}`);
    console.log(`🎯 Campaign Automation: ${result.data.campaignAutomation.success ? '✅' : '❌'}`);
    console.log(`🔗 GHL Integration: ${result.data.ghlIntegration.success ? '✅' : '❌'}`);

    if (result.data.googleSheetsTracking.queueId) {
      console.log(`📋 Queue ID: ${result.data.googleSheetsTracking.queueId}`);
    }
  } else {
    console.log('❌ Call ended webhook failed');
    console.log(`Error: ${result.error || result.data?.error}`);
    return false;
  }

  return true;
}

/**
 * Test 6: Final Queue Check
 */
async function testFinalQueueCheck() {
  console.log('\n📊 Test 6: Final Queue Check');
  console.log('=' .repeat(50));

  // Wait a bit for processing
  console.log('⏳ Waiting 3 seconds for queue processing...');
  await sleep(3000);

  const result = await makeRequest(`${BASE_URL}/api/google-sheets-webhooks/queue-stats`);

  if (result.ok) {
    console.log('✅ Final queue check complete');
    console.log(`📋 Final Queue Size: ${result.data.queue.current_size}`);
    console.log(`🔄 Active Requests: ${result.data.queue.active_requests}`);
    console.log(`📈 Total Processed: ${result.data.performance.total_processed}`);
    console.log(`❌ Total Failed: ${result.data.performance.total_failed}`);

    if (result.data.queue.current_size === 0 && result.data.queue.active_requests === 0) {
      console.log('🎉 All queue items processed successfully!');
    } else {
      console.log('⚠️  Some items still in queue or processing...');
    }
  } else {
    console.log('❌ Final queue check failed');
    console.log(`Error: ${result.error || result.data?.error}`);
    return false;
  }

  return true;
}

/**
 * Main test runner
 */
async function runIntegrationTests() {
  console.log('🚀 Google Sheets Integration Test Suite');
  console.log('=' .repeat(60));
  console.log(`📅 Started: ${new Date().toISOString()}`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📞 Test Phone: ${TEST_CONFIG.testPhoneNumber}`);

  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Queue Statistics', fn: testQueueStats },
    { name: 'Simple Queue Test', fn: testSimpleQueue },
    { name: 'Call Started Webhook', fn: testCallStartedWebhook },
    { name: 'Call Ended Webhook', fn: testCallEndedWebhook },
    { name: 'Final Queue Check', fn: testFinalQueueCheck }
  ];

  const results = [];
  let callUuid = null;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];

    try {
      let result;
      if (test.name === 'Call Ended Webhook') {
        result = await test.fn(callUuid);
      } else {
        result = await test.fn();
      }

      // Store call UUID from call-started test
      if (test.name === 'Call Started Webhook' && result) {
        callUuid = result;
        result = true; // Normalize result
      }

      results.push({
        name: test.name,
        success: result,
        timestamp: new Date().toISOString()
      });

      if (result) {
        console.log(`✅ ${test.name} completed successfully`);
      } else {
        console.log(`❌ ${test.name} failed`);
      }

    } catch (error) {
      console.log(`💥 ${test.name} crashed: ${error.message}`);
      results.push({
        name: test.name,
        success: false,
        error: error.message
      });
    }

    // Delay between tests
    if (i < tests.length - 1) {
      await sleep(DELAY_BETWEEN_TESTS);
    }
  }

  // Summary
  console.log('\n📋 Test Summary');
  console.log('=' .repeat(60));

  const passed = results.filter(r => r.success).length;
  const total = results.length;

  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log(`\n🎯 Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('🎉 All integration tests passed! Google Sheets integration is working correctly.');
    console.log('\n📊 Next Steps:');
    console.log('   1. Check your Google Sheets document for new test rows');
    console.log('   2. Verify call-started and call-ended data is properly linked');
    console.log('   3. Monitor queue performance under real load');
    console.log('   4. Configure CloudTalk webhooks to point to your endpoints');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.');
    console.log('\n🔧 Common Solutions:');
    console.log('   - Ensure server is running on localhost:3000');
    console.log('   - Check GOOGLE_SHEETS_APPS_SCRIPT_URL is configured');
    console.log('   - Verify Google Apps Script is deployed correctly');
    console.log('   - Check network connectivity');
  }

  console.log(`\n🕒 Test completed: ${new Date().toISOString()}`);
  return passed === total;
}

// Run the tests
runIntegrationTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});