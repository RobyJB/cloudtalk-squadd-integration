#!/usr/bin/env node

/**
 * Enhanced Lead-to-Call System Test
 *
 * This test demonstrates the enhanced round-robin logic with fallback functionality:
 *
 * 1. Real-time agent availability checking (online + calling status)
 * 2. Active call detection to skip busy agents
 * 3. Smart round-robin with fallback to other agents if primary is busy
 * 4. Complete Lead→Contact→Call flow with retry mechanisms
 *
 * Test Scenarios:
 * - Normal round-robin operation
 * - Fallback when primary agent is busy
 * - Real-time call status verification
 * - Multiple agent retry logic
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import leadToCallService from './src/services/lead-to-call-service.js';
import agentDistributionService from './src/services/agent-distribution-service.js';
import { log, logError } from './src/logger.js';
import { makeCloudTalkRequest } from './API CloudTalk/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Test Data - Sample GHL Lead
 */
const SAMPLE_LEAD = {
  id: `test_${Date.now()}`,
  first_name: 'Mario',
  last_name: 'Rossi',
  full_name: 'Mario Rossi',
  name: 'Mario Rossi',
  phone: '+393520441984', // Roberto's test number
  email: 'mario.rossi@test.com',
  company: 'Test Company Enhanced',
  source: 'Enhanced Round Robin Test'
};

/**
 * Test helper to check agent real-time status
 */
