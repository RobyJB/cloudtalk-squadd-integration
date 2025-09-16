import 'dotenv/config';
import { searchGHLContactByPhone } from './tests/search-contact-by-phone.js';
import { addNoteToGHLContact } from './tests/add-note.js';
import { processRecordingTranscription, formatTranscriptionForGHL } from '../src/services/transcription-service.js';
import { uploadAudioToConversation } from '../src/services/ghl-conversation-service.js';

/**
 * CloudTalk Webhook → GHL Integration Processor
 *
 * Handles the complete flow:
 * 1. Receive CloudTalk webhook
 * 2. Extract phone number (external_number)
 * 3. Search for contact in GHL
 * 4. Add note/activity based on webhook type
 */

export async function processCloudTalkWebhook(webhookPayload, webhookType = 'call-recording-ready') {
  console.log(`🔔 Processing CloudTalk webhook: ${webhookType}`);
  console.log('📋 Payload:', JSON.stringify(webhookPayload, null, 2));

  try {
    // Extract phone number from webhook (try multiple field names)
    const phoneNumber = webhookPayload.external_number ||
                       webhookPayload.external_phone ||
                       webhookPayload.phone_number ||
                       webhookPayload.phone ||
                       webhookPayload.caller_number;

    if (!phoneNumber) {
      console.log('📋 Available fields in payload:', Object.keys(webhookPayload));
      throw new Error('❌ external_number (or phone field) non trovato nel payload webhook');
    }

    console.log(`📞 Searching GHL contact for phone: ${phoneNumber}`);

    // Step 1: Search for contact in GHL
    const contact = await searchGHLContactByPhone(phoneNumber);

    if (!contact) {
      console.log(`⚠️ Nessun contatto trovato in GHL per il numero ${phoneNumber}`);
      return {
        success: false,
        reason: 'contact_not_found',
        phoneNumber: phoneNumber
      };
    }

    console.log(`✅ Contatto trovato: ${contact.firstName || ''} ${contact.lastName || ''} (ID: ${contact.id})`);

    // Step 2: Process based on webhook type
    let result;

    switch (webhookType) {
      case 'call-recording-ready':
        result = await processRecordingReady(contact, webhookPayload);
        break;

      case 'transcription-ready':
        result = await processTranscriptionReady(contact, webhookPayload);
        break;

      case 'new-tag':
        result = await processNewTag(contact, webhookPayload);
        break;

      case 'new-note':
        result = await processNewNote(contact, webhookPayload);
        break;

      case 'contact-updated':
        result = await processContactUpdate(contact, webhookPayload);
        break;

      case 'call-started':
        result = await processCallStarted(contact, webhookPayload);
        break;

      case 'call-ended':
        result = await processCallEnded(contact, webhookPayload);
        break;

      default:
        throw new Error(`❌ Webhook type non supportato: ${webhookType}`);
    }

    console.log('🎉 Webhook processato con successo!');
    return {
      success: true,
      webhookType: webhookType,
      contact: {
        id: contact.id,
        name: `${contact.firstName || ''} ${contact.lastName || ''}`,
        phone: contact.phone
      },
      result: result
    };

  } catch (error) {
    console.error('❌ Errore nel processamento webhook:', error.message);
    return {
      success: false,
      error: error.message,
      webhookType: webhookType,
      payload: webhookPayload
    };
  }
}

/**
 * Process call recording ready webhook
 */
