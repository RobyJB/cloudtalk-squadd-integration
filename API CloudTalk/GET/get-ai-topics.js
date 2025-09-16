import { CLOUDTALK_CONFIG } from '../config.js';

/**
 * CloudTalk AI Topics GET API
 * Endpoint: GET /ai/calls/{callId}/topics
 * 
 * Server: https://api.cloudtalk.io/v1
 * 
 * Description: Get AI-identified topics discussed in a call
 * 
 * Path Parameters:
 * - callId: ID of a call (required)
 * 
 * Query Parameters:
 * - limit: Maximum number of topics to return
 * - offset: Number of topics to skip (for pagination)
 * 
 * Example API Response Payload:
 * {
 *   "callId": 12345,
 *   "topics": [
 *     {
 *       "label": "Product Features",
 *       "confidence": 0.92,
 *       "talk_ratio": 0.45,
 *       "sentiment": "positive"
 *     },
 *     {
 *       "label": "Pricing Discussion",
 *       "confidence": 0.88,
 *       "talk_ratio": 0.30,
 *       "sentiment": "neutral"
 *     }
 *   ],
 *   "total": 2
 * }
 */

async function getAITopics(callId, options = {}) {
  console.log('🤖 CloudTalk AI - Get Topics');
  console.log('=' .repeat(40));

  if (!callId) throw new Error('callId is required');

  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit);
  if (options.offset) params.append('offset', options.offset);

  const url = `https://api.cloudtalk.io/v1/ai/calls/${callId}/topics${params.toString() ? '?' + params.toString() : ''}`;
  
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

    // Print topics analysis
    console.log(`\n🎯 AI Topics Analysis for Call ${data.callId || callId}:`);
    
    const topics = data.topics || [];
    if (topics.length === 0) {
      console.log('📋 No topics identified in this call.');
      return data;
    }

    console.log(`📊 Found ${topics.length} topic(s):`);
    
    topics.forEach((topic, index) => {
      console.log(`\n   ${index + 1}. ${topic.label}`);
      
      if (topic.confidence !== undefined) {
        console.log(`      🎯 Confidence: ${(topic.confidence * 100).toFixed(1)}%`);
      }
      
      if (topic.talk_ratio !== undefined) {
        console.log(`      💬 Talk Time: ${(topic.talk_ratio * 100).toFixed(1)}%`);
      }
      
      if (topic.sentiment) {
        let emoji = '😐';
        if (topic.sentiment === 'positive') emoji = '😊';
        if (topic.sentiment === 'negative') emoji = '😞';
        console.log(`      ${emoji} Sentiment: ${topic.sentiment}`);
      }
    });

    if (data.total !== undefined) {
      console.log(`\n📈 Total Topics Available: ${data.total}`);
    }

    return data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test examples 
async function runTests() {
  console.log('🚀 Testing CloudTalk AI Topics API\n');
  
  try {
    console.log('Test 1: Get topics with limit...');
    await getAITopics(1001632149, { limit: 10 });
    
    console.log('\n' + '='.repeat(50));
    console.log('Test 2: Get all topics...');
    await getAITopics(1001632149);
    
    console.log('\n🎉 AI Topics test completed successfully!');
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    
    if (error.message.includes('404')) {
      console.log('ℹ️  Note: AI topics analysis may not be available for this account or call.');
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getAITopics };