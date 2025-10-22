#!/usr/bin/env node

import { makeCloudTalkRequest } from './API CloudTalk/config.js';

/**
 * Smart Agent Detection and Round-Robin Distribution System
 *
 * This module provides advanced agent availability detection that goes beyond
 * simple status checking. It combines multiple data sources to determine
 * true availability for intelligent call routing.
 */

class SmartAgentDetector {
  constructor(options = {}) {
    this.enableLogging = options.enableLogging !== false;
    this.cacheTimeout = options.cacheTimeout || 30000; // 30 seconds
    this.agentCache = new Map();
    this.lastCallsCheck = null;
    this.activeCalls = [];
  }

  log(message) {
    if (this.enableLogging) {
      console.log(`[SmartAgentDetector] ${message}`);
    }
  }

  /**
   * Get all agents with enhanced availability information
   */
  async getAllAgentsWithStatus() {
    try {
      this.log('Fetching all agents with enhanced status...');

      const agentResponse = await makeCloudTalkRequest('/agents/index.json');
      const agents = agentResponse?.data?.responseData?.data || [];

      // Also fetch recent calls to cross-reference active calls
      await this.refreshActiveCalls();

      const enhancedAgents = agents.map(item => {
        const agent = item.Agent;
        const activeCall = this.findActiveCallForAgent(agent.id);

        return {
          id: agent.id,
          name: `${agent.firstname} ${agent.lastname}`,
          email: agent.email,
          phone: agent.default_number,
          extension: agent.extension,
          cloudtalk_status: agent.availability_status,
          is_truly_available: this.determineTrueAvailability(agent, activeCall),
          active_call: activeCall,
          last_updated: new Date().toISOString()
        };
      });

      this.log(`Enhanced ${enhancedAgents.length} agents with smart availability detection`);
      return enhancedAgents;

    } catch (error) {
      this.log(`Error fetching agents: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refresh the cache of active calls
   */
  async refreshActiveCalls() {
    try {
      const now = Date.now();

      // Skip if we recently checked
      if (this.lastCallsCheck && (now - this.lastCallsCheck) < this.cacheTimeout) {
        return;
      }

      this.log('Refreshing active calls cache...');
      const callsResponse = await makeCloudTalkRequest('/calls/index.json?limit=50');
      const calls = callsResponse?.data?.responseData?.data || [];

      // Filter for truly active calls (no end time)
      this.activeCalls = calls.filter(item => {
        const call = item.Cdr || item.Call || item.CallSummary || item;
        return !call.ended_at && call.started_at;
      });

      this.lastCallsCheck = now;
      this.log(`Found ${this.activeCalls.length} active calls`);

    } catch (error) {
      this.log(`Error refreshing active calls: ${error.message}`);
      this.activeCalls = []; // Fallback to empty array
    }
  }

  /**
   * Find if an agent has an active call
   */
  findActiveCallForAgent(agentId) {
    const activeCall = this.activeCalls.find(item => {
      const call = item.Cdr || item.Call || item.CallSummary || item;
      const agent = item.Agent;
      return agent && agent.id === agentId;
    });

    if (activeCall) {
      const call = activeCall.Cdr || activeCall.Call || activeCall.CallSummary || activeCall;
      const startTime = new Date(call.started_at);
      const duration = Math.floor((Date.now() - startTime.getTime()) / 1000);

      return {
        call_id: call.id,
        started_at: call.started_at,
        duration_seconds: duration,
        external_number: call.public_external,
        call_type: call.type
      };
    }

    return null;
  }

  /**
   * Determine true availability using multiple factors
   */
  determineTrueAvailability(agent, activeCall) {
    // If agent has an active call, they're definitely not available
    if (activeCall) {
      return false;
    }

    // Check CloudTalk status
    const status = agent.availability_status.toLowerCase();

    // Map CloudTalk statuses to availability
    const availabilityMap = {
      'online': true,
      'available': true,
      'ready': true,
      'idle': true,
      'calling': false,  // Currently on call
      'busy': false,     // Busy with something
      'away': false,     // Away from desk
      'offline': false,  // Not logged in
      'unavailable': false,
      'do not disturb': false,
      'dnd': false
    };

    return availabilityMap[status] || false; // Default to false for unknown statuses
  }

  /**
   * Get only truly available agents for round-robin distribution
   */
  async getAvailableAgents() {
    const allAgents = await this.getAllAgentsWithStatus();
    const availableAgents = allAgents.filter(agent => agent.is_truly_available);

    this.log(`${availableAgents.length} of ${allAgents.length} agents are truly available`);

    return availableAgents.sort((a, b) => a.name.localeCompare(b.name)); // Sort by name for consistency
  }

  /**
   * Get the next available agent using round-robin logic
   */
  async getNextAvailableAgent(lastUsedAgentId = null) {
    const availableAgents = await this.getAvailableAgents();

    if (availableAgents.length === 0) {
      this.log('No available agents found');
      return null;
    }

    if (availableAgents.length === 1) {
      this.log(`Only one available agent: ${availableAgents[0].name}`);
      return availableAgents[0];
    }

    // Round-robin logic: find next agent after the last used one
    if (lastUsedAgentId) {
      const lastUsedIndex = availableAgents.findIndex(agent => agent.id === lastUsedAgentId);

      if (lastUsedIndex !== -1) {
        // Get next agent in the list, wrap around if necessary
        const nextIndex = (lastUsedIndex + 1) % availableAgents.length;
        const nextAgent = availableAgents[nextIndex];
        this.log(`Round-robin selection: ${nextAgent.name} (after ${availableAgents[lastUsedIndex].name})`);
        return nextAgent;
      }
    }

    // Default to first available agent
    const firstAgent = availableAgents[0];
    this.log(`Default selection: ${firstAgent.name}`);
    return firstAgent;
  }

  /**
   * Get detailed status report for all agents
   */
  async getStatusReport() {
    const agents = await this.getAllAgentsWithStatus();

    const report = {
      total_agents: agents.length,
      available_agents: agents.filter(a => a.is_truly_available).length,
      busy_agents: agents.filter(a => !a.is_truly_available).length,
      active_calls: this.activeCalls.length,
      agents: agents,
      generated_at: new Date().toISOString()
    };

    return report;
  }
}

// Test function to demonstrate the system
async function runSmartDetectionTest() {
  console.log('🧠 Smart Agent Detection System Test');
  console.log('='.repeat(50));

  const detector = new SmartAgentDetector();

  try {
    // Get status report
    const report = await detector.getStatusReport();

    console.log(`\n📊 Agent Status Report:`);
    console.log(`   Total agents: ${report.total_agents}`);
    console.log(`   Available: ${report.available_agents}`);
    console.log(`   Busy: ${report.busy_agents}`);
    console.log(`   Active calls: ${report.active_calls}`);

    console.log(`\n👥 Agent Details:`);
    report.agents.forEach((agent, index) => {
      const status = agent.is_truly_available ? '🟢 AVAILABLE' : '🔴 BUSY';
      console.log(`   ${index + 1}. ${agent.name} - ${status}`);
      console.log(`      CloudTalk Status: ${agent.cloudtalk_status}`);
      console.log(`      Extension: ${agent.extension}`);
      console.log(`      Email: ${agent.email}`);

      if (agent.active_call) {
        const duration = Math.floor(agent.active_call.duration_seconds / 60);
        const seconds = agent.active_call.duration_seconds % 60;
        console.log(`      🔴 On call: ${duration}:${seconds.toString().padStart(2, '0')} with ${agent.active_call.external_number}`);
      }
      console.log('');
    });

    // Test round-robin selection
    console.log(`\n🔄 Round-Robin Test:`);
    const firstAgent = await detector.getNextAvailableAgent();
    if (firstAgent) {
      console.log(`   First selection: ${firstAgent.name}`);

      const secondAgent = await detector.getNextAvailableAgent(firstAgent.id);
      if (secondAgent) {
        console.log(`   Second selection: ${secondAgent.name}`);
      }
    } else {
      console.log(`   ❌ No agents available for selection`);
    }

    console.log(`\n✅ Smart detection test completed successfully!`);

  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
  }
}

// Export for use in other modules
export { SmartAgentDetector };

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSmartDetectionTest();
}