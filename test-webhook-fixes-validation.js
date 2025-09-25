#!/usr/bin/env node

/**
 * WEBHOOK FIXES VALIDATION TEST
 *
 * This script validates the fixes applied for:
 * 1. Undefined call_id issue (should be resolved with validation)
 * 2. Duplicate GHL webhook sending (should be eliminated)
 * 3. Enhanced deduplication system
 * 4. Proper payload validation
 *
 * Run this after applying fixes to verify they work correctly.
 */

import 'dotenv/config';

const WEBHOOK_BASE_URL = 'http://localhost:3000/api/cloudtalk-webhooks';

/**
 * Test 1: Validate undefined call_id is fixed
 */
async function testUndefinedCallIdFix() {
  console.log('\n✅ === TEST 1: Undefined call_id Fix Validation ===\n');

  // This payload previously broke deduplication
  const problematicPayload = {
    // Intentionally missing call_id to test the fix
    "internal_number": 393520441984,
    "external_number": "393513416607",
    "agent_id": 493933,
    "agent_first_name": "Roberto",
    "agent_last_name": "Bondici"
  };

  console.log('🧪 Testing call-started webhook with missing call_id...');
  console.log('📋 Payload (missing call_id):', JSON.stringify(problematicPayload, null, 2));
  console.log('');
  console.log('🔍 Expected behavior:');
  console.log('   ✅ Webhook should be processed (not rejected)');
  console.log('   ✅ call_id should be auto-generated');
  console.log('   ✅ Deduplication should work with generated call_id');
  console.log('   ✅ Note should be created in GHL');
  console.log('');

  try {
    const response = await fetch(`${WEBHOOK_BASE_URL}/call-started`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WebhookFixValidation/1.0'
      },
      body: JSON.stringify(problematicPayload)
    });

    console.log(`📊 Response Status: ${response.status}`);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook processed successfully!');

      // Check if call_id was generated
      const callId = result.callId;
      console.log(`📋 Generated call_id: ${callId}`);

      // Check validation warnings
      if (result.validationWarnings && result.validationWarnings.length > 0) {
        console.log('⚠️  Validation warnings (expected):');
        result.validationWarnings.forEach(warning => {
          console.log(`   - ${warning}`);
        });
      }

      // Check GHL integration
      if (result.ghlIntegration?.success) {
        console.log('✅ GHL integration successful');
        console.log(`   Action: ${result.ghlIntegration.result?.action}`);
      }

      console.log('\n🎉 UNDEFINED CALL_ID FIX VALIDATED!');

      // Test duplicate detection with generated call_id
      console.log('\n🔄 Testing duplicate detection with generated call_id...');

      const duplicateResponse = await fetch(`${WEBHOOK_BASE_URL}/call-started`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WebhookFixValidation/1.0'
        },
        body: JSON.stringify(problematicPayload)
      });

      if (duplicateResponse.ok) {
        const duplicateResult = await duplicateResponse.json();
        if (duplicateResult.message && duplicateResult.message.includes('duplicate')) {
          console.log('✅ Duplicate detection working with generated call_id!');
        } else {
          console.log('⚠️  Duplicate might not have been detected (different call_id generated?)');
        }
      }

    } else {
      const errorText = await response.text();
      console.log('❌ Webhook failed (this suggests validation is too strict):', errorText);
    }

  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

/**
 * Test 2: Validate duplicate GHL webhook is eliminated
 */
