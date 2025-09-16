import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Group Statistics GET API
 * Endpoint: GET /statistics/realtime/groups.json
 * 
 * Description: Get realtime statistics for call groups
 * 
 * Example API Response Payload:
 * {
 *   "responseData": {
 *     "data": {
 *       "groups": [
 *         {
 *           "name": "Agents",
 *           "id": 123,
 *           "operators": 3,
 *           "answered": 12,
 *           "unanswered": 2,
 *           "abandon_rate": 14.29,
 *           "avg_waiting_time": 48,
 *           "max_waiting_time": 55,
 *           "avg_call_duration": 24,
 *           "real_time": {
 *             "waiting_queue": 2,
 *             "avg_waiting_time": 23,
 *             "max_waiting_time": 53,
 *             "avg_abandonment_time": 12
 *           }
 *         }
 *       ]
 *     }
 *   }
 * }
 */

async function getGroupStatistics() {
  console.log('📊 CloudTalk - Get Group Statistics');
  console.log('=' .repeat(40));

  const endpoint = '/statistics/realtime/groups.json';

  try {
    const response = await makeCloudTalkRequest(endpoint);

    console.log('✅ Success!');
    const data = response.data?.responseData?.data?.groups || response.data?.groups || [];

    // Print statistics summary
    console.log(`\n📈 Found ${data.length} group(s) with statistics:`);
    
    data.forEach((group, index) => {
      console.log(`\n   ${index + 1}. ${group.name} (ID: ${group.id})`);
      console.log(`      👥 Operators: ${group.operators}`);
      console.log(`      ✅ Answered today: ${group.answered}`);
      console.log(`      ❌ Unanswered today: ${group.unanswered}`);
      console.log(`      📉 Abandon rate: ${group.abandon_rate}%`);
      console.log(`      ⏱️  Avg wait: ${group.avg_waiting_time}s | Max wait: ${group.max_waiting_time}s`);
      console.log(`      📞 Avg call duration: ${group.avg_call_duration}s`);
      
      if (group.real_time) {
        console.log(`      🔴 REALTIME - Queue: ${group.real_time.waiting_queue} | Avg wait: ${group.real_time.avg_waiting_time}s`);
      }
    });

    return response.data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test runner
async function runTests() {
  console.log('🚀 Testing CloudTalk Group Statistics API\n');
  
  try {
    console.log('Test: Get realtime group statistics');
    await getGroupStatistics();
    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getGroupStatistics };