#!/usr/bin/env node

/**
 * WEBHOOK DUPLICATION REPRODUCTION TEST
 *
 * This script reproduces the exact issues reported:
 * 1. Call-started webhook with undefined call_id creating "📞 CHIAMATA INIZIATA - CLOUDTALK" note
 * 2. Duplicate GHL webhook sending for missed calls
 *
 * Run this to see the issues in action and test fixes.
 */

import 'dotenv/config';

const WEBHOOK_BASE_URL = 'http://localhost:3000/api/cloudtalk-webhooks';

/**
 * REPRODUCTION TEST 1: Undefined call_id in call-started webhook
 */
async function reproduceUndefinedCallIdIssue() {
  console.log('\n🔴 === REPRODUCTION TEST 1: Undefined call_id ===\n');

  // This payload mimics the exact issue reported
  const problematicPayload = {
    // Note: NO call_id, NO call_uuid - this causes the issue
    "internal_number": 393520441984,
    "external_number": "393513416607", // Roberto's number
    "agent_id": 493933,
    "agent_first_name": "Roberto",
    "agent_last_name": "Bondici"
  };

  console.log('🧪 Sending call-started webhook with undefined call_id...');
  console.log('📋 Payload:', JSON.stringify(problematicPayload, null, 2));

  try {
    const response = await fetch(`${WEBHOOK_BASE_URL}/call-started`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WebhookDuplicationTest/1.0'
      },
      body: JSON.stringify(problematicPayload)
    });

    console.log(`\n📊 Response Status: ${response.status}`);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook processed successfully');
      console.log('📋 Response:', JSON.stringify(result, null, 2));

      // Check if the issue occurred
      if (result.ghlIntegration?.result?.action === 'call_start_logged_with_cuecard') {
        console.log('\n🔴 ISSUE REPRODUCED: Call-started note created with undefined call_id!');
        console.log('   Expected note: "📞 CHIAMATA INIZIATA - CLOUDTALK"');
        console.log('   Phone: 393513416607');
        console.log('   Agent: 493933');
      }

    } else {
      const errorText = await response.text();
      console.log('❌ Webhook failed:', errorText);
    }

  } catch (error) {
    console.log('❌ Network error:', error.message);
  }

  console.log('\n🔍 Analysis:');
  console.log('   - Webhook processing without call_id breaks deduplication');
  console.log('   - Creates valid GHL note but cannot prevent duplicates');
  console.log('   - Deduplication key becomes "undefined_call-started"');
}

/**
 * REPRODUCTION TEST 2: Duplicate GHL webhook sending
 */
async function reproduceDuplicateGHLWebhook() {
  console.log('\n🔴 === REPRODUCTION TEST 2: Duplicate GHL Webhooks ===\n');

  // This payload triggers MISSED call logic (talking_time = 0)
  const missedCallPayload = {
    "call_uuid": "duplicate-test-" + Date.now(),
    "call_id": "test-missed-" + Date.now(),
    "internal_number": 393520441984,
    "external_number": "393513416607",
    "agent_id": 493933,
    "agent_first_name": "Roberto",
    "agent_last_name": "Bondici",
    "talking_time": 0, // This makes it MISSED
    "waiting_time": 15,
    "# di tentativi di chiamata": null
  };

  console.log('🧪 Sending call-ended webhook (MISSED CALL)...');
  console.log('📋 Payload:', JSON.stringify(missedCallPayload, null, 2));
  console.log('\n⚠️  EXPECTED ISSUE: This will send TWO webhooks to GoHighLevel!');
  console.log('   1. From handleCallEndedWebhook() - line 167 in cloudtalk-webhooks.js');
  console.log('   2. From processCallEnded() - line 522 in webhook-to-ghl-processor.js');

  try {
    const startTime = Date.now();

    const response = await fetch(`${WEBHOOK_BASE_URL}/call-ended`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WebhookDuplicationTest/1.0'
      },
      body: JSON.stringify(missedCallPayload)
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`\n📊 Response Status: ${response.status} (${duration}ms)`);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook processed successfully');
      console.log('📋 Response:', JSON.stringify(result, null, 2));

      // Analyze the response for duplication evidence
      console.log('\n🔍 Duplication Analysis:');

      if (result.ghlWebhookForwarding?.success) {
        console.log('   ✅ GHL Webhook #1: Sent by handleCallEndedWebhook()');
      }

      if (result.ghlIntegration?.webhookSent?.success) {
        console.log('   ✅ GHL Webhook #2: Sent by processCallEnded()');
        console.log('\n🔴 DUPLICATION CONFIRMED: Two webhooks sent to same URL!');
      }

      if (result.campaignAutomation?.success) {
        console.log('   ✅ Campaign automation: Updated call attempts');
      }

    } else {
      const errorText = await response.text();
      console.log('❌ Webhook failed:', errorText);
    }

  } catch (error) {
    console.log('❌ Network error:', error.message);
  }

  console.log('\n📊 Expected GoHighLevel Impact:');
  console.log('   - Pipeline stage might move TWICE');
  console.log('   - Automation rules might trigger TWICE');
  console.log('   - Contact scoring affected by duplicate events');
}

