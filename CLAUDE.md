# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a CloudTalk ↔ GoHighLevel Integration Middleware with AI-powered call analysis. The system consists of three main components:
1. **Express API Middleware** - Webhook receiver and API proxy for telephony integration
2. **CloudTalk API System** - Comprehensive test suite and integration layer for CloudTalk APIs
3. **GoHighLevel Integration** - Bidirectional sync system with AI-powered call transcription and analysis

The project provides real-time integration between CloudTalk's telephony platform and GoHighLevel CRM, featuring automated call recording processing, OpenAI-powered transcription, and intelligent call coaching analysis.

## Common Development Commands

### Server Operations
```bash
npm start                     # Start production server (port 3000)
npm run dev                   # Start development server with file watching
```

### CloudTalk API Testing
```bash
# Test all GET endpoints (read operations)
node "API CloudTalk/GET/run-all-get-tests.js"

# Test all POST endpoints (write/action operations)
node "API CloudTalk/POST/run-all-post-tests.js"

# Test all PUT endpoints (create operations)
node "API CloudTalk/PUT/run-all-put-tests.js"

# Test specific endpoints
node "API CloudTalk/GET/get-calls.js"     # Get call history
node "API CloudTalk/GET/get-agents.js"    # Get agent list
node "API CloudTalk/POST/post-make-call.js"  # Make a test call
```

### GoHighLevel Integration Testing
```bash
# Process webhook to GoHighLevel
node "API Squadd/webhook-to-ghl-processor.js"

# Test GoHighLevel API functions
node "API Squadd/tests/test-functions.js"
```

### Webhook Development
```bash
# Start CloudTalk webhook development environment
./start-cloudtalk-webhooks.sh

# Environment variables for webhook script:
WEBHOOK_VERBOSE=1             # Enable verbose logging
WEBHOOK_KEEP_EXISTING=1       # Keep existing backend running
```

### Webhook Testing and Development
```bash
# Test specific webhook endpoints directly
curl -X POST http://localhost:3000/api/cloudtalk-webhooks/call-recording-ready \
     -H "Content-Type: application/json" \
     -d '{"call_id": "test-123", "recording_url": "https://example.com/recording.wav"}'

# Test GoHighLevel webhook processing
curl -X POST http://localhost:3000/api/ghl-webhooks/new-contact \
     -H "Content-Type: application/json" \
     -d '{"contact": {"name": "Test User", "phone": "+1234567890"}}'
```

## Architecture Overview

### Core Express Middleware (`src/`)
- **`src/index.js`** - Main Express application with proxy and recordings routes
- **`src/proxy.js`** - Middleware for forwarding requests to TARGET_URL
- **`src/config.js`** - Basic server configuration (PORT, TARGET_URL)
- **`src/logger.js`** - Request/error logging utilities
- **`src/routes/recordings.js`** - Specialized routes for call recording management
- **`src/routes/cloudtalk-webhooks.js`** - 7 CloudTalk webhook endpoints for call events
- **`src/routes/ghl-webhooks.js`** - 5 GoHighLevel webhook endpoints for CRM sync
- **`src/services/`** - Database, recording management, and AI processing services
  - **`database.js`** - SQLite database abstraction for recordings
  - **`transcription-service.js`** - OpenAI Whisper integration with AI analysis
  - **`recording-manager.js`** - Call recording download and storage
  - **`cloudtalk-recording-service.js`** - CloudTalk-specific recording handling
  - **`ghl-conversation-service.js`** - GoHighLevel conversation API integration

### CloudTalk API System (`API CloudTalk/`)
- **`API CloudTalk/config.js`** - CloudTalk API configuration, authentication, and request utilities
- **`API CloudTalk/GET/`** (24 files) - Read-only operations (agents, calls, contacts, AI analytics)
- **`API CloudTalk/POST/`** (9 files) - Write operations (make calls, edit contacts, bulk operations)
- **`API CloudTalk/PUT/`** (11 files) - Create operations (add agents, contacts, campaigns, etc.)

### GoHighLevel Integration System (`API Squadd/`)
- **`API Squadd/webhook-to-ghl-processor.js`** - Main webhook processing pipeline
- **`API Squadd/tests/`** - GoHighLevel API interaction functions and testing

### Key API Endpoints Structure

**GET Operations (Read Data):**
- Agents, Contacts, Campaigns, Groups
- Call history and details with real-time lookups
- AI features: call summaries, sentiment, transcriptions
- Analytics and statistics

**POST Operations (Actions/Modifications):**
- `makeCall(agentId, phoneNumber)` - Initiate calls
- `bulkContacts(operations)` - Batch contact operations
- `editContact(contactId, data)` - Update contact information
- CueCard integration for real-time call popups

**PUT Operations (Create New Records):**
- Add new agents, contacts, campaigns, groups, tags
- Add notes and activities to contacts
- Blacklist management

## Environment Configuration

Required environment variables in `.env`:
```env
# CloudTalk API Credentials (REQUIRED)
CLOUDTALK_API_KEY_ID=your_api_key_id
CLOUDTALK_API_SECRET=your_api_secret

# GoHighLevel API Key (REQUIRED for CRM integration)
GHL_API_KEY=your_ghl_api_key

# OpenAI API Key (REQUIRED for transcription service)
OPENAI_API_KEY=your_openai_api_key

# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Optional for proxy functionality
TARGET_URL=your_downstream_api_url
```

## Authentication & API Configuration

