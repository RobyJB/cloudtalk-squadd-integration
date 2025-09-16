import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Groups GET API
 * Endpoint: GET /groups/index.json
 * 
 * Query Parameters:
 * - limit: Max number of items (1-1000)
 * - page: Page number (min 1)
 */

async function getGroups(params = {}) {
  console.log('👥 CloudTalk - Get Groups');
  console.log('=' .repeat(40));

  // Build query string
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.page) queryParams.append('page', params.page);
  
  const queryString = queryParams.toString();
  const endpoint = `/groups/index.json${queryString ? '?' + queryString : ''}`;

  try {
    const response = await makeCloudTalkRequest(endpoint);
    
    console.log('✅ Success!');
    if (response.data?.responseData) {
      const data = response.data.responseData;
      console.log(`📊 Found ${data.itemsCount} groups (Page ${data.pageNumber}/${data.pageCount})`);
      
      if (data.data && data.data.length > 0) {
        console.log('\n👥 Groups:');
        data.data.forEach((item, index) => {
          const group = item.Group || item.Groups; // API inconsistency handling
          if (group) {
            console.log(`   ${index + 1}. ${group.internal_name} (ID: ${group.id})`);
          }
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
  console.log('🚀 Testing CloudTalk Groups API\n');

  try {
    // Test 1: Get all groups
    console.log('Test 1: All groups');
    await getGroups();

    console.log('\n' + '='.repeat(50));
    
    // Test 2: With limit
    console.log('Test 2: Limited to 5 groups');
    await getGroups({ limit: 5 });

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

export { getGroups };