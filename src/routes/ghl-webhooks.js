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
    // Processa il lead per creazione contatto e chiamata automatica con logica enhanced
    log(`🚀 Avvio processo ENHANCED Lead-to-Call automatico...`);

    const processResult = await leadToCallService.processLeadToCallEnhanced(req.body);

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
        enhanced: {
          fallbackUsed: processResult.enhancedInfo.fallbackUsed,
          finalAgentUsedFallback: processResult.enhancedInfo.finalAgentUsedFallback,
          totalAgentsAttempted: processResult.enhancedInfo.totalAgentsAttempted,
          busyAgentsSkipped: processResult.enhancedInfo.busyAgentsSkipped.length,
          roundRobinInfo: processResult.steps.agentDistribution?.fallbackInfo
        },
        steps: {
          contactCreated: processResult.steps.contactCreation?.success || false,
          agentSelected: processResult.steps.agentDistribution?.success || false,
          callStarted: processResult.steps.callInitiation?.success || false,
          fallbackAttempts: processResult.steps.fallbackAttempts.length
        }
      });

      const finalMessage = processResult.enhancedInfo.finalAgentUsedFallback
        ? `✅ Lead-to-Call completato con FALLBACK: ${processResult.selectedAgent.name} chiamerà ${req.body.phone} (${processResult.enhancedInfo.totalAgentsAttempted} agenti tentati)`
        : `✅ Lead-to-Call completato: ${processResult.selectedAgent.name} chiamerà ${req.body.phone}`;

      log(finalMessage);

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
        enhanced: {
          fallbackUsed: processResult.enhancedInfo?.fallbackUsed || false,
          totalAgentsAttempted: processResult.enhancedInfo?.totalAgentsAttempted || 0,
          busyAgentsSkipped: processResult.enhancedInfo?.busyAgentsSkipped || [],
          roundRobinInfo: processResult.steps?.agentDistribution?.fallbackInfo
        },
        steps: {
          contactCreated: processResult.steps?.contactCreation?.success || false,
          agentSelected: processResult.steps?.agentDistribution?.success || false,
          callStarted: processResult.steps?.callInitiation?.success || false,
          fallbackAttempts: processResult.steps?.fallbackAttempts?.length || 0
        },
        availableAgents: processResult.steps?.agentDistribution?.availableAgents || 0
      });

      logError(`❌ Enhanced Lead-to-Call fallito: ${processResult.error}`);
      if (processResult.enhancedInfo?.busyAgentsSkipped?.length > 0) {
        logError(`🔴 Agenti occupati saltati: ${processResult.enhancedInfo.busyAgentsSkipped.map(a => a.agentName).join(', ')}`);
      }
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
 * Update total calls webhook from GHL - AGGIORNAMENTO CAMPO CUSTOM CLOUDTALK
 * POST /api/ghl-webhooks/update-total-calls
 */
router.post('/update-total-calls', async (req, res) => {
  const timestamp = new Date().toISOString();
  const webhookType = 'update-total-calls';

  log(`🔢 [${timestamp}] GHL Webhook: ${webhookType.toUpperCase()} - AGGIORNAMENTO CHIAMATE TOTALI`);
  log(`📋 Payload: ${JSON.stringify(req.body, null, 2)}`);

  // Salva webhook payload
  const saveResult = await saveWebhookPayload('ghl', webhookType, req.body, req.headers);
  if (saveResult.success) {
    log(`💾 Payload salvato in: ${saveResult.filepath}`);
  }

  try {
    // Estrai i dati necessari dal payload GHL
    const phoneNumber = req.body.phone;
    const totalCalls = req.body.customData?.totaleChiamate;
    const contactName = req.body.full_name || `${req.body.first_name || ''} ${req.body.last_name || ''}`.trim();

    // Validazione dati richiesti
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Numero di telefono mancante nel payload',
        error: 'MISSING_PHONE',
        timestamp: timestamp,
        payloadSaved: saveResult.success
      });
    }

    if (!totalCalls && totalCalls !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Campo totaleChiamate mancante in customData',
        error: 'MISSING_TOTAL_CALLS',
        timestamp: timestamp,
        payloadSaved: saveResult.success
      });
    }

    log(`📞 Aggiornamento chiamate totali: ${contactName} (${phoneNumber}) -> ${totalCalls} chiamate`);

    // Importa il servizio per aggiornare i campi custom CloudTalk
    const { updateContactTotalCalls } = await import('../services/cloudtalk-custom-fields-service.js');

    // Aggiorna il campo "# di chiamate totali" in CloudTalk
    const updateResult = await updateContactTotalCalls(phoneNumber, totalCalls);

    if (updateResult.success) {
      // Successo
      res.json({
        success: true,
        message: 'Campo "# di chiamate totali" aggiornato con successo in CloudTalk',
        contact: {
          id: updateResult.contactId,
          name: updateResult.contactName,
          phone: updateResult.phoneNumber
        },
        update: {
          fieldName: "# di chiamate totali",
          oldValue: "N/A", // Non abbiamo il valore precedente
          newValue: updateResult.totalCalls
        },
        timestamp: timestamp,
        payloadSaved: saveResult.success
      });

      log(`✅ Chiamate totali aggiornate per ${updateResult.contactName}: ${totalCalls}`);

    } else {
      // Errore nell'aggiornamento
      let errorStatus = 500;

      if (updateResult.error === 'CONTACT_NOT_FOUND') {
        errorStatus = 404;
      }

      res.status(errorStatus).json({
        success: false,
        message: `Errore aggiornamento chiamate totali: ${updateResult.message || updateResult.error}`,
        error: updateResult.error,
        phoneNumber: phoneNumber,
        totalCalls: totalCalls,
        timestamp: timestamp,
        payloadSaved: saveResult.success
      });

      logError(`❌ Errore aggiornamento chiamate totali per ${phoneNumber}: ${updateResult.error}`);
    }

  } catch (error) {
    logError('Errore processo aggiornamento chiamate totali:', error);

    res.status(500).json({
      success: false,
      message: 'Errore interno nel processo aggiornamento chiamate totali',
      error: error.message,
      timestamp: timestamp,
      payloadSaved: saveResult.success
    });
  }
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
        '/update-total-calls': 'ACTIVE - Aggiornamento chiamate totali CloudTalk',
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

/**
 * Debug system status
 * GET /api/ghl-webhooks/debug-agents
 */
router.get('/debug-agents', async (req, res) => {
  try {
    log('🔍 Debug agents endpoint chiamato');

    // Import agent distribution service
    const agentDistributionService = (await import('../services/agent-distribution-service.js')).default;

    const debugStatus = await agentDistributionService.debugSystemStatus();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      debugData: debugStatus,
      message: 'Check console logs for detailed agent status'
    });

  } catch (error) {
    logError('Error in debug-agents endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;