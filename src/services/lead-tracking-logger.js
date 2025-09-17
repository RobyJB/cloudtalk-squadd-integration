import fs from 'fs/promises';
import path from 'path';
import { log, logError } from '../logger.js';

/**
 * Servizio di logging specializzato per tracking distribuzione lead
 * 
 * Features:
 * - Log strutturato per analisi performance
 * - Metriche distribuzione agenti
 * - Tracking tempo risposta
 * - Esportazione dati per analytics
 */

class LeadTrackingLogger {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs', 'lead-distribution');
    this.currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.logFile = path.join(this.logsDir, `lead-distribution-${this.currentDate}.jsonl`);
    this.metricsFile = path.join(this.logsDir, `metrics-${this.currentDate}.json`);
    this.initialized = false;
  }

  /**
   * Inizializza il sistema di logging
   */
  async initialize() {
    try {
      // Crea directory logs se non esiste
      await fs.mkdir(this.logsDir, { recursive: true });
      this.initialized = true;
      log(`📊 Lead tracking logger inizializzato: ${this.logsDir}`);
    } catch (error) {
      logError('Errore inizializzazione LeadTrackingLogger:', error);
      throw error;
    }
  }

  /**
   * Assicura che il logger sia inizializzato
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }

    // Controlla se è cambiato il giorno (per rotazione file)
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.currentDate) {
      this.currentDate = today;
      this.logFile = path.join(this.logsDir, `lead-distribution-${this.currentDate}.jsonl`);
      this.metricsFile = path.join(this.logsDir, `metrics-${this.currentDate}.json`);
      log(`📅 Rotazione log file per data: ${today}`);
    }
  }

  /**
   * Log completo del processo Lead-to-Call
   * @param {Object} processData Dati del processo completo
   */
  async logLeadProcess(processData) {
    try {
      await this.ensureInitialized();

      const logEntry = {
        timestamp: new Date().toISOString(),
        processId: processData.processId,
        type: 'LEAD_PROCESS',
        
        // Dati del lead
        lead: {
          id: processData.leadData?.id,
          name: processData.leadData?.name,
          phone: processData.leadData?.phone,
          email: processData.leadData?.email,
          source: 'GoHighLevel'
        },
        
        // Risultato del processo
        success: processData.success,
        finalStatus: processData.finalStatus,
        error: processData.error,
        processingTime: processData.processingTime || null,
        
        // Step details
        steps: {
          contactCreation: {
            success: processData.steps?.contactCreation?.success || false,
            contactId: processData.steps?.contactCreation?.contactId,
            error: processData.steps?.contactCreation?.error
          },
          agentDistribution: {
            success: processData.steps?.agentDistribution?.success || false,
            selectedAgentId: processData.steps?.agentDistribution?.selectedAgent?.id,
            selectedAgentName: processData.steps?.agentDistribution?.selectedAgent?.name,
            availableAgents: processData.steps?.agentDistribution?.availableAgents || 0,
            error: processData.steps?.agentDistribution?.error
          },
          callInitiation: {
            success: processData.steps?.callInitiation?.success || false,
            error: processData.steps?.callInitiation?.error
          }
        },
        
        // Metadata per analytics
        metadata: {
          dayOfWeek: new Date().getDay(),
          hourOfDay: new Date().getHours(),
          serverUptime: process.uptime()
        }
      };

      // Scrivi nel file JSONL (una riga per entry)
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.logFile, logLine);

      // Aggiorna metriche
      await this.updateMetrics(logEntry);

    } catch (error) {
      logError('Errore logging processo lead:', error);
    }
  }

  /**
   * Log distribuzione agente
   * @param {Object} distributionData Dati distribuzione
   */
  async logAgentDistribution(distributionData) {
    try {
      await this.ensureInitialized();

      const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'AGENT_DISTRIBUTION',
        selectedAgent: distributionData.selectedAgent,
        availableAgents: distributionData.availableAgents,
        roundRobinInfo: distributionData.distributionInfo,
        leadInfo: {
          processId: distributionData.processId,
          phone: distributionData.leadPhone
        }
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.logFile, logLine);

    } catch (error) {
      logError('Errore logging distribuzione agente:', error);
    }
  }

  /**
   * Aggiorna le metriche giornaliere
   * @param {Object} logEntry Entry di log processato
   */
  async updateMetrics(logEntry) {
    try {
      let metrics = {};
      
      // Carica metriche esistenti
      try {
        const metricsData = await fs.readFile(this.metricsFile, 'utf8');
        metrics = JSON.parse(metricsData);
      } catch (error) {
        // File non esiste, inizializza metriche vuote
        metrics = this.initializeEmptyMetrics();
      }

      // Aggiorna contatori
      metrics.totalProcesses++;
      metrics.lastUpdated = new Date().toISOString();

      if (logEntry.success) {
        metrics.successfulCalls++;
        metrics.successRate = (metrics.successfulCalls / metrics.totalProcesses * 100).toFixed(2);
      } else {
        metrics.failedCalls++;
        
        // Conta errori per tipo
        const errorType = logEntry.finalStatus || 'UNKNOWN_ERROR';
        if (!metrics.errorsByType[errorType]) {
          metrics.errorsByType[errorType] = 0;
        }
        metrics.errorsByType[errorType]++;
      }

      // Aggiorna stats agenti
      if (logEntry.steps?.agentDistribution?.selectedAgentId) {
        const agentId = logEntry.steps.agentDistribution.selectedAgentId;
        const agentName = logEntry.steps.agentDistribution.selectedAgentName;
        
        if (!metrics.agentStats[agentId]) {
          metrics.agentStats[agentId] = {
            name: agentName,
            totalAssigned: 0,
            successfulCalls: 0,
            failedCalls: 0
          };
        }
        
        metrics.agentStats[agentId].totalAssigned++;
        
        if (logEntry.success) {
          metrics.agentStats[agentId].successfulCalls++;
        } else {
          metrics.agentStats[agentId].failedCalls++;
        }
      }

      // Salva metriche aggiornate
      await fs.writeFile(this.metricsFile, JSON.stringify(metrics, null, 2));

    } catch (error) {
      logError('Errore aggiornamento metriche:', error);
    }
  }

  /**
   * Inizializza struttura metriche vuote
   */
  initializeEmptyMetrics() {
    return {
      date: this.currentDate,
      totalProcesses: 0,
      successfulCalls: 0,
      failedCalls: 0,
      successRate: 0,
      errorsByType: {},
      agentStats: {},
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Ottieni metriche giornaliere correnti
   * @returns {Object} Metriche attuali
   */
  async getCurrentMetrics() {
    try {
      await this.ensureInitialized();
      
      const metricsData = await fs.readFile(this.metricsFile, 'utf8');
      return JSON.parse(metricsData);
    } catch (error) {
      // File non esiste, ritorna metriche vuote
      return this.initializeEmptyMetrics();
    }
  }

  /**
   * Ottieni statistiche degli ultimi N processi
   * @param {number} limit Numero di processi da recuperare
   * @returns {Array} Lista processi recenti
   */
  async getRecentProcesses(limit = 50) {
    try {
      await this.ensureInitialized();
      
      const fileContent = await fs.readFile(this.logFile, 'utf8');
      const lines = fileContent.trim().split('\n').filter(line => line.trim());
      
      const processes = lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return null;
          }
        })
        .filter(entry => entry && entry.type === 'LEAD_PROCESS')
        .slice(-limit) // Prendi gli ultimi N
        .reverse(); // Ordine cronologico inverso (più recenti prima)
      
      return processes;
      
    } catch (error) {
      logError('Errore recupero processi recenti:', error);
      return [];
    }
  }

  /**
   * Esporta dati per analytics
   * @param {string} startDate Data inizio (YYYY-MM-DD)
   * @param {string} endDate Data fine (YYYY-MM-DD)
   * @returns {Object} Dati aggregati per il periodo
   */
  async exportAnalyticsData(startDate, endDate) {
    try {
      const analytics = {
        period: { startDate, endDate },
        totalProcesses: 0,
        successfulCalls: 0,
        failedCalls: 0,
        errorDistribution: {},
        agentPerformance: {},
        hourlyDistribution: Array(24).fill(0),
        dailyDistribution: {},
        avgProcessingTime: 0
      };

      // Per semplicità, implementiamo solo per il giorno corrente
      // In una versione completa dovresti iterare su tutti i file nel range
      const processes = await this.getRecentProcesses(1000);
      
      let totalProcessingTime = 0;
      let processesWithTiming = 0;

      for (const process of processes) {
        analytics.totalProcesses++;
        
        if (process.success) {
          analytics.successfulCalls++;
        } else {
          analytics.failedCalls++;
          
          const errorType = process.finalStatus || 'UNKNOWN';
          analytics.errorDistribution[errorType] = (analytics.errorDistribution[errorType] || 0) + 1;
        }

        // Stats per ora
        const hour = new Date(process.timestamp).getHours();
        analytics.hourlyDistribution[hour]++;

        // Stats per giorno
        const day = process.timestamp.split('T')[0];
        analytics.dailyDistribution[day] = (analytics.dailyDistribution[day] || 0) + 1;

        // Performance agenti
        if (process.steps?.agentDistribution?.selectedAgentId) {
          const agentId = process.steps.agentDistribution.selectedAgentId;
          const agentName = process.steps.agentDistribution.selectedAgentName;
          
          if (!analytics.agentPerformance[agentId]) {
            analytics.agentPerformance[agentId] = {
              name: agentName,
              totalAssigned: 0,
              successful: 0,
              failed: 0,
              successRate: 0
            };
          }
          
          analytics.agentPerformance[agentId].totalAssigned++;
          
          if (process.success) {
            analytics.agentPerformance[agentId].successful++;
          } else {
            analytics.agentPerformance[agentId].failed++;
          }
          
          // Calcola success rate
          const agent = analytics.agentPerformance[agentId];
          agent.successRate = (agent.successful / agent.totalAssigned * 100).toFixed(2);
        }

        // Tempo processing
        if (process.processingTime) {
          totalProcessingTime += process.processingTime;
          processesWithTiming++;
        }
      }

      if (processesWithTiming > 0) {
        analytics.avgProcessingTime = Math.round(totalProcessingTime / processesWithTiming);
      }

      analytics.successRate = analytics.totalProcesses > 0 
        ? (analytics.successfulCalls / analytics.totalProcesses * 100).toFixed(2)
        : 0;

      return analytics;

    } catch (error) {
      logError('Errore export analytics:', error);
      return null;
    }
  }

  /**
   * Pulizia log vecchi (retention policy)
   * @param {number} retentionDays Giorni di retention
   */
  async cleanupOldLogs(retentionDays = 30) {
    try {
      const files = await fs.readdir(this.logsDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      let deletedFiles = 0;
      
      for (const file of files) {
        if (file.match(/^(lead-distribution|metrics)-\d{4}-\d{2}-\d{2}\.(jsonl|json)$/)) {
          const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            const fileDate = new Date(dateMatch[1]);
            if (fileDate < cutoffDate) {
              await fs.unlink(path.join(this.logsDir, file));
              deletedFiles++;
            }
          }
        }
      }
      
      if (deletedFiles > 0) {
        log(`🗑️ Puliti ${deletedFiles} file di log vecchi (retention: ${retentionDays} giorni)`);
      }
      
      return deletedFiles;
      
    } catch (error) {
      logError('Errore cleanup log vecchi:', error);
      return 0;
    }
  }
}

// Istanza singleton
const leadTrackingLogger = new LeadTrackingLogger();

export default leadTrackingLogger;