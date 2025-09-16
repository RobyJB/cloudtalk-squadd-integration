// Webhook deduplication utility
// Prevents processing the same webhook multiple times

import { log } from '../logger.js';

// In-memory cache of recently processed webhooks
const processedWebhooks = new Map();

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Check if a webhook has already been processed recently
 * @param {string} callId - The call ID from the webhook
 * @param {string} webhookType - Type of webhook
 * @returns {boolean} true if already processed, false if new
 */
export function isWebhookAlreadyProcessed(callId, webhookType) {
  const key = `${callId}_${webhookType}`;
  const now = Date.now();

  // Clean up old entries
  cleanupOldEntries(now);

  // Check if this webhook was already processed
  if (processedWebhooks.has(key)) {
    const processedAt = processedWebhooks.get(key);
    const timeSince = now - processedAt;

    log(`🔄 Webhook already processed ${Math.round(timeSince/1000)}s ago: ${key}`);
    return true;
  }

  return false;
}

/**
 * Mark a webhook as processed
 * @param {string} callId - The call ID from the webhook
 * @param {string} webhookType - Type of webhook
 */
export function markWebhookAsProcessed(callId, webhookType) {
  const key = `${callId}_${webhookType}`;
  const now = Date.now();

  processedWebhooks.set(key, now);
  log(`✅ Marked webhook as processed: ${key}`);
}

/**
 * Clean up old entries from the cache
 * @param {number} now - Current timestamp
 */
function cleanupOldEntries(now) {
  const cutoff = now - CACHE_DURATION;
  let cleanedCount = 0;

  for (const [key, timestamp] of processedWebhooks.entries()) {
    if (timestamp < cutoff) {
      processedWebhooks.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    log(`🧹 Cleaned up ${cleanedCount} old webhook entries`);
  }
}

/**
 * Get current cache stats
 * @returns {object} Cache statistics
 */
export function getWebhookCacheStats() {
  const now = Date.now();
  cleanupOldEntries(now);

  return {
    totalEntries: processedWebhooks.size,
    entries: Array.from(processedWebhooks.entries()).map(([key, timestamp]) => ({
      key,
      processedAt: new Date(timestamp).toISOString(),
      ageMinutes: Math.round((now - timestamp) / 60000)
    }))
  };
}

export default {
  isWebhookAlreadyProcessed,
  markWebhookAsProcessed,
  getWebhookCacheStats
};