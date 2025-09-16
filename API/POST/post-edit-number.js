import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Edit Number POST API
 * Endpoint: POST /numbers/edit/{id}.json
 * 
 * Description: Edit a phone number configuration in CloudTalk
 * 
 * Request Body:
 * {
 *   "internal_name": "Roberto Test Line",
 *   "connected_to": 1,
 *   "connected_id": 493933,
 *   "ivr": false,
 *   "recording": true,
 *   "country_code": 39,
 *   "area_code": 351
 * }
 * 
 * Example API Response Payload:
 * {
 *   "responseData": {
 *     "status": 200,
 *     "message": "Number updated successfully."
 *   }
 * }
 */

async function editNumber(numberId, numberData) {
  console.log('📞 CloudTalk - Edit Number');
  console.log('=' .repeat(40));

  if (!numberId) throw new Error('numberId is required');
  if (!numberData) throw new Error('numberData is required');

  const endpoint = `/numbers/edit/${numberId}.json`;
  
  console.log(`✏️  Editing number ID: ${numberId}`);
  console.log(`📋 Request body:`, JSON.stringify(numberData, null, 2));

  try {
    const response = await makeCloudTalkRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(numberData)
    });

    console.log('✅ Success!');
    console.log(`📞 Number ${numberId} updated successfully!`);
    
    if (numberData.internal_name) {
      console.log(`📝 Name: ${numberData.internal_name}`);
    }
    
    if (numberData.connected_to !== undefined) {
      const connectionType = ['Group', 'Agent', 'Conference Room', 'Fax'][numberData.connected_to] || 'Unknown';
      console.log(`🔗 Connected to: ${connectionType} (${numberData.connected_id || 'No ID'})`);
    }
    
    if (numberData.recording !== undefined) {
      console.log(`🎤 Recording: ${numberData.recording ? 'Enabled' : 'Disabled'}`);
    }

    return response.data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    
    if (error.message.includes('404')) {
      console.log('⚠️  Number not found');
    } else if (error.message.includes('406')) {
      console.log('⚠️  Invalid input data');
    }
    
    throw error;
  }
}

// Test runner
async function runTests() {
  console.log('🚀 Testing CloudTalk Edit Number API\n');
  
  try {
    // DEPENDENCY: Get a real number ID first
    console.log('Step 1: Getting existing number ID...');
    const { getNumbers } = await import('../GET/get-numbers.js');
    const numbersResponse = await getNumbers({ limit: 1 });
    
    let numberId = null;
    let existingNumber = null;
    
    if (numbersResponse?.responseData?.data?.length > 0) {
      existingNumber = numbersResponse.responseData.data[0];
      numberId = existingNumber.Number?.id;
      
      if (numberId) {
        console.log(`✅ Found number: ${existingNumber.Number.internal_name || 'Unnamed'} (ID: ${numberId})`);
        console.log(`📞 Number: ${existingNumber.Number.caller_id_e164 || 'No number'}`);
      }
    }
    
    if (!numberId) {
      console.log('❌ No number found for testing');
      console.log('ℹ️  You may need to have a phone number configured first');
      return;
    }

    console.log('\n' + '='.repeat(50));
    console.log('Step 2: Updating number configuration...');
    
    // Update number configuration to be optimized for Roberto's calls
    const updatedNumberData = {
      internal_name: "Roberto Priority Line (+393513416607)",
      recording: true, // Enable recording for calls
      connected_to: 1, // Connect to agent (1 = agent, 0 = group)
      connected_id: 493933 // Roberto's agent ID
    };
    
    await editNumber(numberId, updatedNumberData);
    
    console.log('\n🎉 Edit Number test completed successfully!');
    console.log(`📞 Number configured for priority handling of +393513416607`);
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { editNumber };