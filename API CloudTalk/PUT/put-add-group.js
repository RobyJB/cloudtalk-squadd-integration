#!/usr/bin/env node

/**
 * CloudTalk API Test: PUT /groups/add.json
 * 
 * Tests the endpoint for adding agents to groups
 * 
 * Required fields:
 * - group_id: ID of the group
 * - agent_id: ID of the agent to add to group
 */

import { makeCloudTalkRequest } from '../config.js';
import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '../../.env') });

/**
 * Get available groups for testing
 */
async function getAvailableGroups() {
    try {
        const response = await makeCloudTalkRequest('/groups/index.json?limit=10');
        
        const groups = response.data?.responseData?.data || [];
        console.log(`📋 Found ${groups.length} available groups`);
        
        return groups.map(item => ({
            id: item.Group?.id,
            name: item.Group?.internal_name
        })).filter(g => g.id);
        
    } catch (error) {
        console.error('Error fetching groups:', error.message);
        return [];
    }
}

/**
 * Get available agents for testing
 */
async function getAvailableAgents() {
    try {
        const response = await makeCloudTalkRequest('/agents/index.json?limit=10');
        
        const agents = response.data?.responseData?.data || [];
        console.log(`👥 Found ${agents.length} available agents`);
        
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
 * Execute PUT request to add agent to group
 */
async function addAgentToGroup(groupData) {
    try {
        const response = await makeCloudTalkRequest('/groups/add.json', {
            method: 'PUT',
            body: JSON.stringify(groupData)
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
    
    const result = await addAgentToGroup(testCase.data);
    
    console.log(`📥 Response Status: ${result.status}`);
    console.log(`📥 Response Data:`, JSON.stringify(result.data, null, 2));
    
    // Validate response
    const statusMatch = result.status === testCase.expectedStatus;
    const success = statusMatch;
    
    if (success) {
        console.log(`✅ Test PASSED - Status: ${result.status}`);
        
        // Log success message if available
        if (result.data?.responseData?.data?.message) {
            console.log(`💬 Message: ${result.data.responseData.data.message}`);
        }
    } else {
        console.log(`❌ Test FAILED`);
        console.log(`   Expected status: ${testCase.expectedStatus}, Got: ${result.status}`);
    }
    
    return { testCase: testCase.name, success, result };
}

/**
 * Generate test cases with real data
 */
async function generateTestCases() {
    const groups = await getAvailableGroups();
    const agents = await getAvailableAgents();
    
    if (groups.length === 0) {
        console.error('❌ No groups available for testing');
        return [];
    }
    
    if (agents.length === 0) {
        console.error('❌ No agents available for testing');
        return [];
    }
    
    const testCases = [
        {
            name: "Add Agent to Group - Valid IDs",
            data: {
                group_id: parseInt(groups[0].id),
                agent_id: parseInt(agents[0].id)
            },
            expectedStatus: 200,
            description: `Add agent "${agents[0].name}" to group "${groups[0].name}"`
        }
    ];
    
    // Add test with multiple groups/agents if available
    if (groups.length > 1 && agents.length > 1) {
        testCases.push({
            name: "Add Different Agent to Different Group",
            data: {
                group_id: parseInt(groups[1].id),
                agent_id: parseInt(agents[1].id)
            },
            expectedStatus: 200,
            description: `Add agent "${agents[1].name}" to group "${groups[1].name}"`
        });
    }
    
    // Test with invalid group ID
    testCases.push({
        name: "Add Agent to Group - Invalid Group ID",
        data: {
            group_id: 999999,
            agent_id: parseInt(agents[0].id)
        },
        expectedStatus: 406,
        description: "Should reject invalid group ID"
    });
    
    // Test with invalid agent ID
    testCases.push({
        name: "Add Agent to Group - Invalid Agent ID", 
        data: {
            group_id: parseInt(groups[0].id),
            agent_id: 999999
        },
        expectedStatus: 406,
        description: "Should reject invalid agent ID"
    });
    
    // Test with missing required fields
    testCases.push({
        name: "Add Agent to Group - Missing Group ID",
        data: {
            agent_id: parseInt(agents[0].id)
            // group_id missing intentionally
        },
        expectedStatus: 406,
        description: "Should reject when group_id is missing"
    });
    
    testCases.push({
        name: "Add Agent to Group - Missing Agent ID",
        data: {
            group_id: parseInt(groups[0].id)
            // agent_id missing intentionally  
        },
        expectedStatus: 406,
        description: "Should reject when agent_id is missing"
    });
    
    // Test with string IDs instead of integers
    testCases.push({
        name: "Add Agent to Group - String IDs",
        data: {
            group_id: groups[0].id, // Keep as string
            agent_id: agents[0].id  // Keep as string
        },
        expectedStatus: 200,
        description: "Test if string IDs are accepted (should work)"
    });
    
    return testCases;
}

/**
 * Run all test cases
 */
async function runAllTests() {
    console.log('🚀 CloudTalk API Test: PUT /groups/add.json');
    console.log('=' .repeat(50));
    
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

export { addAgentToGroup, runAllTests, getAvailableGroups, getAvailableAgents };