import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Contact Details GET API
 * Endpoint: GET /contacts/show/{contactId}.json
 * 
 * Parameters:
 * - contactId: Contact ID to show (required, path parameter)
 * 
 * Example API Response Payload:
 * {
 *   "responseData": {
 *     "Contact": {
 *       "id": "1234",
 *       "name": "John Doe",
 *       "title": "Dr.",
 *       "company": "Google",
 *       "industry": "it",
 *       "website": "https://www.google.com/",
 *       "address": "First st.",
 *       "city": "New York",
 *       "zip": "11804",
 *       "state": "NY",
 *       "country_id": "1",
 *       "favorite_agent": "123",
 *       "created": "2017-11-11T15:25:42.000Z",
 *       "modified": "2017-04-26T22:57:50.000Z"
 *     },
 *     "ExternalUrl": [
 *       {
 *         "name": "CRM",
 *         "url": "https://cloudtalk.io/c/show/123"
 *       }
 *     ],
 *     "ContactEmail": [
 *       {
 *         "email": "joh.doe@gmail.com"
 *       }
 *     ],
 *     "ContactNumber": [
 *       {
 *         "public_number": 442012345678
 *       }
 *     ],
 *     "ContactsTag": [
 *       {
 *         "name": "vipClients"
 *       },
 *       {
 *         "name": "shopify"
 *       }
 *     ]
 *   }
 * }
 */

async function getContactDetails(contactId) {
  console.log('👤 CloudTalk - Get Contact Details');
  console.log('=' .repeat(40));

  if (!contactId) {
    throw new Error('Contact ID is required');
  }

  const endpoint = `/contacts/show/${contactId}.json`;

  try {
    const response = await makeCloudTalkRequest(endpoint);
    
    console.log('✅ Success!');
    if (response.data?.responseData) {
      const data = response.data.responseData;
      const contact = data.Contact;
      
      console.log(`\n📄 Contact Details:`);
      console.log(`   👤 ${contact.name} (ID: ${contact.id})`);
      if (contact.title) console.log(`   🎯 Title: ${contact.title}`);
      if (contact.company) console.log(`   🏢 Company: ${contact.company}`);
      if (contact.industry) console.log(`   🏭 Industry: ${contact.industry}`);
      if (contact.website) console.log(`   🌐 Website: ${contact.website}`);
      
      if (data.ContactEmail && data.ContactEmail.length > 0) {
        console.log(`   📧 Emails: ${data.ContactEmail.map(e => e.email).join(', ')}`);
      }
      
      if (data.ContactNumber && data.ContactNumber.length > 0) {
        console.log(`   📞 Numbers: ${data.ContactNumber.map(n => n.public_number).join(', ')}`);
      }
      
      if (data.ContactsTag && data.ContactsTag.length > 0) {
        console.log(`   🏷️  Tags: ${data.ContactsTag.map(t => t.name).join(', ')}`);
      }
      
      console.log(`   📅 Created: ${contact.created}`);
      console.log(`   🔄 Modified: ${contact.modified}`);
    }
    
    return response.data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test examples
async function runTests() {
  console.log('🚀 Testing CloudTalk Contact Details API\n');

  try {
    // Test 1: Get contact details (using a test contact ID)
    console.log('Test 1: Get contact details for ID 1431049073');
    await getContactDetails(1431049073);

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

export { getContactDetails };