/**
 * REPRODUCTION TEST 3: Rapid webhook sequence (race conditions)
 */
async function reproduceRaceConditions() {
  console.log('\n🔴 === REPRODUCTION TEST 3: Race Conditions ===\n');

  const baseId = 'race-test-' + Date.now();

  const webhookSequence = [
    {
      endpoint: 'call-started',
      payload: {
        "call_uuid": baseId,
        "call_id": baseId + '-started',
        "internal_number": 393520441984,
        "external_number": "393513416607",
        "agent_id": 493933,
        "agent_first_name": "Roberto",
        "agent_last_name": "Bondici"
      },
      delay: 0
    },
    {
      endpoint: 'call-ended',
      payload: {
        "call_uuid": baseId,
        "call_id": baseId + '-ended',
        "internal_number": 393520441984,
        "external_number": "393513416607",
        "agent_id": 493933,
        "agent_first_name": "Roberto",
        "agent_last_name": "Bondici",
        "talking_time": 0, // MISSED call
        "waiting_time": 5
      },
      delay: 100
    },
    {
      endpoint: 'call-started', // Duplicate
      payload: {
        "call_uuid": baseId,
        "call_id": baseId + '-started',
        "internal_number": 393520441984,
        "external_number": "393513416607",
        "agent_id": 493933,
        "agent_first_name": "Roberto",
        "agent_last_name": "Bondici"
      },
      delay: 150
    }
  ];

  console.log('🧪 Sending rapid webhook sequence...');
  console.log(`   Base ID: ${baseId}`);

  const startTime = Date.now();
  const promises = [];

  // Send all webhooks with specified delays
  for (const webhook of webhookSequence) {
    promises.push(
      new Promise(resolve => {
        setTimeout(async () => {
          try {
            const response = await fetch(`${WEBHOOK_BASE_URL}/${webhook.endpoint}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'RaceConditionTest/1.0'
              },
              body: JSON.stringify(webhook.payload)
            });

            const result = {
              endpoint: webhook.endpoint,
              status: response.status,
              timestamp: Date.now() - startTime,
              success: response.ok
            };

            if (response.ok) {
              const data = await response.json();
              result.callId = data.callId;
              result.processed = !data.message?.includes('duplicate');
            }

            resolve(result);
          } catch (error) {
            resolve({
              endpoint: webhook.endpoint,
              status: 'ERROR',
              error: error.message
            });
          }
        }, webhook.delay);
      })
    );
  }

  const results = await Promise.all(promises);

  console.log('\n📊 Race Condition Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`   ${status} ${result.endpoint} (${result.timestamp}ms): ${result.status}`);
    if (result.processed === false) {
      console.log('       🔄 Detected as duplicate - deduplication working!');
    }
  });

  console.log('\n🔍 Analysis:');
  console.log('   - Check if deduplication prevented the duplicate call-started');
  console.log('   - Verify GHL webhooks only sent once despite race conditions');
  console.log('   - Monitor for any processing errors due to rapid delivery');
}

/**
 * VALIDATION TEST: Proper webhook with all required fields
 */
async function testProperWebhookFlow() {
  console.log('\n✅ === VALIDATION TEST: Proper Webhook Flow ===\n');

  const properCallId = 'proper-test-' + Date.now();

  // Step 1: Proper call-started
  const callStartedPayload = {
    "call_uuid": properCallId + '-uuid',
    "call_id": properCallId,
    "internal_number": 393520441984,
    "external_number": "393513416607",
    "contact_name": "Roberto Bondici (Validation Test)",
    "agent_id": 493933,
    "agent_first_name": "Roberto",
    "agent_last_name": "Bondici"
  };

  console.log('🧪 Step 1: Sending proper call-started webhook...');

  try {
    const startedResponse = await fetch(`${WEBHOOK_BASE_URL}/call-started`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ValidationTest/1.0'
      },
      body: JSON.stringify(callStartedPayload)
    });

    console.log(`   Status: ${startedResponse.status}`);

    // Step 2: Proper call-ended (answered call - no GHL webhook)
    const callEndedPayload = {
      "call_uuid": properCallId + '-uuid',
      "call_id": properCallId,
      "internal_number": 393520441984,
      "external_number": "393513416607",
      "agent_id": 493933,
      "agent_first_name": "Roberto",
      "agent_last_name": "Bondici",
      "talking_time": 30, // ANSWERED call
      "waiting_time": 8
    };

    console.log('🧪 Step 2: Sending proper call-ended webhook (answered)...');

    const endedResponse = await fetch(`${WEBHOOK_BASE_URL}/call-ended`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ValidationTest/1.0'
      },
      body: JSON.stringify(callEndedPayload)
    });

    console.log(`   Status: ${endedResponse.status}`);

    if (endedResponse.ok) {
      const result = await endedResponse.json();
      console.log('\n✅ Proper flow completed successfully!');
      console.log('📋 Key findings:');
      console.log(`   - Call type: ${result.call_type}`);
      console.log(`   - GHL webhook sent: ${result.ghlWebhookForwarding?.success || false}`);
      console.log(`   - Campaign automation: ${result.campaignAutomation?.success || false}`);
    }

  } catch (error) {
    console.log('❌ Validation test error:', error.message);
  }
}

/**
 * MAIN REPRODUCTION RUNNER
 */
async function runWebhookDuplicationReproduction() {
  console.log('🚀 WEBHOOK DUPLICATION REPRODUCTION TESTS');
  console.log('=' .repeat(60));
  console.log('⚠️  WARNING: These tests will create notes in GoHighLevel!');
  console.log('⚠️  WARNING: GHL webhooks will be triggered!');
  console.log('');

  // Wait for user confirmation in a real environment
  console.log('🧪 Starting reproduction tests...\n');

  try {
    await reproduceUndefinedCallIdIssue();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between tests

    await reproduceDuplicateGHLWebhook();
    await new Promise(resolve => setTimeout(resolve, 2000));

    await reproduceRaceConditions();
    await new Promise(resolve => setTimeout(resolve, 2000));

    await testProperWebhookFlow();

    console.log('\n🎉 All reproduction tests completed!');
    console.log('\n📋 Issues to monitor:');
    console.log('   1. Check webhook-payloads/ for saved test payloads');
    console.log('   2. Check logs/ for processing details');
    console.log('   3. Check GoHighLevel for duplicate notes/automations');
    console.log('   4. Monitor GHL webhook endpoint for double triggers');

  } catch (error) {
    console.error('💥 Reproduction test failed:', error.message);
  }
}

// Export functions for external use
export {
  reproduceUndefinedCallIdIssue,
  reproduceDuplicateGHLWebhook,
  reproduceRaceConditions,
  testProperWebhookFlow
};

// Run tests if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runWebhookDuplicationReproduction()
    .catch(error => {
      console.error('💥 Test execution failed:', error.message);
      process.exit(1);
    });
}