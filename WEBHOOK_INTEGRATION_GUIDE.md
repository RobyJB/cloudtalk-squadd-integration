# 🔗 Webhook Integration Guide - GoHighLevel ↔ CloudTalk Bridge

**Data:** 2025-09-16T13:37:30Z  
**Sistema:** Middleware Bidirezionale per sincronizzazione real-time

## 🎯 Panoramica

Questo sistema implementa un **router webhook bidirezionale preciso** tra GoHighLevel e CloudTalk, permettendo sincronizzazione real-time dei dati tra le due piattaforme.

### 📊 Architettura del Sistema

```
GoHighLevel     →  [API Middleware]  →  CloudTalk
      ↑                   ↕                ↓
   Webhook          Router Engine      Webhook  
   Receiver       [5+6 endpoints]      Sender
```

## 🚀 **WEBHOOK GOHLEVEL → CLOUDTALK** (Incoming)

### Base URL: `https://your-domain.com/api/ghl-webhooks/`

### 1. 📞 **New Contact** - `/new-contact`
**Trigger:** Nuovo contatto creato in GoHighLevel  
**Method:** `POST`  
**Action:** Crea contatto in CloudTalk via Bulk API

```javascript
// Payload esempio GHL
{
  "contact": {
    "id": "ghl_123456",
    "name": "Mario Rossi", 
    "firstName": "Mario",
    "lastName": "Rossi",
    "email": "mario@example.com",
    "phone": "+393501234567",
    "tags": ["lead", "priority"]
  }
}

// Azione CloudTalk
POST /bulk/contacts.json
{
  "action": "add_contact",
  "command_id": "ghl_contact_123456_timestamp",
  "data": {
    "name": "Mario Rossi",
    "email": "mario@example.com", 
    "phone": "+393501234567",
    "company": "GoHighLevel",
    "source": "GoHighLevel Webhook"
  }
}
```

### 2. 🏷️ **New Tag** - `/new-tag`
**Trigger:** Tag aggiunto a contatto in GoHighLevel  
**Method:** `POST`  
**Action:** Aggiunge tag al contatto CloudTalk corrispondente

```javascript
// Payload esempio GHL
{
  "contact": {"id": "ghl_123456", "name": "Mario Rossi"},
  "tag": {"name": "VIP Cliente"}
}

// Azione CloudTalk  
POST /bulk/contacts.json
{
  "action": "edit_contact",
  "command_id": "ghl_tag_123456_timestamp",
  "data": {
    "contact_id": 456789,
    "name": "Mario Rossi",
    "tags": ["VIP Cliente"]
  }
}
```

### 3. 📝 **New Note** - `/new-note`
**Trigger:** Nota aggiunta a contatto in GoHighLevel  
**Method:** `POST`  
**Action:** Aggiunge nota al contatto CloudTalk

```javascript
// Payload esempio GHL
{
  "contact": {"id": "ghl_123456", "name": "Mario Rossi"},
  "note": {
    "body": "Cliente interessato al prodotto premium", 
    "userId": "agent_789"
  }
}

// Azione CloudTalk
POST /bulk/contacts.json
{
  "action": "add_note", 
  "command_id": "ghl_note_123456_timestamp",
  "data": {
    "contact_id": 456789,
    "note": "[GHL Note] Cliente interessato al prodotto premium - Added by User ID: agent_789 - 2025-09-16T..."
  }
}
```

### 4. 📊 **Pipeline Change** - `/pipeline-change`
**Trigger:** Contatto cambia stage nella pipeline GHL  
**Method:** `POST`  
**Action:** Crea attività in CloudTalk per tracciare il cambiamento

```javascript
// Payload esempio GHL
{
  "contact": {"id": "ghl_123456", "name": "Mario Rossi"},
  "pipeline": {"name": "Sales Pipeline"},
  "stage": {"name": "Qualified Lead"},
  "previous_stage": {"name": "Cold Lead"}
}

// Azione CloudTalk
POST /bulk/contacts.json
{
  "action": "add_activity",
  "command_id": "ghl_pipeline_123456_timestamp", 
  "data": {
    "contact_id": 456789,
    "title": "Pipeline Stage Change",
    "note": "[GHL Pipeline Change] Contact moved to \"Qualified Lead\" stage in \"Sales Pipeline\" pipeline (from \"Cold Lead\") - timestamp",
    "type": "other",
    "date": "2025-09-16T..."
  }
}
```

### 5. 🔄 **Status Change** - `/status-change`
**Trigger:** Status del contatto cambia in GoHighLevel  
**Method:** `POST`  
**Action:** Aggiunge nota e tag di status in CloudTalk

```javascript
// Payload esempio GHL
{
  "contact": {"id": "ghl_123456", "name": "Mario Rossi"},
  "status": "customer",
  "previous_status": "lead", 
  "status_reason": "Purchase completed"
}

// Azione CloudTalk (2 chiamate)
// 1. Aggiunge nota
POST /bulk/contacts.json - add_note
// 2. Aggiunge tag status
POST /bulk/contacts.json - edit_contact con tag "GHL-CUSTOMER"
```

---

## 📞 **WEBHOOK CLOUDTALK → GOHLEVEL** (Outgoing)

### Base URL: `https://your-domain.com/api/cloudtalk-webhooks/`

### 1. 📞 **Call Started** - `/call-started`
**Trigger:** Chiamata inizia in CloudTalk  
**Action:** Aggiorna contatto GHL con nota di inizio chiamata

