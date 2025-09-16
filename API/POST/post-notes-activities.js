import { CLOUDTALK_CONFIG } from '../config.js';

/**
 * CloudTalk Notes and Activities POST API
 * 
 * Multiple endpoints for managing notes and activities:
 * 1. POST /contacts/{contactId}/notes.json - Add note to contact
 * 2. POST /contacts/{contactId}/activities.json - Add activity to contact
 * 3. POST /calls/{callId}/notes.json - Add note to call
 */

/**
 * Add note to contact
 * Endpoint: POST /contacts/{contactId}/notes.json
 */
async function addContactNote(contactId, noteData) {
  console.log('📝 CloudTalk - Add Contact Note');
  console.log('=' .repeat(40));

  if (!contactId) throw new Error('contactId is required');
  if (!noteData || !noteData.content) throw new Error('Note content is required');

  const url = `${CLOUDTALK_CONFIG.baseURL}/contacts/${contactId}/notes.json`;
  
  console.log(`📝 Adding note to contact: ${contactId}`);
  console.log(`📄 Note content: ${noteData.content.substring(0, 100)}...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${CLOUDTALK_CONFIG.apiKeyId}:${CLOUDTALK_CONFIG.apiSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'CloudTalk-API-Client/1.0'
      },
      body: JSON.stringify(noteData)
    });

    console.log(`🔗 Making request to: ${url}`);
    console.log(`📝 Method: POST`);
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Success!');
    
    if (data.success || data.id) {
      console.log(`📝 Note added successfully!`);
      console.log(`📄 Note ID: ${data.id || 'Not provided'}`);
    }

    return data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    
    if (error.message.includes('404')) {
      console.log('⚠️  Contact not found');
    } else if (error.message.includes('400')) {
      console.log('⚠️  Invalid note data');
    }
    
    throw error;
  }
}

/**
 * Add activity to contact
 * Endpoint: POST /contacts/{contactId}/activities.json
 */
async function addContactActivity(contactId, activityData) {
  console.log('📋 CloudTalk - Add Contact Activity');
  console.log('=' .repeat(40));

  if (!contactId) throw new Error('contactId is required');
  if (!activityData || !activityData.type) throw new Error('Activity type is required');

  const url = `${CLOUDTALK_CONFIG.baseURL}/contacts/${contactId}/activities.json`;
  
  console.log(`📋 Adding activity to contact: ${contactId}`);
  console.log(`🎯 Activity type: ${activityData.type}`);
  console.log(`📄 Activity data:`, JSON.stringify(activityData, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${CLOUDTALK_CONFIG.apiKeyId}:${CLOUDTALK_CONFIG.apiSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'CloudTalk-API-Client/1.0'
      },
      body: JSON.stringify(activityData)
    });

    console.log(`🔗 Making request to: ${url}`);
    console.log(`📝 Method: POST`);
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Success!');
    
    if (data.success || data.id) {
      console.log(`📋 Activity added successfully!`);
      console.log(`🎯 Activity ID: ${data.id || 'Not provided'}`);
    }

    return data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    
    if (error.message.includes('404')) {
      console.log('⚠️  Contact not found');
    } else if (error.message.includes('400')) {
      console.log('⚠️  Invalid activity data');
    }
    
    throw error;
  }
}

/**
 * Add note to call
 * Endpoint: POST /calls/{callId}/notes.json
 */
async function addCallNote(callId, noteData) {
  console.log('📞 CloudTalk - Add Call Note');
  console.log('=' .repeat(40));

  if (!callId) throw new Error('callId is required');
  if (!noteData || !noteData.content) throw new Error('Note content is required');

  const url = `${CLOUDTALK_CONFIG.baseURL}/calls/${callId}/notes.json`;
  
  console.log(`📞 Adding note to call: ${callId}`);
  console.log(`📄 Note content: ${noteData.content.substring(0, 100)}...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${CLOUDTALK_CONFIG.apiKeyId}:${CLOUDTALK_CONFIG.apiSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'CloudTalk-API-Client/1.0'
      },
      body: JSON.stringify(noteData)
    });

    console.log(`🔗 Making request to: ${url}`);
    console.log(`📝 Method: POST`);
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Success!');
    
    if (data.success || data.id) {
      console.log(`📞 Call note added successfully!`);
      console.log(`📄 Note ID: ${data.id || 'Not provided'}`);
    }

    return data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    
    if (error.message.includes('404')) {
      console.log('⚠️  Call not found');
    } else if (error.message.includes('400')) {
      console.log('⚠️  Invalid note data');
    }
    
    throw error;
  }
}

// Test runner
async function runTests() {
  console.log('🚀 Testing CloudTalk Notes and Activities API\n');
  
  try {
    // Test contact note
    const testContactId = 12345;
    const contactNoteData = {
      content: `Priority contact note for Roberto (+393513416607) - ${new Date().toISOString()}`,
      type: "note",
      user_id: 493933 // Optional: agent who created the note
    };
    
    console.log('Step 1: Testing contact note...');
    try {
      await addContactNote(testContactId, contactNoteData);
    } catch (error) {
      if (error.message.includes('404')) {
        console.log('✅ Expected: Contact not found (test ID)');
      } else {
        throw error;
      }
    }
    
    // Test contact activity
    const activityData = {
      type: "call_scheduled",
      description: "Scheduled priority call for Roberto's number +393513416607",
      scheduled_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      user_id: 493933
    };
    
    console.log('\nStep 2: Testing contact activity...');
    try {
      await addContactActivity(testContactId, activityData);
    } catch (error) {
      if (error.message.includes('404')) {
        console.log('✅ Expected: Contact not found (test ID)');
      } else {
        throw error;
      }
    }
    
    // Test call note
    const testCallId = 1001772369;
    const callNoteData = {
      content: `Call note: Contacted Roberto at +393513416607 - Developer priority contact - ${new Date().toISOString()}`,
      type: "note"
    };
    
    console.log('\nStep 3: Testing call note...');
    try {
      await addCallNote(testCallId, callNoteData);
    } catch (error) {
      if (error.message.includes('404')) {
        console.log('✅ Expected: Call not found (test ID)');
      } else {
        throw error;
      }
    }
    
    console.log('\n🎉 All note and activity tests completed!');
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { addContactNote, addContactActivity, addCallNote };