import { makeCloudTalkRequest } from '../../API CloudTalk/config.js';
import agentDistributionService from './agent-distribution-service.js';
import leadTrackingLogger from './lead-tracking-logger.js';
import { log, logError } from '../logger.js';

/**
 * Servizio per gestione completa del flusso Lead → Contatto → Chiamata
 * 
 * Flusso:
 * 1. Riceve lead da GHL webhook
 * 2. Crea contatto in CloudTalk
 * 3. Trova agente disponibile (round robin)
 * 4. Effettua chiamata automatica
 * 5. Gestisce errori e retry
 */

class LeadToCallService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Inizializza il servizio
   */
  async initialize() {
    if (!this.initialized) {
      await agentDistributionService.initialize();
      await leadTrackingLogger.initialize();
      this.initialized = true;
      log('🚀 LeadToCallService inizializzato con tracking');
    }
  }

  /**
   * Crea un contatto in CloudTalk usando Bulk API
   * @param {Object} leadData Dati del lead
   * @returns {Promise<Object>} Risultato creazione contatto
   */
  async createContactInCloudTalk(leadData) {
    try {
      const timestamp = Date.now();
      const commandId = `ghl_lead_${leadData.id || timestamp}_${timestamp}`;
      
      // Fix: usa formato PUT API corretto per CloudTalk
      const fullName = `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim();
      
      const contactData = {
        name: fullName || leadData.full_name || leadData.name || 'Lead Senza Nome',
        company: leadData.company || 'GoHighLevel Lead',
        ContactNumber: [
          { public_number: leadData.phone || '' }
        ],
        ContactEmail: [
          { email: leadData.email || '' }
        ],
        ContactsTag: [
          { name: 'GHL Lead' },
          { name: 'Immediate Call' }
        ]
      };

      log(`📝 Creando contatto in CloudTalk: ${contactData.name}`);
      log(`📞 Telefono: ${contactData.ContactNumber?.[0]?.public_number || 'N/A'}`);
      log(`📧 Email: ${contactData.ContactEmail?.[0]?.email || 'N/A'}`);
      log(`✅ FORMATO PUT API CORRETTO!`);
      
      // DEBUG: Log del payload completo che viene inviato
      console.log('🚨 DEBUG - PAYLOAD INVIATO A CLOUDTALK:');
      console.log(JSON.stringify(contactData, null, 2));

      const response = await makeCloudTalkRequest('/contacts/add.json', {
        method: 'PUT',
        body: JSON.stringify(contactData)
      });
      
      // DEBUG: Log della risposta completa
      console.log('🚨 DEBUG - RISPOSTA CLOUDTALK:');
      console.log(JSON.stringify(response, null, 2));

      if (response?.data?.id) {
        const contactId = response.data.id;
        
        log(`✅ Contatto creato con successo: ID ${contactId}`);
        
        return {
          success: true,
          contactId: contactId,
          commandId: commandId,
          cloudTalkData: response.data
        };
      } else {
        throw new Error(`Creazione contatto fallita: ${JSON.stringify(response.data)}`);
      }

    } catch (error) {
      logError('Errore creazione contatto CloudTalk:', error);
      return {
        success: false,
        error: error.message,
        contactId: null
      };
    }
  }

  /**
   * Effettua chiamata automatica via CloudTalk
   * @param {number} agentId ID dell'agente
   * @param {string} phoneNumber Numero da chiamare
   * @param {Object} leadData Dati del lead per context
   * @returns {Promise<Object>} Risultato chiamata
   */
  async makeAutomaticCall(agentId, phoneNumber, leadData) {
    try {
      log(`📞 Iniziando chiamata automatica...`);
      log(`👤 Agente: ${agentId}`);
      log(`📱 Numero: ${phoneNumber}`);

      const callData = {
        agent_id: parseInt(agentId),
        callee_number: phoneNumber
      };

      const response = await makeCloudTalkRequest('/calls/create.json', {
        method: 'POST',
        body: JSON.stringify(callData)
      });

      if (response?.data?.responseData?.status === 200) {
        log(`✅ Chiamata iniziata con successo!`);
        log(`⏱️ L'agente riceverà la chiamata (max 20s), poi verrà chiamato il lead`);
        
        return {
          success: true,
          callInitiated: true,
          agentId: agentId,
          phoneNumber: phoneNumber,
          apiResponse: response.data
        };
      } else {
        throw new Error(`Chiamata fallita: ${JSON.stringify(response.data)}`);
      }

    } catch (error) {
      logError('Errore chiamata automatica:', error);
      
      // Gestisce errori specifici
      let errorType = 'CALL_FAILED';
      let errorMessage = error.message;

      if (error.message.includes('403')) {
        errorType = 'AGENT_NOT_AVAILABLE';
        errorMessage = 'Agente non disponibile o non online';
      } else if (error.message.includes('409')) {
        errorType = 'AGENT_BUSY';
        errorMessage = 'Agente già impegnato in una chiamata';
      } else if (error.message.includes('406')) {
        errorType = 'INVALID_PHONE';
        errorMessage = 'Numero di telefono non valido';
      }

      return {
        success: false,
        callInitiated: false,
        error: errorType,
        message: errorMessage,
        agentId: agentId,
        phoneNumber: phoneNumber
      };
    }
  }

  /**
   * Processo completo: Lead → Contatto → Distribuzione → Chiamata
   * @param {Object} leadData Dati del lead da GHL
   * @returns {Promise<Object>} Risultato completo del processo
   */
  async processLeadToCall(leadData) {
    const startTime = Date.now();
    const processId = `lead_${leadData.id || Date.now()}`;
    
    try {
      log(`🎯 INIZIO PROCESSO LEAD-TO-CALL: ${processId}`);
      log(`📊 Lead da chiamare: ${leadData.first_name} ${leadData.last_name} (${leadData.phone})`);

      if (!this.initialized) {
        await this.initialize();
      }

      // Validazione dati lead - usa SOLO dati root level (il lead da chiamare)
      const phoneNumber = leadData.phone;
      if (!phoneNumber) {
        throw new Error('MISSING_PHONE: Numero telefono mancante nel lead');
      }

      const result = {
        processId: processId,
        startTime: new Date().toISOString(),
        leadData: leadData,
        steps: {
          contactCreation: null,
          agentDistribution: null,
          callInitiation: null
        },
        success: false,
        finalStatus: null
      };

      // STEP 1: Crea contatto in CloudTalk
      log(`📝 STEP 1: Creazione contatto CloudTalk`);
      result.steps.contactCreation = await this.createContactInCloudTalk(leadData);
      
      if (!result.steps.contactCreation.success) {
        result.finalStatus = 'CONTACT_CREATION_FAILED';
        result.error = result.steps.contactCreation.error;
        return result;
      }

      // STEP 2: Distribuisci a agente disponibile
      log(`🎯 STEP 2: Distribuzione agente (Round Robin)`);
      result.steps.agentDistribution = await agentDistributionService.distributeLeadToAgent(leadData);
      
      if (!result.steps.agentDistribution.success) {
        result.finalStatus = result.steps.agentDistribution.error;
        result.error = result.steps.agentDistribution.message;
        return result;
      }

      const selectedAgent = result.steps.agentDistribution.selectedAgent;

      // STEP 3: Effettua chiamata automatica
      log(`📞 STEP 3: Chiamata automatica via agente ${selectedAgent.name}`);
      result.steps.callInitiation = await this.makeAutomaticCall(
        selectedAgent.id,
        phoneNumber,
        leadData
      );

      if (result.steps.callInitiation.success) {
        result.success = true;
        result.finalStatus = 'CALL_INITIATED_SUCCESSFULLY';
        result.selectedAgent = selectedAgent;
        
        const processingTime = Date.now() - startTime;
        log(`✅ PROCESSO COMPLETATO CON SUCCESSO in ${processingTime}ms`);
        log(`👤 Agente: ${selectedAgent.name}`);
        log(`📞 Chiamata iniziata per: ${phoneNumber}`);
        
      } else {
        result.finalStatus = result.steps.callInitiation.error;
        result.error = result.steps.callInitiation.message;
        result.selectedAgent = selectedAgent;
      }

      // Log del processo completo per tracking
      const processingTime = Date.now() - startTime;
      result.processingTime = processingTime;
      
      await leadTrackingLogger.logLeadProcess(result);
      
      return result;

    } catch (error) {
      logError(`❌ ERRORE PROCESSO ${processId}:`, error);
      
      const errorResult = {
        processId: processId,
        startTime: new Date().toISOString(),
        leadData: leadData,
        success: false,
        finalStatus: 'PROCESS_ERROR',
        error: error.message,
        steps: (typeof result !== 'undefined' && result?.steps) || {
          contactCreation: null,
          agentDistribution: null,
          callInitiation: null
        },
        processingTime: Date.now() - startTime
      };
      
      // Log anche gli errori per tracking
      await leadTrackingLogger.logLeadProcess(errorResult);
      
      return errorResult;
    }
  }

  /**
   * Enhanced process with smart fallback for busy agents
   * @param {Object} leadData Dati del lead da GHL
   * @returns {Promise<Object>} Risultato completo con fallback info
   */
  async processLeadToCallEnhanced(leadData) {
    const startTime = Date.now();
    const processId = `enhanced_lead_${leadData.id || Date.now()}`;

    try {
      log(`🚀 INIZIO PROCESSO ENHANCED LEAD-TO-CALL: ${processId}`);
      log(`📊 Lead da chiamare: ${leadData.first_name} ${leadData.last_name} (${leadData.phone})`);

      if (!this.initialized) {
        await this.initialize();
      }

      // Validate lead data
      const phoneNumber = leadData.phone;
      if (!phoneNumber) {
        throw new Error('MISSING_PHONE: Numero telefono mancante nel lead');
      }

      const result = {
        processId: processId,
        startTime: new Date().toISOString(),
        leadData: leadData,
        steps: {
          contactCreation: null,
          agentDistribution: null,
          callInitiation: null,
          fallbackAttempts: []
        },
        success: false,
        finalStatus: null,
        enhancedInfo: {
          fallbackUsed: false,
          totalAgentsAttempted: 0,
          busyAgentsSkipped: []
        }
      };

      // STEP 1: Create contact in CloudTalk
      log(`📝 STEP 1: Creazione contatto CloudTalk`);
      result.steps.contactCreation = await this.createContactInCloudTalk(leadData);

      if (!result.steps.contactCreation.success) {
        result.finalStatus = 'CONTACT_CREATION_FAILED';
        result.error = result.steps.contactCreation.error;
        return result;
      }

      // STEP 2: Enhanced agent distribution with real-time call checking
      log(`🎯 STEP 2: Enhanced Agent Distribution (Real-time + Round Robin)`);
      result.steps.agentDistribution = await agentDistributionService.distributeLeadToAgent(leadData);

      if (!result.steps.agentDistribution.success) {
        result.finalStatus = result.steps.agentDistribution.error;
        result.error = result.steps.agentDistribution.message;
        result.enhancedInfo.fallbackUsed = result.steps.agentDistribution.fallbackInfo?.fallbackUsed || false;
        return result;
      }

      const selectedAgent = result.steps.agentDistribution.selectedAgent;
      result.enhancedInfo.fallbackUsed = result.steps.agentDistribution.fallbackInfo?.fallbackUsed || false;

      // STEP 3: Attempt call with smart fallback
      log(`📞 STEP 3: Enhanced Call Attempt (Primary: ${selectedAgent.name})`);

      const callResult = await this.makeAutomaticCallWithFallback(
        selectedAgent,
        phoneNumber,
        leadData,
        result.steps.agentDistribution.distributionInfo.allAvailableAgents
      );

      result.steps.callInitiation = callResult.primaryAttempt;
      result.steps.fallbackAttempts = callResult.fallbackAttempts || [];
      result.enhancedInfo.totalAgentsAttempted = 1 + result.steps.fallbackAttempts.length;
      result.enhancedInfo.busyAgentsSkipped = callResult.busyAgentsSkipped || [];

      if (callResult.success) {
        result.success = true;
        result.finalStatus = 'CALL_INITIATED_SUCCESSFULLY';
        result.selectedAgent = callResult.finalAgent;
        result.enhancedInfo.finalAgentUsedFallback = callResult.usedFallback;

        const processingTime = Date.now() - startTime;
        log(`✅ ENHANCED PROCESSO COMPLETATO in ${processingTime}ms`);
        log(`👤 Agente finale: ${callResult.finalAgent.name} ${callResult.usedFallback ? '(FALLBACK)' : '(PRIMARY)'}`);
        log(`📞 Chiamata iniziata per: ${phoneNumber}`);

      } else {
        result.finalStatus = callResult.error || 'CALL_FAILED_ALL_AGENTS';
        result.error = callResult.message || 'Tutti gli agenti hanno fallito';
        result.selectedAgent = selectedAgent;
      }

      const processingTime = Date.now() - startTime;
      result.processingTime = processingTime;

      await leadTrackingLogger.logLeadProcess(result);

      return result;

    } catch (error) {
      logError(`❌ ERRORE ENHANCED PROCESSO ${processId}:`, error);

      const errorResult = {
        processId: processId,
        startTime: new Date().toISOString(),
        leadData: leadData,
        success: false,
        finalStatus: 'PROCESS_ERROR',
        error: error.message,
        steps: (typeof result !== 'undefined' && result?.steps) || {
          contactCreation: null,
          agentDistribution: null,
          callInitiation: null,
          fallbackAttempts: []
        },
        enhancedInfo: {
          fallbackUsed: false,
          totalAgentsAttempted: 0,
          busyAgentsSkipped: []
        },
        processingTime: Date.now() - startTime
      };

      await leadTrackingLogger.logLeadProcess(errorResult);
      return errorResult;
    }
  }

  /**
   * Make call with automatic fallback to other agents if busy
   * @param {Object} primaryAgent Agente primario selezionato
   * @param {string} phoneNumber Numero da chiamare
   * @param {Object} leadData Dati lead
   * @param {Array} allAvailableAgents Lista tutti agenti disponibili per fallback
   * @returns {Promise<Object>} Risultato con info fallback
   */
  async makeAutomaticCallWithFallback(primaryAgent, phoneNumber, leadData, allAvailableAgents) {
    const result = {
      success: false,
      primaryAttempt: null,
      fallbackAttempts: [],
      busyAgentsSkipped: [],
      usedFallback: false,
      finalAgent: null,
      error: null,
      message: null
    };

    // Primary attempt
    log(`📞 Tentativo PRIMARY: Agente ${primaryAgent.name} (${primaryAgent.id})`);
    result.primaryAttempt = await this.makeAutomaticCall(primaryAgent.id, phoneNumber, leadData);

    if (result.primaryAttempt.success) {
      result.success = true;
      result.finalAgent = primaryAgent;
      result.usedFallback = false;
      return result;
    }

    // If primary failed due to busy/unavailable, try fallback
    if (result.primaryAttempt.error === 'AGENT_BUSY' || result.primaryAttempt.error === 'AGENT_NOT_AVAILABLE') {
      log(`🔄 PRIMARY FALLITO (${result.primaryAttempt.error}), tentando fallback...`);

      result.busyAgentsSkipped.push({
        agentId: primaryAgent.id,
        agentName: primaryAgent.name,
        reason: result.primaryAttempt.error,
        message: result.primaryAttempt.message
      });

      // Try other available agents
      const fallbackCandidates = allAvailableAgents.filter(agent => agent.id !== primaryAgent.id);

      for (let i = 0; i < fallbackCandidates.length && !result.success; i++) {
        const fallbackAgent = fallbackCandidates[i];

        log(`🔄 Tentativo FALLBACK ${i + 1}: Agente ${fallbackAgent.name} (${fallbackAgent.id})`);

        const fallbackAttempt = await this.makeAutomaticCall(fallbackAgent.id, phoneNumber, leadData);

        result.fallbackAttempts.push({
          agent: fallbackAgent,
          attempt: fallbackAttempt,
          attemptNumber: i + 1
        });

        if (fallbackAttempt.success) {
          result.success = true;
          result.finalAgent = fallbackAgent;
          result.usedFallback = true;
          log(`✅ FALLBACK RIUSCITO! Agente ${fallbackAgent.name} ha preso la chiamata`);
          return result;
        } else if (fallbackAttempt.error === 'AGENT_BUSY' || fallbackAttempt.error === 'AGENT_NOT_AVAILABLE') {
          result.busyAgentsSkipped.push({
            agentId: fallbackAgent.id,
            agentName: fallbackAgent.name,
            reason: fallbackAttempt.error,
            message: fallbackAttempt.message
          });
          log(`❌ FALLBACK ${i + 1} fallito (${fallbackAttempt.error}), provando prossimo...`);
        } else {
          log(`❌ FALLBACK ${i + 1} fallito per altro motivo: ${fallbackAttempt.message}`);
        }
      }

      // All fallbacks failed
      if (!result.success) {
        result.error = 'ALL_AGENTS_BUSY_OR_FAILED';
        result.message = `Tutti i ${1 + fallbackCandidates.length} agenti disponibili hanno fallito o sono occupati`;
        log(`❌ TUTTI I FALLBACK FALLITI - Agenti tentati: ${1 + fallbackCandidates.length}`);
      }
    } else {
      // Primary failed for other reasons (invalid phone, etc.)
      result.error = result.primaryAttempt.error;
      result.message = result.primaryAttempt.message;
      log(`❌ PRIMARY fallito per motivo non-retry: ${result.primaryAttempt.error}`);
    }

    return result;
  }

  /**
   * Retry automatico per chiamate fallite (legacy method, now uses enhanced logic)
   * @param {Object} failedResult Risultato precedente fallito
   * @param {number} maxRetries Numero massimo retry
   * @returns {Promise<Object>} Risultato retry
   */
  async retryFailedCall(failedResult, maxRetries = 2) {
    log(`🔄 Using enhanced retry logic instead of legacy retry...`);

    // Use enhanced process instead of legacy retry
    return await this.processLeadToCallEnhanced(failedResult.leadData);
  }

  /**
   * Ottieni statistiche del servizio
   * @returns {Object} Statistiche correnti
   */
  async getServiceStats() {
    const distributionStats = agentDistributionService.getDistributionStats();
    const trackingMetrics = await leadTrackingLogger.getCurrentMetrics();
    
    return {
      service: 'LeadToCallService',
      initialized: this.initialized,
      distributionStats: distributionStats,
      dailyMetrics: trackingMetrics,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Ottieni analytics dettagliati
   * @param {string} startDate Data inizio (opzionale)
   * @param {string} endDate Data fine (opzionale)
   * @returns {Promise<Object>} Dati analytics
   */
  async getAnalytics(startDate, endDate) {
    const today = new Date().toISOString().split('T')[0];
    return await leadTrackingLogger.exportAnalyticsData(
      startDate || today,
      endDate || today
    );
  }

  /**
   * Ottieni processi recenti
   * @param {number} limit Numero processi da recuperare
   * @returns {Promise<Array>} Lista processi recenti
   */
  async getRecentProcesses(limit = 20) {
    return await leadTrackingLogger.getRecentProcesses(limit);
  }
}

// Istanza singleton
const leadToCallService = new LeadToCallService();

export default leadToCallService;