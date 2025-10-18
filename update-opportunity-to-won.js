/**
 * Update an opportunity to won status
 *
 * This function follows the same pattern as updateOpportunityToLost but updates
 * the opportunity status to "won" instead. It attempts to set a win_reason custom
 * field if provided, but gracefully handles the case where the field doesn't exist.
 *
 * @param {string} opportunityId - Opportunity ID to update
 * @param {string} winReason - Reason for marking as won (e.g., "Già cliente", "Cliente")
 * @param {string} correlationId - Correlation ID for request tracking
 * @returns {Promise<Object>} Update result with status and custom field update info
 */
async function updateOpportunityToWon(opportunityId, winReason, correlationId) {
  // Import dependencies (these should be at the top of ghl-opportunity-service.js)
  // import fetch from 'node-fetch';
  // import { logOpportunity } from './ghl-opportunity-service.js';

  const GHL_API_KEY = process.env.GHL_API_KEY;
  const API_TIMEOUT = 10000; // 10 seconds timeout

  if (!GHL_API_KEY) {
    logOpportunity('error', correlationId, {
      error: 'Missing GHL API key for opportunity update'
    });
    return { success: false, error: 'Missing API configuration' };
  }

  // Use /status endpoint for status updates (same as updateOpportunityToLost)
  const statusUrl = `https://services.leadconnectorhq.com/opportunities/${opportunityId}/status`;

  // Simple body - just update status to won
  const requestBody = {
    status: 'won'
  };

  logOpportunity('info', correlationId, {
    action: 'update_opportunity_to_won_start',
    opportunity_id: opportunityId,
    win_reason: winReason,
    endpoint: statusUrl
  });

  try {
    // Step 1: Update status to won
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
        action: 'update_status_to_won_failed',
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
      action: 'update_status_to_won_success',
      opportunity_id: opportunityId,
      response: responseData
    });

    // Step 2: Try to update custom field win_reason (if provided)
    // Note: This field might not exist in GHL, but we attempt it anyway
    if (winReason) {
      try {
        const updateUrl = `https://services.leadconnectorhq.com/opportunities/${opportunityId}`;
        const customFieldBody = {
          customFields: [
            {
              key: 'win_reason',  // Attempting to use win_reason (may not exist)
              field_value: winReason
            }
          ]
        };

        logOpportunity('info', correlationId, {
          action: 'update_win_reason_field_start',
          opportunity_id: opportunityId,
          custom_field: 'win_reason',
          value: winReason
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
            action: 'update_win_reason_field_success',
            opportunity_id: opportunityId
          });
          return {
            success: true,
            statusUpdated: true,
            customFieldUpdated: true,
            response: responseData
          };
        } else {
          // Custom field update failed (field might not exist), but status was updated
          logOpportunity('warn', correlationId, {
            action: 'update_win_reason_field_failed',
            opportunity_id: opportunityId,
            status_code: customFieldResponse.status,
            error: customFieldData,
            note: 'Status updated to won successfully despite custom field failure (field may not exist)'
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
        // Custom field update error, but status was updated successfully
        logOpportunity('warn', correlationId, {
          action: 'update_win_reason_field_exception',
          opportunity_id: opportunityId,
          error: customFieldError.message,
          note: 'Status updated to won successfully despite custom field exception'
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
        action: 'update_opportunity_to_won_timeout',
        opportunity_id: opportunityId,
        error: 'Request timeout after 10 seconds'
      });
      return { success: false, error: 'Request timeout' };
    } else {
      logOpportunity('error', correlationId, {
        action: 'update_opportunity_to_won_exception',
        opportunity_id: opportunityId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }
}

/**
 * Handle winning of all open opportunities for a contact
 * NON-BLOCKING orchestrator function - captures all errors, never throws
 *
 * This function is similar to handleDisqualificationOpportunities but marks
 * opportunities as "won" instead of "lost" when a contact becomes a customer.
 *
 * @param {string} contactPhone - Phone number to search contact
 * @param {string} winTag - Tag that triggered winning (e.g., "Già cliente", "Cliente")
 * @param {string} correlationId - Correlation ID for request tracking
 * @returns {Promise<Object>} Result object with success status
 */
async function handleWonOpportunities(contactPhone, winTag, correlationId) {
  // Import these at the top of the file
  // import { searchGHLContactByPhone } from '../../API Squadd/tests/search-contact-by-phone.js';
  // import { searchOpportunitiesByContact, logOpportunity } from './ghl-opportunity-service.js';

  const startTime = Date.now();

  logOpportunity('info', correlationId, {
    action: 'won_conversion_started',
    phone: contactPhone,
    tag: winTag
  });

  try {
    // Step 1: Find GHL contact by phone
    const contactSearchResult = await searchGHLContactByPhone(contactPhone, correlationId);

    if (!contactSearchResult.success || !contactSearchResult.contact) {
      logOpportunity('info', correlationId, {
        action: 'contact_not_found_for_won',
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
      action: 'contact_found_for_won',
      contact_id: ghlContactId,
      contact_name: contactSearchResult.contact.name
    });

    // Step 2: Search for opportunities
    const opportunities = await searchOpportunitiesByContact(ghlContactId, correlationId);

    if (!opportunities || opportunities.length === 0) {
      logOpportunity('info', correlationId, {
        action: 'no_opportunities_found_for_won',
        contact_id: ghlContactId
      });
      return {
        success: true,
        skipped: true,
        reason: 'no opportunities',
        contact_id: ghlContactId
      };
    }

    // Step 3: Filter only open opportunities (we don't want to change lost/abandoned to won)
    const openOpportunities = opportunities.filter(opp => opp.status === 'open');

    logOpportunity('info', correlationId, {
      action: 'filtered_opportunities_for_won',
      total_opportunities: opportunities.length,
      open_opportunities: openOpportunities.length,
      open_ids: openOpportunities.map(opp => opp.id)
    });

    if (openOpportunities.length === 0) {
      return {
        success: true,
        skipped: true,
        reason: 'no open opportunities to mark as won',
        contact_id: ghlContactId,
        total_opportunities: opportunities.length
      };
    }

    // Step 4: Update each open opportunity to won with delay
    const updateResults = [];
    const winReason = winTag; // Use the tag as the win reason

    for (let i = 0; i < openOpportunities.length; i++) {
      const opportunity = openOpportunities[i];

      // Add delay between updates (except for the first one) to respect rate limits
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      logOpportunity('info', correlationId, {
        action: 'updating_opportunity_to_won',
        opportunity_index: i + 1,
        total: openOpportunities.length,
        opportunity_id: opportunity.id,
        opportunity_name: opportunity.name
      });

      const updateResult = await updateOpportunityToWon(
        opportunity.id,
        winReason,
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
      action: 'won_conversion_completed',
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
      action: 'won_conversion_error',
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

// Export functions for use in ghl-opportunity-service.js
export {
  updateOpportunityToWon,
  handleWonOpportunities
};