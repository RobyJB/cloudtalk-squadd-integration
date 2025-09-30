import express from 'express';
import { processCloudTalkWebhook } from '../../API Squadd/webhook-to-ghl-processor.js';
import { logRequest, logError, log } from '../logger.js';
import { saveWebhookPayload } from '../utils/webhook-payload-logger.js';
import { isWebhookAlreadyProcessed, markWebhookAsProcessed } from '../utils/webhook-deduplication.js';
import { validateAndEnhanceWebhookPayload, extractDeduplicationKey, logValidationSummary } from '../utils/webhook-validation.js';
import { processCallEndedWebhook } from '../services/cloudtalk-campaign-automation.js';
import { processCloudTalkCallEndedForGHL } from '../services/ghl-call-attempts-service.js';
import { addNoteToGHLContact } from '../../API Squadd/tests/add-note.js';
import googleSheetsService from '../services/google-sheets-service.js';

const router = express.Router();

// CloudTalk Webhooks → GHL Integration

/**
 * Generic webhook processor with enhanced validation
 */
async function handleWebhook(req, res, webhookType) {
  const timestamp = new Date().toISOString();

  log(`📞 [${timestamp}] CloudTalk Webhook: ${webhookType.toUpperCase()}`);
  log(`📡 Headers: ${JSON.stringify(req.headers, null, 2)}`);
  log(`📋 Payload: ${JSON.stringify(req.body, null, 2)}`);

  // STEP 1: Validate and enhance webhook payload
  const validation = validateAndEnhanceWebhookPayload(req.body, webhookType);
  logValidationSummary(validation, webhookType);

  // Use enhanced payload for processing
  const enhancedPayload = validation.enhancedPayload;

  // STEP 2: Check for duplicate webhook using validated data
  const deduplicationKey = extractDeduplicationKey(enhancedPayload, webhookType);
  const callId = enhancedPayload.call_id; // This is guaranteed to exist after validation

  if (isWebhookAlreadyProcessed(callId, webhookType)) {
    log(`🔄 Skipping duplicate webhook: ${deduplicationKey}`);
    return res.json({
      success: true,
      message: 'Webhook already processed (duplicate)',
      callId: callId,
      webhookType: webhookType,
      timestamp: timestamp,
      deduplicationKey: deduplicationKey,
      validationWarnings: validation.warnings
    });
  }

  // STEP 3: Reject invalid webhooks (optional - can be made permissive)
  if (!validation.isValid) {
    logError(`❌ Rejecting invalid webhook: ${validation.errors.join(', ')}`);
    return res.status(400).json({
      success: false,
      error: 'Invalid webhook payload',
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
      webhookType: webhookType,
      timestamp: timestamp
    });
  }

  // STEP 4: Save webhook payload to JSON file (save original payload for debugging)
  const saveResult = await saveWebhookPayload('cloudtalk', webhookType, req.body, req.headers);
  if (saveResult.success) {
    log(`💾 Payload salvato in: ${saveResult.filepath}`);
  } else {
    logError(`❌ Errore salvando payload: ${saveResult.error}`);
  }

  try {
    // STEP 5: Process webhook with our GHL integration using ENHANCED payload
    log(`🔄 Processing with enhanced payload (call_id: ${enhancedPayload.call_id})`);
    const result = await processCloudTalkWebhook(enhancedPayload, webhookType);

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
 * UPDATED: Now uses enhanced validation to prevent undefined call_id issues
 */
async function handleCallEndedWebhook(req, res) {
  const timestamp = new Date().toISOString();
  const webhookType = 'call-ended';

  log(`📞 [${timestamp}] CloudTalk Webhook: CALL-ENDED (Analytics API Logic)`);
  log(`📡 Headers: ${JSON.stringify(req.headers, null, 2)}`);
  log(`📋 Payload: ${JSON.stringify(req.body, null, 2)}`);

  // STEP 1: Validate and enhance webhook payload
  const validation = validateAndEnhanceWebhookPayload(req.body, webhookType);
  logValidationSummary(validation, webhookType);

  // Use enhanced payload for processing
  const enhancedPayload = validation.enhancedPayload;
  const correlationId = enhancedPayload._correlationId;

  log(`🔗 Enhanced Correlation ID: ${correlationId}`);

  // STEP 2: Check for duplicate webhook using validated data
  const deduplicationKey = extractDeduplicationKey(enhancedPayload, webhookType);
  const callId = enhancedPayload.call_id; // Guaranteed to exist after validation

  if (isWebhookAlreadyProcessed(callId, webhookType)) {
    log(`🔄 Skipping duplicate webhook: ${deduplicationKey}`);
    return res.json({
      success: true,
      message: 'Webhook already processed (duplicate)',
      callId: callId,
      webhookType: webhookType,
      timestamp: timestamp,
      deduplicationKey: deduplicationKey
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
    // 🆕 ANALYTICS API LOGIC: Get real call status from CloudTalk Analytics API
    log(`🔍 Analyzing call using CloudTalk Analytics API...`);
    const { analyzeCall } = await import('../services/cloudtalk-analytics-service.js');
    const callAnalysis = await analyzeCall(enhancedPayload);
    
    log(`📊 Call analysis result:`);
    log(`   - Success: ${callAnalysis.success}`);
    log(`   - Status: ${callAnalysis.status}`);
    log(`   - Is missed: ${callAnalysis.isMissed}`);
    log(`   - Reason: ${callAnalysis.reason}`);
    if (callAnalysis.fallback) {
      log(`   ⚠️ Used fallback logic due to: ${callAnalysis.analyticsError}`);
    }

    const isMissedCall = callAnalysis.isMissed;
    const callStatus = callAnalysis.status;

    if (isMissedCall) {
      // ❌ CHIAMATA PERSA: Invia webhook a GHL + Campaign Automation
      log(`❌ MISSED CALL detected (${callStatus}) - Processing with GHL webhook`);
      
      // 1. PRIMA: Invia webhook a GoHighLevel
      let ghlWebhookResult = null;
      try {
        const ghlWebhookUrl = 'https://services.leadconnectorhq.com/hooks/DfxGoORmPoL5Z1OcfYJM/webhook-trigger/873baa5c-928e-428a-ac68-498d954a9ff7';
        
        // Prepara payload per GHL con tutti i dati della chiamata + analytics data
        const ghlPayload = {
          event_type: 'cloudtalk_call_ended',
          call_type: 'missed',
          timestamp: timestamp,
          call_uuid: enhancedPayload.call_uuid,
          call_id: enhancedPayload.call_id,
          internal_number: enhancedPayload.internal_number,
          external_number: enhancedPayload.external_number,
          agent_id: enhancedPayload.agent_id,
          agent_first_name: enhancedPayload.agent_first_name,
          agent_last_name: enhancedPayload.agent_last_name,
          contact_id: enhancedPayload.contact_id,
          call_attempts: enhancedPayload['# di tentativi di chiamata'] || enhancedPayload.call_attempts,
          is_missed_call: true,
          webhook_received_at: timestamp,
          source: 'cloudtalk_middleware',
          // Analytics data
          cloudtalk_status: callAnalysis.status,
          talking_time: callAnalysis.talkingTime || 0,
          total_time: callAnalysis.totalTime || 0,
          direction: callAnalysis.direction,
          recorded: callAnalysis.recorded,
          analytics_success: callAnalysis.success,
          validation_applied: validation.warnings.length > 0 ? validation.warnings : null
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

      // 2. SECONDA: Esegui Campaign Automation (priorità alta) using enhanced payload
      let campaignResult = null;
      try {
        campaignResult = await processCallEndedWebhook(enhancedPayload, correlationId);

        if (campaignResult.success) {
          log(`✅ Campaign Automation completata con successo per MISSED CALL!`);
          log(`👤 Contatto: ${campaignResult.contact?.name} (${campaignResult.contact?.id})`);
          log(`🔢 Tentativi: ${campaignResult.attempts?.previous} → ${campaignResult.attempts?.new}`);

          if (campaignResult.campaign) {
            log(`📈 Campagna spostata: ${campaignResult.campaign.source} → ${campaignResult.campaign.target}`);
          }

          // 2.5. AGGIORNA ANCHE I TENTATIVI IN GHL
          log(`🔄 Aggiornamento tentativi GoHighLevel...`);
          let ghlAttemptsResult = null;
          try {
            ghlAttemptsResult = await processCloudTalkCallEndedForGHL(enhancedPayload, `${correlationId}-ghl`);

            if (ghlAttemptsResult.success) {
              log(`✅ Tentativi GHL aggiornati con successo!`);
              log(`👤 Contatto GHL: ${ghlAttemptsResult.contact?.name} (${ghlAttemptsResult.contact?.id})`);
              log(`📞 Tentativi GHL: ${ghlAttemptsResult.attempts?.previous} → ${ghlAttemptsResult.attempts?.new}`);
              campaignResult.ghlCallAttempts = ghlAttemptsResult;
            } else {
              log(`⚠️ Tentativi GHL non aggiornati: ${ghlAttemptsResult.reason}`);
              campaignResult.ghlCallAttempts = ghlAttemptsResult;
            }
          } catch (ghlAttemptsError) {
            logError(`❌ Errore aggiornamento tentativi GHL: ${ghlAttemptsError.message}`);
            campaignResult.ghlCallAttempts = {
              success: false,
              error: ghlAttemptsError.message
            };
          }

          // 3. TERZA: Crea nota per MISSED CALL nel contatto GHL
          try {
            const noteText = '📵 TENTATIVO SENZA RISPOSTA - CLOUDTALK';
            log(`📝 Creando nota per MISSED CALL: "${noteText}"`);

            // Trova il contatto GHL per creare la nota (separato da Campaign Automation)
            const phoneNumber = enhancedPayload.external_number;
            const { searchGHLContactByPhone } = await import('../../API Squadd/tests/search-contact-by-phone.js');
            const ghlContact = await searchGHLContactByPhone(phoneNumber);

            if (!ghlContact) {
              throw new Error(`Contatto GHL non trovato per ${phoneNumber}`);
            }

            log(`📞 Contatto GHL trovato: ${ghlContact.firstName} ${ghlContact.lastName} (${ghlContact.id})`);
            const noteResult = await addNoteToGHLContact(ghlContact.id, noteText);

            if (noteResult && noteResult.id) {
              log(`✅ Nota creata con successo per MISSED CALL! ID: ${noteResult.id}`);
              campaignResult.noteCreated = {
                success: true,
                noteId: noteResult.id,
                noteText: noteText
              };
            } else {
              log(`⚠️ Nota creata ma risposta anomala: ${JSON.stringify(noteResult)}`);
              campaignResult.noteCreated = {
                success: true,
                noteText: noteText,
                response: noteResult
              };
            }
          } catch (noteError) {
            logError(`❌ Errore creando nota per MISSED CALL: ${noteError.message}`);
            campaignResult.noteCreated = {
              success: false,
              error: noteError.message,
              noteText: '📵 TENTATIVO SENZA RISPOSTA - CLOUDTALK'
            };
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

      // 3. Mark webhook as processed (solo se campaign automation ok)
      if (callId) {
        markWebhookAsProcessed(callId, webhookType);
      }

      // 4. Risposta finale per MISSED CALL
      const response = {
        success: true,
        call_type: 'missed',
        call_status: callStatus,
        message: 'MISSED CALL processed with GHL webhook forwarding, Campaign Automation, and Note Creation',
        timestamp: timestamp,
        analytics: callAnalysis,
        ghlWebhookForwarding: ghlWebhookResult || { success: false, reason: 'Not processed' },
        campaignAutomation: campaignResult || { success: false, reason: 'Not processed' },
        noteCreation: campaignResult?.noteCreated || { success: false, reason: 'Not processed' }
      };
      
      // Include contact info if available from campaign automation
      if (campaignResult?.contact) {
        response.contact = campaignResult.contact;
      }
      
      log(`🎉 MISSED CALL webhook processing completed successfully!`);
      res.json(response);
      
    } else {
      // ✅ CHIAMATA RISPOSTA: Solo Campaign Automation, aspetta recording
      log(`✅ ANSWERED CALL detected (${callStatus}) - Processing WITHOUT GHL webhook, waiting for recording`);
      
      // 1. Esegui solo Campaign Automation (senza webhook GHL) using enhanced payload
      let campaignResult = null;
      try {
        campaignResult = await processCallEndedWebhook(enhancedPayload, correlationId);

        if (campaignResult.success) {
          log(`✅ Campaign Automation completata con successo per ANSWERED CALL!`);
          log(`👤 Contatto: ${campaignResult.contact?.name} (${campaignResult.contact?.id})`);
          log(`🔢 Tentativi: ${campaignResult.attempts?.previous} → ${campaignResult.attempts?.new}`);

          if (campaignResult.campaign) {
            log(`📈 Campagna spostata: ${campaignResult.campaign.source} → ${campaignResult.campaign.target}`);
          }

          // 1.5. AGGIORNA ANCHE I TENTATIVI IN GHL
          log(`🔄 Aggiornamento tentativi GoHighLevel...`);
          let ghlAttemptsResult = null;
          try {
            ghlAttemptsResult = await processCloudTalkCallEndedForGHL(enhancedPayload, `${correlationId}-ghl`);

            if (ghlAttemptsResult.success) {
              log(`✅ Tentativi GHL aggiornati con successo!`);
              log(`👤 Contatto GHL: ${ghlAttemptsResult.contact?.name} (${ghlAttemptsResult.contact?.id})`);
              log(`📞 Tentativi GHL: ${ghlAttemptsResult.attempts?.previous} → ${ghlAttemptsResult.attempts?.new}`);
              campaignResult.ghlCallAttempts = ghlAttemptsResult;
            } else {
              log(`⚠️ Tentativi GHL non aggiornati: ${ghlAttemptsResult.reason}`);
              campaignResult.ghlCallAttempts = ghlAttemptsResult;
            }
          } catch (ghlAttemptsError) {
            logError(`❌ Errore aggiornamento tentativi GHL: ${ghlAttemptsError.message}`);
            campaignResult.ghlCallAttempts = {
              success: false,
              error: ghlAttemptsError.message
            };
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
      
      // 2. Mark webhook as processed (solo se campaign automation ok)
      if (callId) {
        markWebhookAsProcessed(callId, webhookType);
      }

      // 3. Risposta finale per ANSWERED CALL (senza GHL webhook, aspetta recording)
      const response = {
        success: true,
        call_type: 'answered',
        call_status: callStatus,
        message: 'ANSWERED CALL processed - waiting for recording (no GHL webhook sent)',
        timestamp: timestamp,
        analytics: callAnalysis,
        ghlWebhookForwarding: { success: false, reason: 'Skipped for answered calls' },
        campaignAutomation: campaignResult || { success: false, reason: 'Not processed' }
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
 * Handler specializzato per webhook call-started (LOGGING ONLY)
 * CloudTalk invia separatamente a /api/google-sheets-webhooks/call-data per Google Sheets
 * UPDATED: Removed Google Sheets processing to prevent duplication
 */
async function handleCallStartedWebhook(req, res) {
  const timestamp = new Date().toISOString();
  const webhookType = 'call-started';

  log(`📞 [${timestamp}] CloudTalk Webhook: CALL-STARTED (Logging Only)`);
  log(`📡 Headers: ${JSON.stringify(req.headers, null, 2)}`);
  log(`📋 Payload: ${JSON.stringify(req.body, null, 2)}`);

  // STEP 1: Validate and enhance webhook payload
  const validation = validateAndEnhanceWebhookPayload(req.body, webhookType);
  logValidationSummary(validation, webhookType);

  // Use enhanced payload for processing
  const enhancedPayload = validation.enhancedPayload;
  const correlationId = enhancedPayload._correlationId;

  log(`🔗 Enhanced Correlation ID: ${correlationId}`);

  // STEP 2: Check for duplicate webhook using validated data
  const deduplicationKey = extractDeduplicationKey(enhancedPayload, webhookType);
  const callId = enhancedPayload.call_id; // Guaranteed to exist after validation

  if (isWebhookAlreadyProcessed(callId, webhookType)) {
    log(`🔄 Skipping duplicate webhook: ${deduplicationKey}`);
    return res.json({
      success: true,
      message: 'Webhook already processed (duplicate)',
      callId: callId,
      webhookType: webhookType,
      timestamp: timestamp,
      deduplicationKey: deduplicationKey
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
    // Process webhook with CueCard generation (Google Sheets handled separately by CloudTalk)
    log(`🔄 Processing call-started with CueCard generation...`);
    log(`📋 Note: Google Sheets processing happens via separate CloudTalk automation to /api/google-sheets-webhooks/call-data`);

    const result = await processCloudTalkWebhook(enhancedPayload, webhookType);

    if (result.success) {
      markWebhookAsProcessed(callId, webhookType);

      log(`🎉 Call-started processed successfully with CueCard!`);
      res.json({
        success: true,
        message: 'Call-started processed with CueCard generation',
        timestamp: timestamp,
        contact: result.contact,
        result: result.result,
        cueCardSent: result.result?.cueCardSent || false,
        note: 'Google Sheets processing handled by separate CloudTalk automation'
      });
    } else {
      logError(`⚠️ Call-started processing failed: ${result.error || result.reason}`);
      res.status(400).json({
        success: false,
        error: result.error || result.reason,
        webhookType: webhookType,
        timestamp: timestamp
      });
    }

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