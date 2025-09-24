#!/usr/bin/env node

/**
 * Test dell'endpoint webhook GHL new-contact con logica corretta
 */

import fetch from 'node-fetch';
import { log } from './src/logger.js';

// Payload reale del problema
const testPayload = {
  "contact_id": "eNtxZuc4PLQR2ELzyxOg",
  "first_name": "Rubertu",        // THE LEAD TO CALL
  "last_name": "Bundici",         // THE LEAD TO CALL
  "phone": "+393513416607",       // THE LEAD TO CALL
  "email": "rubertu@example.com",
  "user": {
    "firstName": "Andrea",        // GHL USER WHO CREATED THE LEAD
    "lastName": "Guzzonato",      // GHL USER WHO CREATED THE LEAD
    "phone": "+393807454525"      // GHL USER PHONE (NOT TO CALL)
  }
};

async function testWebhookEndpoint() {
  log('🧪 TEST: Webhook GHL new-contact con logica corretta');
  log('=' .repeat(60));

  try {
    const response = await fetch('http://localhost:3000/api/ghl-webhooks/new-contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();

    log('\n📊 RISPOSTA WEBHOOK:');
    console.log(JSON.stringify(result, null, 2));

    log(`\n📈 Status: ${response.status}`);

    if (response.ok) {
      log('✅ Webhook processato correttamente');
    } else {
      log('⚠️  Webhook restituito con errore (atteso se CloudTalk non configurato)');
    }

    log('\n🎯 VERIFICA: Il sistema ora dovrebbe chiamare Rubertu Bundici (+393513416607)');
    log('❌ NON dovrebbe più chiamare Andrea Guzzonato (+393807454525)');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('⚠️  Server non in esecuzione. Avvia con: npm start');
    } else {
      console.error('Errore:', error);
    }
  }
}

testWebhookEndpoint();