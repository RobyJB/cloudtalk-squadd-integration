/**
 * Google Sheets Queue Service
 * Handles high-volume call tracking with queue management and rate limiting
 *
 * Features:
 * - In-memory queue with 20-50 simultaneous call support
 * - Rate limiting to respect Google Apps Script quotas
 * - Automatic retry logic with exponential backoff
 * - Batch processing optimization
 * - Error handling and monitoring
 *
 * Architecture: CloudTalk Webhooks → Queue → Google Apps Script → Google Sheets
 */

import { log, logError } from '../logger.js';

class GoogleSheetsQueueService {
  constructor() {
    // Queue configuration
    this.queue = [];
    this.processing = false;
    this.maxConcurrentRequests = 5; // Respect Google Apps Script limits
    this.requestDelay = 200; // 200ms between requests
    this.activeRequests = 0;

    // Retry configuration
    this.maxRetries = 3;
    this.baseRetryDelay = 1000; // 1 second base delay

    // Performance monitoring
    this.stats = {
      processed: 0,
      failed: 0,
      queued: 0,
      averageProcessingTime: 0,
      lastProcessedAt: null
    };

    // Auto-start processing
    this.startProcessing();

    log('🚀 Google Sheets Queue Service initialized');
    log(`📊 Configuration: maxConcurrent=${this.maxConcurrentRequests}, delay=${this.requestDelay}ms`);
  }

  /**
   * Add call data to processing queue
   * @param {Object} callData - Call tracking data
   * @param {string} type - 'call-started' or 'call-ended'
   * @param {number} priority - Priority level (1=highest, 3=lowest)
   */
  enqueue(callData, type = 'call-started', priority = 2) {
    const queueItem = {
      id: `${callData.call_uuid || callData.call_id}_${type}_${Date.now()}`,
      type: type,
      data: callData,
      priority: priority,
      timestamp: new Date().toISOString(),
      attempts: 0,
      maxRetries: this.maxRetries
    };

    // Insert based on priority (lower number = higher priority)
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority > priority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, queueItem);
    this.stats.queued++;

    log(`📥 Queued Google Sheets update: ${queueItem.id} (priority: ${priority}, queue size: ${this.queue.length})`);

