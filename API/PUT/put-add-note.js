#!/usr/bin/env node

/**
 * CloudTalk API Test: PUT /notes/add/{contactId}.json
 * 
 * Tests the endpoint for adding notes to existing contacts
 * 
 * Required fields:
 * - contactId: Contact ID (in URL path)
 * - note: Note content (string)
 * 
 * Optional fields:
 * - user_id: Agent/user ID who creates the note
 */

import { makeCloudTalkRequest } from '../config.js';
import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '../../.env') });

// Test configuration
/**
 * Get available contacts for testing
 */
async function getAvailableContacts() {
    try {
const response = await makeCloudTalkRequest('/contacts/index.json?limit=5');
        
        const contacts = response.data?.responseData?.data || [];
        console.log(`👥 Found ${contacts.length} available contacts`);
        
        return contacts.map(item => ({
            id: item.Contact?.id,
            name: item.Contact?.name,
            company: item.Contact?.company
        })).filter(c => c.id);
        
    } catch (error) {
        console.error('Error fetching contacts:', error.message);
        return [];
    }
}

/**
 * Get available agents for user_id
 */
async function getAvailableAgents() {
    try {
const response = await makeCloudTalkRequest('/agents/index.json?limit=5');
        
        const agents = response.data?.responseData?.data || [];
        console.log(`👤 Found ${agents.length} available agents`);
        
        return agents.map(item => ({
            id: item.Agent?.id,
            name: `${item.Agent?.firstname} ${item.Agent?.lastname}`,
            email: item.Agent?.email
        })).filter(a => a.id);
        
    } catch (error) {
        console.error('Error fetching agents:', error.message);
        return [];
    }
}

/**
 * Execute POST request to add note to contact using bulk API
 */
