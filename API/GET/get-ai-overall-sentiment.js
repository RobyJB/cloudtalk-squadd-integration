import { CLOUDTALK_CONFIG } from '../config.js';

/**
 * CloudTalk AI Overall Sentiment GET API
 * Endpoint: GET /ai/calls/{callId}/overall-sentiment
 * 
 * Server: https://api.cloudtalk.io/v1
 * 
 * Description: Get AI-analyzed overall sentiment of a call
 * 
 * Path Parameters:
 * - callId: ID of a call (required)
 * 
 * Example API Response Payload:
 * {
 *   "callId": 12345,
 *   "overall_sentiment": "positive",
 *   "confidence": 0.89,
 *   "sentiment_score": 0.75,
 *   "details": {
 *     "positive": 0.65,
 *     "neutral": 0.25,
 *     "negative": 0.10
 *   }
 * }
 */

async function getAIOverallSentiment(callId) {
  console.log('🤖 CloudTalk AI - Get Overall Sentiment');
  console.log('=' .repeat(40));

  if (!callId) throw new Error('callId is required');

  // Use AI API server instead of default my.cloudtalk.io
  const url = `https://api.cloudtalk.io/v1/ai/calls/${callId}/overall-sentiment`;
  
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

    // Print sentiment analysis
    console.log(`\n📊 AI Sentiment Analysis for Call ${data.callId || callId}:`);
    
    if (data.overall_sentiment) {
      let emoji = '😐';
      if (data.overall_sentiment === 'positive') emoji = '😊';
      if (data.overall_sentiment === 'negative') emoji = '😞';
      
      console.log(`${emoji} Overall Sentiment: ${data.overall_sentiment.toUpperCase()}`);
    }
    
    if (data.confidence !== undefined) {
      console.log(`🎯 Confidence: ${(data.confidence * 100).toFixed(1)}%`);
    }
    
    if (data.sentiment_score !== undefined) {
      console.log(`📈 Sentiment Score: ${data.sentiment_score.toFixed(2)}`);
    }

    if (data.details) {
      console.log(`📋 Breakdown:`);
      console.log(`   😊 Positive: ${(data.details.positive * 100).toFixed(1)}%`);
      console.log(`   😐 Neutral:  ${(data.details.neutral * 100).toFixed(1)}%`);
      console.log(`   😞 Negative: ${(data.details.negative * 100).toFixed(1)}%`);
    }

    return data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test examples 
async function runTests() {
  console.log('🚀 Testing CloudTalk AI Overall Sentiment API\n');
  
  try {
    // DEPENDENCY: Use known call ID 
    console.log('Step 1: Testing with known call ID (1001632149)...');
    await getAIOverallSentiment(1001632149);
    
    console.log('\n🎉 AI Overall Sentiment test completed successfully!');
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    
    // AI features may not be available for all accounts
    if (error.message.includes('404')) {
      console.log('ℹ️  Note: AI sentiment analysis may not be available for this account or call.');
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getAIOverallSentiment };