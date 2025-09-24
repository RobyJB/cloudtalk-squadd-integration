import 'dotenv/config';
import { searchGHLContactByPhone } from '../../API Squadd/tests/search-contact-by-phone.js';
import { getContactNotes } from '../../API Squadd/tests/get-contact-notes.js';
import { getCalls } from '../../API CloudTalk/GET/get-calls.js';

/**
 * CloudTalk CueCard Service con integrazione GoHighLevel
 * 
 * Genera CueCard intelligenti che mostrano:
 * 1. Dati del contatto da GoHighLevel 
 * 2. Link diretto al contatto GHL
 * 3. Storico chiamate CloudTalk
 * 4. AI Analysis precedenti
 * 5. BANT Score e coaching tips
 */

export async function generateSmartCueCard(phoneNumber, callUuid = null) {
  console.log(`🎯 Generating smart CueCard for: ${phoneNumber}`);

  try {
    // Step 1: Cerca contatto in GoHighLevel
    const ghlContact = await searchGHLContactByPhone(phoneNumber);
    
    // Step 2: Ottieni storico chiamate CloudTalk  
    const callHistory = await getCallHistoryForPhone(phoneNumber);

    // Step 3: Ottieni dati AI/trascrizioni se disponibili
    const aiData = await getAIDataForContact(phoneNumber);

    // Step 4: Se contatto trovato, ottieni anche le note GHL
    let ghlNotes = [];
    if (ghlContact) {
      try {
        console.log(`📝 Recuperando note GHL per contatto: ${ghlContact.id}`);
        ghlNotes = await getContactNotes(ghlContact.id);
      } catch (notesError) {
        console.log(`⚠️ Errore recupero note GHL: ${notesError.message}`);
        // Continua senza note se fallisce
      }
    }

    // Step 5: Genera CueCard in base ai dati disponibili
    if (!ghlContact) {
      return generateNewLeadCueCard(phoneNumber, callHistory);
    }

    return generateExistingContactCueCard(ghlContact, callHistory, aiData, ghlNotes);

  } catch (error) {
    console.error('❌ Errore generazione CueCard:', error.message);
    return generateErrorCueCard(phoneNumber, error.message);
  }
}

/**
 * CueCard per contatto esistente in GHL (caso principale)
 */
function generateExistingContactCueCard(contact, callHistory, aiData, ghlNotes = []) {
  const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
  const contactName = fullName || 'Contatto Sconosciuto';
  
  // Costruisci URL diretto al contatto GHL
  const ghlContactUrl = `https://app.gohighlevel.com/location/${process.env.GHL_LOCATION_ID}/contacts/detail/${contact.id}`;
  
  // Calcola statistiche chiamate
  const totalCalls = callHistory?.length || 0;
  const answeredCalls = callHistory?.filter(c => c.status === 'answered')?.length || 0;
  const conversionRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0;

  // Ottieni ultima attività
  const lastCall = callHistory?.[0];
  const lastCallDate = lastCall ? new Date(lastCall.date_time).toLocaleDateString('it-IT') : 'Mai';

  // BANT Score se disponibile
  const bantScore = aiData?.bantScore || null;
  
  return {
    call_uuid: null, // Sarà impostato dal chiamante
    type: "blocks",
    title: `🎯 ${contactName}`,
    subtitle: `${contact.phone || 'N/A'} - ${contact.email || 'N/A'}`,
    content: [
      {
        type: "richtext",
        name: "🔗 APRI CONTATTO GHL",
        value: `<a href="${ghlContactUrl}" target="_blank" style="background: #ff6b35; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-weight: bold;">📱 APRI ${contactName.toUpperCase()}</a>`
      },
      {
        type: "textfield",
        name: "📞 Telefono",
        value: contact.phone || 'N/A'
      },
      {
        type: "textfield", 
        name: "📧 Email",
        value: contact.email || 'Non disponibile'
      },
      {
        type: "textfield",
        name: "📊 Chiamate Totali",
        value: `${totalCalls} chiamate | ${answeredCalls} risposto | ${conversionRate}% conversion`
      },
      {
        type: "textfield",
        name: "📅 Ultima Chiamata", 
        value: lastCallDate
      },
      // BANT Score se disponibile
      ...(bantScore ? [{
        type: "richtext",
        name: "🎯 BANT Score",
        value: `<b>Budget:</b> ${bantScore.budget}/5 | <b>Authority:</b> ${bantScore.authority}/5<br/><b>Need:</b> ${bantScore.need}/5 | <b>Timeline:</b> ${bantScore.timeline}/5`
      }] : []),
      // AI Coaching se disponibile  
      ...(aiData?.coachingTip ? [{
        type: "richtext",
        name: "💡 AI Coaching",
        value: `<b style="color: #ff6b35;">${aiData.coachingTip}</b>`
      }] : []),
      // Ultime note da GHL se disponibili
      ...(ghlNotes.length > 0 ? [{
        type: "richtext",
        name: "📝 Ultime Note GHL",
        value: formatNotesForCueCard(ghlNotes.slice(0, 2)) // Mostra le 2 più recenti
      }] : []),
      // Custom fields come fallback
      ...(contact.customFields?.note ? [{
        type: "textfield",
        name: "📝 Note Custom",
        value: contact.customFields.note.substring(0, 100) + '...'
      }] : [])
    ]
  };
}

