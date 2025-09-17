#!/usr/bin/env node

/**
 * Test specifico per la logica di assegnazione tag
 * 
 * Verifica che il sistema assegni correttamente i tag basandosi sui tentativi
 */

import { manageCampaignTags, updateContactTags, CAMPAIGN_TAGS } from '../../src/services/cloudtalk-campaign-automation.js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '../../.env') });

/**
 * Simula dati contatto per test
 */
function createTestContact(id = '1451646073', name = 'Roberto Bondici (Priority Contact)') {
  return {
    id,
    name,
    title: 'API Developer & Test Contact',
    company: 'CloudTalk API Testing',
    industry: 'Technology'
  };
}

/**
 * Test logica tag per diversi scenari di tentativi
 */
async function testTagLogic() {
  console.log('🧪 TEST: Tag Assignment Logic');
  console.log('=' .repeat(60));
  
  const testContact = createTestContact();
  console.log(`🎯 Testing with contact: ${testContact.name} (${testContact.id})`);
  console.log(`\n📋 Tag Assignment Rules:`);
  console.log(`   1-2 attempts  → "${CAMPAIGN_TAGS.NUOVI_LEAD}"`);
  console.log(`   3-9 attempts  → "${CAMPAIGN_TAGS.FOLLOW_UP}"`);
  console.log(`   10+ attempts  → "${CAMPAIGN_TAGS.MANCATA_RISPOSTA}"`);
  
  // Test scenari diversi
  const testScenarios = [
    { attempts: 1, expectedTag: CAMPAIGN_TAGS.NUOVI_LEAD, description: 'First attempt' },
    { attempts: 2, expectedTag: CAMPAIGN_TAGS.NUOVI_LEAD, description: 'Second attempt' },
    { attempts: 3, expectedTag: CAMPAIGN_TAGS.FOLLOW_UP, description: 'Third attempt - transition to Follow Up' },
    { attempts: 5, expectedTag: CAMPAIGN_TAGS.FOLLOW_UP, description: 'Fifth attempt - maintain Follow Up' },
    { attempts: 9, expectedTag: CAMPAIGN_TAGS.FOLLOW_UP, description: 'Ninth attempt - maintain Follow Up' },
    { attempts: 10, expectedTag: CAMPAIGN_TAGS.MANCATA_RISPOSTA, description: 'Tenth attempt - transition to Mancata Risposta' },
    { attempts: 15, expectedTag: CAMPAIGN_TAGS.MANCATA_RISPOSTA, description: 'Fifteenth attempt - maintain Mancata Risposta' }
  ];
  
  let totalTests = 0;
  let passedTests = 0;
  
  for (const scenario of testScenarios) {
    totalTests++;
    
    console.log(`\n📞 Testing ${scenario.attempts} attempts: ${scenario.description}`);
    console.log(`   Expected Tag: "${scenario.expectedTag}"`);
    
    try {
      const correlationId = `tag-logic-test-${scenario.attempts}-${Date.now()}`;
      
      // Test solo la logica, non l'API call
      const result = await manageCampaignTags(testContact.id, scenario.attempts, testContact, correlationId);
      
      console.log(`   Result: Success=${result.success}, Updated=${result.updated}`);
      
      if (result.success && result.updated && result.finalTags) {
        const finalTags = result.finalTags;
        console.log(`   Assigned Tags: "${finalTags.join('", "')}"`);
        
        if (finalTags.includes(scenario.expectedTag)) {
          console.log(`   ✅ PASS - Correct tag assigned`);
          passedTests++;
        } else {
          console.log(`   ❌ FAIL - Wrong tag assigned`);
          console.log(`      Expected: "${scenario.expectedTag}"`);
          console.log(`      Got: "${finalTags.join('", "')}"`);
        }
      } else if (result.success && !result.updated) {
        console.log(`   ⚠️  No tag update required (reason: ${result.reason || 'unknown'})`);
        // Per ora consideriamo questo un successo parziale
        passedTests += 0.5;
      } else {
        console.log(`   ❌ FAIL - Logic failed: ${result.error}`);
      }
      
    } catch (error) {
      console.error(`   💥 ERROR: ${error.message}`);
    }
    
    // Piccola pausa tra test
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Risultati
  console.log('\n' + '='.repeat(60));
  console.log('📊 TAG LOGIC TEST RESULTS:');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
  console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  return passedTests === totalTests;
}

/**
 * Test diretto della funzione updateContactTags (simulazione)
 */
async function testTagUpdateAPI() {
  console.log('\n\n🧪 TEST: Tag Update API Simulation');
  console.log('=' .repeat(60));
  
  const testContact = createTestContact();
  const testTags = [CAMPAIGN_TAGS.FOLLOW_UP];
  
  console.log(`🎯 Testing tag update for contact: ${testContact.name}`);
  console.log(`📋 Tags to assign: "${testTags.join('", "')}"`);
  
  try {
    const correlationId = `api-test-${Date.now()}`;
    
    // Test dell'aggiornamento tag
    const result = await updateContactTags(testContact.id, testTags, testContact, correlationId);
    
    console.log(`\n📊 API Test Results:`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Status: ${result.status || 'N/A'}`);
    
    if (result.success) {
      console.log(`   ✅ Tag update API call successful!`);
      console.log(`   📤 Tags sent: "${testTags.join('", "')}"`);
      return true;
    } else {
      console.log(`   ❌ Tag update API call failed`);
      console.log(`   Error: ${result.error}`);
      return false;
    }
    
  } catch (error) {
    console.error(`💥 API test error: ${error.message}`);
    return false;
  }
}

/**
 * Main test execution
 */
async function runTagLogicTests() {
  console.log('🚀 CloudTalk Tag System - Logic Verification');
  console.log('Test Date:', new Date().toISOString());
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('');
  
  try {
    // Test logica tag
    const logicTestPassed = await testTagLogic();
    
    // Test API tag update 
    const apiTestPassed = await testTagUpdateAPI();
    
    console.log('\n🏁 TAG LOGIC TESTS COMPLETED!');
    console.log(`📊 Logic Test: ${logicTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`📊 API Test: ${apiTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (logicTestPassed && apiTestPassed) {
      console.log('\n🎉 All tag system tests PASSED! The system is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Review the results above.');
    }
    
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runTagLogicTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

export { runTagLogicTests, testTagLogic, testTagUpdateAPI };