async function processRecordingReady(contact, payload) {
  console.log('🎙️ Processing call recording ready...');

  let noteText = ``;

  let transcriptionResult = null;

  // Try to transcribe the recording
  if (payload.recording_url) {
    console.log('🎤 Attempting to transcribe recording...');

    const transcription = await processRecordingTranscription(payload.recording_url);

    if (transcription.success) {
      console.log('✅ Transcription completed successfully!');
      transcriptionResult = transcription.result;

      // Try to upload audio directly to conversation
      console.log('📤 Attempting to upload audio to GHL conversation...');

      const uploadResult = await uploadAudioToConversation(
        contact.id,
        transcription.result.audioBuffer,
        formatTranscriptionForGHL(transcription.result),
        payload.call_id,
        payload.recording_url
      );

      if (uploadResult.success) {
        console.log('✅ Audio uploaded successfully to conversation!');

        // Add success note
        noteText = `✅ REGISTRAZIONE CARICATA IN CHAT
📎 File audio disponibile nella conversazione

${formatTranscriptionForGHL(transcription.result)}`;

        const result = await addNoteToGHLContact(contact.id, noteText);

        return {
          action: 'note_added_with_audio_upload',
          noteId: result.id,
          callId: payload.call_id,
          recordingUrl: payload.recording_url,
          transcriptionSuccess: true,
          audioUploadSuccess: true,
          conversationId: uploadResult.result.conversationId,
          fileUrl: uploadResult.result.fileUrl,
          transcription: transcriptionResult
        };

      } else {
        console.log(`⚠️ Audio upload failed: ${uploadResult.error}`);

        // Fallback to regular note with transcription
        noteText = `⚠️ Upload audio fallito: ${uploadResult.error}

${formatTranscriptionForGHL(transcription.result)}`;
      }

    } else {
      console.log(`⚠️ Transcription failed: ${transcription.error}`);
      noteText = `⚠️ Trascrizione automatica fallita: ${transcription.error}

📞 Call ID: ${payload.call_id}
🔗 Recording URL: ${payload.recording_url}
🎧 Clicca sul link sopra per ascoltare la registrazione`;
    }
  } else {
    noteText = `✅ Registrazione disponibile per la revisione

📞 Call ID: ${payload.call_id}
🔗 Recording URL: ${payload.recording_url}
🎧 Clicca sul link sopra per ascoltare la registrazione`;
  }

  const result = await addNoteToGHLContact(contact.id, noteText);

  return {
    action: 'note_added_with_transcription',
    noteId: result.id,
    callId: payload.call_id,
    recordingUrl: payload.recording_url,
    transcriptionSuccess: !!transcriptionResult,
    transcription: transcriptionResult
  };
}

/**
 * Process transcription ready webhook
 */
async function processTranscriptionReady(contact, payload) {
  console.log('📄 Processing transcription ready...');

  // Extract transcription text (might be in different fields)
  const transcriptionText = payload.transcription || payload.transcript || payload.text || 'Trascrizione non disponibile';
  const transcriptionUrl = payload.transcription_url || payload.url;

  const noteText = `📄 TRASCRIZIONE CLOUDTALK DISPONIBILE

📞 Call ID: ${payload.call_id}
📱 Numero: ${payload.external_number}
📅 Timestamp: ${new Date().toLocaleString('it-IT')}

📝 TRASCRIZIONE:
${transcriptionText}

${transcriptionUrl ? `🔗 URL Trascrizione: ${transcriptionUrl}` : ''}

✅ Trascrizione completata e disponibile per la revisione`;

  const result = await addNoteToGHLContact(contact.id, noteText);

  return {
    action: 'transcription_added',
    noteId: result.id,
    callId: payload.call_id,
    transcriptionLength: transcriptionText.length,
    hasUrl: !!transcriptionUrl
  };
}

/**
 * Process new tag webhook
 */
async function processNewTag(contact, payload) {
  console.log('🏷️ Processing new tag...');

  const noteText = `🏷️ NUOVO TAG DA CLOUDTALK

📞 Call ID: ${payload.call_id || 'N/A'}
🏷️ Tag: ${payload.tag_name || payload.tag || 'Tag non specificato'}
📱 Numero: ${payload.external_number}
📅 Timestamp: ${new Date().toLocaleString('it-IT')}

✅ Tag applicato automaticamente dal sistema CloudTalk`;

  const result = await addNoteToGHLContact(contact.id, noteText);

  return {
    action: 'tag_note_added',
    noteId: result.id,
    tag: payload.tag_name || payload.tag
  };
}

/**
 * Process new note webhook
 */
