#!/bin/bash
# start-cloudtalk-webhooks.sh
# CloudTalk CueCards webhook development environment

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Verbose logging toggle (set WEBHOOK_VERBOSE=1 to show all lines)
WEBHOOK_VERBOSE=${WEBHOOK_VERBOSE:-}
# Keep an already running backend (1) or restart to enable logging (0). Default: 0 (restart for mini logs)
WEBHOOK_KEEP_EXISTING=${WEBHOOK_KEEP_EXISTING:-0}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR"
LOG_DIR="$BACKEND_DIR/logs"
APP_LOG="$LOG_DIR/cloudtalk-webhook.log"
TUNNEL_LOG="$LOG_DIR/tunnel.log"

# Check for already running Node.js process
EXISTING_PORT=""
EXISTING_PID=""

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down CloudTalk webhook services...${NC}"

    if [[ -n "$TUNNEL_PID" ]]; then
        kill $TUNNEL_PID 2>/dev/null
        echo -e "${GREEN}✅ Cloudflare tunnel stopped${NC}"
    fi

    if [[ -n "$APP_PID" && -z "$EXISTING_PID" ]]; then
        # Only kill if we started it (not if it was already running)
        kill $APP_PID 2>/dev/null
        echo -e "${GREEN}✅ Webhook server stopped${NC}"
    elif [[ -n "$EXISTING_PID" ]]; then
        echo -e "${YELLOW}⚡ Left existing server running (PID: $EXISTING_PID)${NC}"
    fi

    echo -e "${GREEN}👋 CloudTalk webhook environment stopped${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check dependencies
