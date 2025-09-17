#!/usr/bin/env node

import { processCallEndedWebhook, normalizePhone } from './src/services/cloudtalk-campaign-automation.js';

/**
 * Script di test per CloudTalk Campaign Automation
 * 
 * Simula il webhook call-ended con il payload reale ricevuto
 * e verifica il funzionamento della logica di incremento tentativi
 * e spostamento tra campagne.
 */

console.log('🧪 CloudTalk Campaign Automation - Test Script');
console.log('='.repeat(60));

// Payload reale dal webhook call-ended
const testWebhookPayload = {
  "call_uuid": "44fe27cd-5268-4670-993e-01293c9f8833",
  "internal_number": 40312296109,
  "contact_id": 1451646073,
  "agent_id": 493933,
  "external_number": 393513416607,
  "# di tentativi di chiamata": null
};

async function runTest() {
  try {
    console.log('\n📞 Test 1: Processo webhook call-ended');
    console.log('-'.repeat(40));
    
    console.log('📋 Payload di test:');
    console.log(JSON.stringify(testWebhookPayload, null, 2));
    
    const correlationId = testWebhookPayload.call_uuid;
    
    console.log('\n🚀 Avvio processamento...');
    
    const startTime = Date.now();
    const result = await processCallEndedWebhook(testWebhookPayload, correlationId);
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ Processamento completato in ${duration}ms`);
    console.log('📊 Risultato:');
    console.log(JSON.stringify(result, null, 2));
    
    // Analisi risultato
    if (result.success) {
      console.log(`\n🎯 SUCCESSO!`);
      if (result.contact) {
        console.log(`👤 Contatto processato: ${result.contact.name} (ID: ${result.contact.id})`);
        console.log(`📞 Telefono: ${result.contact.phone}`);
      }
      
      if (result.attempts) {
        console.log(`🔢 Tentativi: ${result.attempts.previous} → ${result.attempts.new}`);
        
        if (result.attempts.new === 3) {
          console.log(`📈 SOGLIA RAGGIUNTA: Pronto per spostamento a "Lead Recenti"`);
        } else if (result.attempts.new === 10) {
          console.log(`📈 SOGLIA RAGGIUNTA: Pronto per spostamento a "Mancata Risposta"`);
        }
      }
      
      if (result.campaign) {
        console.log(`🏷️ Spostamento campagna: ${result.campaign.source} → ${result.campaign.target}`);
      }
    } else {
      console.log(`\n⚠️ Processamento non completato: ${result.reason}`);
    }
    
  } catch (error) {
    console.error(`\n💥 Test fallito: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

async function testPhoneNormalization() {
  console.log('\n📞 Test 2: Normalizzazione numeri di telefono');
  console.log('-'.repeat(40));
  
  const testNumbers = [
    '393513416607',
    '+393513416607', 
    '39351341660',
    '3513416607',
    '0039393513416607',
    null,
    '',
    '1234567890'
  ];
  
  testNumbers.forEach(number => {
    const normalized = normalizePhone(number);
    console.log(`${String(number).padEnd(16)} → ${normalized}`);
  });
}

async function runAllTests() {
  try {
    await testPhoneNormalization();
    await runTest();
    
    console.log('\n🎉 Tutti i test completati con successo!');
    console.log('\n📝 Note:');
    console.log('- Se il contatto non viene trovato, è normale nel test');  
    console.log('- Per test completo, assicurati che il contatto +393513416607 esista in CloudTalk');
    console.log('- Controlla il file logs/cloudtalk-campaign-automation.log per log dettagliati');
    
  } catch (error) {
    console.error(`\n💥 Test fallito: ${error.message}`);
    process.exit(1);
  }
}

// Esegui i test
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export { testWebhookPayload };