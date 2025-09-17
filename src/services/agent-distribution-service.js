import { makeCloudTalkRequest } from '../../API CloudTalk/config.js';
import { log, logError } from '../logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Servizio per gestione distribuzione intelligente lead agli agenti CloudTalk
 * 
 * Features:
 * - Controllo disponibilità agenti real-time
 * - Distribuzione round robin
 * - Persistenza stato distribuzione
 * - Gestione errori e fallback
 */

class AgentDistributionService {
  constructor() {
    this.stateFilePath = path.join(process.cwd(), 'data', 'agent-distribution-state.json');
    this.lastDistributionState = null;
    this.initialized = false;
  }

  /**
   * Inizializza il servizio caricando lo stato persistito
   */
  async initialize() {
    try {
      // Crea directory data se non esiste
      const dataDir = path.dirname(this.stateFilePath);
      await fs.mkdir(dataDir, { recursive: true });

      // Carica stato esistente o inizializza vuoto
      try {
        const stateData = await fs.readFile(this.stateFilePath, 'utf8');
        this.lastDistributionState = JSON.parse(stateData);
        log(`🔄 Stato distribuzione caricato: ${this.lastDistributionState?.lastAgentId || 'nessuno'}`);
      } catch (error) {
        // File non esiste, inizializza stato vuoto
        this.lastDistributionState = {
          lastAgentId: null,
          lastDistributionTime: null,
          distributionHistory: []
        };
        await this.saveState();
        log(`🆕 Inizializzato nuovo stato distribuzione`);
      }

      this.initialized = true;
    } catch (error) {
      logError('Errore inizializzazione AgentDistributionService:', error);
      throw error;
    }
  }

  /**
   * Salva lo stato corrente su disco
   */
  async saveState() {
    try {
      await fs.writeFile(this.stateFilePath, JSON.stringify(this.lastDistributionState, null, 2));
    } catch (error) {
      logError('Errore salvando stato distribuzione:', error);
    }
  }

  /**
   * Recupera tutti gli agenti disponibili da CloudTalk
   * @returns {Promise<Array>} Lista agenti disponibili
   */
  async getAvailableAgents() {
    try {
      log('🔍 Controllo disponibilità agenti CloudTalk...');
      
      const response = await makeCloudTalkRequest('/agents/index.json');
      
      if (!response?.data?.responseData?.data) {
        throw new Error('Formato risposta agenti non valido');
      }

      const allAgents = response.data.responseData.data;
      
      // Filtra solo agenti disponibili (online e non in chiamata)
      const availableAgents = allAgents
        .map(item => item.Agent)
        .filter(agent => {
          const status = agent.availability_status;
          const isAvailable = status === 'online'; // Solo agenti online
          
          log(`👤 Agente ${agent.firstname} ${agent.lastname} (${agent.id}): ${status} ${isAvailable ? '✅' : '❌'}`);
          
          return isAvailable;
        })
        .map(agent => ({
          id: agent.id,
          name: `${agent.firstname} ${agent.lastname}`,
          email: agent.email,
          extension: agent.extension,
          status: agent.availability_status,
          default_number: agent.default_number
        }));

      log(`📊 Trovati ${availableAgents.length} agenti disponibili su ${allAgents.length} totali`);
      
      return availableAgents;

    } catch (error) {
      logError('Errore recupero agenti disponibili:', error);
      throw error;
    }
  }

