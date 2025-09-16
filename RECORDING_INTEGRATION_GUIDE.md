# 📼 CloudTalk Recording Integration Guide

**Data:** 2025-09-16T14:04:58Z  
**Feature:** Recording URL management tra CloudTalk e GoHighLevel

## 🎯 **Panoramica**

Il sistema integra **automaticamente** i link delle registrazioni CloudTalk in GoHighLevel tramite **due canali complementari**:

1. **📝 Note GoHighLevel** - Link diretto cliccabile
2. **📋 Custom Field GoHighLevel** - Dati strutturati per automazioni

## 🚀 **Come Funziona - 3 Strategie di Raccolta**

### **Strategy 1: Webhook call-ended (Automatico)**
La registrazione viene rilevata automaticamente quando la chiamata termina:

```javascript
// CloudTalk webhook call-ended payload
{
  "Call_id": "123456",
  "Call_duration": "120",
  "recording": true,
  "recording_url": "https://recordings.cloudtalk.io/123456.wav",
  "Contact_phone": "+393501234567"
}
```

### **Strategy 2: Webhook recording-available (Opzionale)**
Webhook dedicato quando la registrazione è processata:

```javascript
// CloudTalk webhook recording-available payload
{
  "Call_id": "123456", 
  "recording_url": "https://recordings.cloudtalk.io/123456.wav",
  "recording_format": "wav",
  "recording_size": "2.5MB",
  "Contact_phone": "+393501234567"
}
```

### **Strategy 3: API Fallback (Automatico)**
Se il webhook non ha l'URL, il sistema fetcha dalla CloudTalk API:

```javascript
// Auto-chiamata a CloudTalk API
GET /calls/123456/recording
// Recupera URL se disponibile
```

## 📝 **Integrazione nelle Note GoHighLevel**

### **Formato Note con Recording:**

```
[CloudTalk] Call completed - 
Contact: Mario Rossi (+393501234567), 
Duration: 120s, Status: completed, 
Agent: Roberto, Direction: outbound
📼 Recording: Available - 🔗 https://recordings.cloudtalk.io/123456.wav
Campaign: Sales Campaign 
Call ID: 123456 - 2025-09-16T14:04:58Z
```

### **Note Separata per Recording:**

```
[CloudTalk Recording] Call 123456 recording available
📼 Recording: Available (120s)
🔗 Listen: https://recordings.cloudtalk.io/123456.wav
Call Details: Roberto, 120s - 2025-09-16T14:04:58Z
```

## 📋 **Custom Field GoHighLevel**

### **Campo: `cloudtalk_last_recording`**
Dati JSON strutturati per l'ultima chiamata:

```json
{
  "recording_url": "https://recordings.cloudtalk.io/123456.wav",
  "recording_available": true,
  "call_id": "123456",
  "call_duration": 120,
  "recording_format": "wav",
  "updated_at": "2025-09-16T14:04:58Z"
}
```

### **Campo: `cloudtalk_recording_url`**
URL diretto per quick access:

```
https://recordings.cloudtalk.io/123456.wav
```

## ⚙️ **Configurazione CloudTalk**

### **Opzione 1: Solo call-ended (Consigliato)**
```
Event: Call Ended → https://your-domain.com/api/cloudtalk-webhooks/call-ended
```
✅ **Gestisce automaticamente le registrazioni nel call-ended webhook**

### **Opzione 2: call-ended + recording-available (Massima affidabilità)**
```
Event: Call Ended → https://your-domain.com/api/cloudtalk-webhooks/call-ended
Event: Recording Available → https://your-domain.com/api/cloudtalk-webhooks/recording-available  
```
✅ **Doppia garanzia per le registrazioni**

## 🧪 **Test degli Endpoint Recording**

### **Test call-ended con recording:**
```bash
curl -X POST https://your-domain.com/api/cloudtalk-webhooks/call-ended \
  -H "Content-Type: application/json" \
  -d '{
    "Call_id": "123456",
    "Call_duration": "120", 
    "Agent_name": "Roberto",
    "Contact_phone": "+393501234567",
    "Contact_name": "Mario Rossi",
    "recording": true,
    "recording_url": "https://recordings.cloudtalk.io/123456.wav"
  }'
```

