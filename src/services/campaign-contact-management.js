import { makeCloudTalkRequest } from '../../API CloudTalk/config.js';
import { logAutomation } from './cloudtalk-campaign-automation.js';

/**
 * CloudTalk Campaign Contact Management
 * 
 * Gestisce l'assegnazione e rimozione di contatti dalle campagne CloudTalk.
 * Implementa le API mancanti per completare il sistema di automazione.
 */

/**
 * Verifica se un contatto è assegnato a una specifica campagna
 * @param {string} contactId - ID del contatto
 * @param {string} campaignId - ID della campagna
 * @param {string} correlationId - ID per tracciamento
 * @returns {boolean} true se il contatto è nella campagna
 */
async function isContactInCampaign(contactId, campaignId, correlationId) {
  logAutomation('info', correlationId, {
    action: 'check_contact_in_campaign',
    contact_id: contactId,
    campaign_id: campaignId
  });

  try {
    // API CloudTalk per ottenere contatti in una campagna
    // GET /campaigns/{campaignId}/contacts.json
    const endpoint = `/campaigns/${campaignId}/contacts.json`;
    const response = await makeCloudTalkRequest(endpoint);
    
    if (response.data?.responseData?.data) {
      const contacts = response.data.responseData.data;
      const isAssigned = contacts.some(item => 
        item.Contact && item.Contact.id.toString() === contactId.toString()
      );
      
      logAutomation('info', correlationId, {
        action: 'contact_campaign_check_result',
        contact_id: contactId,
        campaign_id: campaignId,
        is_assigned: isAssigned,
        total_contacts_in_campaign: contacts.length
      });
      
      return isAssigned;
    }
    
    return false;
    
  } catch (error) {
    // Se l'endpoint non esiste (404) o non è implementato, assumiamo false
    if (error.message.includes('404')) {
      logAutomation('warn', correlationId, {
        action: 'campaign_contacts_api_not_available',
        campaign_id: campaignId,
        note: 'API GET /campaigns/{id}/contacts.json not implemented yet'
      });
      return false;
    }
    
    logAutomation('error', correlationId, {
      action: 'contact_campaign_check_failed',
      contact_id: contactId,
      campaign_id: campaignId,
      error: error.message
    });
    
    throw error;
  }
}

/**
 * Aggiunge un contatto a una campagna
 * @param {string} campaignId - ID della campagna
 * @param {string} contactId - ID del contatto
 * @param {string} correlationId - ID per tracciamento
 * @returns {boolean} true se aggiunto con successo
 */
async function addContactToCampaign(campaignId, contactId, correlationId) {
  logAutomation('info', correlationId, {
    action: 'add_contact_to_campaign',
    contact_id: contactId,
    campaign_id: campaignId
  });

  try {
    // API CloudTalk per aggiungere contatto a campagna
    // POST /campaigns/{campaignId}/contacts.json
    const endpoint = `/campaigns/${campaignId}/contacts.json`;
    const requestBody = {
      contact_id: contactId
    };
    
    const response = await makeCloudTalkRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });
    
    logAutomation('info', correlationId, {
      action: 'contact_added_to_campaign',
      contact_id: contactId,
      campaign_id: campaignId,
      response_status: response.data?.responseData?.status
    });
    
    return true;
    
  } catch (error) {
    if (error.message.includes('404')) {
      logAutomation('warn', correlationId, {
        action: 'add_campaign_contact_api_not_available',
        campaign_id: campaignId,
        contact_id: contactId,
        note: 'API POST /campaigns/{id}/contacts.json not implemented yet'
      });
      return false;
    }
    
    logAutomation('error', correlationId, {
      action: 'add_contact_to_campaign_failed',
      contact_id: contactId,
      campaign_id: campaignId,
      error: error.message
    });
    
    throw error;
  }
}

/**
 * Rimuove un contatto da una campagna
 * @param {string} campaignId - ID della campagna
 * @param {string} contactId - ID del contatto
 * @param {string} correlationId - ID per tracciamento
 * @returns {boolean} true se rimosso con successo
 */
