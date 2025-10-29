# 📋 Report: Come Funzionano le Etichette CloudTalk

**Data Analisi**: 28 Ottobre 2025
**Sistema Analizzato**: CloudTalk → GoHighLevel Integration Middleware

---

## 🎯 Risposta Diretta

### Etichetta "Follow Up" (ID: 838083)
Quando applichi l'etichetta **"Follow Up"** a una chiamata post-chiamata, succede questo:

1. ✅ **L'etichetta viene salvata permanentemente** nei metadati della chiamata
2. 📊 **Appare nei report e nelle statistiche** CloudTalk
3. 🔍 **Diventa ricercabile** tramite API (parametro `tag_id`)
4. 🔔 **Può triggerare webhook** verso il tuo middleware (endpoint: `/api/cloudtalk-webhooks/new-tag`)
5. 📝 **Viene creata una nota automatica** nel contatto GoHighLevel con il testo:
   ```
   🏷️ NUOVO TAG DA CLOUDTALK
   📞 Call ID: [ID chiamata]
   🏷️ Tag: Follow Up
   📱 Numero: [numero telefono]
   📅 Timestamp: [data/ora]
   ```

### Etichetta "Dati Errati"
⚠️ **ATTENZIONE**: Non esiste attualmente un'etichetta chiamata "Dati Errati" nel tuo sistema CloudTalk.

**Etichette simili esistenti**:
- ❌ Nessuna etichetta con "Dati" o "Errati" nel nome

Se vuoi creare questa etichetta, puoi:
```bash
# Crea nuova etichetta via API
node "API CloudTalk/PUT/put-add-tag.js"
```

---

## 📊 Analisi Completa Sistema Etichette

### 1. Etichette Disponibili nel Sistema (69 totali)

**Etichette Business-Critical**:
- ✅ **Follow Up** (ID: 838083) - Per chiamate che richiedono follow-up
- ✅ **Folow Up** (ID: 851633) - Typo duplicato
- ✅ **followup** (ID: 856323) - Variante lowercase
- ✅ **Mancata Risposta** (ID: 838085) - Per chiamate perse
- ✅ **mancata_risposta** (ID: 856315) - Variante snake_case
- ✅ **Appuntamento fissato** (ID: 846495) - Outcome positivo
- ✅ **App. fissato** (ID: 901899) - Versione abbreviata
- ✅ **Cliente** (ID: 861999) - Cliente acquisito
- ✅ **Fuori budget** (ID: 860053) - Disqualifica per budget
- ✅ **Fuori target** (ID: 902941) - Disqualifica per target
- ✅ **Straniero** (ID: 860023) - Lead straniero
- ✅ **Cerca lavoro** (ID: 860043) - Lead cerca opportunità
- ✅ **Bambino** (ID: 860045) - Contatto bambino
- ✅ **Non ora** (ID: 860089) - Timing non adatto
- ✅ **Non ha capito perché ha cliccato** (ID: 913231) - Click accidentale

**Etichette GHL Integration**:
- 🔗 **GHL Lead** (ID: 849981) - Lead da GoHighLevel
- 🔗 **GHL Sync** (ID: 852235) - Sincronizzazione GHL
- 🔗 **GHL: open** (ID: 852239) - Pipeline GHL aperta
- 🔗 **Sync Test** (ID: 852237) - Test sincronizzazione

**Etichette Lead Management**:
- 📈 **Nuovi Lead** (ID: 838079)
- 📈 **nuovi_lead** (ID: 856309)
- 📈 **lead_recenti** (ID: 856311)

---

## 🔧 Cosa Succede Tecnicamente Quando Applichi un'Etichetta

### Flusso Completo (Step-by-Step)

#### 1. **Applicazione Etichetta in CloudTalk**
```
Operatore applica etichetta "Follow Up" → CloudTalk salva nei metadati chiamata
```

#### 2. **CloudTalk Invia Webhook**
```http
POST https://your-middleware.com/api/cloudtalk-webhooks/new-tag
Content-Type: application/json

{
  "call_id": 1050210523,
  "external_number": "393513416607",
  "tag_name": "Follow Up",
  "agent_id": 493933,
  "timestamp": "2025-10-28T19:40:50Z"
}
```

#### 3. **Middleware Processa Webhook**
Location: `src/routes/cloudtalk-webhooks.js:572`

```javascript
router.post('/new-tag', async (req, res) => {
  // 1. Valida payload webhook
  // 2. Controlla duplicati
  // 3. Salva payload in file JSON
  // 4. Chiama processCloudTalkWebhook()
});
```

