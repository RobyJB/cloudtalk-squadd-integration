import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Tags GET API
 * Endpoint: GET /tags/index.json
 * 
 * Description: List all tags that can be assigned to calls/contacts
 * 
 * Query Parameters:
 * - id: Filter by tag ID (integer)
 * - limit: Max. number of items in response data (1-1000)
 * - page: Number of page to return (minimum 1)
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
 *         "Tag": {
 *           "id": "123",
 *           "name": "VIP Client",
 *           "color": "#FF5733"
 *         }
 *       },
 *       {
 *         "Tag": {
 *           "id": "124",
 *           "name": "Follow Up",
 *           "color": "#33C1FF"
 *         }
 *       }
 *     ]
 *   }
 * }
 */

async function getTags(options = {}) {
  console.log('🏷️  CloudTalk - Get Tags');
  console.log('=' .repeat(40));

  const params = new URLSearchParams();
  if (options.id) params.append('id', options.id);
  if (options.limit) params.append('limit', options.limit);
  if (options.page) params.append('page', options.page);

  const endpoint = `/tags/index.json${params.toString() ? '?' + params.toString() : ''}`;

  try {
    const response = await makeCloudTalkRequest(endpoint);

    console.log('✅ Success!');
    const data = response.data?.responseData?.data || response.data?.data || [];
    const pagination = response.data?.responseData || response.data || {};

    // Print pagination info
    if (pagination.itemsCount !== undefined) {
      console.log(`📊 Found ${pagination.itemsCount} tags (Page ${pagination.pageNumber || 1}/${pagination.pageCount || 1})`);
    } else {
      console.log(`📊 Found ${data.length} tags`);
    }

    // Print tags summary
    console.log(`\n🏷️  Tags:`);
    data.forEach((item, index) => {
      const tag = item.Tag || item;
      console.log(`   ${index + 1}. ${tag.name} (ID: ${tag.id})`);
      if (tag.color) console.log(`      🎨 Color: ${tag.color}`);
    });

    return response.data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test runner
async function runTests() {
  console.log('🚀 Testing CloudTalk Tags API\n');
  
  try {
    console.log('Test 1: Get all tags (limit 10)');
    await getTags({ limit: 10 });

    console.log('\n' + '='.repeat(50));
    console.log('Test 2: Search specific tag ID (if exists)');
    await getTags({ id: 1, limit: 5 });

    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getTags };