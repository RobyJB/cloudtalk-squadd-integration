# 🤖 Prompts Completi dell'Analisi IA Chiamate Squadd

**Sistema**: Three-Phase AI Analysis Pipeline
**Modello**: GPT-4.1 per tutte e 3 le fasi
**File Sorgente**: `src/services/transcription-service.js`

---

## 📚 Vocabolario Custom per Trascrizione Whisper

```javascript
const CUSTOM_VOCABULARY = [
  // Squadd specific terms
  'Squadd', 'CRM', 'Workflow', 'Automazioni', 'Appuntamento',

  // Competitor software mentioned in calls
  'GoHighLevel', 'Delera', 'Leadfather', 'Arcanis', 'Growi', 'Unique.ai',

  // Common business terms in Italian B2B calls
  'cliente', 'preventivo', 'offerta', 'contratto', 'fattura', 'scadenza',
  'riunione', 'appuntamento', 'telefonate', 'email', 'WhatsApp',

  // Sales and CRM terminology
  'lead', 'prospect', 'pipeline', 'funnel', 'software', 'piattaforma',
  'abbonamento', 'SaaS', 'demo', 'trial', 'budget', 'team vendita',
  'gestione', 'pubblicità', 'marketing', 'automazione', 'flusso lavoro'
];
```

**Utilizzo in Whisper API**:
```javascript
const transcription = await openai.audio.transcriptions.create({
  file: fileStream,
  model: 'whisper-1',
  language: 'it', // Italian
  prompt: `Trascrizione di una chiamata telefonica aziendale. Vocabolario: ${CUSTOM_VOCABULARY.join(', ')}`,
  response_format: 'text'
});
```

---

## 🔍 FASE 1: Data Extraction (GPT-4.1)

**Obiettivo**: Estrazione rapida dei dati base dalla chiamata
**Modello**: `gpt-4.1`
**Temperature**: `0.2`
**Max Tokens**: `1000`

### System Prompt - Fase 1

```
Sei un analista esperto di chiamate commerciali per Squadd (CRM SaaS B2B).

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
}
```

### User Prompt - Fase 1

```
Analizza questa chiamata Squadd:

[TRASCRIZIONE COMPLETA DELLA CHIAMATA]
```

### Esempio Output Fase 1

```json
{
  "call_type": "sostanziosa",
  "call_summary": "Lead interessato a CRM per gestire team di 5 agenti immobiliari. Attualmente usa Excel. Vuole automatizzare follow-up clienti.",
  "nome_advisor": "Roberto",
  "settore_lead": "Immobiliare",
  "dimensione_attivita": "5 agenti + titolare",
  "software_in_uso": ["Excel", "WhatsApp Business"],
  "automazioni_in_uso": ["Nessuna"],
  "problematiche_attuali": [
    "Difficoltà a tracciare i follow-up",
    "Lead che si perdono per strada",
    "Nessuna automazione promemoria"
  ],
  "necessita": [
    "Automatizzare follow-up clienti",
    "Gestire pipeline vendite",
    "Inviare promemoria automatici"
  ],
  "bant_preliminare": {
    "budget": "presente",
    "autorita": "presente",
    "necessita": "presente",
    "tempistica": "presente"
  },
  "appuntamento_fissato": true
}
```

---

## 🎯 FASE 2: Avatar Classification (GPT-4.1)

**Obiettivo**: Classificare il lead in uno dei 7 avatar Squadd
**Modello**: `gpt-4.1`
**Temperature**: `0.3`
**Max Tokens**: `800`

### System Prompt - Fase 2

```
Sei un esperto di classificazione lead per Squadd.

REGOLE AVATAR:
[VEDI SEZIONE "REGOLE AVATAR COMPLETE" SOTTO]

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
}
```

### User Prompt - Fase 2

```
Classifica questo lead:

DATI ESTRATTI:
[JSON DA FASE 1]

TRASCRIZIONE COMPLETA (per contesto):
[PRIMI 2000 CARATTERI DELLA TRASCRIZIONE]...
```