#### 4. **Ricerca Contatto in GHL**
Location: `API Squadd/webhook-to-ghl-processor.js:35`

```javascript
// Cerca contatto per numero telefono
const contact = await searchGHLContactByPhone(phoneNumber);
```

#### 5. **Crea Nota in GoHighLevel**
Location: `API Squadd/webhook-to-ghl-processor.js:373-389`

```javascript
async function processNewTag(contact, payload) {
  const noteText = `🏷️ NUOVO TAG DA CLOUDTALK

📞 Call ID: ${payload.call_id || 'N/A'}
🏷️ Tag: ${payload.tag_name || payload.tag}
📱 Numero: ${payload.external_number}
📅 Timestamp: ${new Date().toLocaleString('it-IT')}

✅ Tag applicato automaticamente dal sistema CloudTalk`;

  // Aggiunge nota al contatto GHL
  const result = await addNoteToGHLContact(contact.id, noteText);

  return {
    action: 'tag_note_added',
    noteId: result.id,
    tag: payload.tag_name || payload.tag
  };
}
```

#### 6. **Risposta Webhook**
```json
{
  "success": true,
  "message": "CloudTalk webhook new-tag processed successfully",
  "contact": {
    "id": "ghl_contact_id",
    "name": "Roberto Bondici",
    "phone": "+393513416607"
  },
  "result": {
    "action": "tag_note_added",
    "noteId": "note_xyz123",
    "tag": "Follow Up"
  }
}
```

---

## ⚙️ Configurazione Webhook CloudTalk

### Webhook Attivi per Tag

**Endpoint**: `/api/cloudtalk-webhooks/new-tag`
**Metodo**: POST
**Status**: ✅ ATTIVO

**Altri endpoint webhook disponibili**:
- ✅ `/call-recording-ready` - Recording disponibile
- ✅ `/call-started` - Chiamata iniziata
- ✅ `/call-ended` - Chiamata terminata (con Campaign Automation)
- ✅ `/contact-updated` - Contatto aggiornato
- ✅ `/new-note` - Nuova nota
- ✅ `/transcription-ready` - Trascrizione disponibile

---

## 🚀 Capacità API per Gestione Tag

### 1. Leggere Tutti i Tag
```bash
node "API CloudTalk/GET/get-tags.js"
```
**API Endpoint**: `GET /tags/index.json`
**Parametri**:
- `id`: Filter by tag ID
- `limit`: Max items (1-1000)
- `page`: Page number

### 2. Creare Nuovo Tag
```bash
node "API CloudTalk/PUT/put-add-tag.js"
```
**API Endpoint**: `PUT /tags/add.json`
**Body**:
```json
{
  "name": "Dati Errati"
}
```

### 3. Applicare Tag a Contatto
```bash
node "API CloudTalk/PUT/put-add-contact-tags.js"
```
**API Endpoint**: `POST /bulk/contacts.json` (tramite bulk API)
**Body**:
```json
[{
  "action": "edit_contact",
  "command_id": "add-tags-timestamp",
  "data": {
    "id": 123456,
    "name": "Nome Contatto",
    "ContactsTag": [
      { "name": "Follow Up" },
      { "name": "Dati Errati" }
    ]
  }
}]
```

### 4. Cercare Chiamate per Tag
```bash
node "API CloudTalk/GET/get-calls.js"
```
**API Endpoint**: `GET /calls/index.json?tag_id=838083`
**Parametri**:
- `tag_id`: Filtra per ID etichetta
- `limit`: Numero massimo risultati
- `page`: Pagina risultati

### 5. Vedere Dettagli Chiamata con Tag
```bash
node "API CloudTalk/GET/get-call-details.js"
```
**API Endpoint**: `GET /calls/{callId}` (analytics API)
**Response**:
```json
{
  "cdr_id": 1050210523,
  "call_tags": [
    { "id": 838083, "label": "Follow Up" }
  ],
  "contact": { ... },
  "call_times": { ... }
}
```

---

## ❗ Cosa le Etichette NON Fanno

### ❌ Le etichette sono DESCRITTIVE, NON PRESCRITTIVE

**Le etichette NON modificano automaticamente**:
1. ❌ Lo stato della chiamata (`status: answered/missed`)
2. ❌ I dati del contatto (nome, numero, email)
3. ❌ Le campagne attive o la posizione nelle code
4. ❌ Le assegnazioni agli agenti
5. ❌ I workflow automatici (tranne webhook configurati)
6. ❌ Le pipeline GoHighLevel (senza integrazione custom)
7. ❌ I task o reminder automatici

