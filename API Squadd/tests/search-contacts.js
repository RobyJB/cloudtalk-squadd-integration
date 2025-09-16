require('dotenv').config();

async function testGHLContactsAPI() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = 'i30YnwSzJ1ld5lsxtnb2';

  console.log('🧪 Test API GoHighLevel Contacts');
  console.log('API Key presente:', !!apiKey);
  console.log('Location ID:', locationId);

  try {
    const response = await fetch('https://services.leadconnectorhq.com/contacts/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: locationId,
        pageLimit: 5 // Test con pochi dati
      })
    });

    console.log('Status:', response.status);
    console.log('Rate limit remaining:', response.headers.get('x-ratelimit-remaining'));

    if (!response.ok) {
      console.error('❌ Errore API:', await response.text());
      return;
    }

    const data = await response.json();
    console.log('✅ Successo!');
    console.log('- Totale contatti:', data.total);
    console.log('- Contatti ricevuti:', data.contacts?.length);
    console.log('- TraceId:', data.traceId);

    // ANALISI DETTAGLIATA
    if (data.contacts && data.contacts.length > 0) {
      console.log('\n📊 ANALISI STRUTTURA:');
      console.log('- Campi primo contatto:', Object.keys(data.contacts[0]));
      
      // JSON COMPLETO PRIMO CONTATTO
      console.log('\n📄 JSON COMPLETO PRIMO CONTATTO:');
      console.log(JSON.stringify(data.contacts[0], null, 2));

      // JSON COMPLETO SECONDO CONTATTO (se esiste)
      if (data.contacts[1]) {
        console.log('\n📄 JSON COMPLETO SECONDO CONTATTO:');
        console.log(JSON.stringify(data.contacts[1], null, 2));
      }

      // ANALISI OPPORTUNITÀ (se presenti)
      const firstContact = data.contacts[0];
      if (firstContact.opportunities && firstContact.opportunities.length > 0) {
        console.log('\n💰 OPPORTUNITÀ NEL PRIMO CONTATTO:');
        console.log('- Numero opportunità:', firstContact.opportunities.length);
        console.log('- Prima opportunità:', JSON.stringify(firstContact.opportunities[0], null, 2));
      } else {
        console.log('\n💰 Nessuna opportunità nel primo contatto');
      }

      // ANALISI CUSTOM FIELDS (se presenti)
      if (firstContact.customFields && firstContact.customFields.length > 0) {
        console.log('\n🏷️ CUSTOM FIELDS NEL PRIMO CONTATTO:');
        console.log(JSON.stringify(firstContact.customFields, null, 2));
      } else {
        console.log('\n🏷️ Nessun custom field nel primo contatto');
      }
    }

    return data;

  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

testGHLContactsAPI();