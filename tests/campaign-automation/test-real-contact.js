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
        console.log(`📱 Phone: ${phoneNumber}`);
        return {
          contact: contactInfo,
          phone: phoneNumber
        };
      }
    }
    
    console.log('❌ No contacts found with phone numbers');
    return null;
    
  } catch (error) {
    console.error('💥 Error finding test contact:', error.message);
    return null;
  }
}

/**
 * Test incremento tentativi su contatto reale
 */
async function testRealContactTagging() {
  console.log('🧪 TEST: Real Contact Tagging');
  console.log('=' .repeat(60));
  
  // Trova un contatto reale
  const testData = await findTestContact();
  if (!testData) {
    console.log('⚠️  Cannot run test - no suitable contact found');
    return;
  }
  
  const { contact, phone } = testData;
  
  console.log(`\n🎯 Testing with real contact:`);
  console.log(`   Name: ${contact.name}`);
  console.log(`   ID: ${contact.id}`);
  console.log(`   Phone: ${phone}`);
  
  // Test singolo incremento
  console.log(`\n📞 Simulating call-ended webhook...`);
  
  try {
    const webhookPayload = {
      external_number: phone,
      call_ended: true,
      event: 'call-ended',
      timestamp: new Date().toISOString(),
      call_uuid: `real-test-${Date.now()}`,
      duration: 45
    };
    
    const correlationId = `real-contact-test-${Date.now()}`;
    
    console.log(`📤 Processing webhook for ${phone}...`);
    const result = await processCallEndedWebhook(webhookPayload, correlationId);
    
    if (result.success) {
      console.log(`\n✅ SUCCESS - Webhook processed!`);
      console.log(`📊 Contact: ${result.contact.name} (${result.contact.id})`);
      console.log(`🔢 Attempts: ${result.attempts.previous} → ${result.attempts.new}`);
      console.log(`⏱️  Duration: ${result.duration}ms`);
      
      if (result.tags) {
        console.log(`🏷️  Tag Changes:`);
        if (result.tags.removed && result.tags.removed.length > 0) {
          console.log(`   📤 Removed: ${result.tags.removed.join(', ')}`);
        }
        if (result.tags.added && result.tags.added.length > 0) {
          console.log(`   📥 Added: ${result.tags.added.join(', ')}`);
        }
        if (result.tags.final && result.tags.final.length > 0) {
          console.log(`   🎯 Final Tags: ${result.tags.final.join(', ')}`);
        }
        
        console.log(`\n🎉 Tag system is working correctly!`);
      } else {
        console.log(`⚠️  No tag changes detected - this might be normal depending on attempt count`);
      }
      
    } else {
      console.log(`\n❌ FAILED - Webhook processing failed`);
      console.log(`   Reason: ${result.reason || result.error}`);
    }
    
  } catch (error) {
    console.error(`\n💥 ERROR during test:`, error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

/**
 * Esecuzione principale del test
 */
async function runRealContactTest() {
  console.log('🚀 CloudTalk Tag System - Real Contact Test');
  console.log('Test Date:', new Date().toISOString());
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('');
  
  try {
    // Test con contatto reale
    await testRealContactTagging();
    
    console.log('\n🏁 Real contact test completed!');
    
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runRealContactTest()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

export { runRealContactTest, testRealContactTagging };