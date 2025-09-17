#!/usr/bin/env node

import { processCallEndedWebhook } from './src/services/cloudtalk-campaign-automation.js';

/**
 * Test delle soglie di spostamento campagne
 * 
 * Simula più webhook call-ended per testare:
 * - Incremento progressivo tentativi
 * - Trigger soglia 3 tentativi → Lead Recenti
 * - Trigger soglia 10 tentativi → Mancata Risposta
 */

console.log('🎯 CloudTalk Campaign Thresholds - Test Script');
console.log('='.repeat(60));

// Payload base del webhook
const basePayload = {
  "internal_number": 40312296109,
  "contact_id": 1451646073,
  "agent_id": 493933,
  "external_number": 393513416607,
  "# di tentativi di chiamata": null
};

async function simulateCallEndedWebhook(callNumber) {
  console.log(`\n📞 Chiamata ${callNumber} - Simulazione webhook call-ended`);
  console.log('-'.repeat(50));
  
  // Genera payload unico per ogni chiamata
  const payload = {
    ...basePayload,
    call_uuid: `call-${callNumber}-${Date.now()}`,
    timestamp: new Date().toISOString()
  };
  
  const correlationId = payload.call_uuid;
  
  try {
    const startTime = Date.now();
    const result = await processCallEndedWebhook(payload, correlationId);
    const duration = Date.now() - startTime;
    
    console.log(`⏱️  Processamento completato in ${duration}ms`);
    
    if (result.success && result.contact) {
      console.log(`👤 Contatto: ${result.contact.name}`);
      console.log(`🔢 Tentativi: ${result.attempts.previous} → ${result.attempts.new}`);
      
      if (result.campaign) {
        console.log(`📈 🎉 SOGLIA RAGGIUNTA!`);
        console.log(`🏷️  Spostamento campagna: ${result.campaign.source} → ${result.campaign.target}`);
      } else if (result.attempts.new === 3) {
        console.log(`⚡ PROSSIMA SOGLIA: A 3 tentativi si sposterà in "Lead Recenti"`);
      } else if (result.attempts.new === 10) {
        console.log(`⚡ PROSSIMA SOGLIA: A 10 tentativi si sposterà in "Mancata Risposta"`);
      }
      
      return result.attempts.new;
    } else {
      console.log(`⚠️  Risultato: ${result.reason || 'Processamento non completato'}`);
      return 0;
    }
    
  } catch (error) {
    console.error(`❌ Errore chiamata ${callNumber}: ${error.message}`);
    return 0;
  }
}

async function runThresholdTests() {
  console.log('\n🚀 Avvio test progressivo delle soglie...\n');
  
  const maxCalls = 12; // Test oltre la soglia 10
  let currentAttempts = 0;
  
  for (let i = 1; i <= maxCalls; i++) {
    currentAttempts = await simulateCallEndedWebhook(i);
    
    if (currentAttempts === 0) {
      console.log(`\n❌ Test interrotto alla chiamata ${i}`);
      break;
    }
    
    // Analizza soglie raggiunte
    if (currentAttempts === 3) {
      console.log(`\n🎯 SOGLIA 3 RAGGIUNTA! Il contatto dovrebbe essere spostato in "Lead Recenti"`);
    } else if (currentAttempts === 10) {
      console.log(`\n🎯 SOGLIA 10 RAGGIUNTA! Il contatto dovrebbe essere spostato in "Mancata Risposta"`);
    }
    
    // Pausa tra le chiamate per simulazione realistica
    if (i < maxCalls) {
      console.log(`\n⏳ Pausa 1 secondo prima della prossima chiamata...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n🏁 Test completato con ${currentAttempts} tentativi totali`);
  console.log('\n📊 Riepilogo soglie:');
  console.log(`   • 1-2 tentativi: Rimane in campagna attuale`);
  console.log(`   • 3 tentativi: Spostamento a "Lead Recenti" ✓`);
  console.log(`   • 4-9 tentativi: Rimane in "Lead Recenti"`);
  console.log(`   • 10+ tentativi: Spostamento a "Mancata Risposta" ✓`);
  
  console.log('\n📋 Per verificare i risultati:');
  console.log(`   • Controlla CloudTalk per vedere gli aggiornamenti del campo custom`);
  console.log(`   • Log dettagliati in: logs/cloudtalk-campaign-automation.log`);
}

// Esegui il test
if (import.meta.url === `file://${process.argv[1]}`) {
  runThresholdTests().catch(error => {
    console.error('💥 Test fallito:', error.message);
    process.exit(1);
  });
}

export { simulateCallEndedWebhook };