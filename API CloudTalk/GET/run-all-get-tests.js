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
import { getGroupStatistics } from './get-group-statistics.js';
import { getTags } from './get-tags.js';
import { getAICallSummary } from './get-ai-call-summary.js';
import { getAIOverallSentiment } from './get-ai-overall-sentiment.js';
import { getAITalkListenRatio } from './get-ai-talk-listen-ratio.js';
import { getAITopics } from './get-ai-topics.js';
import { getAITranscription } from './get-ai-transcription.js';
import { getAISmartNotes } from './get-ai-smart-notes.js';
import { getAICallDetailsLink } from './get-ai-call-details-link.js';

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
    { name: 'Call Details', test: async () => {
      // DEPENDENCY: Get real call ID first
      const callsResponse = await getCalls({ limit: 1 });
      if (callsResponse?.responseData?.data?.length > 0) {
        const firstCall = callsResponse.responseData.data[0];
        const realCallId = firstCall.Cdr?.id || firstCall.Call?.id || firstCall.CallSummary?.id || firstCall.id;
        if (realCallId) {
          console.log(`   🔗 Using real call ID: ${realCallId}`);
          return await getCallDetails(realCallId);
        }
      }
      console.log('   ⚠️  No real call ID found, using dummy ID');
      return await getCallDetails(12345);
    }},
    { name: 'Call Recording', test: async () => {
      // DEPENDENCY: Get real call ID first 
      const callsResponse = await getCalls({ limit: 1 });
      if (callsResponse?.responseData?.data?.length > 0) {
        const firstCall = callsResponse.responseData.data[0];
        const realCallId = firstCall.Cdr?.id || firstCall.Call?.id || firstCall.CallSummary?.id || firstCall.id;
        if (realCallId) {
          console.log(`   🔗 Using real call ID: ${realCallId}`);
          return await getCallRecording(realCallId);
        }
      }
      console.log('   ⚠️  No real call ID found, using dummy ID');
      return await getCallRecording(12345);
    }},
    // New endpoints
    { name: 'Group Statistics', test: () => getGroupStatistics() },
    { name: 'Tags', test: () => getTags({ limit: 5 }) },
    // AI Endpoints (may not be available for all accounts)
    { name: 'AI Call Summary', test: () => getAICallSummary(1001632149) },
    { name: 'AI Overall Sentiment', test: () => getAIOverallSentiment(1001632149) },
    { name: 'AI Talk-Listen Ratio', test: () => getAITalkListenRatio(1001632149) },
    { name: 'AI Topics', test: () => getAITopics(1001632149, { limit: 5 }) },
    { name: 'AI Transcription', test: () => getAITranscription(1001632149, { limit: 5 }) },
    { name: 'AI Smart Notes', test: () => getAISmartNotes(1001632149) },
    { name: 'AI Call Details Link', test: () => getAICallDetailsLink(1001632149) }
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