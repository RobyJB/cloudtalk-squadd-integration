import { makeCloudTalkRequest } from './API CloudTalk/config.js';

async function addContact(contactData) {
    try {
        const response = await makeCloudTalkRequest('/contacts/add.json', {
            method: 'PUT',
            body: JSON.stringify(contactData)
        });

        return {
            success: true,
            status: response.status,
            data: response.data,
            id: response.data?.responseData?.data?.id
        };
    } catch (error) {
        return {
            success: false,
            status: error.message.includes('401') ? 401 :
                   error.message.includes('406') ? 406 :
                   error.message.includes('404') ? 404 : 500,
            data: error.message,
            error: error.message
        };
    }
}

async function testPhoneFormats() {
    console.log('🧪 Testing different phone number formats from your CSV...\n');

    const testCases = [
        {
            name: "Test +393279840759 (raw format)",
            phone: "+393279840759"
        },
        {
            name: "Test 393279840759 (without +)",
            phone: "393279840759"
        },
        {
            name: "Test as integer 393279840759",
            phone: 393279840759
        },
        {
            name: "Test longer format like in working examples",
            phone: 393279840000  // Similar to working examples
        }
    ];

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`📞 Test ${i + 1}: ${testCase.name}`);

        const contactData = {
            name: `Phone Test ${Date.now()}_${i}`,
            ContactNumber: [{
                public_number: testCase.phone
            }]
        };

        console.log(`📋 Data:`, JSON.stringify(contactData, null, 2));

        const result = await addContact(contactData);

        if (result.success) {
            console.log(`   ✅ SUCCESS! Contact ID: ${result.id}`);
        } else {
            console.log(`   ❌ FAILED: ${result.error}`);
        }

        console.log(''); // Empty line
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

testPhoneFormats().catch(console.error);