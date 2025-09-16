import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Edit Contact POST API
 * Endpoint: POST /contacts/edit/{contactId}.json
 * 
 * Description: Edit an existing contact in CloudTalk
 * 
 * Request Body:
 * {
 *   "name": "Roberto Bondici",
 *   "title": "Developer",
 *   "company": "CloudTalk API Testing",
 *   "industry": "Technology",
 *   "website": "https://cloudtalk.io",
 *   "address": "Test Address",
 *   "city": "Rome",
 *   "zip": "00100",
 *   "state": "Lazio",
 *   "country_id": 109,
 *   "ContactNumber": [
 *     { "public_number": "+393513416607" }
 *   ],
 *   "ContactEmail": [
 *     { "email": "test@example.com" }
 *   ]
 * }
 * 
 * Example API Response Payload:
 * {
 *   "responseData": {
 *     "status": 200,
 *     "message": "Contact updated successfully."
 *   }
 * }
 */

async function editContact(contactId, contactData) {
  console.log('👤 CloudTalk - Edit Contact');
  console.log('=' .repeat(40));

  if (!contactId) throw new Error('contactId is required');
  if (!contactData) throw new Error('contactData is required');

  const endpoint = `/contacts/edit/${contactId}.json`;
  
  console.log(`✏️  Editing contact ID: ${contactId}`);
  console.log(`📋 Request body:`, JSON.stringify(contactData, null, 2));

  try {
    const response = await makeCloudTalkRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(contactData)
    });

    console.log('✅ Success!');
    console.log(`👤 Contact ${contactId} updated successfully!`);
    
    if (contactData.name) {
      console.log(`📝 Name: ${contactData.name}`);
    }
    
    if (contactData.ContactNumber && contactData.ContactNumber.length > 0) {
      console.log(`📞 Phone numbers updated:`);
      contactData.ContactNumber.forEach(num => {
        console.log(`   - ${num.public_number}`);
      });
    }

    return response.data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    
    if (error.message.includes('404')) {
      console.log('⚠️  Contact not found');
    } else if (error.message.includes('406')) {
      console.log('⚠️  Invalid input data');
    }
    
    throw error;
  }
}

// Test runner
async function runTests() {
  console.log('🚀 Testing CloudTalk Edit Contact API\n');
  
  try {
    // DEPENDENCY: Get a real contact ID first
    console.log('Step 1: Getting existing contact ID...');
    const { getContacts } = await import('../GET/get-contacts.js');
    const contactsResponse = await getContacts({ limit: 1 });
    
    let contactId = null;
    let existingContact = null;
    
    if (contactsResponse?.responseData?.data?.length > 0) {
      existingContact = contactsResponse.responseData.data[0];
      contactId = existingContact.Contact?.id;
      
      if (contactId) {
        console.log(`✅ Found contact: ${existingContact.Contact.name} (ID: ${contactId})`);
      }
    }
    
    if (!contactId) {
      console.log('❌ No contact found for testing');
      console.log('ℹ️  You may need to create a contact first');
      return;
    }

    console.log('\n' + '='.repeat(50));
    console.log('Step 2: Editing contact with your phone number...');
    
    // Edit contact to include your personal number
    const updatedContactData = {
      name: "Roberto Bondici (API Test)",
      title: "API Developer",
      company: "CloudTalk API Testing",
      industry: "Technology",
      ContactNumber: [
        { public_number: "+393513416607" }
      ],
      ContactEmail: [
        { email: "test.api@example.com" }
      ]
    };
    
    await editContact(contactId, updatedContactData);
    
    console.log('\n🎉 Edit Contact test completed successfully!');
    console.log(`📞 Contact now includes your number: +393513416607`);
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { editContact };