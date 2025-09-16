import { makeCloudTalkRequest } from '../config.js';
import { processSingleCallRecording } from '../recording-integration.js';

/**
 * CloudTalk Call Details GET API
 * Endpoint: GET /calls/{callId}
 * 
 * Servers: https://analytics-api.cloudtalk.io/api/
 * 
 * Description: Comprehensive information about a call and its flow
 * 
 * Path Parameters:
 * - callId: ID of a call (required)
 * 
 * Example API Response Payload (truncated):
 * {
 *   "cdr_id": 12345,
 *   "uuid": "aaaa-bbbb-cccc-dddd",
 *   "company_id": 100123,
 *   "date": "2022-02-07T13:00:00.000Z",
 *   "contact": { "id": 1, "name": "John Doe", "country": "CZ", "number": "+420123123123" },
 *   "call_tags": [{ "id": 5, "label": "Lead" }],
 *   "call_rating": 3,
 *   "internal_number": { "id": 1, "name": "Europe Sales", "number": "+421456456456" },
 *   "call_times": { "talking_time": 60, "wrap_up_time": 10, "ringing_time": 10, "total_time": 80, "waiting_time": 20 },
 *   "direction": "incoming",
 *   "type": "regular",
 *   "status": "answered",
 *   "call_steps": [ { "type": "ivr", "id": 1, "date": "2022-02-07T13:00:00.000Z", "total_time": 10, "option": "1" } ]
 * }
 */

async function getCallDetails(callId, params = {}) {
  console.log('📞 CloudTalk - Get Call Details');
  console.log('=' .repeat(40));

  if (!callId) throw new Error('callId is required');

  // Check if auto-recording download is enabled (disabled by default)
  const autoDownloadRecording = params.auto_download_recording === true;

  // Use analytics API server instead of default my.cloudtalk.io
  const url = `https://analytics-api.cloudtalk.io/api/calls/${callId}`;
  const { CLOUDTALK_CONFIG } = await import('../config.js');
  
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
    console.log(`\n📄 Call ${data?.cdr_id || callId} summary:`);
    if (data?.contact) console.log(`   👤 Contact: ${data.contact.name} (${data.contact.number})`);
    if (data?.internal_number) console.log(`   ☎️  Internal: ${data.internal_number.name} (${data.internal_number.number})`);
    if (data?.direction && data?.status) console.log(`   📊 ${data.direction} | ${data.status}`);
    if (data?.call_times) console.log(`   ⏱️  Total: ${data.call_times.total_time}s (talk ${data.call_times.talking_time}s)`);

    // Auto-download recording if enabled and call has recording
    if (autoDownloadRecording && data?.recorded === true) {
      console.log('\n🎵 Auto-downloading call recording...');
      try {
        const callMetadata = {
          duration: data.call_times?.talking_time,
          agent_name: data.call_steps?.find(step => step.type === 'agent')?.name,
          phone_from: data.contact?.number,
          phone_to: data.internal_number?.number,
          call_type: data.direction,
          started_at: data.date,
          contact_name: data.contact?.name,
          rating: data.call_rating
        };

        const recordingResult = await processSingleCallRecording(callId, callMetadata);

        if (recordingResult.success) {
          if (recordingResult.already_exists) {
            console.log('⏭️  Recording already exists in database');
          } else {
            console.log(`✅ Recording downloaded and saved (${recordingResult.data?.file_size || 'unknown'} bytes)`);
          }
        } else {
          console.log(`⚠️  Failed to download recording: ${recordingResult.error}`);
        }
      } catch (error) {
        console.error('⚠️  Recording auto-download failed:', error.message);
        // Don't throw - let the main function continue
      }
    }

    return data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test examples with dependency resolution
async function runTests() {
  console.log('🚀 Testing CloudTalk Call Details API\n');
  
  try {
    // DEPENDENCY: First get a real call ID from calls API (using analytics server)
    console.log('Step 1: Getting real call ID from analytics calls API...');
    const { CLOUDTALK_CONFIG } = await import('../config.js');
    
    // Try to get calls list from analytics API
    const callsUrl = 'https://analytics-api.cloudtalk.io/api/calls?limit=1';
    const callsResponse = await fetch(callsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${CLOUDTALK_CONFIG.apiKeyId}:${CLOUDTALK_CONFIG.apiSecret}`).toString('base64')}`,
        'Accept': 'application/json'
      }
    });
    
    if (callsResponse.ok) {
      const callsData = await callsResponse.json();
      
      if (callsData && callsData.length > 0) {
        // Extract real call ID from first call
        const firstCall = callsData[0];
        const realCallId = firstCall.cdr_id || firstCall.id;
        
        if (realCallId) {
          console.log(`✅ Found real call ID: ${realCallId}\n`);
          
          console.log('Step 2: Testing call details with real ID...');
          await getCallDetails(realCallId);
          console.log('\n🎉 Call Details test completed successfully!');
        } else {
          console.log('⚠️  Could not extract call ID from call data');
          console.log('Raw call data:', JSON.stringify(firstCall, null, 2));
          throw new Error('No valid call ID found in calls data');
        }
      } else {
        console.log('⚠️  No calls found in account');
        console.log('Testing with known call ID (1001632149)...');
        await getCallDetails(1001632149);
      }
    } else {
      console.log('⚠️  Could not retrieve calls list, testing with known call ID...');
      await getCallDetails(1001632149);
    }
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getCallDetails };