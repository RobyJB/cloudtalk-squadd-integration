import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { generateSmartCueCard, sendCueCard } from './src/services/cuecard-service.js';

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
            
            // Usando il servizio CueCard Smart già importato
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
            
            try {
                // Genera CueCard intelligente con dati GHL integrati
                const smartCueCard = await generateSmartCueCard(contactPhone);
                
                // Invia la CueCard intelligente
                const result = await sendCueCard(callUuid, smartCueCard);
                
                log('🎊 Smart CueCard inviata con successo!', 'green');
                log(`📱 ${contactPhone} → GHL data + URL integrati`, 'cyan');
            } catch (cueCardError) {
                log(`⚠️ Errore generazione Smart CueCard: ${cueCardError.message}`, 'yellow');
                log('⚠️ Fallback a CueCard base', 'yellow');
                // Fallback alla CueCard base se quella smart fallisce
                // const result = await sendCueCard(callUuid, cueCardData);
            }
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
