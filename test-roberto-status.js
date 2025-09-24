#!/usr/bin/env node

import { makeCloudTalkRequest } from './API CloudTalk/config.js';

console.log('🔍 Testing CloudTalk API Connection and Roberto Status Detection');
console.log('='.repeat(70));

async function testConnection() {
  try {
    console.log('Step 1: Testing basic API connection...');
    const response = await makeCloudTalkRequest('/agents/index.json?limit=10');

    if (response?.data?.responseData) {
      const data = response.data.responseData;
      console.log(`✅ API Connection successful! Found ${data.itemsCount} agents`);

      // Look for Roberto Bondici specifically
      console.log('\nStep 2: Looking for Roberto Bondici...');
      const agents = data.data || [];

      let robertoFound = false;
      agents.forEach((item, index) => {
        const agent = item.Agent;
        console.log(`\n👤 Agent ${index + 1}:`);
        console.log(`   Name: ${agent.firstname} ${agent.lastname}`);
        console.log(`   ID: ${agent.id}`);
        console.log(`   Email: ${agent.email}`);
        console.log(`   Status: ${agent.availability_status}`);
        console.log(`   Phone: ${agent.default_number}`);
        console.log(`   Extension: ${agent.extension}`);

        // Check if this is Roberto
        if (agent.firstname?.toLowerCase().includes('roberto') ||
            agent.lastname?.toLowerCase().includes('bondici') ||
            agent.email?.toLowerCase().includes('roberto') ||
            agent.email?.toLowerCase().includes('bondici')) {
          console.log('   🎯 *** THIS IS ROBERTO! ***');
          robertoFound = true;
        }
      });

      if (!robertoFound) {
        console.log('⚠️  Roberto Bondici not found in first 10 agents. Checking all agents...');
        const allAgentsResponse = await makeCloudTalkRequest('/agents/index.json');
        const allAgents = allAgentsResponse?.data?.responseData?.data || [];

        allAgents.forEach(item => {
          const agent = item.Agent;
          if (agent.firstname?.toLowerCase().includes('roberto') ||
              agent.lastname?.toLowerCase().includes('bondici') ||
              agent.email?.toLowerCase().includes('roberto') ||
              agent.email?.toLowerCase().includes('bondici')) {
            console.log(`\n🎯 Found Roberto!`);
            console.log(`   Name: ${agent.firstname} ${agent.lastname}`);
            console.log(`   ID: ${agent.id}`);
            console.log(`   Email: ${agent.email}`);
            console.log(`   Status: ${agent.availability_status}`);
            console.log(`   Phone: ${agent.default_number}`);
            console.log(`   Extension: ${agent.extension}`);
            robertoFound = true;
          }
        });
      }

      if (!robertoFound) {
        console.log('❌ Roberto Bondici not found in any agents');
        console.log('Available agents:');
        agents.forEach(item => {
          const agent = item.Agent;
          console.log(`   - ${agent.firstname} ${agent.lastname} (${agent.email})`);
        });
      }

    } else {
      console.log('❌ API response format unexpected:', response);
    }

  } catch (error) {
    console.error('❌ API Test failed:', error.message);
    console.error('Full error:', error);
  }
}

async function testActiveCalls() {
  try {
    console.log('\nStep 3: Checking for active calls...');
    const response = await makeCloudTalkRequest('/calls/index.json?limit=5');

    if (response?.data?.responseData) {
      const data = response.data.responseData;
      console.log(`📞 Found ${data.itemsCount} recent calls`);

      const calls = data.data || [];
      calls.forEach((item, index) => {
        const call = item.Cdr || item.Call || item.CallSummary || item;
        const agent = item.Agent;

        console.log(`\n📞 Call ${index + 1}:`);
        console.log(`   ID: ${call.id}`);
        console.log(`   Started: ${call.started_at}`);
        console.log(`   Ended: ${call.ended_at || 'Still active?'}`);
        console.log(`   Type: ${call.type}`);
        console.log(`   Duration: ${call.billsec || call.duration || 0}s`);
        if (agent) {
          console.log(`   Agent: ${agent.firstname} ${agent.lastname}`);
          if (agent.firstname?.toLowerCase().includes('roberto') ||
              agent.lastname?.toLowerCase().includes('bondici')) {
            console.log('   🎯 *** ROBERTO\'S CALL! ***');
          }
        }
        console.log(`   External: ${call.public_external}`);
        console.log(`   Internal: ${call.public_internal}`);
      });
    }

  } catch (error) {
    console.error('❌ Calls test failed:', error.message);
  }
}

async function runTests() {
  await testConnection();
  await testActiveCalls();

  console.log('\n🎉 Tests completed!');
  console.log('\nNext steps:');
  console.log('1. Roberto should start a call now');
  console.log('2. Run this script again to see status changes');
  console.log('3. Check if availability_status changes from "online" to "busy"');
}

runTests().catch(console.error);