import express from 'express';
import { logRequest, logError, log } from '../logger.js';
import { saveWebhookPayload } from '../utils/webhook-payload-logger.js';
import googleSheetsService from '../services/google-sheets-service.js';

const router = express.Router();

/**
 * Google Sheets Webhook Handler
 * Sends call data to Google Sheets via Apps Script
 */

/**
 * Send call data to Google Sheets
 * POST /api/google-sheets-webhooks/call-data
 * Auto-detects call-started vs call-ended and processes accordingly
 */
router.post('/call-data', async (req, res) => {
  const timestamp = new Date().toISOString();
  const webhookType = 'call-data';

  log(`📊 [${timestamp}] Google Sheets Webhook: ${webhookType.toUpperCase()}`);
  log(`📋 Payload: ${JSON.stringify(req.body, null, 2)}`);

  // Save webhook payload for debugging
  const saveResult = await saveWebhookPayload('google-sheets', webhookType, req.body, req.headers);
  if (saveResult.success) {
    log(`💾 Payload salvato in: ${saveResult.filepath}`);
  }

  try {
    // Validate minimum required fields for call_uuid
    if (!req.body.call_uuid) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CALL_UUID',
        message: 'call_uuid is required for call tracking',
        timestamp: timestamp
      });
    }

    // Process call data with our Google Sheets service
    const result = await googleSheetsService.processCallData(req.body);

    // Check if this was an update operation that couldn't find the row
    if (result && result.success === false && result.reason === 'call_uuid_not_found') {
      log(`⚠️ Call UUID ${req.body.call_uuid} not found for update, this might be a call-ended without call-started`);

      return res.json({
        success: true,
        message: 'Call-ended webhook received but no matching call-started found',
        call_uuid: req.body.call_uuid,
        action: 'skipped_update',
        timestamp: timestamp,
        note: 'This is expected if call-started webhook was missed'
      });
    }

    // Success response
    res.json({
      success: true,
      message: 'Call data processed and sent to Google Sheets successfully',
      call_uuid: req.body.call_uuid,
      agent_name: `${req.body.agent_first_name || ''} ${req.body.agent_last_name || ''}`.trim(),
      timestamp: timestamp,
      result: result
    });

  } catch (error) {
    logError('❌ Errore Google Sheets webhook:', error);

    res.status(500).json({
      success: false,
      error: 'GOOGLE_SHEETS_ERROR',
      message: error.message,
      call_uuid: req.body.call_uuid || 'unknown',
      timestamp: timestamp
    });
  }
});

/**
 * Send lead data to Google Sheets
 * POST /api/google-sheets-webhooks/lead-data
 */
router.post('/lead-data', async (req, res) => {
  const timestamp = new Date().toISOString();
  const webhookType = 'lead-data';

  log(`📊 [${timestamp}] Google Sheets Webhook: ${webhookType.toUpperCase()} - LEAD DATA`);
  log(`📋 Payload: ${JSON.stringify(req.body, null, 2)}`);

  // Save webhook payload for debugging
  const saveResult = await saveWebhookPayload('google-sheets', webhookType, req.body, req.headers);
  if (saveResult.success) {
    log(`💾 Payload salvato in: ${saveResult.filepath}`);
  }

  try {
    // Prepare lead data for Google Sheets
    const sheetsData = {
      timestamp: timestamp,
      lead_id: req.body.lead_id || req.body.id,
      first_name: req.body.first_name || '',
      last_name: req.body.last_name || '',
      email: req.body.email || '',
      phone: req.body.phone || '',
      company: req.body.company || '',
      source: req.body.source || 'GHL',
      status: req.body.status || 'new',
      assigned_agent: req.body.assigned_agent || '',
      campaign: req.body.campaign || '',
      tags: Array.isArray(req.body.tags) ? req.body.tags.join(', ') : (req.body.tags || ''),
      notes: req.body.notes || '',
      created_at: req.body.created_at || timestamp,
      process_type: 'lead_import'
    };

    // Send to Google Sheets
    const googleSheetsUrl = process.env.GOOGLE_SHEETS_APPS_SCRIPT_URL;

    if (!googleSheetsUrl) {
      return res.json({
        success: true,
        message: 'Lead webhook received but Google Sheets URL not configured',
        data: sheetsData,
        timestamp: timestamp
      });
    }

    const response = await fetch(googleSheetsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sheetsData)
    });

    const responseData = await response.text();
    log(`✅ Lead data sent to Google Sheets: ${responseData}`);

    res.json({
      success: true,
      message: 'Lead data sent to Google Sheets successfully',
      lead_id: req.body.lead_id || req.body.id,
      sheets_response: responseData,
      timestamp: timestamp,
      data_sent: sheetsData
    });

  } catch (error) {
    logError('❌ Errore Google Sheets lead webhook:', error);

    res.status(500).json({
      success: false,
      error: 'GOOGLE_SHEETS_LEAD_ERROR',
      message: error.message,
      timestamp: timestamp
    });
  }
});

/**
 * Health check for Google Sheets webhooks
 * GET /api/google-sheets-webhooks/health
 */
