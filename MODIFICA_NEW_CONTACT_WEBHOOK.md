# ✅ Modifica Webhook `/api/ghl-webhooks/new-contact`

**Data**: 28 Ottobre 2025
**Richiesta**: Webhook deve solo creare contatto su CloudTalk con tag "nuovo_lead", SENZA far partire chiamate

---

## 🔧 Modifiche Implementate

### 1. **Webhook Handler** (`src/routes/ghl-webhooks.js:46-118`)

**PRIMA**:
```javascript
// Faceva partire Lead-to-Call automatico
const processResult = await leadToCallService.processLeadToCallEnhanced(req.body);
// → Creava contatto + Selezionava agente + Faceva chiamata
```

**DOPO**:
```javascript
// Crea SOLO contatto con tag "nuovo_lead"
const createResult = await createContactOnly(req.body);
// → Crea contatto + Tag "nuovo_lead" + STOP (no chiamata)
```

### 2. **Nuova Funzione** (`src/services/lead-to-call-service.js:616-729`)

Aggiunta funzione `createContactOnly()`:

```javascript
async createContactOnly(leadData) {
  // 1. Valida telefono
  if (!leadData.phone) {
    return { error: 'MISSING_PHONE' };
  }

  // 2. Costruisci contatto con tag "nuovo_lead"
  const contactData = {
    name: fullName,
    company: 'GoHighLevel Lead',
    ContactNumber: [{ public_number: leadData.phone }],
    ContactEmail: [{ email: leadData.email }],
    ContactsTag: [
      { name: 'nuovo_lead' }  // ← TAG RICHIESTO
    ]
  };

  // 3. Mappa custom fields (Squadd ID, chiamate totali)
  if (leadData.contact_id) {
    contactData.ContactAttribute.push({
      attribute_id: "10133",
      value: leadData.contact_id
    });
  }

  // 4. Crea contatto su CloudTalk (PUT /contacts/add.json)
  const response = await makeCloudTalkRequest(...);

  // 5. Ritorna successo (NO chiamata automatica)
  return {
    success: true,
    contactId: contactId,
    contactName: contactData.name,
    phoneNumber: leadData.phone,
    tag: 'nuovo_lead'
  };
}
```

---

## 📊 Comportamento Webhook

### URL
```
POST https://webhooks.squaddcrm.com/api/ghl-webhooks/new-contact
```

### Input (Payload GHL)
```json
{
  "contact_id": "ghl_abc123",
  "first_name": "Mario",
  "last_name": "Rossi",
  "phone": "+393331234567",
  "email": "mario.rossi@example.com",
  "company": "Azienda SRL",
  "customData": {
    "totaleChiamate": "5"
  }
}
```

### Output Success
```json
{
  "success": true,
  "message": "Contatto creato su CloudTalk con tag \"nuovo_lead\"",
  "contact": {
    "id": 123456,
    "name": "Mario Rossi",
    "phone": "+393331234567"
  },
  "tag": "nuovo_lead",
  "callInitiated": false,
  "timestamp": "2025-10-28T19:45:30Z",
  "payloadSaved": true
}
```

### Output Error (Numero Mancante)
```json
{
  "success": false,
  "message": "Errore creazione contatto: Numero di telefono mancante nel payload",
  "error": "MISSING_PHONE",
  "phoneNumber": null,
  "timestamp": "2025-10-28T19:45:30Z",
  "payloadSaved": true
}
```

### Output Error (Contatto Duplicato)
```json
{
  "success": false,
  "message": "Errore creazione contatto: Contatto già esistente su CloudTalk",
  "error": "CONTACT_ALREADY_EXISTS",
  "phoneNumber": "+393331234567",
  "timestamp": "2025-10-28T19:45:30Z",
  "payloadSaved": true
}
```

---

## ✅ Cosa FA il Webhook

1. ✅ **Riceve payload** da GoHighLevel
2. ✅ **Salva payload** in `webhook-payloads/ghl/new-contact/`
3. ✅ **Valida telefono** (required)
4. ✅ **Crea contatto** su CloudTalk con:
   - Nome completo (first_name + last_name)
   - Numero di telefono
   - Email (opzionale)
   - Azienda
   - **Tag "nuovo_lead"** ← CRITICO
5. ✅ **Mappa custom fields**:
   - `contact_id` → Campo "Squadd ID" (attribute_id: 10133)
   - `customData.totaleChiamate` → Campo "# di chiamate totali" (attribute_id: 10135)
6. ✅ **Risponde con successo**

---

## ❌ Cosa NON FA il Webhook

1. ❌ **NON seleziona agenti** (nessun round robin)
2. ❌ **NON controlla disponibilità agenti**
3. ❌ **NON fa partire chiamate** automatiche
4. ❌ **NON usa servizio agent distribution**
5. ❌ **NON usa tag "GHL Lead"** o "Immediate Call" (vecchi tag)

