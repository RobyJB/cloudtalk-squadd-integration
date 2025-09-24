#!/usr/bin/env node

/**
 * Test script for GHL webhook integration with CloudTalk Lead-to-Call system
 * Tests the complete flow: GHL webhook → Contact creation → Agent distribution → Call initiation
 */

import leadToCallService from './src/services/lead-to-call-service.js';
import { log, logError } from './src/logger.js';

// Test payload simulating GHL webhook structure
const testGHLPayload = {
  contact_id: "eNtxZuc4PLQR2ELzyxOg",
  first_name: "Rubertu",
  last_name: "Bundici",
  full_name: "Rubertu Bundici",
  phone: "+393513416607",  // Roberto's test number (root level)
  user: {
    firstName: "Andrea",
    lastName: "Guzzonato",
    email: "andreaguzzonato.work@gmail.com",
    phone: "+393807454525"  // User's phone number
  }
};

async function testGHLWebhookIntegration() {
  console.log('🎯 TESTING GHL WEBHOOK INTEGRATION');
  console.log('=' .repeat(50));

  try {
    log('📋 Test payload:');
    console.log(JSON.stringify(testGHLPayload, null, 2));

    log('🚀 Starting Lead-to-Call process...');

    // Test the complete process
    const result = await leadToCallService.processLeadToCall(testGHLPayload);

    console.log('\n📊 RESULT SUMMARY:');
    console.log('=' .repeat(50));
    console.log(`Process ID: ${result.processId}`);
    console.log(`Success: ${result.success}`);
    console.log(`Final Status: ${result.finalStatus}`);
    console.log(`Processing Time: ${result.processingTime}ms`);

    if (result.success) {
      console.log('\n✅ PROCESS COMPLETED SUCCESSFULLY');
      console.log(`👤 Selected Agent: ${result.selectedAgent.name}`);
      console.log(`📞 Phone Number Called: ${testGHLPayload.user.phone}`);
      console.log(`📝 Contact Created: ${result.steps.contactCreation.success}`);
      console.log(`🎯 Agent Distributed: ${result.steps.agentDistribution.success}`);
      console.log(`📞 Call Initiated: ${result.steps.callInitiation.success}`);
    } else {
      console.log('\n❌ PROCESS FAILED');
      console.log(`Error: ${result.error}`);

      // Step-by-step analysis
      console.log('\n📋 STEP ANALYSIS:');
      console.log(`1. Contact Creation: ${result.steps.contactCreation?.success ? '✅' : '❌'}`);
      if (!result.steps.contactCreation?.success) {
        console.log(`   Error: ${result.steps.contactCreation?.error}`);
      }

      console.log(`2. Agent Distribution: ${result.steps.agentDistribution?.success ? '✅' : '❌'}`);
      if (!result.steps.agentDistribution?.success) {
        console.log(`   Error: ${result.steps.agentDistribution?.error}`);
      }

      console.log(`3. Call Initiation: ${result.steps.callInitiation?.success ? '✅' : '❌'}`);
      if (!result.steps.callInitiation?.success) {
        console.log(`   Error: ${result.steps.callInitiation?.error}`);
      }
    }

    // Test service stats
    console.log('\n📈 SERVICE STATISTICS:');
    const stats = await leadToCallService.getServiceStats();
    console.log(`Initialized: ${stats.initialized}`);
    console.log(`Total Distributions: ${stats.distributionStats.totalDistributions}`);
    console.log(`Available Agents: ${stats.distributionStats.availableAgents}`);

  } catch (error) {
    logError('💥 Test failed:', error);
    process.exit(1);
  }
}

// Test payload extraction specifically
function testPayloadMapping() {
  console.log('\n🔍 TESTING PAYLOAD MAPPING');
  console.log('=' .repeat(30));

  const leadData = testGHLPayload;

  // Test the corrected mapping logic
  const contact = leadData.user || leadData;
  const fullName = `${contact.firstName || leadData.first_name || ''} ${contact.lastName || leadData.last_name || ''}`.trim();
  const phoneNumber = leadData.user?.phone || leadData.phone;
  const email = contact.email || leadData.email || '';

  console.log('📋 EXTRACTED DATA:');
  console.log(`Name: ${contact.name || fullName || leadData.full_name || leadData.name || 'Lead Senza Nome'}`);
  console.log(`Phone: ${phoneNumber}`);
  console.log(`Email: ${email}`);
  console.log(`Full Name: ${fullName}`);

  // Validate required fields
  if (!phoneNumber) {
    console.log('❌ MISSING PHONE NUMBER!');
  } else {
    console.log('✅ Phone number found');
  }

  return {
    name: contact.name || fullName || leadData.full_name || leadData.name || 'Lead Senza Nome',
    phone: phoneNumber,
    email: email
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 GHL WEBHOOK INTEGRATION TEST');
  console.log('=' .repeat(50));

  // First test payload mapping
  const extractedData = testPayloadMapping();

  // Then test the complete integration
  testGHLWebhookIntegration();
}

export { testGHLWebhookIntegration, testPayloadMapping };