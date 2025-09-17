import express from 'express';
import { logRequest, logError, log } from '../logger.js';
import { saveWebhookPayload } from '../utils/webhook-payload-logger.js';
import leadToCallService from '../services/lead-to-call-service.js';

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
 * New contact webhook from GHL - PROCESSO AUTOMATICO LEAD-TO-CALL
 * POST /api/ghl-webhooks/new-contact
 */
router.post('/new-contact', async (req, res) => {
  const timestamp = new Date().toISOString();
  const webhookType = 'new-contact';
  
  log(`🎯 [${timestamp}] GHL Webhook: ${webhookType.toUpperCase()} - LEAD-TO-CALL AUTOMATICO`);
  log(`📋 Payload: ${JSON.stringify(req.body, null, 2)}`);

  // Salva webhook payload
  const saveResult = await saveWebhookPayload('ghl', webhookType, req.body, req.headers);
  if (saveResult.success) {
    log(`💾 Payload salvato in: ${saveResult.filepath}`);
  }

  try {
    // Processa il lead per creazione contatto e chiamata automatica
    log(`🚀 Avvio processo Lead-to-Call automatico...`);
    
    const processResult = await leadToCallService.processLeadToCall(req.body);
    
    if (processResult.success) {
      // Successo completo
      res.json({
        success: true,
        message: 'Lead processato con successo - Chiamata iniziata',
        processId: processResult.processId,
        selectedAgent: {
          id: processResult.selectedAgent.id,
          name: processResult.selectedAgent.name,
          extension: processResult.selectedAgent.extension
        },
        callInitiated: true,
        timestamp: timestamp,
        payloadSaved: saveResult.success,
        steps: {
          contactCreated: processResult.steps.contactCreation?.success || false,
          agentSelected: processResult.steps.agentDistribution?.success || false,
          callStarted: processResult.steps.callInitiation?.success || false
        }
      });
      
      log(`✅ Lead-to-Call completato: ${processResult.selectedAgent.name} chiamerà ${req.body.phone}`);
      
    } else {
      // Errore nel processo
      const errorStatus = getHttpStatusFromError(processResult.finalStatus);
      
      res.status(errorStatus).json({
        success: false,
        message: `Lead-to-Call fallito: ${processResult.error}`,
        processId: processResult.processId,
        error: processResult.finalStatus,
        errorDetails: processResult.error,
        timestamp: timestamp,
        payloadSaved: saveResult.success,
        steps: {
          contactCreated: processResult.steps?.contactCreation?.success || false,
          agentSelected: processResult.steps?.agentDistribution?.success || false,
          callStarted: processResult.steps?.callInitiation?.success || false
        },
        availableAgents: processResult.steps?.agentDistribution?.availableAgents || 0
      });
      
      logError(`❌ Lead-to-Call fallito: ${processResult.error}`);
    }
    
  } catch (error) {
    logError('Errore processo Lead-to-Call:', error);
    
    res.status(500).json({
      success: false,
      message: 'Errore interno nel processo Lead-to-Call',
      error: error.message,
      timestamp: timestamp,
      payloadSaved: saveResult.success
    });
  }
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
 * Converte errori del processo in status HTTP appropriati
 */
function getHttpStatusFromError(errorType) {
  switch (errorType) {
    case 'NO_AGENTS_AVAILABLE':
      return 503; // Service Unavailable
    case 'MISSING_PHONE':
      return 400; // Bad Request
    case 'CONTACT_CREATION_FAILED':
      return 422; // Unprocessable Entity
    case 'AGENT_NOT_AVAILABLE':
    case 'AGENT_BUSY':
      return 503; // Service Unavailable
    case 'INVALID_PHONE':
      return 400; // Bad Request
    default:
      return 500; // Internal Server Error
  }
}

/**
 * Stats endpoint per monitoraggio distribuzione lead
 * GET /api/ghl-webhooks/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await leadToCallService.getServiceStats();
    res.json({
      service: 'GHL → CloudTalk Lead Distribution',
      ...stats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Errore recupero statistiche',
      message: error.message
    });
  }
});

/**
 * Analytics dettagliati
 * GET /api/ghl-webhooks/analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const analytics = await leadToCallService.getAnalytics(startDate, endDate);
    
    if (analytics) {
      res.json({
        service: 'Lead-to-Call Analytics',
        analytics: analytics,
        requestedPeriod: {
          startDate: startDate || 'today',
          endDate: endDate || 'today'
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        error: 'Nessun dato analytics trovato per il periodo richiesto'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Errore recupero analytics',
      message: error.message
    });
  }
});

/**
 * Processi recenti
 * GET /api/ghl-webhooks/recent-processes
 */
router.get('/recent-processes', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const processes = await leadToCallService.getRecentProcesses(limit);
    
    res.json({
      service: 'Lead-to-Call Recent Processes',
      totalFound: processes.length,
      limit: limit,
      processes: processes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Errore recupero processi recenti',
      message: error.message
    });
  }
});

/**
 * Health check for GHL webhooks
 * GET /api/ghl-webhooks/health
 */
router.get('/health', async (req, res) => {
  try {
    const stats = leadToCallService.getServiceStats();
    
    res.json({
      service: 'GHL → CloudTalk Webhooks',
      status: 'active',
      leadToCallSystem: {
        initialized: stats.initialized,
        totalDistributions: stats.distributionStats.totalDistributions,
        lastDistribution: stats.distributionStats.lastDistribution
      },
      timestamp: new Date().toISOString(),
      endpoints: {
        '/new-contact': 'ACTIVE - Lead-to-Call automatico',
        '/new-tag': 'placeholder',
        '/new-note': 'placeholder', 
        '/pipeline-stage-changed': 'placeholder',
        '/opportunity-status-changed': 'placeholder',
        '/stats': 'ACTIVE - Statistiche distribuzione',
        '/analytics': 'ACTIVE - Analytics dettagliati',
        '/recent-processes': 'ACTIVE - Processi recenti',
        '/health': 'ACTIVE - Health check'
      }
    });
  } catch (error) {
    res.status(500).json({
      service: 'GHL → CloudTalk Webhooks',
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;