  /**
   * Seleziona il prossimo agente usando round robin
   * @param {Array} availableAgents Lista agenti disponibili
   * @returns {Object|null} Agente selezionato o null se nessuno disponibile
   */
  selectNextAgent(availableAgents) {
    if (!availableAgents || availableAgents.length === 0) {
      log('❌ Nessun agente disponibile per distribuzione');
      return null;
    }

    if (!this.initialized) {
      throw new Error('Servizio non inizializzato. Chiamare initialize() prima.');
    }

    let selectedAgent = null;

    if (availableAgents.length === 1) {
      // Solo un agente disponibile
      selectedAgent = availableAgents[0];
      log(`👤 Solo un agente disponibile: ${selectedAgent.name}`);
    } else {
      // Round robin tra agenti disponibili
      const lastAgentId = this.lastDistributionState.lastAgentId;
      
      if (!lastAgentId) {
        // Prima distribuzione, prendi il primo
        selectedAgent = availableAgents[0];
        log(`🎯 Prima distribuzione, selezionato: ${selectedAgent.name}`);
      } else {
        // Trova l'ultimo agente e prendi il successivo
        const lastAgentIndex = availableAgents.findIndex(agent => agent.id === lastAgentId);
        
        if (lastAgentIndex === -1) {
          // L'ultimo agente non è più disponibile, prendi il primo
          selectedAgent = availableAgents[0];
          log(`🔄 Ultimo agente non disponibile, ripartendo dal primo: ${selectedAgent.name}`);
        } else {
          // Prendi il successivo (con wrap-around)
          const nextIndex = (lastAgentIndex + 1) % availableAgents.length;
          selectedAgent = availableAgents[nextIndex];
          log(`➡️ Round robin: da ${availableAgents[lastAgentIndex].name} a ${selectedAgent.name}`);
        }
      }
    }

    // Aggiorna stato
    this.lastDistributionState.lastAgentId = selectedAgent.id;
    this.lastDistributionState.lastDistributionTime = new Date().toISOString();
    
    // Aggiungi alla history (mantieni solo ultimi 50)
    this.lastDistributionState.distributionHistory.unshift({
      agentId: selectedAgent.id,
      agentName: selectedAgent.name,
      timestamp: this.lastDistributionState.lastDistributionTime
    });
    
    if (this.lastDistributionState.distributionHistory.length > 50) {
      this.lastDistributionState.distributionHistory = this.lastDistributionState.distributionHistory.slice(0, 50);
    }

    // Salva stato
    this.saveState();

    log(`✅ Agente selezionato: ${selectedAgent.name} (ID: ${selectedAgent.id})`);
    return selectedAgent;
  }

  /**
   * Distribuisce un lead al prossimo agente disponibile
   * @param {Object} leadData Dati del lead da distribuire
   * @returns {Promise<Object>} Risultato distribuzione
   */
  async distributeLeadToAgent(leadData) {
    try {
      log(`🎯 Inizio distribuzione lead: ${leadData.name || leadData.phone || 'Lead senza nome'}`);

      if (!this.initialized) {
        await this.initialize();
      }

      // 1. Ottieni agenti disponibili
      const availableAgents = await this.getAvailableAgents();
      
      if (availableAgents.length === 0) {
        return {
          success: false,
          error: 'NO_AGENTS_AVAILABLE',
          message: 'Nessun agente disponibile al momento',
          availableAgents: 0,
          selectedAgent: null
        };
      }

      // 2. Seleziona agente con round robin
      const selectedAgent = this.selectNextAgent(availableAgents);
      
      if (!selectedAgent) {
        return {
          success: false,
          error: 'AGENT_SELECTION_FAILED',
          message: 'Impossibile selezionare un agente',
          availableAgents: availableAgents.length,
          selectedAgent: null
        };
      }

      // 3. Risultato distribuzione
      return {
        success: true,
        selectedAgent: selectedAgent,
        availableAgents: availableAgents.length,
        distributionInfo: {
          timestamp: new Date().toISOString(),
          roundRobinPosition: this.lastDistributionState.distributionHistory.length,
          totalDistributions: this.lastDistributionState.distributionHistory.length
        }
      };

    } catch (error) {
      logError('Errore distribuzione lead:', error);
      return {
        success: false,
        error: 'DISTRIBUTION_ERROR',
        message: error.message,
        availableAgents: 0,
        selectedAgent: null
      };
    }
  }

  /**
   * Ottieni statistiche distribuzione
   * @returns {Object} Statistiche correnti
   */
  getDistributionStats() {
    if (!this.initialized || !this.lastDistributionState) {
      return {
        initialized: false,
        totalDistributions: 0,
        lastDistribution: null,
        recentHistory: []
      };
    }

    return {
      initialized: true,
      totalDistributions: this.lastDistributionState.distributionHistory.length,
      lastDistribution: this.lastDistributionState.distributionHistory[0] || null,
      lastAgentId: this.lastDistributionState.lastAgentId,
      recentHistory: this.lastDistributionState.distributionHistory.slice(0, 10)
    };
  }

  /**
   * Reset dello stato di distribuzione (per testing o reset)
   */
  async resetDistributionState() {
    this.lastDistributionState = {
      lastAgentId: null,
      lastDistributionTime: null,
      distributionHistory: []
    };
    await this.saveState();
    log('🔄 Stato distribuzione resettato');
  }
}

// Istanza singleton
const agentDistributionService = new AgentDistributionService();

export default agentDistributionService;