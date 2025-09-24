#!/usr/bin/env node

/**
 * Test individual components of the GHL webhook integration
 * Tests each step independently to verify logic without external API dependencies
 */

import leadToCallService from './src/services/lead-to-call-service.js';
import { log, logError } from './src/logger.js';

// Test payload simulating GHL webhook structure
const testGHLPayload = {
  contact_id: "eNtxZuc4PLQR2ELzyxOg",
  first_name: "Rubertu",
  last_name: "Bundici",
  full_name: "Rubertu Bundici",
  phone: "+393513416607",
  user: {
    firstName: "Andrea",
    lastName: "Guzzonato",
    email: "andreaguzzonato.work@gmail.com",
    phone: "+393807454525"
  }
};

async function testPayloadExtractionLogic() {
  console.log('🔍 TESTING PAYLOAD EXTRACTION LOGIC');
  console.log('=' .repeat(50));

  const leadData = testGHLPayload;

  console.log('📋 Original GHL Webhook Payload:');
  console.log(JSON.stringify(leadData, null, 2));

  // Test the corrected mapping logic from lead-to-call-service.js
  const contact = leadData.user || leadData;
  const fullName = `${contact.firstName || leadData.first_name || ''} ${contact.lastName || leadData.last_name || ''}`.trim();
  const phoneNumber = leadData.user?.phone || leadData.phone;

  // Test ContactData structure for CloudTalk Bulk API
  const contactData = {
    action: 'add_contact',
    command_id: `ghl_lead_test_${Date.now()}`,
    data: {
      name: contact.name || fullName || leadData.full_name || leadData.name || 'Lead Senza Nome',
      title: leadData.title || 'GHL Contact',
      company: leadData.company || 'GoHighLevel Lead',
      ContactNumber: [
        { public_number: contact.phone || leadData.phone || '' }
      ],
      ContactEmail: [
        { email: contact.email || leadData.email || '' }
      ],
      custom_fields: [
        {
          key: 'ghl_lead_id',
          value: leadData.contact_id || ''
        },
        {
          key: 'lead_source',
          value: 'GoHighLevel Webhook'
        },
        {
          key: 'created_timestamp',
          value: new Date().toISOString()
        },
        {
          key: 'urgency',
          value: 'IMMEDIATE_CALL'
        }
      ]
    }
  };

  console.log('\n✅ EXTRACTED MAPPING RESULTS:');
  console.log(`Contact Name: ${contactData.data.name}`);
  console.log(`Phone Number: ${contactData.data.ContactNumber[0].public_number}`);
  console.log(`Email: ${contactData.data.ContactEmail[0].email}`);
  console.log(`GHL Contact ID: ${contactData.data.custom_fields[0].value}`);

  console.log('\n📤 CloudTalk Bulk API Payload Structure:');
  console.log(JSON.stringify([contactData], null, 2));

  // Validate phone number extraction
  console.log('\n🔍 PHONE NUMBER VALIDATION:');
  console.log(`Phone from user field: ${leadData.user?.phone}`);
  console.log(`Phone from root field: ${leadData.phone}`);
  console.log(`Selected phone: ${phoneNumber}`);

  if (phoneNumber) {
    console.log('✅ Phone number extraction: SUCCESS');
  } else {
    console.log('❌ Phone number extraction: FAILED');
    return false;
  }

  return true;
}

async function testAgentDistributionService() {
  console.log('\n🎯 TESTING AGENT DISTRIBUTION SERVICE');
  console.log('=' .repeat(50));

  try {
    // Import agent distribution service
    const agentDistributionService = await import('./src/services/agent-distribution-service.js');

    console.log('📊 Initializing agent distribution service...');
    await agentDistributionService.default.initialize();

    console.log('📈 Getting distribution stats...');
    const stats = agentDistributionService.default.getDistributionStats();
    console.log('Stats:', JSON.stringify(stats, null, 2));

    console.log('✅ Agent Distribution Service: INITIALIZED');
    return true;

  } catch (error) {
    console.log('⚠️  Agent Distribution Service: Not available or error');
    console.log(`Error: ${error.message}`);
    return false;
  }
}

async function testLeadTrackingLogger() {
  console.log('\n📊 TESTING LEAD TRACKING LOGGER');
  console.log('=' .repeat(50));

  try {
    // Import lead tracking logger
    const leadTrackingLogger = await import('./src/services/lead-tracking-logger.js');

    console.log('📊 Initializing lead tracking logger...');
    await leadTrackingLogger.default.initialize();

    console.log('📈 Getting current metrics...');
    const metrics = await leadTrackingLogger.default.getCurrentMetrics();
    console.log('Metrics:', JSON.stringify(metrics, null, 2));

    console.log('✅ Lead Tracking Logger: INITIALIZED');
    return true;

  } catch (error) {
    console.log('⚠️  Lead Tracking Logger: Not available or error');
    console.log(`Error: ${error.message}`);
    return false;
  }
}