router.get('/health', async (req, res) => {
  const serviceAccountConfigured = !!(process.env.GOOGLE_SERVICE_ACCOUNT_PATH && process.env.GOOGLE_SHEETS_ID);
  let connectionStatus = 'unknown';

  // Test Google Sheets connection
  if (serviceAccountConfigured) {
    try {
      const isConnected = await googleSheetsService.testConnection();
      connectionStatus = isConnected ? 'connected' : 'failed';
    } catch (error) {
      connectionStatus = 'error';
    }
  }

  res.json({
    service: 'Google Sheets Webhooks (Direct Service Account)',
    status: connectionStatus === 'connected' ? 'healthy' : 'unhealthy',
    endpoints: {
      '/call-data': 'POST - Send call data to Google Sheets (auto-detects call-started vs call-ended)',
      '/lead-data': 'POST - Send lead data to Google Sheets (legacy)',
      '/health': 'GET - Health check with connection test'
    },
    configuration: {
      service_account_configured: serviceAccountConfigured,
      google_sheets_id: process.env.GOOGLE_SHEETS_ID ? 'configured' : 'missing',
      sheet_name: 'Call Sheet',
      connection_status: connectionStatus
    },
    features: {
      auto_detection: true,
      bottom_to_top_search: true,
      next_available_row_insertion: true,
      column_mapping: {
        'B': 'start_timestamp (format: DD/MM/YYYY HH.MM.SS)',
        'D': 'agent_id',
        'E': 'agent_name (first_name + last_name)',
        'K': 'talking_time (seconds)',
        'L': 'end_timestamp (format: DD/MM/YYYY HH.MM.SS)',
        'O': 'formula (auto-generated month/year)',
        'Q': 'call_uuid'
      }
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * Queue statistics endpoint
 * GET /api/google-sheets-webhooks/queue-stats
 */
router.get('/queue-stats', (req, res) => {
  const stats = googleSheetsQueueService.getStats();
  const health = googleSheetsQueueService.getHealthStatus();

  res.json({
    service: 'Google Sheets Queue Statistics',
    timestamp: new Date().toISOString(),
    queue: {
      current_size: stats.queueSize,
      active_requests: stats.activeRequests,
      max_concurrent: health.queue.maxConcurrent,
      processing: health.queue.processing
    },
    performance: {
      total_processed: stats.processed,
      total_failed: stats.failed,
      success_rate: health.performance.successRate,
      average_processing_time_ms: health.performance.averageProcessingTime
    },
    configuration: {
      google_sheets_configured: health.configuration.googleSheetsConfigured,
      request_delay_ms: health.configuration.requestDelay,
      max_retries: health.configuration.maxRetries
    },
    status: {
      health: health.status,
      last_processed: stats.lastProcessedAt,
      uptime_seconds: Math.round(stats.uptime)
    }
  });
});

/**
 * Test endpoint for Google Sheets integration
 * POST /api/google-sheets-webhooks/test
 */
router.post('/test', async (req, res) => {
  const timestamp = new Date().toISOString();

  log(`🧪 [${timestamp}] Google Sheets Test Webhook (Queue)`);

  // Create test call-started data
  const testStartedData = {
    timestamp: timestamp,
    call_uuid: 'test-uuid-' + Date.now(),
    call_id: 'test-' + Date.now(),
    external_number: '+393513416607',
    contact_name: 'Roberto Bondici (Test)',
    agent_first_name: 'Roberto',
    agent_last_name: 'Bondici',
    agent_id: 493933,
    internal_number: '393520441984',
    webhook_type: 'call-started',
    process_type: 'test'
  };

  // Create test call-ended data (with slight delay)
  const testEndedData = {
    ...testStartedData,
    call_id: 'test-' + (Date.now() + 1),
    talking_time: 45,
    waiting_time: 12,
    webhook_type: 'call-ended'
  };

  try {
    // Queue both call-started and call-ended for testing
    const startedQueueId = googleSheetsQueueService.enqueue(testStartedData, 'call-started', 1);
    const endedQueueId = googleSheetsQueueService.enqueue(testEndedData, 'call-ended', 1);

    const queueStats = googleSheetsQueueService.getStats();

    res.json({
      success: true,
      message: 'Test calls queued for Google Sheets processing',
      test_data: {
        call_started: testStartedData,
        call_ended: testEndedData
      },
      queue_ids: {
        started: startedQueueId,
        ended: endedQueueId
      },
      queue_status: {
        current_size: queueStats.queueSize,
        total_processed: queueStats.processed,
        total_failed: queueStats.failed
      },
      timestamp: timestamp,
      note: 'Check /api/google-sheets-webhooks/queue-stats for processing status'
    });

  } catch (error) {
    logError('❌ Errore test Google Sheets queue:', error);

    res.status(500).json({
      success: false,
      error: 'GOOGLE_SHEETS_QUEUE_TEST_ERROR',
      message: error.message,
      test_data: testStartedData,
      timestamp: timestamp
    });
  }
});

export default router;