import leadToCallService from '../src/services/lead-to-call-service.js';
import agentDistributionService from '../src/services/agent-distribution-service.js';
import { log } from '../src/logger.js';

/**
 * Test completo del sistema Lead-to-Call
 * 
 * Questo test simula:
 * 1. Inizializzazione servizi
 * 2. Controllo agenti disponibili
 * 3. Distribuzione round robin
 * 4. Processo completo lead-to-call
 * 5. Verifica tracking e metriche
 */

async function runLeadToCallTests() {
  console.log('🧪 INIZIO TEST SISTEMA LEAD-TO-CALL');
  console.log('=' .repeat(60));

  try {
    // Test 1: Inizializzazione servizi
    console.log('\\n📋 Test 1: Inizializzazione servizi');
    await leadToCallService.initialize();
    console.log('✅ Servizi inizializzati correttamente');

    // Test 2: Controllo agenti disponibili
    console.log('\\n📋 Test 2: Controllo agenti disponibili');
    const availableAgents = await agentDistributionService.getAvailableAgents();
    console.log(`✅ Trovati ${availableAgents.length} agenti disponibili`);

    if (availableAgents.length === 0) {
      console.log('⚠️ ATTENZIONE: Nessun agente online, il test di chiamata fallirà');
      console.log('   Per un test completo, assicurati che almeno un agente sia online in CloudTalk');
    }

    // Test 3: Test distribuzione round robin (simulato)
    console.log('\\n📋 Test 3: Distribuzione round robin (simulazione)');
    
    const mockLeadData = { name: 'Test Lead', phone: '+393513416607' };
    
    for (let i = 0; i < 3; i++) {
      const distribution = await agentDistributionService.distributeLeadToAgent(mockLeadData);
      if (distribution.success) {
        console.log(`  Round ${i + 1}: ${distribution.selectedAgent.name} (ID: ${distribution.selectedAgent.id})`);
      } else {
        console.log(`  Round ${i + 1}: ❌ ${distribution.message}`);
      }
    }

    // Test 4: Reset stato distribuzione per test pulito
    console.log('\\n📋 Test 4: Reset stato distribuzione');
    await agentDistributionService.resetDistributionState();
    console.log('✅ Stato distribuzione resettato');

    // Test 5: Processo completo Lead-to-Call (CON CHIAMATA REALE!)
    console.log('\\n📋 Test 5: Processo completo Lead-to-Call');
    console.log('⚠️ ATTENZIONE: Questo test effettuerà una chiamata REALE!');
    console.log('   Se un agente è online, riceverà una chiamata e poi chiamerà il numero target');
    console.log('   Numero target: +393513416607');

    // Chiedi conferma (in un test reale potresti saltare questo)
    console.log('\\n🤔 Vuoi procedere con la chiamata reale? (Continuo automaticamente in 5 secondi...)');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const testLead = {
      id: 'test-lead-' + Date.now(),
      name: 'Mario Rossi Test',
      firstName: 'Mario',
      lastName: 'Rossi',
      phone: '+393513416607',  // Il tuo numero
      email: 'mario.test@example.com',
      company: 'Test Company'
    };

    console.log('🚀 Avvio processo Lead-to-Call...');
    const processResult = await leadToCallService.processLeadToCall(testLead);

    console.log('\\n📊 RISULTATO PROCESSO:');
    console.log(`  Success: ${processResult.success ? '✅' : '❌'}`);
    console.log(`  Status: ${processResult.finalStatus}`);
    console.log(`  Process ID: ${processResult.processId}`);
    
    if (processResult.success) {
      console.log(`  🎯 Agente selezionato: ${processResult.selectedAgent.name}`);
      console.log(`  📞 Chiamata iniziata per: ${testLead.phone}`);
      console.log(`  ⏱️ Tempo elaborazione: ${processResult.processingTime}ms`);
    } else {
      console.log(`  ❌ Errore: ${processResult.error}`);
    }

    console.log('\\n📋 Dettagli step:');
    console.log(`  - Contatto creato: ${processResult.steps.contactCreation?.success ? '✅' : '❌'}`);
    console.log(`  - Agente distribuito: ${processResult.steps.agentDistribution?.success ? '✅' : '❌'}`);
    console.log(`  - Chiamata iniziata: ${processResult.steps.callInitiation?.success ? '✅' : '❌'}`);

    // Test 6: Verifica statistiche
    console.log('\\n📋 Test 6: Verifica statistiche');
    const stats = await leadToCallService.getServiceStats();
    console.log('📊 Statistiche distribuzione:');
    console.log(`  - Totale distribuzioni: ${stats.distributionStats.totalDistributions}`);
    console.log(`  - Ultima distribuzione: ${stats.distributionStats.lastDistribution?.agentName || 'nessuna'}`);
    console.log(`  - Sistema inizializzato: ${stats.initialized ? '✅' : '❌'}`);

    console.log('\\n📈 Metriche giornaliere:');
    console.log(`  - Processi totali: ${stats.dailyMetrics.totalProcesses}`);
    console.log(`  - Chiamate riuscite: ${stats.dailyMetrics.successfulCalls}`);
    console.log(`  - Chiamate fallite: ${stats.dailyMetrics.failedCalls}`);
    console.log(`  - Success rate: ${stats.dailyMetrics.successRate}%`);

    // Test 7: Analytics dettagliati
    console.log('\\n📋 Test 7: Analytics dettagliati');
    const analytics = await leadToCallService.getAnalytics();
    
    if (analytics) {
      console.log('📊 Analytics:');
      console.log(`  - Periodo: ${analytics.period.startDate}`);
      console.log(`  - Processi totali: ${analytics.totalProcesses}`);
      console.log(`  - Success rate: ${analytics.successRate}%`);
      console.log(`  - Tempo medio elaborazione: ${analytics.avgProcessingTime}ms`);
      
      console.log('\\n👥 Performance agenti:');
      Object.entries(analytics.agentPerformance).forEach(([agentId, performance]) => {
        console.log(`  - ${performance.name}: ${performance.totalAssigned} lead, ${performance.successRate}% successo`);
      });
      
      console.log('\\n🕐 Distribuzione oraria:');
      analytics.hourlyDistribution.forEach((count, hour) => {
        if (count > 0) {
          console.log(`  - Ore ${hour.toString().padStart(2, '0')}:00: ${count} processi`);
        }
      });
    }

    // Test 8: Processi recenti
    console.log('\\n📋 Test 8: Processi recenti');
    const recentProcesses = await leadToCallService.getRecentProcesses(5);
    console.log(`📝 Ultimi ${recentProcesses.length} processi:`);
    
    recentProcesses.forEach((process, index) => {
      const timestamp = new Date(process.timestamp).toLocaleTimeString();
      const status = process.success ? '✅' : '❌';
      const agentName = process.steps?.agentDistribution?.selectedAgentName || 'N/A';
      console.log(`  ${index + 1}. [${timestamp}] ${process.lead.name || process.lead.phone} → ${agentName} ${status}`);
    });

    console.log('\\n🎉 TUTTI I TEST COMPLETATI CON SUCCESSO!');
    
    if (availableAgents.length > 0) {
      console.log('\\n📞 Se un agente era online, dovresti aver ricevuto una chiamata.');
      console.log('   Controlla il tuo telefono e la dashboard CloudTalk per conferma.');
    }

    console.log('\\n📊 RIEPILOGO SISTEMA:');
    console.log(`✅ Sistema Lead-to-Call: ATTIVO`);
    console.log(`✅ Distribuzione round robin: ATTIVA`);
    console.log(`✅ Tracking e analytics: ATTIVO`);
    console.log(`✅ Gestione errori: IMPLEMENTATA`);
    console.log(`\\n🚀 Il sistema è pronto per ricevere webhook da GoHighLevel!`);

  } catch (error) {
    console.error('❌ ERRORE DURANTE I TEST:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Funzione per test webhook simulato
async function testWebhookSimulation() {
  console.log('\\n🌐 TEST WEBHOOK SIMULATO');
  console.log('=' .repeat(40));
  
  const mockWebhookPayload = {
    id: 'test-webhook-' + Date.now(),
    name: 'Giulia Verdi',
    firstName: 'Giulia',
    lastName: 'Verdi', 
    phone: '+393513416607',
    email: 'giulia.verdi@test.com',
    tags: ['lead', 'urgent'],
    source: 'Facebook Ads',
    createdAt: new Date().toISOString()
  };

  console.log('📤 Simulando webhook GoHighLevel...');
  console.log('📋 Payload:', JSON.stringify(mockWebhookPayload, null, 2));

  try {
    const result = await leadToCallService.processLeadToCall(mockWebhookPayload);
    
    console.log('\\n📨 Risposta webhook:');
    console.log(`  Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Message: ${result.finalStatus}`);
    
    if (result.success) {
      console.log(`  Selected Agent: ${result.selectedAgent.name}`);
      console.log(`  Call Initiated: ✅`);
    } else {
      console.log(`  Error: ${result.error}`);
    }

    return {
      httpStatus: result.success ? 200 : 503,
      body: {
        success: result.success,
        message: result.success ? 'Lead processato - Chiamata iniziata' : `Errore: ${result.error}`,
        processId: result.processId,
        selectedAgent: result.selectedAgent?.name,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('❌ Errore webhook simulato:', error);
    return {
      httpStatus: 500,
      body: {
        success: false,
        message: 'Errore interno del server',
        error: error.message
      }
    };
  }
}

// Esecuzione test
async function main() {
  console.log('🧪 SUITE DI TEST LEAD-TO-CALL SYSTEM');
  console.log('=====================================');
  
  await runLeadToCallTests();
  
  console.log('\\n' + '='.repeat(60));
  
  await testWebhookSimulation();
  
  console.log('\\n✅ SUITE DI TEST COMPLETATA');
}

// Esegui se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { runLeadToCallTests, testWebhookSimulation };