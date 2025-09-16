import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Activities GET API
 * Endpoint: GET /activity/index.json
 * 
 * Description: List all activities assigned to contacts
 * 
 * Query Parameters:
 * - contact_id: Filter by contact ID
 * - type: Filter by type (check swagger for possible values)
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
 *         "ContactActivity": {
 *           "id": "1234",
 *           "contact_id": "567",
 *           "type": "order",
 *           "name": "Order #201712399",
 *           "description": "Content of order...",
 *           "activity_author": "John Doe",
 *           "external_id": "201712399",
 *           "external_url": "https://www.shopify.com/orders/detail/999",
 *           "activity_date": "2018-02-02T12:12:12.000Z",
 *           "created": "2018-05-01T12:12:12.000Z"
 *         }
 *       }
 *     ]
 *   }
 * }
 */

async function getActivities(params = {}) {
  console.log('📋 CloudTalk - Get Activities');
  console.log('=' .repeat(40));

  // Build query string
  const queryParams = new URLSearchParams();
  if (params.contact_id) queryParams.append('contact_id', params.contact_id);
  if (params.type) queryParams.append('type', params.type);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.page) queryParams.append('page', params.page);
  
  const queryString = queryParams.toString();
  const endpoint = `/activity/index.json${queryString ? '?' + queryString : ''}`;

  try {
    const response = await makeCloudTalkRequest(endpoint);
    
    console.log('✅ Success!');
    if (response.data?.responseData) {
      const data = response.data.responseData;
      console.log(`📊 Found ${data.itemsCount} activities (Page ${data.pageNumber}/${data.pageCount})`);
      
      if (data.data && data.data.length > 0) {
        console.log('\n📋 Activities:');
        data.data.forEach((item, index) => {
          const activity = item.ContactActivity;
          console.log(`   ${index + 1}. ${activity.name} (ID: ${activity.id})`);
          console.log(`      👤 Contact: ${activity.contact_id}`);
          console.log(`      🏷️  Type: ${activity.type}`);
          console.log(`      👨‍💼 Author: ${activity.activity_author}`);
          if (activity.description) {
            const desc = activity.description.length > 50 ? 
              activity.description.substring(0, 50) + '...' : activity.description;
            console.log(`      📝 Description: ${desc}`);
          }
          if (activity.external_url) console.log(`      🔗 URL: ${activity.external_url}`);
          console.log(`      📅 Activity Date: ${activity.activity_date}`);
          console.log(`      🕒 Created: ${activity.created}`);
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
  console.log('🚀 Testing CloudTalk Activities API\n');

  try {
    // Test 1: Get all activities
    console.log('Test 1: Get all activities (limit 5)');
    await getActivities({ limit: 5 });

    console.log('\n' + '='.repeat(50));
    
    // Test 2: Filter by type
    console.log('Test 2: Get activities of type "order"');
    await getActivities({ type: 'order', limit: 3 });

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

export { getActivities };