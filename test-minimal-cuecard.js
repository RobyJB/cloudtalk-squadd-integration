import 'dotenv/config';

/**
 * Test minimo per CueCard CloudTalk
 * Invia il payload più semplice possibile per verificare se funziona
 */

const testMinimalCueCard = async () => {
  console.log('🧪 Testing minimal CueCard format...\n');
  
  // Payload minimo secondo documentazione
  const minimalPayload = {
    call_uuid: "test-uuid-123", // UUID fake per test
    type: "blocks",
    title: "TEST CUECARD",
    subtitle: "Test subtitle",
    content: [
      {
        type: "textfield",
        name: "Test Field 1",
        value: "Test Value 1"
      },
      {
        type: "textfield", 
        name: "Test Field 2",
        value: "Test Value 2"
      }
    ]
  };
  
  console.log('📋 Payload da inviare:');
  console.log(JSON.stringify(minimalPayload, null, 2));
  console.log('\n🚀 Sending to CloudTalk...\n');
  
  try {
    const response = await fetch('https://platform-api.cloudtalk.io/api/cuecards', {
      method: 'POST',
      body: JSON.stringify(minimalPayload),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${process.env.CLOUDTALK_API_KEY_ID}:${process.env.CLOUDTALK_API_SECRET}`).toString('base64')}`
      }
    });
    
    const responseText = await response.text();
    
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📄 Response Body: ${responseText}`);
    console.log(`📋 Response Headers:`, [...response.headers.entries()]);
    
    if (response.ok) {
      console.log('✅ SUCCESS! CueCard inviata!');
    } else {
      console.log(`❌ FAILED: ${response.status} - ${responseText}`);
    }
    
  } catch (error) {
    console.error('💥 ERROR:', error.message);
  }
};

// Test con formato alternativo (content come string HTML)
const testHtmlCueCard = async () => {
  console.log('\n🧪 Testing HTML content format...\n');
  
  const htmlPayload = {
    call_uuid: "test-uuid-456",
    type: "info", // Cambio anche il type
    title: "TEST HTML CUECARD",
    subtitle: "HTML Test",
    content: `
      <div>
        <h3>🔗 APRI CONTATTO GHL</h3>
        <p>Link: <a href="https://example.com">APRI ROBERTO BONDICI</a></p>
        
        <h3>📞 Telefono</h3>
        <p>+393513416607</p>
        
        <h3>📧 Email</h3>
        <p>r.bondici@gmail.com</p>
        
        <h3>🎯 BANT Score</h3>
        <p>Budget: 4/5 | Authority: 3/5<br/>Need: 5/5 | Timeline: 2/5</p>
        
        <h3>💡 AI Coaching</h3>
        <p><b>Cliente tecnico - usa linguaggio specifico. Focus su ROI e integrazione.</b></p>
      </div>
    `
  };
  
  console.log('📋 HTML Payload da inviare:');
  console.log(JSON.stringify(htmlPayload, null, 2));
  console.log('\n🚀 Sending HTML format to CloudTalk...\n');
  
  try {
    const response = await fetch('https://platform-api.cloudtalk.io/api/cuecards', {
      method: 'POST',
      body: JSON.stringify(htmlPayload),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${process.env.CLOUDTALK_API_KEY_ID}:${process.env.CLOUDTALK_API_SECRET}`).toString('base64')}`
      }
    });
    
    const responseText = await response.text();
    
    console.log(`📊 HTML Response Status: ${response.status}`);
    console.log(`📄 HTML Response Body: ${responseText}`);
    
    if (response.ok) {
      console.log('✅ HTML SUCCESS! CueCard inviata!');
    } else {
      console.log(`❌ HTML FAILED: ${response.status} - ${responseText}`);
    }
    
  } catch (error) {
    console.error('💥 HTML ERROR:', error.message);
  }
};

// Esegui entrambi i test
const runTests = async () => {
  await testMinimalCueCard();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
  await testHtmlCueCard();
};

runTests().catch(console.error);