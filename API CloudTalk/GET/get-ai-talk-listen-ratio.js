import { CLOUDTALK_CONFIG } from '../config.js';

/**
 * CloudTalk AI Talk-Listen Ratio GET API
 * Endpoint: GET /ai/calls/{callId}/talk-listen-ratio
 * 
 * Server: https://api.cloudtalk.io/v1
 * 
 * Description: Get AI-analyzed talk-listen ratio of a call
 * 
 * Path Parameters:
 * - callId: ID of a call (required)
 * 
 * Example API Response Payload:
 * {
 *   "callId": 12345,
 *   "talk_ratio": 0.65,
 *   "listen_ratio": 0.35,
 *   "total_talk_time": 180,
 *   "total_listen_time": 120,
 *   "analysis": "Agent dominated the conversation with 65% talk time."
 * }
 */

async function getAITalkListenRatio(callId) {
  console.log('🤖 CloudTalk AI - Get Talk-Listen Ratio');
  console.log('=' .repeat(40));

  if (!callId) throw new Error('callId is required');

  const url = `https://api.cloudtalk.io/v1/ai/calls/${callId}/talk-listen-ratio`;
  
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

    // Print talk-listen analysis
    console.log(`\n🗣️  AI Talk-Listen Ratio for Call ${data.callId || callId}:`);
    
    if (data.talk_ratio !== undefined) {
      console.log(`💬 Talk Ratio: ${(data.talk_ratio * 100).toFixed(1)}%`);
    }
    
    if (data.listen_ratio !== undefined) {
      console.log(`👂 Listen Ratio: ${(data.listen_ratio * 100).toFixed(1)}%`);
    }
    
    if (data.total_talk_time !== undefined) {
      console.log(`⏱️  Talk Time: ${data.total_talk_time}s`);
    }
    
    if (data.total_listen_time !== undefined) {
      console.log(`⏱️  Listen Time: ${data.total_listen_time}s`);
    }

    if (data.analysis) {
      console.log(`🔍 Analysis: ${data.analysis}`);
    }

    return data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test examples 
async function runTests() {
  console.log('🚀 Testing CloudTalk AI Talk-Listen Ratio API\n');
  
  try {
    console.log('Step 1: Testing with known call ID (1001632149)...');
    await getAITalkListenRatio(1001632149);
    
    console.log('\n🎉 AI Talk-Listen Ratio test completed successfully!');
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    
    if (error.message.includes('404')) {
      console.log('ℹ️  Note: AI talk-listen ratio may not be available for this account or call.');
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getAITalkListenRatio };