### 📋 REGOLE AVATAR COMPLETE

#### Avatar 1:
- **Settore**: Qualsiasi tranne parrucchieri, ristoranti, networker, bar
- **Numero dipendenti**: 3+
- **Necessità**: Automatizzare appuntamenti, promemoria, messaggi whatsapp automatici, gestire lead generation/pubblicità, nutrire automaticamente i clienti, recuperare lead persi, metriche per tracciare le attività, chatbot AI (per chat, NO chiamate), richiedere recensioni, gestire pubblicazioni social, convertire più lead
- **Problemi**: Lavoro disorganizzato, mancanza processo specifico, non converte i lead, dimentica task, non ha controllo sui collaboratori

#### Avatar 2:
- **Settore**: Agenzia di marketing
- **Numero dipendenti**: qualsiasi
- **Necessità**: rivendere il sistema, proporre il sistema ai propri clienti, gestire i propri clienti, automatizzare le task, gestire la lead generation, dare un servizio aggiuntivo ai propri clienti
- **Problemi**: Non riesce a centralizzare tutti i clienti, non riesce a tenere sotto controllo i dati dei clienti, spende troppo per i software

#### Avatar 3:
- **Settore**: Catene di negozi o brand (piccole e grandi)
- **Numero di punti vendita**: 1+
- **Necessità**: Centralizzare i dati e il lavoro, gestire i clienti meglio, seguire meglio i lead, convertire più lead dalle sponsorizzate, nutrire i clienti, far rimanere più a lungo i clienti, tenere sotto controllo le attività dei collaboratori/dipendenti
- **Problemi**: Non riesce a centralizzare il lavoro, non riesce a tenere sotto controllo i dati e le attività, hanno troppi software, non hanno nessun software per aiutarsi con le attività, perdono troppo tempo, seguono male il cliente

#### Avatar 4:
- **Settore**: TUTTE le aziende che lavorano online
- **Numero dipendenti**: qualsiasi
- **Necessità**: convertire più lead dalle pubblicità, seguire meglio i lead, nutrire i clienti, automatizzare i processi, automatizzare le task, promemoria per gli appuntamenti, monitorare le attività del team vendita/setting
- **Problemi**: si perdono per strada tanti lead, troppi software, costi elevati dei software, poco supporto nell'utilizzo dei software, i clienti non vengono seguiti bene dopo la vendita, troppe task manuali

#### Avatar 5:
- **Settore**: TUTTE le aziende che fanno pubblicità tramite facebook/instagram/meta/google
- **Necessità**: Centralizzare i dati e il lavoro, gestire i clienti meglio, seguire meglio i lead, convertire più lead dalle sponsorizzate, nutrire i clienti, far rimanere più a lungo i clienti, tenere sotto controllo le attività dei collaboratori/dipendenti
- **Problemi**: si perdono per strada tanti lead, i clienti non vengono seguiti bene dopo la vendita, troppe task manuali, mancanza di un posto unico dove seguire i lead, non c'è un processo di vendita specifico da seguire

#### Avatar 6:
- **Settore**: Chi utilizza già GoHighLevel
- **Numero dipendenti**: qualsiasi
- **Necessità**: usando già il nostro stesso programma, avrà dei vantaggi a passare da noi
- **Punti di forza**: a loro, in particolare, regaliamo whatsapp (quello da 30€ al mese), in più hanno assistenza dedicata in live chat in italiano

#### Avatar 7:
- **Settore**: qualsiasi
- **Necessità**: vuole lead o fare soldi o fare pubblicità, vuole servizi di marketing
- **ATTENZIONE**: Assicurarsi che ci sia il budget. La soluzione lead generation costa €750/mese

### 🚫 LEAD FUORI TARGET

#### Avatar FT1 - Parrucchieri:
- **Eccezione**: SOLO se fa pubblicità su facebook/instagram/google E necessità è automatizzare lead generation, convertire lead, inviare promemoria, richiedere recensioni
- Altrimenti: **FUORI TARGET**

