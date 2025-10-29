#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * GHL → CloudTalk Migration Execution Script
 *
 * Imports contacts to CloudTalk with proper rate limiting and retry logic
 */
class CloudTalkMigrationExecutor {
  constructor() {
    this.dbPath = path.join(__dirname, '../ghl_contacts/ghl_contacts.db');
    this.db = new Database(this.dbPath);

    // CloudTalk API configuration
    this.cloudtalkBaseURL = 'https://my.cloudtalk.io/api';
    this.apiKeyId = process.env.CLOUDTALK_API_KEY_ID;
    this.apiSecret = process.env.CLOUDTALK_API_SECRET;

    if (!this.apiKeyId || !this.apiSecret) {
      throw new Error('CLOUDTALK_API_KEY_ID and CLOUDTALK_API_SECRET required in .env');
    }

    // Rate limiting (conservative)
    this.requestsPerSecond = 5;
    this.requestDelay = 1000 / this.requestsPerSecond;
    this.lastRequestTime = 0;

    // Retry configuration
    this.maxRetries = 5;
    this.retryDelays = [2000, 5000, 10000, 20000, 40000]; // Exponential backoff

    // Allowed user IDs
    this.allowedUserIds = [
      '2ZnXuJeJaNcjdKTJx8kY',  // Daniele Garofalo
      'XoI7FNtmOIDnVOjrgirU',  // Federico Zinfolino
      'hLs7wINwLHDaSJsXuhXu',  // Gabriele Demaria
      'uWKWlG6g6dyydFzLAMnH',  // Giulia Pozzati
      'BCphgl9NQyWIaNn40jkM',  // Martina Bottigelli
      'uiV4qesEPm8AwRT080U7'   // Serena Bettoni
    ];

    // Excluded tags for rule 4
    this.excludedTags = ['cliente', 'cliente pro', 'già cliente'];

    // Excluded custom fields for rule 4
    this.excludedCustomFields = [
      'Abbonamento V2',
      'Tipologia di lavoro V2',
      'Stripe Customer ID v2',
      'Importo Abbonamento V2',
      'Tipologia di chiusura'
    ];

    this.stats = {
      rule1: { total: 0, imported: 0, failed: 0 },
      rule2: { total: 0, imported: 0, failed: 0 },
      rule3: { total: 0, imported: 0, failed: 0 },
      rule4: { total: 0, imported: 0, failed: 0 }
    };
  }

