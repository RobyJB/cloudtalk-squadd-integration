import { getContacts } from '../../API CloudTalk/GET/get-contacts.js';
import { getContactDetails } from '../../API CloudTalk/GET/get-contact-details.js';
import { getCampaigns } from '../../API CloudTalk/GET/get-campaigns.js';
import { editContact } from '../../API CloudTalk/POST/post-edit-contact.js';
import { log, logError } from '../logger.js';
import fs from 'fs';
import path from 'path';

/**
 * CloudTalk Campaign Automation Service
 * 
 * Gestisce la progressione automatica dei lead tra campagne basandosi
 * sul numero di tentativi di chiamata (campo custom "# di tentativi di chiamata").
 * 
 * Flusso:
 * 1. Riceve webhook call-ended
 * 2. Cerca contatto per numero di telefono o contact_id
 * 3. Legge e incrementa campo "# di tentativi di chiamata"
 * 4. Controlla soglie (3 → Lead Recenti, 10 → Mancata Risposta)
 * 5. Sposta tra campagne se necessario
 */

// Configurazione soglie per cambio tag
const THRESHOLDS = {
  FOLLOW_UP: 3,         // A 3 tentativi: cambia a "Follow Up"  
  MANCATA_RISPOSTA: 10  // A 10 tentativi: cambia a "Mancata Risposta"
};

// Nomi tag campagne (configurabili via ENV)
const CAMPAIGN_TAGS = {
  NUOVI_LEAD: process.env.CLOUDTALK_TAG_NUOVI_LEAD || 'Nuovi Lead',
  FOLLOW_UP: process.env.CLOUDTALK_TAG_FOLLOW_UP || 'Follow Up', 
  MANCATA_RISPOSTA: process.env.CLOUDTALK_TAG_MANCATA_RISPOSTA || 'Mancata Risposta'
};

// Campo custom per tentativi
const ATTEMPTS_FIELD_KEY = process.env.TOTAL_ATTEMPTS_FIELD_KEY || '# di tentativi di chiamata';

// Cache campagne (TTL 5 minuti)
const campaignCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minuti

// Logger dedicato per campaign automation
const logDir = path.resolve('logs');
const automationLogFile = path.join(logDir, 'cloudtalk-campaign-automation.log');

/**
 * Log strutturato per campaign automation
 */
function logAutomation(level, correlationId, data) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    correlation_id: correlationId,
    service: 'campaign-automation',
    ...data
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  
  // Log su file dedicato
  fs.appendFileSync(automationLogFile, logLine);
  
  // Log anche su console/file generale
  const message = `[Campaign-Auto] ${level}: ${correlationId} - ${JSON.stringify(data)}`;
  if (level === 'error') {
    logError(message);
  } else {
    log(message);
  }
}

/**
 * Estrae il numero di telefono dal webhook call-ended
 */
function extractPhoneFromWebhook(webhookPayload) {
  // Il payload real che riceviamo contiene external_number
  if (webhookPayload.external_number) {
    return webhookPayload.external_number.toString();
  }
  
  // Fallback su altri campi possibili
  if (webhookPayload.Contact_phone) {
    return webhookPayload.Contact_phone;
  }
  
  if (webhookPayload.to_number) {
    return webhookPayload.to_number;
  }
  
  if (webhookPayload.from_number) {
    return webhookPayload.from_number;  
  }
  
  return null;
}

/**
 * Normalizza numero di telefono in formato E.164
 * Riusa logica esistente o implementa base
 */
function normalizePhone(rawPhone) {
  if (!rawPhone) return null;
  
  let phone = rawPhone.toString().trim();
  
  // Se inizia già con +, è probabile sia E.164
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
  
  // Altri paesi... per ora assumiamo sia già corretto
  if (phone.length >= 10 && !phone.startsWith('+')) {
    return '+' + phone; 
  }
  
  return phone;
}

/**
 * Cerca contatto per numero di telefono
 * Usa API esistente get-contacts con keyword search
 */