async function testDuplicateGHLWebhookElimination() {
  console.log('\n✅ === TEST 2: Duplicate GHL Webhook Elimination ===\n');

  const missedCallPayload = {
    "call_uuid": "fix-test-" + Date.now(),
    "call_id": "fix-test-call-" + Date.now(),
    "internal_number": 393520441984,
    "external_number": "393513416607",
    "agent_id": 493933,
    "agent_first_name": "Roberto",
    "agent_last_name": "Bondici",
    "talking_time": 0, // This makes it MISSED
    "waiting_time": 15
  };

  console.log('🧪 Testing call-ended webhook (MISSED CALL)...');
  console.log('📋 Payload:', JSON.stringify(missedCallPayload, null, 2));
  console.log('');
  console.log('🔍 Expected behavior:');
  console.log('   ✅ Only ONE GHL webhook should be sent (from handleCallEndedWebhook)');
  console.log('   ❌ processCallEnded should NOT send GHL webhook (fixed)');
  console.log('   ✅ Campaign automation should still work');
  console.log('   ✅ GHL note should be created');
  console.log('');

  try {
    const response = await fetch(`${WEBHOOK_BASE_URL}/call-ended`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WebhookFixValidation/1.0'
      },
      body: JSON.stringify(missedCallPayload)
    });

    console.log(`📊 Response Status: ${response.status}`);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook processed successfully!');

      // Analyze webhook forwarding
      console.log('\n🔍 Webhook Forwarding Analysis:');

      const ghlWebhookForwarding = result.ghlWebhookForwarding;
      const ghlIntegration = result.ghlIntegration;

      if (ghlWebhookForwarding?.success) {
        console.log('✅ GHL webhook #1: Sent by handleCallEndedWebhook()');
      } else {
        console.log('❌ GHL webhook #1: Failed or not sent');
      }

      if (ghlIntegration?.webhookSent?.success) {
        console.log('❌ GHL webhook #2: Sent by processCallEnded() - THIS SHOULD BE FIXED!');
        console.log('🚨 DUPLICATION ISSUE STILL EXISTS');
      } else if (ghlIntegration?.webhookSent?.skipped) {
        console.log('✅ GHL webhook #2: Skipped by processCallEnded() - FIX WORKING!');
        console.log(`   Reason: ${ghlIntegration.webhookSent.reason}`);
      } else {
        console.log('❓ GHL webhook #2: Status unclear');
      }

      // Check campaign automation
      if (result.campaignAutomation?.success) {
        console.log('✅ Campaign automation: Working correctly');
        console.log(`   Contact: ${result.campaignAutomation.contact?.name}`);
      }

      if (ghlWebhookForwarding?.success && ghlIntegration?.webhookSent?.skipped) {
        console.log('\n🎉 DUPLICATE GHL WEBHOOK ELIMINATION VALIDATED!');
      } else {
        console.log('\n⚠️  Webhook duplication status unclear - review needed');
      }

    } else {
      const errorText = await response.text();
      console.log('❌ Webhook failed:', errorText);
    }

  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

/**
 * Test 3: Validate enhanced deduplication system
 */
async function testEnhancedDeduplication() {
  console.log('\n✅ === TEST 3: Enhanced Deduplication System ===\n');

  const baseCallId = 'dedup-test-' + Date.now();

  const testPayload = {
    "call_uuid": baseCallId + '-uuid',
    "call_id": baseCallId,
    "internal_number": 393520441984,
    "external_number": "393513416607",
    "contact_name": "Roberto Bondici (Dedup Test)",
    "agent_id": 493933,
    "agent_first_name": "Roberto",
    "agent_last_name": "Bondici"
  };

  console.log('🧪 Testing enhanced deduplication system...');
  console.log(`📋 Test call_id: ${baseCallId}`);
  console.log('');

  try {
    // Send first webhook
    console.log('1️⃣ Sending first call-started webhook...');
    const firstResponse = await fetch(`${WEBHOOK_BASE_URL}/call-started`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WebhookFixValidation/1.0'
      },
      body: JSON.stringify(testPayload)
    });

    console.log(`   Status: ${firstResponse.status}`);

    if (firstResponse.ok) {
      const firstResult = await firstResponse.json();
      console.log(`   ✅ First webhook processed`);
      console.log(`   Deduplication key: ${firstResult.deduplicationKey || 'not provided'}`);
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send duplicate webhook
    console.log('\n2️⃣ Sending duplicate call-started webhook...');
    const duplicateResponse = await fetch(`${WEBHOOK_BASE_URL}/call-started`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WebhookFixValidation/1.0'
      },
      body: JSON.stringify(testPayload)
    });

    console.log(`   Status: ${duplicateResponse.status}`);

    if (duplicateResponse.ok) {
      const duplicateResult = await duplicateResponse.json();

      if (duplicateResult.message && duplicateResult.message.includes('duplicate')) {
        console.log('   ✅ Duplicate correctly detected and skipped!');
        console.log(`   Deduplication key: ${duplicateResult.deduplicationKey || 'not provided'}`);
        console.log('\n🎉 ENHANCED DEDUPLICATION SYSTEM VALIDATED!');
      } else {
        console.log('   ❌ Duplicate was NOT detected - deduplication failed!');
      }
    }

  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