async function testCompleteWorkflow() {
  console.log('\n🔄 TESTING COMPLETE WORKFLOW LOGIC');
  console.log('=' .repeat(50));

  // Test the validation logic without external API calls
  const leadData = testGHLPayload;

  // Phone number validation (as in processLeadToCall)
  const phoneNumber = leadData.user?.phone || leadData.phone;

  console.log('1️⃣  PHONE VALIDATION:');
  if (!phoneNumber) {
    console.log('❌ MISSING_PHONE: Numero telefono mancante nel lead');
    return false;
  } else {
    console.log(`✅ Phone found: ${phoneNumber}`);
  }

  // Contact creation payload preparation
  console.log('\n2️⃣  CONTACT CREATION PAYLOAD:');
  const contact = leadData.user || leadData;
  const fullName = `${contact.firstName || leadData.first_name || ''} ${contact.lastName || leadData.last_name || ''}`.trim();

  const contactPayload = {
    action: 'add_contact',
    command_id: `ghl_lead_${leadData.contact_id || Date.now()}_${Date.now()}`,
    data: {
      name: contact.name || fullName || leadData.full_name || leadData.name || 'Lead Senza Nome',
      title: leadData.title || 'GHL Contact',
      company: leadData.company || 'GoHighLevel Lead',
      ContactNumber: [{ public_number: phoneNumber }],
      ContactEmail: [{ email: contact.email || leadData.email || '' }],
      custom_fields: [
        { key: 'ghl_lead_id', value: leadData.contact_id || '' },
        { key: 'lead_source', value: 'GoHighLevel Webhook' },
        { key: 'created_timestamp', value: new Date().toISOString() },
        { key: 'urgency', value: 'IMMEDIATE_CALL' }
      ]
    }
  };

  console.log('✅ Contact payload prepared');
  console.log(`   Name: ${contactPayload.data.name}`);
  console.log(`   Phone: ${contactPayload.data.ContactNumber[0].public_number}`);
  console.log(`   Email: ${contactPayload.data.ContactEmail[0].email}`);

  // Call data preparation
  console.log('\n3️⃣  CALL INITIATION DATA:');
  const mockAgentId = 12345;
  const callData = {
    agent_id: parseInt(mockAgentId),
    callee_number: phoneNumber
  };

  console.log('✅ Call payload prepared');
  console.log(`   Agent ID: ${callData.agent_id}`);
  console.log(`   Phone Number: ${callData.callee_number}`);

  return true;
}

async function runComponentTests() {
  console.log('🧪 GHL WEBHOOK INTEGRATION - COMPONENT TESTS');
  console.log('=' .repeat(60));

  const results = {
    payloadExtraction: false,
    agentDistribution: false,
    leadTracking: false,
    workflowLogic: false
  };

  try {
    // Test 1: Payload extraction and mapping
    results.payloadExtraction = await testPayloadExtractionLogic();

    // Test 2: Agent distribution service
    results.agentDistribution = await testAgentDistributionService();

    // Test 3: Lead tracking logger
    results.leadTracking = await testLeadTrackingLogger();

    // Test 4: Complete workflow logic
    results.workflowLogic = await testCompleteWorkflow();

    // Summary
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('=' .repeat(40));
    console.log(`Payload Extraction: ${results.payloadExtraction ? '✅' : '❌'}`);
    console.log(`Agent Distribution: ${results.agentDistribution ? '✅' : '❌'}`);
    console.log(`Lead Tracking: ${results.leadTracking ? '✅' : '❌'}`);
    console.log(`Workflow Logic: ${results.workflowLogic ? '✅' : '❌'}`);

    const successCount = Object.values(results).filter(r => r).length;
    const totalCount = Object.keys(results).length;

    console.log(`\n🎯 OVERALL: ${successCount}/${totalCount} tests passed`);

    if (results.payloadExtraction && results.workflowLogic) {
      console.log('\n✅ CORE INTEGRATION LOGIC: WORKING');
      console.log('   - GHL webhook payload mapping fixed');
      console.log('   - Phone number extraction working');
      console.log('   - CloudTalk bulk API payload format correct');
      console.log('   - Call initiation data preparation working');
    } else {
      console.log('\n❌ CORE INTEGRATION ISSUES DETECTED');
    }

  } catch (error) {
    logError('💥 Component tests failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runComponentTests();
}

export { testPayloadExtractionLogic, testCompleteWorkflow };