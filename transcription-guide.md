⏺ 📋 Mappa Completa dei File del Sistema CloudTalk → GHL

  🎯 File Principali del Flusso

  1. Entry Point - Server Express
  /Users/robertobondici/projects/api-middleware/src/index.js
  - Server principale che registra le routes webhook

  2. Route Webhook CloudTalk
  /Users/robertobondici/projects/api-middleware/src/routes/cloudtalk-webhooks.js
  - Gestisce tutti gli endpoint webhook CloudTalk
  - Deduplicazione, logging, chiamata al processor

  3. Processor Principale
  /Users/robertobondici/projects/api-middleware/API Squadd/webhook-to-ghl-processor.js
  - Logica business principale del flusso
  - Ricerca contatto GHL, processamento recording, creazione note

  4. Servizio Trascrizione (CORE)
  /Users/robertobondici/projects/api-middleware/src/services/transcription-service.js
  - ⭐ FILE CHIAVE - Sistema a due fasi Squadd
  - Whisper transcription + GPT-4.1 analysis
  - Vocabolario custom, BANT framework, coaching

  🔧 File di Supporto

  5. Ricerca Contatti GHL
  /Users/robertobondici/projects/api-middleware/API Squadd/tests/search-contact-by-phone.js
  - Cerca contatti in GHL by phone number

  6. Aggiunta Note GHL
  /Users/robertobondici/projects/api-middleware/API Squadd/tests/add-note.js
  - Crea note nei contatti GHL

  7. Upload Audio Conversazioni
  /Users/robertobondici/projects/api-middleware/src/services/ghl-conversation-service.js
  - Carica file audio nelle conversazioni GHL

  8. Utilities
  /Users/robertobondici/projects/api-middleware/src/utils/webhook-deduplication.js
  /Users/robertobondici/projects/api-middleware/src/utils/webhook-payload-logger.js
  /Users/robertobondici/projects/api-middleware/src/logger.js

  🌐 Configurazione

  9. Environment
  /Users/robertobondici/projects/api-middleware/.env
  - OpenAI API Key, GHL credentials, CloudTalk config

  10. Webhook Development Script
  /Users/robertobondici/projects/api-middleware/start-cloudtalk-webhooks.sh
  - Setup tunnel Cloudflare per sviluppo webhook

  🔄 Flusso Completo

  1. CloudTalk → cloudtalk-webhooks.js
  2. → webhook-to-ghl-processor.js
  3. → transcription-service.js (⭐ Due fasi Squadd)
  4. → search-contact-by-phone.js
  5. → ghl-conversation-service.js + add-note.js
  6. → GHL Contact aggiornato

  Il file transcription-service.js è il cuore del sistema con il nuovo framework Squadd!