# 📞 CloudTalk API System - Guida Completa per Sviluppatori

> **Per chi non capisce un cazzo di come usare le API CloudTalk** 😅

## 🚀 Quick Start (5 minuti e sei operativo)

### 1. Setup Iniziale
```bash
# Clona il progetto
git clone <repository-url>
cd api-middleware

# Installa dependencies
npm install

# Configura le credenziali nel file .env
cp .env.example .env
# Modifica .env con le tue credenziali CloudTalk
```

### 2. File .env - LE TUE CREDENZIALI
```env
# CloudTalk API Credentials (OBBLIGATORIE!)
CLOUDTALK_API_KEY_ID=F6LPM7KJFH3DVMU5LPZMGP
CLOUDTALK_API_SECRET=9GqBo8fnkkUcuGh7Ds%4sIgM5EqJpRysLSMvrI@1d

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 3. Test Rapido - Verifica che Tutto Funzioni
```bash
# Test tutti gli endpoint GET (lettura dati)
node API/GET/run-all-get-tests.js

# Test tutti gli endpoint POST (scrittura/azioni)
node API/POST/run-all-post-tests.js
```

## 📚 Come Funziona il Sistema

### 🏗️ Struttura del Progetto
```
api-middleware/
├── API/
│   ├── GET/              # Endpoint per LEGGERE dati
│   │   ├── get-agents.js       # Lista agenti
│   │   ├── get-calls.js        # Storia chiamate
│   │   ├── get-contacts.js     # Lista contatti
│   │   └── run-all-get-tests.js # Test tutti GET
│   │
│   ├── POST/             # Endpoint per SCRIVERE/AZIONI
│   │   ├── post-make-call.js       # Inizia chiamata
│   │   ├── post-edit-contact.js    # Modifica contatto
│   │   ├── post-bulk-contacts.js   # Operazioni bulk
│   │   └── run-all-post-tests.js   # Test tutti POST
│   │
│   ├── config.js         # Configurazione API CloudTalk
│   └── recording-integration.js # Gestione registrazioni
│
├── .env                  # LE TUE CREDENZIALI (non committare!)
└── README.md            # Questa guida
```

## 🔧 Come Usare le API - Esempi Pratici

### 📖 GET Endpoints (Leggere Dati)

#### 1. Ottenere Lista Agenti
```javascript
import { getAgents } from './API/GET/get-agents.js';

// Lista tutti gli agenti
const agents = await getAgents();

// Con filtri
const agentsLimited = await getAgents({ limit: 5 });
```

#### 2. Ottenere Chiamate
```javascript
import { getCalls } from './API/GET/get-calls.js';

// Ultime 10 chiamate
const calls = await getCalls({ limit: 10 });

// Chiamate di un numero specifico
const callsForNumber = await getCalls({
    public_external: '+393513416607',
    limit: 5
});

// Chiamate di oggi
const todayCalls = await getCalls({
    date_from: '2025-09-16 00:00:00',
    date_to: '2025-09-16 23:59:59'
});
```

#### 3. Ottenere Contatti
```javascript
import { getContacts } from './API/GET/get-contacts.js';

// Lista contatti
const contacts = await getContacts({ limit: 20 });
```

### ✍️ POST Endpoints (Azioni/Modifiche)

#### 1. Fare una Chiamata
```javascript
import { makeCall } from './API/POST/post-make-call.js';

// Chiama un numero
const result = await makeCall(493933, '+393513416607');
// 493933 = ID agente
// +393513416607 = numero da chiamare
```

#### 2. Aggiungere Contatti in Bulk
```javascript
import { bulkContacts } from './API/POST/post-bulk-contacts.js';

const operations = [{
    action: "add_contact",
    command_id: "mio_comando_" + Date.now(),
    data: {
        name: "Mario Rossi",
        title: "Cliente VIP",
        company: "Azienda ABC",
        ContactNumber: [
            { public_number: "+393334567890" }
        ],
        ContactEmail: [
            { email: "mario@azienda.com" }
        ]
    }
}];