  /**
   * Get Basic Auth header for CloudTalk API
   */
  getAuthHeader() {
    const credentials = Buffer.from(`${this.apiKeyId}:${this.apiSecret}`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Rate-limited request to CloudTalk API
   */
  async makeCloudTalkRequest(endpoint, options = {}, retryCount = 0) {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.requestDelay) {
      await this.delay(this.requestDelay - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();

    const url = `${this.cloudtalkBaseURL}${endpoint}`;
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': this.getAuthHeader(),
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, requestOptions);

      // Handle rate limiting (429)
      if (response.status === 429) {
        if (retryCount < this.maxRetries) {
          const retryDelay = this.retryDelays[retryCount];
          console.log(`  ⏳ Rate limited (429), retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${this.maxRetries})`);
          await this.delay(retryDelay);
          return this.makeCloudTalkRequest(endpoint, options, retryCount + 1);
        } else {
          throw new Error(`Rate limit exceeded after ${this.maxRetries} retries`);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      // Network errors - retry
      if (retryCount < this.maxRetries && (error.message.includes('fetch') || error.message.includes('network'))) {
        const retryDelay = this.retryDelays[retryCount];
        console.log(`  ⚠️  Network error, retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${this.maxRetries})`);
        await this.delay(retryDelay);
        return this.makeCloudTalkRequest(endpoint, options, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Flexible string matching
   */
  flexMatch(str1, str2) {
    if (!str1 || !str2) return false;
    const normalize = (s) => s.toLowerCase().replace(/[-\s_]/g, '').replace(/emoji/g, '');
    return normalize(str1).includes(normalize(str2)) || normalize(str2).includes(normalize(str1));
  }

  /**
   * Check if user is in allowed list
   */
  isAllowedUser(assignedTo) {
    if (!assignedTo || assignedTo === '') return true;
    return this.allowedUserIds.includes(assignedTo);
  }

  /**
   * Check if contact has excluded tags
   */
  hasExcludedTags(tags) {
    if (!tags) return false;
    try {
      const tagArray = JSON.parse(tags);
      return tagArray.some(tag =>
        this.excludedTags.some(excluded => this.flexMatch(tag, excluded))
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if contact has excluded custom fields filled
   */
  hasExcludedCustomFields(customFields) {
    if (!customFields) return false;
    try {
      const fields = JSON.parse(customFields);
      if (!Array.isArray(fields)) return false;

      return fields.some(field => {
        const hasValue = field.value || field.fieldValue || field.fieldValueString || field.fieldValueArray || field.fieldValueNumber;
        if (!hasValue) return false;

        const fieldName = field.name || field.field_name || field.key || '';
        return this.excludedCustomFields.some(excluded => this.flexMatch(fieldName, excluded));
      });
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if contact has WON opportunity
   */
  hasWonOpportunity(contactId) {
    const wonOpp = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM ghl_opportunities
      WHERE contact_id = ? AND status = 'won'
    `).get(contactId);

    return wonOpp.count > 0;
  }

  /**
   * Import contact to CloudTalk
   */
  async importContactToCloudTalk(contact, callAttempts, tags) {
    try {
      const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
      const phone = contact.phone;

      if (!phone) {
        throw new Error('No phone number');
      }

      // Clean phone number (remove spaces, dashes)
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

      const contactData = {
        name: name,
        ContactNumber: [
          {
            public_number: cleanPhone
          }
        ],
        ContactsTag: tags.map(tag => ({ name: tag })),
        ContactAttribute: [
          {
            key: 'Squadd ID',
            value: contact.id
          },
          {
            key: '# di tentativi di chiamata',
            value: String(callAttempts)
          }
        ]
      };

      const response = await this.makeCloudTalkRequest('/contacts/add.json', {
        method: 'PUT',
        body: JSON.stringify(contactData)
      });

      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all contacts for migration (deduplicated by priority)
   */
  getAllContacts() {
    // Get contacts for each rule
    const rule1 = this.getRule1Contacts();
    const rule2 = this.getRule2Contacts();
    const rule3 = this.getRule3Contacts();
    const rule4 = this.getRule4Contacts();

    // Combine in priority order
    const allContacts = [...rule1, ...rule2, ...rule3, ...rule4];

    // Deduplicate (first occurrence wins = highest priority)
    const seen = new Set();
    const deduplicated = [];

    for (const contact of allContacts) {
      if (!seen.has(contact.id)) {
        seen.add(contact.id);
        deduplicated.push(contact);
      }
    }

    return deduplicated;
  }

  /**
   * RULE 1: Nuovi Lead
   */
  getRule1Contacts() {
    const contacts = this.db.prepare(`
      SELECT DISTINCT c.*
      FROM ghl_contacts c
      INNER JOIN ghl_opportunities o ON c.id = o.contact_id
      WHERE o.pipeline_name = '01 - Advisor'
        AND (o.stage_name LIKE '%Nuovo Lead%' OR o.stage_name LIKE '%nuovo lead%')
        AND o.status = 'open'
    `).all();

    const eligible = contacts.filter(c => this.isAllowedUser(c.assigned_to));

    return eligible.map(c => ({
      ...c,
      migration_rule: 'rule1',
      call_attempts: 1,
      tags_to_add: ['nuovi_lead']
    }));
  }

  /**
   * RULE 2: Mancata Risp. 1-4
   */
  getRule2Contacts() {
    const contacts = this.db.prepare(`
      SELECT DISTINCT c.*
      FROM ghl_contacts c
      INNER JOIN ghl_opportunities o ON c.id = o.contact_id
      WHERE o.pipeline_name = '01 - Advisor'
        AND (
          o.stage_name LIKE '%Mancata Risp%1%' OR
          o.stage_name LIKE '%Mancata Risp%2%' OR
          o.stage_name LIKE '%Mancata Risp%3%' OR
          o.stage_name LIKE '%Mancata Risp%4%'
        )
        AND o.status = 'open'
    `).all();

    const eligible = contacts.filter(c => this.isAllowedUser(c.assigned_to));

    return eligible.map(c => ({
      ...c,
      migration_rule: 'rule2',
      call_attempts: 4,
      tags_to_add: ['lead_recenti']
    }));
  }

  /**
   * RULE 3: Recupero Advisor
   */
  getRule3Contacts() {
    const contacts = this.db.prepare(`
      SELECT DISTINCT c.*
      FROM ghl_contacts c
      INNER JOIN ghl_opportunities o ON c.id = o.contact_id
      WHERE o.pipeline_name LIKE '%Recupero Advisor%'
        AND o.status = 'open'
    `).all();

    const eligible = contacts.filter(c => this.isAllowedUser(c.assigned_to));

    return eligible.map(c => ({
      ...c,
      migration_rule: 'rule3',
      call_attempts: 4,
      tags_to_add: ['lead_recenti']
    }));
  }

  /**
   * RULE 4: Contatti 2024 - Giugno 2025
   */
  getRule4Contacts() {
    const contacts = this.db.prepare(`
      SELECT *
      FROM ghl_contacts
      WHERE date_added >= '2024-01-01'
        AND date_added <= '2025-06-30'
    `).all();

    const eligible = contacts.filter(c => {
      if (this.hasExcludedTags(c.tags)) return false;
      if (this.hasExcludedCustomFields(c.custom_fields)) return false;
      if (this.hasWonOpportunity(c.id)) return false;
      return true;
    });

    return eligible.map(c => ({
      ...c,
      migration_rule: 'rule4',
      call_attempts: 11,
      tags_to_add: ['mancata_risposta']
    }));
  }

  /**
   * Main execution
   */
  async run() {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 CLOUDTALK MIGRATION - EXECUTION MODE');
    console.log('='.repeat(80) + '\n');

    try {
      // Get all contacts to migrate
      console.log('📋 Preparing contacts for migration...\n');
      const allContacts = this.getAllContacts();

      console.log(`✅ Total contacts to migrate: ${allContacts.length}\n`);

      // Group by rule for reporting
      const byRule = {
        rule1: allContacts.filter(c => c.migration_rule === 'rule1'),
        rule2: allContacts.filter(c => c.migration_rule === 'rule2'),
        rule3: allContacts.filter(c => c.migration_rule === 'rule3'),
        rule4: allContacts.filter(c => c.migration_rule === 'rule4')
      };

      console.log('📊 Migration Breakdown:');
      console.log(`   Rule 1 (Nuovi Lead):       ${byRule.rule1.length} contacts`);
      console.log(`   Rule 2 (Mancata Risp):     ${byRule.rule2.length} contacts`);
      console.log(`   Rule 3 (Recupero Advisor): ${byRule.rule3.length} contacts`);
      console.log(`   Rule 4 (2024-2025/06):     ${byRule.rule4.length} contacts\n`);

      console.log('🔄 Starting import to CloudTalk...\n');

      let totalImported = 0;
      let totalFailed = 0;

      for (let i = 0; i < allContacts.length; i++) {
        const contact = allContacts[i];
        const progress = `[${i + 1}/${allContacts.length}]`;

        const result = await this.importContactToCloudTalk(
          contact,
          contact.call_attempts,
          contact.tags_to_add
        );

        if (result.success) {
          totalImported++;
          this.stats[contact.migration_rule].imported++;
          console.log(`  ✅ ${progress} Imported: ${contact.first_name} ${contact.last_name} (${contact.phone}) - ${contact.migration_rule}`);
        } else {
          totalFailed++;
          this.stats[contact.migration_rule].failed++;
          console.log(`  ❌ ${progress} Failed: ${contact.first_name} ${contact.last_name} (${contact.phone}) - ${result.error}`);
        }

        // Progress checkpoint every 100 contacts
        if ((i + 1) % 100 === 0) {
          console.log(`\n📊 Progress: ${i + 1}/${allContacts.length} (${Math.round((i + 1) / allContacts.length * 100)}%)`);
          console.log(`   Imported: ${totalImported}, Failed: ${totalFailed}\n`);
        }
      }

      console.log('\n' + '='.repeat(80));
      console.log('✅ MIGRATION COMPLETE!');
      console.log('='.repeat(80));
      console.log(`\n📊 Final Statistics:`);
      console.log(`   Total processed: ${allContacts.length}`);
      console.log(`   Successfully imported: ${totalImported}`);
      console.log(`   Failed: ${totalFailed}\n`);

      console.log('📋 By Rule:');
      console.log(`   Rule 1: ${this.stats.rule1.imported} imported, ${this.stats.rule1.failed} failed`);
      console.log(`   Rule 2: ${this.stats.rule2.imported} imported, ${this.stats.rule2.failed} failed`);
      console.log(`   Rule 3: ${this.stats.rule3.imported} imported, ${this.stats.rule3.failed} failed`);
      console.log(`   Rule 4: ${this.stats.rule4.imported} imported, ${this.stats.rule4.failed} failed\n`);

    } catch (error) {
      console.error('\n❌ FATAL ERROR:', error.message);
      console.error(error.stack);
    } finally {
      this.db.close();
    }
  }
}

// Execute
const executor = new CloudTalkMigrationExecutor();
executor.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
