# CloudTalk Campaign Automation - Proposta Sistema Lead Progression

## 📋 **Panoramica del Sistema**

Sistema di automazione per CloudTalk che gestisce la progressione automatica dei lead attraverso tre tipologie di campagne basate sul numero di tentativi di chiamata e risposta del contatto.

## 🎯 **Obiettivi del Sistema**

### **Flusso Lead:**
1. **GoHighLevel** invia nuovi lead → **CloudTalk Lead Nuovi**
2. Dopo 3 tentativi senza risposta → **CloudTalk Lead Recenti**
3. Dopo 10 tentativi senza risposta → **CloudTalk Mancata Risposta**

### **Assegnazione Setter:**
- **Lead Nuovi/Recenti**: Campagne dedicate per ogni setter
- **Mancata Risposta**: Campagna condivisa tra tutti i setter

## 📊 **Endpoint CloudTalk Utilizzati**

Dal codebase esistente sono disponibili:
- **GET** `/campaigns/index.json` - Lista campagne esistenti
- **PUT** `/campaigns/add.json` - Crea nuove campagne
- **POST** `/campaigns/edit/{id}.json` - Modifica campagne esistenti

## 🎯 **Parametri Chiave CloudTalk**

### **Controllo Tentativi**
- `attempts` - Numero massimo di tentativi per contatto
- `attempts_interval` - Ore tra un tentativo e l'altro

### **Automazione Chiamate**
- `after_call_dialing_auto` - Composizione automatica del prossimo contatto
- `after_call_time` - Tempo di pausa tra chiamate
- `answer_wait_time` - Secondi di attesa per risposta

### **Assegnazione Team**
- `Agent` - Array di agenti assegnati alla campagna
- `Group` - Gruppi di agenti (per campagna condivisa)

## 🏗️ **Struttura Campagne Proposta**

### **1. Campagna Lead Nuovi (Per Setter)**

```javascript
{
  name: "Lead Nuovi - [Nome Setter]",
  status: "active",
  attempts: 3,                    // MAX 3 tentativi
  attempts_interval: 24,          // 24 ore tra tentativi
  answer_wait_time: 30,           // 30 secondi attesa risposta
  after_call_dialing_auto: true,  // Auto-dial prossimo contatto
  after_call_time: 10,            // 10 secondi pausa tra chiamate
  is_recording: true,             // Registra chiamate
  Agent: [{ id: setter_agent_id }], // Assegnato al setter specifico
  Button: [
    {
      title: "Contatto Raggiunto",
      type: "successful_positive",
      color: "#2ECC71",
      description: "Lead ha risposto e completato"
    },
    {
      title: "Non Risposto",
      type: "no_answer",
      color: "#95A5A6",
      description: "Nessuna risposta - continua tentativi"
    },
    {
      title: "Richiama",
      type: "callback",
      color: "#F39C12",
      description: "Programma callback specifico"
    },
    {
      title: "Non Interessato",
      type: "not_interested",
      color: "#E74C3C",
      description: "Lead non interessato al servizio"
    }
  ]
}
```

### **2. Campagna Lead Recenti (Per Setter)**

```javascript
{
  name: "Lead Recenti - [Nome Setter]",
  status: "active",
  attempts: 10,                   // MAX 10 tentativi
  attempts_interval: 12,          // 12 ore tra tentativi (più frequenti)
  answer_wait_time: 25,           // 25 secondi attesa
  after_call_dialing_auto: true,
  after_call_time: 15,            // 15 secondi pausa (più lunga)
  is_recording: true,
  Agent: [{ id: setter_agent_id }], // Stesso setter del lead nuovo
  Button: [
    {
      title: "Contatto Raggiunto",
      type: "successful_positive",
      color: "#2ECC71",
      description: "Lead recente ha risposto"
    },
    {
      title: "Non Risposto",
      type: "no_answer",
      color: "#95A5A6",
      description: "Nessuna risposta - continua tentativi"
    },
    {
      title: "Occupato",
      type: "busy",
      color: "#E67E22",
      description: "Linea occupata - riprova"
    },
    {
      title: "Segreteria",
      type: "answering_machine",
      color: "#9B59B6",
      description: "Messaggio in segreteria"
    }
  ]
}
```

### **3. Campagna Mancata Risposta (Condivisa)**

```javascript
{
  name: "Mancata Risposta - Tutti i Setter",
  status: "active",
  attempts: 5,                    // 5 tentativi finali
  attempts_interval: 48,          // 48 ore tra tentativi (meno frequenti)
  answer_wait_time: 20,           // 20 secondi attesa
  after_call_dialing_auto: true,
  after_call_time: 20,            // 20 secondi pausa
  is_recording: true,
  Group: [{ id: all_setters_group_id }], // Tutti i setter possono accedere
  Button: [
    {
      title: "Recuperato",
      type: "successful_positive",
      color: "#1ABC9C",
      description: "Lead recuperato dopo mancate risposte"
    },
    {
      title: "Non Risposto",
      type: "no_answer",
      color: "#BDC3C7",
      description: "Ancora nessuna risposta"
    },
    {
      title: "Numero Errato",
      type: "wrong_number",
      color: "#E74C3C",
      description: "Numero di telefono non valido"
    },
    {
      title: "Non Chiamare",
      type: "do_not_call",
      color: "#C0392B",
      description: "Richiesta di non essere più chiamato"
    }
  ]
}
```

