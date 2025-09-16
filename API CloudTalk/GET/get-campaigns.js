import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Campaigns GET API
 * Endpoint: GET /campaigns/index.json
 * 
 * Query Parameters:
 * - id: Filter by campaign ID
 * - limit: Max number of items (1-1000)
 * - page: Page number (min 1)
 */

async function getCampaigns(params = {}) {
  console.log('📞 CloudTalk - Get Campaigns');
  console.log('=' .repeat(40));

  // Build query string
  const queryParams = new URLSearchParams();
  if (params.id) queryParams.append('id', params.id);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.page) queryParams.append('page', params.page);
  
  const queryString = queryParams.toString();
  const endpoint = `/campaigns/index.json${queryString ? '?' + queryString : ''}`;

  try {
    const response = await makeCloudTalkRequest(endpoint);
    
    console.log('✅ Success!');
    if (response.data?.responseData) {
      const data = response.data.responseData;
      console.log(`📊 Found ${data.itemsCount} campaigns (Page ${data.pageNumber}/${data.pageCount})`);
      
      if (data.data && data.data.length > 0) {
        console.log('\n📋 Campaigns:');
        data.data.forEach((item, index) => {
          const campaign = item.Campaign;
          console.log(`   ${index + 1}. ${campaign.name} (ID: ${campaign.id})`);
          console.log(`      📊 Status: ${campaign.status}`);
          console.log(`      ⏱️  Wait time: ${campaign.answer_wait_time}s`);
          console.log(`      🎯 Attempts: ${campaign.attempts}`);
          console.log(`      📹 Recording: ${campaign.is_recording ? 'Yes' : 'No'}`);
          
          if (item.Button && item.Button.length > 0) {
            console.log(`      🎮 Buttons: ${item.Button.map(b => b.title).join(', ')}`);
          }
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
  console.log('🚀 Testing CloudTalk Campaigns API\n');

  try {
    // Test 1: Get all campaigns
    console.log('Test 1: All campaigns');
    await getCampaigns();

    console.log('\n' + '='.repeat(50));
    
    // Test 2: With limit
    console.log('Test 2: Limited to 5 campaigns');
    await getCampaigns({ limit: 5 });

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

export { getCampaigns };