/**
 * GoHighLevel Opportunity Service
 *
 * Handles opportunity management and disqualification logic for GHL integration.
 * Provides functions to search, update, and manage opportunities based on contact status.
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log, logError } from '../logger.js';
import { searchGHLContactByPhone } from '../../API Squadd/tests/search-contact-by-phone.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration from environment variables
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const API_TIMEOUT = 10000; // 10 seconds timeout for API calls

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Service-specific log file
const serviceLogFile = path.join(logsDir, 'ghl-opportunity-disqualification.log');

/**
 * Log opportunity-related events with structured format
 */
function logOpportunity(level, correlationId, data) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    correlation_id: correlationId,
    service: 'ghl-opportunity-disqualification',
    ...data
  };

  const logLine = JSON.stringify(logEntry) + '\n';
  fs.appendFileSync(serviceLogFile, logLine);

  const message = `[GHL-Opportunity] ${level}: ${correlationId} - ${JSON.stringify(data)}`;
  if (level === 'error') {
    logError(message);
  } else {
    log(message);
  }
}

/**
 * Search for opportunities by contact ID
 *
 * @param {string} contactId - GHL contact ID
 * @param {string} correlationId - Correlation ID for request tracking
 * @returns {Promise<Array>} Array of opportunities
 */
async function searchOpportunitiesByContact(contactId, correlationId) {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    logOpportunity('error', correlationId, {
      error: 'Missing GHL configuration',
      missingKeys: {
        hasApiKey: !!GHL_API_KEY,
        hasLocationId: !!GHL_LOCATION_ID
      }
    });
    return [];
  }

  const url = new URL('https://services.leadconnectorhq.com/opportunities/search');
  url.searchParams.append('contact_id', contactId);
  url.searchParams.append('location_id', GHL_LOCATION_ID);

  logOpportunity('info', correlationId, {
    action: 'search_opportunities',
    contact_id: contactId,
    url: url.toString()
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseData = await response.json();

    if (!response.ok) {
      logOpportunity('error', correlationId, {
        action: 'search_opportunities_failed',
        status: response.status,
        error: responseData
      });
      return [];
    }

    const opportunities = responseData.opportunities || [];

    logOpportunity('info', correlationId, {
      action: 'opportunities_found',
      count: opportunities.length,
      opportunities: opportunities.map(opp => ({
        id: opp.id,
        name: opp.name,
        status: opp.status,
        pipeline_stage: opp.pipelineStageId
      }))
    });

    return opportunities;

  } catch (error) {
    if (error.name === 'AbortError') {
      logOpportunity('error', correlationId, {
        action: 'search_opportunities_timeout',
        error: 'Request timeout after 10 seconds'
      });
    } else {
      logOpportunity('error', correlationId, {
        action: 'search_opportunities_exception',
        error: error.message
      });
    }
    return [];
  }
}

/**
 * Update an opportunity to lost status
 *
 * @param {string} opportunityId - Opportunity ID to update
 * @param {string} lostReason - Reason for marking as lost
 * @param {string} correlationId - Correlation ID for request tracking
 * @returns {Promise<Object>} Update result
 */