const result = await bulkContacts(operations);
```

#### 3. Modificare un Contatto
```javascript
import { editContact } from './API/POST/post-edit-contact.js';

const contactId = 1431049073; // ID del contatto da modificare
const updatedData = {
    name: "Mario Rossi (Aggiornato)",
    ContactNumber: [
        { public_number: "+393334567890" }
    ]
};

const result = await editContact(contactId, updatedData);
```

## 🔐 Autenticazione - Come Funziona

Le API CloudTalk usano **Basic Authentication** con le tue credenziali:

```javascript
// Il sistema crea automaticamente l'header di autenticazione
const auth = Buffer.from(`${API_KEY_ID}:${API_SECRET}`).toString('base64');
const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json'
};
```

**Non devi fare niente tu** - è tutto automatico nel file `config.js`.

## 🌐 URL Base delle API

CloudTalk ha diversi endpoint:

```javascript
// API Standard (contatti, agenti, chiamate)
const BASE_URL = 'https://my.cloudtalk.io/api';

// API Analytics (dettagli chiamate)
const ANALYTICS_URL = 'https://analytics-api.cloudtalk.io/api';

// API AI (riassunti, sentiment, trascrizioni)
const AI_URL = 'https://api.cloudtalk.io/v1/ai';
```

## 📱 Esempio Completo - Flusso di Lavoro

```javascript
// 1. OTTENERE AGENTI DISPONIBILI
import { getAgents } from './API/GET/get-agents.js';
const agents = await getAgents({ limit: 1 });
const agentId = agents.responseData.data[0].Agent.id;

// 2. FARE UNA CHIAMATA
import { makeCall } from './API/POST/post-make-call.js';
const callResult = await makeCall(agentId, '+393513416607');

// 3. VERIFICARE CHIAMATE RECENTI
import { getCalls } from './API/GET/get-calls.js';
const recentCalls = await getCalls({
    public_external: '+393513416607',
    limit: 3
});

// 4. AGGIUNGERE CONTATTO SE NON ESISTE
import { bulkContacts } from './API/POST/post-bulk-contacts.js';
const newContact = [{
    action: "add_contact",
    command_id: "contact_" + Date.now(),
    data: {
        name: "Cliente da Chiamata",
        ContactNumber: [{ public_number: '+393513416607' }]
    }
}];
const contactResult = await bulkContacts(newContact);
```

## 🛠️ Test e Debug

### Test Automatici
```bash
# Test completo di tutti gli endpoint
node API/GET/run-all-get-tests.js    # Test lettura dati
node API/POST/run-all-post-tests.js  # Test azioni/modifiche
```

### Test Manuali Specifici
```bash
# Test singolo endpoint
node API/GET/get-agents.js           # Lista agenti
node API/GET/get-calls.js            # Lista chiamate
node API/POST/post-make-call.js      # Fare chiamata
```

### Debug - Se Qualcosa Non Funziona

#### 1. Errore 401 (Unauthorized)
```bash
❌ Errore: HTTP 401 Unauthorized
```
**Soluzione:** Controlla le credenziali nel file `.env`

#### 2. Errore 404 (Not Found)
```bash
❌ Errore: HTTP 404 Not Found
```
**Soluzione:** URL endpoint sbagliato, controlla `config.js`

#### 3. Errore 406 (Invalid Data)
```bash
❌ Errore: HTTP 406 Invalid input data
```
**Soluzione:** Dati richiesti mancanti, controlla i parametri obbligatori

## 🎯 Use Cases Pratici

### Caso 1: Sistema CRM con CloudTalk
```javascript
// Workflow automatico quando arriva una chiamata
async function handleIncomingCall(phoneNumber) {
    // 1. Cerca contatto esistente
    const calls = await getCalls({ public_external: phoneNumber });

    // 2. Se non esiste, crealo
    if (calls.responseData.itemsCount === 0) {
        await bulkContacts([{
            action: "add_contact",
            data: {
                name: "Nuovo Cliente",
                ContactNumber: [{ public_number: phoneNumber }]
            }
        }]);
    }

    // 3. Ottieni storico chiamate
    const history = await getCalls({
        public_external: phoneNumber,
        limit: 5
    });

    return history;
}
```

### Caso 2: Report Automatici
```javascript
// Report giornaliero chiamate
async function dailyCallReport(date) {
    const calls = await getCalls({
        date_from: `${date} 00:00:00`,
        date_to: `${date} 23:59:59`,
        limit: 1000
    });

    return {
        totalCalls: calls.responseData.itemsCount,
        answered: calls.responseData.data.filter(c => c.Cdr.status === 'answered').length,
        missed: calls.responseData.data.filter(c => c.Cdr.status === 'missed').length
    };
}
```

### Caso 3: Integrazione CueCard (Popup durante chiamate)
```javascript
// Avvia server per ricevere webhook da CloudTalk
import './API/POST/cloudtalk-cuecard-integration.js';

