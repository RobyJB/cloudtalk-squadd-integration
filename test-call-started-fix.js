/**
 * Test per verificare il fix del bug "Call ID: undefined"
 * 
 * Simula webhook call-started SENZA call_id nel payload
 * per verificare che la nota GHL venga creata correttamente
 */

import 'dotenv/config';

const testPayloads = [
  {
    name: 'Payload SENZA call_id (bug originale)',
    payload: {
      external_number: '393513416607',
      agent_id: 493933,
      agent_first_name: 'Roberto',
      agent_last_name: 'Bondici',
      internal_number: 393520441984
    }
  },
  {
    name: 'Payload CON call_id',
    payload: {
      call_id: 1002345678,
      external_number: '393513416607',
      agent_id: 493933,
      agent_first_name: 'Roberto',
      agent_last_name: 'Bondici',
      call_uuid: 'test-uuid-123',
      internal_number: 393520441984
    }
  }
];

async function testCallStartedFix() {
  console.log('🧪 TEST: Fix per Call ID undefined in nota GHL\n');

  for (const test of testPayloads) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Payload:', JSON.stringify(test.payload, null, 2));

    try {
      const response = await fetch('http://localhost:3000/api/cloudtalk-webhooks/call-started', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TestCallStartedFix/1.0'
        },
        body: JSON.stringify(test.payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('\n✅ Webhook processato con successo!');
        console.log('📊 Risultato:', JSON.stringify(result, null, 2));

        // Verifica se la nota è stata creata
        if (result.result?.noteId) {
          console.log(`✅ Nota creata con ID: ${result.result.noteId}`);
        }

        // Verifica Call ID
        if (result.result?.callId) {
          console.log(`✅ Call ID gestito: ${result.result.callId}`);
        }

      } else {
        const error = await response.text();
        console.log(`❌ Errore: ${response.status} - ${error}`);
      }

    } catch (error) {
      console.log(`❌ Errore di connessione: ${error.message}`);
    }

    console.log('\n' + '─'.repeat(60));
  }

  console.log('\n🎯 Test completato!');
  console.log('\n💡 Verifica manuale in GoHighLevel:');
  console.log('   1. Apri contatto Roberto Bondici (+393513416607)');
  console.log('   2. Controlla le ultime note');
  console.log('   3. Verifica che "Call ID:" NON sia "undefined"');
  console.log('   4. Verifica che "Tipo:" NON sia "Non specificato"');
}

// Run test
testCallStartedFix().catch(console.error);
