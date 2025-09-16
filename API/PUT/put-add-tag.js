#!/usr/bin/env node

/**
 * CloudTalk API Test: PUT /tags/add.json
 * 
 * Tests the endpoint for adding new tags
 * 
 * Required fields:
 * - name: Tag name (string)
 */

import { makeCloudTalkRequest } from '../config.js';
import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '../../.env') });

/**
 * Test data for tag creation
 */
const generateTestCases = () => {
    const timestamp = Date.now();
    
    return [
        {
            name: "Add Tag - Valid Name",
            data: {
                name: `test-tag-${timestamp}`
            },
            expectedStatus: 201,
            description: "Create tag with valid name"
        },
        {
            name: "Add Tag - Short Name",
            data: {
                name: "a"
            },
            expectedStatus: 201,
            description: "Create tag with single character name"
        },
        {
            name: "Add Tag - Long Name",
            data: {
                name: `long-tag-name-with-many-characters-${timestamp}`
            },
            expectedStatus: 201,
            description: "Create tag with long name"
        },
        {
            name: "Add Tag - With Special Characters",
            data: {
                name: `tag-${timestamp}-special!@#`
            },
            expectedStatus: 201,
            description: "Create tag with special characters"
        },
        {
            name: "Add Tag - With Spaces",
            data: {
                name: `Tag With Spaces ${timestamp}`
            },
            expectedStatus: 201,
            description: "Create tag with spaces in name"
        },
        {
            name: "Add Tag - Numeric Name",
            data: {
                name: `12345-${timestamp}`
            },
            expectedStatus: 201,
            description: "Create tag with numeric characters"
        },
        {
            name: "Add Tag - Missing Name",
            data: {
                // name missing intentionally
            },
            expectedStatus: 406,
            description: "Should reject when name field is missing"
        },
        {
            name: "Add Tag - Empty Name",
            data: {
                name: ""
            },
            expectedStatus: 406,
            description: "Should reject empty tag name"
        },
        {
            name: "Add Tag - Null Name",
            data: {
                name: null
            },
            expectedStatus: 406,
            description: "Should reject null tag name"
        },
        {
            name: "Add Tag - Duplicate Name Test",
            data: {
                name: `duplicate-tag-${timestamp}`
            },
            expectedStatus: 406,
            description: "Should reject duplicate tag name (second attempt)"
        }
    ];
};

/**
 * Execute PUT request to add tag
 */
async function addTag(tagData) {
    try {
        const response = await makeCloudTalkRequest('/tags/add.json', {
            method: 'PUT',
            body: JSON.stringify(tagData)
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
    console.log(`📤 Request Data:`, JSON.stringify(testCase.data, null, 2));
    
    const result = await addTag(testCase.data);
    
    console.log(`📥 Response Status: ${result.status}`);
    console.log(`📥 Response Data:`, JSON.stringify(result.data, null, 2));
    
    // Validate response
    const statusMatch = result.status === testCase.expectedStatus;
    const success = statusMatch;
    
    if (success) {
        console.log(`✅ Test PASSED - Status: ${result.status}`);
        
        // Log tag ID if created successfully
        if (result.status === 201 && result.data?.responseData?.data?.id) {
            console.log(`🏷️  Tag ID: ${result.data.responseData.data.id}`);
            console.log(`🏷️  Tag Name: ${result.data.responseData.data.name || testCase.data.name}`);
        }
    } else {
        console.log(`❌ Test FAILED`);
        console.log(`   Expected status: ${testCase.expectedStatus}, Got: ${result.status}`);
    }
    
    return { testCase: testCase.name, success, result };
}

/**
 * Get existing tags to check for duplicates
 */
async function getExistingTags() {
    try {
        const response = await makeCloudTalkRequest('/tags/index.json?limit=100');
        
        const tags = response.data?.responseData?.data || [];
        const tagNames = tags.map(item => item.Tag?.name || item.name).filter(Boolean);
        
        console.log(`🏷️  Found ${tagNames.length} existing tags`);
        return tagNames;
        
    } catch (error) {
        console.error('Error fetching existing tags:', error.message);
        return [];
    }
}

/**
 * Run all test cases
 */
async function runAllTests() {
    console.log('🚀 CloudTalk API Test: PUT /tags/add.json');
    console.log('=' .repeat(50));
    
    // Get existing tags first
    await getExistingTags();
    
    const testCases = generateTestCases();
    const results = [];
    let passed = 0;
    let failed = 0;
    
    // Run duplicate test first to create the tag
    const duplicateTestIndex = testCases.findIndex(t => t.name.includes('Duplicate'));
    let duplicateTagName = null;
    
    if (duplicateTestIndex !== -1) {
        const duplicateTest = testCases[duplicateTestIndex];
        duplicateTagName = duplicateTest.data.name;
        
        // First create the tag (should succeed)
        const firstResult = await runTest({
            ...duplicateTest,
            name: "Add Tag - First Instance (for duplicate test)",
            expectedStatus: 201,
            description: "Create tag for duplicate test"
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
        await new Promise(resolve => setTimeout(resolve, 300));
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
    
    // Show created tags
    const createdTags = results
        .filter(r => r.success && r.result.status === 201)
        .map(r => r.result.data?.responseData?.data);
    
    if (createdTags.length > 0) {
        console.log(`\n🏷️  Successfully Created Tags: ${createdTags.length}`);
        createdTags.forEach(tag => {
            if (tag?.id && tag?.name) {
                console.log(`   - ID: ${tag.id}, Name: "${tag.name}"`);
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

export { addTag, runAllTests, getExistingTags };