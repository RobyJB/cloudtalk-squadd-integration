import { makeCloudTalkRequest } from './API CloudTalk/config.js';
import fs from 'fs';
import path from 'path';

/**
 * Import script per contatti Serena
 * Importa contatti da CSV con:
 * - Tag "Follow Up" 
 * - Custom field "# totale di chiamate" = 3
 */

const CSV_FILE = './Contatti serena 24 sett - filesaver-Serena_Sep 24 25 6_59 pm.csv';
const TAG_NAME = 'Follow Up';
const CUSTOM_FIELD_NAME = '# totale di chiamate';
const CUSTOM_FIELD_VALUE = '3';

// Delay per evitare rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Legge e parsa il file CSV
 */
function parseCSV(filePath) {
  console.log(`📁 Lettura file: ${filePath}`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\r\n').filter(line => line.trim());
  
  // Skip header
  const dataLines = lines.slice(1);
  
  const contacts = dataLines.map((line, index) => {
    const [name, phone, email] = line.split(',');
    
    return {
      name: name?.trim(),
      phone: phone?.trim(),
      email: email?.trim(),
      csvIndex: index + 1
    };
  }).filter(contact => contact.name && contact.phone); // Solo contatti validi
  
  console.log(`✅ Trovati ${contacts.length} contatti validi nel CSV`);
  return contacts;
}

/**
 * Crea un contatto in CloudTalk
 */
async function createContact(contact, tagId = null, customFieldId = null) {
  console.log(`\n👤 Creazione contatto: ${contact.name}`);
  
  // Pulisci il numero di telefono - rimuovi solo il +
  let cleanPhone = contact.phone;
  if (cleanPhone.startsWith('+')) {
    cleanPhone = cleanPhone.substring(1); // Rimuovi solo il +
  }
  
  const requestBody = {
    name: contact.name,
    ContactNumber: [{
      public_number: parseInt(cleanPhone, 10) // Deve essere un numero intero
    }]
  };
  
  // Aggiungi email se presente
  if (contact.email) {
    requestBody.ContactEmail = [{
      email: contact.email
    }];
  }
  
  // Aggiungi tag Follow Up se abbiamo l'ID
  if (tagId) {
    requestBody.ContactsTag = [{
      tag_id: parseInt(tagId, 10)
    }];
  }
  
  // Aggiungi custom field se abbiamo l'ID
  if (customFieldId) {
    requestBody.ContactAttribute = [{
      attribute_id: customFieldId,
      value: CUSTOM_FIELD_VALUE
    }];
  }
  
  try {
    const response = await makeCloudTalkRequest('/contacts/add.json', {
      method: 'PUT',
      body: JSON.stringify(requestBody)
    });
    
    if (response.data?.responseData?.Contact?.id) {
      console.log(`✅ Contatto creato con ID: ${response.data.responseData.Contact.id}`);
      return {
        success: true,
        contactId: response.data.responseData.Contact.id,
        name: contact.name,
        phone: contact.phone
      };
    } else {
      console.log(`❌ Errore nella creazione: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        name: contact.name,
        phone: contact.phone,
        error: response.data?.message || 'Errore sconosciuto'
      };
    }
    
  } catch (error) {
    console.log(`❌ Errore API: ${error.message}`);
    return {
      success: false,
      name: contact.name,
      phone: contact.phone,
      error: error.message
    };
  }
}

/**
 * Trova o crea il tag "Follow Up"
 */
async function findOrCreateTag() {
  console.log(`🏷️  Ricerca tag "${TAG_NAME}"`);
  
  try {
    // Prima cerca se esiste già
    const response = await makeCloudTalkRequest('/tags/index.json?limit=100');
    const tags = response.data?.responseData?.data || [];
    
    const existingTag = tags.find(item => {
      const tag = item.Tag || item;
      return tag.name === TAG_NAME;
    });
    
    if (existingTag) {
      const tagId = existingTag.Tag?.id || existingTag.id;
      console.log(`✅ Tag "${TAG_NAME}" trovato con ID: ${tagId}`);
      return tagId;
    }
    
    // Se non esiste, lo creiamo
    console.log(`🆕 Creazione tag "${TAG_NAME}"`);
    const createResponse = await makeCloudTalkRequest('/tags/add.json', {
      method: 'PUT',
      body: JSON.stringify({
        name: TAG_NAME,
        color: '#33C1FF'
      })
    });
    
    const newTagId = createResponse.data?.responseData?.Tag?.id;
    if (newTagId) {
      console.log(`✅ Tag creato con ID: ${newTagId}`);
      return newTagId;
    } else {
      console.log(`❌ Errore nella creazione del tag`);
      return null;
    }
    
  } catch (error) {
    console.log(`❌ Errore gestione tag: ${error.message}`);
    return null;
  }
}

/**
 * Trova o crea il custom field "# totale di chiamate"
 */
async function findOrCreateCustomField() {
  console.log(`📋 Ricerca custom field "${CUSTOM_FIELD_NAME}"`);
  
  try {
    // Prima cerca se esiste già negli attributi esistenti
    const response = await makeCloudTalkRequest('/contacts/attributes.json');
    const attributes = response.data?.responseData || [];
    
    const existingAttr = attributes.find(item => {
      const attr = item.ContactAttribute || item;
      return attr.title === CUSTOM_FIELD_NAME; // CloudTalk usa 'title' non 'name'
    });
    
    if (existingAttr) {
      const attrId = existingAttr.ContactAttribute?.id || existingAttr.id;
      console.log(`✅ Custom field "${CUSTOM_FIELD_NAME}" trovato con ID: ${attrId}`);
      return attrId;
    }
    
    // Custom field non trovato e non esiste endpoint per crearlo
    console.log(`⚠️  Custom field "${CUSTOM_FIELD_NAME}" non trovato e non può essere creato automaticamente`);
    console.log(`🔧 Dovrà essere creato manualmente in CloudTalk`);
    return null;
    
  } catch (error) {
    console.log(`❌ Errore gestione custom field: ${error.message}`);
    return null;
  }
}

/**
 * Main import function
 */
async function importContacts() {
  console.log('🚀 INIZIO IMPORT CONTATTI SERENA');
  console.log('=' .repeat(50));
  
  try {
    // 1. Leggi CSV
    const contacts = parseCSV(CSV_FILE);
    
    if (contacts.length === 0) {
      console.log('❌ Nessun contatto valido trovato nel CSV');
      return;
    }
    
    // 2. Prepara tag e custom field
    console.log('\n🔧 Preparazione tag e custom field...');
    const tagId = await findOrCreateTag();
    await delay(1000); // Delay tra le chiamate
    
    const customFieldId = await findOrCreateCustomField();
    await delay(1000);
    
    // 3. Import contatti
    console.log('\n📥 INIZIO IMPORT CONTATTI');
    console.log('=' .repeat(30));
    
    const results = {
      success: [],
      failed: [],
      total: contacts.length
    };
    
    // TEST: Solo il primo contatto per debug
    for (let i = 0; i < Math.min(1, contacts.length); i++) {
      const contact = contacts[i];
      console.log(`\n[${i + 1}/${contacts.length}] Processando: ${contact.name}`);
      
      const result = await createContact(contact, tagId, customFieldId);
      
      if (result.success) {
        results.success.push(result);
      } else {
        results.failed.push(result);
      }
      
      // Delay per evitare rate limiting
      if (i < contacts.length - 1) {
        await delay(2000); // 2 secondi tra ogni contatto
      }
    }
    
    // 4. Report finale
    console.log('\n' + '=' .repeat(50));
    console.log('📊 REPORT FINALE');
    console.log('=' .repeat(50));
    console.log(`✅ Contatti importati con successo: ${results.success.length}`);
    console.log(`❌ Contatti falliti: ${results.failed.length}`);
    console.log(`📈 Totale processati: ${results.total}`);
    
    if (results.success.length > 0) {
      console.log('\n🎉 CONTATTI IMPORTATI:');
      results.success.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.name} - ID: ${result.contactId}`);
      });
    }
    
    if (results.failed.length > 0) {
      console.log('\n❌ CONTATTI FALLITI:');
      results.failed.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.name} (${result.phone}) - ${result.error}`);
      });
    }
    
    // Salva report
    const reportFile = `import-report-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Report salvato in: ${reportFile}`);
    
  } catch (error) {
    console.error('💥 Errore generale:', error.message);
    process.exit(1);
  }
}

// Esegui import
if (import.meta.url === `file://${process.argv[1]}`) {
  importContacts();
}

export { importContacts };