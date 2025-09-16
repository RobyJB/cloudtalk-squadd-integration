import 'dotenv/config';

export async function addNoteToGHLContact(contactId, noteBody, userId = null) {
  const apiKey = process.env.GHL_API_KEY;

  console.log(`📝 Adding note to GHL Contact: ${contactId}`);
  console.log('API Key presente:', !!apiKey);

  if (!contactId) {
    throw new Error('Contact ID è richiesto');
  }

  if (!noteBody) {
    throw new Error('Note body è richiesto');
  }

  try {
    const requestBody = {
      body: noteBody
    };

    // Add userId if provided
    if (userId) {
      requestBody.userId = userId;
    }

    const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Status:', response.status);
    console.log('Rate limit remaining:', response.headers.get('x-ratelimit-remaining'));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Errore API:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Nota aggiunta con successo!');
    console.log('- Note ID:', data.id);
    console.log('- Body:', data.body);
    console.log('- Created At:', data.dateAdded);

    return data;

  } catch (error) {
    console.error('❌ Errore nell\'aggiunta della nota:', error.message);
    throw error;
  }
}

// Test function
async function testAddNote() {
  try {
    // Prima cerca un contatto, poi aggiungi la nota
    const { searchGHLContactByPhone } = await import('./search-contact-by-phone.js');

    // Test con il numero del webhook CloudTalk
    const testPhone = '393936815798'; // external_number dal webhook

    console.log('🔍 Step 1: Cerco contatto...');
    const contact = await searchGHLContactByPhone(testPhone);

    if (!contact) {
      console.log('❌ Nessun contatto trovato per testare l\'aggiunta di note');
      return;
    }

    console.log(`\n📝 Step 2: Aggiungo nota al contatto ${contact.id}...`);

    // Crea una nota per la chiamata registrata (simula webhook CloudTalk)
    const noteText = `🎙️ NUOVA REGISTRAZIONE CLOUDTALK

📞 Call ID: 1002226167
🔗 Recording URL: https://my.cloudtalk.io/pub/r/MTAwMjIyNjE2Nw%3D%3D/...
📱 Numero interno: 40312296109
📞 Numero esterno: ${testPhone}
📅 Timestamp: ${new Date().toLocaleString('it-IT')}

✅ Registrazione disponibile per la revisione`;

    const result = await addNoteToGHLContact(contact.id, noteText);

    console.log('\n🎉 TEST COMPLETATO CON SUCCESSO!');
    console.log('- Contatto trovato:', `${contact.firstName || ''} ${contact.lastName || ''}`);
    console.log('- Nota aggiunta con ID:', result.id);

  } catch (error) {
    console.error('\n💥 Test fallito:', error.message);
    process.exit(1);
  }
}

// Test diretto se il file è eseguito
if (import.meta.url === `file://${process.argv[1]}`) {
  testAddNote();
}