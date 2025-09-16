import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Make Call POST API
 * Endpoint: POST /calls/create.json
 * 
 * Description: Make an outbound call using CloudTalk. At first it will initiate a call to an agent.
 * Maximum waiting time for an agent to pick up the call is 20 seconds. 
 * After an agent picks up, we will automatically call the desired phone number.
 * 
 * Request Body:
 * {
 *   "agent_id": 493933,
 *   "callee_number": "+393513416607"
 * }
 * 
 * Example API Response Payload:
 * {
 *   "responseData": {
 *     "status": 200
 *   }
 * }
 */

async function makeCall(agentId, calleeNumber) {
  console.log('📞 CloudTalk - Make Call');
  console.log('=' .repeat(40));

  if (!agentId) throw new Error('agentId is required');
  if (!calleeNumber) throw new Error('calleeNumber is required');

  const endpoint = '/calls/create.json';
  const requestBody = {
    agent_id: parseInt(agentId),
    callee_number: calleeNumber
  };

  console.log(`📱 Initiating call from Agent ${agentId} to ${calleeNumber}`);
  console.log(`📋 Request body:`, JSON.stringify(requestBody, null, 2));

  try {
    const response = await makeCloudTalkRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });

    console.log('✅ Success!');
    console.log(`📞 Call initiated successfully!`);
    console.log(`⏱️  The agent will be called first (max 20s wait time)`);
    console.log(`🔄 After agent pickup, the call will be made to ${calleeNumber}`);

    if (response.data?.responseData?.status === 200) {
      console.log(`✅ API Response: Call request accepted`);
    }

    return response.data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    
    // Handle specific error cases
    if (error.message.includes('403')) {
      console.log('⚠️  Agent may not be online or available');
    } else if (error.message.includes('404')) {
      console.log('⚠️  Agent ID not found');
    } else if (error.message.includes('406')) {
      console.log('⚠️  Invalid input data (check agent_id and phone number format)');
    } else if (error.message.includes('409')) {
      console.log('⚠️  Agent is already on a call');
    }
    
    throw error;
  }
}

// Test runner
async function runTests() {
  console.log('🚀 Testing CloudTalk Make Call API\n');
  
  try {
    // DEPENDENCY: Get a real agent ID first
    console.log('Step 1: Getting available agent ID...');
    const { getAgents } = await import('../GET/get-agents.js');
    const agentsResponse = await getAgents({ limit: 1 });
    
    let agentId = null;
    if (agentsResponse?.responseData?.data?.length > 0) {
      const firstAgent = agentsResponse.responseData.data[0];
      agentId = firstAgent.Agent?.id;
      
      if (agentId) {
        console.log(`✅ Found agent: ${firstAgent.Agent.name} (ID: ${agentId})`);
        console.log(`📊 Agent status: ${firstAgent.Agent.availability_status || 'unknown'}`);
      }
    }
    
    if (!agentId) {
      console.log('❌ No agent found, using default agent ID 493933');
      agentId = 493933;
    }

    console.log('\n' + '='.repeat(50));
    console.log('Step 2: Making test call...');
    
    // Make call to your personal number
    const targetNumber = '+393513416607';
    console.log(`📞 Test call will be made to: ${targetNumber}`);
    console.log('⚠️  IMPORTANT: This will initiate a real call!');
    
    // Ask for confirmation in a real scenario, but proceed for testing
    await makeCall(agentId, targetNumber);
    
    console.log('\n🎉 Make Call test completed successfully!');
    console.log('📱 If the agent was online, you should receive a call shortly.');
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    
    // Don't exit with error for call failures as they might be expected
    if (error.message.includes('403')) {
      console.log('ℹ️  This is normal if no agent is currently online');
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { makeCall };