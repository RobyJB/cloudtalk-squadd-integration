import { log, logError } from '../logger.js';
import fs from 'fs';
import path from 'path';

/**
 * GoHighLevel Call Attempts Service
 *
 * Gestisce l'incremento automatico del campo "Numero di tentativi di chiamata"
 * nei contatti GoHighLevel quando riceve webhook CloudTalk di chiamate terminate.
 *
 * Flusso:
 * 1. Riceve webhook call-ended da CloudTalk
 * 2. Cerca contatto GHL per numero di telefono
 * 3. Legge e incrementa campo "Numero di tentativi di chiamata" (TX3ddYyNVlvExyE5YG1H)
 * 4. Aggiorna il contatto in GHL
 * 5. Log per tracking e debug
 */

// Configurazione GoHighLevel
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

// ID del campo custom "Numero di tentativi di chiamata"
const CALL_ATTEMPTS_FIELD_ID = process.env.TOTAL_ATTEMPTS_FIELD_ID || 'TX3ddYyNVlvExyE5YG1H';
const CALL_ATTEMPTS_FIELD_KEY = process.env.TOTAL_ATTEMPTS_FIELD_KEY || 'Numero di tentativi di chiamata';

// Logger dedicato per il servizio
const logDir = path.resolve('logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const serviceLogFile = path.join(logDir, 'ghl-call-attempts.log');

/**
 * Log strutturato per il servizio call attempts
 */
function logCallAttempts(level, correlationId, data) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    correlation_id: correlationId,
    service: 'ghl-call-attempts',
    ...data
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  // Log su file dedicato
  fs.appendFileSync(serviceLogFile, logLine);

  // Log anche su console/file generale
  const message = `[GHL-CallAttempts] ${level}: ${correlationId} - ${JSON.stringify(data)}`;
  if (level === 'error') {
    logError(message);
  } else {
    log(message);
  }
}

/**
 * Normalizza numero di telefono per la ricerca in GHL
 * GHL può contenere numeri in formati diversi (+393XXX, 393XXX, etc.)
 */
function normalizePhoneForGHL(rawPhone) {
  if (!rawPhone) return null;

  let phone = rawPhone.toString().trim();

  // Se inizia già con +, mantieni così
  if (phone.startsWith('+')) {
    return phone;
  }

  // Se inizia con 393 (Italia mobile), aggiungi +
  if (phone.startsWith('393')) {
    return '+' + phone;
  }

  // Se inizia con 39 (Italia), aggiungi +
  if (phone.startsWith('39') && phone.length >= 10) {
    return '+' + phone;
  }

  // Altri numeri lunghi senza +
  if (phone.length >= 10 && !phone.startsWith('+')) {
    return '+' + phone;
  }

  return phone;
}

/**
 * Estrae il numero di telefono dal webhook CloudTalk
 * Gestisce il formato reale dei webhook CloudTalk per call-ended
 */
function extractPhoneFromCloudTalkWebhook(webhookPayload) {
  // Il payload reale CloudTalk contiene external_number
  if (webhookPayload.external_number) {
    return webhookPayload.external_number.toString();
  }

  // Fallback su altri campi possibili
  if (webhookPayload.Contact_phone) {
    return webhookPayload.Contact_phone.toString();
  }

  if (webhookPayload.to_number) {
    return webhookPayload.to_number.toString();
  }

  if (webhookPayload.from_number) {
    return webhookPayload.from_number.toString();
  }

  return null;
}

/**
 * Cerca contatto GoHighLevel per numero di telefono
 * Usa l'API /contacts/ con filtri
 */
