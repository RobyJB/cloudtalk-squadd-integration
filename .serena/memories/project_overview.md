# API Middleware Project Overview

## Project Purpose
Advanced middleware system for seamless integration between CloudTalk and GoHighLevel with AI-powered call analysis. The project serves as a bridge between these two platforms, handling webhook events, processing call recordings, and synchronizing data bidirectionally.

## Key Features
- **Complete webhook system** with 10 endpoints (5 CloudTalk + 5 GoHighLevel)
- **Real-time call recording processing** with AI-powered transcription and analysis
- **Speech-to-text transcription** using OpenAI Whisper API
- **Automated call feedback generation** and contact note updates
- **Bidirectional synchronization** between CloudTalk ↔ GoHighLevel
- **Advanced recording management** with URL generation and storage

## System Architecture
```
CloudTalk → Webhooks → Middleware → AI Analysis → GoHighLevel
    ↑                                                    ↓
    ←────── Contact Sync & Campaign Management ─────┘
```

## Main Components

### 1. Express API Middleware (`src/`)
- **Main server** (`src/index.js`) - Express application with proxy and webhook routes
- **Webhook routes** for both CloudTalk and GoHighLevel integration
- **Recording processing** with AI transcription and analysis
- **Database management** using SQLite for call recordings

### 2. CloudTalk API System (`API CloudTalk/`)
- **Comprehensive API testing suite** with GET/POST/PUT operations
- **Authentication handling** with Basic Auth using API keys
- **24 GET operations** - Read-only data retrieval
- **9 POST operations** - Actions and modifications
- **11 PUT operations** - Create new records

### 3. GoHighLevel Integration (`API Squadd/`)
- **Webhook processing pipeline** for CRM synchronization
- **API interaction functions** and testing utilities

## Real-time AI Processing Flow
1. CloudTalk sends call-ended webhook with recording URL
2. Middleware downloads and processes recording
3. OpenAI Whisper transcribes speech to text
4. AI generates call feedback and analysis
5. Results automatically sync to GoHighLevel contact notes
6. Call metadata logged in contact conversation history