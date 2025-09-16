import { makeCloudTalkRequest } from './config.js';

/**
 * Test CloudTalk Campaigns API
 * Based on swagger.json endpoints:
 * - GET /campaigns/index.json - List campaigns
 */

async function testCampaignsAPI() {
  console.log('📞 Testing CloudTalk Campaigns API...\n');

  try {
    // Test 1: List all campaigns
    console.log('📋 Test 1: Get all campaigns');
    console.log('=' .repeat(40));
    
    const campaignsResponse = await makeCloudTalkRequest('/campaigns/index.json');
    
    console.log('✅ Success! Response:');
    console.log(JSON.stringify(campaignsResponse.data, null, 2));
    
    // Extract some stats
    if (campaignsResponse.data && campaignsResponse.data.responseData) {
      const responseData = campaignsResponse.data.responseData;
      console.log(`\n📊 Summary:`);
      console.log(`   Total campaigns: ${responseData.itemsCount || 0}`);
      console.log(`   Page: ${responseData.pageNumber || 1}/${responseData.pageCount || 1}`);
      console.log(`   Limit: ${responseData.limit || 0}`);
      
      // Show campaign details if available
      if (responseData.data && responseData.data.length > 0) {
        console.log(`\n📋 Campaigns overview:`);
        responseData.data.forEach((item, index) => {
          const campaign = item.Campaign;
          if (campaign) {
            console.log(`   ${index + 1}. ${campaign.name} (ID: ${campaign.id}) - Status: ${campaign.status}`);
          }
        });
      }
    }

    console.log('\n' + '='.repeat(50));

    // Test 2: Get campaigns with pagination
    console.log('📋 Test 2: Get campaigns with limit=5');
    console.log('=' .repeat(40));
    
    const limitedCampaignsResponse = await makeCloudTalkRequest('/campaigns/index.json?limit=5');
    
    console.log('✅ Success! Limited response received');
    if (limitedCampaignsResponse.data && limitedCampaignsResponse.data.responseData) {
      const responseData = limitedCampaignsResponse.data.responseData;
      console.log(`   Returned: ${responseData.data ? responseData.data.length : 0} campaigns`);
    }

    console.log('\n🎉 All Campaigns API tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCampaignsAPI();
}

export { testCampaignsAPI };
