import { makeCloudTalkRequest } from '../config.js';

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

async function getCallDetails(callId) {
  console.log('📞 CloudTalk - Get Call Details');
  console.log('=' .repeat(40));

  if (!callId) throw new Error('callId is required');

  const endpoint = `/calls/${callId}.json`; // Add .json suffix as required by API

  try {
    const response = await makeCloudTalkRequest(endpoint);

    console.log('✅ Success!');
    const data = response.data;

    // Print a concise summary
    console.log(`\n📄 Call ${data?.cdr_id || callId} summary:`);
    if (data?.contact) console.log(`   👤 Contact: ${data.contact.name} (${data.contact.number})`);
    if (data?.internal_number) console.log(`   ☎️  Internal: ${data.internal_number.name} (${data.internal_number.number})`);
    if (data?.direction && data?.status) console.log(`   📊 ${data.direction} | ${data.status}`);
    if (data?.call_times) console.log(`   ⏱️  Total: ${data.call_times.total_time}s (talk ${data.call_times.talking_time}s)`);

    return data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test examples
async function runTests() {
  console.log('🚀 Testing CloudTalk Call Details API\n');
  try {
    // Replace with a valid callId in your environment if needed
    console.log('Test 1: Get call details example (may 404 if ID not found)');
    await getCallDetails(12345);

    console.log('\n🎉 All tests completed (some may 404 if callId not valid).');
  } catch (error) {
    console.error('💥 Tests completed with error (expected if ID invalid):', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getCallDetails };