// Il server riceve automaticamente i webhook quando parte una chiamata
// e mostra popup con info del cliente all'agente
```

## 🚨 Cose Importanti da Ricordare

### ✅ DO (Fai Così)
- ✅ Usa sempre il numero +393513416607 per i test
- ✅ Controlla sempre le credenziali nel file `.env`
- ✅ Usa i test automatici per verificare tutto funzioni
- ✅ Gestisci sempre gli errori con try/catch
- ✅ Rispetta i rate limits delle API CloudTalk

### ❌ DON'T (Non Fare Mai)
- ❌ Non committare mai il file `.env` su git
- ❌ Non hardcodare le credenziali nel codice
- ❌ Non fare troppe richieste consecutive (rate limiting)
- ❌ Non ignorare gli errori HTTP delle API

## 🆘 Se Sei Ancora Confuso

### Quick Help Commands
```bash
# Verifica configurazione
node -e "console.log(require('dotenv').config())"

# Test connessione base
node API/GET/get-agents.js

# Test completo sistema
npm run test  # se hai script npm configurati
```

### Contatti per Supporto
- 📧 Email: [inserisci email supporto]
- 💬 Slack: [inserisci canale slack]
- 📱 WhatsApp: +393513416607 (Roberto)

## 📖 Appendice - Parametri Comuni

### GET Calls - Parametri Disponibili
```javascript
{
    public_internal: "1001",           // Interno agente
    public_external: "+393513416607",  // Numero chiamante
    date_from: "2025-09-16 00:00:00",  // Data inizio
    date_to: "2025-09-16 23:59:59",    // Data fine
    contact_id: "1234567",             // ID contatto
    user_id: "493933",                 // ID utente/agente
    type: "incoming",                  // incoming/outgoing/internal
    status: "answered",                // answered/missed
    limit: 20,                         // Max risultati
    page: 1                            // Pagina risultati
}
```

### POST Bulk Contacts - Struttura Dati
```javascript
{
    action: "add_contact",             // add_contact/edit_contact/delete_contact
    command_id: "unique_id_123",       // ID univoco operazione
    data: {
        name: "Nome Cognome",          // OBBLIGATORIO
        title: "Titolo",
        company: "Azienda",
        industry: "Settore",
        ContactNumber: [
            { public_number: "+393334567890" }
        ],
        ContactEmail: [
            { email: "email@domain.com" }
        ]
    }
}
```

---

## 🎉 Congratulazioni!

Se sei arrivato fin qui, ora sai tutto quello che ti serve per usare le API CloudTalk!

**Ricorda:** Inizia sempre con i test automatici per verificare che tutto funzioni, poi personalizza in base alle tue esigenze.

**Happy Coding!** 🚀