import { getContacts } from './GET/get-contacts.js';
import { getContactDetails } from './GET/get-contact-details.js';
import fs from 'fs';
import path from 'path';

/**
 * Cerca un contatto CloudTalk tramite numero di telefono e recupera i dettagli completi
 * @param {string} phoneNumber - Il numero di telefono da cercare (es: +393513416607)
 * @returns {object} - Dettagli completi del contatto
 */
async function searchContactByPhone(phoneNumber) {
    console.log('🔍 CloudTalk - Ricerca contatto per numero di telefono');
    console.log('=' .repeat(50));
    console.log(`📞 Numero da cercare: ${phoneNumber}`);
    console.log('');

    try {
        // Step 1: Cerca il contatto usando il numero come keyword
        console.log('📋 Step 1: Ricerca contatto...');
        const searchResults = await getContacts({ 
            keyword: phoneNumber, 
            limit: 50  // Aumentiamo il limite per essere sicuri
        });

        if (!searchResults?.responseData?.data || searchResults.responseData.data.length === 0) {
            console.log('❌ Nessun contatto trovato per questo numero');
            return null;
        }

        // Step 2: Trova il contatto che corrisponde esattamente al numero
        console.log('\n🎯 Step 2: Verifica corrispondenza numero...');
        let targetContact = null;
        let targetContactId = null;

        for (const item of searchResults.responseData.data) {
            if (item.ContactNumber && item.ContactNumber.public_number) {
                const contactNumber = item.ContactNumber.public_number.toString();
                const searchNumber = phoneNumber.replace(/[^\d]/g, ''); // Rimuovi caratteri non numerici
                
                console.log(`   Confronto: ${contactNumber} vs ${searchNumber}`);
                
                if (contactNumber.includes(searchNumber) || searchNumber.includes(contactNumber)) {
                    targetContact = item;
                    targetContactId = item.Contact.id;
                    console.log(`✅ Trovato match: ${item.Contact.name} (ID: ${targetContactId})`);
                    break;
                }
            }
        }

        if (!targetContactId) {
            console.log('❌ Nessuna corrispondenza esatta trovata per il numero');
            console.log('📋 Contatti trovati nella ricerca:');
            searchResults.responseData.data.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.Contact.name} - ${item.ContactNumber?.public_number || 'No number'}`);
            });
            return null;
        }

        // Step 3: Recupera i dettagli completi del contatto
        console.log('\n📄 Step 3: Recupero dettagli completi...');
        const contactDetails = await getContactDetails(targetContactId);

        // Step 4: Salva i dettagli in un file di log
        console.log('\n💾 Step 4: Salvataggio dati...');
        await saveContactData(phoneNumber, contactDetails);

        console.log('\n🎉 Operazione completata con successo!');
        console.log(`📋 Contatto trovato: ${contactDetails.responseData.Contact.name}`);
        console.log(`📞 Numero: ${contactDetails.responseData.ContactNumber?.[0]?.public_number || 'N/A'}`);
        console.log(`📧 Email: ${contactDetails.responseData.ContactEmail?.[0]?.email || 'N/A'}`);

        return contactDetails;

    } catch (error) {
        console.error('❌ Errore durante la ricerca:', error.message);
        throw error;
    }
}

/**
 * Salva i dati del contatto in un file di log
 */
async function saveContactData(phoneNumber, contactData) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `contact-search-${phoneNumber.replace(/[^\d]/g, '')}-${timestamp}.json`;
    const logPath = path.join(process.cwd(), 'logs', 'cloudtalk-contacts');
    
    // Crea la directory se non esiste
    if (!fs.existsSync(logPath)) {
        fs.mkdirSync(logPath, { recursive: true });
    }
    
    const fullPath = path.join(logPath, filename);
    
    const logData = {
        timestamp: new Date().toISOString(),
        searchedPhone: phoneNumber,
        contactData: contactData,
        metadata: {
            script: 'search-contact-by-phone.js',
            version: '1.0.0'
        }
    };
    
    fs.writeFileSync(fullPath, JSON.stringify(logData, null, 2));
    console.log(`   💾 Dati salvati in: ${fullPath}`);
}

// Test con il numero richiesto
async function runTest() {
    console.log('🚀 Test ricerca contatto CloudTalk\n');
    console.log('🔧 Controllo configurazione...');
    
    // Verifica environment variables
    if (!process.env.CLOUDTALK_API_KEY_ID) {
        console.error('❌ CLOUDTALK_API_KEY_ID non configurata');
        return;
    }
    if (!process.env.CLOUDTALK_API_SECRET) {
        console.error('❌ CLOUDTALK_API_SECRET non configurata');
        return;
    }
    
    console.log('✅ Environment variables configurate');
    console.log(`📡 API Key ID: ${process.env.CLOUDTALK_API_KEY_ID.substring(0, 8)}...`);
    
    const phoneNumber = '+393513416607';
    
    try {
        // Timeout per evitare hang
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout dopo 60 secondi')), 60000);
        });
        
        const result = await Promise.race([
            searchContactByPhone(phoneNumber),
            timeoutPromise
        ]);
        
        if (result) {
            console.log('\n📊 PAYLOAD COMPLETO SALVATO NEI LOG');
            console.log('🔍 Struttura del payload:');
            console.log('   - Contact: informazioni base contatto');
            console.log('   - ContactEmail: array di email');
            console.log('   - ContactNumber: array di numeri telefono');
            console.log('   - ContactsTag: array di tag applicati');
            console.log('   - ExternalUrl: array di URL esterni');
        }
        
    } catch (error) {
        console.error('💥 Test fallito:', error.message);
        process.exit(1);
    }
}

// Esegui il test se il file viene chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
    runTest();
}

export { searchContactByPhone };