async function getContactByPhone(phone, correlationId) {
  const normalizedPhone = normalizePhone(phone);
  
  logAutomation('info', correlationId, {
    action: 'search_contact',
    phone_original: phone,
    phone_normalized: normalizedPhone
  });
  
  try {
    // Cerca per numero esatto
    const response = await getContacts({ keyword: normalizedPhone, limit: 10 });
    
    if (response?.responseData?.data) {
      // Trova contatto che ha questo numero nei contact_numbers
      for (const item of response.responseData.data) {
        const contact = item.Contact;
        const contactNumbers = item.ContactNumber || [];
        
        // Gestisci diversi formati di ritorno API
        const numbersToCheck = [];
        
        if (Array.isArray(contactNumbers)) {
          numbersToCheck.push(...contactNumbers);
        } else if (contactNumbers && contactNumbers.public_number) {
          numbersToCheck.push(contactNumbers);
        }
        
        // Aggiungi anche i numeri da contact_numbers se presente nell'oggetto Contact
        if (contact.contact_numbers && Array.isArray(contact.contact_numbers)) {
          contact.contact_numbers.forEach(num => {
            numbersToCheck.push({ public_number: num });
          });
        }
        
        // Controlla se il contatto ha questo numero
        for (const numberData of numbersToCheck) {
          const contactPhone = normalizePhone(numberData.public_number || numberData);
          if (contactPhone === normalizedPhone) {
            logAutomation('info', correlationId, {
              action: 'contact_found',
              contact_id: contact.id,
              contact_name: contact.name,
              phone_matched: contactPhone
            });
            
            // Ottieni i dettagli completi del contatto inclusi i custom fields
            logAutomation('info', correlationId, {
              action: 'fetch_contact_details',
              contact_id: contact.id
            });
            
            const contactDetails = await getContactDetails(contact.id);
            const fullContact = contactDetails.responseData.Contact;
            const contactAttributes = contactDetails.responseData.ContactAttribute || [];
            
            return {
              id: fullContact.id,
              name: fullContact.name,
              contact_attributes: contactAttributes,
              ...fullContact
            };
          }
        }
      }
    }
    
    // Contatto non trovato
    logAutomation('warn', correlationId, {
      action: 'contact_not_found',
      phone: normalizedPhone,
      search_results: response?.responseData?.itemsCount || 0
    });
    
    return null;
    
  } catch (error) {
    logAutomation('error', correlationId, {
      action: 'contact_search_failed',
      phone: normalizedPhone,
      error: error.message
    });
    throw error;
  }
}

/**
 * Ottiene valore campo custom dal contatto (ContactAttribute)
 */
function getCustomField(contact, fieldKey) {
  if (!contact.contact_attributes || !Array.isArray(contact.contact_attributes)) {
    return null;
  }
  
  const field = contact.contact_attributes.find(f => f.title === fieldKey);
  return field ? field.value : null;
}

/**
 * Aggiorna campo custom del contatto
 */
async function updateContactCustomField(contactId, fieldKey, value, correlationId, existingContactData = null) {
  logAutomation('info', correlationId, {
    action: 'update_custom_field',
    contact_id: contactId,
    field_key: fieldKey,
    field_value: value
  });
  
  try {
    // Usa i dati del contatto già ottenuti se forniti, altrimenti cerca
    let existingContact = existingContactData;
    
    if (!existingContact) {
      // Fallback: cerca contatto per ID (probabilmente non funziona con keyword)
      throw new Error(`Contact data not provided and cannot lookup contact ${contactId}`);
    }
    
    // Trova l'attribute_id per il campo richiesto
    const targetAttribute = existingContact.contact_attributes.find(attr => attr.title === fieldKey);
    if (!targetAttribute) {
      throw new Error(`ContactAttribute "${fieldKey}" not found for contact ${contactId}`);
    }
    
    // Prepara i dati di aggiornamento con campi obbligatori
    const updateData = {
      name: existingContact.name, // Campo obbligatorio
      ContactAttribute: [
        { 
          attribute_id: targetAttribute.attribute_id,
          value: value.toString()
        }
      ]
    };
    
    // Preserva altri campi importanti se presenti
    if (existingContact.title) updateData.title = existingContact.title;
    if (existingContact.company) updateData.company = existingContact.company;
    if (existingContact.industry) updateData.industry = existingContact.industry;
    
    await editContact(contactId, updateData);
    
    logAutomation('info', correlationId, {
      action: 'custom_field_updated',
      contact_id: contactId,
      field_key: fieldKey,
      field_value: value
    });
    
    return true;
    
  } catch (error) {
    logAutomation('error', correlationId, {
      action: 'custom_field_update_failed', 
      contact_id: contactId,
      field_key: fieldKey,
      field_value: value,
      error: error.message
    });
    throw error;
  }
}

