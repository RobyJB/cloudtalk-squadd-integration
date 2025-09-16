import express from 'express';
import { makeCloudTalkRequest } from '../../API/config.js';

const router = express.Router();

// Utility function for logging webhook data
function logWebhook(type, data, req) {
    const timestamp = new Date().toISOString();
    console.log(`\n🔔 [${timestamp}] GHL Webhook: ${type.toUpperCase()}`);
    console.log(`📡 Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`📋 Payload:`, JSON.stringify(data, null, 2));
}

// Helper function to extract contact data from GHL webhook
function extractContactData(payload) {
    return {
        id: payload.contact?.id || payload.contact_id || payload.id,
        name: payload.contact?.name || payload.full_name || payload.name,
        firstName: payload.contact?.firstName || payload.first_name,
        lastName: payload.contact?.lastName || payload.last_name,
        email: payload.contact?.email || payload.email,
        phone: payload.contact?.phone || payload.phone,
        tags: payload.contact?.tags || payload.tags || [],
        customFields: payload.contact?.customFields || payload.custom_fields || {}
    };
}

// Helper function to create CloudTalk contact via bulk API
async function createCloudTalkContact(contactData) {
    const bulkData = [{
        action: "add_contact",
        command_id: `ghl_contact_${contactData.id}_${Date.now()}`,
        data: {
            name: contactData.name || `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim(),
            email: contactData.email || null,
            phone: contactData.phone || null,
            title: `GHL Contact Import`,
            company: "GoHighLevel",
            address: contactData.customFields?.address || null,
            city: contactData.customFields?.city || null,
            source: "GoHighLevel Webhook"
        }
    }];

    return await makeCloudTalkRequest('/bulk/contacts.json', {
        method: 'POST',
        body: JSON.stringify(bulkData)
    });
}

// Helper function to add note to CloudTalk contact
async function addNoteToContact(contactId, noteContent) {
    const bulkData = [{
        action: "add_note",
        command_id: `ghl_note_${contactId}_${Date.now()}`,
        data: {
            contact_id: parseInt(contactId),
            note: noteContent
        }
    }];

    return await makeCloudTalkRequest('/bulk/contacts.json', {
        method: 'POST',
        body: JSON.stringify(bulkData)
    });
}

// Helper function to add tag to CloudTalk contact
async function addTagToContact(contactId, tagName) {
    const bulkData = [{
        action: "edit_contact",
        command_id: `ghl_tag_${contactId}_${Date.now()}`,
        data: {
            contact_id: parseInt(contactId),
            name: "Contact Name", // Required field
            tags: [tagName]
        }
    }];

    return await makeCloudTalkRequest('/bulk/contacts.json', {
        method: 'POST',
        body: JSON.stringify(bulkData)
    });
}

/**
 * 1. GHL New Contact Webhook
 * Triggered when a new contact is created in GoHighLevel
 */