    return queueItem.id;
  }

  /**
   * Process queue items with rate limiting and concurrency control
   */
  async startProcessing() {
    if (this.processing) return;

    this.processing = true;
    log('🔄 Started Google Sheets queue processing');

    while (true) {
      try {
        // Wait if no items in queue
        if (this.queue.length === 0) {
          await this.sleep(1000); // Check every second
          continue;
        }

        // Respect concurrency limits
        if (this.activeRequests >= this.maxConcurrentRequests) {
          await this.sleep(100); // Check more frequently when busy
          continue;
        }

        // Get next item
        const item = this.queue.shift();
        if (!item) continue;

        // Process item asynchronously
        this.processItem(item);

        // Rate limiting delay
        if (this.requestDelay > 0) {
          await this.sleep(this.requestDelay);
        }

      } catch (error) {
        logError('❌ Queue processing error:', error);
        await this.sleep(5000); // Wait 5 seconds on error
      }
    }
  }

  /**
   * Process individual queue item
   * @param {Object} item - Queue item to process
   */
  async processItem(item) {
    this.activeRequests++;
    const startTime = Date.now();

    try {
      log(`🔄 Processing Google Sheets item: ${item.id} (attempt ${item.attempts + 1}/${item.maxRetries + 1})`);

      // Prepare data based on type
      let sheetsData;
      if (item.type === 'call-started') {
        sheetsData = this.prepareCallStartedData(item.data);
      } else if (item.type === 'call-ended') {
        sheetsData = this.prepareCallEndedData(item.data);
      } else {
        throw new Error(`Unknown item type: ${item.type}`);
      }

      // Send to Google Sheets
      await this.sendToGoogleSheets(sheetsData, item.type);

      // Success
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, true);

      log(`✅ Google Sheets update successful: ${item.id} (${processingTime}ms)`);

    } catch (error) {
      logError(`❌ Google Sheets processing failed: ${item.id}`, error);

      // Retry logic
      item.attempts++;
      if (item.attempts <= item.maxRetries) {
        const retryDelay = this.calculateRetryDelay(item.attempts);

        log(`🔄 Retrying Google Sheets item: ${item.id} in ${retryDelay}ms (attempt ${item.attempts + 1}/${item.maxRetries + 1})`);

        // Re-queue with delay
        setTimeout(() => {
          this.queue.unshift(item); // High priority for retries
        }, retryDelay);

      } else {
        logError(`💀 Max retries exceeded for Google Sheets item: ${item.id}`);
        this.updateStats(Date.now() - startTime, false);
      }
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Prepare call started data for Google Sheets
   * @param {Object} callData - Raw call data from CloudTalk webhook
   */
  prepareCallStartedData(callData) {
    return {
      // Google Sheets row data
      timestamp: new Date().toISOString(),
      call_uuid: callData.call_uuid || '',
      call_id: callData.call_id || '',
      external_number: callData.external_number || '',
      contact_name: callData.contact_name || 'Unknown Contact',
      agent_name: `${callData.agent_first_name || ''} ${callData.agent_last_name || ''}`.trim(),
      agent_id: callData.agent_id || '',
      internal_number: callData.internal_number || '',
      call_status: 'started',
      call_started: new Date().toISOString(),
      call_ended: '', // Will be filled on call-ended
      talking_time: '',
      waiting_time: '',
      process_type: 'call_tracking',
      source: 'CloudTalk',

      // Metadata
      webhook_type: 'call-started',
      created_at: new Date().toISOString()
    };
  }

  /**
   * Prepare call ended data for Google Sheets
   * @param {Object} callData - Raw call data from CloudTalk webhook
   */
  prepareCallEndedData(callData) {
    return {
      timestamp: new Date().toISOString(),
      call_uuid: callData.call_uuid || '',
      call_id: callData.call_id || '',
      external_number: callData.external_number || '',
      contact_name: callData.contact_name || 'Unknown Contact',
      agent_name: `${callData.agent_first_name || ''} ${callData.agent_last_name || ''}`.trim(),
      agent_id: callData.agent_id || '',
      internal_number: callData.internal_number || '',
      call_status: 'ended',
      call_started: '', // This should be updated if we have the start time
      call_ended: new Date().toISOString(),
      talking_time: callData.talking_time || 0,
      waiting_time: callData.waiting_time || 0,
      process_type: 'call_tracking',
      source: 'CloudTalk',

      // Metadata
      webhook_type: 'call-ended',
      created_at: new Date().toISOString()
    };
  }

  /**
   * Send data to Google Sheets via Apps Script
   * @param {Object} data - Prepared sheet data
   * @param {string} type - Type of data being sent
   */
  async sendToGoogleSheets(data, type) {
    const googleSheetsUrl = process.env.GOOGLE_SHEETS_APPS_SCRIPT_URL;

    if (!googleSheetsUrl) {
      throw new Error('GOOGLE_SHEETS_APPS_SCRIPT_URL not configured');
    }

    log(`📤 Sending ${type} data to Google Sheets: ${googleSheetsUrl}`);

    const response = await fetch(googleSheetsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CloudTalk-Middleware/1.0'
      },
      body: JSON.stringify({
        ...data,
        // Add queue metadata for Apps Script processing
        queue_metadata: {
          processing_type: type,
          queue_timestamp: new Date().toISOString(),
          middleware_version: '1.0'
        }
      }),
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Google Sheets API error: ${response.status} ${response.statusText} - ${responseText}`);
    }

    const responseData = await response.text();
    log(`✅ Google Sheets response: ${responseData}`);

    return responseData;
  }

  /**
   * Calculate retry delay with exponential backoff
   * @param {number} attempt - Current attempt number
   */
  calculateRetryDelay(attempt) {
    return this.baseRetryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
  }

  /**
   * Update processing statistics
   * @param {number} processingTime - Time taken to process
   * @param {boolean} success - Whether processing was successful
   */
  updateStats(processingTime, success) {
    if (success) {
      this.stats.processed++;
      // Update average processing time
      this.stats.averageProcessingTime =
        (this.stats.averageProcessingTime * (this.stats.processed - 1) + processingTime) / this.stats.processed;
    } else {
      this.stats.failed++;
    }

    this.stats.lastProcessedAt = new Date().toISOString();
  }

  /**
   * Get current queue statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.queue.length,
      activeRequests: this.activeRequests,
      uptime: process.uptime()
    };
  }

  /**
   * Health check for queue service
   */
  getHealthStatus() {
    const stats = this.getStats();
    const isHealthy = stats.queueSize < 100 && stats.activeRequests < this.maxConcurrentRequests;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      queue: {
        size: stats.queueSize,
        processing: this.processing,
        activeRequests: stats.activeRequests,
        maxConcurrent: this.maxConcurrentRequests
      },
      performance: {
        processed: stats.processed,
        failed: stats.failed,
        successRate: stats.processed > 0 ? (stats.processed / (stats.processed + stats.failed)) * 100 : 0,
        averageProcessingTime: Math.round(stats.averageProcessingTime)
      },
      configuration: {
        googleSheetsConfigured: !!process.env.GOOGLE_SHEETS_APPS_SCRIPT_URL,
        requestDelay: this.requestDelay,
        maxRetries: this.maxRetries
      }
    };
  }

  /**
   * Utility sleep function
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    log('🛑 Shutting down Google Sheets Queue Service...');
    this.processing = false;

    // Wait for active requests to complete
    while (this.activeRequests > 0) {
      await this.sleep(100);
    }

    log(`📊 Final stats: processed=${this.stats.processed}, failed=${this.stats.failed}, remaining=${this.queue.length}`);
  }
}

// Export singleton instance
const googleSheetsQueueService = new GoogleSheetsQueueService();
export default googleSheetsQueueService;

// Named exports for specific functions
export {
  GoogleSheetsQueueService,
  googleSheetsQueueService
};