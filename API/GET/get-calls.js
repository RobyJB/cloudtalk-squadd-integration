import { makeCloudTalkRequest } from '../config.js';
import { processCallRecordings } from '../recording-integration.js';

/**
 * CloudTalk Calls GET API
 * Endpoint: GET /calls/index.json
 * 
 * Description: Call history
 * 
 * Query Parameters:
 * - public_internal: Filter by internal number of agent
 * - public_external: Filter by number of caller
 * - date_from: Filter by date from (e.g. 2017-12-24 12:22:00)
 * - date_to: Filter by date to (e.g. 2017-12-24 12:22:00)
 * - contact_id: Filter by assigned contact ID
 * - user_id: Filter by assigned agent ID
 * - agent_extension: Filter by assigned agent's extension
 * - type: Filter by call type (incoming, outgoing, internal)
 * - status: Filter by call status (missed, answered)
 * - tag_id: Filter by assigned call tag ID
 * - call_id: Filter by call ID
 * - limit: Max number of items (1-1000)
 * - page: Page number (min 1)
 * 
 * Example API Response Payload:
 * {
 *   "responseData": {
 *     "itemsCount": 100,
 *     "pageCount": 5,
 *     "pageNumber": 1,
 *     "limit": 20,
 *     "data": [
 *       {
 *         "CallSummary": {
 *           "id": "12345",
 *           "uuid": "abc-def-ghi",
 *           "type": "incoming",
 *           "status": "answered",
 *           "public_external": "+421123456789",
 *           "public_internal": "1001",
 *           "date": "2018-05-01T12:12:12.000Z",
 *           "duration": 180,
 *           "talk_time": 120,
 *           "wait_time": 15
 *         },
 *         "Contact": {
 *           "id": "1234",
 *           "name": "John Doe",
 *           "company": "Example Corp"
 *         },
 *         "Agent": {
 *           "id": "456",
 *           "firstname": "Jane",
 *           "lastname": "Smith",
 *           "email": "jane.smith@example.com"
 *         },
 *         "Tags": [
 *           {
 *             "id": "123",
 *             "name": "Sales"
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * }
 */

async function getCalls(params = {}) {
  console.log('📞 CloudTalk - Get Calls');
  console.log('=' .repeat(40));

  // Check if auto-recording download is enabled (disabled by default)
  const autoDownloadRecordings = params.auto_download_recordings === true;

  // Build query string
  const queryParams = new URLSearchParams();
  if (params.public_internal) queryParams.append('public_internal', params.public_internal);
  if (params.public_external) queryParams.append('public_external', params.public_external);
  if (params.date_from) queryParams.append('date_from', params.date_from);
  if (params.date_to) queryParams.append('date_to', params.date_to);
  if (params.contact_id) queryParams.append('contact_id', params.contact_id);
  if (params.user_id) queryParams.append('user_id', params.user_id);
  if (params.agent_extension) queryParams.append('agent_extension', params.agent_extension);
  if (params.type) queryParams.append('type', params.type);
  if (params.status) queryParams.append('status', params.status);
  if (params.tag_id) queryParams.append('tag_id', params.tag_id);
  if (params.call_id) queryParams.append('call_id', params.call_id);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.page) queryParams.append('page', params.page);
  
  const queryString = queryParams.toString();
  const endpoint = `/calls/index.json${queryString ? '?' + queryString : ''}`;

  try {
    const response = await makeCloudTalkRequest(endpoint);
    
    console.log('✅ Success!');
    if (response.data?.responseData) {
      const data = response.data.responseData;
      console.log(`📊 Found ${data.itemsCount} calls (Page ${data.pageNumber}/${data.pageCount})`);
      
      if (data.data && data.data.length > 0) {
        console.log('\n📞 Recent Calls:');
        data.data.forEach((item, index) => {
          const call = item.Cdr || item.CallSummary || item.Call || item; // CloudTalk uses Cdr structure
          const contact = item.Contact;
          const agent = item.Agent;
          
          if (!call) {
            console.log(`   ${index + 1}. Invalid call data:`, item);
            return;
          }
          
          console.log(`   ${index + 1}. Call ID: ${call.id}`);
          console.log(`      📱 ${call.public_external} → ${call.public_internal}`);
          console.log(`      📊 Type: ${call.type} | Duration: ${Math.floor(call.billsec / 60)}:${(call.billsec % 60).toString().padStart(2, '0')}`);
          console.log(`      💬 Talk Time: ${Math.floor(call.talking_time / 60)}:${(call.talking_time % 60).toString().padStart(2, '0')}`);
          if (contact) {
            console.log(`      👤 Contact: ${contact.name}${contact.company ? ` (${contact.company})` : ''}`);
          }
          if (agent) {
            console.log(`      🧑‍💼 Agent: ${agent.firstname} ${agent.lastname}`);
          }
          if (item.Tags && item.Tags.length > 0) {
            console.log(`      🏷️  Tags: ${item.Tags.map(t => t.name).join(', ')}`);
          }
          console.log(`      📅 Started: ${call.started_at}`);
          if (call.recorded) console.log(`      🎤 Recorded: Yes`);
          console.log(`      ⏱️  Wait time: ${call.waiting_time}s`);
        });
      }
    }

    // Auto-download recordings if enabled and calls have recordings
    if (autoDownloadRecordings && response.data?.responseData?.data) {
      const calls = response.data.responseData.data;
      const callsWithRecordings = calls.filter(call => {
        const callData = call.Cdr || call.CallSummary || call.Call || call;
        return callData?.recorded === true;
      });

      if (callsWithRecordings.length > 0) {
        console.log(`\n🎵 Auto-downloading ${callsWithRecordings.length} recordings...`);
        try {
          const recordingStats = await processCallRecordings(callsWithRecordings, { verbose: false });

          if (recordingStats.downloaded > 0) {
            console.log(`✅ Downloaded ${recordingStats.downloaded} new recordings`);
          }
          if (recordingStats.skipped > 0) {
            console.log(`⏭️  Skipped ${recordingStats.skipped} existing recordings`);
          }
          if (recordingStats.errors > 0) {
            console.log(`❌ Failed to download ${recordingStats.errors} recordings`);
          }
        } catch (error) {
          console.error('⚠️  Recording auto-download failed:', error.message);
          // Don't throw - let the main function continue
        }
      }
    }

    return response.data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test examples
async function runTests() {
  console.log('🚀 Testing CloudTalk Calls API\n');

  try {
    // Test 1: Get recent calls
    console.log('Test 1: Get recent calls (limit 5)');
    await getCalls({ limit: 5 });

    console.log('\n' + '='.repeat(50));
    
    // Test 2: Get only incoming calls
    console.log('Test 2: Get only incoming calls');
    await getCalls({ type: 'incoming', limit: 3 });

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getCalls };