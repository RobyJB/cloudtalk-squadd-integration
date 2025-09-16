import { makeCloudTalkRequest } from '../config.js';

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
          const call = item.CallSummary || item.Call || item; // Handle different response structures
          const contact = item.Contact;
          const agent = item.Agent;
          
          if (!call) {
            console.log(`   ${index + 1}. Invalid call data:`, item);
            return;
          }
          
          console.log(`   ${index + 1}. Call ID: ${call.id}`);
          console.log(`      📱 ${call.public_external} → ${call.public_internal}`);
          console.log(`      📊 Type: ${call.type} | Status: ${call.status}`);
          console.log(`      ⏱️  Duration: ${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}`);
          console.log(`      💬 Talk Time: ${Math.floor(call.talk_time / 60)}:${(call.talk_time % 60).toString().padStart(2, '0')}`);
          if (contact) {
            console.log(`      👤 Contact: ${contact.name}${contact.company ? ` (${contact.company})` : ''}`);
          }
          if (agent) {
            console.log(`      🧑‍💼 Agent: ${agent.firstname} ${agent.lastname}`);
          }
          if (item.Tags && item.Tags.length > 0) {
            console.log(`      🏷️  Tags: ${item.Tags.map(t => t.name).join(', ')}`);
          }
          console.log(`      📅 Date: ${call.date}`);
        });
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