### **Test recording-available:**
```bash
curl -X POST https://your-domain.com/api/cloudtalk-webhooks/recording-available \
  -H "Content-Type: application/json" \
  -d '{
    "Call_id": "123456",
    "recording_url": "https://recordings.cloudtalk.io/123456.wav",
    "recording_format": "wav",
    "recording_size": "2.5MB",
    "Contact_phone": "+393501234567",
    "Contact_name": "Mario Rossi"
  }'
```

## 🔗 **Gestione URL Recording**

### **Scenario 1: URL Diretto CloudTalk**
```javascript
// Se CloudTalk fornisce URL pubblico
recording_url: "https://recordings.cloudtalk.io/123456.wav"
// → Usato direttamente in GHL
```

### **Scenario 2: URL Autenticato via Proxy**
```javascript  
// Se serve autenticazione
recording_url: "https://your-domain.com/api/recordings/cloudtalk/123456"
// → Proxy che gestisce auth CloudTalk
```

### **Scenario 3: Fallback API**
```javascript
// Se webhook non ha URL
// → Auto-fetch da CloudTalk API
// → GET /calls/123456/recording  
```

## 🏷️ **Tag Automatici Applicati**

Quando una registrazione è processata, vengono aggiunti automaticamente:

- ✅ `CT-CallCompleted` - Chiamata completata
- ✅ `CT-RecordingAvailable` - Registrazione disponibile  
- ✅ `CT-RecordingReady` - Registrazione pronta (se webhook separato)
- ✅ `CT-OUTBOUND` / `CT-INBOUND` - Direzione chiamata
- ✅ `CT-COMPLETED` / `CT-FAILED` - Outcome chiamata

## 🎯 **Benefici Business**

### **Per Sales Team:**
- 🎧 **Accesso immediato** alle registrazioni dal CRM
- 📊 **Context completo** - chiamata + registrazione in un posto  
- 🚀 **Follow-up migliore** con dettagli precisi della conversazione

### **Per Training:**
- 📚 **Repository centralizzato** delle chiamate in GHL
- 🎯 **Performance analysis** con accesso diretto alle registrazioni
- 📈 **Quality assurance** streamlined

### **Per Compliance:**
- 📋 **Audit trail completo** con timestamp e agent
- 🔒 **Tracciabilità** completa delle interazioni
- ⚖️ **GDPR compliant** con link diretti

## 🔧 **Configurazione Custom Field GHL**

Per utilizzare i custom field, assicurati di avere in GoHighLevel:

### **Campo 1: `cloudtalk_last_recording` (JSON)**
- **Tipo:** Long Text / JSON
- **Scopo:** Dati strutturati completi
- **Uso:** Automazioni e workflow

### **Campo 2: `cloudtalk_recording_url` (URL)**  
- **Tipo:** URL / Text
- **Scopo:** Link diretto
- **Uso:** Quick access e email templates

## 📈 **Utilizzo Avanzato**

### **Automazioni GHL con Recording:**
```javascript
// Trigger: Custom field cloudtalk_recording_url updated
// Action: Send email con link registrazione al contatto
// Template: "La tua chiamata con {{agent}} è disponibile: {{recording_url}}"
```

### **Workflow Training:**
```javascript  
// Trigger: Tag CT-CallCompleted added
// Condition: Call duration > 60s
// Action: Add to "Training Review" pipeline con recording link
```

## 🚧 **Implementazione GoHighLevel API**

I placeholder attuali devono essere sostituiti con:

```javascript
// Custom field update
async function updateGHLCustomField(contactId, fieldName, fieldValue) {
  const response = await fetch(`https://api.gohighlevel.com/v1/contacts/${contactId}/custom-fields`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GHL_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      [fieldName]: fieldValue
    })
  });
  return response.json();
}
```

## 🎯 **Conclusione**

**La gestione registrazioni è ora completamente integrata!**

✅ **Automatic detection** - da webhook call-ended  
✅ **Dual storage** - note + custom field  
✅ **Fallback strategies** - API fetch se necessario  
✅ **Optional dedicated webhook** - recording-available  
✅ **Business-ready** - training, compliance, sales  

**Ready to capture and leverage every call recording!** 📼🚀