async function updateOpportunityToLost(opportunityId, lostReason, correlationId) {
  if (!GHL_API_KEY) {
    logOpportunity('error', correlationId, {
      error: 'Missing GHL API key for opportunity update'
    });
    return { success: false, error: 'Missing API configuration' };
  }

  // FIXED: Use /status endpoint (correct endpoint for status updates)
  const statusUrl = `https://services.leadconnectorhq.com/opportunities/${opportunityId}/status`;

  // Simple body - just update status (most reliable)
  const requestBody = {
    status: 'lost'
  };

  logOpportunity('info', correlationId, {
    action: 'update_opportunity_to_lost_start',
    opportunity_id: opportunityId,
    lost_reason: lostReason,
    endpoint: statusUrl
  });

  try {
    // Step 1: Update status to lost
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const response = await fetch(statusUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseData = await response.json();

    if (!response.ok) {
      logOpportunity('error', correlationId, {
        action: 'update_status_failed',
        opportunity_id: opportunityId,
        status_code: response.status,
        error: responseData
      });
      return {
        success: false,
        error: `API error ${response.status}: ${JSON.stringify(responseData)}`
      };
    }

    logOpportunity('info', correlationId, {
      action: 'update_status_success',
      opportunity_id: opportunityId,
      response: responseData
    });

    // Step 2: Try to update custom field lost_reason
    // Note: This is a separate call to the base endpoint with customFields array format
    if (lostReason) {
      try {
        const updateUrl = `https://services.leadconnectorhq.com/opportunities/${opportunityId}`;
        const customFieldBody = {
          customFields: [
            {
              key: 'lost_reason',
              field_value: lostReason
            }
          ]
        };

        logOpportunity('info', correlationId, {
          action: 'update_custom_field_start',
          opportunity_id: opportunityId,
          custom_field: 'lost_reason',
          value: lostReason
        });

        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), API_TIMEOUT);

        const customFieldResponse = await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(customFieldBody),
          signal: controller2.signal
        });

        clearTimeout(timeoutId2);

        const customFieldData = await customFieldResponse.json();

        if (customFieldResponse.ok) {
          logOpportunity('info', correlationId, {
            action: 'update_custom_field_success',
            opportunity_id: opportunityId
          });
          return {
            success: true,
            statusUpdated: true,
            customFieldUpdated: true,
            response: responseData
          };
        } else {
          // Custom field update failed, but status was updated
          logOpportunity('warn', correlationId, {
            action: 'update_custom_field_failed',
            opportunity_id: opportunityId,
            status_code: customFieldResponse.status,
            error: customFieldData,
            note: 'Status updated successfully despite custom field failure'
          });
          return {
            success: true,
            statusUpdated: true,
            customFieldUpdated: false,
            customFieldError: customFieldData,
            response: responseData
          };
        }
      } catch (customFieldError) {
        // Custom field update error, but status was updated
        logOpportunity('warn', correlationId, {
          action: 'update_custom_field_exception',
          opportunity_id: opportunityId,
          error: customFieldError.message,
          note: 'Status updated successfully despite custom field exception'
        });
        return {
          success: true,
          statusUpdated: true,
          customFieldUpdated: false,
          customFieldError: customFieldError.message,
          response: responseData
        };
      }
    }

    // No custom field requested, just status update
    return {
      success: true,
      statusUpdated: true,
      customFieldUpdated: false,
      response: responseData
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      logOpportunity('error', correlationId, {
        action: 'update_opportunity_timeout',
        opportunity_id: opportunityId,
        error: 'Request timeout after 10 seconds'
      });
      return { success: false, error: 'Request timeout' };
    } else {
      logOpportunity('error', correlationId, {
        action: 'update_opportunity_exception',
        opportunity_id: opportunityId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }
}

/**
 * Handle disqualification of all open opportunities for a contact
 * NON-BLOCKING orchestrator function - captures all errors, never throws
 *
 * @param {string} contactPhone - Phone number to search contact
 * @param {string} disqualificationTag - Tag that triggered disqualification
 * @param {string} correlationId - Correlation ID for request tracking
 * @returns {Promise<Object>} Result object with success status
 */
async function handleDisqualificationOpportunities(contactPhone, disqualificationTag, correlationId) {
  const startTime = Date.now();

  logOpportunity('info', correlationId, {
    action: 'disqualification_started',
    phone: contactPhone,
    tag: disqualificationTag
  });

  try {
    // Step 1: Find GHL contact by phone
    const contactSearchResult = await searchGHLContactByPhone(contactPhone, correlationId);

    if (!contactSearchResult.success || !contactSearchResult.contact) {
      logOpportunity('info', correlationId, {
        action: 'contact_not_found',
        phone: contactPhone,
        search_result: contactSearchResult
      });
      return {
        success: true,
        skipped: true,
        reason: 'contact not found',
        phone: contactPhone
      };
    }

    const ghlContactId = contactSearchResult.contact.id;

    logOpportunity('info', correlationId, {
      action: 'contact_found',
      contact_id: ghlContactId,
      contact_name: contactSearchResult.contact.name
    });

    // Step 2: Search for opportunities
    const opportunities = await searchOpportunitiesByContact(ghlContactId, correlationId);

    if (!opportunities || opportunities.length === 0) {
      logOpportunity('info', correlationId, {
        action: 'no_opportunities_found',
        contact_id: ghlContactId
      });
      return {
        success: true,
        skipped: true,
        reason: 'no opportunities',
        contact_id: ghlContactId
      };
    }

    // Step 3: Filter only open opportunities
    const openOpportunities = opportunities.filter(opp => opp.status === 'open');

    logOpportunity('info', correlationId, {
      action: 'filtered_opportunities',
      total_opportunities: opportunities.length,
      open_opportunities: openOpportunities.length,
      open_ids: openOpportunities.map(opp => opp.id)
    });

    if (openOpportunities.length === 0) {
      return {
        success: true,
        skipped: true,
        reason: 'no open opportunities',
        contact_id: ghlContactId,
        total_opportunities: opportunities.length
      };
    }

    // Step 4: Update each open opportunity to lost with delay
    const updateResults = [];
    // Use the exact tag without prefix to match GHL's expected values
    const lostReason = disqualificationTag;

    for (let i = 0; i < openOpportunities.length; i++) {
      const opportunity = openOpportunities[i];

      // Add delay between updates (except for the first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      logOpportunity('info', correlationId, {
        action: 'updating_opportunity',
        opportunity_index: i + 1,
        total: openOpportunities.length,
        opportunity_id: opportunity.id,
        opportunity_name: opportunity.name
      });

      const updateResult = await updateOpportunityToLost(
        opportunity.id,
        lostReason,
        correlationId
      );

      updateResults.push({
        opportunity_id: opportunity.id,
        opportunity_name: opportunity.name,
        ...updateResult
      });
    }

    // Calculate summary
    const successCount = updateResults.filter(r => r.success).length;
    const failedCount = updateResults.filter(r => !r.success).length;
    const duration = Date.now() - startTime;

    logOpportunity('info', correlationId, {
      action: 'disqualification_completed',
      contact_id: ghlContactId,
      total_updated: openOpportunities.length,
      success_count: successCount,
      failed_count: failedCount,
      duration_ms: duration,
      results: updateResults
    });

    return {
      success: true,
      contact_id: ghlContactId,
      opportunities_updated: successCount,
      opportunities_failed: failedCount,
      total_opportunities: openOpportunities.length,
      duration_ms: duration,
      details: updateResults
    };

  } catch (error) {
    // Catch any unexpected errors - never throw
    const duration = Date.now() - startTime;

    logOpportunity('error', correlationId, {
      action: 'disqualification_error',
      phone: contactPhone,
      error: error.message,
      stack: error.stack,
      duration_ms: duration
    });

    return {
      success: false,
      error: error.message,
      phone: contactPhone,
      duration_ms: duration
    };
  }
}

// Export functions
export {
  searchOpportunitiesByContact,
  updateOpportunityToLost,
  handleDisqualificationOpportunities,
  logOpportunity
};