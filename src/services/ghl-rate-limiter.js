import { log, logError } from '../logger.js';

/**
 * Advanced Rate Limiter for GoHighLevel API
 * Handles: 100 requests per 10 seconds = ~10 req/sec max
 * Safe rate: 7-8 req/sec with automatic retry on 429
 */
class GHLRateLimiter {
  constructor(options = {}) {
    // Rate limiting: 7 requests per second (safe margin from 10/sec limit)
    this.requestsPerSecond = options.requestsPerSecond || 7;
    this.maxRequestsPer10Sec = options.maxRequestsPer10Sec || 100;

    // Tracking windows
    this.requestTimestamps = [];
    this.rateLimitRemaining = 100;
    this.rateLimitReset = null;

    // Retry configuration
    this.maxRetries = options.maxRetries || 5;
    this.retryDelayMs = options.retryDelayMs || 2000;
    this.exponentialBackoff = options.exponentialBackoff !== false; // default true

    // Queue for pending requests
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Clean old timestamps (older than 10 seconds)
   */
  cleanOldTimestamps() {
    const now = Date.now();
    const tenSecondsAgo = now - 10000;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > tenSecondsAgo);
  }

  /**
   * Check if we can make a request now
   */
  canMakeRequest() {
    this.cleanOldTimestamps();

    // Check 10-second window limit
    if (this.requestTimestamps.length >= this.maxRequestsPer10Sec) {
      return false;
    }

    // Check per-second limit (last 1000ms)
    const oneSecondAgo = Date.now() - 1000;
    const recentRequests = this.requestTimestamps.filter(ts => ts > oneSecondAgo).length;

    if (recentRequests >= this.requestsPerSecond) {
      return false;
    }

    return true;
  }

  /**
   * Calculate delay until next available slot
   */
  getDelayUntilNextSlot() {
    this.cleanOldTimestamps();

    if (this.requestTimestamps.length === 0) {
      return 0;
    }

    // Find oldest timestamp in current window
    const oldestInWindow = Math.min(...this.requestTimestamps);
    const tenSecondsFromOldest = oldestInWindow + 10000;
    const now = Date.now();

    // If we're at the 10-second limit, wait until oldest expires
    if (this.requestTimestamps.length >= this.maxRequestsPer10Sec) {
      return Math.max(0, tenSecondsFromOldest - now);
    }

    // Check per-second limit
    const oneSecondAgo = now - 1000;
    const recentRequests = this.requestTimestamps.filter(ts => ts > oneSecondAgo);

    if (recentRequests.length >= this.requestsPerSecond) {
      // Wait until oldest recent request is > 1 second old
      const oldestRecent = Math.min(...recentRequests);
      const oneSecondFromOldest = oldestRecent + 1000;
      return Math.max(0, oneSecondFromOldest - now);
    }

    return 0;
  }

  /**
   * Wait for available slot
   */
  async waitForSlot() {
    while (!this.canMakeRequest()) {
      const delay = this.getDelayUntilNextSlot();
      if (delay > 0) {
        log(`⏳ Rate limit: waiting ${delay}ms...`);
        await this.sleep(delay + 50); // Add 50ms buffer
      }
    }
  }

  /**
   * Record a request
   */
  recordRequest() {
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Update rate limit info from response headers
   */
  updateFromHeaders(headers) {
    const remaining = headers.get?.('x-ratelimit-remaining') || headers['x-ratelimit-remaining'];
    const reset = headers.get?.('x-ratelimit-reset') || headers['x-ratelimit-reset'];

    if (remaining !== undefined) {
      this.rateLimitRemaining = parseInt(remaining);
    }

    if (reset !== undefined) {
      this.rateLimitReset = reset;
    }
  }

  /**
   * Execute request with rate limiting and retry logic
   */
  async executeWithRetry(requestFn, retryCount = 0) {
    // Wait for available slot
    await this.waitForSlot();

    try {
      // Record the request
      this.recordRequest();

      // Execute the request
      const response = await requestFn();

      // Update rate limit info if available
      if (response && response.headers) {
        this.updateFromHeaders(response.headers);
      }

      return response;

    } catch (error) {
      // Check if it's a 429 (Too Many Requests) error
      const is429 = error.response?.status === 429 ||
                    error.status === 429 ||
                    error.message?.includes('429') ||
                    error.message?.toLowerCase().includes('rate limit');

      if (is429 && retryCount < this.maxRetries) {
        // Get retry-after header or use exponential backoff
        const retryAfter = error.response?.headers?.get?.('retry-after') ||
                          error.response?.headers?.['retry-after'];

        let delay;
        if (retryAfter) {
          delay = parseInt(retryAfter) * 1000;
        } else if (this.exponentialBackoff) {
          delay = this.retryDelayMs * Math.pow(2, retryCount);
        } else {
          delay = this.retryDelayMs;
        }

        log(`⚠️  Rate limit hit (429). Retry ${retryCount + 1}/${this.maxRetries} in ${delay}ms...`);

        await this.sleep(delay);

        // Retry the request
        return this.executeWithRetry(requestFn, retryCount + 1);
      }

      // If not a 429 or max retries exceeded, throw the error
      throw error;
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit status
   */
  getStatus() {
    this.cleanOldTimestamps();
    const oneSecondAgo = Date.now() - 1000;
    const recentRequests = this.requestTimestamps.filter(ts => ts > oneSecondAgo).length;

    return {
      requestsInLast10Seconds: this.requestTimestamps.length,
      requestsInLastSecond: recentRequests,
      maxPer10Seconds: this.maxRequestsPer10Sec,
      maxPerSecond: this.requestsPerSecond,
      canMakeRequest: this.canMakeRequest(),
      delayUntilNextSlot: this.getDelayUntilNextSlot(),
      rateLimitRemaining: this.rateLimitRemaining,
      rateLimitReset: this.rateLimitReset
    };
  }

  /**
   * Reset rate limiter state
   */
  reset() {
    this.requestTimestamps = [];
    this.rateLimitRemaining = 100;
    this.rateLimitReset = null;
  }
}

export default GHLRateLimiter;
