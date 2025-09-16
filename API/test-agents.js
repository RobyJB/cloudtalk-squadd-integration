import { makeCloudTalkRequest } from './config.js';

/**
 * Test CloudTalk Agents API
 * Based on swagger.json endpoints:
 * - GET /agents/index.json - List agents
 */

async function testAgentsAPI() {
  console.log('🧑‍💼 Testing CloudTalk Agents API...\n');

  try {
    // Test 1: List all agents
    console.log('📋 Test 1: Get all agents');
    console.log('=' .repeat(40));
    
    const agentsResponse = await makeCloudTalkRequest('/agents/index.json');
    
    console.log('✅ Success! Response:');
    console.log(JSON.stringify(agentsResponse.data, null, 2));
    
    // Extract some stats
    if (agentsResponse.data && agentsResponse.data.responseData) {
      const responseData = agentsResponse.data.responseData;
      console.log(`\n📊 Summary:`);
      console.log(`   Total agents: ${responseData.itemsCount || 0}`);
      console.log(`   Page: ${responseData.pageNumber || 1}/${responseData.pageCount || 1}`);
      console.log(`   Limit: ${responseData.limit || 0}`);
    }

    console.log('\n' + '='.repeat(50));

    // Test 2: Get agents with limit
    console.log('📋 Test 2: Get agents with limit=5');
    console.log('=' .repeat(40));
    
    const limitedAgentsResponse = await makeCloudTalkRequest('/agents/index.json?limit=5');
    
    console.log('✅ Success! Limited response received');
    if (limitedAgentsResponse.data && limitedAgentsResponse.data.responseData) {
      const responseData = limitedAgentsResponse.data.responseData;
      console.log(`   Returned: ${responseData.data ? responseData.data.length : 0} agents`);
    }

    console.log('\n🎉 All Agents API tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAgentsAPI();
}

export { testAgentsAPI };