**Le etichette SONO SOLO**:
- 📝 Metadata descrittivi
- 🔍 Filtri per ricerca/report
- 🔔 Trigger per webhook (se configurati)

---

## 💡 Raccomandazioni

### 1. Standardizza Nomenclatura Tag
**Problema attuale**: Hai tag duplicati con naming inconsistente
- ✅ "Follow Up" (corretto)
- ⚠️ "Folow Up" (typo)
- ⚠️ "followup" (lowercase)

**Soluzione**: Scegli UNA convenzione e pulisci duplicati.

### 2. Crea Tag "Dati Errati"
Se vuoi tracciare chiamate con dati errati:
```bash
# Crea nuovo tag
node "API CloudTalk/PUT/put-add-tag.js"
# Nome: "Dati Errati"
```

### 3. Configura Automazioni Specifiche per Tag
**Esempio**: Se vuoi che "Dati Errati" triggerri un'azione specifica:

Modifica: `API Squadd/webhook-to-ghl-processor.js`
```javascript
async function processNewTag(contact, payload) {
  const tagName = payload.tag_name || payload.tag;

  // Azione specifica per "Dati Errati"
  if (tagName === "Dati Errati") {
    // 1. Marca contatto come "Da verificare" in GHL
    // 2. Crea task per team data quality
    // 3. Rimuovi da campagne attive
    // 4. Notifica supervisor
  }

  // Azione standard per altri tag
  const noteText = `🏷️ NUOVO TAG DA CLOUDTALK...`;
  const result = await addNoteToGHLContact(contact.id, noteText);

  return { ... };
}
```

### 4. Monitora Webhook Payloads
I payload webhook vengono salvati automaticamente in:
```
webhook-payloads/cloudtalk/new-tag/
└── webhook_[timestamp]_[call_id].json
```

Puoi analizzarli per debugging e ottimizzazione.

---

## 📊 Statistiche Sistema

### Dati Raccolti dall'Analisi

**Etichette totali**: 69
**Chiamate recenti analizzate**: 20
**Chiamate con etichette**: 0 (nelle ultime 20)

**Osservazione**: Nessuna delle ultime 20 chiamate ha etichette applicate.
**Implicazione**: Le etichette potrebbero essere sottoutilizzate o applicate manualmente solo in casi specifici.

---

## 🛠️ Testing

### Test Manuale Applicazione Etichetta

1. **Fai una chiamata test** al numero +393513416607
2. **Applica etichetta "Follow Up"** manualmente in CloudTalk
3. **Verifica webhook** ricevuto nel middleware:
   ```bash
   tail -f server.log | grep "new-tag"
   ```
4. **Controlla payload salvato**:
   ```bash
   ls -lt webhook-payloads/cloudtalk/new-tag/ | head -1
   ```
5. **Verifica nota in GHL** per contatto Roberto

### Test via API (Senza CloudTalk UI)

```bash
# Test endpoint webhook direttamente
curl -X POST http://localhost:3000/api/cloudtalk-webhooks/new-tag \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": 1002226168,
    "external_number": "393513416607",
    "tag_name": "Follow Up Test",
    "agent_id": 493933
  }'
```

---

## 📚 Riferimenti Codice

### File Chiave per Sistema Tag

1. **Webhook Handler**: `src/routes/cloudtalk-webhooks.js:572`
2. **Tag Processor**: `API Squadd/webhook-to-ghl-processor.js:63-65, 371-389`
3. **Get Tags API**: `API CloudTalk/GET/get-tags.js`
4. **Add Tag API**: `API CloudTalk/PUT/put-add-tag.js`
5. **Add Tags to Contact**: `API CloudTalk/PUT/put-add-contact-tags.js`
6. **Webhook Validation**: `src/utils/webhook-validation.js:156`

---

## ✅ Conclusione

### Risposta alla Domanda: "Cosa Succede?"

**Quando applichi "Follow Up"**:
1. ✅ Tag salvato in CloudTalk (permanente)
2. ✅ Webhook inviato al middleware
3. ✅ Contatto cercato in GoHighLevel
4. ✅ Nota aggiunta al contatto GHL
5. ✅ Payload salvato per audit
6. ✅ Tag disponibile per filtri/report

**Quando applichi "Dati Errati"**:
- ⚠️ **Tag non esiste**: Devi crearlo prima
- ⚠️ **Nessuna automazione speciale**: Comportamento standard (nota in GHL)
- 💡 **Opportunità**: Puoi configurare azioni custom per questo tag

---

**Report generato automaticamente da Claude Code**
_Per domande o implementazioni custom, consulta il team dev_
