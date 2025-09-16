import express from 'express';
import { logRequest, logError, log } from '../logger.js';
import { saveWebhookPayload } from '../utils/webhook-payload-logger.js';

const router = express.Router();

// GoHighLevel Webhooks (future implementation)

/**
 * Generic webhook handler for GHL/Squadd webhooks
 */
async function handleGHLWebhook(req, res, webhookType) {
  const timestamp = new Date().toISOString();

  log(`👤 [${timestamp}] GHL Webhook: ${webhookType.toUpperCase()}`);
  log(`📋 Payload: ${JSON.stringify(req.body, null, 2)}`);

  // Save webhook payload to JSON file
  const saveResult = await saveWebhookPayload('squadd', webhookType, req.body, req.headers);
  if (saveResult.success) {
    log(`💾 Payload salvato in: ${saveResult.filepath}`);
  } else {
    log(`❌ Errore salvando payload: ${saveResult.error}`);
  }

  // TODO: Implement GHL → CloudTalk sync
  res.json({
    success: true,
    message: `GHL ${webhookType} webhook received`,
    timestamp: timestamp,
    note: 'Implementation pending',
    payloadSaved: saveResult.success
  });
}

/**
 * New contact webhook from GHL
 * POST /api/ghl-webhooks/new-contact
 */
router.post('/new-contact', async (req, res) => {
  await handleGHLWebhook(req, res, 'new-contact');
});

/**
 * New tag webhook from GHL
 * POST /api/ghl-webhooks/new-tag
 */
router.post('/new-tag', async (req, res) => {
  await handleGHLWebhook(req, res, 'new-tag');
});

/**
 * New note webhook from GHL
 * POST /api/ghl-webhooks/new-note
 */
router.post('/new-note', async (req, res) => {
  await handleGHLWebhook(req, res, 'new-note');
});

/**
 * Pipeline stage changed webhook from GHL
 * POST /api/ghl-webhooks/pipeline-stage-changed
 */
router.post('/pipeline-stage-changed', async (req, res) => {
  await handleGHLWebhook(req, res, 'pipeline-stage-changed');
});

/**
 * Opportunity status changed webhook from GHL
 * POST /api/ghl-webhooks/opportunity-status-changed
 */
router.post('/opportunity-status-changed', async (req, res) => {
  await handleGHLWebhook(req, res, 'opportunity-status-changed');
});

/**
 * Health check for GHL webhooks
 * GET /api/ghl-webhooks/health
 */
router.get('/health', (req, res) => {
  res.json({
    service: 'GHL → CloudTalk Webhooks',
    status: 'active (placeholders)',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/new-contact',
      '/new-tag',
      '/new-note',
      '/pipeline-stage-changed',
      '/opportunity-status-changed'
    ],
    note: 'All endpoints are placeholders for future implementation'
  });
});

export default router;