/**
 * Ottiene ID campagna per nome (con cache)
 */
async function getCampaignIdByName(campaignName, correlationId) {
  const cacheKey = `campaign_${campaignName}`;
  const now = Date.now();
  
  // Controlla cache
  if (campaignCache.has(cacheKey)) {
    const cached = campaignCache.get(cacheKey);
    if (now - cached.timestamp < CACHE_TTL) {
      logAutomation('info', correlationId, {
        action: 'campaign_cache_hit',
        campaign_name: campaignName,
        campaign_id: cached.id
      });
      return cached.id;
    }
  }
  
  // Cerca campagna
  try {
    const response = await getCampaigns({ limit: 100 });
    
    if (response?.responseData?.data) {
      for (const item of response.responseData.data) {
        const campaign = item.Campaign;
        if (campaign.name === campaignName) {
          // Salva in cache
          campaignCache.set(cacheKey, {
            id: campaign.id,
            timestamp: now
          });
          
          logAutomation('info', correlationId, {
            action: 'campaign_found',
            campaign_name: campaignName,
            campaign_id: campaign.id
          });
          
          return campaign.id;
        }
      }
    }
    
    logAutomation('error', correlationId, {
      action: 'campaign_not_found',
      campaign_name: campaignName
    });
    
    return null;
    
  } catch (error) {
    logAutomation('error', correlationId, {
      action: 'campaign_search_failed',
      campaign_name: campaignName,
      error: error.message
    });
    throw error;
  }
}

/**
 * Gestisce i tag delle campagne basandosi sul numero di tentativi
 * Sostituisce la logica di spostamento tra campagne usando i tag CloudTalk
 */
