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
      
      // Prepara dati contatto per CloudTalk Bulk API
      const contactData = {
        action: 'add_contact',
        command_id: commandId,
        data: {
          name: leadData.name || `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim() || 'Lead Senza Nome',
          email: leadData.email || '',
          phone: leadData.phone || '',
          company: leadData.company || 'GoHighLevel Lead',
          title: leadData.title || '',
          // Custom fields per tracciare origine
          custom_fields: [
            {
              key: 'ghl_lead_id',
              value: leadData.id || ''
            },
            {
              key: 'lead_source',
              value: 'GoHighLevel Webhook'
            },
            {
              key: 'created_timestamp',
              value: new Date().toISOString()
            },
            {
              key: 'urgency',
              value: 'IMMEDIATE_CALL'
            }
          ]
        }
      };

      log(`📝 Creando contatto in CloudTalk: ${contactData.data.name}`);
      log(`📞 Telefono: ${contactData.data.phone}`);
      log(`📧 Email: ${contactData.data.email}`);

      const response = await makeCloudTalkRequest('/bulk/contacts.json', {
        method: 'POST',
        body: JSON.stringify(contactData)
      });

      if (response?.data?.[0]?.status === 'success') {
        const contactId = response.data[0]?.data?.contact_id;
        
        log(`✅ Contatto creato con successo: ID ${contactId}`);
        
        return {
          success: true,
          contactId: contactId,
          commandId: commandId,
          cloudTalkData: response.data[0]
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
      log(`📊 Lead: ${leadData.name || leadData.phone || 'Senza nome'}`);

      if (!this.initialized) {
        await this.initialize();
      }

      // Validazione dati lead
      if (!leadData.phone) {
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
        leadData.phone,
        leadData
      );

      if (result.steps.callInitiation.success) {
        result.success = true;
        result.finalStatus = 'CALL_INITIATED_SUCCESSFULLY';
        result.selectedAgent = selectedAgent;
        
        const processingTime = Date.now() - startTime;
        log(`✅ PROCESSO COMPLETATO CON SUCCESSO in ${processingTime}ms`);
        log(`👤 Agente: ${selectedAgent.name}`);
        log(`📞 Chiamata iniziata per: ${leadData.phone}`);
        
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
        steps: result?.steps || {},
        processingTime: Date.now() - startTime
      };
      
      // Log anche gli errori per tracking
      await leadTrackingLogger.logLeadProcess(errorResult);
      
      return errorResult;
    }
  }

  /**
   * Retry automatico per chiamate fallite
   * @param {Object} failedResult Risultato precedente fallito
   * @param {number} maxRetries Numero massimo retry
   * @returns {Promise<Object>} Risultato retry
   */
  async retryFailedCall(failedResult, maxRetries = 2) {
    if (!failedResult.selectedAgent || !failedResult.leadData) {
      return {
        success: false,
        error: 'INVALID_RETRY_DATA',
        message: 'Dati insufficienti per retry'
      };
    }

    log(`🔄 Tentativo retry chiamata per ${failedResult.leadData.phone}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      log(`🔁 Retry tentativo ${attempt}/${maxRetries}`);

      // Riseleziona agente (potrebbe essere cambiata la disponibilità)
      const redistribution = await agentDistributionService.distributeLeadToAgent(failedResult.leadData);
      
      if (!redistribution.success) {
        log(`❌ Retry ${attempt}: Nessun agente disponibile`);
        continue;
      }

      const retryResult = await this.makeAutomaticCall(
        redistribution.selectedAgent.id,
        failedResult.leadData.phone,
        failedResult.leadData
      );

      if (retryResult.success) {
        log(`✅ Retry ${attempt} riuscito!`);
        return {
          success: true,
          retryAttempt: attempt,
          selectedAgent: redistribution.selectedAgent,
          callResult: retryResult
        };
      }

      log(`❌ Retry ${attempt} fallito: ${retryResult.message}`);
    }

    return {
      success: false,
      error: 'MAX_RETRIES_EXCEEDED',
      message: `Tutti i ${maxRetries} tentativi di retry falliti`
    };
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