check_dependencies() {
    echo -e "${CYAN}🔍 Checking dependencies...${NC}"

    # Check if cloudflared is installed
    if ! command -v cloudflared &> /dev/null; then
        echo -e "${RED}❌ cloudflared not found${NC}"
        echo -e "${YELLOW}Please install cloudflared:${NC}"
        echo -e "  macOS: ${BLUE}brew install cloudflared${NC}"
        echo -e "  Linux: ${BLUE}https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/${NC}"
        exit 1
    fi

    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js not found${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ All dependencies found${NC}"
}

# Check for existing Node.js process
check_existing_backend() {
    echo -e "${CYAN}🔍 Checking for existing Node.js process...${NC}"

    # Check for existing node process on common ports
    for port in 3000 3001 3002 8000 8080; do
        if lsof -i :$port 2>/dev/null | grep -q node; then
            local pid=$(lsof -i :$port 2>/dev/null | grep node | awk '{print $2}' | head -1)
            if [[ -n "$pid" ]]; then
                EXISTING_PID=$pid
                EXISTING_PORT=$port
                echo -e "${YELLOW}⚡ Found existing Node.js process on port $port (PID: $pid)${NC}"
                return 0
            fi
        fi
    done

    echo -e "${GREEN}✅ No existing Node.js server found, will start new instance${NC}"
    return 1
}

# Create CloudTalk webhook server
create_webhook_server() {
    echo -e "${GREEN}✅ Using existing optimized webhook server${NC}"
    # We'll use the main server instead of creating a new one
    return 0
}

# Create temporary webhook server (old approach - not used)
create_old_webhook_server() {
    cat > "$BACKEND_DIR/cloudtalk-webhook-server.js" << 'EOF'
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    const timestamp = new Date().toISOString();
    console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint
app.get('/webhook/test', (req, res) => {
    log('🧪 Test endpoint called', 'green');
    res.json({ 
        message: 'CloudTalk webhook server is running!',
        timestamp: new Date().toISOString(),
        endpoints: {
            webhook: '/webhook/cloudtalk',
            health: '/health',
            test: '/webhook/test'
        }
    });
});

// Main CloudTalk webhook endpoint
app.post('/webhook/cloudtalk', async (req, res) => {
    const timestamp = new Date().toISOString();
    
    log('🔵 CloudTalk webhook received!', 'blue');
    log(`📡 Headers: ${JSON.stringify(req.headers, null, 2)}`, 'cyan');
    log(`📋 Body: ${JSON.stringify(req.body, null, 2)}`, 'yellow');
    
    try {
        const payload = req.body;
        
        // Extract call information
        const callUuid = payload.Call_uuid || payload.call_uuid || payload.uuid;
        const callId = payload.Call_id || payload.call_id || payload.id;
        const callStatus = payload.Call_status || payload.status;
        const agentId = payload.Agent_id || payload.agent_id;
        const contactPhone = payload.Contact_phone || payload.phone;
        
        log('📞 CALL DETAILS:', 'magenta');
        log(`   🔑 Call UUID: ${callUuid}`, 'green');
        log(`   📱 Call ID: ${callId}`, 'green');  
        log(`   📊 Status: ${callStatus}`, 'green');
        log(`   👤 Agent: ${agentId}`, 'green');
        log(`   📞 Phone: ${contactPhone}`, 'green');
        
        // If we have a call UUID, try to send a CueCard!
        if (callUuid) {
            log('🎯 FOUND CALL UUID! Attempting to send CueCard...', 'green');
            
            // Import the CueCard function (you'll need to adjust the path)
            // For now, we'll just log what we would send
            const cueCardData = {
                call_uuid: callUuid,
                type: "blocks",
                title: "🚨 WEBHOOK SUCCESS!",
                content: [
                    {
                        type: "textfield",
                        name: "🎉 UUID FOUND!",
                        value: "Webhook captured call UUID!"
                    },
                    {
                        type: "textfield",
                        name: "📞 Call ID",
                        value: `${callId || 'Unknown'}`
                    },
                    {
                        type: "richtext",
                        name: "🎊 Success",
                        value: `<b>WEBHOOK WORKING!</b><br/>UUID: ${callUuid}<br/>Status: ${callStatus}<br/>Agent: ${agentId}`
                    }
                ]
            };
            
            log('📋 CueCard data prepared:', 'cyan');
            log(JSON.stringify(cueCardData, null, 2), 'cyan');
            
            // TODO: Here you can call your CueCard API
            // const result = await sendCueCard(cueCardData);
            log('🎊 CueCard would be sent now with working UUID!', 'green');
        } else {
            log('⚠️  No call UUID found in webhook payload', 'yellow');
        }
        
        // Send success response
        res.json({
            success: true,
            message: 'CloudTalk webhook processed successfully',
            timestamp: timestamp,
            received: {
                callUuid: callUuid,
                callId: callId,
                status: callStatus
            }
        });
        
        log('✅ Webhook processed successfully', 'green');
        
    } catch (error) {
        log(`❌ Error processing webhook: ${error.message}`, 'red');
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: timestamp
        });
    }
});

// Catch all other routes
app.use('*', (req, res) => {
    log(`❓ Unknown endpoint called: ${req.method} ${req.originalUrl}`, 'yellow');
    res.status(404).json({
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /health',
            'GET /webhook/test', 
            'POST /webhook/cloudtalk'
        ]
    });
});

// Start server
app.listen(PORT, () => {
    log(`🚀 CloudTalk webhook server running on port ${PORT}`, 'green');
    log(`📡 Ready to receive CloudTalk webhooks!`, 'blue');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    log('🛑 Server shutting down...', 'yellow');
    process.exit(0);
});

process.on('SIGINT', () => {
    log('🛑 Server shutting down...', 'yellow');
    process.exit(0);
});
EOF

    echo -e "${GREEN}✅ CloudTalk webhook server created${NC}"
}

