#!/usr/bin/env node

import { CustomFieldAnalyzer } from './analyze-custom-fields.js';
import { CustomFieldMigration } from './migrate-custom-fields-to-columns.js';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Complete database restructuring orchestrator
 * 1. Analyzes custom fields from existing data
 * 2. Migrates custom fields to individual columns
 * 3. Enhances opportunities table
 */
class DatabaseRestructure {
  constructor() {
    this.dbPath = path.join(__dirname, '../ghl_contacts/ghl_contacts.db');
    this.analysisPath = path.join(__dirname, 'custom-fields-analysis.json');
    this.db = new Database(this.dbPath);
  }

  async run() {
    console.log('\n' + '='.repeat(80));
    console.log('🔧 GHL DATABASE RESTRUCTURING');
    console.log('='.repeat(80) + '\n');

    console.log(`📂 Database: ${this.dbPath}\n`);

    try {
      // Step 1: Analyze custom fields
      await this.analyzeCustomFields();

      // Step 2: Enhance opportunities table
      await this.enhanceOpportunitiesTable();

      // Step 3: Migrate contact custom fields
      await this.migrateContactCustomFields();

      // Step 4: Final verification
      await this.finalVerification();

      console.log('\n' + '='.repeat(80));
      console.log('🎉 DATABASE RESTRUCTURING COMPLETE!');
      console.log('='.repeat(80) + '\n');

    } catch (error) {
      console.error('\n' + '='.repeat(80));
      console.error('❌ DATABASE RESTRUCTURING FAILED');
      console.error('='.repeat(80));
      console.error('\nError:', error.message);
      console.error('\nStack:', error.stack);
      process.exit(1);
    } finally {
      this.db.close();
    }
  }

  async analyzeCustomFields() {
    console.log('📊 STEP 1: Analyzing Custom Fields\n');

    const analyzer = new CustomFieldAnalyzer(this.dbPath);
    const report = analyzer.analyze();
    const sqlStatements = analyzer.generateMigrationSQL(report);
    const columnMapping = analyzer.generateColumnMapping(report);

    // Save analysis results
    const results = {
      analyzedAt: new Date().toISOString(),
      report,
      sqlStatements,
      columnMapping
    };

    fs.writeFileSync(this.analysisPath, JSON.stringify(results, null, 2));
    console.log(`💾 Analysis saved to: ${this.analysisPath}\n`);

    analyzer.close();
  }

  async enhanceOpportunitiesTable() {
    console.log('\n' + '-'.repeat(80));
    console.log('🔧 STEP 2: Enhancing Opportunities Table\n');

    const newColumns = [
      { name: 'name', type: 'TEXT' },
      { name: 'pipeline_name', type: 'TEXT' },
      { name: 'stage_name', type: 'TEXT' },
      { name: 'assigned_to', type: 'TEXT' },
      { name: 'source', type: 'TEXT' },
      { name: 'last_status_change_at', type: 'DATETIME' },
      { name: 'last_stage_change_at', type: 'DATETIME' },
      { name: 'lead_value', type: 'REAL' },
      { name: 'custom_fields', type: 'TEXT' },
      { name: 'tags', type: 'TEXT' }
    ];

    let added = 0;
    let skipped = 0;

    for (const col of newColumns) {
      try {
        const columns = this.db.prepare("PRAGMA table_info(ghl_opportunities)").all();
        const exists = columns.some(c => c.name === col.name);

        if (exists) {
          console.log(`  ⏭️  Skipped ${col.name} (already exists)`);
          skipped++;
          continue;
        }

        this.db.exec(`ALTER TABLE ghl_opportunities ADD COLUMN ${col.name} ${col.type}`);
        console.log(`  ✅ Added ${col.name} ${col.type}`);
        added++;

      } catch (error) {
        console.error(`  ❌ Error adding ${col.name}:`, error.message);
      }
    }

    console.log(`\n📊 Summary: ${added} columns added, ${skipped} skipped\n`);
  }

  async migrateContactCustomFields() {
    console.log('\n' + '-'.repeat(80));
    console.log('🔄 STEP 3: Migrating Contact Custom Fields to Columns\n');

    const migration = new CustomFieldMigration(this.dbPath, this.analysisPath);
    await migration.runFullMigration();
    migration.close();
  }

  async finalVerification() {
    console.log('\n' + '-'.repeat(80));
    console.log('🔍 STEP 4: Final Verification\n');

    // Verify contacts table
    const contactColumns = this.db.prepare("PRAGMA table_info(ghl_contacts)").all();
    const customFieldColumns = contactColumns.filter(c => c.name.startsWith('cf_'));

    console.log(`✅ Contacts table: ${contactColumns.length} total columns`);
    console.log(`   - ${customFieldColumns.length} custom field columns\n`);

    // Verify opportunities table
    const oppColumns = this.db.prepare("PRAGMA table_info(ghl_opportunities)").all();
    console.log(`✅ Opportunities table: ${oppColumns.length} total columns\n`);

    // Count records
    const contactCount = this.db.prepare('SELECT COUNT(*) as count FROM ghl_contacts').get().count;
    const oppCount = this.db.prepare('SELECT COUNT(*) as count FROM ghl_opportunities').get().count;

    console.log(`📊 Data counts:`);
    console.log(`   - Contacts: ${contactCount}`);
    console.log(`   - Opportunities: ${oppCount}\n`);

    // Sample data
    console.log('📄 Sample contact with custom fields:');
    const sampleCols = customFieldColumns.slice(0, 5).map(c => c.name).join(', ');
    if (sampleCols) {
      const sample = this.db.prepare(
        `SELECT id, first_name, last_name, ${sampleCols} FROM ghl_contacts LIMIT 1`
      ).get();

      if (sample) {
        console.table([sample]);
      }
    }

    console.log('\n✅ Verification complete!\n');
  }
}

// Main execution
const restructure = new DatabaseRestructure();
restructure.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
