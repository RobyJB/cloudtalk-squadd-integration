# 🎯 Sistema Lead-to-Call con Distribuzione Round Robin

**Data creazione:** 2025-09-17  
**Sistema:** Middleware GoHighLevel ↔ CloudTalk  
**Feature:** Distribuzione automatica lead e chiamata immediata

---

## 📋 Panoramica

Questo sistema implementa un **flusso automatico completo** per i lead che arrivano da GoHighLevel:

1. **Webhook GHL** → Nuovo contatto
2. **Creazione contatto** in CloudTalk  
3. **Distribuzione round robin** tra agenti disponibili
4. **Chiamata automatica** istantanea
5. **Tracking completo** performance e metriche

## 🚀 Caratteristiche Principali

### ✅ **Distribuzione Intelligente**
- **Round Robin** equo tra agenti disponibili
- **Controllo real-time** status agenti (online/offline/busy)
- **Persistenza stato** per continuità tra restart
- **Failover automatico** se agente non disponibile

### ✅ **Processo Automatizzato**
- **Lead → Contatto → Chiamata** tutto automatico
- **Gestione errori robusta** con retry logic
- **Tracking completo** di ogni step
- **Tempi di risposta ottimizzati** (<2 secondi)

### ✅ **Monitoring & Analytics**
- **Metriche real-time** performance sistema
- **Analytics dettagliati** per periodo
- **Tracking distribuzione** per agente
- **Export dati** per reportistica

---

## 🏗️ Architettura Sistema

```
📞 GoHighLevel Webhook
    ↓
🎯 /api/ghl-webhooks/new-contact
    ↓
🔄 AgentDistributionService
    ↓ (Round Robin)
👤 Agente Selezionato
    ↓
📋 CloudTalk Contact Creation
    ↓
📞 CloudTalk Make Call API
    ↓
📊 Lead Tracking Logger
```

### 📁 **Struttura File**

```
src/
├── services/
│   ├── agent-distribution-service.js    # Gestione agenti + round robin
│   ├── lead-to-call-service.js         # Processo completo lead→call  
│   └── lead-tracking-logger.js         # Tracking + analytics
├── routes/
│   └── ghl-webhooks.js                 # Endpoint webhook GHL
└── data/
    └── agent-distribution-state.json   # Stato persistente round robin

logs/lead-distribution/
├── lead-distribution-YYYY-MM-DD.jsonl  # Log processi (JSONL format)
└── metrics-YYYY-MM-DD.json             # Metriche giornaliere
```

---

## ⚙️ Configurazione

### **1. Prerequisiti**
- ✅ API CloudTalk configurata (`API CloudTalk/config.js`)
- ✅ Almeno un agente CloudTalk online
- ✅ Webhook GoHighLevel configurato

### **2. Endpoint Webhook GHL**

Configura questo URL nel tuo GoHighLevel:

```
POST https://your-domain.com/api/ghl-webhooks/new-contact
```

**Trigger:** Nuovo contatto creato

### **3. Test Sistema**

```bash
# Test completo (include chiamata reale!)
node tests/test-lead-to-call-system.js

# Test specifico distribuzione
node tests/test-agent-distribution.js
```

---

## 📊 Endpoint API Disponibili

### **🎯 Webhook Principale**
```http
POST /api/ghl-webhooks/new-contact
Content-Type: application/json

{
  "id": "ghl-contact-123",
  "name": "Mario Rossi",
  "firstName": "Mario",
  "lastName": "Rossi", 
  "phone": "+393501234567",
  "email": "mario@example.com",
  "company": "Azienda SpA"
}
```

**Risposta Success (200):**
```json
{
  "success": true,
  "message": "Lead processato con successo - Chiamata iniziata",
  "processId": "lead_123456789",
  "selectedAgent": {
    "id": 493933,
    "name": "Roberto Bondici Priority",
    "extension": 1001
  },
  "callInitiated": true,
  "steps": {
    "contactCreated": true,
    "agentSelected": true, 
    "callStarted": true
  }
}
```

**Risposta Error (503 - No agents):**
```json
{
  "success": false,
  "message": "Lead-to-Call fallito: Nessun agente disponibile",
  "error": "NO_AGENTS_AVAILABLE",
  "availableAgents": 0,
  "steps": {
    "contactCreated": true,
    "agentSelected": false,
    "callStarted": false
  }
}
```

### **📊 Monitoring Endpoints**

#### **Stats Real-time**
```http
GET /api/ghl-webhooks/stats
```

#### **Analytics Dettagliati**
```http
GET /api/ghl-webhooks/analytics?startDate=2025-09-17&endDate=2025-09-17
```

#### **Processi Recenti**
```http
GET /api/ghl-webhooks/recent-processes?limit=20
```

