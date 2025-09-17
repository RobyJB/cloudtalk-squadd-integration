#!/usr/bin/env node

/**
 * Test incrementale per monitorare i cambi di tag su CloudTalk
 * 
 * Simula webhook multipli in sequenza per il numero +393513416607
 * Mostra il progresso dei tag da 5 tentativi fino a 15
 */

import { processCallEndedWebhook } from '../../src/services/cloudtalk-campaign-automation.js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '../../.env') });

/**
 * Configurazione test
 */
const TEST_CONFIG = {
  phoneNumber: '+393513416607', // Il tuo numero di test
  startAttempts: 5, // Attuale numero tentativi
  endAttempts: 15,  // Target finale
  delayBetweenCalls: 3000 // 3 secondi tra ogni chiamata per monitorare
};

/**
 * Simula webhook call-ended
 */
function createWebhookPayload(phoneNumber, attempt) {
  return {
    external_number: phoneNumber,
    call_ended: true,
    event: 'call-ended',
    timestamp: new Date().toISOString(),
    call_uuid: `incremental-test-${attempt}-${Date.now()}`,
    duration: Math.floor(Math.random() * 120) + 30, // Durata random 30-150 sec
    call_type: 'outbound',
    agent_id: 'test-agent-001'
  };
}

/**
 * Mostra status attuale e previsto
 */
function showExpectedTagStatus(currentAttempts, newAttempts) {
  console.log(`\n📊 TAG PREDICTION:`);
  
  // Tag attuale (basato su tentativi correnti)
  let currentTag = '';
  if (currentAttempts >= 1 && currentAttempts <= 2) {
    currentTag = 'Nuovi Lead';
  } else if (currentAttempts >= 3 && currentAttempts <= 9) {
    currentTag = 'Follow Up';
  } else if (currentAttempts >= 10) {
    currentTag = 'Mancata Risposta';
  }
  
  // Tag nuovo (basato su nuovi tentativi)
  let newTag = '';
  if (newAttempts >= 1 && newAttempts <= 2) {
    newTag = 'Nuovi Lead';
  } else if (newAttempts >= 3 && newAttempts <= 9) {
    newTag = 'Follow Up';
  } else if (newAttempts >= 10) {
    newTag = 'Mancata Risposta';
  }
  
  console.log(`   Current (${currentAttempts} attempts): "${currentTag}"`);
  console.log(`   After   (${newAttempts} attempts): "${newTag}"`);
  
  if (currentTag !== newTag) {
    console.log(`   🔄 TAG CHANGE EXPECTED: "${currentTag}" → "${newTag}"`);
  } else {
    console.log(`   ➡️  NO TAG CHANGE: Staying "${currentTag}"`);
  }
}

/**
 * Test incrementale principale
 */
