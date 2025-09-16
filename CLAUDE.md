# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a CloudTalk API integration middleware with two main components:
1. **Express API Middleware** - A minimal proxy server that forwards API requests
2. **CloudTalk API System** - A comprehensive test suite and integration layer for CloudTalk APIs

The project provides a bridge between external systems (like Squadd) and CloudTalk's telephony platform, with extensive testing and webhook capabilities.

## Common Development Commands

### Server Operations
```bash
npm start                     # Start production server (port 3000)
npm run dev                   # Start development server with file watching
```

### CloudTalk API Testing
```bash
# Test all GET endpoints (read operations)
node API/GET/run-all-get-tests.js

# Test all POST endpoints (write/action operations)
node API/POST/run-all-post-tests.js

# Test all PUT endpoints (create operations)
node API/PUT/run-all-put-tests.js

# Test specific endpoints
node API/GET/get-calls.js     # Get call history
node API/GET/get-agents.js    # Get agent list
node API/POST/post-make-call.js  # Make a test call
```

### Webhook Development
```bash
# Start CloudTalk webhook development environment
./start-cloudtalk-webhooks.sh

# Environment variables for webhook script:
WEBHOOK_VERBOSE=1             # Enable verbose logging
WEBHOOK_KEEP_EXISTING=1       # Keep existing backend running
```

## Architecture Overview

### Core Express Middleware (`src/`)
- **`src/index.js`** - Main Express application with proxy and recordings routes
- **`src/proxy.js`** - Middleware for forwarding requests to TARGET_URL
- **`src/config.js`** - Basic server configuration (PORT, TARGET_URL)
- **`src/logger.js`** - Request/error logging utilities
- **`src/routes/recordings.js`** - Specialized routes for call recording management
- **`src/services/`** - Database and recording management services

### CloudTalk API System (`API/`)
- **`API/config.js`** - CloudTalk API configuration, authentication, and request utilities
- **`API/GET/`** - Read-only operations (agents, calls, contacts, AI analytics)
- **`API/POST/`** - Write operations (make calls, edit contacts, bulk operations)
- **`API/PUT/`** - Create operations (add agents, contacts, campaigns, etc.)
- **`API/recording-integration.js`** - Call recording management integration

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

# Server Configuration
PORT=3000
NODE_ENV=development

# Optional for proxy functionality
TARGET_URL=your_downstream_api_url
```

## Authentication & API Configuration

CloudTalk APIs use **Basic Authentication** with API Key ID and Secret. The authentication is handled automatically by `API/config.js`:

- Base URL: `https://my.cloudtalk.io/api`
- Analytics URL: `https://analytics-api.cloudtalk.io/api`
- AI URL: `https://api.cloudtalk.io/v1/ai`

All API calls go through the `makeCloudTalkRequest()` helper which handles:
- Authentication headers
- JSON/Binary response parsing
- Error handling and logging
- Rate limiting considerations

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

## Webhook & CueCard Integration

The project includes a comprehensive webhook development environment:

- **`start-cloudtalk-webhooks.sh`** - Complete development setup with Cloudflare tunnels
- **CueCard Integration** - Real-time call popup system during active calls
- **Webhook Server** - Express server for receiving CloudTalk workflow automation events

### CueCard Usage Pattern
```javascript
const cueCardData = {
  call_uuid: "uuid-from-webhook",
  type: "blocks",
  title: "Contact Information",
  content: [/* field definitions */]
};
```

## Key Integration Points

### Call Recording Management
- SQLite database for tracking recordings
- Automatic cleanup and organization
- Integration with CloudTalk's recording APIs

### Priority Contact System
- Roberto's number (+393513416607) is used for priority testing
- All test calls route to this number
- Special handling in CueCard popups for this contact

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