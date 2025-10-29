#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * GHL → CloudTalk Migration Script
 *
 * Migrates contacts from GHL database to CloudTalk following specific rules:
 * 1. Nuovi Lead (# tentativi = 1, tag: nuovi_lead)
 * 2. Mancata Risp 1-4 (# tentativi = 4, tag: lead_recenti)
 * 3. Recupero Advisor (# tentativi = 4, tag: lead_recenti)
 * 4. Contatti 2024-2025/06 (# tentativi = 11, tag: mancata_risposta)
 */
class CloudTalkMigration {
  constructor() {
    this.dbPath = path.join(__dirname, '../ghl_contacts/ghl_contacts.db');
    this.db = new Database(this.dbPath);

    // CloudTalk API setup will be added after verification

    // Allowed user IDs (exact match)
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
      rule1: { total: 0, eligible: 0 },
      rule2: { total: 0, eligible: 0 },
      rule3: { total: 0, eligible: 0 },
      rule4: { total: 0, eligible: 0 }
    };
  }

  /**
   * Flexible string matching (case-insensitive, ignores extra hyphens/spaces)
   */
  flexMatch(str1, str2) {
    if (!str1 || !str2) return false;
    const normalize = (s) => s.toLowerCase().replace(/[-\s_]/g, '').replace(/emoji/g, '');
    return normalize(str1).includes(normalize(str2)) || normalize(str2).includes(normalize(str1));
  }

  /**
   * Check if user ID is in allowed list
   */
  isAllowedUser(assignedTo) {
    if (!assignedTo || assignedTo === '') return true; // null/empty = "non assegnato"
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
   * RULE 1: Nuovi Lead
   * Pipeline "01 - Advisor", Stage like "Nuovo Lead"
   * Filters: Only allowed users
   */
  getRule1Contacts() {
    console.log('\n📋 RULE 1: Nuovi Lead');
    console.log('   Pipeline: 01 - Advisor');
    console.log('   Stage: Nuovo Lead');
    console.log('   # tentativi: 1');
    console.log('   Tag: nuovi_lead\n');

    const contacts = this.db.prepare(`
      SELECT DISTINCT c.*
      FROM ghl_contacts c
      INNER JOIN ghl_opportunities o ON c.id = o.contact_id
      WHERE o.pipeline_name = '01 - Advisor'
        AND (o.stage_name LIKE '%Nuovo Lead%' OR o.stage_name LIKE '%nuovo lead%')
        AND o.status = 'open'
    `).all();

    this.stats.rule1.total = contacts.length;
    console.log(`   Found ${contacts.length} contacts with open opportunities in "Nuovo Lead"`);

    // Filter by allowed users
    const eligible = contacts.filter(c => this.isAllowedUser(c.assigned_to));
    this.stats.rule1.eligible = eligible.length;

    console.log(`   Eligible after user filter: ${eligible.length}`);

    return eligible.map(c => ({
      ...c,
      migration_rule: 'rule1',
      call_attempts: 1,
      tags_to_add: ['nuovi_lead']
    }));
  }

  /**
   * RULE 2: Mancata Risp. 1-4
   * Pipeline "01 - Advisor", Stages "Mancata Risp. 1/2/3/4"
   * Filters: Only allowed users
   */
  getRule2Contacts() {
    console.log('\n📋 RULE 2: Mancata Risp. 1-4');
    console.log('   Pipeline: 01 - Advisor');
    console.log('   Stages: Mancata Risp. 1/2/3/4');
    console.log('   # tentativi: 4');
    console.log('   Tag: lead_recenti\n');

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

    this.stats.rule2.total = contacts.length;
    console.log(`   Found ${contacts.length} contacts`);

    const eligible = contacts.filter(c => this.isAllowedUser(c.assigned_to));
    this.stats.rule2.eligible = eligible.length;

    console.log(`   Eligible after user filter: ${eligible.length}`);

    return eligible.map(c => ({
      ...c,
      migration_rule: 'rule2',
      call_attempts: 4,
      tags_to_add: ['lead_recenti']
    }));
  }

  /**
   * RULE 3: Recupero Advisor
   * Pipeline "03 - Recupero Advisor" (any stage)
   * Filters: Only allowed users
   */
  getRule3Contacts() {
    console.log('\n📋 RULE 3: Recupero Advisor');
    console.log('   Pipeline: 03 - Recupero Advisor');
    console.log('   Stage: Any');
    console.log('   # tentativi: 4');
    console.log('   Tag: lead_recenti\n');

    const contacts = this.db.prepare(`
      SELECT DISTINCT c.*
      FROM ghl_contacts c
      INNER JOIN ghl_opportunities o ON c.id = o.contact_id
      WHERE o.pipeline_name LIKE '%Recupero Advisor%'
        AND o.status = 'open'
    `).all();

    this.stats.rule3.total = contacts.length;
    console.log(`   Found ${contacts.length} contacts`);

    const eligible = contacts.filter(c => this.isAllowedUser(c.assigned_to));
    this.stats.rule3.eligible = eligible.length;

    console.log(`   Eligible after user filter: ${eligible.length}`);

    return eligible.map(c => ({
      ...c,
      migration_rule: 'rule3',
      call_attempts: 4,
      tags_to_add: ['lead_recenti']
    }));
  }

  /**
   * RULE 4: Contatti 2024 - Giugno 2025
   * Created between 2024-01-01 and 2025-06-30
   * Excludes: cliente tags, specific custom fields, WON opportunities
   * NO user filter (all contacts)
   */
  getRule4Contacts() {
    console.log('\n📋 RULE 4: Contatti 2024 - Giugno 2025');
    console.log('   Period: 2024-01-01 to 2025-06-30');
    console.log('   # tentativi: 11');
    console.log('   Tag: mancata_risposta');
    console.log('   Filters: NO cliente tags, NO specific custom fields, NO won opps\n');

    const contacts = this.db.prepare(`
      SELECT *
      FROM ghl_contacts
      WHERE date_added >= '2024-01-01'
        AND date_added <= '2025-06-30'
    `).all();

    this.stats.rule4.total = contacts.length;
    console.log(`   Found ${contacts.length} contacts in date range`);

    // Apply exclusion filters
    const eligible = contacts.filter(c => {
      // Exclude if has cliente tags
      if (this.hasExcludedTags(c.tags)) return false;

      // Exclude if has excluded custom fields filled
      if (this.hasExcludedCustomFields(c.custom_fields)) return false;

      // Exclude if has WON opportunity
      if (this.hasWonOpportunity(c.id)) return false;

      return true;
    });

    this.stats.rule4.eligible = eligible.length;
    console.log(`   Eligible after exclusion filters: ${eligible.length}`);

    return eligible.map(c => ({
      ...c,
      migration_rule: 'rule4',
      call_attempts: 11,
      tags_to_add: ['mancata_risposta']
    }));
  }

  /**
   * Remove duplicates (if contact appears in multiple rules)
   * Priority: Rule 1 > Rule 2 > Rule 3 > Rule 4
   */
  deduplicateContacts(allContacts) {
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
   * Main execution - DRY RUN (no actual CloudTalk API calls yet)
   */
  async run(dryRun = true) {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 GHL → CLOUDTALK MIGRATION');
    console.log('='.repeat(80));

    if (dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No actual API calls will be made\n');
    }

    try {
      // Get contacts for each rule (in priority order)
      const rule1 = this.getRule1Contacts();
      const rule2 = this.getRule2Contacts();
      const rule3 = this.getRule3Contacts();
      const rule4 = this.getRule4Contacts();

      // Combine all contacts (priority order)
      const allContacts = [...rule1, ...rule2, ...rule3, ...rule4];

      // Remove duplicates
      const deduplicated = this.deduplicateContacts(allContacts);

      console.log('\n' + '='.repeat(80));
      console.log('📊 MIGRATION SUMMARY');
      console.log('='.repeat(80));
      console.log(`Rule 1 (Nuovi Lead):          ${this.stats.rule1.total} found → ${this.stats.rule1.eligible} eligible`);
      console.log(`Rule 2 (Mancata Risp. 1-4):   ${this.stats.rule2.total} found → ${this.stats.rule2.eligible} eligible`);
      console.log(`Rule 3 (Recupero Advisor):    ${this.stats.rule3.total} found → ${this.stats.rule3.eligible} eligible`);
      console.log(`Rule 4 (2024-2025/06):        ${this.stats.rule4.total} found → ${this.stats.rule4.eligible} eligible`);
      console.log('-'.repeat(80));
      console.log(`Total before dedup:           ${allContacts.length}`);
      console.log(`Total after dedup:            ${deduplicated.length}`);
      console.log('='.repeat(80) + '\n');

      // Show sample of first 5 contacts
      console.log('📝 SAMPLE CONTACTS (first 5):\n');
      deduplicated.slice(0, 5).forEach((c, i) => {
        console.log(`${i + 1}. ${c.first_name} ${c.last_name} (${c.phone || c.email})`);
        console.log(`   Rule: ${c.migration_rule}`);
        console.log(`   # tentativi: ${c.call_attempts}`);
        console.log(`   Tags: ${c.tags_to_add.join(', ')}`);
        console.log(`   Squadd ID: ${c.id}`);
        console.log('');
      });

      if (dryRun) {
        console.log('✅ DRY RUN COMPLETE - Review the numbers above\n');
        console.log('To proceed with actual migration to CloudTalk:');
        console.log('  node scripts/migrate-to-cloudtalk.js --execute\n');
      }

    } catch (error) {
      console.error('\n❌ ERROR:', error.message);
      console.error(error.stack);
    } finally {
      this.db.close();
    }
  }
}

// Execute
const dryRun = !process.argv.includes('--execute');
const migration = new CloudTalkMigration();
migration.run(dryRun).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