#### Avatar FT2 - Commerciali/venditori/consulenti:
- Se vuole: Inviare massivamente whatsapp senza essere bloccati, whatsapp gratuiti senza pagare
- **FUORI TARGET**

#### Avatar FT3 - Ristoranti e bar:
- **SEMPRE FUORI TARGET** (hanno bisogno di prenotazione tavoli che non abbiamo)

#### Avatar FT4 - Network di qualsiasi tipo:
- **SEMPRE FUORI TARGET** (vogliono spammare su whatsapp)

#### Avatar FT5 - Software di fatturazione:
- Se vuole SOLO fatturazione: **FUORI TARGET**
- Se interessato anche ad altro: IN TARGET (proporre integrazione fatture in cloud)

#### Avatar FT6 - Affitti brevi:
- Se vuole: gestire più canali comunicazione, prenotazione immobili, channel manager
- **FUORI TARGET**
- Eccezione: Se fa pubblicità può essere in target

### 🔔 CAMPANELLI D'ALLARME

🔔 **Invio massivo whatsapp SENZA API/SENZA PAGARE**: Se vuole SOLO whatsapp massivi gratis → FUORI TARGET. Verificare prima se ha altre necessità.

🔔 **Affitti brevi/immobiliare**: Se serve sistema prenotazione immobili tipo airbnb/booking o gestore canali → FUORI TARGET

### Esempio Output Fase 2

```json
{
  "avatar_numero": 4,
  "avatar_descrizione": "Azienda online con necessità di automatizzare lead generation",
  "in_target": true,
  "motivazione_target": "Lead perfetto per Avatar 4: azienda che lavora online, fa pubblicità su Meta, ha necessità concrete di automatizzare processi e convertire più lead. Budget presente, autorità confermata.",
  "campanelli_allarme": [],
  "confidenza": "Alta"
}
```

---

## 📊 FASE 3: BANT Validation & Advisor Notes (GPT-4.1)

**Obiettivo**: Validare BANT in dettaglio e fornire feedback al setter
**Modello**: `gpt-4.1`
**Temperature**: `0.3`
**Max Tokens**: `1200`

### System Prompt - Fase 3

```
Sei un coach esperto di vendita per Squadd.

# B.A.N.T. Framework Squadd

**Budget**: Il budget non deve essere esplicitamente nominato dal setter. Analizza i dettagli: un networker difficilmente ha soldi, mentre un'azienda con 10 dipendenti attiva da 10 anni li ha sicuramente.

**Autorità**: L'autorità solitamente è implicita. Se il lead non può decidere autonomamente o non può trasmettere correttamente le info ai superiori, non ha autorità.

**Necessità**: Determinare se ha un bisogno CONCRETO o è solo curioso. La necessità deve essere REALE.

**Tempistica**: Non chiedere direttamente "vuoi implementarlo oggi?". Analizzare la conversazione: se ha necessità urgente, ha già provato soluzioni senza successo → ha giusta tempistica. Se parla di "dopo l'estate", "a fine anno", "l'anno prossimo" → NON ha tempistica.

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
}
```

### User Prompt - Fase 3

```
Analizza questa chiamata:

DATI ESTRATTI:
[JSON COMPLETO DA FASE 1]

AVATAR CLASSIFICATO:
[JSON COMPLETO DA FASE 2]

TRASCRIZIONE COMPLETA:
[TRASCRIZIONE INTEGRALE DELLA CHIAMATA]
```

### Esempio Output Fase 3

