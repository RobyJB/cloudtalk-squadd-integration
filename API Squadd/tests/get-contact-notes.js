import 'dotenv/config';

/**
 * Get All Notes for a contact from GoHighLevel
 * GET https://services.leadconnectorhq.com/contacts/{contactId}/notes
 */
export async function getContactNotes(contactId) {
  const apiKey = process.env.GHL_API_KEY;

  console.log(`📝 Getting notes for contact: ${contactId}`);
  console.log('API Key presente:', !!apiKey);

  if (!apiKey) {
    throw new Error('GHL_API_KEY non configurata');
  }

  try {
    const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28'
      }
    });

    console.log('Status:', response.status);
    console.log('Rate limit remaining:', response.headers.get('x-ratelimit-remaining'));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Errore API:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Note recuperate!');
    console.log('- Totale note:', data.notes?.length || 0);

    if (data.notes && data.notes.length > 0) {
      console.log('\n📋 ULTIME NOTE:');
      
      // Mostra le prime 3 note più recenti
      const recentNotes = data.notes
        .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
        .slice(0, 3);

      recentNotes.forEach((note, index) => {
        const date = new Date(note.dateAdded).toLocaleDateString('it-IT');
        const preview = note.body.length > 100 ? note.body.substring(0, 100) + '...' : note.body;
        
        console.log(`\n${index + 1}. [${date}]`);
        console.log(`   📝 ${preview}`);
        console.log(`   🆔 ID: ${note.id}`);
      });
    } else {
      console.log('📝 Nessuna nota trovata per questo contatto');
    }

    return data.notes || [];

  } catch (error) {
    console.error('❌ Errore nel recupero note:', error.message);
    throw error;
  }
}

// Test diretto se il file è eseguito
if (import.meta.url === `file://${process.argv[1]}`) {
  // Test con un contact ID di esempio
  const testContactId = 'uQHYBHs2SJAfxf1ACAWU'; // Dal tuo esempio

  getContactNotes(testContactId)
    .then(notes => {
      console.log(`\n🎯 RISULTATO: ${notes.length} note trovate`);
      if (notes.length > 0) {
        console.log('- Prima nota:', notes[0].body.substring(0, 50) + '...');
      }
    })
    .catch(error => {
      console.error('\n💥 Test fallito:', error.message);
      process.exit(1);
    });
}