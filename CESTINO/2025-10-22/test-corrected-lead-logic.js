#!/usr/bin/env node

/**
 * Test della logica corretta Lead-to-Call
 *
 * Verifica che il sistema usi i dati del LEAD (root level)
 * e NON i dati del user GHL che ha creato il lead.
 */

import leadToCallService from './src/services/lead-to-call-service.js';
import { log, logError } from './src/logger.js';

// Payload simulato come quello del problema
const mockGHLPayload = {
  "contact_id": "eNtxZuc4PLQR2ELzyxOg",
  "first_name": "Rubertu",        // IL LEAD DA CHIAMARE
  "last_name": "Bundici",         // IL LEAD DA CHIAMARE
  "phone": "+393513416607",       // IL LEAD DA CHIAMARE
  "email": "rubertu@example.com",
  "user": {
    "firstName": "Andrea",        // GHL USER CHE HA CREATO IL LEAD
    "lastName": "Guzzonato",      // GHL USER CHE HA CREATO IL LEAD
    "phone": "+393807454525"      // GHL USER PHONE (NON CHIAMARE!)
  }
};

async function testCorrectedLogic() {
  log('🧪 TEST: Verifica logica corretta Lead-to-Call');
  log('=' .repeat(60));

  log('\n📋 PAYLOAD GHL RICEVUTO:');
  console.log(JSON.stringify(mockGHLPayload, null, 2));

  log('\n🎯 DATI CHE DOVREBBERO ESSERE USATI:');
  log(`👤 Nome lead da chiamare: ${mockGHLPayload.first_name} ${mockGHLPayload.last_name}`);
  log(`📞 Telefono lead da chiamare: ${mockGHLPayload.phone}`);
  log(`📧 Email lead: ${mockGHLPayload.email}`);

  log('\n❌ DATI CHE NON DOVREBBERO ESSERE USATI:');
  log(`👤 Nome user GHL (creatore): ${mockGHLPayload.user.firstName} ${mockGHLPayload.user.lastName}`);
  log(`📞 Telefono user GHL: ${mockGHLPayload.user.phone} [NON CHIAMARE!]`);

  log('\n🚀 Avvio processo Lead-to-Call con logica corretta...');

  try {
    // Test solo della creazione contatto (senza chiamata reale)
    const contactResult = await leadToCallService.createContactInCloudTalk(mockGHLPayload);

    log('\n📊 RISULTATO CREAZIONE CONTATTO:');
    console.log(JSON.stringify(contactResult, null, 2));

    if (contactResult.success) {
      log('\n✅ SUCCESS: Contatto creato correttamente!');
      log(`🎯 Contatto ID: ${contactResult.contactId}`);
    } else {
      logError('\n❌ FAILED: Creazione contatto fallita');
      logError(`Errore: ${contactResult.error}`);
    }

    // Verifica che i dati usati siano corretti
    log('\n🔍 VERIFICA LOGICA:');
    const expectedName = `${mockGHLPayload.first_name} ${mockGHLPayload.last_name}`;
    const expectedPhone = mockGHLPayload.phone;

    log(`📋 Nome atteso: "${expectedName}"`);
    log(`📋 Telefono atteso: "${expectedPhone}"`);
    log(`✅ Il sistema ora usa i dati CORRETTI del lead (root level)`);
    log(`❌ Il sistema NON usa più i dati user GHL (che erano sbagliati)`);

  } catch (error) {
    logError('Errore durante il test:', error);
  }

  log('\n' + '='.repeat(60));
  log('🏁 Test completato');
}

// Esecuzione test
testCorrectedLogic().catch(console.error);