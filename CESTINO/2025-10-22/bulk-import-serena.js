import { makeCloudTalkRequest } from './API CloudTalk/config.js';
import fs from 'fs';

/**
 * BULK Import script per contatti Serena
 * Usa l'API bulk di CloudTalk che è MOLTO più efficiente
 */

const CSV_FILE = './Contatti serena 24 sett - filesaver-Serena_Sep 24 25 6_59 pm.csv';
const TAG_NAME = 'Follow Up';
const CUSTOM_FIELD_NAME = '# totale di chiamate';
const CUSTOM_FIELD_VALUE = '3';

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
  }).filter(contact => contact.name && contact.phone);
  
  console.log(`✅ Trovati ${contacts.length} contatti validi nel CSV`);
  return contacts;
}

/**
 * Trova il tag "Follow Up"
 */
async function findFollowUpTag() {
  console.log(`🏷️  Ricerca tag "${TAG_NAME}"`);
  
  try {
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
    
    console.log(`❌ Tag "${TAG_NAME}" non trovato`);
    return null;
    
  } catch (error) {
    console.log(`❌ Errore ricerca tag: ${error.message}`);
    return null;
  }
}

/**
 * Trova custom field
 */
async function findCustomField() {
  console.log(`📋 Ricerca custom field "${CUSTOM_FIELD_NAME}"`);
  
  try {
    const response = await makeCloudTalkRequest('/contacts/attributes.json');
    const attributes = response.data?.responseData || [];
    
    const existingAttr = attributes.find(item => {
      const attr = item.ContactAttribute || item;
      return attr.title === CUSTOM_FIELD_NAME;
    });
    
    if (existingAttr) {
      const attrId = existingAttr.ContactAttribute?.id || existingAttr.id;
      console.log(`✅ Custom field "${CUSTOM_FIELD_NAME}" trovato con ID: ${attrId}`);
      return attrId;
    }
    
    console.log(`⚠️  Custom field "${CUSTOM_FIELD_NAME}" non trovato`);
    return null;
    
  } catch (error) {
    console.log(`❌ Errore ricerca custom field: ${error.message}`);
    return null;
  }
}

/**
 * Crea bulk operations per i contatti
 */
function createBulkOperations(contacts, tagId, customFieldId) {
  console.log(`🔧 Creazione ${contacts.length} operazioni bulk...`);
  
  return contacts.map((contact, index) => {
    const operation = {
      action: "add_contact",
      command_id: `serena_contact_${index + 1}_${contact.csvIndex}`,
      data: {
        name: contact.name,
        company: "Import Serena 24 Sept",
        ContactNumber: [
          { public_number: contact.phone } // Usa il numero come stringa con +
        ]
      }
    };
    
    // Aggiungi email se presente
    if (contact.email) {
      operation.data.ContactEmail = [
        { email: contact.email }
      ];
    }
    
    // Aggiungi tag Follow Up
    if (tagId) {
      operation.data.ContactsTag = [
        { tag_id: parseInt(tagId, 10) }
      ];
    }
    
    // Aggiungi custom field se esiste
    if (customFieldId) {
      operation.data.ContactAttribute = [
        {
          attribute_id: parseInt(customFieldId, 10),
          value: CUSTOM_FIELD_VALUE
        }
      ];
    }
    
    return operation;
  });
}

/**
 * Esegue operazioni bulk in batch
 */
async function executeBulkOperations(operations, batchSize = 10) {
  console.log(`📦 Esecuzione in batch di ${batchSize} operazioni per volta`);
  
  const results = {
    success: [],
    failed: [],
    total: operations.length
  };
  
  // Dividi in batch
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(operations.length / batchSize);
    
    console.log(`\n📋 Batch ${batchNumber}/${totalBatches} - Operazioni ${i + 1}-${Math.min(i + batchSize, operations.length)}`);
    
    try {
      const response = await makeCloudTalkRequest('/bulk/contacts.json', {
        method: 'POST',
        body: JSON.stringify(batch)
      });
      
      const batchResults = response.data?.responseData?.data || [];
      
      // Processa risultati del batch
      batchResults.forEach((result, index) => {
        const operation = batch[index];
        const contactName = operation?.data?.name || 'Unknown';
        const contactPhone = operation?.data?.ContactNumber?.[0]?.public_number || 'Unknown';
        
        if (result.status === 201) {
          console.log(`   ✅ ${contactName} - ID: ${result.data?.id}`);
          results.success.push({
            name: contactName,
            phone: contactPhone,
            contactId: result.data?.id,
            commandId: result.command_id
          });
        } else {
          console.log(`   ❌ ${contactName} - Status: ${result.status}`);
          results.failed.push({
            name: contactName,
            phone: contactPhone,
            error: `Status ${result.status}`,
            commandId: result.command_id
          });
        }
      });
      
      // Delay tra batch per evitare rate limiting
      if (i + batchSize < operations.length) {
        console.log(`⏳ Pausa 3 secondi...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
    } catch (error) {
      console.log(`❌ Errore batch ${batchNumber}: ${error.message}`);
      
      // Segna tutto il batch come fallito
      batch.forEach(operation => {
        const contactName = operation?.data?.name || 'Unknown';
        const contactPhone = operation?.data?.ContactNumber?.[0]?.public_number || 'Unknown';
        
        results.failed.push({
          name: contactName,
          phone: contactPhone,
          error: error.message,
          commandId: operation.command_id
        });
      });
    }
  }
  
  return results;
}

/**
 * Main import function
 */
async function bulkImportContacts() {
  console.log('🚀 BULK IMPORT CONTATTI SERENA');
  console.log('=' .repeat(50));
  
  try {
    // 1. Leggi CSV
    const contacts = parseCSV(CSV_FILE);
    
    if (contacts.length === 0) {
      console.log('❌ Nessun contatto valido trovato nel CSV');
      return;
    }
    
    // 2. Trova tag e custom field
    console.log('\n🔧 Preparazione tag e custom field...');
    const tagId = await findFollowUpTag();
    const customFieldId = await findCustomField();
    
    // 3. Crea bulk operations
    console.log('\n📋 Creazione operazioni bulk...');
    const operations = createBulkOperations(contacts, tagId, customFieldId);
    
    // 4. Esegui bulk operations
    console.log('\n📥 INIZIO BULK IMPORT');
    console.log('=' .repeat(30));
    
    const results = await executeBulkOperations(operations);
    
    // 5. Report finale
    console.log('\n' + '=' .repeat(50));
    console.log('📊 REPORT FINALE BULK IMPORT');
    console.log('=' .repeat(50));
    console.log(`✅ Contatti importati con successo: ${results.success.length}`);
    console.log(`❌ Contatti falliti: ${results.failed.length}`);
    console.log(`📈 Totale processati: ${results.total}`);
    console.log(`🎯 Tasso di successo: ${((results.success.length / results.total) * 100).toFixed(1)}%`);
    
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
    
    // Salva report dettagliato
    const reportFile = `bulk-import-report-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(reportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: results.total,
        success: results.success.length,
        failed: results.failed.length,
        successRate: ((results.success.length / results.total) * 100).toFixed(1) + '%'
      },
      tagId,
      customFieldId,
      results
    }, null, 2));
    
    console.log(`\n💾 Report dettagliato salvato in: ${reportFile}`);
    
  } catch (error) {
    console.error('💥 Errore generale:', error.message);
    process.exit(1);
  }
}

// Esegui import
if (import.meta.url === `file://${process.argv[1]}`) {
  bulkImportContacts();
}

export { bulkImportContacts };