async function removeContactFromCampaign(campaignId, contactId, correlationId) {
  logAutomation('info', correlationId, {
    action: 'remove_contact_from_campaign',
    contact_id: contactId,
    campaign_id: campaignId
  });

  try {
    // API CloudTalk per rimuovere contatto da campagna
    // DELETE /campaigns/{campaignId}/contacts/{contactId}.json
    const endpoint = `/campaigns/${campaignId}/contacts/${contactId}.json`;
    
    const response = await makeCloudTalkRequest(endpoint, {
      method: 'DELETE'
    });
    
    logAutomation('info', correlationId, {
      action: 'contact_removed_from_campaign',
      contact_id: contactId,
      campaign_id: campaignId,
      response_status: response.data?.responseData?.status
    });
    
    return true;
    
  } catch (error) {
    if (error.message.includes('404')) {
      logAutomation('warn', correlationId, {
        action: 'remove_campaign_contact_api_not_available',
        campaign_id: campaignId,
        contact_id: contactId,
        note: 'API DELETE /campaigns/{id}/contacts/{contactId}.json not implemented yet'
      });
      return false;
    }
    
    logAutomation('error', correlationId, {
      action: 'remove_contact_from_campaign_failed',
      contact_id: contactId,
      campaign_id: campaignId,
      error: error.message
    });
    
    // Se il contatto non è nella campagna (404), consideralo successo
    if (error.message.includes('404') || error.message.includes('not found')) {
      return true;
    }
    
    throw error;
  }
}

/**
 * Sposta un contatto da una campagna all'altra
 * @param {string} contactId - ID del contatto
 * @param {string} sourceCampaignName - Nome campagna sorgente
 * @param {string} targetCampaignName - Nome campagna destinazione
 * @param {string} correlationId - ID per tracciamento
 * @param {Function} getCampaignIdByName - Funzione per ottenere ID campagna da nome
 * @returns {Object} Risultato dello spostamento
 */
async function moveBetweenCampaigns(contactId, sourceCampaignName, targetCampaignName, correlationId, getCampaignIdByName) {
  const startTime = Date.now();
  
  logAutomation('info', correlationId, {
    action: 'move_between_campaigns_start',
    contact_id: contactId,
    source_campaign: sourceCampaignName,
    target_campaign: targetCampaignName
  });

  try {
    // 1. Ottieni ID delle campagne
    const [sourceCampaignId, targetCampaignId] = await Promise.all([
      getCampaignIdByName(sourceCampaignName, correlationId),
      getCampaignIdByName(targetCampaignName, correlationId)
    ]);

    if (!targetCampaignId) {
      throw new Error(`Target campaign "${targetCampaignName}" not found`);
    }

    // 2. Controlla se il contatto è già nella campagna target
    const isAlreadyInTarget = await isContactInCampaign(contactId, targetCampaignId, correlationId);
    if (isAlreadyInTarget) {
      logAutomation('info', correlationId, {
        action: 'contact_already_in_target_campaign',
        contact_id: contactId,
        campaign_id: targetCampaignId,
        campaign_name: targetCampaignName
      });
      
      // Rimuovi dalla sorgente se presente
      if (sourceCampaignId) {
        await removeContactFromCampaign(sourceCampaignId, contactId, correlationId);
      }
      
      return {
        success: true,
        action: 'already_in_target',
        source_removed: !!sourceCampaignId,
        duration: Date.now() - startTime
      };
    }

    // 3. Aggiungi alla campagna target
    const addResult = await addContactToCampaign(targetCampaignId, contactId, correlationId);
    if (!addResult) {
      logAutomation('warn', correlationId, {
        action: 'campaign_move_skipped',
        reason: 'Add campaign contact API not available',
        contact_id: contactId,
        target_campaign: targetCampaignName
      });
      
      return {
        success: false,
        reason: 'Campaign contact management APIs not available',
        api_needed: 'POST /campaigns/{id}/contacts.json',
        duration: Date.now() - startTime
      };
    }

    // 4. Rimuovi dalla campagna sorgente (se specificata)
    let sourceRemoved = false;
    if (sourceCampaignId) {
      const isInSource = await isContactInCampaign(contactId, sourceCampaignId, correlationId);
      if (isInSource) {
        sourceRemoved = await removeContactFromCampaign(sourceCampaignId, contactId, correlationId);
      }
    }

    // 5. Log risultato finale
    const duration = Date.now() - startTime;
    
    logAutomation('info', correlationId, {
      action: 'move_between_campaigns_complete',
      contact_id: contactId,
      source_campaign: sourceCampaignName,
      target_campaign: targetCampaignName,
      source_removed: sourceRemoved,
      target_added: true,
      duration_ms: duration
    });

    return {
      success: true,
      action: 'moved',
      source_removed: sourceRemoved,
      target_added: true,
      duration: duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logAutomation('error', correlationId, {
      action: 'move_between_campaigns_failed',
      contact_id: contactId,
      source_campaign: sourceCampaignName,
      target_campaign: targetCampaignName,
      error: error.message,
      duration_ms: duration
    });

    return {
      success: false,
      error: error.message,
      duration: duration
    };
  }
}

export {
  isContactInCampaign,
  addContactToCampaign,
  removeContactFromCampaign,
  moveBetweenCampaigns
};