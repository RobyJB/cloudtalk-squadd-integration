#!/usr/bin/env node

/**
 * CloudTalk API Test Suite: ALL PUT Endpoints
 * 
 * Runs tests for all 9 CloudTalk PUT endpoints:
 * 1. PUT /agents/add.json
 * 2. PUT /groups/add.json  
 * 3. PUT /campaigns/add.json
 * 4. PUT /contacts/add.json
 * 5. PUT /contacts/addTags/{contactId}.json
 * 6. PUT /notes/add/{contactId}.json
 * 7. PUT /activity/add/{contactId}.json
 * 8. PUT /blacklist/add.json
 * 9. PUT /tags/add.json
 */

import path from 'path';

// Import all test modules
import * as agentTests from './put-add-agent.js';
import * as groupTests from './put-add-group.js';
import * as campaignTests from './put-add-campaign.js';
import * as contactTests from './put-add-contact.js';
import * as contactTagsTests from './put-add-contact-tags.js';
import * as noteTests from './put-add-note.js';
import * as activityTests from './put-add-activity.js';
import * as blacklistTests from './put-add-blacklist.js';
import * as tagTests from './put-add-tag.js';

// Test suite configuration
const TEST_SUITES = [
    {
        name: 'PUT /agents/add.json',
        module: agentTests,
        description: 'Add new agents to CloudTalk',
        icon: '👤'
    },
    {
        name: 'PUT /groups/add.json',
        module: groupTests,
        description: 'Add agents to groups',
        icon: '👥'
    },
    {
        name: 'PUT /tags/add.json',
        module: tagTests,
        description: 'Add new tags',
        icon: '🏷️'
    },
    {
        name: 'PUT /contacts/add.json',
        module: contactTests,
        description: 'Add new contacts',
        icon: '📱'
    },
    {
        name: 'PUT /blacklist/add.json',
        module: blacklistTests,
        description: 'Add numbers to blacklist',
        icon: '🚫'
    },
    {
        name: 'PUT /contacts/addTags/{contactId}.json',
        module: contactTagsTests,
        description: 'Add tags to existing contacts',
        icon: '🏷️'
    },
    {
        name: 'PUT /notes/add/{contactId}.json',
        module: noteTests,
        description: 'Add notes to contacts',
        icon: '📝'
    },
    {
        name: 'PUT /activity/add/{contactId}.json',
        module: activityTests,
        description: 'Add activities to contacts',
        icon: '📅'
    },
    {
        name: 'PUT /campaigns/add.json',
        module: campaignTests,
        description: 'Add new campaigns (complex endpoint)',
        icon: '📈'
    }
];

/**
 * Run individual test suite
 */