CloudTalk APIs use **Basic Authentication** with API Key ID and Secret. The authentication is handled automatically by `API CloudTalk/config.js`:

- Base URL: `https://my.cloudtalk.io/api`
- Analytics URL: `https://analytics-api.cloudtalk.io/api`
- AI URL: `https://api.cloudtalk.io/v1/ai`

All API calls go through the `makeCloudTalkRequest()` helper which handles:
- Authentication headers
- JSON/Binary response parsing
- Error handling and logging
- Rate limiting considerations

## AI-Powered Call Analysis Architecture

### Real-time Processing Pipeline
1. **CloudTalk** sends webhook with recording URL when call ends
2. **Middleware** downloads and processes recording via `recording-manager.js`
3. **OpenAI Whisper** transcribes audio to text with Italian language support
4. **Two-phase AI analysis** via `transcription-service.js`:
   - **Phase 1**: Speaker identification and call classification (substantial vs non-substantial)
   - **Phase 2**: BANT framework analysis and coaching feedback (substantial calls only)
5. **Results sync** to GoHighLevel contact notes/conversations via `ghl-conversation-service.js`
6. **Call metadata** logged in SQLite database

### AI Analysis Features
- **Custom vocabulary** for business terminology accuracy
- **Smart call filtering** to focus coaching on meaningful conversations
- **BANT framework scoring**: Budget, Authority, Need, Timeline
- **Coaching feedback** with specific improvement recommendations
- **Speaker identification** to separate agent from customer speech

## Testing Strategy

### Test Suite Organization
- **GET tests**: Focus on data retrieval with dependency management (real IDs)
- **POST tests**: Use Roberto's number (+393513416607) for call testing
- **PUT tests**: Comprehensive creation testing with cleanup considerations

### Real Data Dependencies
Tests dynamically fetch real IDs (agents, contacts, calls) rather than using hardcoded values, making them more robust against data changes.

### Test Execution Patterns
```javascript
// GET tests automatically resolve dependencies
const calls = await getCalls({ limit: 1 });
const realCallId = calls.responseData.data[0].Cdr?.id;
const details = await getCallDetails(realCallId);

// POST tests use Roberto's priority number
const result = await makeCall(agentId, '+393513416607');
```

## Webhook Integration Architecture

The project features a comprehensive dual-provider webhook system:

### CloudTalk Webhooks (7 endpoints)
- **`/api/cloudtalk-webhooks/call-recording-ready`** - Triggers AI transcription pipeline
- **`/api/cloudtalk-webhooks/transcription-ready`** - CloudTalk native transcription events
- **`/api/cloudtalk-webhooks/new-tag`** - Tag management sync
- **`/api/cloudtalk-webhooks/contact-updated`** - Contact information changes
- **`/api/cloudtalk-webhooks/call-started`** - Real-time call initiation
- **`/api/cloudtalk-webhooks/call-ended`** - Call completion events
- **`/api/cloudtalk-webhooks/new-note`** - Note synchronization

### GoHighLevel Webhooks (5 endpoints)
- **`/api/ghl-webhooks/new-contact`** - Bidirectional contact sync
- **`/api/ghl-webhooks/new-tag`** - Tag management integration
- **`/api/ghl-webhooks/new-note`** - Note synchronization
- **`/api/ghl-webhooks/pipeline-stage-changed`** - Pipeline status updates
- **`/api/ghl-webhooks/opportunity-status-changed`** - Opportunity tracking

### Webhook Development Environment
- **`start-cloudtalk-webhooks.sh`** - Complete development setup with Cloudflare tunnels
- **Automatic payload logging** with organized storage in `webhook-payloads/`
- **Webhook deduplication** to prevent double-processing
- **Real-time processing** with error handling and recovery

## Key Integration Points

### Call Recording Management
- SQLite database for tracking recordings
- Automatic cleanup and organization
- Integration with CloudTalk's recording APIs

### Priority Contact System
- Roberto's number (+393513416607) is used for priority testing
- All test calls route to this number
- Special handling in CueCard popups for this contact

### Data Flow Architecture

```
CloudTalk → Webhooks → Middleware → AI Analysis → GoHighLevel
    ↑                                                    ↓
    ←────── Contact Sync & Campaign Management ─────┘
```

### Database Schema (SQLite)

```sql
recordings (
  id INTEGER PRIMARY KEY,
  call_id TEXT UNIQUE,
  file_path TEXT,
  file_size INTEGER,
  duration INTEGER,
  format TEXT DEFAULT 'wav',
  agent_name TEXT,
  phone_from TEXT,
  phone_to TEXT,
  call_type TEXT,
  transcription TEXT,
  metadata TEXT,
  created_at DATETIME,
  updated_at DATETIME
)
```

### Webhook Payload Management
- **Automatic payload storage** in `webhook-payloads/` directory organized by provider
- **Webhook deduplication** prevents double-processing using request signatures
- **Rich metadata capture** including headers, IP, user-agent, and processing status
- **SQLite database** tracks all call recordings and processing status

## Development Tips

- Use comprehensive test runners to validate API changes
- Monitor rate limits when running full test suites
- The webhook development script provides live tunnel URLs that change on restart
- Test files include extensive logging for debugging API interactions
- Real data dependency resolution prevents test failures due to missing hardcoded IDs

## API Rate Limiting Considerations

- Test runners include delays between API calls
- Sequential execution prevents overwhelming CloudTalk APIs
- Error handling distinguishes between rate limits and actual failures
- Batch operations are preferred for bulk data changes