async function addNoteToContact(contactId, noteData) {
    try {
        // Use bulk contacts API with add_note action
        const bulkData = [{
            action: "add_note",
            command_id: `note-${Date.now()}`,
            data: {
                contact_id: parseInt(contactId),
                note: noteData.note,
                user_id: noteData.user_id || null
            }
        }];
        
        const response = await makeCloudTalkRequest('/bulk/contacts.json', {
            method: 'POST',
            body: JSON.stringify(bulkData)
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
                   error.message.includes('406') ? 406 : 500,
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
    console.log(`👤 Contact ID: ${testCase.contactId}`);
    console.log(`📤 Request Data:`, JSON.stringify(testCase.data, null, 2));
    
    const result = await addNoteToContact(testCase.contactId, testCase.data);
    
    console.log(`📥 Response Status: ${result.status}`);
    console.log(`📥 Response Data:`, JSON.stringify(result.data, null, 2));
    
    // Validate response
    const statusMatch = result.status === testCase.expectedStatus;
    const success = statusMatch;
    
    if (success) {
        console.log(`✅ Test PASSED - Status: ${result.status}`);
        
        // Log note ID if created successfully
        if (result.status === 200 && result.data?.responseData?.data?.[0]?.status === 201) {
            const noteData = result.data.responseData.data[0];
            console.log(`📋 Note ID: ${noteData.data.id}`);
            console.log(`📝 Content preview: "${testCase.data.note.substring(0, 50)}${testCase.data.note.length > 50 ? '...' : ''}"`);
            console.log(`👤 Contact: ${testCase.contactId} (${noteData.data.contact_name || 'Unknown'})`);
        }
    } else {
        console.log(`❌ Test FAILED`);
        console.log(`   Expected status: ${testCase.expectedStatus}, Got: ${result.status}`);
    }
    
    return { testCase: testCase.name, success, result };
}

/**
 * Generate test cases with real contact and agent data
 */
async function generateTestCases() {
    const contacts = await getAvailableContacts();
    const agents = await getAvailableAgents();
    
    if (contacts.length === 0) {
        console.error('❌ No contacts available for testing');
        return [];
    }
    
    const timestamp = Date.now();
    const testCases = [];
    
    // Test with first available contact
    const testContact = contacts[0];
    
    testCases.push({
        name: "Add Note - Simple Note",
        contactId: testContact.id,
        data: {
            note: `Simple test note created at ${new Date().toISOString()}`
        },
        expectedStatus: 200,
        description: `Add simple note to contact "${testContact.name}"`
    });
    
    testCases.push({
        name: "Add Note - Long Note",
        contactId: testContact.id,
        data: {
            note: `This is a much longer note with more detailed information about the contact. ` +
                  `It contains multiple sentences and various details that might be relevant for future interactions. ` +
                  `Created during API testing at timestamp ${timestamp}. ` +
                  `This note is designed to test the system's ability to handle longer text content.`
        },
        expectedStatus: 200,
        description: "Add long detailed note"
    });
    
    // Test with user_id if agents available
    if (agents.length > 0) {
        testCases.push({
            name: "Add Note - With User ID",
            contactId: testContact.id,
            data: {
                note: `Note created by agent ${agents[0].name} at ${new Date().toISOString()}`,
                user_id: parseInt(agents[0].id)
            },
            expectedStatus: 200,
            description: `Add note with user_id from agent "${agents[0].name}"`
        });
    }
    
    testCases.push({
        name: "Add Note - With Special Characters",
        contactId: testContact.id,
        data: {
            note: `Note with special chars: !@#$%^&*()_+-=[]{}|;':\",./<>? àáâãäèéêë ñç 测试 🚀📝✅❌`
        },
        expectedStatus: 200,
        description: "Add note with special characters and emojis"
    });
    
    testCases.push({
        name: "Add Note - Multiline Note",
        contactId: testContact.id,
        data: {
            note: `Multiline note:\n\nLine 1: Customer called about inquiry\nLine 2: Interested in premium service\nLine 3: Follow up required next week\n\nTimestamp: ${timestamp}`
        },
        expectedStatus: 200,
        description: "Add multiline note with line breaks"
    });
    
    testCases.push({
        name: "Add Note - HTML Content",
        contactId: testContact.id,
        data: {
            note: `<b>Important:</b> Customer mentioned <i>urgent</i> requirement for <u>premium service</u>. Follow up ASAP!`
        },
        expectedStatus: 200,
        description: "Add note with HTML-like content"
    });
    
    // Test with second contact if available
    if (contacts.length > 1) {
        const secondContact = contacts[1];
        testCases.push({
            name: "Add Note - Different Contact",
            contactId: secondContact.id,
            data: {
                note: `Note for different contact: ${secondContact.name} - Created at ${new Date().toISOString()}`
            },
            expectedStatus: 200,
            description: `Add note to different contact "${secondContact.name}"`
        });
    }
    
    // Error cases
    testCases.push({
        name: "Add Note - Missing Note",
        contactId: testContact.id,
        data: {
            // note missing intentionally
        },
        expectedStatus: 406,
        description: "Should reject when note field is missing"
    });
    
    testCases.push({
        name: "Add Note - Empty Note",
        contactId: testContact.id,
        data: {
            note: ""
        },
        expectedStatus: 406,
        description: "Should reject empty note content"
    });
    
    testCases.push({
        name: "Add Note - Null Note",
        contactId: testContact.id,
        data: {
            note: null
        },
        expectedStatus: 406,
        description: "Should reject null note content"
    });
    
    testCases.push({
        name: "Add Note - Invalid Contact ID",
        contactId: 999999,
        data: {
            note: `Note for invalid contact - timestamp ${timestamp}`
        },
        expectedStatus: 404,
        description: "Should reject invalid contact ID"
    });
    
    testCases.push({
        name: "Add Note - Invalid User ID",
        contactId: testContact.id,
        data: {
            note: `Note with invalid user ID - timestamp ${timestamp}`,
            user_id: 999999
        },
        expectedStatus: 406,
        description: "Should reject invalid user_id"
    });
    
    testCases.push({
        name: "Add Note - Whitespace Only",
        contactId: testContact.id,
        data: {
            note: "   \n   \t   \n   "
        },
        expectedStatus: 406,
        description: "Should reject whitespace-only note"
    });
    
    return testCases;
}

/**
 * Run all test cases
 */
async function runAllTests() {
    console.log('🚀 CloudTalk API Test: PUT /notes/add/{contactId}.json');
    console.log('=' .repeat(60));
    
    // Get real data for tests
    const testCases = await generateTestCases();
    
    if (testCases.length === 0) {
        console.error('❌ Cannot run tests - no valid test data available');
        return [];
    }
    
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
        await new Promise(resolve => setTimeout(resolve, 700));
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
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
    
    // Show created notes
    const createdNotes = results
        .filter(r => r.success && r.result.status === 201)
        .map(r => ({
            id: r.result.data?.responseData?.data?.id,
            testCase: r.testCase.replace('Add Note - ', '')
        }));
    
    if (createdNotes.length > 0) {
        console.log(`\n📋 Successfully Created Notes: ${createdNotes.length}`);
        createdNotes.forEach(note => {
            if (note.id) {
                console.log(`   - ID: ${note.id} (${note.testCase})`);
            }
        });
    }
    
    return results;
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests().then((results) => {
        process.exit(results.some(r => !r.success) ? 1 : 0);
    }).catch(error => {
        console.error('❌ Test execution failed:', error.message);
        process.exit(1);
    });
}

export { addNoteToContact, runAllTests, getAvailableContacts, getAvailableAgents };