async function runTestSuite(testSuite, suiteIndex, totalSuites) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${testSuite.icon} TEST SUITE ${suiteIndex}/${totalSuites}: ${testSuite.name}`);
    console.log(`📝 ${testSuite.description}`);
    console.log('='.repeat(80));
    
    const startTime = Date.now();
    let results = [];
    
    try {
        results = await testSuite.module.runAllTests();
        
        const duration = Date.now() - startTime;
        const passed = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`\n⏱️  Suite completed in ${(duration / 1000).toFixed(1)}s`);
        console.log(`${testSuite.icon} ${testSuite.name}: ${passed}/${results.length} tests passed`);
        
        return {
            suiteName: testSuite.name,
            icon: testSuite.icon,
            passed,
            failed,
            total: results.length,
            duration: duration / 1000,
            results
        };
        
    } catch (error) {
        console.error(`❌ Suite failed: ${error.message}`);
        return {
            suiteName: testSuite.name,
            icon: testSuite.icon,
            passed: 0,
            failed: 1,
            total: 1,
            duration: (Date.now() - startTime) / 1000,
            error: error.message,
            results: []
        };
    }
}

/**
 * Generate comprehensive summary report
 */
function generateSummaryReport(suiteResults) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE TEST SUITE SUMMARY');
    console.log('='.repeat(80));
    
    const totalPassed = suiteResults.reduce((sum, suite) => sum + suite.passed, 0);
    const totalFailed = suiteResults.reduce((sum, suite) => sum + suite.failed, 0);
    const totalTests = totalPassed + totalFailed;
    const totalDuration = suiteResults.reduce((sum, suite) => sum + suite.duration, 0);
    const successRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;
    
    // Overall statistics
    console.log(`\n📈 OVERALL STATISTICS:`);
    console.log(`   Total Test Suites: ${suiteResults.length}`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${totalPassed} ✅`);
    console.log(`   Failed: ${totalFailed} ❌`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`   Total Duration: ${totalDuration.toFixed(1)}s`);
    console.log(`   Average per Suite: ${(totalDuration / suiteResults.length).toFixed(1)}s`);
    
    // Per-suite breakdown
    console.log(`\n📋 PER-SUITE BREAKDOWN:`);
    suiteResults.forEach((suite, index) => {
        const suiteRate = suite.total > 0 ? (suite.passed / suite.total) * 100 : 0;
        const status = suite.passed === suite.total ? '✅' : suite.passed > 0 ? '⚠️' : '❌';
        
        console.log(`   ${index + 1}. ${suite.icon} ${suite.suiteName.padEnd(45)} ${status}`);
        console.log(`      Tests: ${suite.passed}/${suite.total} (${suiteRate.toFixed(1)}%) | Duration: ${suite.duration.toFixed(1)}s`);
        
        if (suite.error) {
            console.log(`      Error: ${suite.error}`);
        }
    });
    
    // Failed tests details
    const allFailedTests = suiteResults.flatMap(suite => 
        suite.results
            .filter(test => !test.success)
            .map(test => ({ suite: suite.suiteName, test: test.testCase, icon: suite.icon }))
    );
    
    if (allFailedTests.length > 0) {
        console.log(`\n❌ FAILED TESTS DETAILS (${allFailedTests.length} total):`);
        allFailedTests.forEach((failure, index) => {
            console.log(`   ${index + 1}. ${failure.icon} ${failure.suite}`);
            console.log(`      Test: ${failure.test}`);
        });
    }
    
    // Success/performance insights
    console.log(`\n🎯 INSIGHTS:`);
    
    const perfectSuites = suiteResults.filter(s => s.passed === s.total && s.total > 0);
    const problematicSuites = suiteResults.filter(s => s.failed > s.passed);
    const slowSuites = suiteResults.filter(s => s.duration > 30);
    
    if (perfectSuites.length > 0) {
        console.log(`   ✅ Perfect Suites: ${perfectSuites.length}/${suiteResults.length}`);
        perfectSuites.forEach(suite => {
            console.log(`      ${suite.icon} ${suite.suiteName} (${suite.total} tests)`);
        });
    }
    
    if (problematicSuites.length > 0) {
        console.log(`   🚨 Problematic Suites: ${problematicSuites.length}`);
        problematicSuites.forEach(suite => {
            console.log(`      ${suite.icon} ${suite.suiteName} (${suite.failed}/${suite.total} failed)`);
        });
    }
    
    if (slowSuites.length > 0) {
        console.log(`   🐌 Slow Suites (>30s): ${slowSuites.length}`);
        slowSuites.forEach(suite => {
            console.log(`      ${suite.icon} ${suite.suiteName} (${suite.duration.toFixed(1)}s)`);
        });
    }
    
    // Final verdict
    console.log(`\n🎯 FINAL VERDICT:`);
    if (successRate >= 95) {
        console.log(`   🏆 EXCELLENT! ${successRate.toFixed(1)}% success rate - CloudTalk PUT APIs are working great!`);
    } else if (successRate >= 85) {
        console.log(`   👍 GOOD! ${successRate.toFixed(1)}% success rate - Most endpoints working well`);
    } else if (successRate >= 70) {
        console.log(`   ⚠️  FAIR! ${successRate.toFixed(1)}% success rate - Some issues need attention`);
    } else {
        console.log(`   🚨 POOR! ${successRate.toFixed(1)}% success rate - Significant issues detected`);
    }
    
    console.log('='.repeat(80));
}