---

## 🔍 Verifica Modifica

### Test Manuale

```bash
# 1. Avvia server
npm start

# 2. Invia test webhook
curl -X POST https://webhooks.squaddcrm.com/api/ghl-webhooks/new-contact \
  -H "Content-Type: application/json" \
  -d '{
    "contact_id": "test_123",
    "first_name": "Test",
    "last_name": "User",
    "phone": "+393331234567",
    "email": "test@example.com"
  }'

# 3. Verifica response
# Dovrebbe rispondere con:
# {
#   "success": true,
#   "message": "Contatto creato su CloudTalk con tag \"nuovo_lead\"",
#   "tag": "nuovo_lead",
#   "callInitiated": false  ← IMPORTANTE
# }

# 4. Verifica su CloudTalk
# - Cerca contatto per numero +393331234567
# - Verifica tag "nuovo_lead" applicato
# - Verifica che NON ci siano chiamate automatiche partite
```

### Check Logs

```bash
# Cerca log creazione contatto
tail -f server.log | grep "nuovo_lead"

# Output atteso:
# 👤 Creazione contatto CloudTalk SENZA chiamata automatica
# 📝 Creando contatto: Test User con tag "nuovo_lead"
# ✅ Contatto creato con successo: ID 123456, Tag: "nuovo_lead"
```

### Verifica CloudTalk API

```bash
# Cerca contatto creato
node "API CloudTalk/GET/get-contacts.js"

# Cerca per tag "nuovo_lead"
# Verifica che il contatto sia presente
```

---

## 📈 Statistiche Health Check

Nuovo endpoint health mostra configurazione:

```bash
GET https://webhooks.squaddcrm.com/api/ghl-webhooks/health
```

Response:
```json
{
  "service": "GHL → CloudTalk Webhooks",
  "status": "active",
  "endpoints": {
    "/new-contact": "ACTIVE - Creazione contatto con tag \"nuovo_lead\" (NO chiamata automatica)",
    "/new-tag": "placeholder",
    "/update-total-calls": "ACTIVE - Aggiornamento chiamate totali CloudTalk"
  }
}
```

---

## 🔄 Migrazione dal Vecchio Sistema

### Vecchio Comportamento (DEPRECATO)
```
GHL Webhook → new-contact
    ↓
1. Crea contatto (tag: "GHL Lead", "Immediate Call")
2. Seleziona agente con round robin
3. Controlla disponibilità agente
4. Fa partire chiamata automatica CloudTalk
5. Gestisce fallback se agente occupato
```

### Nuovo Comportamento (ATTUALE)
```
GHL Webhook → new-contact
    ↓
1. Crea contatto (tag: "nuovo_lead")
2. FINE (no chiamata automatica)
```

---

## ⚠️ Breaking Changes

### Per Automazioni Esterne

Se avevi automazioni che si aspettavano:
```json
{
  "callInitiated": true,
  "selectedAgent": { ... }
}
```

Ora riceverai:
```json
{
  "callInitiated": false,
  "tag": "nuovo_lead"
}
```

### Per Campagne CloudTalk

Se avevi campagne che si attivavano automaticamente con tag:
- **"GHL Lead"** → NON più applicato
- **"Immediate Call"** → NON più applicato
- **"nuovo_lead"** → NUOVO tag applicato

⚠️ **Aggiorna le campagne** CloudTalk per usare tag "nuovo_lead" se necessario

---

## 🚀 Vantaggi Nuovo Sistema

1. ✅ **Più controllo**: Chiamate non partono automaticamente
2. ✅ **Più flessibile**: Puoi decidere quando chiamare (manualmente o con campagne)
3. ✅ **Più tracciabile**: Tag "nuovo_lead" identifica chiaramente nuovi contatti
4. ✅ **Meno errori**: No fallimenti per agenti non disponibili
5. ✅ **Più semplice**: Logica webhook più chiara e manutenibile

---

## 🛠️ Rollback (Se Necessario)

Se vuoi tornare al vecchio sistema con chiamate automatiche:

1. Ripristina webhook handler originale
2. Usa funzione `processLeadToCallEnhanced()` invece di `createContactOnly()`
3. Rimuovi tag "nuovo_lead", ripristina "GHL Lead" + "Immediate Call"

**File da modificare**:
- `src/routes/ghl-webhooks.js` (linea 46-118)

---

## 📞 Contatti

Per domande o problemi:
- Controlla log: `tail -f server.log`
- Health check: `GET /api/ghl-webhooks/health`
- Debug agents: `GET /api/ghl-webhooks/debug-agents`

---

**Modifica implementata e testata**
_Ready for production deployment_
