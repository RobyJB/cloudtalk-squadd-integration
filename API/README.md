# CloudTalk API Tests

Questa cartella contiene i test per verificare la connettività e l'autenticazione con l'API di CloudTalk.

## 📁 File Struttura

```
API/
├── config.js           # Configurazione API e helper functions
├── test-agents.js      # Test per Agents API
├── test-contacts.js    # Test per Contacts API  
├── test-campaigns.js   # Test per Campaigns API
├── run-all-tests.js    # Script master per tutti i test
└── README.md          # Questo file
```

## 🚀 Come Eseguire i Test

### Prerequisiti
Assicurati che il file `.env` nella root del progetto contenga:
```env
CLOUDTALK_API_KEY=fgHtFXiaLRCAEu3jXOUN0KRU1EHqPvwRck@B.b@pEU0e
```

### Eseguire Tutti i Test
```bash
cd API
node run-all-tests.js
```

### Eseguire Test Specifici
```bash
# Test solo Agents
node test-agents.js

# Test solo Contacts  
node test-contacts.js

# Test solo Campaigns
node test-campaigns.js
```

## 📋 Test Inclusi

### 🧑‍💼 Agents API
- `GET /agents/index.json` - Lista tutti gli agenti
- `GET /agents/index.json?limit=5` - Lista con paginazione

### 👥 Contacts API  
- `GET /contacts/index.json` - Lista tutti i contatti
- `GET /contacts/index.json?limit=10` - Lista con paginazione
- `GET /contacts/index.json?keyword=test&limit=5` - Ricerca per parola chiave

### 📞 Campaigns API
- `GET /campaigns/index.json` - Lista tutte le campagne
- `GET /campaigns/index.json?limit=5` - Lista con paginazione

## 🔧 Configurazione API

L'API CloudTalk usa **HTTP Basic Authentication**:
- **Username**: La tua API Key
- **Password**: Vuota
- **Base URL**: `https://my.cloudtalk.io/api`

## 📊 Output Atteso

Se tutto funziona correttamente, vedrai:
- ✅ Connessione riuscita a CloudTalk
- 📊 Statistiche sui dati (numero agenti, contatti, campagne)
- 📄 Esempi di dati restituiti dall'API
- 🎉 Messaggio di successo finale

## ❌ Risoluzione Problemi

Se i test falliscono:

1. **Controlla l'API Key**: Verifica che `CLOUDTALK_API_KEY` nel `.env` sia corretta
2. **Verifica la connessione**: Assicurati di avere accesso internet
3. **Controlla i permessi**: L'API Key deve avere permessi di lettura
4. **Rate Limits**: CloudTalk permette 60 richieste/minuto

## 🔍 Debug

Per vedere più dettagli sulle richieste, guarda l'output della console che mostra:
- URL richiesti
- Headers di autenticazione (parziali per sicurezza)
- Status code delle risposte
- Errori dettagliati se presenti