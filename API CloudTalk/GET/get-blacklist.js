import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Blacklist GET API
 * Endpoint: GET /blacklist/index.json
 * 
 * Description: List blacklisted numbers
 * 
 * Query Parameters:
 * - id: Filter by ID
 * - country_code: Filter by country calling code
 * - type: Filter by type (all, incoming, outgoing)
 * - public_number: Filter by number
 * - limit: Max number of items (1-1000)
 * - page: Page number (min 1)
 * 
 * Example API Response Payload:
 * {
 *   "responseData": {
 *     "itemsCount": 2,
 *     "pageCount": 1,
 *     "pageNumber": 1,
 *     "limit": 2,
 *     "data": [
 *       {
 *         "Blacklist": {
 *           "id": "123",
 *           "public_number": "+421123456789",
 *           "country_code": "421",
 *           "type": "incoming",
 *           "reason": "Spam calls",
 *           "created": "2018-01-01T10:00:00.000Z"
 *         }
 *       }
 *     ]
 *   }
 * }
 */

async function getBlacklist(params = {}) {
  console.log('🚫 CloudTalk - Get Blacklist');
  console.log('=' .repeat(40));

  // Build query string
  const queryParams = new URLSearchParams();
  if (params.id) queryParams.append('id', params.id);
  if (params.country_code) queryParams.append('country_code', params.country_code);
  if (params.type) queryParams.append('type', params.type);
  if (params.public_number) queryParams.append('public_number', params.public_number);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.page) queryParams.append('page', params.page);
  
  const queryString = queryParams.toString();
  const endpoint = `/blacklist/index.json${queryString ? '?' + queryString : ''}`;

  try {
    const response = await makeCloudTalkRequest(endpoint);
    
    console.log('✅ Success!');
    if (response.data?.responseData) {
      const data = response.data.responseData;
      console.log(`📊 Found ${data.itemsCount} blacklisted numbers (Page ${data.pageNumber}/${data.pageCount})`);
      
      if (data.data && data.data.length > 0) {
        console.log('\n🚫 Blacklisted Numbers:');
        data.data.forEach((item, index) => {
          const blacklist = item.Blacklist;
          console.log(`   ${index + 1}. ${blacklist.public_number} (ID: ${blacklist.id})`);
          console.log(`      🌍 Country Code: ${blacklist.country_code}`);
          console.log(`      🏷️  Type: ${blacklist.type}`);
          if (blacklist.reason) console.log(`      📝 Reason: ${blacklist.reason}`);
          console.log(`      📅 Created: ${blacklist.created}`);
        });
      } else {
        console.log('\n✅ No numbers in blacklist');
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
  console.log('🚀 Testing CloudTalk Blacklist API\n');

  try {
    // Test 1: Get all blacklisted numbers
    console.log('Test 1: Get all blacklisted numbers');
    await getBlacklist({ limit: 10 });

    console.log('\n' + '='.repeat(50));
    
    // Test 2: Filter by type
    console.log('Test 2: Get only incoming blacklisted numbers');
    await getBlacklist({ type: 'incoming', limit: 5 });

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

export { getBlacklist };