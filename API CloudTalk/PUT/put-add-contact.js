#!/usr/bin/env node

/**
 * CloudTalk API Test: PUT /contacts/add.json
 * 
 * Tests the endpoint for adding new contacts
 * 
 * Required fields:
 * - name: Contact name (string)
 * 
 * Optional fields:
 * - title, company, industry, website, address, city, zip, state, country_id
 * - favorite_agent, ExternalUrl, ContactNumber, ContactEmail, ContactsTag, ContactAttribute
 */

import { makeCloudTalkRequest } from '../config.js';
import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '../../.env') });

/**
 * Test data for contact creation
 */
const generateTestCases = () => {
    const timestamp = Date.now();
    
    return [
        {
            name: "Add Contact - Minimal Required Fields",
            data: {
                name: `Test Contact ${timestamp}`
            },
            expectedStatus: 201,
            description: "Create contact with only required name field"
        },
        {
            name: "Add Contact - Complete Profile",
            data: {
                name: `Complete Contact ${timestamp}`,
                title: "Mr.",
                company: "Test Company Ltd",
                industry: "technology",
                website: "https://testcompany.example.com",
                address: "123 Test Street",
                city: "New York",
                zip: "10001",
                state: "NY",
                country_id: 201,
                ContactNumber: [
                    {
                        public_number: 15551234000 + Math.floor(timestamp % 1000)
                    }
                ],
                ContactEmail: [
                    {
                        email: `test.contact.${timestamp}@example.com`
                    }
                ],
                ContactsTag: [
                    {
                        name: `test-tag-${timestamp}`
                    }
                ]
            },
            expectedStatus: 201,
            description: "Create contact with full profile information"
        },
        {
            name: "Add Contact - Multiple Phone Numbers",
            data: {
                name: `Multi Phone Contact ${timestamp}`,
                company: "Multi Contact Corp",
                ContactNumber: [
                    {
                        public_number: 15551234000 + Math.floor(timestamp % 1000)
                    },
                    {
                        public_number: 441234567000 + Math.floor(timestamp % 1000)
                    }
                ]
            },
            expectedStatus: 201,
            description: "Create contact with multiple phone numbers"
        },
        {
            name: "Add Contact - Multiple Emails",
            data: {
                name: `Multi Email Contact ${timestamp}`,
                company: "Multi Email Corp", 
                ContactEmail: [
                    {
                        email: `primary.${timestamp}@example.com`
                    },
                    {
                        email: `secondary.${timestamp}@example.com`
                    }
                ]
            },
            expectedStatus: 201,
            description: "Create contact with multiple email addresses"
        },
        {
            name: "Add Contact - Multiple Tags",
            data: {
                name: `Tagged Contact ${timestamp}`,
                ContactsTag: [
                    {
                        name: `tag1-${timestamp}`
                    },
                    {
                        name: `tag2-${timestamp}`
                    },
                    {
                        name: `tag3-${timestamp}`
                    }
                ]
            },
            expectedStatus: 201,
            description: "Create contact with multiple tags"
        },
        {
            name: "Add Contact - External URL",
            data: {
                name: `External Contact ${timestamp}`,
                company: "External Corp",
                ExternalUrl: [
                    {
                        url: `https://external.example.com/contact/${timestamp}`
                    }
                ]
            },
            expectedStatus: 201,
            description: "Create contact with external URL"
        },
        {
            name: "Add Contact - Italian Format",
            data: {
                name: `Contatto Italiano ${timestamp}`,
                company: "Azienda Italiana SRL",
                address: "Via Roma 123",
                city: "Milano",
                zip: "20100",
                country_id: 105, // Italy
                ContactNumber: [
                    {
                        public_number: 393512345000 + Math.floor(timestamp % 1000)
                    }
                ]
            },
            expectedStatus: 201,
            description: "Create Italian contact with local format"
        },
        {
            name: "Add Contact - Missing Name",
            data: {
                company: "No Name Company",
                // name missing intentionally
            },
            expectedStatus: 406,
            description: "Should reject when required name field is missing"
        },
        {
            name: "Add Contact - Empty Name",
            data: {
                name: "",
                company: "Empty Name Company"
            },
            expectedStatus: 406,
            description: "Should reject empty contact name"
        },
        {
            name: "Add Contact - Invalid Email Format",
            data: {
                name: `Invalid Email Contact ${timestamp}`,
                ContactEmail: [
                    {
                        email: "invalid-email-format"
                    }
                ]
            },
            expectedStatus: 406,
            description: "Should reject invalid email format"
        },
        {
            name: "Add Contact - Invalid Country ID",
            data: {
                name: `Invalid Country Contact ${timestamp}`,
                country_id: 999999
            },
            expectedStatus: 406,
            description: "Should reject invalid country ID"
        }
    ];
};

