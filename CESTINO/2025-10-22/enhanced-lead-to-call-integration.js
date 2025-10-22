#!/usr/bin/env node

/**
 * Enhanced Lead-to-Call Integration with Real-Time Agent Detection
 *
 * This demonstrates how to integrate the SmartAgentDetector with the existing
 * lead-to-call service for improved agent availability detection.
 */

import { SmartAgentDetector } from './smart-agent-detector.js';
import { makeCloudTalkRequest } from './API CloudTalk/config.js';

class EnhancedLeadToCallService {
  constructor() {
    this.agentDetector = new SmartAgentDetector({
      enableLogging: true,
      cacheTimeout: 15000 // 15 seconds cache for high-volume scenarios
    });
    this.lastUsedAgentId = null;
    this.callAttemptHistory = new Map();
  }

  /**
   * Main lead processing function - enhanced with real-time agent detection
   */
  async processLead(leadData) {
    console.log(`🎯 Processing lead: ${leadData.name || leadData.id}`);

    try {
      // Step 1: Create contact in CloudTalk (existing logic)
      const contact = await this.createContactInCloudTalk(leadData);
      console.log(`✅ Contact created: ${contact.id}`);

      // Step 2: Find available agent using enhanced detection
      const availableAgent = await this.findBestAvailableAgent();

      if (!availableAgent) {
        console.log(`❌ No agents available for lead ${leadData.id}`);
        return await this.handleNoAgentsAvailable(leadData, contact);
      }

      // Step 3: Make the call with enhanced error handling
      const callResult = await this.makeEnhancedCall(availableAgent, leadData, contact);

      // Step 4: Update tracking
      this.lastUsedAgentId = availableAgent.id;
      this.recordCallAttempt(leadData.id, availableAgent, callResult);

      return {
        success: true,
        contact: contact,
        agent: availableAgent,
        call: callResult,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Lead processing failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        leadId: leadData.id,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Enhanced agent finding with fallback strategies
   */
  async findBestAvailableAgent() {
    try {
      console.log('🔍 Finding best available agent...');

      // Primary: Get next agent in round-robin
      const nextAgent = await this.agentDetector.getNextAvailableAgent(this.lastUsedAgentId);

      if (nextAgent) {
        console.log(`✅ Selected agent: ${nextAgent.name} (Round-robin)`);
        return nextAgent;
      }

      // Fallback 1: Any available agent
      const availableAgents = await this.agentDetector.getAvailableAgents();
      if (availableAgents.length > 0) {
        const fallbackAgent = availableAgents[0];
        console.log(`⚠️  Fallback to: ${fallbackAgent.name} (First available)`);
        return fallbackAgent;
      }

      // Fallback 2: Check if any agent just became available
      console.log('🔄 Re-checking agent status in case of recent changes...');
      await this.agentDetector.refreshActiveCalls(); // Force refresh
      const refreshedAgents = await this.agentDetector.getAvailableAgents();

      if (refreshedAgents.length > 0) {
        console.log(`✅ Found agent after refresh: ${refreshedAgents[0].name}`);
        return refreshedAgents[0];
      }

      return null;

    } catch (error) {
      console.error(`❌ Error finding available agent: ${error.message}`);
      return null;
    }
  }

  /**
   * Enhanced call making with retry logic and status verification
   */
  async makeEnhancedCall(agent, leadData, contact) {
    console.log(`📞 Making call: Agent ${agent.name} → ${leadData.phone}`);

    try {
      // Verify agent is still available before making call
      const currentStatus = await this.verifyAgentStillAvailable(agent.id);
      if (!currentStatus.available) {
        throw new Error(`Agent ${agent.name} no longer available (${currentStatus.reason})`);
      }

      // Make the call using CloudTalk API
      const callResponse = await makeCloudTalkRequest('/calls.json', {
        method: 'POST',
        body: JSON.stringify({
          type: 'api',
          user_id: agent.id,
          contact_id: contact.id,
          phone_number: leadData.phone,
          note: `GHL Lead: ${leadData.name || 'Unknown'} - Auto-generated call`
        })
      });

      if (callResponse.status === 200) {
        console.log(`✅ Call initiated successfully`);
        return {
          success: true,
          call_id: callResponse.data?.id,
          agent_id: agent.id,
          contact_id: contact.id,
          phone: leadData.phone
        };
      } else {
        throw new Error(`Call API returned status ${callResponse.status}`);
      }

    } catch (error) {
      console.error(`❌ Call failed: ${error.message}`);

      // Try with fallback agent if the original agent became unavailable
      if (error.message.includes('no longer available')) {
        const fallbackAgent = await this.findBestAvailableAgent();
        if (fallbackAgent && fallbackAgent.id !== agent.id) {
          console.log(`🔄 Retrying with fallback agent: ${fallbackAgent.name}`);
          return await this.makeEnhancedCall(fallbackAgent, leadData, contact);
        }
      }

      return {
        success: false,
        error: error.message,
        agent_id: agent.id,
        contact_id: contact.id
      };
    }
  }

  /**
   * Verify an agent is still available before making a call
   */
  async verifyAgentStillAvailable(agentId) {
    try {
      const allAgents = await this.agentDetector.getAllAgentsWithStatus();
      const agent = allAgents.find(a => a.id === agentId);

      if (!agent) {
        return { available: false, reason: 'Agent not found' };
      }

      if (!agent.is_truly_available) {
        return {
          available: false,
          reason: `Status: ${agent.cloudtalk_status}${agent.active_call ? ', On call' : ''}`
        };
      }

      return { available: true, agent };

    } catch (error) {
      return { available: false, reason: `Verification failed: ${error.message}` };
    }
  }

  /**
   * Handle when no agents are available
   */
  async handleNoAgentsAvailable(leadData, contact) {
    console.log('⚠️  No agents available - implementing fallback strategy');

    // Get status report for detailed logging
    const statusReport = await this.agentDetector.getStatusReport();

    console.log(`📊 Agent status: ${statusReport.available_agents}/${statusReport.total_agents} available`);
    statusReport.agents.forEach(agent => {
      const status = agent.is_truly_available ? '🟢' : '🔴';
      const callInfo = agent.active_call ? ` (${Math.floor(agent.active_call.duration_seconds / 60)}min call)` : '';
      console.log(`   ${status} ${agent.name}: ${agent.cloudtalk_status}${callInfo}`);
    });

    // Implement fallback strategies
    const fallbackStrategies = [
      () => this.scheduleCallbackWhenAvailable(leadData, contact),
      () => this.notifyAdministrator(leadData, statusReport),
      () => this.addToQueueForManualHandling(leadData, contact)
    ];

    for (const strategy of fallbackStrategies) {
      try {
        const result = await strategy();
        if (result.success) {
          return result;
        }
      } catch (error) {
        console.error(`Fallback strategy failed: ${error.message}`);
      }
    }

    return {
      success: false,
      reason: 'No agents available and all fallback strategies failed',
      contact: contact,
      leadId: leadData.id,
      agentStatus: statusReport
    };
  }

  /**
   * Schedule callback when agent becomes available
   */
  async scheduleCallbackWhenAvailable(leadData, contact) {
    // This would integrate with a queue system
    console.log('📅 Scheduling callback when agent becomes available');

    return {
      success: true,
      action: 'scheduled_callback',
      message: 'Lead scheduled for callback when agent available',
      contact: contact,
      estimatedCallback: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    };
  }

  /**
   * Notify administrator of no agents available
   */
  async notifyAdministrator(leadData, statusReport) {
    console.log('🚨 Notifying administrator - no agents available');

    // This would send notification (email, Slack, etc.)
    return {
      success: true,
      action: 'admin_notified',
      message: 'Administrator notified of agent shortage',
      statusReport: statusReport
    };
  }

  /**
   * Add to manual handling queue
   */
  async addToQueueForManualHandling(leadData, contact) {
    console.log('📝 Adding to manual handling queue');

    return {
      success: true,
      action: 'manual_queue',
      message: 'Lead added to manual handling queue',
      contact: contact,
      priority: leadData.priority || 'normal'
    };
  }

  /**
   * Record call attempt for analytics
   */
  recordCallAttempt(leadId, agent, callResult) {
    this.callAttemptHistory.set(leadId, {
      timestamp: new Date().toISOString(),
      agent: {
        id: agent.id,
        name: agent.name
      },
      result: callResult,
      success: callResult.success
    });

    // Keep only last 1000 entries
    if (this.callAttemptHistory.size > 1000) {
      const firstKey = this.callAttemptHistory.keys().next().value;
      this.callAttemptHistory.delete(firstKey);
    }
  }

  /**
   * Simplified contact creation for demo
   */
  async createContactInCloudTalk(leadData) {
    // This would use the actual CloudTalk contact creation API
    return {
      id: Math.floor(Math.random() * 1000000),
      name: leadData.name,
      phone: leadData.phone,
      created: new Date().toISOString()
    };
  }

  /**
   * Get service statistics
   */
  getStatistics() {
    const attempts = Array.from(this.callAttemptHistory.values());
    const successful = attempts.filter(a => a.success).length;

    return {
      totalAttempts: attempts.length,
      successfulCalls: successful,
      successRate: attempts.length > 0 ? (successful / attempts.length * 100).toFixed(2) + '%' : '0%',
      lastUsedAgent: this.lastUsedAgentId,
      cacheSize: this.callAttemptHistory.size
    };
  }
}

// Demo function
async function demoEnhancedLeadToCall() {
  console.log('🚀 Enhanced Lead-to-Call Integration Demo');
  console.log('='.repeat(50));

  const service = new EnhancedLeadToCallService();

  // Demo lead data
  const testLead = {
    id: 'demo_lead_001',
    name: 'Roberto Test Lead',
    phone: '+393513416607',
    email: 'test@example.com',
    source: 'GoHighLevel Demo'
  };

  try {
    // Process the lead
    const result = await service.processLead(testLead);

    console.log('\n📊 Processing Result:');
    console.log(JSON.stringify(result, null, 2));

    // Show statistics
    console.log('\n📈 Service Statistics:');
    console.log(JSON.stringify(service.getStatistics(), null, 2));

    // Show current agent status
    console.log('\n👥 Current Agent Status:');
    const statusReport = await service.agentDetector.getStatusReport();
    statusReport.agents.forEach(agent => {
      const status = agent.is_truly_available ? '🟢 AVAILABLE' : '🔴 BUSY';
      console.log(`   ${agent.name}: ${status} (${agent.cloudtalk_status})`);
    });

  } catch (error) {
    console.error('Demo failed:', error.message);
  }
}

// Export for use in other modules
export { EnhancedLeadToCallService };

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demoEnhancedLeadToCall();
}