import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Analytics API - Get Call Details
 * Endpoint: GET https://analytics-api.cloudtalk.io/api/calls/{callId}
 * 
 * Comprehensive information about a call and its flow
 */

async function getCallAnalytics(callId) {
  console.log('📊 CloudTalk Analytics - Get Call Details');
  console.log('=' .repeat(50));
  console.log(`🔍 Looking for call: ${callId}`);

  try {
    // Use Analytics API base URL instead of standard API
    const analyticsUrl = `https://analytics-api.cloudtalk.io/api/calls/${callId}`;
    
    const response = await fetch(analyticsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${process.env.CLOUDTALK_API_KEY_ID}:${process.env.CLOUDTALK_API_SECRET}`).toString('base64')}`
      }
    });

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error: HTTP ${response.status}: ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const callData = await response.json();
    console.log('✅ Call found in Analytics API!');
    console.log('\n📋 CALL DETAILS:');
    console.log(`   🆔 CDR ID: ${callData.cdr_id}`);
    console.log(`   🔑 UUID: ${callData.uuid}`);
    console.log(`   🏢 Company ID: ${callData.company_id}`);
    console.log(`   📅 Date: ${callData.date}`);
    console.log(`   📞 Direction: ${callData.direction}`);
    console.log(`   📊 Status: ${callData.status}`);
    console.log(`   🎙️ Recorded: ${callData.recorded}`);
    
    if (callData.contact) {
      console.log(`   👤 Contact: ${callData.contact.name || callData.contact.id}`);
    }
    
    if (callData.internal_number) {
      console.log(`   📱 Internal Number: ${callData.internal_number.number}`);
    }

    if (callData.call_times) {
      console.log(`   ⏱️ Call Times:`);
      console.log(`      - Duration: ${callData.call_times.duration}s`);
      console.log(`      - Talk Time: ${callData.call_times.talk_time}s`);
      console.log(`      - Wait Time: ${callData.call_times.wait_time}s`);
    }

    if (callData.call_steps && callData.call_steps.length > 0) {
      console.log(`   🔄 Call Steps: ${callData.call_steps.length} steps`);
      callData.call_steps.forEach((step, index) => {
        console.log(`      ${index + 1}. ${step.type || 'unknown'} (${step.duration || 0}s)`);
      });
    }

    return {
      success: true,
      callData: callData
    };

  } catch (error) {
    console.error('❌ Analytics API call failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Test function
async function runTest() {
  console.log('🧪 Testing CloudTalk Analytics API\n');

  // Test con UUID dal webhook più recente
  const testUUIDs = [
    '8a4cb392-4699-4d41-8d77-907c15efd527', // UUID dal log precedente
    'af7b0df1-9e5f-4435-a73f-a5892ad4a10b', // UUID ancora precedente
    'dfd9f957-3a00-4768-92f2-e342d000b053'  // UUID più vecchio
  ];

  for (const uuid of testUUIDs) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Testing UUID: ${uuid}`);
    
    const result = await getCallAnalytics(uuid);
    
    if (result.success) {
      console.log(`✅ UUID ${uuid} FOUND in Analytics API!`);
      console.log(`   Status: ${result.callData.status}`);
      console.log(`   Direction: ${result.callData.direction}`);
      console.log(`   Recorded: ${result.callData.recorded}`);
    } else {
      console.log(`❌ UUID ${uuid} NOT FOUND in Analytics API`);
      console.log(`   Error: ${result.error}`);
    }
    
    // Wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('🎉 Analytics API test completed!');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTest().catch(error => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  });
}

export { getCallAnalytics };