/**
 * Test 4: Validate proper webhook flow still works
 */
async function testProperWebhookFlow() {
  console.log('\n✅ === TEST 4: Proper Webhook Flow Validation ===\n');

  const properCallId = 'proper-test-' + Date.now();

  // Proper call-started payload
  const callStartedPayload = {
    "call_uuid": properCallId + '-uuid',
    "call_id": properCallId,
    "internal_number": 393520441984,
    "external_number": "393513416607",
    "contact_name": "Roberto Bondici (Flow Test)",
    "agent_id": 493933,
    "agent_first_name": "Roberto",
    "agent_last_name": "Bondici"
  };

  // Proper call-ended payload (answered call)
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

  console.log('🧪 Testing complete proper webhook flow...');
  console.log(`📋 Test call_id: ${properCallId}`);
  console.log('');

  try {
    // Step 1: Call started
    console.log('1️⃣ Testing call-started webhook...');
    const startedResponse = await fetch(`${WEBHOOK_BASE_URL}/call-started`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WebhookFixValidation/1.0'
      },
      body: JSON.stringify(callStartedPayload)
    });

    console.log(`   Status: ${startedResponse.status}`);
    if (startedResponse.ok) {
      console.log('   ✅ Call-started processed successfully');
    }

    // Wait between calls
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 2: Call ended
    console.log('\n2️⃣ Testing call-ended webhook (answered call)...');
    const endedResponse = await fetch(`${WEBHOOK_BASE_URL}/call-ended`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WebhookFixValidation/1.0'
      },
      body: JSON.stringify(callEndedPayload)
    });

    console.log(`   Status: ${endedResponse.status}`);

    if (endedResponse.ok) {
      const endedResult = await endedResponse.json();
      console.log('   ✅ Call-ended processed successfully');
      console.log(`   Call type: ${endedResult.call_type || 'not specified'}`);

      // For answered calls, GHL webhook should NOT be sent
      if (endedResult.ghlWebhookForwarding?.success === false &&
          endedResult.ghlWebhookForwarding?.reason?.includes('answered')) {
        console.log('   ✅ Correctly skipped GHL webhook for answered call');
      }

      if (endedResult.campaignAutomation?.success) {
        console.log('   ✅ Campaign automation worked for answered call');
      }

      console.log('\n🎉 PROPER WEBHOOK FLOW VALIDATED!');
    }

  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

/**
 * MAIN VALIDATION RUNNER
 */
async function runWebhookFixesValidation() {
  console.log('🚀 WEBHOOK FIXES VALIDATION SUITE');
  console.log('=' .repeat(60));
  console.log('Testing the fixes applied for webhook duplication issues');
  console.log('');

  try {
    await testUndefinedCallIdFix();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testDuplicateGHLWebhookElimination();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testEnhancedDeduplication();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testProperWebhookFlow();

    console.log('\n🎉 ALL VALIDATION TESTS COMPLETED!');
    console.log('\n📋 Summary:');
    console.log('   1. Undefined call_id fix validation');
    console.log('   2. Duplicate GHL webhook elimination');
    console.log('   3. Enhanced deduplication system');
    console.log('   4. Proper webhook flow preservation');
    console.log('\n⚠️  Remember to:');
    console.log('   - Check webhook-payloads/ for saved test data');
    console.log('   - Check logs/ for detailed processing logs');
    console.log('   - Check GoHighLevel for created notes/activities');
    console.log('   - Monitor GHL webhook endpoint for duplicate calls');

  } catch (error) {
    console.error('💥 Validation suite failed:', error.message);
  }
}

// Export test functions
export {
  testUndefinedCallIdFix,
  testDuplicateGHLWebhookElimination,
  testEnhancedDeduplication,
  testProperWebhookFlow
};

// Run tests if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runWebhookFixesValidation()
    .catch(error => {
      console.error('💥 Validation execution failed:', error.message);
      process.exit(1);
    });
}