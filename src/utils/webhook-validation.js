/**
 * Webhook Payload Validation Utilities
 *
 * Addresses the issues identified:
 * 1. Undefined call_id breaking deduplication
 * 2. Missing required fields in webhook payloads
 * 3. Generates fallback IDs for tracking
 */

import { log, logError } from '../logger.js';

/**
 * Validate and enhance webhook payload
 * @param {object} payload - Raw webhook payload
 * @param {string} webhookType - Type of webhook (call-started, call-ended, etc.)
 * @returns {object} Enhanced payload with validation results
 */
export function validateAndEnhanceWebhookPayload(payload, webhookType) {
  const timestamp = new Date().toISOString();
  const validationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    enhancedPayload: { ...payload },
    correlationId: null
  };

  // Generate correlation ID for tracking
  validationResult.correlationId = generateCorrelationId(payload, webhookType, timestamp);
  validationResult.enhancedPayload._correlationId = validationResult.correlationId;

  // Validate and fix call_id
  const callIdValidation = validateCallId(payload, webhookType, validationResult.correlationId);
  validationResult.enhancedPayload = { ...validationResult.enhancedPayload, ...callIdValidation.enhancedPayload };
  validationResult.errors.push(...callIdValidation.errors);
  validationResult.warnings.push(...callIdValidation.warnings);

  // Validate required fields based on webhook type
  const requiredFieldsValidation = validateRequiredFields(payload, webhookType);
  validationResult.errors.push(...requiredFieldsValidation.errors);
  validationResult.warnings.push(...requiredFieldsValidation.warnings);

  // Validate phone number
  const phoneValidation = validatePhoneNumber(payload);
  validationResult.errors.push(...phoneValidation.errors);
  validationResult.warnings.push(...phoneValidation.warnings);

  // Overall validation status
  validationResult.isValid = validationResult.errors.length === 0;

  // Log validation results
  if (validationResult.errors.length > 0) {
    logError(`❌ Webhook validation failed for ${webhookType}:`);
    validationResult.errors.forEach(error => logError(`   - ${error}`));
  }

  if (validationResult.warnings.length > 0) {
    log(`⚠️  Webhook validation warnings for ${webhookType}:`);
    validationResult.warnings.forEach(warning => log(`   - ${warning}`));
  }

  log(`🔍 Correlation ID: ${validationResult.correlationId}`);

  return validationResult;
}

/**
 * Generate correlation ID for webhook tracking
 * @param {object} payload
 * @param {string} webhookType
 * @param {string} timestamp
 * @returns {string}
 */
function generateCorrelationId(payload, webhookType, timestamp) {
  // Try to use existing identifiers
  const callId = payload.call_id || payload.Call_id || payload.call_uuid;
  const phone = payload.external_number;
  const agent = payload.agent_id;

  if (callId) {
    return `${callId}_${webhookType}`;
  }

  // Generate fallback correlation ID
  const timestampShort = new Date(timestamp).getTime().toString().slice(-8);
  const phoneShort = phone ? phone.slice(-4) : 'XXXX';
  const agentShort = agent ? agent.toString().slice(-3) : 'XXX';

  return `fallback_${webhookType}_${timestampShort}_${phoneShort}_${agentShort}`;
}

/**
 * Validate and fix call_id issues
 * @param {object} payload
 * @param {string} webhookType
 * @param {string} correlationId
 * @returns {object}
 */
function validateCallId(payload, webhookType, correlationId) {
  const result = {
    enhancedPayload: {},
    errors: [],
    warnings: []
  };

  const callId = payload.call_id || payload.Call_id;
  const callUuid = payload.call_uuid;

  if (!callId && !callUuid) {
    // Critical issue: No call identifier at all
    const fallbackCallId = `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    result.enhancedPayload.call_id = fallbackCallId;
    result.enhancedPayload._call_id_generated = true;
    result.enhancedPayload._original_call_id = undefined;

    result.warnings.push(`Missing call_id - generated fallback: ${fallbackCallId}`);
    log(`⚠️  Generated fallback call_id: ${fallbackCallId} for ${correlationId}`);

  } else if (callId === 'undefined' || callId === null) {
    // Explicit undefined/null call_id (this was the reported issue)
    const fallbackCallId = `fixed_undefined_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    result.enhancedPayload.call_id = fallbackCallId;
    result.enhancedPayload._call_id_fixed = true;
    result.enhancedPayload._original_call_id = callId;

    result.warnings.push(`Fixed undefined call_id - generated: ${fallbackCallId}`);
    log(`🔧 Fixed undefined call_id: ${fallbackCallId} for ${correlationId}`);

  } else {
    // Valid call_id exists
    result.enhancedPayload.call_id = callId;
  }

  return result;
}