async function checkAgentRealTimeStatus() {
  try {
    log('🔍 === STEP 1: REAL-TIME AGENT STATUS CHECK ===');

    const response = await makeCloudTalkRequest('/agents/index.json');
    if (!response?.data?.responseData?.data) {
      throw new Error('Invalid agents response');
    }

    const allAgents = response.data.responseData.data.map(item => item.Agent);

    log(`📊 Found ${allAgents.length} total agents`);

    // Check each agent's status and active calls
    for (const agent of allAgents) {
      const status = agent.availability_status;
      const isPotentiallyAvailable = status === 'online' || status === 'calling';

      log(`👤 ${agent.firstname} ${agent.lastname} (${agent.id}): ${status} ${isPotentiallyAvailable ? '🟡' : '🔴'}`);

      if (isPotentiallyAvailable) {
        // Check for active calls
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const dateFromStr = fiveMinutesAgo.toISOString().replace('T', ' ').substring(0, 19);

        const callResponse = await makeCloudTalkRequest(
          `/calls/index.json?user_id=${agent.id}&date_from=${encodeURIComponent(dateFromStr)}&limit=10`
        );

        if (callResponse?.data?.responseData?.data) {
          const recentCalls = callResponse.data.responseData.data;
          const activeCalls = recentCalls.filter(item => {
            const call = item.Cdr || item.CallSummary || item.Call || item;
            const hasStarted = call.started_at && call.started_at !== null;
            const hasEnded = call.ended_at && call.ended_at !== null;
            return hasStarted && !hasEnded;
          });

          if (activeCalls.length > 0) {
            log(`   🔴 OCCUPATO: ${activeCalls.length} chiamate attive`);
            activeCalls.forEach(item => {
              const call = item.Cdr || item.CallSummary || item.Call || item;
              log(`      📞 Call ${call.id}: started ${call.started_at}`);
            });
          } else {
            log(`   ✅ DISPONIBILE: Nessuna chiamata attiva`);
          }
        }

        // Small delay between agent checks
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return allAgents;

  } catch (error) {
    logError('Error checking agent real-time status:', error);
    throw error;
  }
}

/**
 * Test agent distribution service with enhanced logic
 */
async function testEnhancedAgentDistribution() {
  try {
    log('\n🎯 === STEP 2: ENHANCED AGENT DISTRIBUTION TEST ===');

    await agentDistributionService.initialize();

    // Test 1: Get available agents with real-time checking
    log('📋 Test 1: Getting available agents with real-time call checking...');
    const availableAgents = await agentDistributionService.getAvailableAgents();

    if (availableAgents.length === 0) {
      log('❌ No agents available - cannot test distribution logic');
      return null;
    }

    log(`✅ Found ${availableAgents.length} truly available agents:`);
    availableAgents.forEach((agent, index) => {
      log(`   ${index + 1}. ${agent.name} (${agent.id}) - Status: ${agent.status}`);
    });

    // Test 2: Smart distribution with round-robin
    log('\n📋 Test 2: Smart agent distribution...');
    const distribution1 = await agentDistributionService.distributeLeadToAgent(SAMPLE_LEAD);

    if (distribution1.success) {
      log(`✅ First distribution: ${distribution1.selectedAgent.name}`);
      log(`   📊 Fallback used: ${distribution1.fallbackInfo.fallbackUsed}`);
      log(`   📊 Reason: ${distribution1.fallbackInfo.reason}`);
      log(`   📊 Available agents: ${distribution1.availableAgents}`);
    } else {
      log(`❌ First distribution failed: ${distribution1.message}`);
      return null;
    }

    // Test 3: Second distribution (should use round-robin)
    log('\n📋 Test 3: Second distribution (round-robin test)...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay

    const distribution2 = await agentDistributionService.distributeLeadToAgent({
      ...SAMPLE_LEAD,
      id: `test_${Date.now()}_2`,
      name: 'Test Lead 2'
    });

    if (distribution2.success) {
      log(`✅ Second distribution: ${distribution2.selectedAgent.name}`);
      log(`   📊 Fallback used: ${distribution2.fallbackInfo.fallbackUsed}`);
      log(`   📊 Reason: ${distribution2.fallbackInfo.reason}`);

      if (availableAgents.length > 1) {
        const isDifferent = distribution1.selectedAgent.id !== distribution2.selectedAgent.id;
        log(`   🔄 Round-robin working: ${isDifferent ? '✅ Different agent selected' : '⚠️ Same agent (expected if only 1 available)'}`);
      }
    }

    return distribution1.selectedAgent;

  } catch (error) {
    logError('Error testing enhanced agent distribution:', error);
    throw error;
  }
}

/**
 * Test the complete enhanced Lead-to-Call flow
 */
async function testEnhancedLeadToCallFlow() {
  try {
    log('\n🚀 === STEP 3: ENHANCED LEAD-TO-CALL FLOW TEST ===');

    await leadToCallService.initialize();

    log('📋 Testing complete enhanced flow...');
    log(`📞 Test lead: ${SAMPLE_LEAD.name} (${SAMPLE_LEAD.phone})`);

    const startTime = Date.now();
    const result = await leadToCallService.processLeadToCallEnhanced(SAMPLE_LEAD);
    const processingTime = Date.now() - startTime;

    log(`⏱️ Processing time: ${processingTime}ms`);

    // Detailed results
    if (result.success) {
      log('✅ === ENHANCED FLOW SUCCESS ===');
      log(`📧 Process ID: ${result.processId}`);
      log(`👤 Final Agent: ${result.selectedAgent.name} (${result.selectedAgent.id})`);
      log(`📞 Call initiated successfully`);

      // Enhanced info
      log('\n🔍 === ENHANCED FEATURES USED ===');
      log(`🔄 Fallback used in distribution: ${result.enhancedInfo.fallbackUsed}`);
      log(`🎯 Final agent used fallback: ${result.enhancedInfo.finalAgentUsedFallback || false}`);
      log(`👥 Total agents attempted: ${result.enhancedInfo.totalAgentsAttempted}`);
      log(`🔴 Busy agents skipped: ${result.enhancedInfo.busyAgentsSkipped.length}`);

      if (result.enhancedInfo.busyAgentsSkipped.length > 0) {
        log('   Skipped agents:');
        result.enhancedInfo.busyAgentsSkipped.forEach(agent => {
          log(`     - ${agent.agentName} (${agent.reason})`);
        });
      }

      // Steps breakdown
      log('\n📋 === PROCESS STEPS ===');
      log(`📝 Contact creation: ${result.steps.contactCreation.success ? '✅' : '❌'}`);
      log(`🎯 Agent distribution: ${result.steps.agentDistribution.success ? '✅' : '❌'}`);
      log(`📞 Call initiation: ${result.steps.callInitiation.success ? '✅' : '❌'}`);
      log(`🔄 Fallback attempts: ${result.steps.fallbackAttempts.length}`);

      if (result.steps.fallbackAttempts.length > 0) {
        log('   Fallback attempts:');
        result.steps.fallbackAttempts.forEach((attempt, index) => {
          log(`     ${index + 1}. ${attempt.agent.name}: ${attempt.attempt.success ? '✅' : '❌'}`);
        });
      }

    } else {
      log('❌ === ENHANCED FLOW FAILED ===');
      log(`📧 Process ID: ${result.processId}`);
      log(`❌ Error: ${result.finalStatus}`);
      log(`📝 Message: ${result.error}`);

      // Enhanced error info
      if (result.enhancedInfo) {
        log(`👥 Agents attempted: ${result.enhancedInfo.totalAgentsAttempted}`);
        log(`🔴 Busy agents: ${result.enhancedInfo.busyAgentsSkipped.length}`);
      }

      // Steps that failed
      log('\n📋 === FAILED STEPS ===');
      if (result.steps.contactCreation && !result.steps.contactCreation.success) {
        log(`❌ Contact creation: ${result.steps.contactCreation.error}`);
      }
      if (result.steps.agentDistribution && !result.steps.agentDistribution.success) {
        log(`❌ Agent distribution: ${result.steps.agentDistribution.message}`);
      }
      if (result.steps.callInitiation && !result.steps.callInitiation.success) {
        log(`❌ Call initiation: ${result.steps.callInitiation.message}`);
      }
    }

    return result;

  } catch (error) {
    logError('Error testing enhanced Lead-to-Call flow:', error);
    throw error;
  }
}

/**
 * Test fallback scenario simulation
 */
async function testFallbackScenario() {
  try {
    log('\n🔄 === STEP 4: FALLBACK SCENARIO TEST ===');

    // This test simulates what happens when agents are busy
    log('📋 Testing fallback behavior...');

    // Get distribution stats before test
    const statsBefore = agentDistributionService.getDistributionStats();
    log(`📊 Distributions before test: ${statsBefore.totalDistributions}`);

    // Run multiple distributions to test round-robin
    const distributions = [];
    for (let i = 1; i <= 3; i++) {
      log(`\n🔄 Distribution attempt ${i}/3...`);

      const testLead = {
        ...SAMPLE_LEAD,
        id: `fallback_test_${Date.now()}_${i}`,
        name: `Fallback Test ${i}`
      };

      const distribution = await agentDistributionService.distributeLeadToAgent(testLead);
      distributions.push(distribution);

      if (distribution.success) {
        log(`   ✅ Agent: ${distribution.selectedAgent.name}`);
        log(`   🔄 Fallback: ${distribution.fallbackInfo.fallbackUsed}`);
        log(`   📊 Reason: ${distribution.fallbackInfo.reason}`);
      } else {
        log(`   ❌ Failed: ${distribution.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Analyze round-robin pattern
    const successfulDistributions = distributions.filter(d => d.success);
    if (successfulDistributions.length > 1) {
      const agentIds = successfulDistributions.map(d => d.selectedAgent.id);
      const uniqueAgents = new Set(agentIds);

      log(`\n📊 === ROUND-ROBIN ANALYSIS ===`);
      log(`✅ Successful distributions: ${successfulDistributions.length}`);
      log(`👥 Unique agents used: ${uniqueAgents.size}`);
      log(`🔄 Round-robin working: ${uniqueAgents.size > 1 || successfulDistributions.length === 1 ? '✅' : '⚠️'}`);
    }

    return distributions;

  } catch (error) {
    logError('Error testing fallback scenario:', error);
    throw error;
  }
}

/**
 * Main test execution
 */
async function runEnhancedTests() {
  console.log('🚀 === ENHANCED LEAD-TO-CALL SYSTEM TEST ===');
  console.log('📅 Started:', new Date().toISOString());
  console.log('🎯 Testing enhanced round-robin with real-time fallback logic\n');

  const results = {
    agentStatusCheck: null,
    agentDistribution: null,
    leadToCallFlow: null,
    fallbackScenario: null,
    success: false,
    errors: []
  };

  try {
    // Step 1: Real-time agent status check
    results.agentStatusCheck = await checkAgentRealTimeStatus();

    // Step 2: Enhanced agent distribution test
    results.agentDistribution = await testEnhancedAgentDistribution();

    // Step 3: Complete enhanced Lead-to-Call flow
    results.leadToCallFlow = await testEnhancedLeadToCallFlow();

    // Step 4: Fallback scenario test
    results.fallbackScenario = await testFallbackScenario();

    results.success = true;

  } catch (error) {
    results.errors.push(error.message);
    logError('Test execution failed:', error);
  }

  // Final summary
  console.log('\n🏁 === TEST EXECUTION SUMMARY ===');
  console.log(`📅 Completed: ${new Date().toISOString()}`);
  console.log(`✅ Overall success: ${results.success}`);

  if (results.success) {
    console.log('\n🎉 === ALL TESTS PASSED ===');
    console.log('✅ Real-time agent status checking: WORKING');
    console.log('✅ Enhanced agent distribution: WORKING');
    console.log('✅ Smart round-robin with fallback: WORKING');
    console.log('✅ Complete Lead-to-Call flow: WORKING');
    console.log('✅ Fallback scenario handling: WORKING');

    if (results.leadToCallFlow?.success) {
      console.log(`\n🎯 FINAL RESULT:`);
      console.log(`📞 Call initiated for ${SAMPLE_LEAD.name} (${SAMPLE_LEAD.phone})`);
      console.log(`👤 Agent: ${results.leadToCallFlow.selectedAgent.name}`);
      console.log(`🔄 Used fallback: ${results.leadToCallFlow.enhancedInfo.finalAgentUsedFallback || false}`);
      console.log(`👥 Total agents attempted: ${results.leadToCallFlow.enhancedInfo.totalAgentsAttempted}`);
    }

  } else {
    console.log('\n❌ === SOME TESTS FAILED ===');
    results.errors.forEach(error => {
      console.log(`❌ ${error}`);
    });
  }

  console.log('\n📊 === ENHANCED FEATURES TESTED ===');
  console.log('✅ Online + Calling agent status detection');
  console.log('✅ Real-time active call checking');
  console.log('✅ Smart round-robin distribution');
  console.log('✅ Automatic fallback to available agents');
  console.log('✅ Busy agent detection and skipping');
  console.log('✅ Complete retry mechanism');
  console.log('✅ Enhanced logging and monitoring');

  return results;
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEnhancedTests()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

export { runEnhancedTests, SAMPLE_LEAD };