async function findGHLContactByPhone(phoneNumber, correlationId) {
  const normalizedPhone = normalizePhoneForGHL(phoneNumber);

  logCallAttempts('info', correlationId, {
    action: 'search_ghl_contact',
    phone_original: phoneNumber,
    phone_normalized: normalizedPhone
  });

  try {
    // Cerca contatti che contengono questo numero
    const response = await fetch(`${GHL_BASE_URL}/contacts/?locationId=${GHL_LOCATION_ID}&limit=50`, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`GHL API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const contacts = data.contacts || [];

    logCallAttempts('info', correlationId, {
      action: 'ghl_search_response',
      total_contacts: contacts.length,
      phone_searching: normalizedPhone
    });

    // Cerca il contatto che ha questo numero di telefono
    for (const contact of contacts) {
      if (contact.phone) {
        const contactPhone = normalizePhoneForGHL(contact.phone);
        if (contactPhone === normalizedPhone) {
          logCallAttempts('info', correlationId, {
            action: 'ghl_contact_found',
            contact_id: contact.id,
            contact_name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
            phone_matched: contactPhone
          });

          return contact;
        }
      }

      // Controlla anche additionalPhones se presenti
      if (contact.additionalPhones && Array.isArray(contact.additionalPhones)) {
        for (const additionalPhone of contact.additionalPhones) {
          const addPhone = normalizePhoneForGHL(additionalPhone);
          if (addPhone === normalizedPhone) {
            logCallAttempts('info', correlationId, {
              action: 'ghl_contact_found_additional_phone',
              contact_id: contact.id,
              contact_name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
              phone_matched: addPhone
            });

            return contact;
          }
        }
      }
    }

    // Contatto non trovato
    logCallAttempts('warn', correlationId, {
      action: 'ghl_contact_not_found',
      phone: normalizedPhone,
      searched_contacts: contacts.length
    });

    return null;

  } catch (error) {
    logCallAttempts('error', correlationId, {
      action: 'ghl_contact_search_failed',
      phone: normalizedPhone,
      error: error.message
    });
    throw error;
  }
}

/**
 * Ottiene il valore corrente del campo tentativi di chiamata dal contatto GHL
 * I custom fields in GHL sono un array di oggetti con {id, value}
 */
function getCurrentCallAttempts(contact) {
  if (!contact.customFields || !Array.isArray(contact.customFields)) {
    return 0;
  }

  const attemptField = contact.customFields.find(field => field.id === CALL_ATTEMPTS_FIELD_ID);

  if (attemptField && attemptField.value) {
    const attempts = parseInt(attemptField.value);
    return isNaN(attempts) ? 0 : attempts;
  }

  return 0;
}

/**
 * Aggiorna il campo tentativi di chiamata per un contatto GHL
 * Usa l'API PUT /contacts/{contactId} per aggiornare solo il custom field specifico
 */
async function updateGHLCallAttempts(contact, newAttempts, correlationId) {
  logCallAttempts('info', correlationId, {
    action: 'update_ghl_call_attempts',
    contact_id: contact.id,
    contact_name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
    new_attempts: newAttempts,
    field_id: CALL_ATTEMPTS_FIELD_ID
  });

  try {
    // Prepara i custom fields con il valore aggiornato
    // GHL API richiede custom fields come array di oggetti con {id, value}
    const updateData = {
      customFields: [
        {
          id: CALL_ATTEMPTS_FIELD_ID,
          value: newAttempts.toString()
        }
      ]
    };

    const response = await fetch(`${GHL_BASE_URL}/contacts/${contact.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GHL update error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    logCallAttempts('info', correlationId, {
      action: 'ghl_call_attempts_updated',
      contact_id: contact.id,
      new_attempts: newAttempts,
      response_status: response.status
    });

    return {
      success: true,
      attempts: newAttempts,
      contact: {
        id: contact.id,
        name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
      }
    };

  } catch (error) {
    logCallAttempts('error', correlationId, {
      action: 'ghl_update_failed',
      contact_id: contact.id,
      new_attempts: newAttempts,
      error: error.message
    });
    throw error;
  }
}

/**
 * Processo principale: gestisce webhook call-ended di CloudTalk
 * per incrementare tentativi di chiamata in GoHighLevel
 *
 * @param {Object} webhookPayload - Payload del webhook CloudTalk
 * @param {string} correlationId - ID per tracciamento (es. call_uuid)
 * @returns {Object} Risultato del processing
 */
async function processCloudTalkCallEndedForGHL(webhookPayload, correlationId) {
  const startTime = Date.now();

  logCallAttempts('info', correlationId, {
    event_type: 'cloudtalk-call-ended-to-ghl',
    action: 'process_start',
    payload_keys: Object.keys(webhookPayload)
  });

  try {
    // Validazione configurazione
    if (!GHL_API_KEY || !GHL_LOCATION_ID) {
      throw new Error('GHL_API_KEY and GHL_LOCATION_ID must be configured');
    }

    // 1. Estrai numero di telefono dal webhook CloudTalk
    const phoneNumber = extractPhoneFromCloudTalkWebhook(webhookPayload);
    if (!phoneNumber) {
      logCallAttempts('warn', correlationId, {
        action: 'phone_extraction_failed',
        payload: webhookPayload
      });
      return { success: false, reason: 'No phone number found in CloudTalk webhook' };
    }

    // 2. Cerca contatto in GoHighLevel
    const ghlContact = await findGHLContactByPhone(phoneNumber, correlationId);
    if (!ghlContact) {
      logCallAttempts('warn', correlationId, {
        action: 'ghl_contact_not_found',
        phone: phoneNumber
      });
      return { success: true, reason: 'GHL contact not found, nothing to update' };
    }

    // 3. Calcola nuovo numero di tentativi
    const currentAttempts = getCurrentCallAttempts(ghlContact);
    const newAttempts = currentAttempts + 1;

    logCallAttempts('info', correlationId, {
      action: 'call_attempts_calculation',
      contact_id: ghlContact.id,
      contact_name: `${ghlContact.firstName || ''} ${ghlContact.lastName || ''}`.trim(),
      attempts_current: currentAttempts,
      attempts_new: newAttempts,
      field_id: CALL_ATTEMPTS_FIELD_ID
    });

    // 4. Aggiorna il contatto in GHL
    const updateResult = await updateGHLCallAttempts(ghlContact, newAttempts, correlationId);

    // 5. Risultato finale
    const duration = Date.now() - startTime;

    logCallAttempts('info', correlationId, {
      action: 'process_complete',
      outcome: 'success',
      contact_id: ghlContact.id,
      phone_masked: phoneNumber.replace(/\d(?=\d{4})/g, '*'),
      attempts_previous: currentAttempts,
      attempts_new: newAttempts,
      duration_ms: duration
    });

    return {
      success: true,
      contact: {
        id: ghlContact.id,
        name: `${ghlContact.firstName || ''} ${ghlContact.lastName || ''}`.trim(),
        phone: phoneNumber
      },
      attempts: {
        previous: currentAttempts,
        new: newAttempts
      },
      duration: duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    logCallAttempts('error', correlationId, {
      action: 'process_failed',
      error: error.message,
      error_stack: error.stack,
      duration_ms: duration
    });

    throw error;
  }
}

/**
 * Test della configurazione e connessione GHL
 * Utile per debugging e verifica setup
 */
async function testGHLConnection() {
  console.log('🧪 Test connessione GoHighLevel');
  console.log('API Key:', GHL_API_KEY ? GHL_API_KEY.substring(0, 15) + '...' : 'Non configurata');
  console.log('Location ID:', GHL_LOCATION_ID || 'Non configurato');
  console.log('Campo tentativi ID:', CALL_ATTEMPTS_FIELD_ID);
  console.log('Campo tentativi nome:', CALL_ATTEMPTS_FIELD_KEY);
  console.log('');

  try {
    const response = await fetch(`${GHL_BASE_URL}/contacts/?locationId=${GHL_LOCATION_ID}&limit=1`, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Connessione GHL: OK');
      console.log(`📊 Totale contatti: ${data.meta?.total || 'N/A'}`);
      console.log(`📋 Contatti ricevuti: ${data.contacts?.length || 0}`);

      if (data.contacts && data.contacts.length > 0) {
        const firstContact = data.contacts[0];
        const hasCallField = firstContact.customFields?.some(f => f.id === CALL_ATTEMPTS_FIELD_ID);
        console.log(`🎯 Primo contatto ha campo tentativi: ${hasCallField ? '✅' : '❌'}`);

        if (hasCallField) {
          const attempts = getCurrentCallAttempts(firstContact);
          console.log(`📞 Tentativi attuali: ${attempts}`);
        }
      }

      return true;

    } else {
      console.error('❌ Connessione GHL: FALLITA');
      console.error(`Status: ${response.status}`);
      const errorText = await response.text();
      console.error(`Error: ${errorText}`);
      return false;
    }

  } catch (error) {
    console.error('❌ Errore test connessione:', error.message);
    return false;
  }
}

export {
  processCloudTalkCallEndedForGHL,
  findGHLContactByPhone,
  updateGHLCallAttempts,
  getCurrentCallAttempts,
  normalizePhoneForGHL,
  extractPhoneFromCloudTalkWebhook,
  testGHLConnection,
  logCallAttempts,
  CALL_ATTEMPTS_FIELD_ID,
  CALL_ATTEMPTS_FIELD_KEY
};