# Install dependencies if needed
install_dependencies() {
    if [[ ! -f "$BACKEND_DIR/package.json" ]]; then
        echo -e "${CYAN}📦 Creating package.json...${NC}"
        cat > "$BACKEND_DIR/package.json" << 'EOF'
{
  "name": "cloudtalk-webhook-server",
  "version": "1.0.0",
  "description": "CloudTalk CueCards webhook receiver",
  "main": "cloudtalk-webhook-server.js",
  "scripts": {
    "start": "node cloudtalk-webhook-server.js",
    "dev": "node cloudtalk-webhook-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "body-parser": "^1.20.2",
    "cors": "^2.8.5"
  }
}
EOF
    fi

    if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
        echo -e "${CYAN}📦 Installing dependencies...${NC}"
        cd "$BACKEND_DIR"
        npm install
    fi
}

# Start the webhook server
start_backend() {
    if [[ -n "$EXISTING_PORT" ]]; then
        if [[ "$WEBHOOK_KEEP_EXISTING" == "1" ]]; then
            echo -e "${YELLOW}⚡ Using existing server on port $EXISTING_PORT (WEBHOOK_KEEP_EXISTING=1)${NC}"
            APP_PID=$EXISTING_PID
            PORT=$EXISTING_PORT
            return 0
        else
            echo -e "${YELLOW}🧹 Restarting existing server (PID: $EXISTING_PID) to enable logging${NC}"
            kill $EXISTING_PID 2>/dev/null || true
            # Wait briefly for process to terminate
            for i in {1..10}; do
                if kill -0 $EXISTING_PID 2>/dev/null; then
                    sleep 0.3
                else
                    break
                fi
            done
        fi
    fi

    echo -e "${CYAN}🚀 Starting CloudTalk webhook server...${NC}"
    cd "$BACKEND_DIR"

    # Use PORT environment variable or default to 3000
    PORT=${PORT:-3000}

    # Start main server in background and capture logs to file
    npm start > "$APP_LOG" 2>&1 &
    APP_PID=$!

    # Wait for server to start
    local attempts=0
    local max_attempts=30

    while [[ $attempts -lt $max_attempts ]]; do
        if curl -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Webhook server running on port $PORT${NC}"
            return 0
        fi

        sleep 1
        ((attempts++))

        # Check if process is still running
        if ! kill -0 $APP_PID 2>/dev/null; then
            echo -e "${RED}❌ Webhook server failed to start${NC}"
            echo -e "${YELLOW}Check logs: tail -f $APP_LOG${NC}"
            exit 1
        fi
    done

    echo -e "${RED}❌ Webhook server took too long to start${NC}"
    exit 1
}

