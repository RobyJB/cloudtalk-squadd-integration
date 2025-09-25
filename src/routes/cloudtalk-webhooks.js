import express from 'express';
import { processCloudTalkWebhook } from '../../API Squadd/webhook-to-ghl-processor.js';
import { logRequest, logError, log } from '../logger.js';
import { saveWebhookPayload } from '../utils/webhook-payload-logger.js';
import { isWebhookAlreadyProcessed, markWebhookAsProcessed } from '../utils/webhook-deduplication.js';
import { processCallEndedWebhook } from '../services/cloudtalk-campaign-automation.js';
import googleSheetsService from '../services/google-sheets-service.js';

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
  
  log(`📞 [${timestamp}] CloudTalk Webhook: CALL-ENDED (New Logic)`);
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
    // 🆕 NUOVA LOGICA: Verifica se la chiamata è missed o answered
    const talkingTime = req.body.talking_time;
    const isMissedCall = !talkingTime || talkingTime === 0;
    
    log(`🔍 Call status analysis:`);
    log(`   - Talking time: ${talkingTime}`);
    log(`   - Is missed call: ${isMissedCall}`);

    if (isMissedCall) {
      // ❌ CHIAMATA PERSA: Invia webhook a GHL + Campaign Automation
      log(`❌ MISSED CALL detected - Processing with GHL webhook`);
      
      // 1. PRIMA: Invia webhook a GoHighLevel
      let ghlWebhookResult = null;
      try {
        const ghlWebhookUrl = 'https://services.leadconnectorhq.com/hooks/DfxGoORmPoL5Z1OcfYJM/webhook-trigger/873baa5c-928e-428a-ac68-498d954a9ff7';
        
        // Prepara payload per GHL con tutti i dati della chiamata
        const ghlPayload = {
          event_type: 'cloudtalk_call_ended',
          call_type: 'missed',
          timestamp: timestamp,
          call_uuid: req.body.call_uuid,
          call_id: req.body.call_id,
          internal_number: req.body.internal_number,
          external_number: req.body.external_number,
          agent_id: req.body.agent_id,
          agent_first_name: req.body.agent_first_name,
          agent_last_name: req.body.agent_last_name,
          contact_id: req.body.contact_id,
          talking_time: req.body.talking_time || 0,
          waiting_time: req.body.waiting_time,
          call_attempts: req.body['# di tentativi di chiamata'] || req.body.call_attempts,
          is_missed_call: true,
          webhook_received_at: timestamp,
          source: 'cloudtalk_middleware'
        };
        
        log(`📤 Inviando webhook a GHL per MISSED CALL: ${ghlWebhookUrl}`);
        log(`📋 Payload GHL: ${JSON.stringify(ghlPayload, null, 2)}`);
        
        const ghlResponse = await fetch(ghlWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'CloudTalk-Middleware/1.0'
          },
          body: JSON.stringify(ghlPayload)
        });
        
        if (ghlResponse.ok) {
          const ghlResponseData = await ghlResponse.text();
          ghlWebhookResult = {
            success: true,
            message: 'Missed call webhook inviato a GoHighLevel con successo',
            response: ghlResponseData
          };
          log(`✅ Webhook GHL per MISSED CALL inviato con successo: ${ghlResponse.status}`);
        } else {
          const errorText = await ghlResponse.text();
          throw new Error(`GHL webhook failed: ${ghlResponse.status} - ${errorText}`);
        }
        
      } catch (ghlWebhookError) {
        logError(`❌ GHL Webhook failed: ${ghlWebhookError.message}`);
        
        ghlWebhookResult = {
          success: false,
          error: ghlWebhookError.message,
          message: 'GHL webhook failed but call processing continues'
        };
      }

      // 2. SECONDA: Esegui Campaign Automation (priorità alta)
      let campaignResult = null;
      try {
        campaignResult = await processCallEndedWebhook(req.body, correlationId);
        
        if (campaignResult.success) {
          log(`✅ Campaign Automation completata con successo per MISSED CALL!`);
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
        return res.status(500).json({
          success: false,
          error: 'Campaign automation failed for missed call',
          details: campaignError.message,
          webhookType: webhookType,
          timestamp: timestamp,
          retryable: true
        });
      }
      
      // 3. TERZA: Esegui processo esistente GHL (priorità bassa)
      let ghlResult = null;
      try {
        ghlResult = await processCloudTalkWebhook(req.body, webhookType);
        
        if (ghlResult.success) {
          log(`✅ GHL Integration completata con successo per MISSED CALL!`);
        } else {
          log(`⚠️ GHL Integration fallita: ${ghlResult.error || ghlResult.reason}`);
        }
        
      } catch (ghlError) {
        logError(`❌ GHL Integration error (non-critical): ${ghlError.message}`);
        // GHL errors non bloccano il processo
      }
      
      // 4. Mark webhook as processed (solo se campaign automation ok)
      if (callId) {
        markWebhookAsProcessed(callId, webhookType);
      }

      // 5. Risposta finale per MISSED CALL
      const response = {
        success: true,
        call_type: 'missed',
        message: 'MISSED CALL processed with GHL webhook forwarding and Campaign Automation',
        timestamp: timestamp,
        ghlWebhookForwarding: ghlWebhookResult || { success: false, reason: 'Not processed' },
        campaignAutomation: campaignResult || { success: false, reason: 'Not processed' },
        ghlIntegration: ghlResult || { success: false, reason: 'Not processed' }
      };
      
      // Include contact info if available from campaign automation
      if (campaignResult?.contact) {
        response.contact = campaignResult.contact;
      }
      
      log(`🎉 MISSED CALL webhook processing completed successfully!`);
      res.json(response);
      
    } else {
      // ✅ CHIAMATA RISPOSTA: Non inviare webhook, solo Campaign Automation
      log(`✅ ANSWERED CALL detected - Processing WITHOUT GHL webhook`);
      
      // Esegui solo Campaign Automation (senza webhook GHL)
      let campaignResult = null;
      try {
        campaignResult = await processCallEndedWebhook(req.body, correlationId);
        
        if (campaignResult.success) {
          log(`✅ Campaign Automation completata con successo per ANSWERED CALL!`);
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
        return res.status(500).json({
          success: false,
          error: 'Campaign automation failed for answered call',
          details: campaignError.message,
          webhookType: webhookType,
          timestamp: timestamp,
          retryable: true
        });
      }
      
      // Mark webhook as processed (solo se campaign automation ok)
      if (callId) {
        markWebhookAsProcessed(callId, webhookType);
      }

      // Risposta finale per ANSWERED CALL (senza GHL webhook)
      const response = {
        success: true,
        call_type: 'answered',
        message: 'ANSWERED CALL processed - waiting for recording (no GHL webhook sent)',
        timestamp: timestamp,
        ghlWebhookForwarding: { success: false, reason: 'Skipped for answered calls' },
        campaignAutomation: campaignResult || { success: false, reason: 'Not processed' },
        ghlIntegration: { success: false, reason: 'Skipped for answered calls' }
      };
      
      // Include contact info if available from campaign automation
      if (campaignResult?.contact) {
        response.contact = campaignResult.contact;
      }
      
      log(`🎉 ANSWERED CALL webhook processing completed - waiting for recording!`);
      res.json(response);
    }
    
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

/**
 * Handler specializzato per webhook call-started con Google Sheets integration
 * Integra il processo esistente con il tracking in tempo reale
 */
async function handleCallStartedWebhook(req, res) {
  const timestamp = new Date().toISOString();
  const webhookType = 'call-started';

  // Estrai correlation ID per il tracking
  const correlationId = req.body.call_uuid || req.body.call_id || req.body.Call_id || `webhook_${Date.now()}`;

  log(`📞 [${timestamp}] CloudTalk Webhook: CALL-STARTED (Google Sheets Integration)`);
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
    // 1. PRIMA: Insert Google Sheets row per call started
    let googleSheetsResult = null;
    try {
      await googleSheetsService.insertCallStarted(req.body);

      googleSheetsResult = {
        success: true,
        message: 'Call started tracked in Google Sheets'
      };

      log(`📊 Call started tracked in Google Sheets: ${req.body.call_uuid}`);

    } catch (googleSheetsError) {
      logError(`❌ Google Sheets insert failed: ${googleSheetsError.message}`);

      googleSheetsResult = {
        success: false,
        error: googleSheetsError.message,
        message: 'Google Sheets tracking failed but call processing continues'
      };
    }

    // 2. DOPO: Esegui processo esistente GHL (priorità normale)
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

    // 3. Mark webhook as processed
    if (callId) {
      markWebhookAsProcessed(callId, webhookType);
    }

    // 4. Risposta finale
    const response = {
      success: true,
      message: 'CloudTalk call-started webhook processed with Google Sheets tracking',
      timestamp: timestamp,
      googleSheetsTracking: googleSheetsResult || { success: false, reason: 'Not processed' },
      ghlIntegration: ghlResult || { success: false, reason: 'Not processed' }
    };

    // Include contact info if available from GHL integration
    if (ghlResult?.contact) {
      response.contact = ghlResult.contact;
    }

    log(`🎉 Call-started webhook processing completed successfully!`);
    res.json(response);

  } catch (error) {
    logError(`💥 Errore nel processamento call-started webhook: ${error.message}`);

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
 * Call started webhook with Google Sheets tracking
 * POST /api/cloudtalk-webhooks/call-started
 */
router.post('/call-started', async (req, res) => {
  await handleCallStartedWebhook(req, res);
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