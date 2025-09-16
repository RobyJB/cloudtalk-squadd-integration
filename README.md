# API Middleware - CloudTalk & GoHighLevel Integration

Advanced middleware system for seamless integration between CloudTalk and GoHighLevel with AI-powered call analysis.

## 🚀 Features

### Current Implementation
- **Complete webhook system** (10 endpoints total)
- **Real-time call recording processing** with AI analysis
- **Speech-to-text transcription** using OpenAI Whisper
- **Automated call feedback generation** and contact note updates
- **Bidirectional synchronization** CloudTalk ↔ GoHighLevel
- **Advanced recording management** with URL generation and storage

### CloudTalk Webhooks (5 endpoints)
- `/api/cloudtalk-webhooks/new-tag` - Tag management sync
- `/api/cloudtalk-webhooks/contact-updated` - Contact field updates
- `/api/cloudtalk-webhooks/call-started` - Call initiation tracking
- `/api/cloudtalk-webhooks/call-ended` - **Call completion with AI analysis**
- `/api/cloudtalk-webhooks/new-note` - Note synchronization

### GoHighLevel Webhooks (5 endpoints)
- `/api/ghl-webhooks/new-contact` - Contact creation in CloudTalk
- `/api/ghl-webhooks/new-tag` - Tag synchronization
- `/api/ghl-webhooks/new-note` - Note synchronization
- `/api/ghl-webhooks/pipeline-stage-changed` - Pipeline tracking
- `/api/ghl-webhooks/opportunity-status-changed` - Opportunity management

### 🤖 AI Call Analysis System

When CloudTalk call-ended webhooks are received with recordings:

1. **Recording Capture**: Automatic download and processing of call recordings
2. **Speech-to-Text**: Transcription using OpenAI Whisper API
3. **AI Analysis**: Intelligent call feedback generation
4. **GoHighLevel Integration**: 
   - Feedback automatically added to contact notes
   - Call logged in contact conversation history
   - Custom fields updated with call metadata

## 🛣️ Roadmap - Next Steps

### Immediate Priorities
1. **Automated Contact Transfer**: New GoHighLevel contacts → CloudTalk with instant call routing
2. **Smart Agent Routing**: Automatic call distribution based on real-time agent availability
3. **Campaign Integration**: Auto-add GoHighLevel contacts to targeted CloudTalk campaigns
4. **Enhanced AI Analytics**: Call sentiment analysis and coaching recommendations

## 🛠️ Development

### Quick Start
```bash
npm install
npm start
```

### Webhook Development Environment
```bash
# Start webhook server with Cloudflare tunnel
./start-cloudtalk-webhooks.sh
```

### Environment Variables
- `PORT`: Server port (default 3000)
- `TARGET_URL`: Downstream API base URL
- `CLOUDTALK_API_KEY`: CloudTalk API authentication
- `OPENAI_API_KEY`: OpenAI Whisper API key
- `GHL_API_KEY`: GoHighLevel API authentication

## 📊 System Architecture

```
CloudTalk → Webhooks → Middleware → AI Analysis → GoHighLevel
    ↑                                                    ↓
    ←────── Contact Sync & Campaign Management ─────┘
```

### Real-time Processing Flow
1. CloudTalk sends call-ended webhook with recording URL
2. Middleware downloads and processes recording
3. OpenAI Whisper transcribes speech to text
4. AI generates call feedback and analysis
5. Results automatically sync to GoHighLevel contact notes
6. Call metadata logged in contact conversation history

## 📋 Documentation

- [Webhook Integration Guide](./WEBHOOK_INTEGRATION_GUIDE.md)
- [Recording Integration Guide](./RECORDING_INTEGRATION_GUIDE.md)
- [CloudTalk API System](./README-CLOUDTALK-API-SYSTEM.md)
- [Real Webhook Examples](./Webhook%20CloudTalk/)

## 🚀 Production Ready

✅ **10 webhook endpoints fully tested**  
✅ **Real-time AI call analysis**  
✅ **Bidirectional sync CloudTalk ↔ GoHighLevel**  
✅ **Production webhook examples captured**  
✅ **Comprehensive logging and error handling**

