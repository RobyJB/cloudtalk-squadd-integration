import { CLOUDTALK_CONFIG } from '../config.js';

/**
 * CloudTalk AI Transcription GET API
 * Endpoint: GET /ai/calls/{callId}/transcription
 * 
 * Server: https://api.cloudtalk.io/v1
 * 
 * Description: Get AI-generated transcription of a call
 * 
 * Path Parameters:
 * - callId: ID of a call (required)
 * 
 * Query Parameters:
 * - limit: Maximum number of transcription entries to return
 * - offset: Number of entries to skip (for pagination)
 * 
 * Example API Response Payload:
 * {
 *   "callId": 12345,
 *   "transcription": [
 *     {
 *       "timestamp": "00:00:05",
 *       "speaker": "agent",
 *       "text": "Hello, thank you for calling CloudTalk support.",
 *       "confidence": 0.95
 *     },
 *     {
 *       "timestamp": "00:00:12",
 *       "speaker": "customer", 
 *       "text": "Hi, I have a question about your pricing plans.",
 *       "confidence": 0.92
 *     }
 *   ],
 *   "total": 45
 * }
 */

async function getAITranscription(callId, options = {}) {
  console.log('🤖 CloudTalk AI - Get Transcription');
  console.log('=' .repeat(40));

  if (!callId) throw new Error('callId is required');

  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit);
  if (options.offset) params.append('offset', options.offset);

  const url = `https://api.cloudtalk.io/v1/ai/calls/${callId}/transcription${params.toString() ? '?' + params.toString() : ''}`;
  
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

    // Print transcription analysis
    console.log(`\n📝 AI Transcription for Call ${data.callId || callId}:`);
    
    const transcription = data.transcription || [];
    if (transcription.length === 0) {
      console.log('📋 No transcription available for this call.');
      return data;
    }

    console.log(`📊 Found ${transcription.length} transcription entries:`);
    
    // Show first few entries as preview
    const previewCount = Math.min(5, transcription.length);
    console.log(`\n📄 Preview (first ${previewCount} entries):`);
    
    transcription.slice(0, previewCount).forEach((entry, index) => {
      const speakerIcon = entry.speaker === 'agent' ? '🏢' : '👤';
      const confidenceText = entry.confidence ? ` (${(entry.confidence * 100).toFixed(0)}%)` : '';
      
      console.log(`\n   ${index + 1}. [${entry.timestamp}] ${speakerIcon} ${entry.speaker?.toUpperCase()}`);
      console.log(`      "${entry.text}"${confidenceText}`);
    });

    if (transcription.length > previewCount) {
      console.log(`\n   ... and ${transcription.length - previewCount} more entries`);
    }

    if (data.total !== undefined) {
      console.log(`\n📈 Total Entries Available: ${data.total}`);
    }

    return data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test examples 
async function runTests() {
  console.log('🚀 Testing CloudTalk AI Transcription API\n');
  
  try {
    console.log('Test 1: Get transcription preview (limit 10)...');
    await getAITranscription(1001632149, { limit: 10 });
    
    console.log('\n🎉 AI Transcription test completed successfully!');
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    
    if (error.message.includes('404')) {
      console.log('ℹ️  Note: AI transcription may not be available for this account or call.');
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getAITranscription };