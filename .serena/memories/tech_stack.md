# Technology Stack

## Core Technologies
- **Runtime**: Node.js with ES modules (`"type": "module"` in package.json)
- **Framework**: Express.js for REST API and webhook handling
- **Language**: JavaScript (ES6+) - all files use `.js` extension

## Key Dependencies
- **axios** (^1.12.2) - HTTP client for external API calls
- **express** (^4.21.2) - Web framework
- **dotenv** (^17.2.2) - Environment configuration management
- **openai** (^5.20.3) - OpenAI API integration for transcription
- **sqlite3** (^5.1.7) - Database for recording management
- **node-fetch** (^3.3.2) - Fetch API for HTTP requests
- **body-parser** (^2.2.0) - Request body parsing
- **cors** (^2.8.5) - Cross-origin resource sharing

## Development Environment
- **Development server**: `node --watch src/index.js` for auto-restart
- **Production server**: `node src/index.js`
- **Default port**: 3000

## External Services Integration
- **CloudTalk API**: Telephony platform with Basic Auth
- **GoHighLevel API**: CRM platform with API key authentication  
- **OpenAI Whisper API**: Speech-to-text transcription service

## Database
- **SQLite3** for local storage of call recordings and metadata
- Used primarily for caching and processing management

## Architecture Pattern
- **Middleware-based architecture** with Express.js
- **Webhook-driven** real-time event processing
- **Service-oriented** code organization in `src/services/`
- **Route-based** API organization in `src/routes/`