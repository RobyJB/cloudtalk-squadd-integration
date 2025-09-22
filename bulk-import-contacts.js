import { makeCloudTalkRequest } from './API CloudTalk/config.js';
import fs from 'fs';

async function addContact(contactData) {
    try {
        const response = await makeCloudTalkRequest('/contacts/add.json', {
            method: 'PUT',
            body: JSON.stringify(contactData)
        });

        return {
            success: true,
            status: response.status,
            data: response.data,
            id: response.data?.responseData?.data?.id
        };
    } catch (error) {
        return {
            success: false,
            status: error.message.includes('401') ? 401 :
                   error.message.includes('406') ? 406 :
                   error.message.includes('404') ? 404 : 500,
            data: error.message,
            error: error.message
        };
    }
}

async function bulkImportContacts(contacts) {
    console.log(`🚀 Starting bulk import of ${contacts.length} contacts...\n`);

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        const contactNumber = i + 1;

        console.log(`📞 [${contactNumber}/${contacts.length}] Processing: ${contact.name}`);

        // Format contact data for CloudTalk
        const contactData = {
            name: contact.name,
            ContactEmail: contact.email ? [{
                email: contact.email
            }] : undefined
        };

        // Add phone number only if it's provided and looks valid
        if (contact.phone && contact.phone.trim()) {
            // Basic phone number cleaning - remove spaces, dashes, parentheses
            const cleanPhone = contact.phone.replace(/[\s\-\(\)]/g, '');

            // Skip phone number if it doesn't look like a valid international format
            if (cleanPhone.length >= 10 && /^\d+$/.test(cleanPhone)) {
                contactData.ContactNumber = [{
                    public_number: parseInt(cleanPhone)
                }];
            } else {
                console.log(`   ⚠️  Skipping invalid phone number: ${contact.phone}`);
            }
        }

        const result = await addContact(contactData);

        if (result.success) {
            console.log(`   ✅ Success! Contact ID: ${result.id}`);
            successCount++;
        } else {
            console.log(`   ❌ Failed: ${result.error}`);
            failedCount++;
        }

        results.push({
            index: contactNumber,
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            result: result
        });

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 BULK IMPORT SUMMARY:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`📈 Success Rate: ${((successCount / contacts.length) * 100).toFixed(1)}%`);

    // Show failed imports for debugging
    const failedImports = results.filter(r => !r.result.success);
    if (failedImports.length > 0) {
        console.log('\n❌ FAILED IMPORTS:');
        failedImports.forEach(failed => {
            console.log(`   ${failed.index}. ${failed.name} - ${failed.result.error}`);
        });
    }

    // Save detailed results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `bulk-import-results-${timestamp}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Detailed results saved to: ${resultsFile}`);

    return results;
}

// Example: Parse CSV data (you can replace this with your actual data)
function parseContactData(csvText) {
    const lines = csvText.trim().split('\n');
    const contacts = [];

    // Skip header line if it exists
    const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Assuming CSV format: name,phone,email
        const parts = line.split(',').map(part => part.trim().replace(/['"]/g, ''));

        if (parts.length >= 1) {
            contacts.push({
                name: parts[0] || `Contact ${i}`,
                phone: parts[1] || '',
                email: parts[2] || ''
            });
        }
    }

    return contacts;
}

// Test function with sample data
async function testBulkImport() {
    console.log('🧪 Testing bulk import with sample data...\n');

    // Sample test data (replace with your actual 72 contacts)
    const sampleContacts = [
        { name: "Mario Rossi", phone: "", email: "mario.rossi@example.com" },
        { name: "Lucia Bianchi", phone: "", email: "lucia.bianchi@example.com" },
        { name: "Giuseppe Verde", phone: "", email: "giuseppe.verde@example.com" }
    ];

    const results = await bulkImportContacts(sampleContacts);
    return results;
}

// Export functions for use in other scripts
export { addContact, bulkImportContacts, parseContactData };

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testBulkImport().catch(console.error);
}