/**
 * Execute PUT request to add contact
 */
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

/**
 * Run individual test case
 */
async function runTest(testCase) {
    console.log(`\n🧪 ${testCase.name}`);
    console.log(`📝 ${testCase.description}`);
    console.log(`📤 Request Data:`, JSON.stringify(testCase.data, null, 2));
    
    const result = await addContact(testCase.data);
    
    console.log(`📥 Response Status: ${result.status}`);
    console.log(`📥 Response Data:`, JSON.stringify(result.data, null, 2));
    
    // Validate response
    const statusMatch = result.status === testCase.expectedStatus;
    const success = statusMatch;
    
    if (success) {
        console.log(`✅ Test PASSED - Status: ${result.status}`);
        
        // Log contact ID if created successfully
        if (result.status === 201 && result.data?.responseData?.data?.id) {
            console.log(`👤 Contact ID: ${result.data.responseData.data.id}`);
            console.log(`📝 Name: ${testCase.data.name}`);
            if (testCase.data.company) {
                console.log(`🏢 Company: ${testCase.data.company}`);
            }
        }
    } else {
        console.log(`❌ Test FAILED`);
        console.log(`   Expected status: ${testCase.expectedStatus}, Got: ${result.status}`);
    }
    
    return { testCase: testCase.name, success, result };
}

/**
 * Get existing contacts count
 */
async function getContactsInfo() {
    try {
        const response = await makeCloudTalkRequest('/contacts/index.json?limit=5');
        
        const data = response.data?.responseData;
        console.log(`👥 Found ${data?.itemsCount || 0} total contacts`);
        
        if (data?.data && data.data.length > 0) {
            console.log('📋 Sample existing contacts:');
            data.data.slice(0, 3).forEach(item => {
                const contact = item.Contact;
                console.log(`   - ${contact.name} (ID: ${contact.id})${contact.company ? ` - ${contact.company}` : ''}`);
            });
        }
        
        return data;
        
    } catch (error) {
        console.error('Error fetching contacts:', error.message);
        return null;
    }
}

/**
 * Run all test cases
 */
async function runAllTests() {
    console.log('🚀 CloudTalk API Test: PUT /contacts/add.json');
    console.log('=' .repeat(50));
    
    // Get existing contacts info
    await getContactsInfo();
    
    const testCases = generateTestCases();
    const results = [];
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
        const result = await runTest(testCase);
        results.push(result);
        
        if (result.success) {
            passed++;
        } else {
            failed++;
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`   - ${r.testCase}`);
        });
    }
    
    // Show created contacts
    const createdContacts = results
        .filter(r => r.success && r.result.status === 201)
        .map(r => ({
            id: r.result.data?.responseData?.data?.id,
            name: r.testCase.replace('Add Contact - ', ''),
            testCase: r.testCase
        }));
    
    if (createdContacts.length > 0) {
        console.log(`\n👥 Successfully Created Contacts: ${createdContacts.length}`);
        createdContacts.forEach(contact => {
            if (contact.id) {
                console.log(`   - ID: ${contact.id} (${contact.name})`);
            }
        });
    }
    
    return results;
}

/**
 * Get last created contact for reference
 */
async function getLastCreatedContact() {
    try {
        const response = await axios.get(`${BASE_URL}/contacts/index.json?limit=1&page=1`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            }
        });
        
        if (response.data?.responseData?.data?.length > 0) {
            const contact = response.data.responseData.data[0].Contact;
            console.log(`\n🔍 Last created contact: ID ${contact.id} - "${contact.name}"`);
            if (contact.company) {
                console.log(`   Company: ${contact.company}`);
            }
            return contact.id;
        }
        return null;
    } catch (error) {
        console.error('Error retrieving last contact:', error.message);
        return null;
    }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests().then(async (results) => {
        // Get the last created contact for reference
        await getLastCreatedContact();
        
        process.exit(results.some(r => !r.success) ? 1 : 0);
    }).catch(error => {
        console.error('❌ Test execution failed:', error.message);
        process.exit(1);
    });
}

export { addContact, runAllTests, getContactsInfo, getLastCreatedContact };