import { testAgentsAPI } from './test-agents.js';
import { testContactsAPI } from './test-contacts.js';
import { testCampaignsAPI } from './test-campaigns.js';

/**
 * Master test runner for all CloudTalk API endpoints
 * Tests basic GET operations to verify API connectivity and authentication
 */

async function runAllTests() {
  console.log('🚀 Starting CloudTalk API Integration Tests');
  console.log('=' .repeat(60));
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log('=' .repeat(60));

  const testSuite = [
    { name: 'Agents API', test: testAgentsAPI },
    { name: 'Contacts API', test: testContactsAPI },
    { name: 'Campaigns API', test: testCampaignsAPI }
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (let i = 0; i < testSuite.length; i++) {
    const { name, test } = testSuite[i];
    
    try {
      console.log(`\n🔄 Running ${name} tests... (${i + 1}/${testSuite.length})`);
      console.log('─'.repeat(60));
      
      await test();
      
      console.log(`✅ ${name} tests PASSED`);
      passedTests++;
      
    } catch (error) {
      console.error(`❌ ${name} tests FAILED:`, error.message);
      failedTests++;
    }
    
    if (i < testSuite.length - 1) {
      console.log('\n' + '═'.repeat(60));
    }
  }

  // Final summary
  console.log('\n' + '🏁 TEST SUMMARY'.padStart(35));
  console.log('═'.repeat(60));
  console.log(`✅ Passed: ${passedTests}/${testSuite.length}`);
  console.log(`❌ Failed: ${failedTests}/${testSuite.length}`);
  console.log(`📅 Completed at: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));

  if (failedTests === 0) {
    console.log('🎉 All tests passed! CloudTalk API integration is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check your API configuration and credentials.');
    process.exit(1);
  }
}

// Run all tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('💥 Test suite crashed:', error.message);
    process.exit(1);
  });
}

export { runAllTests };
