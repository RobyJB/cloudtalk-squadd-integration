import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Notes GET API
 * Endpoint: GET /notes/index.json
 * 
 * Description: List all notes assigned to contacts
 * 
 * Query Parameters:
 * - contact_id: Filter by contact ID
 * - user_id: Filter by agent ID  
 * - keyword: Filter by keyword in note content
 * - limit: Max number of items (1-1000)
 * - page: Page number (min 1)
 * 
 * Example API Response Payload:
 * {
 *   "responseData": {
 *     "itemsCount": 3,
 *     "pageCount": 1,
 *     "pageNumber": 1,
 *     "limit": 3,
 *     "data": [
 *       {
 *         "ContactNote": {
 *           "id": "1234",
 *           "contact_id": "567",
 *           "user_id": "456",
 *           "note": "Note content...",
 *           "created": "2018-05-01T12:12:12.000Z"
 *         }
 *       }
 *     ]
 *   }
 * }
 */

async function getNotes(params = {}) {
  console.log('📝 CloudTalk - Get Notes');
  console.log('=' .repeat(40));

  // Build query string
  const queryParams = new URLSearchParams();
  if (params.contact_id) queryParams.append('contact_id', params.contact_id);
  if (params.user_id) queryParams.append('user_id', params.user_id);
  if (params.keyword) queryParams.append('keyword', params.keyword);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.page) queryParams.append('page', params.page);
  
  const queryString = queryParams.toString();
  const endpoint = `/notes/index.json${queryString ? '?' + queryString : ''}`;

  try {
    const response = await makeCloudTalkRequest(endpoint);
    
    console.log('✅ Success!');
    if (response.data?.responseData) {
      const data = response.data.responseData;
      console.log(`📊 Found ${data.itemsCount} notes (Page ${data.pageNumber}/${data.pageCount})`);
      
      if (data.data && data.data.length > 0) {
        console.log('\n📝 Notes:');
        data.data.forEach((item, index) => {
          const note = item.ContactNote;
          console.log(`   ${index + 1}. Note ID: ${note.id}`);
          console.log(`      👤 Contact: ${note.contact_id}`);
          console.log(`      🧑‍💼 Agent: ${note.user_id}`);
          console.log(`      📝 Note: ${note.note.length > 50 ? note.note.substring(0, 50) + '...' : note.note}`);
          console.log(`      📅 Created: ${note.created}`);
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
  console.log('🚀 Testing CloudTalk Notes API\n');

  try {
    // Test 1: Get all notes
    console.log('Test 1: Get all notes (limit 5)');
    await getNotes({ limit: 5 });

    console.log('\n' + '='.repeat(50));
    
    // Test 2: Search notes by keyword
    console.log('Test 2: Search notes with keyword "call"');
    await getNotes({ keyword: 'call', limit: 3 });

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

export { getNotes };