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
 * 1. CloudTalk New Tag Webhook
 * Triggered when a new tag is created or assigned in CloudTalk
 */
router.post('/new-tag', async (req, res) => {
    try {
        logCloudTalkWebhook('new-tag', req.body, req);
        
        const tagName = req.body.tag_name || req.body.Tag_name || req.body.name;
        const contactId = req.body.contact_id || req.body.Contact_id;
        const contactName = req.body.contact_name || req.body.Contact_name;
        const contactPhone = req.body.contact_phone || req.body.Contact_phone;
        const tagId = req.body.tag_id || req.body.Tag_id || req.body.id;
        
        if (!tagName) {
            return res.status(400).json({
                success: false,
                error: 'Missing tag name in webhook payload'
            });
        }

        console.log(`🏷️ Processing new tag: "${tagName}"`);
        if (contactId && contactName) {
            console.log(`👤 Associated with contact: ${contactName} (CT ID: ${contactId})`);
        }

        // Find or create GHL contact if contact info is available
        let ghlContact = null;
        if (contactPhone && contactName) {
            ghlContact = await findOrCreateGHLContact(contactPhone, contactName);
            
            // Add tag to GHL contact
            await addTagToGHLContact(ghlContact.id, `CT-${tagName}`);
            
            // Add note about tag creation
            const tagNote = `[CloudTalk] New tag "${tagName}" created/assigned - ` +
                `CloudTalk Contact ID: ${contactId} - ${new Date().toISOString()}`;
            await addNoteToGHLContact(ghlContact.id, tagNote);
        }

        res.json({
            success: true,
            message: 'New tag processed and synced to GHL',
            tag_name: tagName,
            tag_id: tagId,
            cloudtalk_contact_id: contactId,
            ghl_contact: ghlContact,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ Error processing new tag webhook:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 2. CloudTalk Contact Update Webhook
 * Triggered when a contact's custom fields are updated in CloudTalk
 */
router.post('/contact-updated', async (req, res) => {
    try {
        logCloudTalkWebhook('contact-updated', req.body, req);
        
        const contactId = req.body.contact_id || req.body.Contact_id || req.body.id;
        const contactName = req.body.contact_name || req.body.Contact_name || req.body.name;
        const contactPhone = req.body.contact_phone || req.body.Contact_phone || req.body.phone;
        const contactEmail = req.body.contact_email || req.body.Contact_email || req.body.email;
        const updatedFields = req.body.updated_fields || req.body.custom_fields || {};
        const changeType = req.body.change_type || 'custom_field_update';
        
        if (!contactId) {
            return res.status(400).json({
                success: false,
                error: 'Missing contact ID in webhook payload'
            });
        }

        console.log(`👤 Processing contact update: ${contactName} (CT ID: ${contactId})`);
        console.log(`🔄 Change type: ${changeType}`);
        console.log(`📋 Updated fields:`, Object.keys(updatedFields));

        // Find or create GHL contact
        let ghlContact = null;
        if (contactPhone) {
            ghlContact = await findOrCreateGHLContact(contactPhone, contactName || 'CloudTalk Contact');
            
            // Create note about the update
            const updatedFieldsList = Object.entries(updatedFields)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
                
            const updateNote = `[CloudTalk] Contact updated - ` +
                `${updatedFieldsList ? `Fields: ${updatedFieldsList}` : 'Custom fields updated'}` +
                `${contactEmail ? `, Email: ${contactEmail}` : ''} - ` +
                `CloudTalk ID: ${contactId} - ${new Date().toISOString()}`;
                
            await addNoteToGHLContact(ghlContact.id, updateNote);
            
            // Add tag for updated contact
            await addTagToGHLContact(ghlContact.id, 'CT-ContactUpdated');
            
            // TODO: Update GHL custom fields with CloudTalk data
            // This would sync the actual field values to GoHighLevel
        }

        res.json({
            success: true,
            message: 'Contact update processed and synced to GHL',
            cloudtalk_contact_id: contactId,
            contact_name: contactName,
            updated_fields: Object.keys(updatedFields),
            ghl_contact: ghlContact,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ Error processing contact update webhook:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 3. CloudTalk Call Ended Webhook
 * Triggered when a call ends in CloudTalk - comprehensive call tracking
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
        console.log(`👤 Agent: ${callData.agentName}, Direction: ${callData.direction}`);
        console.log(`📼 Recording: ${callData.recording ? 'Available' : 'Not available'}`);

        // Find or create GHL contact
        let ghlContact = null;
        if (callData.contactPhone) {
            ghlContact = await findOrCreateGHLContact(
                callData.contactPhone, 
                callData.contactName || 'Unknown Contact'
            );
            
            // Create comprehensive call summary note
            const callNote = `[CloudTalk] Call completed - ` +
                `Contact: ${callData.contactName || callData.contactPhone}, ` +
                `Duration: ${callData.duration}s, Status: ${callData.status}, ` +
                `Agent: ${callData.agentName}, Direction: ${callData.direction}` +
                `${callData.recording ? ', Recording: Available' : ', Recording: Not available'}` +
                `${callData.campaignName ? `, Campaign: ${callData.campaignName}` : ''} - ` +
                `Call ID: ${callData.id} - ${new Date().toISOString()}`;
                
            await addNoteToGHLContact(ghlContact.id, callNote);
            
            // Add call completion tags
            await addTagToGHLContact(ghlContact.id, 'CT-CallCompleted');
            
            // Add direction-specific tag
            if (callData.direction) {
                await addTagToGHLContact(ghlContact.id, `CT-${callData.direction.toUpperCase()}`);
            }
            
            // Add outcome-specific tag if available
            if (callData.status) {
                await addTagToGHLContact(ghlContact.id, `CT-${callData.status.toUpperCase()}`);
            }
            
            // Add recording tag if available
            if (callData.recording) {
                await addTagToGHLContact(ghlContact.id, 'CT-RecordingAvailable');
            }
        }

        res.json({
            success: true,
            message: 'Call ended processed and synced to GHL',
            call_id: callData.id,
            duration: callData.duration,
            status: callData.status,
            direction: callData.direction,
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
 * 4. CloudTalk New Note Webhook
 * Triggered when a new note is added to a contact in CloudTalk
 */
router.post('/new-note', async (req, res) => {
    try {
        logCloudTalkWebhook('new-note', req.body, req);
        
        const contactId = req.body.contact_id || req.body.Contact_id;
        const contactName = req.body.contact_name || req.body.Contact_name;
        const contactPhone = req.body.contact_phone || req.body.Contact_phone;
        const noteContent = req.body.note_content || req.body.note || req.body.content;
        const noteId = req.body.note_id || req.body.Note_id || req.body.id;
        const agentName = req.body.agent_name || req.body.Agent_name;
        const agentId = req.body.agent_id || req.body.Agent_id;
        
        if (!noteContent) {
            return res.status(400).json({
                success: false,
                error: 'Missing note content in webhook payload'
            });
        }

        console.log(`📝 Processing new note: CloudTalk Note ID ${noteId}`);
        console.log(`👤 For contact: ${contactName} (CT ID: ${contactId})`);
        console.log(`📝 Content preview: ${noteContent.substring(0, 100)}${noteContent.length > 100 ? '...' : ''}`);
        if (agentName) {
            console.log(`👤 Added by agent: ${agentName} (${agentId})`);
        }

        // Find or create GHL contact
        let ghlContact = null;
        if (contactPhone && contactName) {
            ghlContact = await findOrCreateGHLContact(contactPhone, contactName);
            
            // Sync note to GHL with CloudTalk context
            const ghlNoteContent = `[CloudTalk Note] ${noteContent}` +
                `${agentName ? ` - Added by: ${agentName}` : ''}` +
                ` - CloudTalk Contact ID: ${contactId}` +
                `${noteId ? `, Note ID: ${noteId}` : ''} - ${new Date().toISOString()}`;
                
            await addNoteToGHLContact(ghlContact.id, ghlNoteContent);
            
            // Add tag for note activity
            await addTagToGHLContact(ghlContact.id, 'CT-NoteAdded');
            
            // Add agent tag if available
            if (agentName) {
                await addTagToGHLContact(ghlContact.id, `CT-Agent-${agentName.replace(/\s+/g, '')}`);
            }
        }

        res.json({
            success: true,
            message: 'New note processed and synced to GHL',
            note_id: noteId,
            cloudtalk_contact_id: contactId,
            contact_name: contactName,
            note_preview: noteContent.substring(0, 100),
            agent_name: agentName,
            ghl_contact: ghlContact,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ Error processing new note webhook:`, error.message);
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
        message: 'CloudTalk webhook router is active - Optimized for 4 core events',
        endpoints: [
            'POST /cloudtalk-webhooks/new-tag - New tag created/assigned',
            'POST /cloudtalk-webhooks/contact-updated - Contact custom fields updated',  
            'POST /cloudtalk-webhooks/call-ended - Call completed with full details',
            'POST /cloudtalk-webhooks/new-note - New note added to contact',
            'POST /cloudtalk-webhooks/generic - Fallback for other events'
        ],
        optimized_for: [
            'Tag management synchronization',
            'Contact data updates',
            'Call tracking and reporting', 
            'Note synchronization'
        ],
        timestamp: new Date().toISOString()
    });
});

export default router;