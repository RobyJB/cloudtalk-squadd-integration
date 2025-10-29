import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migrate custom fields from JSON to individual columns
 */
class CustomFieldMigration {
  constructor(dbPath, analysisPath) {
    this.db = new Database(dbPath);
    this.analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
    this.columnMapping = this.analysis.columnMapping;
  }

  /**
   * Step 1: Add new columns to the table
   */
  async addColumns() {
    console.log('🔧 Step 1: Adding new columns to ghl_contacts table...\n');

    let added = 0;
    let skipped = 0;

    for (const [fieldId, config] of Object.entries(this.columnMapping)) {
      const { columnName, sqlType } = config;

      try {
        // Check if column already exists
        const columns = this.db.prepare("PRAGMA table_info(ghl_contacts)").all();
        const exists = columns.some(col => col.name === columnName);

        if (exists) {
          console.log(`  ⏭️  Skipped ${columnName} (already exists)`);
          skipped++;
          continue;
        }

        // Add the column
        this.db.exec(`ALTER TABLE ghl_contacts ADD COLUMN ${columnName} ${sqlType}`);
        console.log(`  ✅ Added ${columnName} ${sqlType}`);
        added++;

      } catch (error) {
        console.error(`  ❌ Error adding ${columnName}:`, error.message);
      }
    }

    console.log(`\n📊 Summary: ${added} columns added, ${skipped} skipped\n`);
  }

  /**
   * Step 2: Migrate data from JSON to columns
   */
  async migrateData() {
    console.log('🔄 Step 2: Migrating data from JSON to individual columns...\n');

    const contacts = this.db.prepare('SELECT id, custom_fields FROM ghl_contacts WHERE custom_fields IS NOT NULL').all();

    console.log(`📦 Processing ${contacts.length} contacts...\n`);

    let processed = 0;
    let errors = 0;

    const updateStmt = this.prepareUpdateStatement();

    for (const contact of contacts) {
      try {
        const customFields = JSON.parse(contact.custom_fields);

        if (!Array.isArray(customFields) || customFields.length === 0) {
          continue;
        }

        // Build update data
        const updateData = { id: contact.id };

        for (const field of customFields) {
          if (!field.id || !this.columnMapping[field.id]) continue;

          const { columnName, primaryType } = this.columnMapping[field.id];
          const value = this.convertValue(field.value, primaryType);

          updateData[columnName] = value;
        }

        // Execute update
        this.executeUpdate(updateData);

        processed++;

        if (processed % 100 === 0) {
          console.log(`  📝 Processed ${processed}/${contacts.length} contacts...`);
        }

      } catch (error) {
        console.error(`  ❌ Error processing contact ${contact.id}:`, error.message);
        errors++;
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Errors: ${errors}\n`);
  }

  /**
   * Convert value based on type
   */
  convertValue(value, primaryType) {
    if (value === null || value === undefined) {
      return null;
    }

    switch (primaryType) {
      case 'array':
      case 'array_of_strings':
        // Store arrays as JSON string
        return JSON.stringify(value);

      case 'number':
        return typeof value === 'number' ? value : parseFloat(value);

      case 'boolean':
        return value ? 1 : 0;

      case 'string':
      default:
        return Array.isArray(value) ? value.join(', ') : String(value);
    }
  }

  /**
   * Execute update with dynamic columns
   */
  executeUpdate(data) {
    const { id, ...fields } = data;

    if (Object.keys(fields).length === 0) return;

    const setClause = Object.keys(fields)
      .map(col => `${col} = @${col}`)
      .join(', ');

    const sql = `UPDATE ghl_contacts SET ${setClause} WHERE id = @id`;

    try {
      const stmt = this.db.prepare(sql);
      stmt.run({ id, ...fields });
    } catch (error) {
      console.error(`Error updating contact ${id}:`, error.message);
    }
  }

  /**
   * Prepare a generic update statement
   * (Not used in current implementation but useful for batch updates)
   */
  prepareUpdateStatement() {
    return null; // Using dynamic SQL instead
  }

  /**
   * Step 3: Verify migration
   */
  verifyMigration() {
    console.log('🔍 Step 3: Verifying migration...\n');

    // Check a sample of migrated data
    const sampleSize = Math.min(5, this.db.prepare('SELECT COUNT(*) as count FROM ghl_contacts').get().count);

    const columns = Object.values(this.columnMapping).map(c => c.columnName).slice(0, 5).join(', ');
    const query = `SELECT id, first_name, last_name, ${columns} FROM ghl_contacts LIMIT ${sampleSize}`;

    const samples = this.db.prepare(query).all();

    console.log('Sample migrated data:');
    console.table(samples);

    console.log('\n✅ Verification complete!\n');
  }

  /**
   * Run full migration
   */
  async runFullMigration() {
    console.log('🚀 Starting Custom Fields Migration\n');
    console.log('='.repeat(80) + '\n');

    try {
      await this.addColumns();
      await this.migrateData();
      this.verifyMigration();

      console.log('='.repeat(80));
      console.log('\n🎉 Migration completed successfully!\n');

    } catch (error) {
      console.error('\n❌ Migration failed:', error.message);
      throw error;
    }
  }

  close() {
    this.db.close();
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = path.join(__dirname, '../ghl_contacts/ghl_contacts.db');
  const analysisPath = path.join(__dirname, 'custom-fields-analysis.json');

  console.log(`📂 Database: ${dbPath}`);
  console.log(`📋 Analysis: ${analysisPath}\n`);

  // Check if analysis file exists
  if (!fs.existsSync(analysisPath)) {
    console.error('❌ Analysis file not found!');
    console.error('   Please run: node scripts/analyze-custom-fields.js first\n');
    process.exit(1);
  }

  const migration = new CustomFieldMigration(dbPath, analysisPath);

  migration.runFullMigration()
    .then(() => {
      migration.close();
      process.exit(0);
    })
    .catch(error => {
      migration.close();
      process.exit(1);
    });
}

export { CustomFieldMigration };
