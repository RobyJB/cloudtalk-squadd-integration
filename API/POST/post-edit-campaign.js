import { CLOUDTALK_CONFIG } from '../config.js';

/**
 * CloudTalk Campaign Edit POST API
 * Endpoint: POST /campaigns/edit/{campaignId}.json
 * 
 * Description: Edit campaign settings including name, description, status
 * 
 * Request Body:
 * {
 *   "name": "Updated Campaign Name",
 *   "description": "Updated campaign description",
 *   "status": "active", // active, paused, stopped
 *   "priority": 1
 * }
 * 
 * Example API Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 12345,
 *     "name": "Updated Campaign Name",
 *     "status": "active"
 *   }
 * }
 */

async function editCampaign(campaignId, updateData) {
  console.log('📋 CloudTalk - Edit Campaign');
  console.log('=' .repeat(40));

  if (!campaignId) throw new Error('campaignId is required');
  if (!updateData) throw new Error('updateData is required');

  const url = `${CLOUDTALK_CONFIG.baseURL}/campaigns/edit/${campaignId}.json`;
  
  console.log(`📋 Editing campaign: ${campaignId}`);
  console.log(`📝 Update data:`, JSON.stringify(updateData, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${CLOUDTALK_CONFIG.apiKeyId}:${CLOUDTALK_CONFIG.apiSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'CloudTalk-API-Client/1.0'
      },
      body: JSON.stringify(updateData)
    });

    console.log(`🔗 Making request to: ${url}`);
    console.log(`📝 Method: POST`);
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Success!');
    console.log('📋 Updated campaign details:');
    
    if (data.success && data.data) {
      console.log(`🏷️  Campaign ID: ${data.data.id}`);
      console.log(`📝 Name: ${data.data.name || 'Not specified'}`);
      console.log(`📊 Status: ${data.data.status || 'Unknown'}`);
    }

    return data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    
    if (error.message.includes('404')) {
      console.log('⚠️  Campaign not found');
    } else if (error.message.includes('400')) {
      console.log('⚠️  Invalid request data');
    } else if (error.message.includes('403')) {
      console.log('⚠️  No permission to edit this campaign');
    }
    
    throw error;
  }
}

// Test runner
async function runTests() {
  console.log('🚀 Testing CloudTalk Campaign Edit API\n');
  
  try {
    // First, we would need to get a real campaign ID from campaigns list
    console.log('ℹ️  Note: This test requires a real campaign ID');
    console.log('📋 To get campaigns, use: GET /campaigns.json');
    
    // Example campaign update data
    const testCampaignId = 12345; // This should be a real campaign ID
    const updateData = {
      name: `Test Campaign - Updated ${new Date().toISOString().slice(0, 19)}`,
      description: "Updated campaign for Roberto's priority contacts (+393513416607)",
      status: "active",
      priority: 1
    };
    
    console.log('Step 1: Testing campaign edit...');
    console.log('⚠️  This will fail unless campaignId is valid');
    
    try {
      await editCampaign(testCampaignId, updateData);
      console.log('\n🎉 Campaign edit test completed successfully!');
    } catch (error) {
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        console.log('\n✅ Expected result: Campaign not found (test campaign ID)');
        console.log('ℹ️  Use real campaign ID from GET /campaigns.json');
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { editCampaign };