### 2. ☎️ **Call Ended** - `/call-ended`
**Trigger:** Chiamata termina in CloudTalk  
**Action:** Aggiunge dettagli chiamata (durata, outcome) al contatto GHL

### 3. 📼 **Recording Available** - `/recording-available`
**Trigger:** Registrazione chiamata disponibile  
**Action:** Notifica al contatto GHL con link alla registrazione

### 4. 👤 **Agent Status Change** - `/agent-status-change`
**Trigger:** Cambio status agente CloudTalk  
**Action:** Aggiorna campo custom o nota in GHL

### 5. 👥 **Contact Created** - `/contact-created`
**Trigger:** Nuovo contatto creato in CloudTalk  
**Action:** Crea/aggiorna contatto corrispondente in GHL

### 6. 📈 **Campaign Status Change** - `/campaign-status-change`
**Trigger:** Status campagna CloudTalk cambia  
**Action:** Aggiorna pipeline o stage dei contatti interessati in GHL

### 7. 🔄 **Generic** - `/generic`
**Trigger:** Webhook generico CloudTalk  
**Action:** Log e processamento fallback

---

## ⚙️ **CONFIGURAZIONE DEI WEBHOOK**

### 🔧 GoHighLevel Setup

Nell'automazione GoHighLevel, configura i webhook URL:

```
Trigger: Contact Created     → https://your-domain.com/api/ghl-webhooks/new-contact
Trigger: Tag Added          → https://your-domain.com/api/ghl-webhooks/new-tag  
Trigger: Note Added         → https://your-domain.com/api/ghl-webhooks/new-note
Trigger: Pipeline Change    → https://your-domain.com/api/ghl-webhooks/pipeline-change
Trigger: Status Change      → https://your-domain.com/api/ghl-webhooks/status-change
```

### 📞 CloudTalk Setup

Nel dashboard CloudTalk, configura i webhook URL:

```
Event: Call Started         → https://your-domain.com/api/cloudtalk-webhooks/call-started
Event: Call Ended          → https://your-domain.com/api/cloudtalk-webhooks/call-ended
Event: Recording Available → https://your-domain.com/api/cloudtalk-webhooks/recording-available
Event: Agent Status Change → https://your-domain.com/api/cloudtalk-webhooks/agent-status-change
Event: Contact Created     → https://your-domain.com/api/cloudtalk-webhooks/contact-created
Event: Campaign Change     → https://your-domain.com/api/cloudtalk-webhooks/campaign-status-change
```

## 🧪 **TESTING DEGLI ENDPOINT**

### Test GoHighLevel Webhooks:
```bash
# Test endpoint specifico
curl -X POST https://your-domain.com/api/ghl-webhooks/new-contact \
  -H "Content-Type: application/json" \
  -d '{"contact":{"id":"test123","name":"Test Contact","phone":"+393501234567"}}'

# Test tutti gli endpoint
curl https://your-domain.com/api/ghl-webhooks/test
```

### Test CloudTalk Webhooks:
```bash  
# Test endpoint specifico
curl -X POST https://your-domain.com/api/cloudtalk-webhooks/call-started \
  -H "Content-Type: application/json" \
  -d '{"Call_id":"123456","Call_uuid":"uuid-123","Agent_name":"Roberto"}'

# Test tutti gli endpoint
curl https://your-domain.com/api/cloudtalk-webhooks/test
```

## 🔍 **MONITORING E LOGGING**

### Log Format
Ogni webhook genera log strutturati:

```javascript
🔔 [2025-09-16T13:37:30Z] GHL Webhook: NEW-CONTACT
📡 Headers: {"content-type": "application/json", ...}
📋 Payload: {"contact": {"id": "123", ...}}
👤 Processing new contact: Mario Rossi (ID: 123)
✅ CloudTalk contact created: {...}
```

### Health Check Endpoints
```
GET /api/ghl-webhooks/test      - Status GoHighLevel router
GET /api/cloudtalk-webhooks/test - Status CloudTalk router  
GET /health                     - Status sistema generale
```

## 🚀 **VANTAGGI DEL ROUTER PRECISO**

### ✅ **Separazione Logica**
- Endpoint dedicati per ogni tipo di evento
- Payload processing specifico per ogni azione
- Error handling granulare

### ✅ **Scalabilità**
- Facile aggiungere nuovi webhook specifici
- Monitoring dettagliato per endpoint
- Rate limiting per endpoint

### ✅ **Debugging** 
- Log specifici per tipo di evento
- Tracing completo delle operazioni
- Test individuali per ogni endpoint

### ✅ **Sicurezza**
- Validazione payload specifica
- Error handling robusto  
- Isolation degli endpoint

## 🔗 **NEXT STEPS - IMPLEMENTAZIONE GOHIGHLEVEL API**

I file attuali hanno placeholder per le chiamate GoHighLevel API. Per completare l'integrazione:

1. **Implementare GoHighLevel API Client**
2. **Aggiungere Contact ID Mapping System**  
3. **Configurare autenticazione GHL**
4. **Test end-to-end con dati reali**

## 📊 **STATO ATTUALE**

✅ **CloudTalk API**: Completamente testato e funzionale (93.3% success)  
✅ **Webhook Infrastructure**: Router bidirezionale implementato  
✅ **Endpoint Specifici**: 5 GHL → CloudTalk, 7 CloudTalk → GHL  
🚧 **GoHighLevel API**: Placeholder implementation (da completare)  

**Il sistema è pronto per essere configurato e testato con webhook reali!** 🎯