/**
 * CueCard per nuovo lead (non in GHL)  
 */
function generateNewLeadCueCard(phoneNumber, callHistory) {
  const totalCalls = callHistory?.length || 0;
  
  return {
    call_uuid: null,
    type: "blocks", 
    title: `🆕 NUOVO LEAD`,
    content: [
      {
        type: "richtext",
        name: "⚠️ ATTENZIONE",
        value: `<b style="color: #e74c3c;">CONTATTO NON IN GHL!</b>`
      },
      {
        type: "textfield",
        name: "📞 Numero",
        value: phoneNumber
      },
      {
        type: "textfield",
        name: "📊 Storico CloudTalk",
        value: `${totalCalls} chiamate precedenti`
      },
      {
        type: "richtext", 
        name: "🎯 AZIONE RICHIESTA",
        value: `<b>1. Qualifica il lead</b><br/><b>2. Aggiungi a GHL se qualificato</b><br/><b>3. Imposta follow-up</b>`
      }
    ]
  };
}

/**
 * CueCard di errore
 */
function generateErrorCueCard(phoneNumber, errorMessage) {
  return {
    call_uuid: null,
    type: "blocks",
    title: `⚠️ ERRORE CUECARD`,
    content: [
      {
        type: "textfield",
        name: "📞 Numero", 
        value: phoneNumber
      },
      {
        type: "textfield",
        name: "❌ Errore",
        value: errorMessage.substring(0, 100)
      },
      {
        type: "richtext",
        name: "🔄 Soluzione", 
        value: `<b>Procedi con la chiamata manualmente</b><br/>Verifica connessione GHL dopo la chiamata`
      }
    ]
  };
}

/**
 * Ottieni storico chiamate per numero di telefono
 */
async function getCallHistoryForPhone(phoneNumber) {
  try {
    console.log(`📞 Fetching call history for: ${phoneNumber}`);
    
    const response = await getCalls({
      public_external: phoneNumber,
      limit: 10,
      sort: 'desc'
    });

    if (response.success && response.responseData?.data) {
      return response.responseData.data.map(call => ({
        id: call.Cdr?.id,
        date_time: call.Cdr?.date_time,
        status: call.Cdr?.status,
        duration: call.Cdr?.duration,
        direction: call.Cdr?.type
      }));
    }

    return [];
  } catch (error) {
    console.error('❌ Errore recupero storico chiamate:', error.message);
    return [];
  }
}

/**
 * Formatta le note GHL per la visualizzazione nella CueCard
 */
function formatNotesForCueCard(notes) {
  if (!notes || notes.length === 0) {
    return 'Nessuna nota disponibile';
  }

  return notes
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
    .map((note, index) => {
      const date = new Date(note.dateAdded).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
      
      // Estrai la prima riga della nota come preview
      const firstLine = note.body.split('\n')[0];
      const preview = firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine;
      
      return `<b>${date}:</b> ${preview}`;
    })
    .join('<br/>');
}

/**
 * Ottieni dati AI/trascrizioni per contatto
 */
async function getAIDataForContact(phoneNumber) {
  try {
    // TODO: Implementa recupero dati AI dal database SQLite
    // Per ora ritorna dati mock
    return {
      bantScore: {
        budget: 4,
        authority: 3, 
        need: 5,
        timeline: 2
      },
      coachingTip: "Cliente tecnico - usa linguaggio specifico. Focus su ROI e integrazione."
    };
  } catch (error) {
    console.error('❌ Errore recupero dati AI:', error.message);
    return null;
  }
}

