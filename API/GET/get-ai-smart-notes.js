import { CLOUDTALK_CONFIG } from '../config.js';

/**
 * CloudTalk AI Smart Notes GET API
 * Endpoint: GET /ai/calls/{callId}/smart-notes
 * 
 * Server: https://api.cloudtalk.io/v1
 * 
 * Description: Get AI-generated smart notes from a call
 * 
 * Path Parameters:
 * - callId: ID of a call (required)
 * 
 * Example API Response Payload:
 * {
 *   "callId": 12345,
 *   "smart_notes": {
 *     "key_points": [
 *       "Customer interested in upgrading to Expert plan",
 *       "Discussed Parallel Dialer feature availability",
 *       "Customer expressed frustration about plan limitations"
 *     ],
 *     "action_items": [
 *       "Follow up with sales representative",
 *       "Send detailed pricing comparison"
 *     ],
 *     "customer_sentiment": "mixed",
 *     "call_outcome": "follow_up_required"
 *   }
 * }
 */

async function getAISmartNotes(callId) {
  console.log('🤖 CloudTalk AI - Get Smart Notes');
  console.log('=' .repeat(40));

  if (!callId) throw new Error('callId is required');

  const url = `https://api.cloudtalk.io/v1/ai/calls/${callId}/smart-notes`;
  
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

    // Print smart notes analysis
    console.log(`\n🧠 AI Smart Notes for Call ${data.callId || callId}:`);
    
    const notes = data.smart_notes || {};
    
    // Key Points
    if (notes.key_points && notes.key_points.length > 0) {
      console.log(`\n🎯 Key Points:`);
      notes.key_points.forEach((point, index) => {
        console.log(`   ${index + 1}. ${point}`);
      });
    }

    // Action Items
    if (notes.action_items && notes.action_items.length > 0) {
      console.log(`\n✅ Action Items:`);
      notes.action_items.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item}`);
      });
    }

    // Customer Sentiment
    if (notes.customer_sentiment) {
      let emoji = '😐';
      if (notes.customer_sentiment === 'positive') emoji = '😊';
      if (notes.customer_sentiment === 'negative') emoji = '😞';
      if (notes.customer_sentiment === 'mixed') emoji = '😕';
      
      console.log(`\n${emoji} Customer Sentiment: ${notes.customer_sentiment.toUpperCase()}`);
    }

    // Call Outcome
    if (notes.call_outcome) {
      let outcomeIcon = '📋';
      if (notes.call_outcome.includes('success')) outcomeIcon = '✅';
      if (notes.call_outcome.includes('follow')) outcomeIcon = '🔄';
      if (notes.call_outcome.includes('escalate')) outcomeIcon = '⬆️';
      
      console.log(`${outcomeIcon} Call Outcome: ${notes.call_outcome.replace(/_/g, ' ').toUpperCase()}`);
    }

    return data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test examples 
async function runTests() {
  console.log('🚀 Testing CloudTalk AI Smart Notes API\n');
  
  try {
    console.log('Step 1: Testing with known call ID (1001632149)...');
    await getAISmartNotes(1001632149);
    
    console.log('\n🎉 AI Smart Notes test completed successfully!');
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    
    if (error.message.includes('404')) {
      console.log('ℹ️  Note: AI smart notes may not be available for this account or call.');
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getAISmartNotes };