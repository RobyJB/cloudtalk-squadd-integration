# API Squadd - CloudTalk → GoHighLevel Integration

Questo modulo gestisce l'integrazione completa tra CloudTalk e GoHighLevel (Squadd), processando i webhook di CloudTalk e sincronizzando i dati con GHL.

## 📁 Struttura

```
API Squadd/
├── webhook-to-ghl-processor.js    # 🔄 Processore principale webhook → GHL
├── tests/
│   ├── search-contact-by-phone.js # 🔍 Ricerca contatti GHL per numero
│   ├── add-note.js                # 📝 Aggiunge note ai contatti GHL
│   └── notes.txt                  # 📋 Documentazione API GHL notes
└── README.md                      # 📖 Questa documentazione
```

## 🚀 Flusso di Integrazione

### 1. **Webhook CloudTalk → Ricerca Contatto → Aggiungi Nota**

```mermaid
graph LR
    A[CloudTalk Webhook] --> B[Extract external_number]
    B --> C[Search GHL Contact]
    C --> D[Add Note to Contact]
    D --> E[Return Success]
```

### 2. **Tipi di Webhook Supportati**

- **`call-recording-ready`** ✅ - Registrazione disponibile
- **`new-tag`** ✅ - Nuovo tag aggiunto
- **`new-note`** ✅ - Nuova nota aggiunta
- **`contact-updated`** ✅ - Contatto aggiornato
- **`call-started`** ✅ - Chiamata iniziata
- **`call-ended`** ✅ - Chiamata terminata

## 🔧 Setup e Configurazione

### Environment Variables Required

```env
# GoHighLevel API
GHL_API_KEY=pit-86759a2b-eb0d-4945-996b-ff58d2263b48
GHL_LOCATION_ID=DfxGoORmPoL5Z1OcfYJM

# CloudTalk API (per completezza)
CLOUDTALK_API_KEY_ID=your_key_id
CLOUDTALK_API_SECRET=your_secret
```

## 🧪 Testing

### Test Ricerca Contatto
```bash
cd "API Squadd/tests"
node search-contact-by-phone.js
```

### Test Aggiunta Nota
```bash
cd "API Squadd/tests"
node add-note.js
```

### Test Processore Completo
```bash
cd "API Squadd"
node webhook-to-ghl-processor.js
```

## 📋 Esempio di Utilizzo

```javascript
import { processCloudTalkWebhook } from './webhook-to-ghl-processor.js';

// Payload dal webhook CloudTalk
const webhookPayload = {
  "call_id": 1002226167,
  "recording_url": "https://my.cloudtalk.io/pub/r/...",
  "internal_number": 40312296109,
  "external_number": "393936815798"
};

// Processa il webhook
const result = await processCloudTalkWebhook(webhookPayload, 'call-recording-ready');

if (result.success) {
  console.log('✅ Webhook processato:', result.result);
} else {
  console.error('❌ Errore:', result.error);
}
```

## 🔗 API Endpoints GHL Utilizzati

### 1. **Search Contacts**
- **POST** `https://services.leadconnectorhq.com/contacts/search`
- Cerca contatti per numero di telefono
- Ritorna lista contatti matchati

### 2. **Add Note to Contact**
- **POST** `https://services.leadconnectorhq.com/contacts/{contactId}/notes`
- Aggiunge nota a un contatto specifico
- Richiede contactId valido

## 📞 Webhook CloudTalk - Esempi Payload

### Call Recording Ready
```json
{
  "call_id": 1002226167,
  "recording_url": "https://my.cloudtalk.io/pub/r/MTAwMjIyNjE2Nw%3D%3D/...",
  "internal_number": 40312296109,
  "external_number": "393936815798"
}
```

### New Tag
```json
{
  "call_id": 1002226168,
  "external_number": "393936815798",
  "tag_name": "Cliente VIP",
  "agent_id": 493933
}
```

### Call Ended
```json
{
  "call_id": 1002226169,
  "external_number": "393936815798",
  "duration": "00:05:23",
  "call_status": "answered",
  "agent_name": "Roberto"
}
```

## 🎯 Logica di Matching

1. **Extract Phone Number**: Usa `external_number` dal payload webhook
2. **Normalize Phone**: Rimuove caratteri non numerici per il match
3. **Search GHL**: Cerca contatti con query sul numero
4. **Exact Match**: Preferisce match esatto, fallback sul primo risultato
5. **Add Note**: Aggiunge nota formattata con dettagli webhook

## ⚡ Performance Notes

- **Rate Limits**: GHL ha rate limits, rispettati automaticamente
- **Error Handling**: Gestione completa degli errori API
- **Logging**: Logging dettagliato per debugging
- **Fallbacks**: Gestione contatti non trovati

## 🔮 Future Enhancements

- [ ] Cache per ridurre chiamate API duplicate
- [ ] Batch processing per webhook multipli
- [ ] Tag sync bidirezionale GHL ↔ CloudTalk
- [ ] Custom field mapping avanzato
- [ ] Metrics e monitoring