/**
 * Validate required fields based on webhook type
 * @param {object} payload
 * @param {string} webhookType
 * @returns {object}
 */
function validateRequiredFields(payload, webhookType) {
  const result = {
    errors: [],
    warnings: []
  };

  const requiredFields = {
    'call-started': ['external_number', 'agent_id'],
    'call-ended': ['external_number', 'agent_id'],
    'call-recording-ready': ['external_number', 'recording_url'],
    'transcription-ready': ['external_number'],
    'new-tag': ['external_number'],
    'new-note': ['external_number'],
    'contact-updated': ['external_number']
  };

  const required = requiredFields[webhookType] || [];

  required.forEach(field => {
    if (!payload[field]) {
      result.errors.push(`Missing required field: ${field}`);
    }
  });

  // Check for CloudTalk-specific patterns
  if (webhookType === 'call-ended') {
    if (!payload.talking_time && payload.talking_time !== 0) {
      result.warnings.push('Missing talking_time - cannot determine if call was answered');
    }
  }

  return result;
}

/**
 * Validate phone number
 * @param {object} payload
 * @returns {object}
 */
function validatePhoneNumber(payload) {
  const result = {
    errors: [],
    warnings: []
  };

  const phone = payload.external_number;

  if (!phone) {
    result.errors.push('Missing external_number (phone)');
  } else {
    // Basic phone validation
    if (typeof phone !== 'string' && typeof phone !== 'number') {
      result.errors.push('Invalid phone number format - must be string or number');
    } else {
      const phoneStr = phone.toString();
      if (phoneStr.length < 10) {
        result.warnings.push('Phone number seems too short');
      }
      if (!phoneStr.match(/^[+\d\s()-]+$/)) {
        result.warnings.push('Phone number contains unusual characters');
      }
    }
  }

  return result;
}

/**
 * Extract deduplication key from validated payload
 * @param {object} validatedPayload - Enhanced payload from validation
 * @param {string} webhookType
 * @returns {string}
 */
export function extractDeduplicationKey(validatedPayload, webhookType) {
  // Always use the validated call_id (which might be generated)
  const callId = validatedPayload.call_id;
  const correlationId = validatedPayload._correlationId;

  const deduplicationKey = callId ? `${callId}_${webhookType}` : `${correlationId}_${webhookType}`;

  log(`🔑 Deduplication key: ${deduplicationKey}`);
  return deduplicationKey;
}

/**
 * Check if webhook should be processed (bypass for testing)
 * @param {object} payload
 * @param {object} headers
 * @returns {boolean}
 */
export function shouldProcessWebhook(payload, headers) {
  // Allow test webhooks
  const userAgent = headers['user-agent'] || '';
  if (userAgent.includes('Test') || userAgent.includes('curl')) {
    return true;
  }

  // Allow CloudTalk webhooks
  if (userAgent.includes('cloudtalk')) {
    return true;
  }

  // Default: process all webhooks
  return true;
}

/**
 * Log validation summary for debugging
 * @param {object} validationResult
 * @param {string} webhookType
 */
export function logValidationSummary(validationResult, webhookType) {
  log(`📊 Webhook Validation Summary for ${webhookType}:`);
  log(`   ✅ Valid: ${validationResult.isValid}`);
  log(`   🔍 Correlation ID: ${validationResult.correlationId}`);
  log(`   ❌ Errors: ${validationResult.errors.length}`);
  log(`   ⚠️  Warnings: ${validationResult.warnings.length}`);

  if (validationResult.enhancedPayload._call_id_generated) {
    log(`   🔧 Generated call_id: ${validationResult.enhancedPayload.call_id}`);
  }

  if (validationResult.enhancedPayload._call_id_fixed) {
    log(`   🔧 Fixed undefined call_id: ${validationResult.enhancedPayload.call_id}`);
  }
}

export default {
  validateAndEnhanceWebhookPayload,
  extractDeduplicationKey,
  shouldProcessWebhook,
  logValidationSummary
};