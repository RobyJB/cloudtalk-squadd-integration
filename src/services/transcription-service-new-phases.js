/**
 * NEW THREE-PHASE ANALYSIS SYSTEM
 * To be integrated into transcription-service.js
 */

/**
 * Phase 1: Data Extraction with GPT-5 nano (fast and economical)
 * Extracts base information from the call
 */
async function performPhase1DataExtraction(transcription, openai) {
  try {
    console.log(`📋 Phase 1: Extracting base data from call...`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: `Sei un analista esperto di chiamate commerciali per Squadd (CRM SaaS B2B).

CONTESTO: I setter di Squadd chiamano lead aziendali per qualificarli e fissare appuntamenti demo.

ESTRAI le seguenti informazioni dalla chiamata:

{
  "call_type": "sostanziosa/non_sostanziosa/segreteria",
  "call_summary": "Breve riassunto di cosa è successo",
  "nome_advisor": "Nome del setter/advisor Squadd",
  "settore_lead": "Settore business del lead",
  "dimensione_attivita": "Numero dipendenti o dimensione (es: '5 dipendenti', 'solo titolare', '10+', ecc)",
  "software_in_uso": ["lista", "di", "software"],
  "automazioni_in_uso": ["lista", "o", "Nessuna"],
  "problematiche_attuali": ["problema 1", "problema 2"],
  "necessita": ["necessità 1", "necessità 2"],
  "bant_preliminare": {
    "budget": "presente/incerto/assente",
    "autorita": "presente/incerto/assente",
    "necessita": "presente/incerto/assente",
    "tempistica": "presente/incerto/assente"
  },
  "appuntamento_fissato": true/false
}`
        },
        {
          role: 'user',
          content: `Analizza questa chiamata Squadd:\n\n${transcription}`
        }
      ],
      temperature: 0.2,
      max_completion_tokens: 1000
    });

    const response = completion.choices[0].message.content;
    const data = JSON.parse(response);

    console.log(`✅ Phase 1 completed - call type: ${data.call_type}`);

    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error(`❌ Error in Phase 1: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Phase 2: Avatar Classification with GPT-5
 * Determines the correct avatar (1-7) and if lead is in/out of target
 */
async function performPhase2AvatarClassification(extractedData, transcription, openai) {
  try {
    console.log(`🎯 Phase 2: Classifying lead avatar...`);

    const avatarRules = `# AVATAR LEAD SQUADD

## Avatar 1:
- **Settore**: Qualsiasi tranne parrucchieri, ristoranti, networker, bar
- **Numero dipendenti**: 3+
- **Necessità**: Automatizzare appuntamenti, promemoria, messaggi whatsapp automatici, gestire lead generation/pubblicità, nutrire automaticamente i clienti, recuperare lead persi, metriche per tracciare le attività, chatbot AI (per chat, NO chiamate), richiedere recensioni, gestire pubblicazioni social, convertire più lead
- **Problemi**: Lavoro disorganizzato, mancanza processo specifico, non converte i lead, dimentica task, non ha controllo sui collaboratori

## Avatar 2:
- **Settore**: Agenzia di marketing
- **Numero dipendenti**: qualsiasi
- **Necessità**: rivendere il sistema, proporre il sistema ai propri clienti, gestire i propri clienti, automatizzare le task, gestire la lead generation, dare un servizio aggiuntivo ai propri clienti
- **Problemi**: Non riesce a centralizzare tutti i clienti, non riesce a tenere sotto controllo i dati dei clienti, spende troppo per i software

## Avatar 3:
- **Settore**: Catene di negozi o brand (piccole e grandi)
- **Numero di punti vendita**: 1+
- **Necessità**: Centralizzare i dati e il lavoro, gestire i clienti meglio, seguire meglio i lead, convertire più lead dalle sponsorizzate, nutrire i clienti, far rimanere più a lungo i clienti, tenere sotto controllo le attività dei collaboratori/dipendenti
- **Problemi**: Non riesce a centralizzare il lavoro, non riesce a tenere sotto controllo i dati e le attività, hanno troppi software, non hanno nessun software per aiutarsi con le attività, perdono troppo tempo, seguono male il cliente

## Avatar 4:
- **Settore**: TUTTE le aziende che lavorano online
- **Numero dipendenti**: qualsiasi
- **Necessità**: convertire più lead dalle pubblicità, seguire meglio i lead, nutrire i clienti, automatizzare i processi, automatizzare le task, promemoria per gli appuntamenti, monitorare le attività del team vendita/setting
- **Problemi**: si perdono per strada tanti lead, troppi software, costi elevati dei software, poco supporto nell'utilizzo dei software, i clienti non vengono seguiti bene dopo la vendita, troppe task manuali

## Avatar 5:
- **Settore**: TUTTE le aziende che fanno pubblicità tramite facebook/instagram/meta/google
- **Necessità**: Centralizzare i dati e il lavoro, gestire i clienti meglio, seguire meglio i lead, convertire più lead dalle sponsorizzate, nutrire i clienti, far rimanere più a lungo i clienti, tenere sotto controllo le attività dei collaboratori/dipendenti
- **Problemi**: si perdono per strada tanti lead, i clienti non vengono seguiti bene dopo la vendita, troppe task manuali, mancanza di un posto unico dove seguire i lead, non c'è un processo di vendita specifico da seguire

## Avatar 6:
- **Settore**: Chi utilizza già GoHighLevel
- **Numero dipendenti**: qualsiasi
- **Necessità**: usando già il nostro stesso programma, avrà dei vantaggi a passare da noi
- **Punti di forza**: a loro, in particolare, regaliamo whatsapp (quello da 30€ al mese), in più hanno assistenza dedicata in live chat in italiano

## Avatar 7:
- **Settore**: qualsiasi
- **Necessità**: vuole lead o fare soldi o fare pubblicità, vuole servizi di marketing
- **ATTENZIONE**: Assicurarsi che ci sia il budget. La soluzione lead generation costa €750/mese

# LEAD FUORI TARGET

## Avatar FT1 - Parrucchieri:
- **Eccezione**: SOLO se fa pubblicità su facebook/instagram/google E necessità è automatizzare lead generation, convertire lead, inviare promemoria, richiedere recensioni
- Altrimenti: FUORI TARGET

## Avatar FT2 - Commerciali/venditori/consulenti:
- Se vuole: Inviare massivamente whatsapp senza essere bloccati, whatsapp gratuiti senza pagare
- FUORI TARGET

## Avatar FT3 - Ristoranti e bar:
- SEMPRE FUORI TARGET (hanno bisogno di prenotazione tavoli che non abbiamo)

## Avatar FT4 - Network di qualsiasi tipo:
- SEMPRE FUORI TARGET (vogliono spammare su whatsapp)

## Avatar FT5 - Software di fatturazione:
- Se vuole SOLO fatturazione: FUORI TARGET
- Se interessato anche ad altro: IN TARGET (proporre integrazione fatture in cloud)

## Avatar FT6 - Affitti brevi:
- Se vuole: gestire più canali comunicazione, prenotazione immobili, channel manager
- FUORI TARGET
- Eccezione: Se fa pubblicità può essere in target

# CAMPANELLI D'ALLARME

🔔 **Invio massivo whatsapp SENZA API/SENZA PAGARE**: Se vuole SOLO whatsapp massivi gratis → FUORI TARGET. Verificare prima se ha altre necessità.

🔔 **Affitti brevi/immobiliare**: Se serve sistema prenotazione immobili tipo airbnb/booking o gestore canali → FUORI TARGET`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content: `Sei un esperto di classificazione lead per Squadd.

REGOLE AVATAR:
${avatarRules}

IMPORTANTE: 
- Se manca un criterio BANT (Budget, Autorità, Necessità, Tempistica), il lead rischia di essere fuori target
- Formula ideale: B.A.N.T. + Avatar

Rispondi in JSON:
{
  "avatar_numero": 1-7 o null se fuori target,
  "avatar_descrizione": "Descrizione breve avatar",
  "in_target": true/false,
  "motivazione_target": "Perché è in/fuori target",
  "campanelli_allarme": ["lista", "campanelli"] o [],
  "confidenza": "Alta/Media/Bassa"
}`
        },
        {
          role: 'user',
          content: `Classifica questo lead:

DATI ESTRATTI:
${JSON.stringify(extractedData, null, 2)}

TRASCRIZIONE COMPLETA (per contesto):
${transcription.substring(0, 2000)}...`
        }
      ],
      temperature: 0.3,
      max_completion_tokens: 800
    });

    const response = completion.choices[0].message.content;
    const classification = JSON.parse(response);

    console.log(`✅ Phase 2 completed - Avatar: ${classification.avatar_numero || 'Fuori Target'}`);

    return {
      success: true,
      classification: classification
    };

  } catch (error) {
    console.error(`❌ Error in Phase 2: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Phase 3: BANT Validation and Advisor Notes with GPT-5
 * Provides detailed BANT analysis and feedback for the advisor
 */
async function performPhase3BANTAndNotes(extractedData, avatarClassification, transcription, openai) {
  try {
    console.log(`📊 Phase 3: BANT validation and advisor notes...`);

    const bantRules = `# B.A.N.T. Framework Squadd

**Budget**: Il budget non deve essere esplicitamente nominato dal setter. Analizza i dettagli: un networker difficilmente ha soldi, mentre un'azienda con 10 dipendenti attiva da 10 anni li ha sicuramente.

**Autorità**: L'autorità solitamente è implicita. Se il lead non può decidere autonomamente o non può trasmettere correttamente le info ai superiori, non ha autorità.

**Necessità**: Determinare se ha un bisogno CONCRETO o è solo curioso. La necessità deve essere REALE.

**Tempistica**: Non chiedere direttamente "vuoi implementarlo oggi?". Analizzare la conversazione: se ha necessità urgente, ha già provato soluzioni senza successo → ha giusta tempistica. Se parla di "dopo l'estate", "a fine anno", "l'anno prossimo" → NON ha tempistica.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content: `Sei un coach esperto di vendita per Squadd.

${bantRules}

Analizza la chiamata e fornisci:
1. BANT dettagliato con spiegazioni
2. Note per l'advisor su cosa ha fatto bene/male

Rispondi in JSON:
{
  "bant": {
    "budget": {
      "status": "✅ Presente / ⚠️ Incerto / ❌ Assente",
      "spiegazione": "Perché hai dato questo verdetto"
    },
    "autorita": {
      "status": "✅ Presente / ⚠️ Incerto / ❌ Assente",
      "spiegazione": "Perché hai dato questo verdetto"
    },
    "necessita": {
      "status": "✅ Presente / ⚠️ Incerto / ❌ Assente",
      "spiegazione": "Perché hai dato questo verdetto"
    },
    "tempistica": {
      "status": "✅ Presente / ⚠️ Incerto / ❌ Assente",
      "spiegazione": "Perché hai dato questo verdetto"
    }
  },
  "note_advisor": "Feedback dettagliato per l'advisor. Cosa ha fatto bene, cosa migliorare. Massimo 300 parole. Sii specifico e costruttivo.",
  "confidenza_analisi": "Alta/Media/Bassa"
}`
        },
        {
          role: 'user',
          content: `Analizza questa chiamata:

DATI ESTRATTI:
${JSON.stringify(extractedData, null, 2)}

AVATAR CLASSIFICATO:
${JSON.stringify(avatarClassification, null, 2)}

TRASCRIZIONE COMPLETA:
${transcription}`
        }
      ],
      temperature: 0.3,
      max_completion_tokens: 1200
    });

    const response = completion.choices[0].message.content;
    const analysis = JSON.parse(response);

    console.log(`✅ Phase 3 completed - BANT analysis done`);

    return {
      success: true,
      bant: analysis.bant,
      notes: analysis.note_advisor,
      confidenza: analysis.confidenza_analisi
    };

  } catch (error) {
    console.error(`❌ Error in Phase 3: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  performPhase1DataExtraction,
  performPhase2AvatarClassification,
  performPhase3BANTAndNotes
};