## ⚡ **Logica di Automazione**

### **Webhook Integration**
Il sistema utilizzerà i webhook CloudTalk per intercettare:

```javascript
// Eventi webhook da CloudTalk
const webhookEvents = {
  'call-ended': handleCallEnded,
  'campaign-contact-exhausted': moveToNextCampaign,
  'contact-max-attempts-reached': progressContact
};

// Gestione progressione automatica
async function progressContact(contactId, currentCampaign, attemptCount) {
  if (currentCampaign.includes('Lead Nuovi') && attemptCount >= 3) {
    await moveContactToCampaign(contactId, 'lead-recenti-campaign-id');
  }
  else if (currentCampaign.includes('Lead Recenti') && attemptCount >= 10) {
    await moveContactToCampaign(contactId, 'mancata-risposta-campaign-id');
  }
}
```

### **API Integration Flow**

```javascript
// 1. Creazione campagne per ogni setter
const setters = ['Setter1', 'Setter2', 'Setter3'];

for (const setter of setters) {
  await createCampaign('Lead Nuovi', setter);
  await createCampaign('Lead Recenti', setter);
}
await createSharedCampaign('Mancata Risposta');

// 2. Assegnazione automatica lead da GoHighLevel
async function assignNewLead(leadData, setterName) {
  const campaignId = getCampaignId('Lead Nuovi', setterName);
  await addContactToCampaign(leadData, campaignId);
}

// 3. Movimento tra campagne
async function moveContactToCampaign(contactId, targetCampaignId) {
  await removeContactFromCurrentCampaign(contactId);
  await addContactToCampaign(contactId, targetCampaignId);
  console.log(`📈 Contatto ${contactId} spostato in campagna ${targetCampaignId}`);
}
```

## 🚀 **Implementazione nel Codebase Esistente**

### **File da Utilizzare:**
- ✅ `API CloudTalk/PUT/put-add-campaign.js` - Creazione campagne
- ✅ `API CloudTalk/POST/post-edit-campaign.js` - Modifica campagne
- ✅ `API CloudTalk/GET/get-campaigns.js` - Lista campagne esistenti
- ✅ `API CloudTalk/POST/post-bulk-contacts.js` - Gestione bulk contatti
- ✅ `cloudtalk-webhook-server.js` - Server webhook per automazione

### **Nuovi File da Creare:**
- `src/services/campaign-automation.js` - Logica progressione campagne
- `src/services/lead-assignment.js` - Assegnazione automatica lead
- `src/routes/ghl-integration.js` - Integrazione GoHighLevel

## 📈 **Vantaggi del Sistema**

### **Efficienza Operativa**
- ✅ Automazione completa del flusso lead
- ✅ Distribuzione equilibrata tra setter
- ✅ Ottimizzazione tempi di chiamata
- ✅ Tracciamento completo progressione

### **Gestione Intelligente**
- ✅ Lead freschi prioritari per setter dedicati
- ✅ Lead recenti con tentativi più frequenti
- ✅ Pool condiviso per massimo recupero
- ✅ Automazione basata su regole chiare

### **Monitoring e Analytics**
- ✅ Tracking completo tentativi per campagna
- ✅ Performance metrics per setter
- ✅ Tasso di conversione per tipologia lead
- ✅ Ottimizzazione basata sui dati

## 🔧 **Configurazione Raccomandata**

### **Timing Ottimizzato:**
- **Lead Nuovi**: 3 tentativi, 24h intervallo (72h totali)
- **Lead Recenti**: 10 tentativi, 12h intervallo (120h = 5 giorni)
- **Mancata Risposta**: 5 tentativi, 48h intervallo (240h = 10 giorni)

### **Orari Operativi:**
- Configurare schedule nelle campagne per orari lavorativi
- Rispettare fuso orario contatti
- Evitare chiamate in orari non appropriati

## ✅ **Conclusioni**

**Il sistema proposto è completamente fattibile** utilizzando le API CloudTalk esistenti nel tuo codebase. La logica di progressione automatica dei lead attraverso le tre tipologie di campagne può essere implementata immediatamente sfruttando:

1. **Infrastruttura esistente** - Tutti gli endpoint necessari sono già implementati
2. **Sistema webhook** - Automazione eventi già configurato
3. **Gestione contatti** - Bulk operations e assignment già disponibili
4. **Integrazione GoHighLevel** - Base per ricevere nuovi lead

La implementazione richiederà principalmente la creazione della logica di automazione che coordini i componenti esistenti per realizzare il flusso desiderato.