```json
{
  "bant": {
    "budget": {
      "status": "✅ Presente",
      "spiegazione": "L'azienda è operativa da 5 anni con 6 dipendenti. Il titolare ha menzionato che spende già €200/mese per vari software, quindi ha capacità di investimento in soluzioni aziendali."
    },
    "autorita": {
      "status": "✅ Presente",
      "spiegazione": "Il contatto è il titolare dell'azienda e ha dichiarato esplicitamente di poter decidere autonomamente sugli investimenti software."
    },
    "necessita": {
      "status": "✅ Presente",
      "spiegazione": "Necessità concreta e urgente: sta perdendo lead perché non riesce a seguirli tutti manualmente. Ha citato almeno 3 problemi specifici che Squadd risolve."
    },
    "tempistica": {
      "status": "✅ Presente",
      "spiegazione": "Ha espresso urgenza: 'dobbiamo risolvere questo problema al più presto'. Ha chiesto disponibilità per demo già la settimana prossima. Nessun riferimento a tempistiche future vaghe."
    }
  },
  "note_advisor": "Ottima gestione della chiamata. Hai fatto bene a:\n\n✅ Identificare velocemente i pain points (perdita lead, disorganizzazione)\n✅ Fare domande aperte per capire il flusso di lavoro attuale\n✅ Confermare autorità decisionale senza essere invadente\n✅ Creare urgenza collegando problemi attuali a perdite economiche concrete\n\nPunti da migliorare:\n\n⚠️ Quando il lead ha menzionato 'troppi software', potevi approfondire quali usa per posizionare meglio Squadd come sostituto all-in-one\n⚠️ Nella parte finale hai parlato un po' troppo velocemente - rallenta per dare tempo di assimilare\n⚠️ Potevi chiedere esplicitamente se usa attualmente pubblicità online (per rafforzare match con Avatar 4)\n\nComplessivamente: Lead ad alto potenziale, ottimo lavoro di qualifica. Appuntamento fissato con solide basi B.A.N.T.",
  "confidenza_analisi": "Alta"
}
```

---

## 📄 Template Output Finale per GoHighLevel

### Caso 1: Chiamata Sostanziosa (Analisi Completa)

```
🎧 REGISTRAZIONE CHIAMATA:
[URL CloudTalk Recording]

═══════════════════════════════════════

👤 NOME ADVISOR: Roberto

🎯 AVATAR LEAD: Avatar 4 - Azienda online con necessità di automatizzare lead generation

🟢 IN TARGET
Lead perfetto per Avatar 4: azienda che lavora online, fa pubblicità su Meta, ha necessità concrete di automatizzare processi e convertire più lead. Budget presente, autorità confermata.

══════════════ B.A.N.T. ══════════════

💰 BUDGET: ✅ Presente
L'azienda è operativa da 5 anni con 6 dipendenti. Il titolare ha menzionato che spende già €200/mese per vari software, quindi ha capacità di investimento in soluzioni aziendali.

👔 AUTORITÀ: ✅ Presente
Il contatto è il titolare dell'azienda e ha dichiarato esplicitamente di poter decidere autonomamente sugli investimenti software.

🎯 NECESSITÀ: ✅ Presente
Necessità concreta e urgente: sta perdendo lead perché non riesce a seguirli tutti manualmente. Ha citato almeno 3 problemi specifici che Squadd risolve.

⏰ TEMPISTICA: ✅ Presente
Ha espresso urgenza: 'dobbiamo risolvere questo problema al più presto'. Ha chiesto disponibilità per demo già la settimana prossima. Nessun riferimento a tempistiche future vaghe.

══════════════ DETTAGLI LEAD ══════════════

🏢 SETTORE: E-commerce moda
👥 DIMENSIONE: 6 dipendenti + titolare
💻 SOFTWARE IN UTILIZZO: Excel, WhatsApp Business, Mailchimp
🤖 AUTOMAZIONI IN UTILIZZO: Email automatiche Mailchimp

🚨 PROBLEMATICHE ATTUALI:
• Difficoltà a tracciare i follow-up
• Lead che si perdono per strada
• Nessuna automazione promemoria
• Troppi software separati

✨ NECESSITÀ EMERSE:
• Automatizzare follow-up clienti
• Gestire pipeline vendite
• Inviare promemoria automatici
• Centralizzare tutti i tool in uno

══════════════ NOTE ADVISOR ══════════════

Ottima gestione della chiamata. Hai fatto bene a:

✅ Identificare velocemente i pain points (perdita lead, disorganizzazione)
✅ Fare domande aperte per capire il flusso di lavoro attuale
✅ Confermare autorità decisionale senza essere invadente
✅ Creare urgenza collegando problemi attuali a perdite economiche concrete

Punti da migliorare:

⚠️ Quando il lead ha menzionato 'troppi software', potevi approfondire quali usa per posizionare meglio Squadd come sostituto all-in-one
⚠️ Nella parte finale hai parlato un po' troppo velocemente - rallenta per dare tempo di assimilare
⚠️ Potevi chiedere esplicitamente se usa attualmente pubblicità online (per rafforzare match con Avatar 4)

Complessivamente: Lead ad alto potenziale, ottimo lavoro di qualifica. Appuntamento fissato con solide basi B.A.N.T.

══════════════ TRASCRIZIONE ══════════════

[Trascrizione completa della chiamata...]

⏰ Elaborata: 28/10/2025, 19:45:30
```