# Start Cloudflare tunnel
start_tunnel() {
    echo -e "${CYAN}🌐 Starting Cloudflare tunnel...${NC}"

    # Start tunnel in background
    cloudflared tunnel --url "http://localhost:$PORT" > "$TUNNEL_LOG" 2>&1 &
    TUNNEL_PID=$!

    # Wait for tunnel URL
    local attempts=0
    local max_attempts=30

    while [[ $attempts -lt $max_attempts ]]; do
        if [[ -f "$TUNNEL_LOG" ]]; then
            local url=$(grep -a -o 'https://.*\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)
            if [[ -n "$url" ]]; then
                TUNNEL_URL=$url
                echo -e "${GREEN}✅ Tunnel active: $TUNNEL_URL${NC}"
                return 0
            fi
        fi

        sleep 1
        ((attempts++))

        # Check if process is still running
        if ! kill -0 $TUNNEL_PID 2>/dev/null; then
            echo -e "${RED}❌ Cloudflare tunnel failed to start${NC}"
            echo -e "${YELLOW}Check logs: tail -f $TUNNEL_LOG${NC}"
            exit 1
        fi
    done

    echo -e "${RED}❌ Could not extract tunnel URL${NC}"
    exit 1
}

# Display webhook URLs
display_webhook_urls() {
    local base_url=$1

    clear

    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}         📋 CLOUDTALK WEBHOOK CONFIGURATION${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}\n"

    echo -e "${YELLOW}📍 TUNNEL URL:${NC} ${BLUE}$base_url${NC}\n"

    echo -e "${YELLOW}🔗 WEBHOOK ENDPOINTS:${NC}"
    echo -e "Copy these URLs into your CloudTalk Workflow Automation:\n"

    echo -e "${CYAN}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│${NC} ${BOLD}CLOUDTALK WEBHOOKS${NC} (7 optimized endpoints):"
    echo -e "${CYAN}│${NC} ${BLUE}$base_url/api/cloudtalk-webhooks/call-recording-ready${NC}"
    echo -e "${CYAN}│${NC} ${BLUE}$base_url/api/cloudtalk-webhooks/transcription-ready${NC}"
    echo -e "${CYAN}│${NC} ${BLUE}$base_url/api/cloudtalk-webhooks/new-tag${NC}"
    echo -e "${CYAN}│${NC} ${BLUE}$base_url/api/cloudtalk-webhooks/contact-updated${NC}"
    echo -e "${CYAN}│${NC} ${BLUE}$base_url/api/cloudtalk-webhooks/call-started${NC}"
    echo -e "${CYAN}│${NC} ${BLUE}$base_url/api/cloudtalk-webhooks/call-ended${NC}"
    echo -e "${CYAN}│${NC} ${BLUE}$base_url/api/cloudtalk-webhooks/new-note${NC}"
    echo -e "${CYAN}│${NC}"
    echo -e "${CYAN}│${NC} ${BOLD}GHL WEBHOOKS${NC} (5 GoHighLevel sync endpoints):"
    echo -e "${CYAN}│${NC} ${BLUE}$base_url/api/ghl-webhooks/new-contact${NC}"
    echo -e "${CYAN}│${NC} ${BLUE}$base_url/api/ghl-webhooks/new-tag${NC}"
    echo -e "${CYAN}│${NC} ${BLUE}$base_url/api/ghl-webhooks/new-note${NC}"
    echo -e "${CYAN}│${NC} ${BLUE}$base_url/api/ghl-webhooks/pipeline-stage-changed${NC}"
    echo -e "${CYAN}│${NC} ${BLUE}$base_url/api/ghl-webhooks/opportunity-status-changed${NC}"
    echo -e "${CYAN}│${NC}"
    echo -e "${CYAN}│${NC} ${BOLD}HEALTH CHECK${NC}:"
    echo -e "${CYAN}│${NC} ${BLUE}$base_url/health${NC}"
    echo -e "${CYAN}│${NC}"
    echo -e "${CYAN}└─────────────────────────────────────────────────────────────┘${NC}\n"

    # Copy main webhook URL to clipboard (macOS/Linux compatible)
    local webhook_url="$base_url/api/cloudtalk-webhooks/call-ended"

    if command -v pbcopy &> /dev/null; then
        echo "$webhook_url" | pbcopy
        echo -e "${GREEN}✅ Webhook URL copied to clipboard (Cmd+V to paste)${NC}"
    elif command -v xclip &> /dev/null; then
        echo "$webhook_url" | xclip -selection clipboard
        echo -e "${GREEN}✅ Webhook URL copied to clipboard (Ctrl+V to paste)${NC}"
    else
        echo -e "${YELLOW}💡 Manual copy required - clipboard tool not found${NC}"
    fi

    echo -e "\n${YELLOW}⚠️  IMPORTANT: This URL changes each time you restart this script${NC}"
    echo -e "${GREEN}🎯 Configure this URL in CloudTalk Workflow Automation as HTTP POST${NC}"
    echo -e "${GREEN}📨 Include Call_uuid in the payload to capture CueCard UUID${NC}\n"

    echo -e "${CYAN}📋 CLOUDTALK WORKFLOW AUTOMATION SETUP:${NC}"
    echo -e "1. Go to CloudTalk Dashboard > Workflow Automations"
    echo -e "2. Create new workflow with trigger: Call > Answered"
    echo -e "3. Add action: API Request"
    echo -e "   - Method: POST"
    echo -e "   - URL: ${BLUE}$webhook_url${NC}"
    echo -e "   - Headers: Content-Type: application/json"
    echo -e "   - Body: { \"Call_uuid\": \"{{ Call_uuid }}\", \"Call_id\": \"{{ Call_id }}\", \"Agent_id\": \"{{ Agent_id }}\" }"

    echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "📊 ${BOLD}LOGS:${NC}"
    echo -e "   Webhook: ${BLUE}tail -f $APP_LOG${NC}"
    echo -e "   Tunnel:  ${BLUE}tail -f $TUNNEL_LOG${NC}"
    echo -e "\nPress ${RED}Ctrl+C${NC} to stop all services\n"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}\n"
}

