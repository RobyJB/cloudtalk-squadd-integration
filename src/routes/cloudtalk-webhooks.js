import express from 'express';
import { makeCloudTalkRequest } from '../../API/config.js';

const router = express.Router();

// Utility function for logging CloudTalk webhook data  
function logCloudTalkWebhook(type, data, req) {
    const timestamp = new Date().toISOString();
    console.log(`\n📞 [${timestamp}] CloudTalk Webhook: ${type.toUpperCase()}`);
    console.log(`📡 Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`📋 Payload:`, JSON.stringify(data, null, 2));
}

// Helper function to extract call data from CloudTalk webhook
function extractCallData(payload) {
    return {
        id: payload.Call_id || payload.call_id || payload.id,
        uuid: payload.Call_uuid || payload.call_uuid || payload.uuid,
        status: payload.Call_status || payload.status || payload.call_status,
        direction: payload.Call_direction || payload.direction || payload.call_direction,
        agentId: payload.Agent_id || payload.agent_id,
        agentName: payload.Agent_name || payload.agent_name,
        contactId: payload.Contact_id || payload.contact_id,
        contactPhone: payload.Contact_phone || payload.phone || payload.contact_phone,
        contactName: payload.Contact_name || payload.contact_name,
        duration: payload.Call_duration || payload.duration,
        recording: payload.Call_recording || payload.recording,
        startTime: payload.Call_start || payload.start_time || payload.created,
        endTime: payload.Call_end || payload.end_time || payload.finished,
        campaignId: payload.Campaign_id || payload.campaign_id,
        campaignName: payload.Campaign_name || payload.campaign_name
    };
}

// Helper function to find/create GoHighLevel contact
async function findOrCreateGHLContact(phone, name) {
    // TODO: Implement GoHighLevel API integration
    // This would search for existing contact by phone and create if not found
    console.log(`🔍 Looking for GHL contact: ${name} (${phone})`);
    
    // Placeholder return - implement actual GHL API calls
    return {
        id: `ghl_${phone}_${Date.now()}`, // Mock GHL contact ID
        found: false, // Whether contact was found or created
        name: name,
        phone: phone
    };
}

// Helper function to add note to GoHighLevel contact
async function addNoteToGHLContact(contactId, noteContent) {
    // TODO: Implement GoHighLevel API integration
    console.log(`📝 Adding note to GHL contact ${contactId}: ${noteContent.substring(0, 100)}...`);
    
    // Placeholder return - implement actual GHL API calls
    return {
        success: true,
        note_id: `ghl_note_${Date.now()}`,
        message: 'Note added to GoHighLevel contact'
    };
}

// Helper function to add tag to GoHighLevel contact
async function addTagToGHLContact(contactId, tagName) {
    // TODO: Implement GoHighLevel API integration  
    console.log(`🏷️ Adding tag "${tagName}" to GHL contact ${contactId}`);
    
    // Placeholder return - implement actual GHL API calls
    return {
        success: true,
        tag_name: tagName,
        message: 'Tag added to GoHighLevel contact'
    };
}

/**
 * 1. CloudTalk Call Started Webhook
 * Triggered when a call starts in CloudTalk
 */
router.post('/call-started', async (req, res) => {
    try {
        logCloudTalkWebhook('call-started', req.body, req);
        
        const callData = extractCallData(req.body);
        
        if (!callData.id || !callData.uuid) {
            return res.status(400).json({
                success: false,
                error: 'Missing call ID or UUID in webhook payload'
            });
        }

        console.log(`📞 Processing call started: ${callData.id} (UUID: ${callData.uuid})`);
        console.log(`👤 Agent: ${callData.agentName} (${callData.agentId})`);
        console.log(`📱 Contact: ${callData.contactName} (${callData.contactPhone})`);

        // Find or create GHL contact if phone number is available
        let ghlContact = null;
        if (callData.contactPhone) {
            ghlContact = await findOrCreateGHLContact(
                callData.contactPhone, 
                callData.contactName || 'Unknown Contact'
            );
            
            // Add note about call start
            const callNote = `[CloudTalk] Call started with ${callData.contactName || callData.contactPhone} - ` +
                `Agent: ${callData.agentName}, Direction: ${callData.direction}, ` +
                `Call ID: ${callData.id} - ${new Date().toISOString()}`;
                
            await addNoteToGHLContact(ghlContact.id, callNote);
            
            // Add tag for call activity
            await addTagToGHLContact(ghlContact.id, 'CloudTalk-CallActive');
        }

        res.json({
            success: true,
            message: 'Call started event processed',
            call_id: callData.id,
            call_uuid: callData.uuid,
            ghl_contact: ghlContact,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ Error processing call started webhook:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 2. CloudTalk Call Ended Webhook
 * Triggered when a call ends in CloudTalk
 */
router.post('/call-ended', async (req, res) => {
    try {
        logCloudTalkWebhook('call-ended', req.body, req);
        
        const callData = extractCallData(req.body);
        
        if (!callData.id) {
            return res.status(400).json({
                success: false,
                error: 'Missing call ID in webhook payload'
            });
        }

        console.log(`📞 Processing call ended: ${callData.id}`);
        console.log(`⏱️ Duration: ${callData.duration}s, Status: ${callData.status}`);
        console.log(`📼 Recording: ${callData.recording ? 'Available' : 'Not available'}`);

        // Find or create GHL contact
        let ghlContact = null;
        if (callData.contactPhone) {
            ghlContact = await findOrCreateGHLContact(
                callData.contactPhone, 
                callData.contactName || 'Unknown Contact'
            );
            
            // Add detailed note about call completion
            const callNote = `[CloudTalk] Call completed with ${callData.contactName || callData.contactPhone} - ` +
                `Duration: ${callData.duration}s, Status: ${callData.status}, ` +
                `Agent: ${callData.agentName}, Direction: ${callData.direction}` +
                `${callData.recording ? ', Recording: Available' : ', Recording: Not available'} - ` +
                `Call ID: ${callData.id} - ${new Date().toISOString()}`;
                
            await addNoteToGHLContact(ghlContact.id, callNote);
            
            // Remove active call tag and add completion tag
            await addTagToGHLContact(ghlContact.id, 'CloudTalk-CallCompleted');
            
            // Add specific tag based on call outcome
            if (callData.status) {
                await addTagToGHLContact(ghlContact.id, `CloudTalk-${callData.status}`);
            }
        }

        res.json({
            success: true,
            message: 'Call ended event processed',
            call_id: callData.id,
            duration: callData.duration,
            status: callData.status,
            recording_available: !!callData.recording,
            ghl_contact: ghlContact,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ Error processing call ended webhook:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 3. CloudTalk Call Recording Available Webhook
 * Triggered when call recording becomes available
 */
router.post('/recording-available', async (req, res) => {
    try {
        logCloudTalkWebhook('recording-available', req.body, req);
        
        const callData = extractCallData(req.body);
        const recordingUrl = req.body.recording_url || req.body.Recording_url;
        
        if (!callData.id) {
            return res.status(400).json({
                success: false,
                error: 'Missing call ID in webhook payload'
            });
        }

        console.log(`📼 Processing recording available for call: ${callData.id}`);
        console.log(`🔗 Recording URL: ${recordingUrl ? 'Available' : 'Not provided'}`);

        // Find or create GHL contact
        let ghlContact = null;
        if (callData.contactPhone) {
            ghlContact = await findOrCreateGHLContact(
                callData.contactPhone, 
                callData.contactName || 'Unknown Contact'
            );
            
            // Add note about recording availability
            const recordingNote = `[CloudTalk] Call recording now available - ` +
                `Call with ${callData.contactName || callData.contactPhone}, ` +
                `Agent: ${callData.agentName}, Duration: ${callData.duration}s` +
                `${recordingUrl ? `, URL: ${recordingUrl}` : ''} - ` +
                `Call ID: ${callData.id} - ${new Date().toISOString()}`;
                
            await addNoteToGHLContact(ghlContact.id, recordingNote);
            
            // Add recording tag
            await addTagToGHLContact(ghlContact.id, 'CloudTalk-RecordingAvailable');
        }

        res.json({
            success: true,
            message: 'Recording available event processed',
            call_id: callData.id,
            recording_url: recordingUrl,
            ghl_contact: ghlContact,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ Error processing recording available webhook:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 4. CloudTalk Agent Status Change Webhook
 * Triggered when an agent's status changes (online, offline, busy, etc.)
 */
router.post('/agent-status-change', async (req, res) => {
    try {
        logCloudTalkWebhook('agent-status-change', req.body, req);
        
        const agentId = req.body.Agent_id || req.body.agent_id;
        const agentName = req.body.Agent_name || req.body.agent_name || req.body.name;
        const newStatus = req.body.status || req.body.new_status;
        const previousStatus = req.body.previous_status || req.body.old_status;
        
        if (!agentId || !newStatus) {
            return res.status(400).json({
                success: false,
                error: 'Missing agent ID or status in webhook payload'
            });
        }

        console.log(`👤 Processing agent status change: ${agentName} (${agentId})`);
        console.log(`🔄 Status: ${newStatus}${previousStatus ? ` (from: ${previousStatus})` : ''}`);

        // TODO: Implement GoHighLevel integration for agent status updates
        // This might involve updating a custom field or adding a note to relevant contacts
        
        res.json({
            success: true,
            message: 'Agent status change processed',
            agent_id: agentId,
            agent_name: agentName,
            new_status: newStatus,
            previous_status: previousStatus,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ Error processing agent status change webhook:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 5. CloudTalk Contact Created Webhook
 * Triggered when a new contact is created in CloudTalk
 */
router.post('/contact-created', async (req, res) => {
    try {
        logCloudTalkWebhook('contact-created', req.body, req);
        
        const contactId = req.body.Contact_id || req.body.contact_id || req.body.id;
        const contactName = req.body.Contact_name || req.body.name;
        const contactPhone = req.body.Contact_phone || req.body.phone;
        const contactEmail = req.body.Contact_email || req.body.email;
        const source = req.body.source || 'CloudTalk';
        
        if (!contactId) {
            return res.status(400).json({
                success: false,
                error: 'Missing contact ID in webhook payload'
            });
        }

        console.log(`👤 Processing contact created: ${contactName} (ID: ${contactId})`);
        console.log(`📱 Phone: ${contactPhone}, 📧 Email: ${contactEmail}`);

        // Create or update contact in GoHighLevel
        let ghlContact = null;
        if (contactPhone) {
            ghlContact = await findOrCreateGHLContact(contactPhone, contactName || 'CloudTalk Contact');
            
            // Add note about CloudTalk contact creation
            const contactNote = `[CloudTalk] Contact created in CloudTalk - ` +
                `Name: ${contactName}, Phone: ${contactPhone}` +
                `${contactEmail ? `, Email: ${contactEmail}` : ''}, ` +
                `Source: ${source}, CloudTalk ID: ${contactId} - ${new Date().toISOString()}`;
                
            await addNoteToGHLContact(ghlContact.id, contactNote);
            
            // Add CloudTalk origin tag
            await addTagToGHLContact(ghlContact.id, 'CloudTalk-Contact');
        }

        res.json({
            success: true,
            message: 'Contact created event processed',
            cloudtalk_contact_id: contactId,
            ghl_contact: ghlContact,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ Error processing contact created webhook:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 6. CloudTalk Campaign Status Change Webhook
 * Triggered when a campaign status changes (started, stopped, paused, etc.)
 */
router.post('/campaign-status-change', async (req, res) => {
    try {
        logCloudTalkWebhook('campaign-status-change', req.body, req);
        
        const campaignId = req.body.Campaign_id || req.body.campaign_id;
        const campaignName = req.body.Campaign_name || req.body.campaign_name || req.body.name;
        const newStatus = req.body.status || req.body.new_status;
        const previousStatus = req.body.previous_status || req.body.old_status;
        const contactsAffected = req.body.contacts_affected || req.body.contact_count;
        
        if (!campaignId || !newStatus) {
            return res.status(400).json({
                success: false,
                error: 'Missing campaign ID or status in webhook payload'
            });
        }

        console.log(`📈 Processing campaign status change: ${campaignName} (${campaignId})`);
        console.log(`🔄 Status: ${newStatus}${previousStatus ? ` (from: ${previousStatus})` : ''}`);
        console.log(`👥 Contacts affected: ${contactsAffected || 'Unknown'}`);

        // TODO: Implement GoHighLevel integration for campaign status updates
        // This might involve updating pipeline stages or adding notes to campaign contacts
        
        res.json({
            success: true,
            message: 'Campaign status change processed',
            campaign_id: campaignId,
            campaign_name: campaignName,
            new_status: newStatus,
            previous_status: previousStatus,
            contacts_affected: contactsAffected,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ Error processing campaign status change webhook:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Generic CloudTalk webhook endpoint (fallback)
router.post('/generic', async (req, res) => {
    try {
        logCloudTalkWebhook('generic', req.body, req);
        
        const eventType = req.body.event_type || req.body.type || 'unknown';
        
        console.log(`🔄 Processing generic CloudTalk webhook: ${eventType}`);

        res.json({
            success: true,
            message: 'Generic CloudTalk webhook received',
            event_type: eventType,
            payload_keys: Object.keys(req.body),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ Error processing generic CloudTalk webhook:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test endpoint for CloudTalk webhook functionality
router.get('/test', (req, res) => {
    res.json({
        message: 'CloudTalk webhook router is active',
        endpoints: [
            'POST /cloudtalk-webhooks/call-started',
            'POST /cloudtalk-webhooks/call-ended',
            'POST /cloudtalk-webhooks/recording-available',
            'POST /cloudtalk-webhooks/agent-status-change',
            'POST /cloudtalk-webhooks/contact-created',
            'POST /cloudtalk-webhooks/campaign-status-change',
            'POST /cloudtalk-webhooks/generic'
        ],
        timestamp: new Date().toISOString()
    });
});

export default router;