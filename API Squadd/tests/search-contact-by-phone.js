import 'dotenv/config';

export async function searchGHLContactByPhone(phoneNumber) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  // Convert to string and clean the phone number
  const cleanPhoneNumber = String(phoneNumber).trim();

  // Ensure query is max 75 characters for GHL API
  const searchQuery = cleanPhoneNumber.length > 75 ? cleanPhoneNumber.substring(0, 75) : cleanPhoneNumber;

  console.log(`🔍 Searching GHL Contact by phone: ${phoneNumber} (cleaned: ${searchQuery})`);
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
        query: searchQuery, // Search by phone number (string, max 75 chars)
        pageLimit: 10
      })
    });

    console.log('Status:', response.status);
    console.log('Rate limit remaining:', response.headers.get('x-ratelimit-remaining'));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Errore API:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Ricerca completata!');
    console.log('- Totale contatti trovati:', data.total);
    console.log('- Contatti ricevuti:', data.contacts?.length);

    if (data.contacts && data.contacts.length > 0) {
      console.log('\n📊 CONTATTI TROVATI:');

      data.contacts.forEach((contact, index) => {
        console.log(`\n${index + 1}. ${contact.firstName || ''} ${contact.lastName || ''}`);
        console.log(`   📞 Phone: ${contact.phone}`);
        console.log(`   📧 Email: ${contact.email || 'N/A'}`);
        console.log(`   🆔 Contact ID: ${contact.id}`);

        // Check if phone matches exactly
        const normalizedContactPhone = contact.phone?.replace(/\D/g, '');
        const normalizedSearchPhone = phoneNumber.toString().replace(/\D/g, '');

        if (normalizedContactPhone === normalizedSearchPhone) {
          console.log(`   ✅ MATCH ESATTO! Contact ID: ${contact.id}`);
        }
      });

      // Return the first exact match or first contact
      const exactMatch = data.contacts.find(contact => {
        const normalizedContactPhone = contact.phone?.replace(/\D/g, '');
        const normalizedSearchPhone = phoneNumber.toString().replace(/\D/g, '');
        return normalizedContactPhone === normalizedSearchPhone;
      });

      return exactMatch || data.contacts[0];
    } else {
      console.log('⚠️ Nessun contatto trovato per questo numero');
      return null;
    }

  } catch (error) {
    console.error('❌ Errore nella ricerca contatto:', error.message);
    throw error;
  }
}

// Test diretto se il file è eseguito
if (import.meta.url === `file://${process.argv[1]}`) {
  // Test con il numero del webhook CloudTalk
  const testPhone = '393936815798'; // external_number dal webhook

  searchGHLContactByPhone(testPhone)
    .then(contact => {
      if (contact) {
        console.log('\n🎯 CONTATTO SELEZIONATO:');
        console.log('- ID:', contact.id);
        console.log('- Nome:', `${contact.firstName || ''} ${contact.lastName || ''}`);
        console.log('- Telefono:', contact.phone);
        console.log('- Email:', contact.email || 'N/A');
      } else {
        console.log('\n❌ Nessun contatto trovato');
      }
    })
    .catch(error => {
      console.error('\n💥 Test fallito:', error.message);
      process.exit(1);
    });
}

