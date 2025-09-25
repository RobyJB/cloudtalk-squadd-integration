#!/usr/bin/env node

/**
 * WEBHOOK DUPLICATION AND UNEXPECTED FIRING ANALYSIS
 *
 * This script analyzes the reported webhook issues:
 * 1. Unexpected call-started webhook with undefined call_id
 * 2. Duplicate GHL webhook sending (leadconnector webhook sent TWICE)
 *
 * Testing framework to reproduce and analyze:
 * - Webhook deduplication system effectiveness
 * - Payload validation issues
 * - Race conditions in webhook processing
 * - Double webhook sending patterns
 */

import 'dotenv/config';
import { getWebhookCacheStats } from './src/utils/webhook-deduplication.js';
import { log, logError } from './src/logger.js';

// Test webhook endpoint
const WEBHOOK_BASE_URL = 'http://localhost:3000/api/cloudtalk-webhooks';
const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/DfxGoORmPoL5Z1OcfYJM/webhook-trigger/873baa5c-928e-428a-ac68-498d954a9ff7';

/**
 * TEST SCENARIOS FOR WEBHOOK DUPLICATION ANALYSIS
 */

// Test 1: Call-started webhook with undefined call_id (reported issue)
const problematicCallStartedPayload = {
  // Missing call_id - this should be caught by validation
  "internal_number": 393520441984,
  "external_number": "393513416607",
  "agent_id": 493933,
  "agent_first_name": "Roberto",
  "agent_last_name": "Bondici"
};

// Test 2: Normal call-started webhook
const normalCallStartedPayload = {
  "call_uuid": "test-uuid-12345",
  "call_id": "test-call-456",
  "internal_number": 393520441984,
  "external_number": "393513416607",
  "contact_name": "Roberto Bondici (Test)",
  "agent_id": 493933,
  "agent_first_name": "Roberto",
  "agent_last_name": "Bondici"
};

// Test 3: Call-ended webhook that triggers GHL webhook (missed call)
const missedCallEndedPayload = {
  "call_uuid": "test-uuid-missed-789",
  "call_id": "test-call-missed-999",
  "internal_number": 393520441984,
  "external_number": "393513416607",
  "agent_id": 493933,
  "agent_first_name": "Roberto",
  "agent_last_name": "Bondici",
  "talking_time": 0, // This makes it a missed call
  "waiting_time": 15
};

// Test 4: Call-ended webhook that should NOT trigger GHL webhook (answered call)
const answeredCallEndedPayload = {
  "call_uuid": "test-uuid-answered-321",
  "call_id": "test-call-answered-654",
  "internal_number": 393520441984,
  "external_number": "393513416607",
  "agent_id": 493933,
  "agent_first_name": "Roberto",
  "agent_last_name": "Bondici",
  "talking_time": 45, // This makes it an answered call
  "waiting_time": 12
};

/**
 * WEBHOOK DEDUPLICATION ANALYSIS
 */
async function analyzeWebhookDeduplication() {
  console.log('\n🔍 === WEBHOOK DEDUPLICATION ANALYSIS ===\n');

  // Get current cache stats
  const cacheStats = getWebhookCacheStats();

  console.log('📊 Current Webhook Cache State:');
  console.log(`   Total entries: ${cacheStats.totalEntries}`);

  if (cacheStats.entries.length > 0) {
    console.log('   Recent entries:');
    cacheStats.entries.forEach(entry => {
      console.log(`   - ${entry.key} (${entry.ageMinutes}min ago)`);
    });
  } else {
    console.log('   - No entries in cache');
  }

  console.log('\n✅ Cache analysis complete\n');
}

/**
 * PAYLOAD VALIDATION ANALYSIS
 */
async function analyzePayloadValidation() {
  console.log('🔍 === PAYLOAD VALIDATION ANALYSIS ===\n');

  const testCases = [
    { name: 'Problematic call-started (no call_id)', payload: problematicCallStartedPayload },
    { name: 'Normal call-started', payload: normalCallStartedPayload },
    { name: 'Missed call-ended', payload: missedCallEndedPayload },
    { name: 'Answered call-ended', payload: answeredCallEndedPayload }
  ];

  testCases.forEach(testCase => {
    console.log(`📋 ${testCase.name}:`);

    // Check for call ID extraction patterns
    const callId = testCase.payload.call_id || testCase.payload.Call_id || testCase.payload.call_uuid;
    console.log(`   Call ID extraction: ${callId || 'UNDEFINED'}`);

    // Check deduplication key generation
    const webhookType = testCase.name.includes('call-started') ? 'call-started' : 'call-ended';
    const deduplicationKey = callId ? `${callId}_${webhookType}` : 'UNDEFINED_' + webhookType;
    console.log(`   Deduplication key: ${deduplicationKey}`);

    // Check if this would cause issues
    if (!callId) {
      console.log(`   ⚠️  WARNING: Missing call_id would break deduplication!`);
    }

    // Check external_number for GHL processing
    const phoneNumber = testCase.payload.external_number;
    console.log(`   Phone number: ${phoneNumber || 'MISSING'}`);

    console.log('');
  });
}

