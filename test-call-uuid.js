import 'dotenv/config';

const callUuid = 'a3ef833d-3b20-4b55-8db0-1eb7360aa082'; // UUID dall'ultimo webhook

const authHeader = `Basic ${Buffer.from(`${process.env.CLOUDTALK_API_KEY_ID}:${process.env.CLOUDTALK_API_SECRET}`).toString('base64')}`;

console.log(`🧪 Testing UUID: ${callUuid}`);
console.log('=' .repeat(80));

// Test 1: Analytics API con UUID
console.log('\n📊 TEST 1: Analytics API con UUID');
try {
  const response1 = await fetch(`https://analytics-api.cloudtalk.io/api/calls/${callUuid}`, {
    headers: { 'Authorization': authHeader }
  });
  console.log(`   Status: ${response1.status}`);
  if (response1.ok) {
    const data = await response1.json();
    console.log(`   ✅ TROVATO! CDR ID: ${data.cdr_id}, Status: ${data.status}`);
  } else {
    const error = await response1.text();
    console.log(`   ❌ Error: ${error}`);
  }
} catch (e) {
  console.log(`   💥 Exception: ${e.message}`);
}

// Test 2: Standard API - Call Details con UUID
console.log('\n📞 TEST 2: Standard API - Call Details con UUID');
try {
  const response2 = await fetch(`https://my.cloudtalk.io/api/calls/show/${callUuid}.json`, {
    headers: { 'Authorization': authHeader }
  });
  console.log(`   Status: ${response2.status}`);
  if (response2.ok) {
    const data = await response2.json();
    console.log(`   ✅ TROVATO!`, data);
  } else {
    const error = await response2.text();
    console.log(`   ❌ Error: ${error}`);
  }
} catch (e) {
  console.log(`   💥 Exception: ${e.message}`);
}

// Test 3: Cercare nelle chiamate recenti per UUID
console.log('\n🔍 TEST 3: Searching recent calls for UUID');
try {
  const response3 = await fetch(`https://my.cloudtalk.io/api/calls/index.json?limit=50`, {
    headers: { 'Authorization': authHeader }
  });
  console.log(`   Status: ${response3.status}`);
  if (response3.ok) {
    const data = await response3.json();
    console.log(`   📊 Found ${data.responseData?.itemsCount} calls`);
    
    if (data.responseData?.data) {
      const matchingCall = data.responseData.data.find(call => {
        const cdr = call.Cdr || call.CallSummary || call;
        return cdr.uuid === callUuid || cdr.call_uuid === callUuid || cdr.id?.toString() === callUuid;
      });
      
      if (matchingCall) {
        const cdr = matchingCall.Cdr || matchingCall.CallSummary || matchingCall;
        console.log(`   ✅ TROVATO! CDR ID: ${cdr.id}, UUID: ${cdr.uuid}, Status: ${cdr.status}`);
      } else {
        console.log(`   ❌ UUID non trovato nelle ultime 50 chiamate`);
        // Mostra i primi 3 UUID per confronto
        const first3 = data.responseData.data.slice(0, 3).map(call => {
          const cdr = call.Cdr || call.CallSummary || call;
          return `ID:${cdr.id}, UUID:${cdr.uuid}`;
        });
        console.log(`   📋 Primi 3 UUID per confronto:`, first3);
      }
    }
  } else {
    const error = await response3.text();
    console.log(`   ❌ Error: ${error}`);
  }
} catch (e) {
  console.log(`   💥 Exception: ${e.message}`);
}

// Test 4: Test CueCard API Standard 
console.log('\n📋 TEST 4: Standard CueCard API');
const testCueCard = {
  CallUUID: callUuid,
  AgentId: 493933,
  Title: 'Test CueCard',
  Content: 'Test content',
  Type: 'info'
};

try {
  const response4 = await fetch(`https://my.cloudtalk.io/api/cuecards`, {
    method: 'POST',
    headers: { 
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testCueCard)
  });
  console.log(`   Status: ${response4.status}`);
  const responseText = await response4.text();
  if (response4.ok) {
    console.log(`   ✅ SUCCESS!`, responseText);
  } else {
    console.log(`   ❌ Error: ${responseText}`);
  }
} catch (e) {
  console.log(`   💥 Exception: ${e.message}`);
}

// Test 5: Platform CueCard API
console.log('\n🏢 TEST 5: Platform CueCard API');
const platformCueCard = {
  call_uuid: callUuid,
  type: 'blocks',
  title: 'Test',
  content: [{ type: 'textfield', name: 'Test', value: 'Test' }]
};

try {
  const response5 = await fetch(`https://platform-api.cloudtalk.io/api/cuecards`, {
    method: 'POST',
    headers: { 
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(platformCueCard)
  });
  console.log(`   Status: ${response5.status}`);
  const responseText = await response5.text();
  if (response5.ok) {
    console.log(`   ✅ SUCCESS!`, responseText);
  } else {
    console.log(`   ❌ Error: ${responseText}`);
  }
} catch (e) {
  console.log(`   💥 Exception: ${e.message}`);
}

console.log('\n' + '=' .repeat(80));
console.log('🏁 Test completato!');