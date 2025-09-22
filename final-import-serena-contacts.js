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

function parseSerenaCSV() {
    const csvContent = fs.readFileSync('Contatti Serena Import.csv', 'utf8');
    const lines = csvContent.trim().split('\n');

    // Skip header (line 1)
    const dataLines = lines.slice(1);

    const contacts = [];

    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line) continue;

        // Split CSV but handle quoted fields
        const parts = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                parts.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current.trim()); // Add last part

        if (parts.length >= 3) {
            const contact = {
                name: parts[0] || `Contact ${i + 1}`,
                phone: parts[1] || '',
                email: parts[2] || '',
                attempts: parts[3] || '',
                tag: parts[4] || 'Follow Up'  // Default to Follow Up
            };

            contacts.push(contact);
        }
    }

    return contacts;
}

async function importSerenaContactsComplete() {
    console.log('🚀 FINAL IMPORT: Serena contacts with phones and tags...\n');

    const contacts = parseSerenaCSV();
    console.log(`📊 Found ${contacts.length} contacts to import\n`);

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        const contactNumber = i + 1;

        console.log(`📞 [${contactNumber}/${contacts.length}] ${contact.name}`);

        // Format contact data for CloudTalk
        const contactData = {
            name: contact.name
        };

        // Add email if present
        if (contact.email && contact.email.trim() && contact.email.includes('@')) {
            contactData.ContactEmail = [{
                email: contact.email.trim()
            }];
        }

        // Add phone number in correct format (STRING with +)
        if (contact.phone && contact.phone.trim()) {
            const phone = contact.phone.trim();
            // Ensure it's a string with + prefix
            const phoneStr = phone.startsWith('+') ? phone : `+${phone}`;
            contactData.ContactNumber = [{
                public_number: phoneStr  // STRING format with +
            }];
            console.log(`   📱 Phone: ${phoneStr}`);
        }

        // Add Follow Up tag
        contactData.ContactsTag = [{
            name: "Follow Up"
        }];

        console.log(`   🏷️  Tag: Follow Up`);

        const result = await addContact(contactData);

        if (result.success) {
            console.log(`   ✅ Success! ID: ${result.id}`);
            successCount++;
        } else {
            console.log(`   ❌ Failed: ${result.error}`);
            failedCount++;
        }

        results.push({
            index: contactNumber,
            original: contact,
            result: result
        });

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 400));
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL IMPORT SUMMARY:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`📈 Success Rate: ${((successCount / contacts.length) * 100).toFixed(1)}%`);

    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `final-import-results-${timestamp}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${resultsFile}`);

    // Show successful imports
    const successful = results.filter(r => r.result.success);
    if (successful.length > 0) {
        console.log('\n✅ SUCCESSFULLY IMPORTED WITH PHONES AND TAGS:');
        successful.slice(0, 5).forEach(s => {
            console.log(`   ${s.index}. ${s.original.name} (ID: ${s.result.id}) - ${s.original.phone}`);
        });
        if (successful.length > 5) {
            console.log(`   ... and ${successful.length - 5} more`);
        }
    }

    // Show failed imports
    const failed = results.filter(r => !r.result.success);
    if (failed.length > 0) {
        console.log('\n❌ FAILED IMPORTS:');
        failed.forEach(f => {
            console.log(`   ${f.index}. ${f.original.name} - ${f.result.error}`);
        });
    }

    return results;
}

// Run final import
importSerenaContactsComplete().catch(console.error);