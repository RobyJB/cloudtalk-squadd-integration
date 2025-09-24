import 'dotenv/config';

const callUuid = 'a3ef833d-3b20-4b55-8db0-1eb7360aa082'; // UUID dall'ultimo webhook

const authHeader = `Basic ${Buffer.from(`${process.env.CLOUDTALK_API_KEY_ID}:${process.env.CLOUDTALK_API_SECRET}`).toString('base64')}`;

console.log(`🧪 Testing CueCard with CORRECT FORMAT for UUID: ${callUuid}`);
console.log('=' .repeat(80));

// Test con formato corretto secondo documentazione
const correctCueCard = {
  call_uuid: callUuid,
  type: "info",
  title: "🎯 Roberto Bondici",
  subtitle: "+393513416607 - r.bondici@gmail.com",
  content: `🔗 APRI CONTATTO GHL: APRI ROBERTO BONDICI

📞 Telefono: +393513416607

📧 Email: r.bondici@gmail.com

📊 Chiamate Totali: 0 chiamate | 0 risposto | 0% conversion

📅 Ultima Chiamata: Mai

🎯 BANT Score: Budget: 4/5 | Authority: 3/5
Need: 5/5 | Timeline: 2/5

💡 AI Coaching: Cliente tecnico - usa linguaggio specifico. Focus su ROI e integrazione.

📝 Ultime Note GHL: 
23/09/25: CHIAMATA INIZIATA - CLOUDTALK
23/09/25: TENTATIVO SENZA RISPOSTA - CLOUDTALK`
};

console.log('\n📋 CORRECT CUECARD FORMAT:');
console.log(JSON.stringify(correctCueCard, null, 2));

console.log('\n🚀 Testing Platform CueCard API with correct format...');

try {
  const response = await fetch(`https://platform-api.cloudtalk.io/api/cuecards`, {
    method: 'POST',
    headers: { 
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(correctCueCard)
  });
  
  console.log(`   📊 Status: ${response.status}`);
  console.log(`   📋 Status Text: ${response.statusText}`);
  
  const responseText = await response.text();
  
  if (response.ok) {
    console.log(`   ✅ SUCCESS! CueCard accepted!`);
    console.log(`   📄 Response: ${responseText}`);
  } else {
    console.log(`   ❌ FAILED: ${responseText}`);
    
    // Analizza il tipo di errore
    try {
      const errorJson = JSON.parse(responseText);
      if (errorJson.errors && errorJson.errors.includes('no such active call')) {
        console.log(`   🔍 ANALYSIS: UUID ${callUuid} not recognized as active call`);
        console.log(`   💡 POSSIBLE CAUSES:`);
        console.log(`      - Call has already ended`);
        console.log(`      - UUID is temporary/webhook-only`);
        console.log(`      - CueCard only works during active calls`);
      }
    } catch (e) {
      // Non è JSON, continua
    }
  }
  
} catch (error) {
  console.log(`   💥 Exception: ${error.message}`);
}

console.log('\n' + '=' .repeat(80));

// Test aggiuntivo: prova con un UUID diverso formato
console.log('\n🧪 ADDITIONAL TEST: Trying with different UUID format...');

const alternativeUuid = callUuid.replace(/-/g, ''); // Rimuovi i trattini
console.log(`   Testing without dashes: ${alternativeUuid}`);

const altCueCard = { ...correctCueCard, call_uuid: alternativeUuid };

try {
  const response2 = await fetch(`https://platform-api.cloudtalk.io/api/cuecards`, {
    method: 'POST',
    headers: { 
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(altCueCard)
  });
  
  console.log(`   📊 Status: ${response2.status}`);
  const responseText2 = await response2.text();
  
  if (response2.ok) {
    console.log(`   ✅ SUCCESS with alternative format!`);
    console.log(`   📄 Response: ${responseText2}`);
  } else {
    console.log(`   ❌ Also failed: ${responseText2}`);
  }
  
} catch (error) {
  console.log(`   💥 Exception: ${error.message}`);
}

console.log('\n🏁 Test completato!');