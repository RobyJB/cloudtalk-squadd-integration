import 'dotenv/config';

async function testGHL() {
  console.log('🧪 Test API GoHighLevel');
  console.log('GHL_API_KEY presente:', !!process.env.GHL_API_KEY);
  console.log('GHL_LOCATION_ID:', process.env.GHL_LOCATION_ID);
  
  try {
    console.log('\n🔍 Test ricerca contatti...');
    const contactsResponse = await fetch('https://services.leadconnectorhq.com/contacts/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: process.env.GHL_LOCATION_ID,
        query: '393936815798',
        pageLimit: 5
      })
    });

    console.log('Status contatti:', contactsResponse.status);
    
    if (contactsResponse.ok) {
      const contactsData = await contactsResponse.json();
      console.log('✅ Contatti trovati:', contactsData.total);
      
      if (contactsData.contacts && contactsData.contacts.length > 0) {
        const firstContact = contactsData.contacts[0];
        console.log('📞 Primo contatto:', `${firstContact.firstName || ''} ${firstContact.lastName || ''} - ${firstContact.phone}`);
        console.log('🆔 Contact ID:', firstContact.id);
        
        // Test opportunità per questo contatto
        console.log('\n🎯 Test opportunità per questo contatto...');
        const oppResponse = await fetch(`https://services.leadconnectorhq.com/opportunities/search?location_id=${process.env.GHL_LOCATION_ID}&contact_id=${firstContact.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Status opportunità:', oppResponse.status);
        
        if (oppResponse.ok) {
          const oppData = await oppResponse.json();
          console.log('✅ Opportunità trovate:', oppData.meta?.total || 0);
          
          if (oppData.opportunities && oppData.opportunities.length > 0) {
            console.log('\n📊 OPPORTUNITÀ:');
            oppData.opportunities.forEach((opp, i) => {
              console.log(`${i+1}. ${opp.name || 'Senza nome'} - €${opp.monetaryValue || 0} - ${opp.status}`);
            });
          }
        } else {
          console.log('❌ Errore opportunità:', await oppResponse.text());
        }
      }
    } else {
      console.log('❌ Errore contatti:', await contactsResponse.text());
    }

  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

testGHL();