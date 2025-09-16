#!/usr/bin/env node

/**
 * CloudTalk API Test: PUT /agents/add.json
 * 
 * Tests the endpoint for adding new agents to CloudTalk
 * 
 * Required fields:
 * - email: Agent email address
 * - firstname: Agent first name  
 * - lastname: Agent last name
 * - pass: Agent password
 * 
 * Optional fields:
 * - status_outbound: Allow outbound calls (boolean)
 * - daily_price_limit: Daily spending limit
 * - extension: Agent extension number
 * - call_number_id: Default call number ID
 */

import { makeCloudTalkRequest } from '../config.js';
import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '../../.env') });

/**
 * Test data for agent creation
 */
const testCases = [
    {
        name: "Add Agent - Minimal Required Fields",
        data: {
            email: `test.agent.${Date.now()}@example.com`,
            firstname: "TestAgent",
            lastname: "CloudTalkAPI",
            pass: "SecurePass123!"
        },
        expectedStatus: 201,
        description: "Create agent with only required fields"
    },
    {
        name: "Add Agent - Complete Profile",
        data: {
            email: `complete.agent.${Date.now()}@example.com`, 
            firstname: "Complete",
            lastname: "TestAgent",
            pass: "SecurePass456!",
            status_outbound: true,
            daily_price_limit: 50.00,
            extension: "2001",
            call_number_id: 36
        },
        expectedStatus: 201,
        description: "Create agent with all optional fields"
    },
    {
        name: "Add Agent - Invalid Email",
        data: {
            email: "invalid-email",
            firstname: "Invalid",
            lastname: "EmailTest", 
            pass: "SecurePass789!"
        },
        expectedStatus: 406,
        description: "Should reject invalid email format"
    },
    {
        name: "Add Agent - Missing Required Field",
        data: {
            email: `missing.field.${Date.now()}@example.com`,
            firstname: "Missing",
            // lastname missing intentionally
            pass: "SecurePass000!"
        },
        expectedStatus: 406,
        description: "Should reject when required field is missing"
    },
    {
        name: "Add Agent - Duplicate Email", 
        data: {
            email: "duplicate.test@example.com", // Use same email twice
            firstname: "Duplicate",
            lastname: "EmailTest",
            pass: "SecurePass111!"
        },
        expectedStatus: 406,
        description: "Should reject duplicate email address"
    }
];

/**
 * Execute PUT request to add agent
 */
async function addAgent(agentData) {
    try {
        const response = await makeCloudTalkRequest('/agents/add.json', {
            method: 'PUT',
            body: JSON.stringify(agentData)
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
    
    const result = await addAgent(testCase.data);
    
    console.log(`📥 Response Status: ${result.status}`);
    console.log(`📥 Response Data:`, JSON.stringify(result.data, null, 2));
    
    // Validate response
    const statusMatch = result.status === testCase.expectedStatus;
    const success = statusMatch;
    
    if (success) {
        console.log(`✅ Test PASSED - Status: ${result.status}`);
        
        // Log agent ID if created successfully
        if (result.status === 201 && result.data?.responseData?.data?.id) {
            console.log(`👤 Agent ID: ${result.data.responseData.data.id}`);
        }
    } else {
        console.log(`❌ Test FAILED`);
        console.log(`   Expected status: ${testCase.expectedStatus}, Got: ${result.status}`);
    }
    
    return { testCase: testCase.name, success, result };
}

/**
 * Run all test cases
 */
async function runAllTests() {
    console.log('🚀 CloudTalk API Test: PUT /agents/add.json');
    console.log('=' .repeat(50));
    
    const results = [];
    let passed = 0;
    let failed = 0;
    
    // Run the duplicate email test twice to test the duplicate check
    const duplicateTest = testCases.find(t => t.name.includes('Duplicate Email'));
    if (duplicateTest) {
        // First attempt - should succeed
        const firstResult = await runTest({
            ...duplicateTest,
            name: "Add Agent - First Instance (for duplicate test)",
            description: "Create agent for duplicate email test"
        });
        results.push(firstResult);
        if (firstResult.success) passed++; else failed++;
        
        // Second attempt - should fail with duplicate
        const secondResult = await runTest(duplicateTest);
        results.push(secondResult);
        if (secondResult.success) passed++; else failed++;
    }
    
    // Run other tests
    for (const testCase of testCases.filter(t => !t.name.includes('Duplicate Email'))) {
        const result = await runTest(testCase);
        results.push(result);
        
        if (result.success) {
            passed++;
        } else {
            failed++;
        }
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
    
    return results;
}

/**
 * Test with real agent ID retrieval for subsequent tests
 */
async function getLastCreatedAgent() {
    try {
        const response = await makeCloudTalkRequest('/agents/index.json?limit=1&page=1');
        
        if (response.data?.responseData?.data?.length > 0) {
            const agent = response.data.responseData.data[0].Agent;
            console.log(`\n🔍 Last created agent: ID ${agent.id} (${agent.firstname} ${agent.lastname})`);
            return agent.id;
        }
        return null;
    } catch (error) {
        console.error('Error retrieving agents:', error.message);
        return null;
    }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests().then(async (results) => {
        // Optionally get the last created agent for reference
        await getLastCreatedAgent();
        
        process.exit(results.some(r => !r.success) ? 1 : 0);
    }).catch(error => {
        console.error('❌ Test execution failed:', error.message);
        process.exit(1);
    });
}

export { addAgent, runAllTests };
