import express from 'express';
import { processCloudTalkWebhook } from '../../API Squadd/webhook-to-ghl-processor.js';
import { logRequest, logError, log } from '../logger.js';
import { saveWebhookPayload } from '../utils/webhook-payload-logger.js';
import { isWebhookAlreadyProcessed, markWebhookAsProcessed } from '../utils/webhook-deduplication.js';
import { processCallEndedWebhook } from '../services/cloudtalk-campaign-automation.js';

const router = express.Router();

// CloudTalk Webhooks → GHL Integration

/**
 * Generic webhook processor
 */
async function handleWebhook(req, res, webhookType) {
  const timestamp = new Date().toISOString();

  log(`📞 [${timestamp}] CloudTalk Webhook: ${webhookType.toUpperCase()}`);
  log(`📡 Headers: ${JSON.stringify(req.headers, null, 2)}`);
  log(`📋 Payload: ${JSON.stringify(req.body, null, 2)}`);

  // Check for duplicate webhook
  const callId = req.body.call_id || req.body.Call_id;
  if (callId && isWebhookAlreadyProcessed(callId, webhookType)) {
    log(`🔄 Skipping duplicate webhook: ${callId}_${webhookType}`);
    return res.json({
      success: true,
      message: 'Webhook already processed (duplicate)',
      callId: callId,
      webhookType: webhookType,
      timestamp: timestamp
    });
  }

  // Save webhook payload to JSON file
  const saveResult = await saveWebhookPayload('cloudtalk', webhookType, req.body, req.headers);
  if (saveResult.success) {
    log(`💾 Payload salvato in: ${saveResult.filepath}`);
  } else {
    logError(`❌ Errore salvando payload: ${saveResult.error}`);
  }

  try {
    // Process webhook with our GHL integration
    const result = await processCloudTalkWebhook(req.body, webhookType);

    if (result.success) {
      // Mark webhook as processed to prevent duplicates
      if (callId) {
        markWebhookAsProcessed(callId, webhookType);
      }

      log(`✅ Webhook ${webhookType} processato con successo!`);
      log(`👤 Contatto: ${result.contact.name} (${result.contact.id})`);
      log(`📝 Azione: ${result.result.action}`);

      res.json({
        success: true,
        message: `CloudTalk webhook ${webhookType} processed successfully`,
        timestamp: timestamp,
        contact: result.contact,
        result: result.result
      });
    } else {
      logError(`❌ Webhook ${webhookType} fallito: ${result.error || result.reason}`);

      res.status(400).json({
        success: false,
        error: result.error || result.reason,
        webhookType: webhookType,
        timestamp: timestamp
      });
    }

  } catch (error) {
    logError(`💥 Errore nel processamento webhook ${webhookType}: ${error.message}`);

    res.status(500).json({
      success: false,
      error: error.message,
      webhookType: webhookType,
      timestamp: timestamp
    });
  }
}

/**
 * Handler specializzato per webhook call-ended con Campaign Automation
 * Integra il processo esistente con la logica di progressione campagne
 */
async function handleCallEndedWebhook(req, res) {
  const timestamp = new Date().toISOString();
  const webhookType = 'call-ended';
  
  // Estrai correlation ID per il tracking
  const correlationId = req.body.call_uuid || req.body.call_id || req.body.Call_id || `webhook_${Date.now()}`;
  
  log(`📞 [${timestamp}] CloudTalk Webhook: CALL-ENDED (Campaign Automation)`);
  log(`🔗 Correlation ID: ${correlationId}`);
  log(`📡 Headers: ${JSON.stringify(req.headers, null, 2)}`);
  log(`📋 Payload: ${JSON.stringify(req.body, null, 2)}`);

  // Check for duplicate webhook
  const callId = req.body.call_id || req.body.Call_id || req.body.call_uuid;
  if (callId && isWebhookAlreadyProcessed(callId, webhookType)) {
    log(`🔄 Skipping duplicate webhook: ${callId}_${webhookType}`);
    return res.json({
      success: true,
      message: 'Webhook already processed (duplicate)',
      callId: callId,
      webhookType: webhookType,
      timestamp: timestamp
    });
  }

  // Save webhook payload to JSON file
  const saveResult = await saveWebhookPayload('cloudtalk', webhookType, req.body, req.headers);
  if (saveResult.success) {
    log(`💾 Payload salvato in: ${saveResult.filepath}`);
  } else {
    logError(`❌ Errore salvando payload: ${saveResult.error}`);
  }

  try {
    // 1. PRIMA: Esegui Campaign Automation (priorità alta)
    let campaignResult = null;
    try {
      campaignResult = await processCallEndedWebhook(req.body, correlationId);
      
      if (campaignResult.success) {
        log(`✅ Campaign Automation completata con successo!`);
        log(`👤 Contatto: ${campaignResult.contact?.name} (${campaignResult.contact?.id})`);
        log(`🔢 Tentativi: ${campaignResult.attempts?.previous} → ${campaignResult.attempts?.new}`);
        
        if (campaignResult.campaign) {
          log(`📈 Campagna spostata: ${campaignResult.campaign.source} → ${campaignResult.campaign.target}`);
        }
      } else {
        log(`⚠️ Campaign Automation saltata: ${campaignResult.reason}`);
      }
      
    } catch (campaignError) {
      logError(`❌ Campaign Automation fallita: ${campaignError.message}`);
      
      // Se campaign automation fallisce, rispondi 500 per retry
      // (specialmente per errori di update custom field)
      return res.status(500).json({
        success: false,
        error: 'Campaign automation failed',
        details: campaignError.message,
        webhookType: webhookType,
        timestamp: timestamp,
        retryable: true
      });
    }
    
    // 2. DOPO: Esegui processo esistente GHL (priorità bassa)
    let ghlResult = null;
    try {
      ghlResult = await processCloudTalkWebhook(req.body, webhookType);
      
      if (ghlResult.success) {
        log(`✅ GHL Integration completata con successo!`);
      } else {
        log(`⚠️ GHL Integration fallita: ${ghlResult.error || ghlResult.reason}`);
      }
      
    } catch (ghlError) {
      logError(`❌ GHL Integration error (non-critical): ${ghlError.message}`);
      // GHL errors non bloccano il processo
    }
    
    // 3. Mark webhook as processed (solo se campaign automation ok)
    if (callId) {
      markWebhookAsProcessed(callId, webhookType);
    }
    
    // 4. Risposta finale
    const response = {
      success: true,
      message: 'CloudTalk call-ended webhook processed with Campaign Automation',
      timestamp: timestamp,
      campaignAutomation: campaignResult || { success: false, reason: 'Not processed' },
      ghlIntegration: ghlResult || { success: false, reason: 'Not processed' }
    };
    
    // Include contact info if available from campaign automation
    if (campaignResult?.contact) {
      response.contact = campaignResult.contact;
    }
    
    log(`🎉 Call-ended webhook processing completed successfully!`);
    res.json(response);
    
  } catch (error) {
    logError(`💥 Errore nel processamento call-ended webhook: ${error.message}`);

    res.status(500).json({
      success: false,
      error: error.message,
      webhookType: webhookType,
      timestamp: timestamp
    });
  }
}

