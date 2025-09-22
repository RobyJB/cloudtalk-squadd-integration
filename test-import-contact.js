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
            data: response.data
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

async function testContactImport() {
    console.log('🧪 Testing CloudTalk contact import...\n');

    const timestamp = Date.now();

    // Test contact data - minimal version without phone number
    const testContact = {
        name: `Test Import ${timestamp}`,
        company: "Test Company",
        ContactEmail: [
            {
                email: `test.import.${timestamp}@example.com`
            }
        ]
    };

    console.log('📋 Creating contact with data:', JSON.stringify(testContact, null, 2));

    const result = await addContact(testContact);

    console.log('\n📊 Result:', JSON.stringify(result, null, 2));

    if (result.success) {
        console.log('✅ Contact creation successful!');
    } else {
        console.log('❌ Contact creation failed:', result.error);
    }
}

testContactImport().catch(console.error);