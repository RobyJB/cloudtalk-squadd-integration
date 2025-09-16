#!/usr/bin/env node

/**
 * CloudTalk API Test: PUT /activity/add/{contactId}.json
 * 
 * Tests the endpoint for adding activities to existing contacts
 * 
 * Required fields:
 * - contactId: Contact ID (in URL path)
 * - name: Activity name (string)
 * - type: Activity type (enum: order, meeting, call, email, etc.)
 * 
 * Optional fields:
 * - activity_date: Activity date (ISO string)
 * - description: Activity description
 * - activity_author: Author name
 * - external_id: External system ID
 * - external_url: External system URL
 */

import { makeCloudTalkRequest } from '../config.js';
import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '../../.env') });

// Test configuration
// Valid activity types based on CloudTalk API
const ACTIVITY_TYPES = ['order', 'meeting', 'call', 'email', 'demo', 'quote', 'support', 'other'];

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
 * Execute POST request to add activity to contact using bulk API
 */
async function addActivityToContact(contactId, activityData) {
    try {
        // Use bulk contacts API with add_activity action
        const bulkData = [{
            action: "add_activity",
            command_id: `activity-${Date.now()}`,
            data: {
                contact_id: parseInt(contactId),
                name: activityData.name,
                type: activityData.type,
                activity_date: activityData.activity_date || null,
                description: activityData.description || null,
                activity_author: activityData.activity_author || null,
                external_id: activityData.external_id || null,
                external_url: activityData.external_url || null
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
    
    const result = await addActivityToContact(testCase.contactId, testCase.data);
    
    console.log(`📥 Response Status: ${result.status}`);
    console.log(`📥 Response Data:`, JSON.stringify(result.data, null, 2));
    
    // Validate response
    const statusMatch = result.status === testCase.expectedStatus;
    const success = statusMatch;
    
    if (success) {
        console.log(`✅ Test PASSED - Status: ${result.status}`);
        
        // Log activity ID if created successfully
        if (result.status === 200 && result.data?.responseData?.data?.[0]?.status === 201) {
            const activityData = result.data.responseData.data[0];
            console.log(`📅 Activity ID: ${activityData.data.id}`);
            console.log(`📋 Name: "${testCase.data.name}"`);
            console.log(`🏷️  Type: ${testCase.data.type}`);
        }
    } else {
        console.log(`❌ Test FAILED`);
        console.log(`   Expected status: ${testCase.expectedStatus}, Got: ${result.status}`);
    }
    
    return { testCase: testCase.name, success, result };
}

/**
 * Generate test cases with real contact data
 */
async function generateTestCases() {
    const contacts = await getAvailableContacts();
    
    if (contacts.length === 0) {
        console.error('❌ No contacts available for testing');
        return [];
    }
    
    const timestamp = Date.now();
    const now = new Date();
    const futureDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now
    const pastDate = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000)); // 3 days ago
    
    const testCases = [];
    
    // Test with first available contact
    const testContact = contacts[0];
    
    testCases.push({
        name: "Add Activity - Minimal Required Fields",
        contactId: testContact.id,
        data: {
            name: `Basic Test Activity ${timestamp}`,
            type: "meeting"
        },
expectedStatus: 200,
        description: `Add basic activity to contact "${testContact.name}"`
    });
    
    testCases.push({
        name: "Add Activity - Order Type",
        contactId: testContact.id,
        data: {
            name: `Order Activity ${timestamp}`,
            type: "order"
        },
expectedStatus: 200,
        description: "Add order-type activity"
    });
    
    testCases.push({
        name: "Add Activity - Complete Activity",
        contactId: testContact.id,
        data: {
            name: `Complete Activity ${timestamp}`,
            type: "call",
            activity_date: now.toISOString(),
            description: `Complete activity with all optional fields. Created during API testing at ${new Date().toLocaleString()}. This activity includes detailed description.`,
            activity_author: "API Test Suite",
            external_id: timestamp.toString(),
            external_url: `https://external-system.example.com/activity/${timestamp}`
        },
expectedStatus: 200,
        description: "Add activity with all optional fields"
    });
    
    testCases.push({
        name: "Add Activity - Future Date",
        contactId: testContact.id,
        data: {
            name: `Future Meeting ${timestamp}`,
            type: "meeting",
            activity_date: futureDate.toISOString(),
            description: "Scheduled meeting for next week"
        },
expectedStatus: 200,
        description: "Add activity with future date"
    });
    
    testCases.push({
        name: "Add Activity - Past Date",
        contactId: testContact.id,
        data: {
            name: `Past Call ${timestamp}`,
            type: "call",
            activity_date: pastDate.toISOString(),
            description: "Follow-up call from last week"
        },
        expectedStatus: 200,
        description: "Add activity with past date"
    });
    
    testCases.push({
        name: "Add Activity - Email Type",
        contactId: testContact.id,
        data: {
            name: `Email Activity ${timestamp}`,
            type: "email",
            description: "Important email sent to customer",
            activity_author: "Sales Team"
        },
        expectedStatus: 200,
        description: "Add email activity"
    });
    
    testCases.push({
        name: "Add Activity - Demo Type",
        contactId: testContact.id,
        data: {
            name: `Product Demo ${timestamp}`,
            type: "demo",
            activity_date: futureDate.toISOString(),
            description: "Scheduled product demonstration",
            activity_author: "Demo Specialist"
        },
        expectedStatus: 200,
        description: "Add demo activity"
    });
    
    testCases.push({
        name: "Add Activity - Support Ticket",
        contactId: testContact.id,
        data: {
            name: `Support Ticket ${timestamp}`,
            type: "support",
            description: "Customer reported issue with service",
            external_id: `TICKET-${timestamp}`,
            external_url: `https://support.example.com/tickets/${timestamp}`
        },
        expectedStatus: 200,
        description: "Add support activity with external links"
    });
    
    // Test with different contact if available
    if (contacts.length > 1) {
        const secondContact = contacts[1];
        testCases.push({
            name: "Add Activity - Different Contact",
            contactId: secondContact.id,
            data: {
                name: `Activity for ${secondContact.name} - ${timestamp}`,
                type: "quote",
                description: "Quote requested by customer"
            },
            expectedStatus: 200,
            description: `Add activity to different contact "${secondContact.name}"`
        });
    }
    
    // Test different activity types
    const typesToTest = ['order', 'meeting', 'call', 'email', 'other'];
    typesToTest.forEach(activityType => {
        testCases.push({
            name: `Add Activity - Type ${activityType.toUpperCase()}`,
            contactId: testContact.id,
            data: {
                name: `${activityType.charAt(0).toUpperCase() + activityType.slice(1)} Activity ${timestamp}`,
                type: activityType
            },
            expectedStatus: 200,
            description: `Test activity type: ${activityType}`
        });
    });
    
    // Error cases
    testCases.push({
        name: "Add Activity - Missing Name",
        contactId: testContact.id,
        data: {
            type: "meeting"
            // name missing intentionally
        },
        expectedStatus: 406,
        description: "Should reject when name is missing"
    });
    
    testCases.push({
        name: "Add Activity - Missing Type",
        contactId: testContact.id,
        data: {
            name: `No Type Activity ${timestamp}`
            // type missing intentionally
        },
        expectedStatus: 406,
        description: "Should reject when type is missing"
    });
    
    testCases.push({
        name: "Add Activity - Invalid Type",
        contactId: testContact.id,
        data: {
            name: `Invalid Type Activity ${timestamp}`,
            type: "invalid_type"
        },
        expectedStatus: 406,
        description: "Should reject invalid activity type"
    });
    
    testCases.push({
        name: "Add Activity - Empty Name",
        contactId: testContact.id,
        data: {
            name: "",
            type: "meeting"
        },
        expectedStatus: 406,
        description: "Should reject empty activity name"
    });
    
    testCases.push({
        name: "Add Activity - Invalid Date Format",
        contactId: testContact.id,
        data: {
            name: `Invalid Date Activity ${timestamp}`,
            type: "meeting",
            activity_date: "invalid-date-format"
        },
        expectedStatus: 406,
        description: "Should reject invalid date format"
    });
    
    testCases.push({
        name: "Add Activity - Invalid Contact ID",
        contactId: 999999,
        data: {
            name: `Activity for Invalid Contact ${timestamp}`,
            type: "meeting"
        },
        expectedStatus: 404,
        description: "Should reject invalid contact ID"
    });
    
    testCases.push({
        name: "Add Activity - Null Name",
        contactId: testContact.id,
        data: {
            name: null,
            type: "meeting"
        },
        expectedStatus: 406,
        description: "Should reject null activity name"
    });
    
    testCases.push({
        name: "Add Activity - Very Long Description",
        contactId: testContact.id,
        data: {
            name: `Long Description Activity ${timestamp}`,
            type: "other",
            description: "A".repeat(1000) + ` - Created at ${timestamp}` // Very long description
        },
        expectedStatus: 200,
        description: "Test activity with very long description"
    });
    
    return testCases;
}

/**
 * Run all test cases
 */
async function runAllTests() {
    console.log('🚀 CloudTalk API Test: PUT /activity/add/{contactId}.json');
    console.log('=' .repeat(65));
    
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
        await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Summary
    console.log('\n' + '='.repeat(65));
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
    
    // Show created activities by type
    const createdActivities = results
        .filter(r => r.success && r.result.status === 201)
        .map(r => ({
            id: r.result.data?.responseData?.data?.id,
            testCase: r.testCase.replace('Add Activity - ', ''),
            type: r.result.data?.type
        }));
    
    if (createdActivities.length > 0) {
        console.log(`\n📅 Successfully Created Activities: ${createdActivities.length}`);
        
        // Group by activity type
        const byType = {};
        createdActivities.forEach(activity => {
            const type = activity.type || 'unknown';
            byType[type] = (byType[type] || 0) + 1;
        });
        
        console.log('📊 Activities by Type:');
        Object.entries(byType).forEach(([type, count]) => {
            console.log(`   - ${type}: ${count} activities`);
        });
        
        console.log('\n📋 Created Activity IDs:');
        createdActivities.forEach(activity => {
            if (activity.id) {
                console.log(`   - ID: ${activity.id} (${activity.testCase})`);
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

export { addActivityToContact, runAllTests, getAvailableContacts, ACTIVITY_TYPES };