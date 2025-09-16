import { getAgents } from './get-agents.js';
import { getContacts } from './get-contacts.js';
import { getCampaigns } from './get-campaigns.js';
import { getGroups } from './get-groups.js';
import { getContactDetails } from './get-contact-details.js';
import { getContactAttributes } from './get-contact-attributes.js';
import { getNotes } from './get-notes.js';
import { getActivities } from './get-activities.js';
import { getNumbers } from './get-numbers.js';
import { getCountries } from './get-countries.js';
import { getBlacklist } from './get-blacklist.js';
import { getCalls } from './get-calls.js';
import { getCallDetails } from './get-call-details.js';
import { getCallRecording } from './get-call-recording.js';

/**
 * Master test runner for all CloudTalk GET endpoints
 * Tests each endpoint individually with error handling
 */

async function runAllGetTests() {
  console.log('🚀 CloudTalk API - Testing All GET Endpoints');
  console.log('═'.repeat(60));
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));

  const endpoints = [
    { name: 'Agents', test: () => getAgents({ limit: 3 }) },
    { name: 'Contacts', test: () => getContacts({ limit: 3 }) },
    { name: 'Campaigns', test: () => getCampaigns({ limit: 3 }) },
    { name: 'Groups', test: () => getGroups({ limit: 3 }) },
    { name: 'Contact Details', test: () => getContactDetails(1431049073) },
    { name: 'Contact Attributes', test: () => getContactAttributes() },
    { name: 'Notes', test: () => getNotes({ limit: 3 }) },
    { name: 'Activities', test: () => getActivities({ limit: 3 }) },
    { name: 'Numbers', test: () => getNumbers({ limit: 3 }) },
    { name: 'Countries', test: () => getCountries() },
    { name: 'Blacklist', test: () => getBlacklist({ limit: 3 }) },
    { name: 'Calls', test: () => getCalls({ limit: 3 }) },
    // Note: These may fail if IDs don't exist, but that's expected
    { name: 'Call Details', test: () => getCallDetails(12345) },
    { name: 'Call Recording', test: () => getCallRecording(12345) }
  ];

  let passedTests = 0;
  let failedTests = 0;
  const results = [];

  for (let i = 0; i < endpoints.length; i++) {
    const { name, test } = endpoints[i];
    
    console.log(`\n🔄 Testing ${name} API... (${i + 1}/${endpoints.length})`);
    console.log('─'.repeat(60));
    
    try {
      const result = await test();
      
      console.log(`✅ ${name} API - SUCCESS`);
      results.push({ endpoint: name, status: 'PASSED', data: result });
      passedTests++;
      
    } catch (error) {
      console.error(`❌ ${name} API - FAILED: ${error.message}`);
      results.push({ endpoint: name, status: 'FAILED', error: error.message });
      failedTests++;
    }
    
    if (i < endpoints.length - 1) {
      console.log('\n' + '═'.repeat(60));
    }
  }

  // Final summary
  console.log('\n' + '🏁 FINAL TEST SUMMARY'.padStart(40));
  console.log('═'.repeat(60));
  console.log(`✅ Passed: ${passedTests}/${endpoints.length}`);
  console.log(`❌ Failed: ${failedTests}/${endpoints.length}`);
  console.log(`📅 Completed at: ${new Date().toISOString()}`);
  
  console.log('\n📊 Detailed Results:');
  results.forEach(result => {
    const icon = result.status === 'PASSED' ? '✅' : '❌';
    console.log(`   ${icon} ${result.endpoint}: ${result.status}`);
    if (result.status === 'FAILED') {
      console.log(`      Error: ${result.error}`);
    }
  });
  
  console.log('═'.repeat(60));

  if (failedTests === 0) {
    console.log('🎉 All GET endpoints are working correctly!');
  } else {
    console.log(`⚠️  ${failedTests} endpoint(s) failed. Check the errors above.`);
  }

  return {
    passed: passedTests,
    failed: failedTests,
    total: endpoints.length,
    results
  };
}

// Run all tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllGetTests().catch(error => {
    console.error('💥 Test suite crashed:', error.message);
    process.exit(1);
  });
}

export { runAllGetTests };