/**
 * RACE CONDITION ANALYSIS
 */
async function analyzeRaceConditions() {
  console.log('🔍 === RACE CONDITION ANALYSIS ===\n');

  console.log('⚡ Simulating rapid webhook delivery:');
  console.log('   - CloudTalk can send webhooks almost simultaneously');
  console.log('   - call-started and call-ended might arrive within milliseconds');
  console.log('   - Multiple webhook types for same call_id need proper deduplication');

  // Test rapid sequential webhook simulation
  const baseCallId = 'race-test-' + Date.now();

  const rapidWebhooks = [
    { type: 'call-started', delay: 0 },
    { type: 'call-started', delay: 10 },   // Duplicate within 10ms
    { type: 'call-ended', delay: 50 },
    { type: 'call-ended', delay: 60 }      // Duplicate within 10ms
  ];

  console.log('\n📊 Race condition test simulation:');
  rapidWebhooks.forEach(webhook => {
    const key = `${baseCallId}_${webhook.type}`;
    console.log(`   ${webhook.delay}ms: ${key}`);
  });

  console.log('\n⚠️  Potential issues:');
  console.log('   - If call_id is undefined, deduplication fails');
  console.log('   - Cache cleanup might interfere with rapid webhooks');
  console.log('   - Multiple fetch() calls to GHL webhook URL without proper queuing');
}

/**
 * GHL WEBHOOK FORWARDING ANALYSIS
 */
async function analyzeGHLWebhookForwarding() {
  console.log('🔍 === GHL WEBHOOK FORWARDING ANALYSIS ===\n');

  console.log('📤 GHL Webhook URL Analysis:');
  console.log(`   Target: ${GHL_WEBHOOK_URL}`);
  console.log('');

  console.log('🔄 Webhook Forwarding Flow Analysis:');
  console.log('   1. CloudTalk sends webhook to middleware');
  console.log('   2. Middleware processes webhook (creates note, etc.)');
  console.log('   3. For MISSED calls: Middleware forwards to GHL webhook');
  console.log('   4. For ANSWERED calls: NO forwarding (by design)');
  console.log('');

  console.log('⚠️  Potential Duplication Points:');
  console.log('   A. processCallEnded() in webhook-to-ghl-processor.js (line 492-550)');
  console.log('   B. handleCallEndedWebhook() in cloudtalk-webhooks.js (line 141-174)');
  console.log('   C. Both functions call the SAME GHL webhook URL!');
  console.log('');

  console.log('🚨 DUPLICATION ISSUE IDENTIFIED:');
  console.log('   - handleCallEndedWebhook() sends GHL webhook for MISSED calls');
  console.log('   - processCallEnded() ALSO sends GHL webhook for ALL call-ended');
  console.log('   - Result: DOUBLE webhook sending for missed calls!');
  console.log('');

  console.log('📋 Evidence from code analysis:');
  console.log('   - cloudtalk-webhooks.js line 167: fetch(ghlWebhookUrl, ...)');
  console.log('   - webhook-to-ghl-processor.js line 522: fetch(ghlWebhookUrl, ...)');
  console.log('   - SAME URL, SAME payload structure, SAME missed call trigger');
}

/**
 * WEBHOOK FLOW SEQUENCE ANALYSIS
 */
