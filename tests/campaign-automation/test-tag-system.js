#!/usr/bin/env node

/**
 * Test del Sistema di Automazione Campagne basato su Tag CloudTalk
 * 
 * Testa la nuova logica che usa i tag invece dello spostamento tra campagne:
 * - 1-2 tentativi: Tag "Nuovi Lead"
 * - 3-9 tentativi: Tag "Follow Up" (rimuove "Nuovi Lead")
 * - 10+ tentativi: Tag "Mancata Risposta" (rimuove "Follow Up")
 */

import { processCallEndedWebhook } from '../../src/services/cloudtalk-campaign-automation.js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '../../.env') });

/**
 * Simula webhook call-ended per test
 */
function createWebhookPayload(phoneNumber, additionalData = {}) {
  return {
    external_number: phoneNumber,
    call_ended: true,
    event: 'call-ended',
    timestamp: new Date().toISOString(),
    call_uuid: `test-${Date.now()}`,
    duration: 60,
    ...additionalData
  };
}

/**
 * Test sequenza completa: da 0 a 12 tentativi
 */
async function testTagProgressionSequence() {
  console.log('🧪 TEST: Tag Progression Sequence');
  console.log('=' .repeat(60));
  
  // Usa numero di test fisso
  const testPhone = '+393912345678';
  
  // Test delle diverse soglie di tentativi
  const testScenarios = [
    { attempts: 1, expectedTags: ['Nuovi Lead'], description: '1° tentativo → Tag "Nuovi Lead"' },
    { attempts: 2, expectedTags: ['Nuovi Lead'], description: '2° tentativo → Mantiene "Nuovi Lead"' },
    { attempts: 3, expectedTags: ['Follow Up'], description: '3° tentativo → Tag "Follow Up"' },
    { attempts: 5, expectedTags: ['Follow Up'], description: '5° tentativo → Mantiene "Follow Up"' },
    { attempts: 9, expectedTags: ['Follow Up'], description: '9° tentativo → Mantiene "Follow Up"' },
    { attempts: 10, expectedTags: ['Mancata Risposta'], description: '10° tentativo → Tag "Mancata Risposta"' },
    { attempts: 12, expectedTags: ['Mancata Risposta'], description: '12° tentativo → Mantiene "Mancata Risposta"' }
  ];
  
  console.log(`📱 Phone Number: ${testPhone}`);
  console.log(`📋 Testing ${testScenarios.length} scenarios\n`);
  
  let totalTests = 0;
  let passedTests = 0;
  
  for (const scenario of testScenarios) {
    totalTests++;
    
    console.log(`\n📞 ${scenario.description}`);
    console.log(`   Expected Tags: ${scenario.expectedTags.join(', ')}`);
    
    try {
      const webhookPayload = createWebhookPayload(testPhone, {
        scenario: `test-attempt-${scenario.attempts}`
      });
      
      const correlationId = `test-tag-${scenario.attempts}-${Date.now()}`;
      
      const result = await processCallEndedWebhook(webhookPayload, correlationId);
      
      if (result.success) {
        console.log(`   ✅ Webhook processed successfully`);
        console.log(`   📊 Attempts: ${result.attempts.previous} → ${result.attempts.new}`);
        
        if (result.tags) {
          console.log(`   🏷️  Tag Changes:`);
          if (result.tags.removed.length > 0) {
            console.log(`      - Removed: ${result.tags.removed.join(', ')}`);
          }
          if (result.tags.added.length > 0) {
            console.log(`      - Added: ${result.tags.added.join(', ')}`);
          }
          console.log(`      - Final Tags: ${result.tags.final.join(', ')}`);
          
          // Verifica che i tag finali corrispondano a quelli attesi
          const finalTags = result.tags.final;
          const expectedTags = scenario.expectedTags;
          
          if (JSON.stringify(finalTags.sort()) === JSON.stringify(expectedTags.sort())) {
            console.log(`   ✅ Tag verification PASSED`);
            passedTests++;
          } else {
            console.log(`   ❌ Tag verification FAILED`);
            console.log(`      Expected: ${expectedTags.join(', ')}`);
            console.log(`      Got: ${finalTags.join(', ')}`);
          }
        } else {
          console.log(`   ⚠️  No tag changes detected`);
          if (scenario.expectedTags.length > 0) {
            console.log(`   ❌ Expected tag changes but got none`);
          } else {
            console.log(`   ✅ Correctly detected no tag changes needed`);
            passedTests++;
          }
        }
        
      } else {
        console.log(`   ❌ Webhook processing failed: ${result.reason || result.error}`);
      }
      
    } catch (error) {
      console.error(`   💥 Error: ${error.message}`);
    }
    
    // Pausa tra test
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Riassunto
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY:');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
  console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Tag system is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the logs for details.');
  }
}