### Caso 2: Chiamata Non Sostanziosa

```
🎧 REGISTRAZIONE CHIAMATA:
[URL CloudTalk Recording]

═══════════════════════════════════════

✔︎ Risposto - conversazione non avvenuta

📋 RIASSUNTO:
Lead ha risposto ma era in riunione. Ha chiesto di richiamare domani pomeriggio.

═══════════════ TRASCRIZIONE ═══════════════

[Trascrizione breve...]
```

### Caso 3: Segreteria Telefonica

```
🎧 REGISTRAZIONE CHIAMATA:
[URL CloudTalk Recording]

═══════════════════════════════════════

📵 SEGRETERIA - CLOUDTALK

La chiamata è caduta su segreteria telefonica.

═══════════════ TRASCRIZIONE ═══════════════

[Messaggio in segreteria...]
```

### Caso 4: Audio Non Comprensibile

```
🎧 REGISTRAZIONE CHIAMATA:
[URL CloudTalk Recording]

═══════════════════════════════════════

❓ AUDIO NON COMPRENSIBILE - CLOUDTALK

Transcription contains mostly placeholder text (2 patterns detected, only 5 meaningful chars)

═══════════════ TRASCRIZIONE ═══════════════

[Testo placeholder rilevato...]
```

---

## 🔄 Flusso Completo del Sistema

### Pipeline di Elaborazione

```
1. CloudTalk webhook → call-recording-ready
   ↓
2. Download registrazione audio
   ↓
3. Trascrizione Whisper (con vocabolario custom)
   ↓
4. Check audio comprensibile
   ↓
   ├─ NO → Nota "Audio non comprensibile"
   └─ SÌ → Continua analisi
       ↓
5. FASE 1: Data Extraction (GPT-4.1)
   ↓
   ├─ call_type = "segreteria" → Nota "Segreteria"
   ├─ call_type = "non_sostanziosa" → Nota ridotta
   └─ call_type = "sostanziosa" → Continua
       ↓
6. FASE 2: Avatar Classification (GPT-4.1)
   ↓
7. FASE 3: BANT + Advisor Notes (GPT-4.1)
   ↓
8. Formattazione nota completa
   ↓
9. Upload a GoHighLevel:
   - Nota nel contatto
   - Audio caricato in conversation
```

---

## ⚙️ Configurazione Tecnica

### Modelli Utilizzati

| Fase | Modello | Temperature | Max Tokens | Costo Relativo |
|------|---------|-------------|------------|----------------|
| Trascrizione | whisper-1 | N/A | N/A | $0.006/min |
| Fase 1 | gpt-4.1 | 0.2 | 1000 | Basso |
| Fase 2 | gpt-4.1 | 0.3 | 800 | Medio |
| Fase 3 | gpt-4.1 | 0.3 | 1200 | Alto |

### Ottimizzazioni Performance

1. **Fase 1 usa temperature 0.2**: Massima precisione nell'estrazione dati
2. **Fase 2 e 3 usano temperature 0.3**: Bilanciamento tra precisione e creatività nel giudizio
3. **Fase 2 riceve solo primi 2000 char trascrizione**: Riduce costi, contesto sufficiente
4. **Fase 3 riceve trascrizione completa**: Necessaria per feedback dettagliato

