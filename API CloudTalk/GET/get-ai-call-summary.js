import { CLOUDTALK_CONFIG } from '../config.js';

/**
 * CloudTalk AI Call Summary GET API
 * Endpoint: GET /ai/calls/{callId}/summary
 * 
 * Server: https://api.cloudtalk.io/v1
 * 
 * Description: Get AI-generated summary of a call
 * 
 * Path Parameters:
 * - callId: ID of a call (required)
 * 
 * Example API Response Payload:
 * {
 *   "callId": 12345,
 *   "summary": "The customer called to inquire about subscription plans. We discussed the premium features and pricing. Customer expressed interest in upgrading next month."
 * }
 */

async function getAICallSummary(callId) {
  console.log('🤖 CloudTalk AI - Get Call Summary');
  console.log('=' .repeat(40));

  if (!callId) throw new Error('callId is required');

  // Use AI API server instead of default my.cloudtalk.io
  const url = `https://api.cloudtalk.io/v1/ai/calls/${callId}/summary`;
  
  console.log(`🔗 Making request to: ${url}`);
  console.log('📝 Method: GET');
  console.log('🔑 Auth header: Basic ' + Buffer.from(`${CLOUDTALK_CONFIG.apiKeyId}:${CLOUDTALK_CONFIG.apiSecret}`).toString('base64').substring(0, 20) + '...');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${CLOUDTALK_CONFIG.apiKeyId}:${CLOUDTALK_CONFIG.apiSecret}`).toString('base64')}`,
        'Accept': 'application/json',
        'User-Agent': 'CloudTalk-API-Client/1.0'
      }
    });

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Success!');

    // Print a concise summary
    console.log(`\n📄 AI Summary for Call ${data.callId || callId}:`);
    console.log(`📝 ${data.summary || 'No summary available'}`);

    return data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test examples with dependency resolution
async function runTests() {
  console.log('🚀 Testing CloudTalk AI Call Summary API\n');
  
  try {
    // DEPENDENCY: Use known call ID or try to get from calls API
    console.log('Step 1: Testing with known call ID (1001632149)...');
    await getAICallSummary(1001632149);
    
    console.log('\n🎉 AI Call Summary test completed successfully!');
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    
    // AI features may not be available for all accounts
    if (error.message.includes('404')) {
      console.log('ℹ️  Note: AI features may not be available for this account or call.');
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getAICallSummary };