import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Contacts GET API
 * Endpoint: GET /contacts/index.json
 * 
 * Query Parameters:
 * - country_id: Filter by country ID
 * - tag_id: Filter by tag ID  
 * - industry: Filter by industry
 * - keyword: Filter by keyword
 * - limit: Max number of items (1-1000)
 * - page: Page number (min 1)
 */

async function getContacts(params = {}) {
  console.log('👥 CloudTalk - Get Contacts');
  console.log('=' .repeat(40));

  // Build query string
  const queryParams = new URLSearchParams();
  if (params.country_id) queryParams.append('country_id', params.country_id);
  if (params.tag_id) queryParams.append('tag_id', params.tag_id);
  if (params.industry) queryParams.append('industry', params.industry);
  if (params.keyword) queryParams.append('keyword', params.keyword);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.page) queryParams.append('page', params.page);
  
  const queryString = queryParams.toString();
  const endpoint = `/contacts/index.json${queryString ? '?' + queryString : ''}`;

  try {
    const response = await makeCloudTalkRequest(endpoint);
    
    console.log('✅ Success!');
    if (response.data?.responseData) {
      const data = response.data.responseData;
      console.log(`📊 Found ${data.itemsCount} contacts (Page ${data.pageNumber}/${data.pageCount})`);
      
      if (data.data && data.data.length > 0) {
        console.log('\n📋 Contacts:');
        data.data.forEach((item, index) => {
          const contact = item.Contact;
          console.log(`   ${index + 1}. ${contact.name || 'N/A'} (ID: ${contact.id})`);
          if (contact.company) console.log(`      🏢 ${contact.company}`);
          if (item.ContactEmail) console.log(`      📧 ${item.ContactEmail.email}`);
          if (item.ContactNumber) console.log(`      📞 ${item.ContactNumber.public_number}`);
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
  console.log('🚀 Testing CloudTalk Contacts API\n');

  try {
    // Test 1: Get all contacts
    console.log('Test 1: All contacts (limit 10)');
    await getContacts({ limit: 10 });

    console.log('\n' + '='.repeat(50));
    
    // Test 2: Search by keyword
    console.log('Test 2: Search contacts with keyword "test"');
    await getContacts({ keyword: 'test', limit: 5 });

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

export { getContacts };