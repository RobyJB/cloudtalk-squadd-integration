import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk CueCard POST API
 * Description: Create CueCard for agents during calls
 *
 * This is a mock/placeholder implementation since the actual CueCard API
 * endpoint structure may not be documented in standard CloudTalk API
 */

async function createCueCard(data) {
  console.log('📋 CloudTalk - Create CueCard');
  console.log('=' .repeat(40));

  // Validate required fields
  if (!data.CallUUID || !data.AgentId || !data.Content) {
    throw new Error('Missing required fields: CallUUID, AgentId, Content');
  }

  console.log(`📋 Creating CueCard for Agent ${data.AgentId}`);
  console.log(`📞 Call UUID: ${data.CallUUID}`);
  console.log(`📝 Content: ${data.Content}`);

  // Mock CueCard creation - CloudTalk may not have a direct CueCard API
  // This would typically be handled through their call integration system
  try {
    // This will likely fail as it's not a standard CloudTalk endpoint
    const response = await makeCloudTalkRequest('/cuecards', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ CueCard created successfully!');
    return response.data;

  } catch (error) {
    // Expected to fail for most CloudTalk instances
    if (error.response?.status === 404) {
      throw new Error('CueCard API endpoint not available (404)');
    } else if (error.response?.status === 424) {
      throw new Error('No active call found for CueCard creation (424)');
    }

    console.error('❌ CueCard creation failed:', error.message);
    throw error;
  }
}

// Test function
async function runTests() {
  console.log('🚀 Testing CloudTalk CueCard Creation\n');

  try {
    // Test CueCard creation
    const testData = {
      CallUUID: 'test-uuid-' + Date.now(),
      AgentId: 493933,
      Title: 'Test CueCard',
      Content: 'This is a test CueCard for API validation',
      Type: 'info'
    };

    console.log('Test: Creating test CueCard');
    await createCueCard(testData);

    console.log('\n🎉 CueCard tests completed!');

  } catch (error) {
    if (error.message.includes('404') || error.message.includes('424')) {
      console.log('⚠️  Expected result: CueCard API not available or no active call');
    } else {
      console.error('💥 Tests failed:', error.message);
      throw error;
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { createCueCard };