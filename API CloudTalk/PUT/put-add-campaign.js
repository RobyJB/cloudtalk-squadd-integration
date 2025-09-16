#!/usr/bin/env node

/**
 * CloudTalk API Test: PUT /campaigns/add.json
 * 
 * Tests the endpoint for adding new campaigns
 * 
 * Required fields:
 * - name: Campaign name (string)
 * - Button: Array of button objects with title, type, color, description
 * 
 * Optional fields:
 * - status, has_schedule_date, schedule_start_date, schedule_start_time
 * - answer_wait_time, after_call_dialing_auto, after_call_time
 * - is_recording, call_number_id, call_script_id, survey_id
 * - is_predictive, calls_percentage, attempts, attempts_interval
 * - ContactsTag, Agent, Group
 */

import { makeCloudTalkRequest } from '../config.js';
import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '../../.env') });

// Valid button types for campaigns
const BUTTON_TYPES = [
    'successful_positive',
    'successful_negative', 
    'unsuccessful',
    'callback',
    'not_interested',
    'busy',
    'no_answer',
    'answering_machine',
    'wrong_number',
    'do_not_call'
];

/**
 * Get available agents, groups, and tags for testing
 */
async function getResourcesForCampaign() {
    const resources = {
        agents: [],
        groups: [],
        tags: []
    };
    
    try {
        // Get agents
        const agentsResponse = await makeCloudTalkRequest('/agents/index.json?limit=5');
        resources.agents = agentsResponse.data?.responseData?.data?.map(item => ({
            id: item.Agent?.id,
            name: `${item.Agent?.firstname} ${item.Agent?.lastname}`
        })).filter(a => a.id) || [];
        
        // Get groups
        const groupsResponse = await makeCloudTalkRequest('/groups/index.json?limit=5');
        resources.groups = groupsResponse.data?.responseData?.data?.map(item => ({
            id: item.Group?.id,
            name: item.Group?.internal_name
        })).filter(g => g.id) || [];
        
        // Get tags
        const tagsResponse = await makeCloudTalkRequest('/tags/index.json?limit=10');
        resources.tags = tagsResponse.data?.responseData?.data?.map(item => ({
            id: item.Tag?.id || item.id,
            name: item.Tag?.name || item.name
        })).filter(t => t.id) || [];
        
    } catch (error) {
        console.error('Error fetching resources:', error.message);
    }
    
    console.log(`📊 Available resources: ${resources.agents.length} agents, ${resources.groups.length} groups, ${resources.tags.length} tags`);
    
    return resources;
}

/**
 * Execute PUT request to add campaign
 */
