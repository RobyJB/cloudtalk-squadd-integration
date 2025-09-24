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
   * Recupera tutti gli agenti disponibili da CloudTalk con check chiamate attive
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

      // FIXED: Proper agent status filtering
      // "calling" = BUSY (exclude)
      // "offline" = OFFLINE (exclude) 
      // "online", "available" = AVAILABLE (include)
      const availableAgents = allAgents
        .map(item => item.Agent)
        .filter(agent => {
          const status = agent.availability_status;
          
          // FIXED LOGIC: Only include truly available agents
          const isAvailable = status === 'online' || status === 'available';
          const isBusy = status === 'calling';
          const isOffline = status === 'offline';

          log(`👤 Agente ${agent.firstname} ${agent.lastname} (${agent.id}): status="${status}" ${
            isAvailable ? '✅ AVAILABLE' : 
            isBusy ? '🔴 BUSY' : 
            isOffline ? '⚫ OFFLINE' : 
            '❓ UNKNOWN'
          }`);

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

      // Additional safety check: verify each agent is truly not busy with active calls
      // (This double-checks our agent status detection)
      const finalAvailableAgents = [];

      for (const agent of availableAgents) {
        const isBusy = await this.isAgentBusy(agent.id);

        if (!isBusy) {
          finalAvailableAgents.push(agent);
          log(`✅ Agente ${agent.name} (${agent.id}) confermato disponibile`);
        } else {
          log(`🔴 Agente ${agent.name} (${agent.id}) detected as busy despite available status - skipping`);
        }
      }

      log(`📊 Trovati ${finalAvailableAgents.length} agenti veramente disponibili su ${allAgents.length} totali`);
      log(`📈 Agenti con status available: ${availableAgents.length}`);

      return finalAvailableAgents;

    } catch (error) {
      logError('Errore recupero agenti disponibili:', error);
      throw error;
    }
  }

  /**
   * Controlla se un agente è attualmente impegnato in una chiamata attiva
   * @param {number} agentId ID dell'agente
   * @returns {Promise<boolean>} True se l'agente è occupato
   */
  async isAgentBusy(agentId) {
    try {
      // FIXED: Use agents API instead of calls API for real-time status
      // The calls API only shows completed calls, not active ones
      const response = await makeCloudTalkRequest(`/agents/index.json?id=${agentId}`);

      if (!response?.data?.responseData?.data) {
        log(`⚠️  No agent data found for agent ${agentId}`);
        return false; // No agent data means not busy (assume available)
      }

      const agents = response.data.responseData.data;
      if (agents.length === 0) {
        log(`⚠️  Agent ${agentId} not found`);
        return false;
      }

      const agent = agents[0].Agent;
      const status = agent.availability_status;

      // CloudTalk availability_status values:
      // - "calling" = agent is currently on a call (BUSY)
      // - "available" or "online" = agent is available (NOT BUSY)
      // - "offline" = agent is offline (NOT BUSY for routing purposes)
      const isBusy = status === "calling";

      if (isBusy) {
        log(`🔴 Agent ${agentId} (${agent.firstname} ${agent.lastname}) is BUSY - Status: ${status}`);
      } else {
        log(`🟢 Agent ${agentId} (${agent.firstname} ${agent.lastname}) is AVAILABLE - Status: ${status}`);
      }

      return isBusy;

    } catch (error) {
      logError(`Errore controllo stato busy per agente ${agentId}:`, error);
      return false; // In case of error, assume agent is available
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
   * Smart agent selection with fallback - Enhanced round-robin + retry logic
   * @param {Array} availableAgents Lista agenti disponibili
   * @param {number} lastAgentId ID dell'ultimo agente usato
   * @returns {Object} Agente selezionato con metadata fallback
   */
  selectAgentWithFallback(availableAgents, lastAgentId) {
    if (!availableAgents || availableAgents.length === 0) {
      return { agent: null, fallbackUsed: false, reason: 'NO_AGENTS_AVAILABLE' };
    }

    if (availableAgents.length === 1) {
      return {
        agent: availableAgents[0],
        fallbackUsed: false,
        reason: 'SINGLE_AGENT_AVAILABLE',
        roundRobinApplied: false
      };
    }

    // Round robin logic
    let selectedAgent = null;
    let fallbackUsed = false;
    let reason = '';

    const currentLastAgentId = lastAgentId || this.lastDistributionState.lastAgentId;

    if (!currentLastAgentId) {
      // First distribution
      selectedAgent = availableAgents[0];
      reason = 'FIRST_DISTRIBUTION';
    } else {
      // Find last agent and select next
      const lastAgentIndex = availableAgents.findIndex(agent => agent.id === currentLastAgentId);

      if (lastAgentIndex === -1) {
        // Last agent not available, fallback to first
        selectedAgent = availableAgents[0];
        reason = 'LAST_AGENT_UNAVAILABLE_FALLBACK_TO_FIRST';
        fallbackUsed = true;
      } else {
        // Standard round-robin: next agent (with wrap-around)
        const nextIndex = (lastAgentIndex + 1) % availableAgents.length;
        selectedAgent = availableAgents[nextIndex];
        reason = 'ROUND_ROBIN_NEXT_AGENT';

        if (nextIndex === 0) {
          reason = 'ROUND_ROBIN_WRAPPED_TO_FIRST';
        }
      }
    }

    log(`🎯 Smart Selection: ${selectedAgent.name} (${reason}${fallbackUsed ? ' - FALLBACK' : ''})`);

    return {
      agent: selectedAgent,
      fallbackUsed: fallbackUsed,
      reason: reason,
      roundRobinApplied: true,
      lastAgentId: currentLastAgentId,
      availableCount: availableAgents.length
    };
  }

  /**
   * Enhanced lead distribution with smart fallback and retry logic
   * @param {Object} leadData Dati del lead da distribuire
   * @returns {Promise<Object>} Risultato distribuzione con fallback info
   */
  async distributeLeadToAgent(leadData) {
    try {
      log(`🎯 Inizio distribuzione ENHANCED lead: ${leadData.name || leadData.phone || 'Lead senza nome'}`);

      if (!this.initialized) {
        await this.initialize();
      }

      // 1. Get available agents with real-time call checking
      const availableAgents = await this.getAvailableAgents();

      if (availableAgents.length === 0) {
        return {
          success: false,
          error: 'NO_AGENTS_AVAILABLE',
          message: 'Nessun agente disponibile al momento dopo controllo chiamate attive',
          availableAgents: 0,
          selectedAgent: null,
          fallbackInfo: null
        };
      }

      // 2. Smart agent selection with round-robin + fallback
      const selectionResult = this.selectAgentWithFallback(availableAgents);

      if (!selectionResult.agent) {
        return {
          success: false,
          error: 'AGENT_SELECTION_FAILED',
          message: 'Impossibile selezionare un agente',
          availableAgents: availableAgents.length,
          selectedAgent: null,
          fallbackInfo: selectionResult
        };
      }

      // 3. Update round-robin state
      this.lastDistributionState.lastAgentId = selectionResult.agent.id;
      this.lastDistributionState.lastDistributionTime = new Date().toISOString();

      // Add to history with enhanced metadata
      this.lastDistributionState.distributionHistory.unshift({
        agentId: selectionResult.agent.id,
        agentName: selectionResult.agent.name,
        timestamp: this.lastDistributionState.lastDistributionTime,
        reason: selectionResult.reason,
        fallbackUsed: selectionResult.fallbackUsed,
        totalAvailableAgents: availableAgents.length,
        leadInfo: {
          phone: leadData.phone,
          name: leadData.name || `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim()
        }
      });

      // Maintain history limit
      if (this.lastDistributionState.distributionHistory.length > 50) {
        this.lastDistributionState.distributionHistory = this.lastDistributionState.distributionHistory.slice(0, 50);
      }

      await this.saveState();

      // 4. Return enhanced result
      return {
        success: true,
        selectedAgent: selectionResult.agent,
        availableAgents: availableAgents.length,
        fallbackInfo: {
          fallbackUsed: selectionResult.fallbackUsed,
          reason: selectionResult.reason,
          roundRobinApplied: selectionResult.roundRobinApplied
        },
        distributionInfo: {
          timestamp: new Date().toISOString(),
          totalDistributions: this.lastDistributionState.distributionHistory.length,
          lastAgentBeforeThis: selectionResult.lastAgentId,
          allAvailableAgents: availableAgents.map(a => ({ id: a.id, name: a.name, status: a.status }))
        }
      };

    } catch (error) {
      logError('Errore distribuzione lead enhanced:', error);
      return {
        success: false,
        error: 'DISTRIBUTION_ERROR',
        message: error.message,
        availableAgents: 0,
        selectedAgent: null,
        fallbackInfo: null
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