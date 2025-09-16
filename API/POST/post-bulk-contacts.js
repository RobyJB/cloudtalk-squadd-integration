import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Bulk Contacts POST API
 * Endpoint: POST /bulk/contacts.json
 * 
 * Description: Perform bulk operations on contacts (add, edit, delete)
 * 
 * Request Body:
 * [
 *   {
 *     "action": "add_contact",
 *     "command_id": "add_roberto_001",
 *     "data": {
 *       "name": "Roberto Bondici",
 *       "title": "API Developer",
 *       "company": "CloudTalk Test",
 *       "industry": "Technology",
 *       "ContactNumber": [
 *         { "public_number": "+393513416607" }
 *       ],
 *       "ContactEmail": [
 *         { "email": "roberto.test@cloudtalk.io" }
 *       ]
 *     }
 *   }
 * ]
 * 
 * Example API Response Payload:
 * {
 *   "responseData": {
 *     "status": 200,
 *     "data": [
 *       {
 *         "command_id": "add_roberto_001",
 *         "status": 201,
 *         "data": { "id": "1234567" }
 *       }
 *     ]
 *   }
 * }
 */

async function bulkContacts(operations) {
  console.log('👥 CloudTalk - Bulk Contacts');
  console.log('=' .repeat(40));

  if (!operations || !Array.isArray(operations)) {
    throw new Error('operations array is required');
  }

  const endpoint = '/bulk/contacts.json';
  
  console.log(`📊 Processing ${operations.length} bulk operation(s)`);
  console.log(`📋 Operations:`, JSON.stringify(operations, null, 2));

  try {
    const response = await makeCloudTalkRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(operations)
    });

    console.log('✅ Success!');
    const results = response.data?.responseData?.data || [];
    
    console.log(`📊 Processed ${results.length} operation(s):`);
    
    results.forEach((result, index) => {
      const operation = operations[index];
      console.log(`\n   ${index + 1}. Command: ${result.command_id}`);
      console.log(`      Action: ${operation?.action || 'unknown'}`);
      console.log(`      Status: ${result.status}`);
      
      if (result.status === 201 && result.data?.id) {
        console.log(`      ✅ Created ID: ${result.data.id}`);
      } else if (result.status === 200) {
        console.log(`      ✅ Updated successfully`);
      } else {
        console.log(`      ⚠️  Status: ${result.status}`);
      }
    });

    return response.data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    
    if (error.message.includes('406')) {
      console.log('⚠️  Invalid input data - check operation format');
    }
    
    throw error;
  }
}

// Test runner
async function runTests() {
  console.log('🚀 Testing CloudTalk Bulk Contacts API\n');
  
  try {
    console.log('Step 1: Creating bulk contact operations...');
    
    // Create bulk operations to add Roberto's contact info
    const bulkOperations = [
      {
        action: "add_contact",
        command_id: "add_roberto_priority_001",
        data: {
          name: "Roberto Bondici (Priority Contact)",
          title: "API Developer & Test Contact",
          company: "CloudTalk API Testing",
          industry: "Technology",
          website: "https://cloudtalk.io",
          address: "Italy",
          city: "Rome",
          state: "Lazio",
          country_id: 109, // Italy
          ContactNumber: [
            { public_number: "+393513416607" }
          ],
          ContactEmail: [
            { email: "roberto.priority@cloudtalk.test" }
          ],
          ContactsTag: [
            { name: "Priority" },
            { name: "API Test" }
          ]
        }
      }
    ];
    
    console.log('📞 Adding Roberto (+393513416607) as priority contact...');
    
    await bulkContacts(bulkOperations);
    
    console.log('\n🎉 Bulk Contacts test completed successfully!');
    console.log(`📞 Roberto's contact (+393513416607) added to system`);
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { bulkContacts };