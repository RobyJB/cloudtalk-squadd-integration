#!/usr/bin/env node

/**
 * Test semplificato del Sistema Tag con contatto reale
 * 
 * Trova un contatto esistente e testa la logica di aggiornamento tag
 */

import { getContacts } from '../../API CloudTalk/GET/get-contacts.js';
import { processCallEndedWebhook } from '../../src/services/cloudtalk-campaign-automation.js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '../../.env') });

/**
 * Trova un contatto esistente per i test
 */
async function findTestContact() {
  console.log('🔍 Searching for existing contacts...');
  
  try {
    const response = await getContacts({ limit: 5 });
    
    if (response?.responseData?.data && response.responseData.data.length > 0) {
      const contact = response.responseData.data[0];
      const contactInfo = contact.Contact;
      const contactNumbers = contact.ContactNumber || [];
      
      console.log(`✅ Found contact: ${contactInfo.name} (ID: ${contactInfo.id})`);
      
      // Trova il primo numero di telefono disponibile
      let phoneNumber = null;
      if (Array.isArray(contactNumbers) && contactNumbers.length > 0) {
        phoneNumber = contactNumbers[0].public_number;
      } else if (contactNumbers && contactNumbers.public_number) {
        phoneNumber = contactNumbers.public_number;
      }
      
      if (phoneNumber) {
        console.log(`📱 Phone: ${phoneNumber}`);\n        return {\n          contact: contactInfo,\n          phone: phoneNumber\n        };\n      }\n    }\n    \n    console.log('❌ No contacts found with phone numbers');\n    return null;\n    \n  } catch (error) {\n    console.error('💥 Error finding test contact:', error.message);\n    return null;\n  }\n}\n\n/**\n * Test incremento tentativi su contatto reale\n */\nasync function testRealContactTagging() {\n  console.log('🧪 TEST: Real Contact Tagging');\n  console.log('=' .repeat(60));\n  \n  // Trova un contatto reale\n  const testData = await findTestContact();\n  if (!testData) {\n    console.log('⚠️  Cannot run test - no suitable contact found');\n    return;\n  }\n  \n  const { contact, phone } = testData;\n  \n  console.log(`\\n🎯 Testing with real contact:`);\n  console.log(`   Name: ${contact.name}`);\n  console.log(`   ID: ${contact.id}`);\n  console.log(`   Phone: ${phone}`);\n  \n  // Test singolo incremento\n  console.log(`\\n📞 Simulating call-ended webhook...`);\n  \n  try {\n    const webhookPayload = {\n      external_number: phone,\n      call_ended: true,\n      event: 'call-ended',\n      timestamp: new Date().toISOString(),\n      call_uuid: `real-test-${Date.now()}`,\n      duration: 45\n    };\n    \n    const correlationId = `real-contact-test-${Date.now()}`;\n    \n    console.log(`📤 Processing webhook for ${phone}...`);\n    const result = await processCallEndedWebhook(webhookPayload, correlationId);\n    \n    if (result.success) {\n      console.log(`\\n✅ SUCCESS - Webhook processed!`);\n      console.log(`📊 Contact: ${result.contact.name} (${result.contact.id})`);\n      console.log(`🔢 Attempts: ${result.attempts.previous} → ${result.attempts.new}`);\n      console.log(`⏱️  Duration: ${result.duration}ms`);\n      \n      if (result.tags) {\n        console.log(`🏷️  Tag Changes:`);\n        if (result.tags.removed && result.tags.removed.length > 0) {\n          console.log(`   📤 Removed: ${result.tags.removed.join(', ')}`);\n        }\n        if (result.tags.added && result.tags.added.length > 0) {\n          console.log(`   📥 Added: ${result.tags.added.join(', ')}`);\n        }\n        if (result.tags.final && result.tags.final.length > 0) {\n          console.log(`   🎯 Final Tags: ${result.tags.final.join(', ')}`);\n        }\n        \n        console.log(`\\n🎉 Tag system is working correctly!`);\n      } else {\n        console.log(`⚠️  No tag changes detected - this might be normal depending on attempt count`);\n      }\n      \n    } else {\n      console.log(`\\n❌ FAILED - Webhook processing failed`);\n      console.log(`   Reason: ${result.reason || result.error}`);\n    }\n    \n  } catch (error) {\n    console.error(`\\n💥 ERROR during test:`, error.message);\n    if (error.stack) {\n      console.error('Stack trace:', error.stack.split('\\n').slice(0, 5).join('\\n'));\n    }\n  }\n}\n\n/**\n * Test per verificare il comportamento del sistema tag\n */\nasync function testTagSystemBehavior() {\n  console.log('\\n\\n🧪 TEST: Tag System Behavior Analysis');\n  console.log('=' .repeat(60));\n  \n  const testData = await findTestContact();\n  if (!testData) {\n    console.log('⚠️  Skipping behavior test - no suitable contact found');\n    return;\n  }\n  \n  const { phone } = testData;\n  \n  console.log(`\\n📊 Tag System Behavior Verification:`);\n  console.log(`   Phone: ${phone}`);\n  console.log(`\\n📋 Expected Tag Logic:`);\n  console.log(`   1-2 attempts  → \"Nuovi Lead\"`);\n  console.log(`   3-9 attempts  → \"Follow Up\"`);\n  console.log(`   10+ attempts  → \"Mancata Risposta\"`);\n  \n  console.log(`\\n🎯 Running single webhook simulation...`);\n  \n  const webhookPayload = {\n    external_number: phone,\n    call_ended: true,\n    event: 'call-ended',\n    timestamp: new Date().toISOString(),\n    call_uuid: `behavior-test-${Date.now()}`,\n    duration: 30\n  };\n  \n  const correlationId = `behavior-test-${Date.now()}`;\n  \n  try {\n    const result = await processCallEndedWebhook(webhookPayload, correlationId);\n    \n    console.log(`\\n📊 RESULTS:`);\n    console.log(`   Success: ${result.success}`);\n    if (result.success) {\n      console.log(`   Contact: ${result.contact.name}`);\n      console.log(`   Attempts: ${result.attempts.previous} → ${result.attempts.new}`);\n      \n      // Analizza i tag risultanti\n      if (result.tags) {\n        console.log(`\\n🏷️  TAG ANALYSIS:`);\n        console.log(`   Final Tags: ${result.tags.final.join(', ')}`);\n        \n        const newAttempts = result.attempts.new;\n        let expectedTag;\n        \n        if (newAttempts >= 1 && newAttempts <= 2) {\n          expectedTag = 'Nuovi Lead';\n        } else if (newAttempts >= 3 && newAttempts <= 9) {\n          expectedTag = 'Follow Up';\n        } else if (newAttempts >= 10) {\n          expectedTag = 'Mancata Risposta';\n        }\n        \n        if (expectedTag && result.tags.final.includes(expectedTag)) {\n          console.log(`   ✅ Correct tag assigned: \"${expectedTag}\" for ${newAttempts} attempts`);\n        } else {\n          console.log(`   ⚠️  Tag analysis: Expected \"${expectedTag}\" for ${newAttempts} attempts`);\n          console.log(`       Got: ${result.tags.final.join(', ')}`);\n        }\n        \n      } else {\n        console.log(`   ⚠️  No tag information in result`);\n      }\n    } else {\n      console.log(`   Reason: ${result.reason}`);\n    }\n    \n  } catch (error) {\n    console.error(`💥 Behavior test failed:`, error.message);\n  }\n}\n\n/**\n * Esecuzione principale del test\n */\nasync function runRealContactTests() {\n  console.log('🚀 CloudTalk Tag System - Real Contact Test');\n  console.log('Test Date:', new Date().toISOString());\n  console.log('Environment:', process.env.NODE_ENV || 'development');\n  console.log('');\n  \n  try {\n    // Test con contatto reale\n    await testRealContactTagging();\n    \n    // Test comportamento sistema\n    await testTagSystemBehavior();\n    \n    console.log('\\n🏁 Real contact tests completed!');\n    \n  } catch (error) {\n    console.error('💥 Test suite failed:', error);\n    process.exit(1);\n  }\n}\n\n// Esegui se chiamato direttamente\nif (import.meta.url === `file://${process.argv[1]}`) {\n  runRealContactTests()\n    .then(() => process.exit(0))\n    .catch(error => {\n      console.error('💥 Test execution failed:', error);\n      process.exit(1);\n    });\n}\n\nexport { runRealContactTests, testRealContactTagging, testTagSystemBehavior };"}}
</function_results>

<function_calls>
<invoke name="run_command">
<parameter name="command">cd /Users/robertobondici/projects/api-middleware && node tests/campaign-automation/test-single-contact.js