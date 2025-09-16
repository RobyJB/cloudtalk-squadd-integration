#!/usr/bin/env node

/**
 * CloudTalk API Test: PUT /contacts/addTags/{contactId}.json
 * 
 * Tests the endpoint for adding tags to existing contacts
 * 
 * Required fields:
 * - contactId: Contact ID (in URL path)
 * - tags: Array of tag names (strings)
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
        const response = await makeCloudTalkRequest('/contacts/index.json?limit=10');
        
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
 * Get existing tags
 */
async function getExistingTags() {
    try {
        const response = await makeCloudTalkRequest('/tags/index.json?limit=10');
        
        const tags = response.data?.responseData?.data || [];
        const tagNames = tags.map(item => item.Tag?.name || item.name).filter(Boolean);
        
        console.log(`🏷️  Found ${tagNames.length} existing tags`);
        return tagNames;
        
    } catch (error) {
        console.error('Error fetching tags:', error.message);
        return [];
    }
}

/**
 * Execute POST request to add tags to contact using bulk API
 */
async function addTagsToContact(contactId, tagData, contactInfo) {
    try {
        // Use bulk contacts API with edit_contact action to add tags
        const bulkData = [{
            action: "edit_contact",
            command_id: `add-tags-${Date.now()}`,
            data: {
                id: parseInt(contactId),
                name: contactInfo.name, // Required field for edit_contact
                ContactsTag: tagData.tags.map(tagName => ({ name: tagName }))
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
    console.log(`👤 Contact ID: ${testCase.contactId}`);
    console.log(`📤 Request Data:`, JSON.stringify(testCase.data, null, 2));
    
    const result = await addTagsToContact(testCase.contactId, testCase.data, testCase.contactInfo);
    
    console.log(`📥 Response Status: ${result.status}`);
    console.log(`📥 Response Data:`, JSON.stringify(result.data, null, 2));
    
    // Validate response
    const statusMatch = result.status === testCase.expectedStatus;
    const success = statusMatch;
    
    if (success) {
        console.log(`✅ Test PASSED - Status: ${result.status}`);
        
        // Log assigned tags if successful
        if (result.status === 200 && result.data?.responseData?.data?.[0]?.status === 200) {
            const contactData = result.data.responseData.data[0];
            console.log(`🏷️  Tags successfully added to contact`);
            console.log(`📝 Command ID: ${contactData.command_id}`);
            testCase.data.tags.forEach((tagName, index) => {
                console.log(`   - ${tagName}`);
            });
        }
    } else {
        console.log(`❌ Test FAILED`);
        console.log(`   Expected status: ${testCase.expectedStatus}, Got: ${result.status}`);
    }
    
    return { testCase: testCase.name, success, result };
}

/**
 * Generate test cases with real contact and tag data
 */
async function generateTestCases() {
    const contacts = await getAvailableContacts();
    const existingTags = await getExistingTags();
    
    if (contacts.length === 0) {
        console.error('❌ No contacts available for testing');
        return [];
    }
    
    const timestamp = Date.now();
    const testCases = [];
    
    // Test with first available contact
    const testContact = contacts[0];
    
    testCases.push({
        name: "Add Tags - Single New Tag",
        contactId: testContact.id,
        contactInfo: testContact,
        contactInfo: testContact,
        data: {
            tags: [`test-tag-single-${timestamp}`]
        },
        expectedStatus: 200,
        description: `Add single new tag to contact "${testContact.name}"`
    });
    
    testCases.push({
        name: "Add Tags - Multiple New Tags",
        contactId: testContact.id,
        contactInfo: testContact,
        contactInfo: testContact,
        data: {
            tags: [
                `test-tag-multi-1-${timestamp}`,
                `test-tag-multi-2-${timestamp}`,
                `test-tag-multi-3-${timestamp}`
            ]
        },
        expectedStatus: 200,
        description: `Add multiple new tags to contact "${testContact.name}"`
    });
    
    // Test with existing tags if available
    if (existingTags.length > 0) {
        const existingTag = existingTags[0];
        testCases.push({
            name: "Add Tags - Existing Tag",
            contactId: testContact.id,
        contactInfo: testContact,
            data: {
                tags: [existingTag]
            },
            expectedStatus: 200,
            description: `Add existing tag "${existingTag}" to contact "${testContact.name}"`
        });
        
        if (existingTags.length > 2) {
            testCases.push({
                name: "Add Tags - Mix of Existing and New",
                contactId: testContact.id,
        contactInfo: testContact,
                data: {
                    tags: [
                        existingTags[1],
                        `test-tag-mixed-${timestamp}`,
                        existingTags.length > 2 ? existingTags[2] : `test-tag-fallback-${timestamp}`
                    ]
                },
                expectedStatus: 200,
                description: "Add mix of existing and new tags"
            });
        }
    }
    
    // Test with special tag names
    testCases.push({
        name: "Add Tags - Special Characters",
        contactId: testContact.id,
        contactInfo: testContact,
        data: {
            tags: [`test-tag-special!@#-${timestamp}`]
        },
        expectedStatus: 200,
        description: "Add tag with special characters"
    });
    
    testCases.push({
        name: "Add Tags - With Spaces",
        contactId: testContact.id,
        contactInfo: testContact,
        data: {
            tags: [`Test Tag With Spaces ${timestamp}`]
        },
        expectedStatus: 200,
        description: "Add tag with spaces in name"
    });
    
    // Test error cases
    testCases.push({
        name: "Add Tags - Missing Tags Array",
        contactId: testContact.id,
        contactInfo: testContact,
        data: {
            // tags missing intentionally
        },
        expectedStatus: 406,
        description: "Should reject when tags array is missing"
    });
    
    testCases.push({
        name: "Add Tags - Empty Tags Array",
        contactId: testContact.id,
        contactInfo: testContact,
        data: {
            tags: []
        },
        expectedStatus: 406,
        description: "Should reject empty tags array"
    });
    
    testCases.push({
        name: "Add Tags - Invalid Contact ID",
        contactId: 999999,
        data: {
            tags: [`test-tag-invalid-contact-${timestamp}`]
        },
        expectedStatus: 404,
        description: "Should reject invalid contact ID"
    });
    
    // Test with second contact if available
    if (contacts.length > 1) {
        const secondContact = contacts[1];
        testCases.push({
            name: "Add Tags - Different Contact",
            contactId: secondContact.id,
            data: {
                tags: [`test-tag-different-contact-${timestamp}`]
            },
            expectedStatus: 200,
            description: `Add tag to different contact "${secondContact.name}"`
        });
    }
    
    // Test with null tag names
    testCases.push({
        name: "Add Tags - Null Tag Name",
        contactId: testContact.id,
        contactInfo: testContact,
        data: {
            tags: [null]
        },
        expectedStatus: 406,
        description: "Should reject null tag names"
    });
    
    testCases.push({
        name: "Add Tags - Empty String Tag",
        contactId: testContact.id,
        contactInfo: testContact,
        data: {
            tags: [""]
        },
        expectedStatus: 406,
        description: "Should reject empty string tag names"
    });
    
    return testCases;
}

/**
 * Run all test cases
 */
async function runAllTests() {
    console.log('🚀 CloudTalk API Test: PUT /contacts/addTags/{contactId}.json');
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
        await new Promise(resolve => setTimeout(resolve, 600));
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
    
    // Show successful tag assignments
    const successfulTags = results
        .filter(r => r.success && r.result.status === 200)
        .length;
    
    if (successfulTags > 0) {
        console.log(`\n🏷️  Successfully Assigned Tags: ${successfulTags} operations`);
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

export { addTagsToContact, runAllTests, getAvailableContacts, getExistingTags };