# Main execution
main() {
    echo -e "${CYAN}🚀 CloudTalk CueCards Webhook Environment${NC}\n"

    # Check dependencies
    check_dependencies

    # Check for existing backend
    check_existing_backend

    # Create webhook server
    create_webhook_server

    # Install dependencies
    install_dependencies

    # Start webhook server (or use existing)
    start_backend

    # Start Cloudflare tunnel
    start_tunnel

    # Display webhook URLs
    display_webhook_urls "$TUNNEL_URL"

    # Keep script running and show logs
    echo -e "${CYAN}📡 Monitoring CloudTalk webhook traffic...${NC}\n"
    echo -e "${YELLOW}📋 Showing webhook payloads when they arrive:${NC}\n"

    # Monitor webhook traffic
    if [[ -f "$APP_LOG" ]]; then
        echo -e "${GREEN}📄 Monitoring log file: $APP_LOG${NC}\n"

        if [[ "$WEBHOOK_VERBOSE" == "1" ]]; then
            echo -e "${YELLOW}🗒 Verbose mode enabled (WEBHOOK_VERBOSE=1) - streaming all log lines${NC}"
            tail -f "$APP_LOG" 2>/dev/null &
            LOG_TAIL_PID=$!
        else
            # Filter for CloudTalk webhook messages
            tail -f "$APP_LOG" 2>/dev/null | while IFS= read -r line; do
                if [[ "$line" == *"🔵 CloudTalk webhook received"* ]] ||
                   [[ "$line" == *"📞 CALL DETAILS:"* ]] ||
                   [[ "$line" == *"🔑 Call UUID:"* ]] ||
                   [[ "$line" == *"🎯 FOUND CALL UUID"* ]] ||
                   [[ "$line" == *"🎊 CueCard"* ]] ||
                   [[ "$line" == *"✅"* ]] ||
                   [[ "$line" == *"❌"* ]] ||
                   [[ "$line" == *"⚠️"* ]]; then

                    # Color code messages
                    if [[ "$line" == *"✅"* ]]; then
                        echo -e "${GREEN}$line${NC}"
                    elif [[ "$line" == *"❌"* ]]; then
                        echo -e "${RED}$line${NC}"
                    elif [[ "$line" == *"🎯"* ]] || [[ "$line" == *"🔑"* ]]; then
                        echo -e "${YELLOW}$line${NC}"
                    elif [[ "$line" == *"🔵"* ]]; then
                        echo -e "${BLUE}$line${NC}"
                    else
                        echo -e "${CYAN}$line${NC}"
                    fi
                fi
            done &
            LOG_TAIL_PID=$!
        fi
    fi

    # Enhanced cleanup
    enhanced_cleanup() {
        echo -e "\n${YELLOW}🛑 Shutting down CloudTalk webhook monitoring...${NC}"

        if [[ -n "$LOG_TAIL_PID" ]]; then
            kill $LOG_TAIL_PID 2>/dev/null
        fi

        cleanup
    }

    trap enhanced_cleanup SIGINT SIGTERM

    # Wait for interrupt
    wait
}

# Run main function
main "$@"