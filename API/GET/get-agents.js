import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Agents GET API
 * Endpoint: GET /agents/index.json
 * 
 * Query Parameters:
 * - id: Filter by agent ID
 * - limit: Max number of items (1-1000)
 * - page: Page number (min 1)
 * - associated_number: Filter by assigned number (e164 format)
 */

async function getAgents(params = {}) {
  console.log('🧑‍💼 CloudTalk - Get Agents');
  console.log('=' .repeat(40));

  // Build query string
  const queryParams = new URLSearchParams();
  if (params.id) queryParams.append('id', params.id);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.page) queryParams.append('page', params.page);
  if (params.associated_number) queryParams.append('associated_number', params.associated_number);
  
  const queryString = queryParams.toString();
  const endpoint = `/agents/index.json${queryString ? '?' + queryString : ''}`;

  try {
    const response = await makeCloudTalkRequest(endpoint);
    
    console.log('✅ Success!');
    if (response.data?.responseData) {
      const data = response.data.responseData;
      console.log(`📊 Found ${data.itemsCount} agents (Page ${data.pageNumber}/${data.pageCount})`);
      
      if (data.data && data.data.length > 0) {
        console.log('\n👥 Agents:');
        data.data.forEach((item, index) => {
          const agent = item.Agent;
          console.log(`   ${index + 1}. ${agent.firstname} ${agent.lastname} (ID: ${agent.id})`);
          console.log(`      📧 ${agent.email}`);
          console.log(`      📞 ${agent.default_number} (Ext: ${agent.extension})`);
          console.log(`      🟢 ${agent.availability_status}`);
        });
      }
    }
    
    return response.data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test examples
async function runTests() {
  console.log('🚀 Testing CloudTalk Agents API\n');

  try {
    // Test 1: Get all agents
    console.log('Test 1: All agents');
    await getAgents();

    console.log('\n' + '='.repeat(50));
    
    // Test 2: With limit
    console.log('Test 2: Limited to 5 agents');
    await getAgents({ limit: 5 });

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getAgents };