### Gestione Errori

```javascript
// Check audio comprensibile prima dell'analisi
const audioComprehensionCheck = checkAudioComprehensible(transcription);

if (!audioComprehensionCheck.isComprehensible) {
  // Skip analisi AI, ritorna nota "Audio non comprensibile"
  return {
    call_type: 'incomprehensible_audio',
    reason: audioComprehensionCheck.reason
  };
}

// Fallback per call_type
if (phase1Result.data.call_type === 'segreteria') {
  // Skip Fase 2 e 3
  return { call_type: 'segreteria' };
}

if (phase1Result.data.call_type === 'non_sostanziosa') {
  // Skip Fase 2 e 3
  return { call_type: 'non_sostanziosa' };
}
```

---

## 📝 Note Implementative

### Location dei Prompt nel Codice

```
src/services/transcription-service.js:
├─ Line 173: Prompt Whisper trascrizione
├─ Line 288-351: FASE 1 - Data Extraction
├─ Line 358-494: FASE 2 - Avatar Classification
│  └─ Line 362-433: REGOLE AVATAR COMPLETE
└─ Line 501-593: FASE 3 - BANT & Advisor Notes
   └─ Line 505-513: BANT Framework

src/services/transcription-service.js:
└─ Line 808-942: Template formattazione nota GHL
```

### Funzioni Chiave

```javascript
// Pipeline principale
processRecordingTranscription(audioUrl)

// Sistema 3 fasi
extractKeyPoints(transcription)
  ├─ performPhase1DataExtraction()
  ├─ performPhase2AvatarClassification()
  └─ performPhase3BANTAndNotes()

// Formattazione output
formatTranscriptionForGHL(result, recordingUrl)

// Validazione audio
checkAudioComprehensible(transcription)
```

---

## 🎯 Best Practices per Modifica Prompt

### Se vuoi modificare la Fase 1 (Data Extraction):

1. **Mantieni il formato JSON** esattamente come specificato
2. **Non aggiungere troppi campi**: Fase 1 deve essere veloce ed economica
3. **Usa temperature bassa** (0.2) per massimizzare precisione
4. **Test con call_type edge cases**: segreteria, non_sostanziosa

### Se vuoi modificare la Fase 2 (Avatar Classification):

1. **Aggiorna le regole avatar** nella sezione `avatarRules`
2. **Testa con lead borderline** tra avatar diversi
3. **Valida la logica "fuori target"**: è critica per evitare perdite tempo
4. **Campanelli d'allarme**: Aggiungi pattern che hai osservato in chiamate reali

### Se vuoi modificare la Fase 3 (BANT & Notes):

1. **BANT Framework è CRITICO**: Non modificare senza consenso sales manager
2. **Note advisor**: Bilancia critiche costruttive con incoraggiamento
3. **Confidenza analisi**: Usa per filtrare lead dubbi
4. **Max 300 parole note**: Rispetta limite per leggibilità

---

## 🐛 Troubleshooting

### Problema: "Analysis failed: JSON parse error"

**Causa**: GPT risponde con markdown code fences
**Soluzione**: Già gestito in codice (line 332-336, 474-478, 570-574)

```javascript
if (response.includes('```json')) {
  response = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
}
```

### Problema: "Audio non comprensibile" troppo frequente

**Causa**: Pattern detection troppo aggressivo
**Soluzione**: Regola threshold in `checkAudioComprehensible()` (line 668)

```javascript
// Attuale: 20 chars
if (cleanedText.length < 20) { ... }

// Prova: 10 chars (più permissivo)
if (cleanedText.length < 10) { ... }
```

### Problema: Avatar sempre null

**Causa**: Regole avatar troppo restrittive o BANT incompleto
**Soluzione**:
1. Controlla output Fase 1 (BANT preliminare)
2. Verifica match con regole avatar
3. Considera aggiungere avatar "catch-all"

---

**Documento generato automaticamente da Claude Code**
_Ultima revisione: 28 Ottobre 2025_
