import { CLOUDTALK_CONFIG } from '../config.js';

/**
 * CloudTalk AI Call Details Link GET API
 * Endpoint: GET /ai/calls/{callId}/details-link
 * 
 * Server: https://api.cloudtalk.io/v1
 * 
 * Description: Get a direct link to the call details page in CloudTalk analytics
 * 
 * Path Parameters:
 * - callId: ID of a call (required)
 * 
 * Example API Response Payload:
 * {
 *   "link": "https://analytics.cloudtalk.io/calls/12345/details"
 * }
 */

async function getAICallDetailsLink(callId) {
  console.log('🤖 CloudTalk AI - Get Call Details Link');
  console.log('=' .repeat(40));

  if (!callId) throw new Error('callId is required');

  const url = `https://api.cloudtalk.io/v1/ai/calls/${callId}/details-link`;
  
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

    // Print call details link
    console.log(`\n🔗 Call Details Link for Call ${callId}:`);
    
    if (data.link) {
      console.log(`📄 Link: ${data.link}`);
      console.log(`🌐 You can open this link to view detailed analytics for this call.`);
    } else {
      console.log('❌ No details link available for this call.');
    }

    return data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test examples 
async function runTests() {
  console.log('🚀 Testing CloudTalk AI Call Details Link API\n');
  
  try {
    console.log('Step 1: Testing with known call ID (1001632149)...');
    await getAICallDetailsLink(1001632149);
    
    console.log('\n🎉 AI Call Details Link test completed successfully!');
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    
    if (error.message.includes('404')) {
      console.log('ℹ️  Note: AI call details link may not be available for this account or call.');
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getAICallDetailsLink };