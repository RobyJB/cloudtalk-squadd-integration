import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Contact Attributes GET API
 * Endpoint: GET /contacts/attributes.json
 * 
 * Description: List all attributes which can be assigned to a contact.
 * 
 * Example API Response Payload:
 * {
 *   "responseData": [
 *     {
 *       "ContactAttribute": {
 *         "id": "123",
 *         "title": "Salary"
 *       }
 *     },
 *     {
 *       "ContactAttribute": {
 *         "id": "124",
 *         "title": "Custom notes"
 *       }
 *     }
 *   ]
 * }
 */

async function getContactAttributes() {
  console.log('🏷️  CloudTalk - Get Contact Attributes');
  console.log('=' .repeat(40));

  const endpoint = '/contacts/attributes.json';

  try {
    const response = await makeCloudTalkRequest(endpoint);
    
    console.log('✅ Success!');
    if (response.data?.responseData && Array.isArray(response.data.responseData)) {
      const attributes = response.data.responseData;
      
      console.log(`\n📊 Found ${attributes.length} contact attributes:`);
      attributes.forEach((item, index) => {
        const attr = item.ContactAttribute;
        if (attr) {
          console.log(`   ${index + 1}. ${attr.title} (ID: ${attr.id})`);
        }
      });
    }
    
    return response.data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test examples
async function runTests() {
  console.log('🚀 Testing CloudTalk Contact Attributes API\n');

  try {
    // Test 1: Get all contact attributes
    console.log('Test 1: Get all contact attributes');
    await getContactAttributes();

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

export { getContactAttributes };