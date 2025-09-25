import 'dotenv/config';

// Importa la funzione di ricerca contatto
import { searchGHLContactByPhone } from './search-contact-by-phone.js';

/**
 * Cerca le opportunità di un contatto usando il numero di telefono
 * @param {string} phoneNumber - Numero di telefono del contatto
 * @returns {Promise<Array>} - Array di opportunità trovate
 */
export async function searchOpportunitiesByPhone(phoneNumber) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  console.log(`🔍 Cerco opportunità per telefono: ${phoneNumber}`);

  try {
    // Step 1: Cerca il contatto per numero di telefono
    console.log('\n📞 Step 1: Ricerca contatto...');
    const contact = await searchGHLContactByPhone(phoneNumber);
    
    if (!contact) {
      console.log('❌ Nessun contatto trovato per questo numero');
      return [];
    }

    console.log(`✅ Contatto trovato: ${contact.firstName || ''} ${contact.lastName || ''} (ID: ${contact.id})`);

    // Step 2: Cerca le opportunità per questo contatto
    console.log('\n🎯 Step 2: Ricerca opportunità del contatto...');
    
    const opportunitiesResponse = await fetch(`https://services.leadconnectorhq.com/opportunities/search?location_id=${locationId}&contact_id=${contact.id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    });

    console.log('Status ricerca opportunità:', opportunitiesResponse.status);
    console.log('Rate limit remaining:', opportunitiesResponse.headers.get('x-ratelimit-remaining'));

    if (!opportunitiesResponse.ok) {
      const errorText = await opportunitiesResponse.text();
      console.error('❌ Errore API opportunità:', errorText);
      throw new Error(`HTTP ${opportunitiesResponse.status}: ${errorText}`);
    }

    const opportunitiesData = await opportunitiesResponse.json();
    
    console.log(`✅ Opportunità trovate: ${opportunitiesData.meta?.total || 0}`);

    if (opportunitiesData.opportunities && opportunitiesData.opportunities.length > 0) {
      console.log('\n📊 OPPORTUNITÀ DEL CONTATTO:');
      
      opportunitiesData.opportunities.forEach((opp, index) => {
        console.log(`\n${index + 1}. ${opp.name || 'Senza nome'}`);
        console.log(`   🆔 ID: ${opp.id}`);
        console.log(`   💰 Valore: ${opp.monetaryValue || 0} ${opp.currency || ''}`);
        console.log(`   📊 Status: ${opp.status}`);
        console.log(`   🚰 Pipeline: ${opp.pipelineId}`);
        console.log(`   📍 Stage: ${opp.pipelineStageId}`);
        console.log(`   📅 Creata: ${opp.createdAt}`);
        console.log(`   🔄 Aggiornata: ${opp.updatedAt}`);
        
        if (opp.assignedTo) {
          console.log(`   👤 Assegnata a: ${opp.assignedTo}`);
        }

        // Mostra custom fields se presenti
        if (opp.customFields && opp.customFields.length > 0) {
          console.log(`   🏷️ Custom Fields:`);
          opp.customFields.forEach(field => {
            console.log(`      - ${field.name}: ${field.value}`);
          });
        }
      });

      return opportunitiesData.opportunities;
    } else {
      console.log('⚠️ Nessuna opportunità trovata per questo contatto');
      return [];
    }

  } catch (error) {
    console.error('❌ Errore nella ricerca opportunità:', error.message);
    throw error;
  }
}

/**
 * Versione alternativa che cerca direttamente nelle opportunità usando query telefono
 * (meno precisa ma più veloce)
 */
export async function searchOpportunitiesByPhoneQuery(phoneNumber) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  console.log(`🔍 Ricerca diretta opportunità per telefono: ${phoneNumber}`);

  try {
    const response = await fetch(`https://services.leadconnectorhq.com/opportunities/search?location_id=${locationId}&query=${phoneNumber}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Errore API:', errorText);
      return [];
    }

    const data = await response.json();
    console.log(`✅ Trovate ${data.meta?.total || 0} opportunità con query telefono`);

    return data.opportunities || [];

  } catch (error) {
    console.error('❌ Errore ricerca diretta:', error.message);
    return [];
  }
}

// Test diretto se il file è eseguito
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 TEST: Ricerca opportunità tramite telefono\n');
  
  // Numero di test (dal webhook CloudTalk)
  const testPhone = '393936815798';
  
  async function runTests() {
    try {
      console.log('=' .repeat(60));
      console.log('TEST 1: Ricerca via contatto (metodo preciso)');
      console.log('=' .repeat(60));
      
      const opportunities1 = await searchOpportunitiesByPhone(testPhone);
      
      console.log('\n' + '=' .repeat(60));
      console.log('TEST 2: Ricerca diretta con query (metodo veloce)');
      console.log('=' .repeat(60));
      
      const opportunities2 = await searchOpportunitiesByPhoneQuery(testPhone);
      
      console.log('\n' + '🎯'.repeat(20));
      console.log('RISULTATI FINALI:');
      console.log(`- Metodo 1 (via contatto): ${opportunities1.length} opportunità`);
      console.log(`- Metodo 2 (query diretta): ${opportunities2.length} opportunità`);
      
      if (opportunities1.length > 0 || opportunities2.length > 0) {
        console.log('\n✅ Test completato con successo!');
      } else {
        console.log('\n⚠️ Nessuna opportunità trovata per questo numero');
      }
      
    } catch (error) {
      console.error('\n💥 Test fallito:', error.message);
      process.exit(1);
    }
  }
  
  runTests();
}