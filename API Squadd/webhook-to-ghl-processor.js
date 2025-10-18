import 'dotenv/config';
import { searchGHLContactByPhone } from './tests/search-contact-by-phone.js';
import { addNoteToGHLContact } from './tests/add-note.js';
import { processRecordingTranscription, formatTranscriptionForGHL } from '../src/services/transcription-service.js';
import { uploadAudioToConversation } from '../src/services/ghl-conversation-service.js';
import { generateSmartCueCard, sendCueCard } from '../src/services/cuecard-service.js';

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
      
      // Estrai trascrizione e analisi AI
      const transcriptionText = transcription.result?.transcription || '';
      const aiAnalysisResult = transcription.result?.analysis;
      
      // 🆕 CONTROLLO AUDIO INCOMPRENSIBILE (nuovo branch)
      const isIncomprehensibleAudio = aiAnalysisResult?.call_type === 'incomprehensible_audio';

      if (isIncomprehensibleAudio) {
        console.log('❓ Audio non comprensibile rilevato (Amara.org patterns o placeholder)');
        console.log('🔍 Motivo:', aiAnalysisResult.reason);
        console.log('🎯 Pattern rilevati:', aiAnalysisResult.detected_patterns);

        noteText = `❓ CHIAMATA AVVENUTA MA SENZA AUDIO COMPRENSIBILE - CLOUDTALK`;

        const result = await addNoteToGHLContact(contact.id, noteText);

        // ✅ AUDIO INCOMPRENSIBILE: Solo nota (nessun webhook)

        return {
          action: 'incomprehensible_audio_detected',
          noteId: result.id,
          callId: payload.call_id,
          recordingUrl: payload.recording_url,
          transcriptionSuccess: true,
          isIncomprehensibleAudio: true,
          transcriptionText: transcriptionText,
          detectionReason: aiAnalysisResult.reason,
          detectedPatterns: aiAnalysisResult.detected_patterns,
          transcription: transcriptionResult
        };
      }

      // CONTROLLO SEGRETERIA: Trascrizione vuota/breve OPPURE AI rileva segreteria
      const isEmptyTranscription = !transcriptionText || transcriptionText.trim().length < 10;
      const isAIDetectedVoicemail = aiAnalysisResult?.call_type === 'segreteria';

      if (isEmptyTranscription || isAIDetectedVoicemail) {
        if (isEmptyTranscription) {
          console.log('📵 Trascrizione vuota/troppo breve - segreteria');
        } else {
          console.log('🤖 AI rilevato segreteria dal contenuto');
        }

        noteText = `📵 RISPONDE SEGRETERIA - CLOUDTALK`;

        const result = await addNoteToGHLContact(contact.id, noteText);

        // 🆕 SEGRETERIA: Invia webhook a GoHighLevel
        let ghlWebhookResult = null;
        try {
          const ghlWebhookUrl = 'https://services.leadconnectorhq.com/hooks/DfxGoORmPoL5Z1OcfYJM/webhook-trigger/873baa5c-928e-428a-ac68-498d954a9ff7';

          // 🔧 FIX: Recupera agent_id se mancante dal payload
          let agentId = payload.agent_id;
          if (!agentId && payload.call_id) {
            console.log('⚠️ agent_id mancante, recupero da CloudTalk API...');
            try {
              const { getCallDetails } = await import('../API CloudTalk/GET/get-call-details.js');
              const callDetails = await getCallDetails(payload.call_id);

              // Extract agent_id from call_steps (getCallDetails returns data directly, not wrapped)
              const agentStep = callDetails?.call_steps?.find(step => step.type === 'agent');
              if (agentStep?.id) {
                agentId = agentStep.id;
                console.log(`✅ agent_id recuperato: ${agentId} (${agentStep.name || 'Unknown'})`);
              } else {
                console.log('⚠️ Impossibile recuperare agent_id da CloudTalk API');
                console.log('📋 Call steps:', JSON.stringify(callDetails?.call_steps, null, 2));
              }
            } catch (agentError) {
              console.error('❌ Errore recuperando agent_id:', agentError.message);
            }
          }

          const ghlPayload = {
            event_type: 'cloudtalk_call_processed',
            call_type: 'voicemail',
            timestamp: new Date().toISOString(),
            call_id: payload.call_id,
            recording_url: payload.recording_url,
            internal_number: payload.internal_number,
            external_number: payload.external_number,
            agent_id: agentId || null, // 🔧 Usa agent_id recuperato, null se non disponibile
            contact_id: contact.id,
            detection_method: isEmptyTranscription ? 'empty_transcription' : 'ai_analysis',
            transcription_length: transcriptionText?.length || 0,
            webhook_received_at: new Date().toISOString(),
            source: 'cloudtalk_middleware'
          };

          console.log('📤 Inviando webhook a GHL per SEGRETERIA');
          console.log('📋 Payload GHL:', JSON.stringify(ghlPayload, null, 2));

          const ghlResponse = await fetch(ghlWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'CloudTalk-Middleware/1.0'
            },
            body: JSON.stringify(ghlPayload)
          });

          if (ghlResponse.ok) {
            const ghlResponseData = await ghlResponse.text();
            ghlWebhookResult = {
              success: true,
              message: 'Segreteria webhook inviato a GoHighLevel con successo',
              response: ghlResponseData
            };
            console.log('✅ Webhook GHL per SEGRETERIA inviato con successo:', ghlResponse.status);
          } else {
            const errorText = await ghlResponse.text();
            throw new Error(`GHL webhook failed: ${ghlResponse.status} - ${errorText}`);
          }

        } catch (ghlWebhookError) {
          console.error('❌ GHL Webhook per segreteria failed:', ghlWebhookError.message);

          ghlWebhookResult = {
            success: false,
            error: ghlWebhookError.message,
            message: 'GHL webhook failed but note processing continues'
          };
        }

        return {
          action: 'voicemail_detected',
          noteId: result.id,
          callId: payload.call_id,
          recordingUrl: payload.recording_url,
          transcriptionSuccess: true,
          isVoicemail: true,
          transcriptionText: transcriptionText,
          transcription: transcriptionResult,
          ghlWebhookResult: ghlWebhookResult || { success: false, reason: 'Not processed' }
        };
      }
      
      // Chiamata normale - procedi con upload audio e trascrizione completa
      console.log('📞 Chiamata normale rilevata, procedo con upload completo');

      // Try to upload audio directly to conversation
      console.log('📤 Attempting to upload audio to GHL conversation...');

      const uploadResult = await uploadAudioToConversation(
        contact.id,
        transcription.result.audioBuffer,
        formatTranscriptionForGHL(transcription.result),
        payload.call_id,
        payload.recording_url,
        payload.internal_number
      );

      if (uploadResult.success) {
        console.log('✅ Audio uploaded successfully to conversation!');

        // Add success note (formatTranscriptionForGHL already includes correct checkmark)
        noteText = formatTranscriptionForGHL(transcription.result);

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
        noteText = `⚠️ Upload audio fallito: ${uploadResult.error}\n\n${formatTranscriptionForGHL(transcription.result)}`;
      }

    } else {
      console.log(`⚠️ Transcription failed: ${transcription.error}`);
      const callId = payload.call_id || payload._correlationId || 'N/A';
      noteText = `⚠️ Trascrizione automatica fallita: ${transcription.error}\n\n📞 Call ID: ${callId}\n🔗 Recording URL: ${payload.recording_url}\n🎧 Clicca sul link sopra per ascoltare la registrazione`;
    }
  } else {
    const callId = payload.call_id || payload._correlationId || 'N/A';
    noteText = `✅ Registrazione disponibile per la revisione\n\n📞 Call ID: ${callId}\n🔗 Recording URL: ${payload.recording_url}\n🎧 Clicca sul link sopra per ascoltare la registrazione`;
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
  const callId = payload.call_id || payload._correlationId || 'N/A';

  const noteText = `📄 TRASCRIZIONE CLOUDTALK DISPONIBILE

📞 Call ID: ${callId}
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

  // NOTA GHL DISABILITATA - utente non la vuole
  // Step 1: Genera e invia Smart CueCard se abbiamo call_uuid
  let cueCardResult = null;
  if (payload.call_uuid || payload.Call_uuid) {
    try {
      console.log('🎯 Generando Smart CueCard per la chiamata...');
      
      const callUuid = payload.call_uuid || payload.Call_uuid;
      const phoneNumber = payload.external_number;
      
      // Genera CueCard con dati GHL integrati
      const smartCueCard = await generateSmartCueCard(phoneNumber);
      
      // Invia CueCard all'agente
      cueCardResult = await sendCueCard(callUuid, smartCueCard);
      
      console.log('✅ Smart CueCard inviata con successo!');
      
    } catch (cueCardError) {
      console.error('❌ Errore generazione Smart CueCard:', cueCardError.message);
      cueCardResult = { success: false, error: cueCardError.message };
    }
  } else {
    console.log('⚠️ Call UUID non trovato, Smart CueCard non inviata');
  }

  return {
    action: 'call_start_cuecard_only',
    callId: payload.call_id,
    cueCardSent: cueCardResult?.success || false,
    cueCardError: cueCardResult?.error || null
  };
}

/**
 * Process call ended webhook
 */
/**
 * Process call ended webhook
 */
async function processCallEnded(contact, payload) {
  console.log('📞 Processing call ended...');

  const duration = payload.duration || 0;
  const status = payload.call_status || payload.status || 'N/A';
  const callId = payload.call_id;

  // Determina se è una chiamata senza risposta
  const isNoAnswer = (
    !duration || 
    duration === 0 || 
    duration === 'N/A' ||
    status === 'missed' ||
    status === 'no-answer' ||
    status === 'unanswered' ||
    !callId ||
    callId === 'undefined'
  );

  let noteText;
  let action;

  if (isNoAnswer) {
    // Chiamata senza risposta
    noteText = `📵 TENTATIVO SENZA RISPOSTA - CLOUDTALK`;
    action = 'no_answer_logged';
  } else {
    // Chiamata effettivamente terminata
    noteText = `📞 CHIAMATA TERMINATA - CLOUDTALK\n\n📞 Call ID: ${callId}\n📱 Numero: ${payload.external_number}\n👤 Agente: ${payload.agent_name || payload.agent_id || 'N/A'}\n⏱️ Durata: ${duration}\n📊 Stato: ${status}\n🕐 Ora fine: ${new Date().toLocaleString('it-IT')}\n\n✅ Chiamata completata`;
    action = 'call_end_logged';
  }

  const result = await addNoteToGHLContact(contact.id, noteText);

  // REMOVED: Duplicate GHL webhook sending
  // This was causing DOUBLE webhook sending when used with handleCallEndedWebhook()
  // The GHL webhook forwarding is now handled exclusively in cloudtalk-webhooks.js
  // to prevent duplication issues reported by the user.

  console.log('📝 Note created in GHL, webhook forwarding handled by main webhook handler');

  const webhookResult = {
    success: false,
    skipped: true,
    reason: 'GHL webhook forwarding moved to primary webhook handler to prevent duplication'
  };

  return {
    action: action,
    noteId: result.id,
    callId: callId,
    duration: duration,
    status: status,
    isNoAnswer: isNoAnswer,
    webhookSent: webhookResult
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