// CloudTalk Webhook Endpoints

/**
 * Recording ready webhook
 * POST /api/cloudtalk-webhooks/call-recording-ready
 */
router.post('/call-recording-ready', async (req, res) => {
  await handleWebhook(req, res, 'call-recording-ready');
});

/**
 * New tag webhook
 * POST /api/cloudtalk-webhooks/new-tag
 */
router.post('/new-tag', async (req, res) => {
  await handleWebhook(req, res, 'new-tag');
});

/**
 * Contact updated webhook
 * POST /api/cloudtalk-webhooks/contact-updated
 */
router.post('/contact-updated', async (req, res) => {
  await handleWebhook(req, res, 'contact-updated');
});

/**
 * Call started webhook
 * POST /api/cloudtalk-webhooks/call-started
 */
router.post('/call-started', async (req, res) => {
  await handleWebhook(req, res, 'call-started');
});

/**
 * Call ended webhook with Campaign Automation
 * POST /api/cloudtalk-webhooks/call-ended
 */
router.post('/call-ended', async (req, res) => {
  await handleCallEndedWebhook(req, res);
});

/**
 * New note webhook
 * POST /api/cloudtalk-webhooks/new-note
 */
router.post('/new-note', async (req, res) => {
  await handleWebhook(req, res, 'new-note');
});

/**
 * Transcription ready webhook
 * POST /api/cloudtalk-webhooks/transcription-ready
 */
router.post('/transcription-ready', async (req, res) => {
  await handleWebhook(req, res, 'transcription-ready');
});

/**
 * Generic webhook endpoint (fallback)
 * POST /api/cloudtalk-webhooks/generic
 */
router.post('/generic', async (req, res) => {
  // Try to detect webhook type from payload
  let webhookType = 'call-recording-ready'; // default

  if (req.body.recording_url) {
    webhookType = 'call-recording-ready';
  } else if (req.body.transcription || req.body.transcript || req.body.transcription_url) {
    webhookType = 'transcription-ready';
  } else if (req.body.tag_name || req.body.tag) {
    webhookType = 'new-tag';
  } else if (req.body.note_content || req.body.content) {
    webhookType = 'new-note';
  } else if (req.body.call_status === 'answered' || req.body.call_status === 'ended') {
    webhookType = 'call-ended';
  } else if (req.body.call_id && !req.body.recording_url) {
    webhookType = 'call-started';
  }

  log(`🔄 Auto-detected webhook type: ${webhookType}`);
  await handleWebhook(req, res, webhookType);
});

/**
 * Health check for CloudTalk webhooks
 * GET /api/cloudtalk-webhooks/health
 */
router.get('/health', (req, res) => {
  res.json({
    service: 'CloudTalk → GHL Webhooks',
    status: 'active',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/call-recording-ready',
      '/new-tag',
      '/contact-updated',
      '/call-started',
      '/call-ended',
      '/new-note',
      '/transcription-ready',
      '/generic'
    ]
  });
});

/**
 * Test endpoint
 * POST /api/cloudtalk-webhooks/test
 */
router.post('/test', async (req, res) => {
  log('🧪 Test webhook chiamato');

  // Use test payload if none provided
  const testPayload = req.body.external_number ? req.body : {
    "call_id": 1002226167,
    "recording_url": "https://my.cloudtalk.io/pub/r/MTAwMjIyNjE2Nw%3D%3D/test.wav",
    "internal_number": 40312296109,
    "external_number": "393936815798"
  };

  req.body = testPayload;
  await handleWebhook(req, res, 'call-recording-ready');
});

export default router;