router.post('/new-contact', async (req, res) => {
    try {
        logWebhook('new-contact', req.body, req);
        
        const contactData = extractContactData(req.body);
        
        if (!contactData.id) {
            return res.status(400).json({
                success: false,
                error: 'Missing contact ID in webhook payload'
            });
        }

        console.log(`👤 Processing new contact: ${contactData.name} (ID: ${contactData.id})`);

        // Create contact in CloudTalk
        const cloudTalkResult = await createCloudTalkContact(contactData);
        
        console.log(`✅ CloudTalk contact created:`, JSON.stringify(cloudTalkResult.data, null, 2));

        res.json({
            success: true,
            message: 'Contact created in CloudTalk',
            ghl_contact_id: contactData.id,
            cloudtalk_result: cloudTalkResult.data,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ Error processing new contact webhook:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 2. GHL New Tag Webhook  
 * Triggered when a tag is added to a contact in GoHighLevel
 */
router.post('/new-tag', async (req, res) => {
    try {
        logWebhook('new-tag', req.body, req);
        
        const contactData = extractContactData(req.body);
        const tagData = req.body.tag || req.body.tags?.[0] || {};
        const tagName = tagData.name || tagData.tag || req.body.tag_name;
        
        if (!contactData.id || !tagName) {
            return res.status(400).json({
                success: false,
                error: 'Missing contact ID or tag name in webhook payload'
            });
        }

        console.log(`🏷️  Processing new tag "${tagName}" for contact: ${contactData.name} (ID: ${contactData.id})`);

        // First, try to find CloudTalk contact ID (you may need to implement a mapping system)
        // For now, we'll assume the contact exists and use a placeholder CloudTalk ID
        const cloudTalkContactId = contactData.id; // This should be mapped to actual CloudTalk contact ID

        // Add tag to CloudTalk contact
        const cloudTalkResult = await addTagToContact(cloudTalkContactId, tagName);
        
        console.log(`✅ CloudTalk tag added:`, JSON.stringify(cloudTalkResult.data, null, 2));

        res.json({
            success: true,
            message: 'Tag added to CloudTalk contact',
            ghl_contact_id: contactData.id,
            tag_name: tagName,
            cloudtalk_result: cloudTalkResult.data,
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
 * 3. GHL New Note Webhook
 * Triggered when a note is added to a contact in GoHighLevel
 */
router.post('/new-note', async (req, res) => {
    try {
        logWebhook('new-note', req.body, req);
        
        const contactData = extractContactData(req.body);
        const noteContent = req.body.note?.body || req.body.note?.content || req.body.note_content || req.body.body;
        const noteAuthor = req.body.note?.userId || req.body.user_id || req.body.author;
        
        if (!contactData.id || !noteContent) {
            return res.status(400).json({
                success: false,
                error: 'Missing contact ID or note content in webhook payload'
            });
        }

        console.log(`📝 Processing new note for contact: ${contactData.name} (ID: ${contactData.id})`);
        console.log(`📄 Note content: ${noteContent.substring(0, 100)}${noteContent.length > 100 ? '...' : ''}`);

        // Map GHL contact ID to CloudTalk contact ID (implement your mapping logic)
        const cloudTalkContactId = contactData.id; // This should be mapped to actual CloudTalk contact ID

        // Enhance note content with GHL context
        const enhancedNote = `[GHL Note] ${noteContent}${noteAuthor ? ` - Added by User ID: ${noteAuthor}` : ''} - ${new Date().toISOString()}`;

        // Add note to CloudTalk contact
        const cloudTalkResult = await addNoteToContact(cloudTalkContactId, enhancedNote);
        
        console.log(`✅ CloudTalk note added:`, JSON.stringify(cloudTalkResult.data, null, 2));

        res.json({
            success: true,
            message: 'Note added to CloudTalk contact',
            ghl_contact_id: contactData.id,
            note_preview: noteContent.substring(0, 100),
            cloudtalk_result: cloudTalkResult.data,
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

/**
 * 4. GHL Pipeline Change Webhook
 * Triggered when a contact moves between pipeline stages
 */
router.post('/pipeline-change', async (req, res) => {
    try {
        logWebhook('pipeline-change', req.body, req);
        
        const contactData = extractContactData(req.body);
        const pipelineData = req.body.pipeline || {};
        const stageData = req.body.stage || {};
        
        const pipelineName = pipelineData.name || req.body.pipeline_name;
        const stageName = stageData.name || req.body.stage_name;
        const previousStage = req.body.previous_stage?.name || req.body.previous_stage_name;
        
        if (!contactData.id || !stageName) {
            return res.status(400).json({
                success: false,
                error: 'Missing contact ID or stage information in webhook payload'
            });
        }

        console.log(`📊 Processing pipeline change for contact: ${contactData.name} (ID: ${contactData.id})`);
        console.log(`🔄 Pipeline: ${pipelineName}, Stage: ${stageName}${previousStage ? ` (from: ${previousStage})` : ''}`);

        // Map GHL contact ID to CloudTalk contact ID
        const cloudTalkContactId = contactData.id;

        // Create activity note about pipeline change
        const pipelineNote = `[GHL Pipeline Change] Contact moved to "${stageName}" stage` +
            `${pipelineName ? ` in "${pipelineName}" pipeline` : ''}` +
            `${previousStage ? ` (from "${previousStage}")` : ''}` +
            ` - ${new Date().toISOString()}`;

        // Add pipeline change as activity in CloudTalk
        const bulkData = [{
            action: "add_activity",
            command_id: `ghl_pipeline_${contactData.id}_${Date.now()}`,
            data: {
                contact_id: parseInt(cloudTalkContactId),
                title: "Pipeline Stage Change",
                note: pipelineNote,
                type: "other",
                date: new Date().toISOString()
            }
        }];

        const cloudTalkResult = await makeCloudTalkRequest('/bulk/contacts.json', {
            method: 'POST',
            body: JSON.stringify(bulkData)
        });
        
        console.log(`✅ CloudTalk pipeline activity added:`, JSON.stringify(cloudTalkResult.data, null, 2));

        res.json({
            success: true,
            message: 'Pipeline change recorded in CloudTalk',
            ghl_contact_id: contactData.id,
            pipeline: pipelineName,
            stage: stageName,
            previous_stage: previousStage,
            cloudtalk_result: cloudTalkResult.data,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ Error processing pipeline change webhook:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 5. GHL Status Change Webhook
 * Triggered when a contact's status changes (active, inactive, etc.)
 */
router.post('/status-change', async (req, res) => {
    try {
        logWebhook('status-change', req.body, req);
        
        const contactData = extractContactData(req.body);
        const newStatus = req.body.status || req.body.new_status;
        const previousStatus = req.body.previous_status || req.body.old_status;
        const statusReason = req.body.status_reason || req.body.reason;
        
        if (!contactData.id || !newStatus) {
            return res.status(400).json({
                success: false,
                error: 'Missing contact ID or status information in webhook payload'
            });
        }

        console.log(`📊 Processing status change for contact: ${contactData.name} (ID: ${contactData.id})`);
        console.log(`🔄 Status: ${newStatus}${previousStatus ? ` (from: ${previousStatus})` : ''}${statusReason ? ` - Reason: ${statusReason}` : ''}`);

        // Map GHL contact ID to CloudTalk contact ID
        const cloudTalkContactId = contactData.id;

        // Create note about status change
        const statusNote = `[GHL Status Change] Contact status changed to "${newStatus}"` +
            `${previousStatus ? ` (from "${previousStatus}")` : ''}` +
            `${statusReason ? ` - Reason: ${statusReason}` : ''}` +
            ` - ${new Date().toISOString()}`;

        // Add status change as note in CloudTalk
        const cloudTalkResult = await addNoteToContact(cloudTalkContactId, statusNote);
        
        // Also create a tag based on the new status if it's meaningful
        let tagResult = null;
        if (newStatus && ['active', 'inactive', 'lead', 'customer', 'prospect'].includes(newStatus.toLowerCase())) {
            try {
                tagResult = await addTagToContact(cloudTalkContactId, `GHL-${newStatus.toUpperCase()}`);
            } catch (tagError) {
                console.log(`⚠️ Could not add status tag: ${tagError.message}`);
            }
        }
        
        console.log(`✅ CloudTalk status change recorded:`, JSON.stringify(cloudTalkResult.data, null, 2));

        res.json({
            success: true,
            message: 'Status change recorded in CloudTalk',
            ghl_contact_id: contactData.id,
            new_status: newStatus,
            previous_status: previousStatus,
            status_reason: statusReason,
            cloudtalk_note_result: cloudTalkResult.data,
            cloudtalk_tag_result: tagResult?.data || null,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ Error processing status change webhook:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test endpoint for webhook functionality
router.get('/test', (req, res) => {
    res.json({
        message: 'GoHighLevel webhook router is active',
        endpoints: [
            'POST /ghl-webhooks/new-contact',
            'POST /ghl-webhooks/new-tag', 
            'POST /ghl-webhooks/new-note',
            'POST /ghl-webhooks/pipeline-change',
            'POST /ghl-webhooks/status-change'
        ],
        timestamp: new Date().toISOString()
    });
});

export default router;