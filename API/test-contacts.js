import { makeCloudTalkRequest } from './config.js';

/**
 * Test CloudTalk Contacts API
 * Based on swagger.json endpoints:
 * - GET /contacts/index.json - List contacts
 */

async function testContactsAPI() {
  console.log('👥 Testing CloudTalk Contacts API...\n');

  try {
    // Test 1: List all contacts
    console.log('📋 Test 1: Get all contacts');
    console.log('=' .repeat(40));
    
    const contactsResponse = await makeCloudTalkRequest('/contacts/index.json');
    
    console.log('✅ Success! Response:');
    console.log(JSON.stringify(contactsResponse.data, null, 2));
    
    // Extract some stats
    if (contactsResponse.data && contactsResponse.data.responseData) {
      const responseData = contactsResponse.data.responseData;
      console.log(`\n📊 Summary:`);
      console.log(`   Total contacts: ${responseData.itemsCount || 0}`);
      console.log(`   Page: ${responseData.pageNumber || 1}/${responseData.pageCount || 1}`);
      console.log(`   Limit: ${responseData.limit || 0}`);
    }

    console.log('\n' + '='.repeat(50));

    // Test 2: Get contacts with pagination
    console.log('📋 Test 2: Get contacts with limit=10');
    console.log('=' .repeat(40));
    
    const limitedContactsResponse = await makeCloudTalkRequest('/contacts/index.json?limit=10');
    
    console.log('✅ Success! Limited response received');
    if (limitedContactsResponse.data && limitedContactsResponse.data.responseData) {
      const responseData = limitedContactsResponse.data.responseData;
      console.log(`   Returned: ${responseData.data ? responseData.data.length : 0} contacts`);
      
      // Show first contact example if available
      if (responseData.data && responseData.data.length > 0) {
        console.log(`\n📄 Example contact:`);
        console.log(JSON.stringify(responseData.data[0], null, 2));
      }
    }

    console.log('\n' + '='.repeat(50));

    // Test 3: Search contacts by keyword (if any exist)
    console.log('📋 Test 3: Search contacts by keyword "test"');
    console.log('=' .repeat(40));
    
    const searchResponse = await makeCloudTalkRequest('/contacts/index.json?keyword=test&limit=5');
    
    console.log('✅ Search completed');
    if (searchResponse.data && searchResponse.data.responseData) {
      const responseData = searchResponse.data.responseData;
      console.log(`   Found: ${responseData.itemsCount || 0} contacts matching "test"`);
    }

    console.log('\n🎉 All Contacts API tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testContactsAPI();
}

export { testContactsAPI };
