import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Edit Agent POST API
 * Endpoint: POST /agents/edit/{agentId}.json
 * 
 * Description: Edit an agent's settings and configuration
 * 
 * Request Body:
 * {
 *   "name": "Roberto Bondici",
 *   "firstname": "Roberto",
 *   "lastname": "Bondici", 
 *   "email": "roberto@cloudtalk.test",
 *   "password": "newpassword123",
 *   "extension": "1001",
 *   "call_number_id": 190625,
 *   "status_outbound": true,
 *   "availability_status": "online"
 * }
 * 
 * Example API Response Payload:
 * {
 *   "responseData": {
 *     "status": 200,
 *     "message": "Agent updated successfully."
 *   }
 * }
 */

async function editAgent(agentId, agentData) {
  console.log('🧑‍💼 CloudTalk - Edit Agent');
  console.log('=' .repeat(40));

  if (!agentId) throw new Error('agentId is required');
  if (!agentData) throw new Error('agentData is required');

  const endpoint = `/agents/edit/${agentId}.json`;
  
  console.log(`✏️  Editing agent ID: ${agentId}`);
  console.log(`📋 Request body:`, JSON.stringify(agentData, null, 2));

  try {
    const response = await makeCloudTalkRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(agentData)
    });

    console.log('✅ Success!');
    console.log(`🧑‍💼 Agent ${agentId} updated successfully!`);
    
    if (agentData.name) {
      console.log(`📝 Name: ${agentData.name}`);
    }
    
    if (agentData.email) {
      console.log(`📧 Email: ${agentData.email}`);
    }
    
    if (agentData.extension) {
      console.log(`📞 Extension: ${agentData.extension}`);
    }
    
    if (agentData.availability_status) {
      console.log(`📊 Status: ${agentData.availability_status}`);
    }

    return response.data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    
    if (error.message.includes('404')) {
      console.log('⚠️  Agent not found');
    } else if (error.message.includes('406')) {
      console.log('⚠️  Invalid input data');
    }
    
    throw error;
  }
}

// Test runner
async function runTests() {
  console.log('🚀 Testing CloudTalk Edit Agent API\n');
  
  try {
    // DEPENDENCY: Get a real agent ID first
    console.log('Step 1: Getting existing agent ID...');
    const { getAgents } = await import('../GET/get-agents.js');
    const agentsResponse = await getAgents({ limit: 1 });
    
    let agentId = null;
    let existingAgent = null;
    
    if (agentsResponse?.responseData?.data?.length > 0) {
      existingAgent = agentsResponse.responseData.data[0];
      agentId = existingAgent.Agent?.id;
      
      if (agentId) {
        console.log(`✅ Found agent: ${existingAgent.Agent.name} (ID: ${agentId})`);
        console.log(`📧 Current email: ${existingAgent.Agent.email || 'No email'}`);
      }
    }
    
    if (!agentId) {
      console.log('❌ No agent found for testing');
      return;
    }

    console.log('\n' + '='.repeat(50));
    console.log('Step 2: Updating agent configuration for call handling...');
    
    // Update agent configuration to optimize for handling Roberto's calls
    const updatedAgentData = {
      name: "Roberto Bondici (API Test Agent)",
      firstname: "Roberto",
      lastname: "Bondici",
      email: "roberto.api.test@cloudtalk.test",
      status_outbound: true, // Enable outbound calls
      availability_status: "online" // Ensure agent is online for receiving calls
    };
    
    await editAgent(agentId, updatedAgentData);
    
    console.log('\n🎉 Edit Agent test completed successfully!');
    console.log(`🧑‍💼 Agent configured for optimal call handling`);
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { editAgent };