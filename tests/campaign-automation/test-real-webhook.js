#!/usr/bin/env node

/**
 * Test con il payload webhook reale ricevuto
 * 
 * Payload reale:
 * {
 *   "call_uuid": "a1c968ff-86bf-4f22-b330-b2e2737bc439",
 *   "internal_number": 40312296109,
 *   "contact_id": 1452852917,
 *   "agent_id": 493933,
 *   "external_number": 393936815798,
 *   "# di tentativi di chiamata": null
 * }
 */

import { processCallEndedWebhook } from '../../src/services/cloudtalk-campaign-automation.js';
import { processCloudTalkWebhook } from '../../API Squadd/webhook-to-ghl-processor.js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '../../.env') });

/**
 * Payload webhook reale ricevuto
 */
const REAL_WEBHOOK_PAYLOAD = {
  "call_uuid": "a1c968ff-86bf-4f22-b330-b2e2737bc439",
  "internal_number": 40312296109,
  "contact_id": 1452852917,
  "agent_id": 493933,
  "external_number": 393936815798,
  "# di tentativi di chiamata": null
};

/**
 * Test Campaign Automation con payload reale
 */
async function testCampaignAutomationWithRealPayload() {
  console.log('🚀 TEST: Campaign Automation con Payload Webhook Reale');
  console.log('=' .repeat(70));
  
  console.log('📋 Payload webhook ricevuto:');
  console.log(JSON.stringify(REAL_WEBHOOK_PAYLOAD, null, 2));
  
  const correlationId = `real-webhook-test-${Date.now()}`;
  
  console.log(`\n🔗 Correlation ID: ${correlationId}`);
  console.log(`📞 External Number: ${REAL_WEBHOOK_PAYLOAD.external_number}`);
  console.log(`👤 Contact ID: ${REAL_WEBHOOK_PAYLOAD.contact_id}`);
  console.log(`🔧 Agent ID: ${REAL_WEBHOOK_PAYLOAD.agent_id}`);
  
  try {
    console.log('\n🔄 Processing Campaign Automation...');
    const result = await processCallEndedWebhook(REAL_WEBHOOK_PAYLOAD, correlationId);
    
    console.log('\n📊 RISULTATI CAMPAIGN AUTOMATION:');
    console.log(`Success: ${result.success}`);
    
    if (result.success) {
      console.log(`✅ SUCCESSO!`);
      console.log(`Contact: ${result.contact.name} (${result.contact.id})`);
      console.log(`Phone: ${result.contact.phone}`);
      console.log(`Attempts: ${result.attempts.previous} → ${result.attempts.new}`);
      console.log(`Duration: ${result.duration}ms`);
      
      if (result.tags) {
        console.log(`\nTag Changes:`);
        console.log(`- Removed: ${result.tags.removed || []}`);
        console.log(`- Added: ${result.tags.added || []}`);
        console.log(`- Final: ${result.tags.final || []}`);
      } else {
        console.log(`\n⚠️  No tag changes`);
      }
      
      return {
        campaignAutomation: { success: true, result },
        error: null
      };
    } else {
      console.log(`❌ FALLITO: ${result.reason}`);
      return {
        campaignAutomation: { success: false, reason: result.reason },
        error: null
      };
    }
    
  } catch (error) {
    console.error(`💥 ERROR: ${error.message}`);
    if (error.stack) {
      console.error('Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    
    return {
      campaignAutomation: { success: false, error: error.message },
      error: error.message
    };
  }
}

/**
 * Test GHL Integration con payload reale
 */
async function testGHLIntegrationWithRealPayload() {
  console.log('\n\n🚀 TEST: GHL Integration con Payload Reale');
  console.log('=' .repeat(70));
  
  console.log('📋 Testing GHL integration...');
  console.log(`📞 Cercando contatto per: ${REAL_WEBHOOK_PAYLOAD.external_number}`);
  console.log(`🌍 Location ID: ${process.env.GHL_LOCATION_ID}`);
  console.log(`🔑 API Key present: ${!!process.env.GHL_API_KEY}`);
  
  try {
    console.log('\n🔄 Processing GHL Integration...');
    const result = await processCloudTalkWebhook(REAL_WEBHOOK_PAYLOAD, 'call-ended');
    
    console.log('\n📊 RISULTATI GHL INTEGRATION:');
    console.log(`Success: ${result.success}`);
    
    if (result.success) {
      console.log(`✅ SUCCESSO!`);
      console.log(`Contact: ${result.contact.name} (${result.contact.id})`);
      console.log(`Phone: ${result.contact.phone}`);
      console.log(`Action: ${result.result?.action || 'N/A'}`);
      
      return {
        ghlIntegration: { success: true, result },
        error: null
      };
    } else {
      console.log(`❌ FALLITO: ${result.error || result.reason}`);
      return {
        ghlIntegration: { success: false, reason: result.error || result.reason },
        error: null
      };
    }
    
  } catch (error) {
    console.error(`💥 ERROR: ${error.message}`);
    
    return {
      ghlIntegration: { success: false, error: error.message },
      error: error.message
    };
  }
}

/**
 * Test completo - simula il flusso del webhook handler
 */
async function runCompleteWebhookTest() {
  console.log('🚀 CloudTalk Real Webhook Test Suite');
  console.log('Test Date:', new Date().toISOString());
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('\nTesting webhook payload formato reale CloudTalk');
  console.log(`External Number: ${REAL_WEBHOOK_PAYLOAD.external_number} (senza +)`);
  console.log(`Contact ID: ${REAL_WEBHOOK_PAYLOAD.contact_id}`);
  
  try {
    // 1. Test Campaign Automation (priorità alta)
    const campaignResult = await testCampaignAutomationWithRealPayload();
    
    // 2. Test GHL Integration (priorità bassa)
    const ghlResult = await testGHLIntegrationWithRealPayload();
    
    // 3. Risultati finali
    console.log('\n\n🏁 RISULTATI FINALI:');
    console.log('=' .repeat(70));
    
    console.log(`📊 Campaign Automation: ${campaignResult.campaignAutomation.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`📊 GHL Integration: ${ghlResult.ghlIntegration.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (campaignResult.error) {
      console.log(`🚨 Campaign Error: ${campaignResult.error}`);
    }
    
    if (ghlResult.error) {
      console.log(`🚨 GHL Error: ${ghlResult.error}`);
    }
    
    // Determine overall success
    const overallSuccess = campaignResult.campaignAutomation.success; // Priority to campaign automation
    
    console.log(`\n🎯 Overall Result: ${overallSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (overallSuccess) {
      console.log('\n🎉 Il webhook sarebbe stato processato correttamente in produzione!');
    } else {
      console.log('\n⚠️  Il webhook avrebbe fallito in produzione. Controlla gli errori sopra.');
    }
    
    return {
      success: overallSuccess,
      campaignAutomation: campaignResult.campaignAutomation,
      ghlIntegration: ghlResult.ghlIntegration
    };
    
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Esegui se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runCompleteWebhookTest()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

export { 
  runCompleteWebhookTest, 
  testCampaignAutomationWithRealPayload, 
  testGHLIntegrationWithRealPayload,
  REAL_WEBHOOK_PAYLOAD 
};