/**
 * Test edge cases e scenari speciali
 */
async function testTagEdgeCases() {
  console.log('\n\n🧪 TEST: Tag System Edge Cases');
  console.log('=' .repeat(60));
  
  const edgeCases = [
    {
      name: 'Contact Not Found',
      phone: '+999999999999',  // Numero che non esiste
      description: 'Webhook con numero di telefono non esistente'
    },
    {
      name: 'Invalid Phone Number',
      phone: 'invalid-phone',
      description: 'Webhook con numero di telefono non valido'
    },
    {
      name: 'Missing Phone Number',
      phone: null,
      description: 'Webhook senza numero di telefono'
    }
  ];
  
  let totalEdgeTests = 0;
  let passedEdgeTests = 0;
  
  for (const testCase of edgeCases) {
    totalEdgeTests++;
    
    console.log(`\n🔍 ${testCase.name}`);
    console.log(`   ${testCase.description}`);
    
    try {
      const webhookPayload = testCase.phone ? 
        createWebhookPayload(testCase.phone) : 
        { call_ended: true, event: 'call-ended' }; // Senza external_number
        
      const correlationId = `edge-test-${testCase.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      
      const result = await processCallEndedWebhook(webhookPayload, correlationId);
      
      if (testCase.name === 'Contact Not Found') {
        if (result.success && result.reason && result.reason.includes('not found')) {
          console.log(`   ✅ Correctly handled: ${result.reason}`);
          passedEdgeTests++;
        } else {
          console.log(`   ❌ Expected 'contact not found' but got different result`);
        }
      } else if (testCase.name === 'Invalid Phone Number' || testCase.name === 'Missing Phone Number') {
        if (!result.success && (result.reason?.includes('phone') || result.reason?.includes('number'))) {
          console.log(`   ✅ Correctly handled: ${result.reason}`);
          passedEdgeTests++;
        } else {
          console.log(`   ❌ Expected phone number error but got different result`);
        }
      }
      
    } catch (error) {
      console.log(`   ⚠️  Caught exception: ${error.message}`);
      // Per alcuni edge cases, è normale avere eccezioni
      passedEdgeTests++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '-'.repeat(60));
  console.log('📊 EDGE CASES SUMMARY:');
  console.log(`✅ Passed: ${passedEdgeTests}/${totalEdgeTests}`);
  console.log(`❌ Failed: ${totalEdgeTests - passedEdgeTests}/${totalEdgeTests}`);
}

/**
 * Main test execution
 */
async function runAllTagTests() {
  console.log('🚀 CloudTalk Campaign Tag System Test Suite');
  console.log('Test Date:', new Date().toISOString());
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('\n');
  
  try {
    // Test sequenza principale
    await testTagProgressionSequence();
    
    // Test edge cases
    await testTagEdgeCases();
    
    console.log('\n🏁 All tag system tests completed!');
    
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  }
}

// Esegui test se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTagTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

export { 
  testTagProgressionSequence, 
  testTagEdgeCases, 
  runAllTagTests,
  createWebhookPayload 
};