async function manageCampaignTags(contactId, currentAttempts, contactData, correlationId) {
  try {
    logAutomation('info', correlationId, {
      action: 'campaign_tag_management_start',
      contact_id: contactId,
      current_attempts: currentAttempts,
      contact_name: contactData?.name
    });
    
    // Determina quali tag assegnare in base ai tentativi
    let targetTags = [];
    let removedTags = [];
    let addedTags = [];
    
    if (currentAttempts >= 1 && currentAttempts <= 2) {
      // 1-2 tentativi: Tag "Nuovi Lead"
      targetTags = [CAMPAIGN_TAGS.NUOVI_LEAD];
      addedTags = [CAMPAIGN_TAGS.NUOVI_LEAD];
    } else if (currentAttempts >= 3 && currentAttempts <= 9) {
      // 3-9 tentativi: Tag "Follow Up" (rimuovi "Nuovi Lead")
      targetTags = [CAMPAIGN_TAGS.FOLLOW_UP];
      removedTags = [CAMPAIGN_TAGS.NUOVI_LEAD];
      addedTags = [CAMPAIGN_TAGS.FOLLOW_UP];
    } else if (currentAttempts >= 10) {
      // 10+ tentativi: Tag "Mancata Risposta" (rimuovi "Follow Up")
      targetTags = [CAMPAIGN_TAGS.MANCATA_RISPOSTA];
      removedTags = [CAMPAIGN_TAGS.FOLLOW_UP];
      addedTags = [CAMPAIGN_TAGS.MANCATA_RISPOSTA];
    }
    
    if (targetTags.length > 0) {
      logAutomation('info', correlationId, {
        action: 'campaign_tags_update_required',
        contact_id: contactId,
        attempts: currentAttempts,
        removed_tags: removedTags,
        added_tags: addedTags,
        final_tags: targetTags
      });
      
      // Aggiorna i tag del contatto
      const updateResult = await updateContactTags(contactId, targetTags, contactData, correlationId);
      
      if (updateResult.success) {
        logAutomation('info', correlationId, {
          action: 'campaign_tags_updated_successfully',
          contact_id: contactId,
          attempts: currentAttempts,
          updated_tags: targetTags
        });
        
        return {
          success: true,
          updated: true,
          removedTags,
          addedTags,
          finalTags: targetTags
        };
      } else {
        logAutomation('error', correlationId, {
          action: 'campaign_tags_update_failed',
          contact_id: contactId,
          error: updateResult.error
        });
        
        return {
          success: false,
          updated: false,
          error: updateResult.error
        };
      }
    }
    
    return {
      success: true,
      updated: false,
      reason: 'No tag changes required at this attempt count'
    };
    
  } catch (error) {
    logAutomation('error', correlationId, {
      action: 'campaign_tag_management_error',
      error: error.message,
      contact_id: contactId,
      current_attempts: currentAttempts
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Aggiorna i tag del contatto usando l'API bulk di CloudTalk
 * Sostituisce TUTTI i tag del contatto con quelli forniti
 */
async function updateContactTags(contactId, tags, contactData, correlationId) {
  try {
    // Usa le credenziali CloudTalk esistenti
    const apiKeyId = process.env.CLOUDTALK_API_KEY_ID;
    const apiSecret = process.env.CLOUDTALK_API_SECRET;
    
    if (!apiKeyId || !apiSecret) {
      throw new Error('CLOUDTALK_API_KEY_ID and CLOUDTALK_API_SECRET not configured');
    }
    
    // Crea header Basic Auth come nel sistema esistente
    const credentials = Buffer.from(`${apiKeyId}:${apiSecret}`).toString('base64');
    const authHeader = `Basic ${credentials}`;
    
    // Prepara richiesta bulk API per aggiornare i tag del contatto
    const bulkData = [{
      action: "edit_contact",
      command_id: `update-tags-${contactId}-${Date.now()}`,
      data: {
        id: parseInt(contactId),
        name: contactData?.name || 'Unknown', // Campo obbligatorio per edit_contact
        ContactsTag: tags.map(tagName => ({ name: tagName }))
      }
    }];
    
    logAutomation('info', correlationId, {
      action: 'sending_tag_update_request',
      contact_id: contactId,
      tags: tags,
      bulk_data: bulkData,
      api_url: 'https://my.cloudtalk.io/api/bulk/contacts.json'
    });
    
    const response = await fetch('https://my.cloudtalk.io/api/bulk/contacts.json', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(bulkData)
    });
    
    const responseData = await response.json();
    
    if (response.ok && responseData.responseData) {
      logAutomation('info', correlationId, {
        action: 'tag_update_response_success',
        contact_id: contactId,
        status: response.status,
        response_data: responseData.responseData
      });
      
      return {
        success: true,
        status: response.status,
        data: responseData.responseData
      };
    } else {
      logAutomation('error', correlationId, {
        action: 'tag_update_response_error',
        contact_id: contactId,
        status: response.status,
        error: responseData
      });
      
      return {
        success: false,
        status: response.status,
        error: responseData?.responseData?.message || 'Unknown error'
      };
    }
    
  } catch (error) {
    logAutomation('error', correlationId, {
      action: 'tag_update_request_error',
      contact_id: contactId,
      tags: tags,
      error: error.message
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Processo principale: gestisce webhook call-ended
 * 
 * @param {Object} webhookPayload - Payload del webhook
 * @param {string} correlationId - ID per tracciamento (es. call_uuid)
 * @returns {Object} Risultato del processing
 */
async function processCallEndedWebhook(webhookPayload, correlationId) {
  const startTime = Date.now();
  
  logAutomation('info', correlationId, {
    event_type: 'call-ended',
    action: 'process_start',
    payload_keys: Object.keys(webhookPayload)
  });
  
  try {
    // 1. Estrai numero di telefono
    const phoneNumber = extractPhoneFromWebhook(webhookPayload);
    if (!phoneNumber) {
      logAutomation('warn', correlationId, {
        action: 'phone_extraction_failed',
        payload: webhookPayload
      });
      return { success: false, reason: 'No phone number found in webhook' };
    }
    
    // 2. Cerca contatto per numero (o usa contact_id se presente)  
    let contact = null;
    
    if (webhookPayload.contact_id) {
      // TODO: implementare getContactById se necessario
      logAutomation('info', correlationId, {
        action: 'contact_id_provided',
        contact_id: webhookPayload.contact_id
      });
    }
    
    // Per ora cerchiamo sempre per numero di telefono
    contact = await getContactByPhone(phoneNumber, correlationId);
    
    if (!contact) {
      logAutomation('warn', correlationId, {
        action: 'contact_not_found',
        phone: phoneNumber
      });
      return { success: true, reason: 'Contact not found, nothing to update' };
    }
    
    // 3. Leggi tentativi attuali
    const currentAttempts = getCustomField(contact, ATTEMPTS_FIELD_KEY);
    const currentValue = currentAttempts ? parseInt(currentAttempts) : 0;
    const newValue = currentValue + 1;
    
    logAutomation('info', correlationId, {
      action: 'attempts_calculation',
      contact_id: contact.id,
      attempts_raw: currentAttempts,
      attempts_prev: currentValue,
      attempts_new: newValue,
      field_key: ATTEMPTS_FIELD_KEY,
      all_attributes: contact.contact_attributes.map(attr => ({title: attr.title, value: attr.value}))
    });
    
    // 4. Aggiorna campo custom (passa i dati del contatto già ottenuti)
    await updateContactCustomField(contact.id, ATTEMPTS_FIELD_KEY, newValue, correlationId, contact);
    
    // 5. Gestisce i tag delle campagne basandosi sui tentativi
    const tagResult = await manageCampaignTags(contact.id, newValue, contact, correlationId);
    let tagsUpdated = false;
    let tagChanges = null;
    
    if (tagResult.updated) {
      tagsUpdated = true;
      tagChanges = {
        removed: tagResult.removedTags || [],
        added: tagResult.addedTags || [],
        final: tagResult.finalTags || []
      };
    } else if (!tagResult.success) {
      // Log l'errore ma non bloccare il processo
      // L'incremento dei tentativi è già avvenuto con successo
      logAutomation('warn', correlationId, {
        action: 'campaign_tags_update_failed_but_continuing',
        contact_id: contact.id,
        attempts: newValue,
        error: tagResult.error,
        note: 'Attempts field updated successfully despite tag update failure'
      });
    }
    
    // 6. Risultato finale
    const duration = Date.now() - startTime;
    
    logAutomation('info', correlationId, {
      action: 'process_complete',
      outcome: 'success',
      contact_id: contact.id,
      phone_masked: phoneNumber.replace(/\d(?=\d{4})/g, '*'),
      attempts_prev: currentValue,
      attempts_new: newValue,
      tags_updated: tagsUpdated,
      tag_changes: tagChanges,
      duration_ms: duration
    });
    
    return {
      success: true,
      contact: {
        id: contact.id,
        name: contact.name,
        phone: phoneNumber
      },
      attempts: {
        previous: currentValue,
        new: newValue
      },
      tags: tagChanges,
      duration: duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logAutomation('error', correlationId, {
      action: 'process_failed',
      error: error.message,
      error_stack: error.stack,
      duration_ms: duration
    });
    
    throw error;
  }
}

export {
  processCallEndedWebhook,
  getContactByPhone,
  normalizePhone,
  updateContactCustomField,
  manageCampaignTags,
  updateContactTags,
  getCampaignIdByName,
  logAutomation,
  THRESHOLDS,
  CAMPAIGN_TAGS,
  ATTEMPTS_FIELD_KEY
};
