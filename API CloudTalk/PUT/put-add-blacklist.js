#!/usr/bin/env node

/**
 * CloudTalk API Test: PUT /blacklist/add.json
 * 
 * Tests the endpoint for adding numbers to blacklist
 * 
 * Required fields:
 * - public_number: Phone number to blacklist (integer)
 * - type: Blacklist type - "all" (both directions) or "incoming" (incoming only)
 */

import { makeCloudTalkRequest } from '../config.js';
import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '../../.env') });

/**
 * Test data for blacklist creation
 */
const generateTestCases = () => {
    const timestamp = Date.now();
    // Use realistic phone numbers (these might still be rejected by CloudTalk validation)
    const validNumbers = {
        uk: 442071234567,          // UK landline London
        us: 12125551234,           // US number NYC  
        italy: 390612345678,       // Italian landline Rome
        spain: 34911234567         // Spanish landline Madrid
    };
    
    return [
        {
            name: "Add Blacklist - All Directions",
            data: {
                public_number: validNumbers.uk,
                type: "all"
            },
            expectedStatus: 201,
            description: "Block number for all directions (incoming and outgoing)"
        },
        {
            name: "Add Blacklist - Incoming Only",
            data: {
                public_number: validNumbers.us,
                type: "incoming"
            },
            expectedStatus: 201,
            description: "Block number for incoming calls only"
        },
        {
            name: "Add Blacklist - US Number",
            data: {
                public_number: validNumbers.italy,
                type: "all"
            },
            expectedStatus: 201,
            description: "Block US format number"
        },
        {
            name: "Add Blacklist - Italian Number",
            data: {
                public_number: validNumbers.spain,
                type: "incoming"
            },
            expectedStatus: 201,
            description: "Block Italian format number"
        },
        {
            name: "Add Blacklist - Invalid Type",
            data: {
                public_number: 447999999999,
                type: "invalid_type"
            },
            expectedStatus: 406,
            description: "Should reject invalid blacklist type"
        },
        {
            name: "Add Blacklist - Missing Type",
            data: {
                public_number: 447999999998
                // type missing intentionally
            },
            expectedStatus: 406,
            description: "Should reject when type is missing"
        },
        {
            name: "Add Blacklist - Missing Number",
            data: {
                type: "all"
                // public_number missing intentionally
            },
            expectedStatus: 406,
            description: "Should reject when public_number is missing"
        },
        {
            name: "Add Blacklist - Invalid Number Format",
            data: {
                public_number: "not-a-number",
                type: "all"
            },
            expectedStatus: 406,
            description: "Should reject non-numeric phone number"
        },
        {
            name: "Add Blacklist - Too Short Number",
            data: {
                public_number: 123,
                type: "all"
            },
            expectedStatus: 406,
            description: "Should reject too short phone number"
        },
        {
            name: "Add Blacklist - Negative Number",
            data: {
                public_number: -441234567890,
                type: "all"
            },
            expectedStatus: 406,
            description: "Should reject negative phone number"
        },
        {
            name: "Add Blacklist - Duplicate Number",
            data: {
                public_number: 447999999997,
                type: "all"
            },
            expectedStatus: 406,
            description: "Should reject duplicate number (second attempt)"
        }
    ];
};

/**
 * Execute PUT request to add number to blacklist
 */
async function addToBlacklist(blacklistData) {
    try {
        const response = await makeCloudTalkRequest('/blacklist/add.json', {
            method: 'PUT',
            body: JSON.stringify(blacklistData)
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
    
    const result = await addToBlacklist(testCase.data);
    
    console.log(`📥 Response Status: ${result.status}`);
    console.log(`📥 Response Data:`, JSON.stringify(result.data, null, 2));
    
    // Validate response
    const statusMatch = result.status === testCase.expectedStatus;
    const success = statusMatch;
    
    if (success) {
        console.log(`✅ Test PASSED - Status: ${result.status}`);
        
        // Log blacklist ID if created successfully
        if (result.status === 201 && result.data?.responseData?.data?.id) {
            console.log(`🚫 Blacklist ID: ${result.data.responseData.data.id}`);
            console.log(`📞 Number: ${testCase.data.public_number}`);
            console.log(`🔒 Type: ${testCase.data.type}`);
        }
    } else {
        console.log(`❌ Test FAILED`);
        console.log(`   Expected status: ${testCase.expectedStatus}, Got: ${result.status}`);
    }
    
    return { testCase: testCase.name, success, result };
}

/**
 * Get existing blacklist to check current entries
 */
async function getExistingBlacklist() {
    try {
        const response = await makeCloudTalkRequest('/blacklist/index.json?limit=10');
        
        const blacklist = response.data?.responseData?.data || [];
        console.log(`🚫 Found ${blacklist.length} existing blacklisted numbers`);
        
        if (blacklist.length > 0) {
            console.log('📋 Sample blacklisted numbers:');
            blacklist.slice(0, 3).forEach(item => {
                const entry = item.Blacklist;
                console.log(`   - ${entry.public_number} (${entry.type}) [ID: ${entry.id}]`);
            });
        }
        
        return blacklist;
        
    } catch (error) {
        console.error('Error fetching blacklist:', error.message);
        return [];
    }
}

/**
 * Run all test cases
 */
async function runAllTests() {
    console.log('🚀 CloudTalk API Test: PUT /blacklist/add.json');
    console.log('=' .repeat(50));
    
    // Get existing blacklist first
    await getExistingBlacklist();
    
    const testCases = generateTestCases();
    const results = [];
    let passed = 0;
    let failed = 0;
    
    // Run duplicate test first to create the entry
    const duplicateTestIndex = testCases.findIndex(t => t.name.includes('Duplicate'));
    
    if (duplicateTestIndex !== -1) {
        const duplicateTest = testCases[duplicateTestIndex];
        
        // First create the blacklist entry (should succeed)
        const firstResult = await runTest({
            ...duplicateTest,
            name: "Add Blacklist - First Instance (for duplicate test)",
            expectedStatus: 201,
            description: "Create blacklist entry for duplicate test"
        });
        results.push(firstResult);
        if (firstResult.success) passed++; else failed++;
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Then try to create duplicate (should fail)
        const secondResult = await runTest(duplicateTest);
        results.push(secondResult);
        if (secondResult.success) passed++; else failed++;
    }
    
    // Run other tests
    for (const testCase of testCases.filter(t => !t.name.includes('Duplicate'))) {
        const result = await runTest(testCase);
        results.push(result);
        
        if (result.success) {
            passed++;
        } else {
            failed++;
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 400));
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
    
    // Show created blacklist entries
    const createdEntries = results
        .filter(r => r.success && r.result.status === 201)
        .map(r => ({
            id: r.result.data?.responseData?.data?.id,
            testCase: r.testCase
        }));
    
    if (createdEntries.length > 0) {
        console.log(`\n🚫 Successfully Created Blacklist Entries: ${createdEntries.length}`);
        createdEntries.forEach(entry => {
            if (entry.id) {
                console.log(`   - ID: ${entry.id} (${entry.testCase})`);
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

export { addToBlacklist, runAllTests, getExistingBlacklist };