/**
 * Invia CueCard a CloudTalk
 */
export async function sendCueCard(callUuid, cueCardData) {
  console.log(`📤 Sending CueCard for call: ${callUuid}`);
  
  // DEBUG: Gli UUID dei webhook non funzionano con Analytics API (sempre 400)
  // Problema: CloudTalk CueCard API non accetta questi UUID
  console.log(`⚠️ PROBLEMA IDENTIFICATO: UUID ${callUuid} non riconosciuto da CloudTalk APIs`);
  console.log('🔍 Possibili cause:');
  console.log('   1. UUID webhook diverso da UUID interno CloudTalk');
  console.log('   2. CueCard API richiede CDR ID invece di UUID');
  console.log('   3. Chiamata non ancora registrata nei sistemi interni');
  console.log('   4. CueCard API non abilitata per questo tenant');
  
  // TODO: Provare con CDR ID se disponibile nel webhook
  
  // Imposta il call_uuid nella CueCard
  cueCardData.call_uuid = callUuid;
  
  try {
    // Delay di 5 secondi per permettere a CloudTalk di registrare la chiamata attiva
    console.log('⏳ Waiting 5 seconds for CloudTalk call registration...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('📋 CueCard data:', JSON.stringify(cueCardData, null, 2));
    
    // Retry logic con backoff exponential per 424 errors
    let response;
    let attempt = 0;
    const maxAttempts = 3;
    
    while (attempt < maxAttempts) {
      attempt++;
      console.log(`🚀 Attempt ${attempt}/${maxAttempts} - Sending CueCard...`);
      
      // Usa formato corretto secondo documentazione ufficiale
      // Invia l'array di ContentBlock direttamente come da API spec
      const platformApiData = {
        call_uuid: cueCardData.call_uuid,
        type: cueCardData.type || 'info', 
        title: cueCardData.title,
        subtitle: cueCardData.subtitle || '',
        content: cueCardData.content // Array di ContentBlock come richiesto dalla API
      };
      
      console.log(`📊 Platform API (formato corretto):`, JSON.stringify(platformApiData, null, 2));
      
      response = await fetch('https://platform-api.cloudtalk.io/api/cuecards', {
        method: 'POST',
        body: JSON.stringify(platformApiData),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${process.env.CLOUDTALK_API_KEY_ID}:${process.env.CLOUDTALK_API_SECRET}`).toString('base64')}`
        }
      });
      
      if (response.ok) {
        console.log(`✅ CueCard inviata con successo al tentativo ${attempt}!`);
        break;
      }
      
      if (response.status === 424 && attempt < maxAttempts) {
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⚠️ Tentativo ${attempt} fallito (424), retry tra ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // Altri errori o ultimo tentativo
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    console.log('✅ CueCard inviata con successo a CloudTalk!');
    
    const responseData = await response.json();
    
    return {
      success: true,
      cueCardData: cueCardData,
      cloudTalkResponse: responseData
    };
    
  } catch (error) {
    // Handle expected CloudTalk errors
    if (error.response?.status === 404) {
      console.log('⚠️ CloudTalk CueCard endpoint non disponibile (404)');
      return {
        success: false,
        error: 'CueCard API non disponibile',
        cueCardData: cueCardData
      };
    }
    
    if (error.response?.status === 424) {
      console.log('⚠️ Nessuna chiamata attiva trovata per CueCard (424)');
      return {
        success: false,
        error: 'Chiamata non attiva',
        cueCardData: cueCardData
      };
    }
    
    console.error('❌ Errore invio CueCard:', error.message);
    
    // Log fallback per debug
    console.log('📋 Fallback CueCard data:', JSON.stringify(cueCardData, null, 2));
    
    return {
      success: false,
      error: error.message,
      cueCardData: cueCardData
    };
  }
}

/**
 * Test della funzionalità
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 Testing Smart CueCard generation...\n');
  
  // Test con numero Roberto
  generateSmartCueCard('+393513416607')
    .then(cueCard => {
      console.log('✅ CueCard generata:');
      console.log(JSON.stringify(cueCard, null, 2));
    })
    .catch(error => {
      console.error('❌ Test fallito:', error.message);
      process.exit(1);
    });
}