#### **Health Check**
```http
GET /api/ghl-webhooks/health
```

---

## 🔄 Algoritmo Round Robin

### **Logica di Distribuzione:**

1. **Recupera agenti disponibili** (status = 'online')
2. **Trova ultimo agente utilizzato** (da stato persistente) 
3. **Seleziona prossimo agente** nella sequenza
4. **Aggiorna stato** e salva su disco
5. **Wrap-around** automatico (torna al primo dopo l'ultimo)

### **Gestione Edge Cases:**
- **Primo lead:** Seleziona primo agente disponibile
- **Ultimo agente offline:** Salta al prossimo online
- **Nessun agente online:** Ritorna errore `NO_AGENTS_AVAILABLE`
- **Solo un agente:** Assegna sempre a lui

### **Esempio Distribuzione:**
```
Agenti online: [Alice, Bob, Charlie]

Lead 1 → Alice   (primo)
Lead 2 → Bob     (round robin)  
Lead 3 → Charlie (round robin)
Lead 4 → Alice   (wrap-around)
Lead 5 → Bob     (continua...)
```

---

## 📈 Tracking & Analytics

### **Metriche Tracciate:**

#### **📊 Per Processo:**
- ✅ Success/failure rate
- ⏱️ Tempo elaborazione  
- 🎯 Agente selezionato
- 📞 Risultato chiamata
- 📋 Step completati

#### **👥 Per Agente:**
- 📈 Lead assegnati totali
- ✅ Chiamate riuscite
- ❌ Chiamate fallite  
- 📊 Success rate percentuale

#### **🕐 Temporali:**
- 📅 Distribuzione giornaliera
- 🕐 Distribuzione oraria
- 📈 Trend performance

### **File di Log:**

#### **JSONL Format** (`lead-distribution-YYYY-MM-DD.jsonl`)
Ogni riga = 1 processo completo in JSON:
```json
{
  "timestamp": "2025-09-17T10:30:45.123Z",
  "processId": "lead_1234567890", 
  "type": "LEAD_PROCESS",
  "success": true,
  "finalStatus": "CALL_INITIATED_SUCCESSFULLY",
  "processingTime": 1250,
  "lead": {
    "id": "ghl-123",
    "name": "Mario Rossi", 
    "phone": "+393501234567"
  },
  "steps": {
    "contactCreation": {"success": true, "contactId": 1451361270},
    "agentDistribution": {"success": true, "selectedAgentId": 493933, "selectedAgentName": "Roberto Bondici"},
    "callInitiation": {"success": true}
  },
  "metadata": {
    "dayOfWeek": 2,
    "hourOfDay": 10
  }
}
```

#### **Metriche JSON** (`metrics-YYYY-MM-DD.json`)
Summary giornaliero aggregato:
```json
{
  "date": "2025-09-17",
  "totalProcesses": 45,
  "successfulCalls": 38, 
  "failedCalls": 7,
  "successRate": "84.44",
  "errorsByType": {
    "NO_AGENTS_AVAILABLE": 5,
    "INVALID_PHONE": 2
  },
  "agentStats": {
    "493933": {
      "name": "Roberto Bondici",
      "totalAssigned": 15,
      "successfulCalls": 13,
      "failedCalls": 2
    }
  }
}
```

---

## 🛠️ Gestione Errori

### **Tipi di Errore:**

| Codice | Significato | HTTP Status | Azione |
|--------|-------------|-------------|---------|
| `NO_AGENTS_AVAILABLE` | Nessun agente online | 503 | Retry più tardi |
| `MISSING_PHONE` | Telefono mancante nel lead | 400 | Fix dati GHL |
| `CONTACT_CREATION_FAILED` | Errore creazione contatto CT | 422 | Check API CT |
| `AGENT_NOT_AVAILABLE` | Agente non disponibile | 503 | Retry automatico |
| `AGENT_BUSY` | Agente impegnato | 503 | Round robin next |
| `INVALID_PHONE` | Numero telefono non valido | 400 | Fix formato |
| `CALL_FAILED` | Errore generico chiamata | 500 | Check logs |

### **Retry Logic:**
- ✅ **Automatic retry** per errori temporanei
- ✅ **Agent reselection** se primo non disponibile
- ✅ **Max 2 retry** per evitare loop
- ✅ **Fallback graceful** con log dettagliato

---

## 🧪 Testing

### **Test Suite Completa:**
```bash
node tests/test-lead-to-call-system.js
```

**Cosa testa:**
1. ✅ Inizializzazione servizi
2. ✅ Controllo agenti disponibili  
3. ✅ Distribuzione round robin
4. ✅ Processo completo lead-to-call
5. ✅ Tracking e metriche
6. ✅ Analytics e reporting
7. ✅ Simulazione webhook

**⚠️ ATTENZIONE:** Il test effettua **chiamate reali** se ci sono agenti online!

### **Test Singoli:**
```bash
# Solo distribuzione agenti
node tests/test-agent-distribution.js

# Solo tracking
node tests/test-tracking-logger.js

# Webhook simulato
curl -X POST http://localhost:3000/api/ghl-webhooks/new-contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Lead","phone":"+393513416607","email":"test@example.com"}'
```

---

## 📊 Monitoring in Produzione

### **Dashboard URLs:**
- **Health:** `GET /api/ghl-webhooks/health`
- **Stats:** `GET /api/ghl-webhooks/stats` 
- **Analytics:** `GET /api/ghl-webhooks/analytics`
- **Recent:** `GET /api/ghl-webhooks/recent-processes`

### **Metriche Chiave da Monitorare:**
1. **📈 Success Rate** (>85% ideale)
2. **⏱️ Response Time** (<2000ms ideale) 
3. **👥 Agents Available** (>0 sempre)
4. **📞 Call Success Rate** (>80% ideale)
5. **🔄 Distribution Balance** (equo tra agenti)

### **Alerting Suggerito:**
```bash
# Success rate < 80%
# Response time > 5000ms  
# No agents available > 5min
# Call failures > 20%
```

---

## 🔧 Manutenzione

### **Log Retention:**
```javascript
// Auto-cleanup log vecchi (30 giorni)
await leadTrackingLogger.cleanupOldLogs(30);
```

### **Reset Round Robin:**
```javascript
// Reset stato distribuzione
await agentDistributionService.resetDistributionState();
```

### **Backup Dati:**
```bash
# Backup stato e logs
tar -czf lead-system-backup-$(date +%Y%m%d).tar.gz \
  data/agent-distribution-state.json \
  logs/lead-distribution/
```

---

## 🚨 Troubleshooting

### **🔍 Problemi Comuni:**

#### **"NO_AGENTS_AVAILABLE"**
- ✅ Verifica agenti online in CloudTalk
- ✅ Check API CloudTalk connectivity  
- ✅ Verifica credential API

#### **"CONTACT_CREATION_FAILED"**
- ✅ Check format dati lead da GHL
- ✅ Verifica API CloudTalk bulk endpoint
- ✅ Check quota/limits CloudTalk

#### **"CALL_FAILED"**
- ✅ Verifica formato numero telefono (E.164)
- ✅ Check disponibilità agente selected
- ✅ Verifica credit CloudTalk

#### **Round Robin Sbilanciato:**
- ✅ Check file `agent-distribution-state.json`
- ✅ Reset distribuzione se necessario
- ✅ Verifica log distribuzione

### **🔍 Debug Mode:**
```bash
# Enable verbose logging
DEBUG=lead-to-call:* node your-app.js

# Check specific service
DEBUG=agent-distribution node your-app.js
```

---

## 🎯 Roadmap Future

### **📋 Prossimi Miglioramenti:**
- [ ] **Weighted Round Robin** (priorità agenti)
- [ ] **Skills-based routing** (lingua, specializzazione)  
- [ ] **Time-based distribution** (orari lavoro)
- [ ] **Load balancing avanzato** (chiamate concurrent)
- [ ] **Dashboard web** per monitoring
- [ ] **Webhook retry queue** con Redis
- [ ] **Machine learning** prediction miglior agente

### **🔧 Ottimizzazioni Tecniche:**
- [ ] **Caching agenti status** (Redis)
- [ ] **Async processing** con queue
- [ ] **Horizontal scaling** support
- [ ] **Advanced metrics** (Prometheus)
- [ ] **Circuit breaker** pattern
- [ ] **Rate limiting** intelligente

---

## ✅ Conclusioni

**Il sistema Lead-to-Call è COMPLETO e PRONTO per produzione!**

### **🎯 Caratteristiche Implementate:**
✅ **Distribuzione round robin** intelligente  
✅ **Chiamate automatiche** istantanee  
✅ **Tracking completo** performance  
✅ **Gestione errori** robusta  
✅ **Analytics dettagliati**  
✅ **API monitoring** complete  
✅ **Test suite** completa  

### **🚀 Ready to Deploy:**
1. **Configure GoHighLevel webhook** → `/new-contact` endpoint
2. **Ensure CloudTalk agents online** 
3. **Monitor via `/health` and `/stats`** 
4. **Check analytics** daily via `/analytics`

**Il sistema distribuirà automaticamente ogni nuovo lead GHL al prossimo agente disponibile e inizierà la chiamata istantaneamente!** 📞✨

---

*Sistema creato il 2025-09-17 da Agent Mode per ottimizzazione distribuzione lead e performance call center.*