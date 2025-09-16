import express from 'express';
import { processCloudTalkWebhook } from '../../API Squadd/webhook-to-ghl-processor.js';
import { logRequest, logError, log } from '../logger.js';
import { saveWebhookPayload } from '../utils/webhook-payload-logger.js';
import { isWebhookAlreadyProcessed, markWebhookAsProcessed } from '../utils/webhook-deduplication.js';

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
 * Call ended webhook
 * POST /api/cloudtalk-webhooks/call-ended
 */
router.post('/call-ended', async (req, res) => {
  await handleWebhook(req, res, 'call-ended');
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