async function analyzeWebhookFlowSequence() {
  console.log('🔍 === WEBHOOK FLOW SEQUENCE ANALYSIS ===\n');

  console.log('📞 Expected Normal Call Flow:');
  console.log('   1. call-started webhook → Google Sheets tracking + GHL note');
  console.log('   2. call-ended webhook → Campaign automation + conditional GHL webhook');
  console.log('   3. call-recording-ready webhook → Transcription + GHL conversation upload');
  console.log('');

  console.log('🚨 Problematic Flow (Current Issue):');
  console.log('   1. call-started with undefined call_id → Breaks deduplication');
  console.log('   2. call-ended (missed) → TWO GHL webhooks sent almost simultaneously');
  console.log('   3. Race condition → Pipeline movement triggered twice');
  console.log('');

  console.log('✅ Expected Fixed Flow:');
  console.log('   1. Validate all webhook payloads have required call_id');
  console.log('   2. Single point of GHL webhook forwarding (no duplication)');
  console.log('   3. Proper deduplication even with undefined call_id');
  console.log('   4. Clear separation of webhook responsibilities');
}

/**
 * TESTING RECOMMENDATIONS
 */
async function generateTestingRecommendations() {
  console.log('🔍 === TESTING RECOMMENDATIONS ===\n');

  console.log('🧪 Immediate Testing Steps:');
  console.log('   1. Test webhook with undefined call_id');
  console.log('   2. Test rapid duplicate webhook sending');
  console.log('   3. Monitor GHL webhook forwarding for duplicates');
  console.log('   4. Verify deduplication cache effectiveness');
  console.log('');

  console.log('🛠️  Validation Strategy:');
  console.log('   - Add payload validation before processing');
  console.log('   - Generate fallback call_id when undefined');
  console.log('   - Use correlation IDs for tracking');
  console.log('   - Implement request queuing for GHL webhooks');
  console.log('');

  console.log('📊 Monitoring Points:');
  console.log('   - webhook-payloads/ directory for malformed payloads');
  console.log('   - logs/ directory for duplicate processing logs');
  console.log('   - GHL webhook responses for double triggers');
  console.log('   - Campaign automation logs for unexpected progressions');
  console.log('');

  console.log('🎯 Quick Fixes:');
  console.log('   1. Remove duplicate GHL webhook call from processCallEnded()');
  console.log('   2. Add call_id validation and fallback generation');
  console.log('   3. Improve deduplication to handle undefined call_ids');
  console.log('   4. Add request ID tracking for debugging');
}

/**
 * MAIN ANALYSIS RUNNER
 */
async function runWebhookDuplicationAnalysis() {
  console.log('🚀 WEBHOOK DUPLICATION AND UNEXPECTED FIRING ANALYSIS');
  console.log('=' .repeat(60));

  try {
    await analyzeWebhookDeduplication();
    await analyzePayloadValidation();
    await analyzeRaceConditions();
    await analyzeGHLWebhookForwarding();
    await analyzeWebhookFlowSequence();
    await generateTestingRecommendations();

    console.log('\n🎉 Analysis Complete!');
    console.log('\n📋 Summary of Findings:');
    console.log('   🔴 Issue 1: Undefined call_id breaks deduplication system');
    console.log('   🔴 Issue 2: Double GHL webhook sending (two functions call same URL)');
    console.log('   🔴 Issue 3: Race conditions possible with rapid webhook delivery');
    console.log('   🔴 Issue 4: Payload validation insufficient for edge cases');

  } catch (error) {
    logError('Analysis failed:', error);
  }
}

// Test webhook endpoint connectivity
async function testWebhookEndpoints() {
  console.log('\n🔍 === WEBHOOK ENDPOINT TESTING ===\n');

  const endpoints = [
    { name: 'call-started', url: `${WEBHOOK_BASE_URL}/call-started` },
    { name: 'call-ended', url: `${WEBHOOK_BASE_URL}/call-ended` },
    { name: 'health', url: `${WEBHOOK_BASE_URL}/health` }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`🧪 Testing ${endpoint.name}...`);

      if (endpoint.name === 'health') {
        const response = await fetch(endpoint.url);
        console.log(`   Status: ${response.status}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`   Service: ${data.service}`);
        }
      } else {
        console.log(`   URL: ${endpoint.url}`);
        console.log(`   Ready for payload testing`);
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

// Run analysis if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runWebhookDuplicationAnalysis()
    .then(() => testWebhookEndpoints())
    .catch(error => {
      console.error('💥 Analysis failed:', error.message);
      process.exit(1);
    });
}

export {
  analyzeWebhookDeduplication,
  analyzePayloadValidation,
  analyzeRaceConditions,
  analyzeGHLWebhookForwarding,
  problematicCallStartedPayload,
  normalCallStartedPayload,
  missedCallEndedPayload,
  answeredCallEndedPayload
};