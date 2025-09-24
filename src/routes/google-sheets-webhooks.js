import express from 'express';
import { logRequest, logError, log } from '../logger.js';
import { saveWebhookPayload } from '../utils/webhook-payload-logger.js';

const router = express.Router();

/**
 * Google Sheets Webhook Handler
 * Sends call data to Google Sheets via Apps Script
 */

/**
 * Send call data to Google Sheets
 * POST /api/google-sheets-webhooks/call-data
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
    // Validate required fields
    const requiredFields = ['call_id', 'agent_name', 'lead_phone'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: `Missing fields: ${missingFields.join(', ')}`,
        timestamp: timestamp
      });
    }

    // Prepare data for Google Sheets
    const sheetsData = {
      timestamp: timestamp,
      call_id: req.body.call_id,
      agent_id: req.body.agent_id,
      agent_name: req.body.agent_name,
      agent_extension: req.body.agent_extension,
      lead_phone: req.body.lead_phone,
      lead_name: req.body.lead_name || '',
      lead_email: req.body.lead_email || '',
      call_duration: req.body.call_duration || 0,
      call_status: req.body.call_status || 'unknown',
      call_type: req.body.call_type || 'outbound',
      call_started: req.body.call_started || timestamp,
      call_ended: req.body.call_ended || '',
      caller_id: req.body.caller_id || '',
      campaign_name: req.body.campaign_name || '',
      lead_source: req.body.lead_source || 'GHL',
      notes: req.body.notes || '',
      recording_url: req.body.recording_url || '',
      transcription: req.body.transcription || ''
    };

    // Send to Google Sheets via Apps Script
    const googleSheetsUrl = process.env.GOOGLE_SHEETS_APPS_SCRIPT_URL;

    if (!googleSheetsUrl) {
      log('⚠️  GOOGLE_SHEETS_APPS_SCRIPT_URL non configurato nell\'ambiente');

      // Return success but log warning
      return res.json({
        success: true,
        message: 'Webhook received but Google Sheets URL not configured',
        data: sheetsData,
        timestamp: timestamp,
        note: 'Configure GOOGLE_SHEETS_APPS_SCRIPT_URL environment variable'
      });
    }

    // Make request to Google Apps Script
    log(`📤 Sending data to Google Sheets: ${googleSheetsUrl}`);

    const response = await fetch(googleSheetsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sheetsData)
    });

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.text();
    log(`✅ Google Sheets response: ${responseData}`);

    res.json({
      success: true,
      message: 'Call data sent to Google Sheets successfully',
      call_id: req.body.call_id,
      agent_name: req.body.agent_name,
      sheets_response: responseData,
      timestamp: timestamp,
      data_sent: sheetsData
    });

  } catch (error) {
    logError('❌ Errore Google Sheets webhook:', error);

    res.status(500).json({
      success: false,
      error: 'GOOGLE_SHEETS_ERROR',
      message: error.message,
      call_id: req.body.call_id || 'unknown',
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
router.get('/health', (req, res) => {
  const googleSheetsConfigured = !!process.env.GOOGLE_SHEETS_APPS_SCRIPT_URL;

  res.json({
    service: 'Google Sheets Webhooks',
    status: 'active',
    endpoints: {
      '/call-data': 'POST - Send call data to Google Sheets',
      '/lead-data': 'POST - Send lead data to Google Sheets',
      '/health': 'GET - Health check'
    },
    configuration: {
      google_sheets_url_configured: googleSheetsConfigured,
      apps_script_url: googleSheetsConfigured ? 'configured' : 'missing'
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * Test endpoint for Google Sheets integration
 * POST /api/google-sheets-webhooks/test
 */
router.post('/test', async (req, res) => {
  const timestamp = new Date().toISOString();

  log(`🧪 [${timestamp}] Google Sheets Test Webhook`);

  const testData = {
    timestamp: timestamp,
    call_id: 'test-' + Date.now(),
    agent_name: 'Roberto Bondici (Test)',
    agent_id: 493933,
    lead_phone: '+393513416607',
    lead_name: 'Test Lead',
    call_status: 'test',
    call_type: 'test_call',
    notes: 'Test webhook call from API middleware',
    process_type: 'test'
  };

  try {
    const googleSheetsUrl = process.env.GOOGLE_SHEETS_APPS_SCRIPT_URL;

    if (!googleSheetsUrl) {
      return res.json({
        success: true,
        message: 'Test successful - Google Sheets URL not configured',
        test_data: testData,
        timestamp: timestamp,
        note: 'Set GOOGLE_SHEETS_APPS_SCRIPT_URL to enable actual Google Sheets integration'
      });
    }

    const response = await fetch(googleSheetsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const responseData = await response.text();

    res.json({
      success: true,
      message: 'Test call sent to Google Sheets successfully',
      test_data: testData,
      sheets_response: responseData,
      timestamp: timestamp
    });

  } catch (error) {
    logError('❌ Errore test Google Sheets:', error);

    res.status(500).json({
      success: false,
      error: 'GOOGLE_SHEETS_TEST_ERROR',
      message: error.message,
      test_data: testData,
      timestamp: timestamp
    });
  }
});

export default router;