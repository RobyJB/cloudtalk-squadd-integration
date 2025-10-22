import { getCallDetails } from './API CloudTalk/GET/get-call-details.js';

/**
 * Test per verificare che possiamo estrarre agent_id da una call_id
 * usando la struttura call_steps
 */

async function testAgentIdExtraction() {
  console.log('🧪 Test: Estrazione agent_id da call_id\n');

  // Usa una call_id recente dal payload (1017524047 dal messaggio utente)
  const testCallId = 1017524047;

  try {
    console.log(`📞 Recupero dettagli chiamata ${testCallId}...\n`);

    const callDetails = await getCallDetails(testCallId);

    console.log('\n📋 Struttura completa call_steps:');
    console.log(JSON.stringify(callDetails?.call_steps, null, 2));

    // Estrazione agent_id (stesso codice del fix)
    const agentStep = callDetails?.call_steps?.find(step => step.type === 'agent');

    if (agentStep?.id) {
      console.log('\n✅ SUCCESS! agent_id estratto:');
      console.log(`   ID: ${agentStep.id}`);
      console.log(`   Name: ${agentStep.name || 'N/A'}`);
      console.log(`   Type: ${agentStep.type}`);

      // Mostra tutti i campi dell'agentStep
      console.log('\n📊 Campi completi agentStep:');
      console.log(JSON.stringify(agentStep, null, 2));
    } else {
      console.log('\n❌ FAIL: agent_id NON trovato');
      console.log('Possibili cause:');
      console.log('  - Nessun agent coinvolto (chiamata diretta a IVR/segreteria)');
      console.log('  - Struttura call_steps diversa dal previsto');
    }

    // Info aggiuntive utili
    console.log('\n📊 Info chiamata:');
    console.log(`   Direction: ${callDetails?.direction}`);
    console.log(`   Status: ${callDetails?.status}`);
    console.log(`   Type: ${callDetails?.type}`);
    console.log(`   Duration: ${callDetails?.call_times?.total_time}s`);

  } catch (error) {
    console.error('\n💥 ERRORE:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAgentIdExtraction();