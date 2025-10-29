#!/usr/bin/env node

/**
 * Script per analizzare il funzionamento delle etichette CloudTalk
 */

import { getTags } from './API CloudTalk/GET/get-tags.js';
import { getCallDetails } from './API CloudTalk/GET/get-call-details.js';
import { getCalls } from './API CloudTalk/GET/get-calls.js';

async function analyzeTagsSystem() {
  console.log('🔍 ANALISI SISTEMA ETICHETTE CLOUDTALK\n');
  console.log('=' .repeat(60));

  try {
    // 1. Ottieni tutte le etichette disponibili
    console.log('\n📋 STEP 1: Recupero tutte le etichette disponibili...\n');
    const tagsResponse = await getTags({ limit: 100 });

    const tags = tagsResponse?.responseData?.data || [];

    console.log(`\n✅ Trovate ${tags.length} etichette:\n`);
    tags.forEach((tagItem, index) => {
      const tag = tagItem.Tag || tagItem;
      console.log(`   ${index + 1}. "${tag.name}" (ID: ${tag.id})`);
      if (tag.color) console.log(`      🎨 Colore: ${tag.color}`);
    });

    // 2. Cerca etichette specifiche menzionate dall'utente
    console.log('\n\n🔎 STEP 2: Ricerca etichette specifiche...\n');

    const followUpTag = tags.find(t => {
      const name = (t.Tag?.name || t.name || '').toLowerCase();
      return name.includes('follow') || name.includes('up');
    });

    const datiErratiTag = tags.find(t => {
      const name = (t.Tag?.name || t.name || '').toLowerCase();
      return name.includes('dati') || name.includes('errat') || name.includes('wrong');
    });

    if (followUpTag) {
      const tag = followUpTag.Tag || followUpTag;
      console.log(`✅ Trovata etichetta "Follow Up": ID ${tag.id}, Nome: "${tag.name}"`);
    } else {
      console.log(`⚠️  Etichetta "Follow Up" non trovata`);
    }

    if (datiErratiTag) {
      const tag = datiErratiTag.Tag || datiErratiTag;
      console.log(`✅ Trovata etichetta "Dati Errati": ID ${tag.id}, Nome: "${tag.name}"`);
    } else {
      console.log(`⚠️  Etichetta "Dati Errati" non trovata`);
    }

    // 3. Cerca chiamate recenti con etichette
    console.log('\n\n📞 STEP 3: Ricerca chiamate recenti con etichette...\n');

    const callsResponse = await getCalls({ limit: 20 });
    const calls = callsResponse?.responseData?.data || [];

    console.log(`✅ Trovate ${calls.length} chiamate recenti\n`);

    // Filtra chiamate che hanno etichette
    const callsWithTags = calls.filter(callItem => {
      const cdr = callItem.Cdr || callItem;
      return cdr.ContactsTag && cdr.ContactsTag.length > 0;
    });

    console.log(`🏷️  ${callsWithTags.length} chiamate hanno etichette applicate\n`);

    if (callsWithTags.length > 0) {
      console.log('Esempi di chiamate con etichette:\n');

      for (const callItem of callsWithTags.slice(0, 3)) {
        const cdr = callItem.Cdr || callItem;
        console.log(`   📞 Call ID: ${cdr.id}`);
        console.log(`      Numero: ${cdr.phone_from || cdr.external_number}`);
        console.log(`      Data: ${cdr.created || cdr.date}`);
        console.log(`      Etichette applicate:`);

        (cdr.ContactsTag || []).forEach(tag => {
          console.log(`         - "${tag.name}" (ID: ${tag.id})`);
        });

        console.log('');
      }

      // 4. Ottieni dettagli di una chiamata con etichette per vedere cosa succede
      console.log('\n📊 STEP 4: Analisi dettagliata chiamata con etichette...\n');

      const firstCallWithTags = callsWithTags[0];
      const callId = (firstCallWithTags.Cdr || firstCallWithTags).id;

      console.log(`Recupero dettagli per Call ID: ${callId}...\n`);

      try {
        const callDetails = await getCallDetails(callId);

        console.log('✅ Dettagli chiamata recuperati:\n');
        console.log(`   UUID: ${callDetails.uuid}`);
        console.log(`   Direzione: ${callDetails.direction}`);
        console.log(`   Status: ${callDetails.status}`);
        console.log(`   Durata totale: ${callDetails.call_times?.total_time}s`);

        if (callDetails.call_tags && callDetails.call_tags.length > 0) {
          console.log(`\n   🏷️  Etichette della chiamata (${callDetails.call_tags.length}):`);
          callDetails.call_tags.forEach(tag => {
            console.log(`      - "${tag.label}" (ID: ${tag.id})`);
          });
        }

        if (callDetails.contact) {
          console.log(`\n   👤 Contatto associato:`);
          console.log(`      Nome: ${callDetails.contact.name}`);
          console.log(`      Numero: ${callDetails.contact.number}`);
        }

      } catch (detailsError) {
        console.log(`⚠️  Errore recuperando dettagli: ${detailsError.message}`);
      }

    } else {
      console.log('⚠️  Nessuna chiamata recente ha etichette applicate');
    }

    // 5. CONCLUSIONE: Cosa succede quando applichi un'etichetta
    console.log('\n\n' + '='.repeat(60));
    console.log('📋 CONCLUSIONE: COSA SUCCEDE QUANDO APPLICHI UN\'ETICHETTA');
    console.log('='.repeat(60));
    console.log(`
Le etichette in CloudTalk servono per:

1. 📊 CATEGORIZZAZIONE
   - Le chiamate vengono categorizzate per tipo/risultato
   - Esempio: "Follow Up", "Dati Errati", "Lead Qualificato", etc.

2. 🔍 FILTRI E RICERCHE
   - Puoi filtrare chiamate per etichetta usando l'API
   - Parametro: tag_id nelle chiamate GET /calls

3. 📈 REPORTING E ANALYTICS
   - Le etichette appaiono nei report e nelle statistiche
   - Aiutano a misurare outcome delle chiamate

4. 🔔 AUTOMAZIONI (Webhook)
   - CloudTalk può inviare webhook quando viene applicata un'etichetta
   - Endpoint: /api/cloudtalk-webhooks/new-tag
   - Permette di triggerare azioni automatiche

5. 📝 METADATA CHIAMATE
   - Le etichette diventano parte permanente dei dati della chiamata
   - Visibili in call_tags nei dettagli chiamata

COMPORTAMENTO SPECIFICO:
- "Follow Up": Marca la chiamata per follow-up, può triggerare task/reminder
- "Dati Errati": Indica che i dati del contatto sono errati/da verificare

⚠️  IMPORTANTE: Le etichette NON modificano automaticamente:
   - Lo stato della chiamata
   - I dati del contatto
   - Le campagne attive

Sono PURAMENTE DESCRITTIVE e servono per tracking e automazioni.
`);

  } catch (error) {
    console.error('❌ Errore nell\'analisi:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Esegui analisi
analyzeTagsSystem();