async function addCampaign(campaignData) {
    try {
        const response = await makeCloudTalkRequest('/campaigns/add.json', {
            method: 'PUT',
            body: JSON.stringify(campaignData)
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
    
    const result = await addCampaign(testCase.data);
    
    console.log(`📥 Response Status: ${result.status}`);
    console.log(`📥 Response Data:`, JSON.stringify(result.data, null, 2));
    
    // Validate response
    const statusMatch = result.status === testCase.expectedStatus;
    const success = statusMatch;
    
    if (success) {
        console.log(`✅ Test PASSED - Status: ${result.status}`);
        
        // Log campaign ID if created successfully
        if (result.status === 201 && result.data?.responseData?.data?.id) {
            console.log(`📈 Campaign ID: ${result.data.responseData.data.id}`);
            console.log(`📋 Name: "${testCase.data.name}"`);
        }
    } else {
        console.log(`❌ Test FAILED`);
        console.log(`   Expected status: ${testCase.expectedStatus}, Got: ${result.status}`);
    }
    
    return { testCase: testCase.name, success, result };
}

/**
 * Generate test cases with real resource data
 */
async function generateTestCases() {
    const resources = await getResourcesForCampaign();
    const timestamp = Date.now();
    const testCases = [];
    
    // Basic minimal campaign
    testCases.push({
        name: "Add Campaign - Minimal Required Fields",
        data: {
            name: `Test Campaign ${timestamp}`,
            Button: [
                {
                    title: "Sale",
                    type: "successful_positive",
                    color: "#2ECC71",
                    description: "Successfully sold"
                }
            ]
        },
        expectedStatus: 201,
        description: "Create campaign with only required fields"
    });
    
    // Campaign with multiple buttons
    testCases.push({
        name: "Add Campaign - Multiple Buttons",
        data: {
            name: `Multi Button Campaign ${timestamp}`,
            Button: [
                {
                    title: "Sale",
                    type: "successful_positive", 
                    color: "#2ECC71",
                    description: "Successfully sold"
                },
                {
                    title: "Not Interested",
                    type: "not_interested",
                    color: "#E74C3C",
                    description: "Customer not interested"
                },
                {
                    title: "Callback",
                    type: "callback",
                    color: "#F39C12",
                    description: "Schedule callback"
                }
            ]
        },
        expectedStatus: 201,
        description: "Create campaign with multiple call outcome buttons"
    });
    
    // Complete campaign with all options
    testCases.push({
        name: "Add Campaign - Complete Configuration",
        data: {
            name: `Complete Campaign ${timestamp}`,
            status: "inactive",
            has_schedule_date: false,
            answer_wait_time: "30",
            after_call_dialing_auto: false,
            after_call_time: "10",
            is_recording: true,
            is_predictive: false,
            attempts: "3",
            attempts_interval: "24",
            Button: [
                {
                    title: "Success",
                    type: "successful_positive",
                    color: "#2ECC71",
                    description: "Call successful"
                },
                {
                    title: "No Answer",
                    type: "no_answer",
                    color: "#95A5A6",
                    description: "No one answered"
                }
            ]
        },
        expectedStatus: 201,
        description: "Create campaign with complete configuration"
    });
    
    // Campaign with agents if available
    if (resources.agents.length > 0) {
        testCases.push({
            name: "Add Campaign - With Agents",
            data: {
                name: `Agent Campaign ${timestamp}`,
                Button: [
                    {
                        title: "Sale",
                        type: "successful_positive",
                        color: "#2ECC71",
                        description: "Sale completed"
                    }
                ],
                Agent: resources.agents.slice(0, 2).map(agent => ({ id: parseInt(agent.id) }))
            },
            expectedStatus: 201,
            description: `Create campaign with ${Math.min(2, resources.agents.length)} agents`
        });
    }
    
    // Campaign with groups if available
    if (resources.groups.length > 0) {
        testCases.push({
            name: "Add Campaign - With Groups",
            data: {
                name: `Group Campaign ${timestamp}`,
                Button: [
                    {
                        title: "Success",
                        type: "successful_positive",
                        color: "#3498DB",
                        description: "Group campaign success"
                    }
                ],
                Group: resources.groups.slice(0, 1).map(group => ({ id: parseInt(group.id) }))
            },
            expectedStatus: 201,
            description: `Create campaign with group "${resources.groups[0]?.name}"`
        });
    }
    
    // Campaign with tags if available
    if (resources.tags.length > 0) {
        testCases.push({
            name: "Add Campaign - With Tags",
            data: {
                name: `Tagged Campaign ${timestamp}`,
                Button: [
                    {
                        title: "Tagged Success",
                        type: "successful_positive",
                        color: "#9B59B6",
                        description: "Tagged campaign result"
                    }
                ],
                ContactsTag: resources.tags.slice(0, 2).map(tag => ({ id: parseInt(tag.id) }))
            },
            expectedStatus: 201,
            description: `Create campaign with ${Math.min(2, resources.tags.length)} tags`
        });
    }
    
    // Campaign with scheduling
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    testCases.push({
        name: "Add Campaign - With Scheduling",
        data: {
            name: `Scheduled Campaign ${timestamp}`,
            has_schedule_date: true,
            schedule_start_date: tomorrow.toISOString().split('T')[0],
            schedule_start_time: "09:00",
            Button: [
                {
                    title: "Scheduled Sale",
                    type: "successful_positive",
                    color: "#1ABC9C",
                    description: "Scheduled campaign sale"
                }
            ]
        },
        expectedStatus: 201,
        description: "Create campaign with start scheduling"
    });
    
    // Predictive dialing campaign
    testCases.push({
        name: "Add Campaign - Predictive Dialing",
        data: {
            name: `Predictive Campaign ${timestamp}`,
            is_predictive: true,
            calls_percentage: "120",
            answer_wait_time: "20",
            Button: [
                {
                    title: "Predictive Success",
                    type: "successful_positive",
                    color: "#E67E22",
                    description: "Predictive dialing success"
                },
                {
                    title: "Busy",
                    type: "busy",
                    color: "#E74C3C",
                    description: "Line busy"
                }
            ]
        },
        expectedStatus: 201,
        description: "Create predictive dialing campaign"
    });
    
    // Test all button types
    const allButtonTypes = BUTTON_TYPES.slice(0, 5); // Test first 5 types
    testCases.push({
        name: "Add Campaign - All Button Types",
        data: {
            name: `All Buttons Campaign ${timestamp}`,
            Button: allButtonTypes.map((type, index) => ({
                title: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                type: type,
                color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
                description: `${type} button description`
            }))
        },
        expectedStatus: 201,
        description: "Create campaign testing multiple button types"
    });
    
    // Error cases
    testCases.push({
        name: "Add Campaign - Missing Name",
        data: {
            Button: [
                {
                    title: "Sale",
                    type: "successful_positive",
                    color: "#2ECC71",
                    description: "Sale button"
                }
            ]
            // name missing intentionally
        },
        expectedStatus: 406,
        description: "Should reject when campaign name is missing"
    });
    
    testCases.push({
        name: "Add Campaign - Missing Buttons",
        data: {
            name: `No Buttons Campaign ${timestamp}`
            // Button array missing intentionally
        },
        expectedStatus: 406,
        description: "Should reject when Button array is missing"
    });
    
    testCases.push({
        name: "Add Campaign - Empty Buttons Array",
        data: {
            name: `Empty Buttons Campaign ${timestamp}`,
            Button: []
        },
        expectedStatus: 406,
        description: "Should reject empty Button array"
    });
    
    testCases.push({
        name: "Add Campaign - Invalid Button Type",
        data: {
            name: `Invalid Button Campaign ${timestamp}`,
            Button: [
                {
                    title: "Invalid",
                    type: "invalid_button_type",
                    color: "#FF0000",
                    description: "Invalid button type"
                }
            ]
        },
        expectedStatus: 406,
        description: "Should reject invalid button type"
    });
    
    testCases.push({
        name: "Add Campaign - Empty Name",
        data: {
            name: "",
            Button: [
                {
                    title: "Sale",
                    type: "successful_positive",
                    color: "#2ECC71",
                    description: "Sale button"
                }
            ]
        },
        expectedStatus: 406,
        description: "Should reject empty campaign name"
    });
    
    testCases.push({
        name: "Add Campaign - Invalid Agent ID",
        data: {
            name: `Invalid Agent Campaign ${timestamp}`,
            Button: [
                {
                    title: "Sale",
                    type: "successful_positive",
                    color: "#2ECC71",
                    description: "Sale button"
                }
            ],
            Agent: [{ id: 999999 }]
        },
        expectedStatus: 406,
        description: "Should reject invalid agent ID"
    });
    
    return testCases;
}

/**
 * Run all test cases
 */
async function runAllTests() {
    console.log('🚀 CloudTalk API Test: PUT /campaigns/add.json');
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
        
        // Longer delay for campaign creation
        await new Promise(resolve => setTimeout(resolve, 1000));
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
    
    // Show created campaigns
    const createdCampaigns = results
        .filter(r => r.success && r.result.status === 201)
        .map(r => ({
            id: r.result.data?.responseData?.data?.id,
            testCase: r.testCase.replace('Add Campaign - ', '')
        }));
    
    if (createdCampaigns.length > 0) {
        console.log(`\n📈 Successfully Created Campaigns: ${createdCampaigns.length}`);
        createdCampaigns.forEach(campaign => {
            if (campaign.id) {
                console.log(`   - ID: ${campaign.id} (${campaign.testCase})`);
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

export { addCampaign, runAllTests, getResourcesForCampaign, BUTTON_TYPES };