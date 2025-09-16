import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Numbers GET API
 * Endpoint: GET /numbers/index.json
 * 
 * Query Parameters:
 * - id: Filter by number ID
 * - country_code: Filter by country calling code
 * - area_code: Filter by local area code (cannot contain 0 at beginning)
 * - connected_to: Filter by route type (0=group, 1=agent, 2=conference room, 3=fax)
 * - is_free: Filter by availability (0=taken, 1=free)
 * - limit: Max number of items (1-1000)
 * - page: Page number (min 1)
 * 
 * Example API Response Payload:
 * {
 *   "responseData": {
 *     "itemsCount": 10,
 *     "pageCount": 1,
 *     "pageNumber": 1,
 *     "limit": 10,
 *     "data": [
 *       {
 *         "Number": {
 *           "id": "123",
 *           "caller_id_e164": "+40312296109",
 *           "country_code": "40",
 *           "area_code": "312",
 *           "internal_name": "Main Office",
 *           "connected_to": 1,
 *           "is_free": 0,
 *           "created": "2018-01-01T10:00:00.000Z"
 *         }
 *       }
 *     ]
 *   }
 * }
 */

async function getNumbers(params = {}) {
  console.log('📞 CloudTalk - Get Numbers');
  console.log('=' .repeat(40));

  // Build query string
  const queryParams = new URLSearchParams();
  if (params.id) queryParams.append('id', params.id);
  if (params.country_code) queryParams.append('country_code', params.country_code);
  if (params.area_code) queryParams.append('area_code', params.area_code);
  if (params.connected_to !== undefined) queryParams.append('connected_to', params.connected_to);
  if (params.is_free !== undefined) queryParams.append('is_free', params.is_free);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.page) queryParams.append('page', params.page);
  
  const queryString = queryParams.toString();
  const endpoint = `/numbers/index.json${queryString ? '?' + queryString : ''}`;

  try {
    const response = await makeCloudTalkRequest(endpoint);
    
    console.log('✅ Success!');
    if (response.data?.responseData) {
      const data = response.data.responseData;
      console.log(`📊 Found ${data.itemsCount} numbers (Page ${data.pageNumber}/${data.pageCount})`);
      
      if (data.data && data.data.length > 0) {
        console.log('\n📞 Numbers:');
        data.data.forEach((item, index) => {
          const number = item.Number || item.CallNumber || item; // Handle different response structures
          const connectionTypes = ['Group', 'Agent', 'Conference Room', 'Fax'];
          const statusTypes = ['Taken', 'Free'];
          
          if (!number) {
            console.log(`   ${index + 1}. Invalid number data:`, item);
            return;
          }
          
          console.log(`   ${index + 1}. ${number.caller_id_e164 || number.number || 'N/A'} (ID: ${number.id})`);
          console.log(`      🏷️  Name: ${number.internal_name || 'N/A'}`);
          console.log(`      🌍 Country Code: ${number.country_code}`);
          console.log(`      📍 Area Code: ${number.area_code}`);
          console.log(`      🔗 Connected to: ${connectionTypes[number.connected_to] || 'Unknown'}`);
          console.log(`      📊 Status: ${statusTypes[number.is_free] || 'Unknown'}`);
          console.log(`      📅 Created: ${number.created}`);
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
  console.log('🚀 Testing CloudTalk Numbers API\n');

  try {
    // Test 1: Get all numbers
    console.log('Test 1: Get all numbers (limit 5)');
    await getNumbers({ limit: 5 });

    console.log('\n' + '='.repeat(50));
    
    // Test 2: Get only free numbers
    console.log('Test 2: Get only free numbers');
    await getNumbers({ is_free: 1, limit: 3 });

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

export { getNumbers };