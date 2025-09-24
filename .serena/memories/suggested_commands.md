# Suggested Commands

## Development Commands

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
# WEBHOOK_VERBOSE=1             # Enable verbose logging
# WEBHOOK_KEEP_EXISTING=1       # Keep existing backend running
```

### Webhook Testing
```bash
# Test CloudTalk webhook endpoints
curl -X POST http://localhost:3000/api/cloudtalk-webhooks/call-recording-ready \
     -H "Content-Type: application/json" \
     -d '{"call_id": "test-123", "recording_url": "https://example.com/recording.wav"}'

# Test GoHighLevel webhook processing
curl -X POST http://localhost:3000/api/ghl-webhooks/new-contact \
     -H "Content-Type: application/json" \
     -d '{"contact": {"name": "Test User", "phone": "+1234567890"}}'
```

## System Utilities (macOS)

### File Operations
```bash
find . -name "*.js" -not -path "./node_modules/*"  # Find JavaScript files
ls -la src/                                        # List source directory
grep -r "function" src/                           # Search for functions

# macOS specific commands
open .                         # Open current directory in Finder
pbcopy < file.txt             # Copy file content to clipboard
```

### Git Operations
```bash
git status                    # Check repository status
git add .                     # Stage all changes
git commit -m "message"       # Commit changes
git log --oneline -10         # Show last 10 commits
```

## Environment Setup
```bash
cp .env.example .env          # Create environment file
# Edit .env with your API keys:
# - CLOUDTALK_API_KEY_ID
# - CLOUDTALK_API_SECRET  
# - GHL_API_KEY
# - OPENAI_API_KEY
```