/**
 * Main test runner
 */
async function runAllPutTests() {
    const startTime = Date.now();
    
    console.log('🚀 CloudTalk API PUT Endpoints - COMPLETE TEST SUITE');
    console.log('🎯 Testing all 9 PUT endpoints with comprehensive test cases');
    console.log('⚡ Running tests in sequence to avoid API rate limits');
    console.log('');
    console.log('📋 Test Suite Order (optimized for dependencies):');
    TEST_SUITES.forEach((suite, index) => {
        console.log(`   ${index + 1}. ${suite.icon} ${suite.name}`);
    });
    
    const suiteResults = [];
    
    // Run test suites sequentially
    for (let i = 0; i < TEST_SUITES.length; i++) {
        const testSuite = TEST_SUITES[i];
        const result = await runTestSuite(testSuite, i + 1, TEST_SUITES.length);
        suiteResults.push(result);
        
        // Delay between test suites to avoid rate limiting
        if (i < TEST_SUITES.length - 1) {
            console.log(`\n⏳ Waiting 2s before next test suite...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    // Generate comprehensive summary
    const totalDuration = (Date.now() - startTime) / 1000;
    
    generateSummaryReport(suiteResults);
    
    console.log(`\n⏱️  TOTAL EXECUTION TIME: ${totalDuration.toFixed(1)}s`);
    console.log(`📅 Completed at: ${new Date().toLocaleString()}`);
    
    // Return exit code
    const totalFailed = suiteResults.reduce((sum, suite) => sum + suite.failed, 0);
    return totalFailed === 0 ? 0 : 1;
}

/**
 * CLI options handling
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
CloudTalk PUT Endpoints Test Runner

Usage: 
  node run-all-put-tests.js [options]

Options:
  -h, --help     Show this help message
  --list         List all available test suites
  --suite N      Run only test suite N (1-${TEST_SUITES.length})

Available Test Suites:
${TEST_SUITES.map((suite, i) => `  ${i + 1}. ${suite.icon} ${suite.name} - ${suite.description}`).join('\n')}

Examples:
  node run-all-put-tests.js                    # Run all test suites
  node run-all-put-tests.js --suite 1          # Run only agents tests
  node run-all-put-tests.js --list             # List available suites
`);
        return 0;
    }
    
    if (args.includes('--list')) {
        console.log('Available CloudTalk PUT Test Suites:\n');
        TEST_SUITES.forEach((suite, index) => {
            console.log(`${index + 1}. ${suite.icon} ${suite.name}`);
            console.log(`   ${suite.description}\n`);
        });
        return 0;
    }
    
    const suiteArg = args.find(arg => arg.startsWith('--suite'));
    if (suiteArg) {
        const suiteNumber = parseInt(suiteArg.split('=')[1] || args[args.indexOf(suiteArg) + 1]);
        
        if (isNaN(suiteNumber) || suiteNumber < 1 || suiteNumber > TEST_SUITES.length) {
            console.error(`❌ Invalid suite number. Use 1-${TEST_SUITES.length}`);
            return 1;
        }
        
        const testSuite = TEST_SUITES[suiteNumber - 1];
        console.log(`🎯 Running single test suite: ${testSuite.icon} ${testSuite.name}`);
        
        const result = await runTestSuite(testSuite, 1, 1);
        return result.failed === 0 ? 0 : 1;
    }
    
    // Run all tests
    return await runAllPutTests();
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().then(exitCode => {
        process.exit(exitCode);
    }).catch(error => {
        console.error('\n💥 Fatal error running test suite:', error.message);
        console.error(error.stack);
        process.exit(1);
    });
}

export { runAllPutTests, TEST_SUITES };