async function runIncrementalTagTest() {
  console.log('🚀 CloudTalk Incremental Tag Test - Real Time Monitoring');
  console.log('=' .repeat(70));
  console.log(`📱 Phone: ${TEST_CONFIG.phoneNumber}`);
  console.log(`🎯 Target: ${TEST_CONFIG.startAttempts} → ${TEST_CONFIG.endAttempts} attempts`);
  console.log(`⏱️  Delay: ${TEST_CONFIG.delayBetweenCalls}ms between calls`);
  console.log(`🔍 Monitor CloudTalk interface for real-time tag changes!`);
  console.log('');
  
  let currentAttempt = TEST_CONFIG.startAttempts;
  let totalWebhooks = 0;
  let successfulWebhooks = 0;
  let tagChanges = [];
  
  while (currentAttempt < TEST_CONFIG.endAttempts) {
    totalWebhooks++;
    const nextAttempt = currentAttempt + 1;
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📞 WEBHOOK ${totalWebhooks}: Simulating call #${nextAttempt}`);
    console.log(`📅 ${new Date().toLocaleTimeString()}`);
    
    // Mostra previsione tag
    showExpectedTagStatus(currentAttempt, nextAttempt);
    
    try {
      const webhookPayload = createWebhookPayload(TEST_CONFIG.phoneNumber, nextAttempt);
      const correlationId = `incremental-${nextAttempt}-${Date.now()}`;
      
      console.log(`\n🔄 Processing webhook...`);
      const result = await processCallEndedWebhook(webhookPayload, correlationId);
      
      if (result.success) {
        successfulWebhooks++;
        currentAttempt = result.attempts.new;
        
        console.log(`✅ SUCCESS!`);
        console.log(`   Contact: ${result.contact.name} (${result.contact.id})`);
        console.log(`   Attempts: ${result.attempts.previous} → ${result.attempts.new}`);
        console.log(`   Duration: ${result.duration}ms`);
        
        // Verifica tag changes
        if (result.tags) {
          console.log(`\n🏷️  TAG UPDATE DETECTED:`);
          if (result.tags.removed && result.tags.removed.length > 0) {
            console.log(`   📤 Removed: "${result.tags.removed.join('", "')}"`);
          }
          if (result.tags.added && result.tags.added.length > 0) {
            console.log(`   📥 Added: "${result.tags.added.join('", "')}"`);
          }
          console.log(`   🎯 Current Tags: "${result.tags.final.join('", "')}"`);
          
          tagChanges.push({
            attempt: nextAttempt,
            removed: result.tags.removed || [],
            added: result.tags.added || [],
            final: result.tags.final || []
          });
          
          console.log(`\n🔍 CHECK CLOUDTALK NOW! Tag should be updated to: "${result.tags.final.join('", "')}"`);
        } else {
          console.log(`\n⚠️  No tag changes (same category)`);
        }
        
      } else {
        console.log(`❌ FAILED: ${result.reason || result.error}`);
        break;
      }
      
    } catch (error) {
      console.error(`💥 ERROR: ${error.message}`);
      break;
    }
    
    // Pausa prima del prossimo webhook
    if (currentAttempt < TEST_CONFIG.endAttempts) {
      console.log(`\n⏳ Waiting ${TEST_CONFIG.delayBetweenCalls/1000}s before next call...`);
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delayBetweenCalls));
    }
  }
  
  // Risultati finali
  console.log(`\n${'='.repeat(70)}`);
  console.log('🏁 INCREMENTAL TEST COMPLETED!');
  console.log(`📊 Summary:`);
  console.log(`   Total Webhooks: ${totalWebhooks}`);
  console.log(`   Successful: ${successfulWebhooks}`);
  console.log(`   Final Attempts: ${currentAttempt}`);
  console.log(`   Tag Changes: ${tagChanges.length}`);
  
  if (tagChanges.length > 0) {
    console.log(`\n🏷️  TAG CHANGE HISTORY:`);
    tagChanges.forEach((change, index) => {
      console.log(`   ${index + 1}. Attempt ${change.attempt}:`);
      if (change.removed.length > 0) {
        console.log(`      - Removed: "${change.removed.join('", "')}"`);
      }
      if (change.added.length > 0) {
        console.log(`      - Added: "${change.added.join('", "')}"`);
      }
      console.log(`      - Result: "${change.final.join('", "')}"`);
    });
  }
  
  console.log(`\n🔍 Final check: Look at CloudTalk contact ${TEST_CONFIG.phoneNumber}`);
  console.log(`   Expected tag for ${currentAttempt} attempts: ${getExpectedTag(currentAttempt)}`);
}

/**
 * Helper per determinare tag atteso
 */
function getExpectedTag(attempts) {
  if (attempts >= 1 && attempts <= 2) {
    return 'Nuovi Lead';
  } else if (attempts >= 3 && attempts <= 9) {
    return 'Follow Up';
  } else if (attempts >= 10) {
    return 'Mancata Risposta';
  }
  return 'Unknown';
}

/**
 * Test rapido per una transizione specifica
 */
async function testSpecificTransition() {
  console.log('\n\n🎯 QUICK TEST: Specific transition to "Mancata Risposta"');
  console.log('=' .repeat(50));
  
  console.log('This will test the transition from 9 → 10 attempts (Follow Up → Mancata Risposta)');
  console.log('🔍 Watch CloudTalk for the tag change!');
  
  // Simula webhook per il 10° tentativo
  const webhookPayload = createWebhookPayload(TEST_CONFIG.phoneNumber, 10);
  const correlationId = `transition-test-${Date.now()}`;
  
  try {
    const result = await processCallEndedWebhook(webhookPayload, correlationId);
    
    if (result.success && result.tags) {
      console.log(`\n✅ Transition successful!`);
      console.log(`   Final Tags: "${result.tags.final.join('", "')}"`);
      console.log(`   🎉 Should now show "Mancata Risposta" in CloudTalk!`);
    }
  } catch (error) {
    console.error(`❌ Transition test failed:`, error.message);
  }
}

// Esegui test se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runIncrementalTagTest()
    .then(() => {
      console.log('\n👋 Test completed! Check your CloudTalk interface.');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

export { runIncrementalTagTest, testSpecificTransition };