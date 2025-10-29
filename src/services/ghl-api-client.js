import { log, logError } from '../logger.js';

/**
 * GoHighLevel API Client
 * Handles all interactions with GHL API including pagination and rate limiting
 */
class GHLAPIClient {
  constructor(apiKey = process.env.GHL_API_KEY, locationId = process.env.GHL_LOCATION_ID) {
    if (!apiKey) {
      throw new Error('GHL_API_KEY is required');
    }

    this.apiKey = apiKey;
    this.locationId = locationId || process.env.GHL_LOCATION_ID || 'DfxGoORmPoL5Z1OcfYJM';
    this.baseUrl = 'https://services.leadconnectorhq.com';
    this.version = '2021-07-28';

    // Debug: log locationId
    if (!this.locationId) {
      console.warn('⚠️  GHL_LOCATION_ID is not set, using fallback');
    }

    // Rate limiting configuration
    this.rateLimitRemaining = 100;
    this.rateLimitReset = null;
    this.requestQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Make authenticated request to GHL API
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Version': this.version,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const requestOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, requestOptions);

      // Update rate limit info from headers
      this.rateLimitRemaining = parseInt(response.headers.get('x-ratelimit-remaining') || 100);
      this.rateLimitReset = response.headers.get('x-ratelimit-reset');

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || 60);
        log(`⚠️ Rate limit hit. Waiting ${retryAfter} seconds...`);
        await this.delay(retryAfter * 1000);
        return this.makeRequest(endpoint, options);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GHL API Error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logError('GHL API Request failed:', error);
      throw error;
    }
  }

  /**
   * Search contacts with pagination support
   */
  async searchContacts(options = {}) {
    // Create clean options object
    const { pageLimit, locationId, ...otherOptions } = options;

    const body = {
      locationId: this.locationId,
      pageLimit: parseInt(pageLimit || 100),
      ...otherOptions
    };

    const response = await this.makeRequest('/contacts/search', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    return response;
  }

  /**
   * Get single contact by ID
   */
  async getContact(contactId) {
    return await this.makeRequest(`/contacts/${contactId}`, {
      method: 'GET'
    });
  }

  /**
   * Get all contacts using generator for memory efficiency
   */
  async *contactsIterator(options = {}) {
    let hasMore = true;
    let searchAfter = null;
    let totalFetched = 0;

    log(`🔄 Starting GHL contacts iteration...`);

    while (hasMore) {
      try {
        // Add delay between requests to avoid rate limiting
        if (searchAfter) {
          await this.delay(500); // 500ms delay between requests
        }

        const searchOptions = {
          ...options,
          pageLimit: options.pageLimit || 100
        };

        if (searchAfter) {
          searchOptions.searchAfter = searchAfter;  // Use searchAfter from response
        }

        const result = await this.searchContacts(searchOptions);

        if (result.contacts && result.contacts.length > 0) {
          totalFetched += result.contacts.length;
          log(`📦 Fetched batch: ${result.contacts.length} contacts (Total: ${totalFetched}/${result.total || 'unknown'})`);

          yield result.contacts;

          // Update pagination cursor - use searchAfter from last contact
          const lastContact = result.contacts[result.contacts.length - 1];
          searchAfter = lastContact.searchAfter;

          // Check if there are more pages
          hasMore = result.contacts.length === (options.pageLimit || 100) && searchAfter;
        } else {
          hasMore = false;
        }

        // Check rate limit and pause if needed
        if (this.rateLimitRemaining < 10) {
          log(`⚠️ Low rate limit (${this.rateLimitRemaining} remaining). Pausing...`);
          await this.delay(5000);
        }

      } catch (error) {
        logError('Error in contacts iterator:', error);
        throw error;
      }
    }

    log(`✅ Iteration complete. Total contacts fetched: ${totalFetched}`);
  }

  /**
   * Get all contacts (non-generator version)
   */
  async getAllContacts(options = {}) {
    const allContacts = [];

    for await (const batch of this.contactsIterator(options)) {
      allContacts.push(...batch);
    }

    return allContacts;
  }

  /**
   * Get contacts by date range
   */
  async getContactsByDateRange(startDate, endDate, options = {}) {
    const searchOptions = {
      ...options,
      startDate: startDate instanceof Date ? startDate.toISOString() : startDate,
      endDate: endDate instanceof Date ? endDate.toISOString() : endDate
    };

    return this.getAllContacts(searchOptions);
  }

  /**
   * Search contact by phone number
   */
  async searchContactByPhone(phoneNumber) {
    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');

    const response = await this.searchContacts({
      query: cleanPhone,
      pageLimit: 10
    });

    // Find exact match
    if (response.contacts) {
      const exactMatch = response.contacts.find(contact => {
        const contactPhone = (contact.phone || '').replace(/[\s\-\(\)]/g, '');
        return contactPhone === cleanPhone;
      });

      if (exactMatch) {
        return exactMatch;
      }

      // Return first result if no exact match
      return response.contacts[0] || null;
    }

    return null;
  }

  /**
   * Get contact notes
   */
  async getContactNotes(contactId) {
    return await this.makeRequest(`/contacts/${contactId}/notes`, {
      method: 'GET'
    });
  }

  /**
   * Add note to contact
   */
  async addNoteToContact(contactId, noteBody, userId = null) {
    const body = {
      body: noteBody
    };

    if (userId) {
      body.userId = userId;
    }

    return await this.makeRequest(`/contacts/${contactId}/notes`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Get contact tasks
   */
  async getContactTasks(contactId) {
    return await this.makeRequest(`/contacts/${contactId}/tasks`, {
      method: 'GET'
    });
  }

  /**
   * Get contact appointments
   */
  async getContactAppointments(contactId) {
    return await this.makeRequest(`/contacts/${contactId}/appointments`, {
      method: 'GET'
    });
  }

  /**
   * Get all appointments for a location with pagination
   */
  async getAppointments(options = {}) {
    const params = new URLSearchParams({
      locationId: this.locationId,
      limit: options.limit || 100,
      ...(options.startDate && { startDate: options.startDate }),
      ...(options.endDate && { endDate: options.endDate }),
      ...(options.contactId && { contactId: options.contactId }),
      ...(options.offset && { offset: options.offset })
    });

    return await this.makeRequest(`/calendars/events?${params.toString()}`, {
      method: 'GET'
    });
  }

  /**
   * Get conversations for location with pagination
   */
  async getConversations(options = {}) {
    const params = new URLSearchParams({
      locationId: this.locationId,
      limit: options.limit || 100,
      ...(options.offset && { offset: options.offset }),
      ...(options.type && { type: options.type }),
      ...(options.contactId && { contactId: options.contactId })
    });

    return await this.makeRequest(`/conversations/search?${params.toString()}`, {
      method: 'GET'
    });
  }

  /**
   * Get messages for a specific conversation
   */
  async getConversationMessages(conversationId, options = {}) {
    const params = new URLSearchParams({
      limit: options.limit || 100,
      ...(options.offset && { offset: options.offset }),
      ...(options.type && { type: options.type })
    });

    return await this.makeRequest(`/conversations/${conversationId}/messages?${params.toString()}`, {
      method: 'GET'
    });
  }

  /**
   * Get pipelines for location
   */
  async getPipelines(options = {}) {
    const params = new URLSearchParams({
      locationId: this.locationId
    });

    return await this.makeRequest(`/opportunities/pipelines?${params.toString()}`, {
      method: 'GET'
    });
  }

  /**
   * Get all conversations using iterator for memory efficiency
   */
  async *conversationsIterator(options = {}) {
    let hasMore = true;
    let offset = 0;
    let totalFetched = 0;

    while (hasMore) {
      try {
        if (offset > 0) {
          await this.delay(500); // Rate limiting delay
        }

        const result = await this.getConversations({
          ...options,
          offset
        });

        if (result.conversations && result.conversations.length > 0) {
          totalFetched += result.conversations.length;
          log(`📦 Fetched batch: ${result.conversations.length} conversations (Total: ${totalFetched})`);

          yield result.conversations;

          offset += result.conversations.length;
          hasMore = result.conversations.length === (options.limit || 100);
        } else {
          hasMore = false;
        }

        // Check rate limit
        if (this.rateLimitRemaining < 10) {
          log(`⚠️ Low rate limit (${this.rateLimitRemaining} remaining). Pausing...`);
          await this.delay(5000);
        }
      } catch (error) {
        logError('Error in conversations iterator:', error);
        throw error;
      }
    }

    log(`✅ Conversations iteration complete. Total fetched: ${totalFetched}`);
  }

  /**
   * Update contact
   */
  async updateContact(contactId, updates) {
    return await this.makeRequest(`/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  /**
   * Create new contact
   */
  async createContact(contactData) {
    const body = {
      locationId: this.locationId,
      ...contactData
    };

    return await this.makeRequest('/contacts', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Upsert contact (create or update)
   */
  async upsertContact(contactData) {
    const body = {
      locationId: this.locationId,
      ...contactData
    };

    return await this.makeRequest('/contacts/upsert', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Bulk operations - Add tags to multiple contacts
   */
  async bulkAddTags(contactIds, tags) {
    const body = {
      ids: contactIds,
      tags: tags
    };

    return await this.makeRequest('/contacts/bulk/tags', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Get opportunities for a contact
   * Uses the search endpoint with contactId filter
   */
  async getContactOpportunities(contactId) {
    if (!this.locationId) {
      throw new Error(`locationId is required for opportunities search. Current value: ${this.locationId}`);
    }

    const params = new URLSearchParams({
      location_id: this.locationId,  // GHL REST API uses snake_case
      contact_id: contactId,         // GHL REST API uses snake_case
      limit: '100'
    });

    const url = `/opportunities/search?${params.toString()}`;

    return await this.makeRequest(url, {
      method: 'GET'
    });
  }

  /**
   * Search opportunities with filters
   */
  async searchOpportunities(filters = {}) {
    const params = new URLSearchParams({
      location_id: this.locationId,  // GHL REST API uses snake_case
      limit: 100,
      ...filters
    });

    return await this.makeRequest(`/opportunities/search?${params.toString()}`, {
      method: 'GET'
    });
  }

  /**
   * Utility: Delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus() {
    return {
      remaining: this.rateLimitRemaining,
      resetAt: this.rateLimitReset
    };
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const result = await this.searchContacts({ pageLimit: 1 });
      return {
        success: true,
        locationId: this.locationId,
        totalContacts: result.total || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle exponential backoff for retries
   */
  async retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (i < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          log(`🔄 Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    throw lastError;
  }
}

export default GHLAPIClient;