async function processNewNote(contact, payload) {
  console.log('📝 Processing new note...');

  const noteText = `📝 NUOVA NOTA DA CLOUDTALK

📞 Call ID: ${payload.call_id || 'N/A'}
📝 Nota: ${payload.note_content || payload.content || 'Contenuto non disponibile'}
👤 Aggiunto da: ${payload.user_name || payload.agent_name || 'Sistema'}
📅 Timestamp: ${new Date().toLocaleString('it-IT')}

✅ Nota sincronizzata da CloudTalk`;

  const result = await addNoteToGHLContact(contact.id, noteText);

  return {
    action: 'note_synced',
    noteId: result.id,
    originalNote: payload.note_content || payload.content
  };
}

/**
 * Process contact updated webhook
 */
async function processContactUpdate(contact, payload) {
  console.log('👤 Processing contact update...');

  const noteText = `👤 CONTATTO AGGIORNATO SU CLOUDTALK

📞 Call ID: ${payload.call_id || 'N/A'}
👤 Contatto: ${payload.contact_name || 'N/A'}
📱 Numero: ${payload.external_number}
🔄 Campi aggiornati: ${payload.updated_fields ? payload.updated_fields.join(', ') : 'Non specificati'}
📅 Timestamp: ${new Date().toLocaleString('it-IT')}

✅ Aggiornamento sincronizzato da CloudTalk`;

  const result = await addNoteToGHLContact(contact.id, noteText);

  return {
    action: 'update_logged',
    noteId: result.id,
    updatedFields: payload.updated_fields
  };
}

/**
 * Process call started webhook
 */
async function processCallStarted(contact, payload) {
  console.log('📞 Processing call started...');

  const noteText = `📞 CHIAMATA INIZIATA - CLOUDTALK

📞 Call ID: ${payload.call_id}
📱 Numero chiamante: ${payload.external_number}
👤 Agente: ${payload.agent_name || payload.agent_id || 'N/A'}
🕐 Ora inizio: ${new Date().toLocaleString('it-IT')}
📋 Tipo: ${payload.call_type || 'Non specificato'}

⏳ Chiamata in corso...`;

  const result = await addNoteToGHLContact(contact.id, noteText);

  return {
    action: 'call_start_logged',
    noteId: result.id,
    callId: payload.call_id
  };
}

/**
 * Process call ended webhook
 */
async function processCallEnded(contact, payload) {
  console.log('📞 Processing call ended...');

  const duration = payload.duration || 'N/A';
  const status = payload.call_status || payload.status || 'N/A';

  const noteText = `📞 CHIAMATA TERMINATA - CLOUDTALK

📞 Call ID: ${payload.call_id}
📱 Numero: ${payload.external_number}
👤 Agente: ${payload.agent_name || payload.agent_id || 'N/A'}
⏱️ Durata: ${duration}
📊 Stato: ${status}
🕐 Ora fine: ${new Date().toLocaleString('it-IT')}

✅ Chiamata completata`;

  const result = await addNoteToGHLContact(contact.id, noteText);

  return {
    action: 'call_end_logged',
    noteId: result.id,
    callId: payload.call_id,
    duration: duration,
    status: status
  };
}

// Test function with the webhook payload provided
async function testWebhookProcessor() {
  // Test payload from the call-recording-ready.txt file
  const testPayload = {
    "call_id": 1002226167,
    "recording_url": "https://my.cloudtalk.io/pub/r/MTAwMjIyNjE2Nw%3D%3D/NWYxZDY3MWEzOGY0ZTg3OTQ2ZjRmYzlmZmRmMmQxY2Q2ODU5N2U5ODQyZWE1MTJjNTZlYjVkMmM2Yjk2YjAwMw%3D%3D.wav",
    "internal_number": 40312296109,
    "external_number": "393936815798"
  };

  console.log('🧪 Testing webhook processor with real payload...\n');

  const result = await processCloudTalkWebhook(testPayload, 'call-recording-ready');

  console.log('\n📊 RISULTATO TEST:');
  console.log(JSON.stringify(result, null, 2));
}

// Run test if file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testWebhookProcessor().catch(error => {
    console.error('💥 Test fallito:', error.message);
    process.exit(1);
  });
}