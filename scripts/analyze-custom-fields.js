import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Analyze existing contacts to extract all custom field definitions
 * Since GHL API doesn't support getting custom fields for contacts yet,
 * we analyze the data we already have
 */
class CustomFieldAnalyzer {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.customFieldsMap = new Map(); // id -> { id, count, sampleValues, types }
  }

  /**
   * Analyze all contacts in the database
   */
  analyze() {
    console.log('🔍 Analyzing custom fields from existing contacts...\n');

    const contacts = this.db.prepare('SELECT id, custom_fields FROM ghl_contacts WHERE custom_fields IS NOT NULL').all();

    console.log(`📊 Found ${contacts.length} contacts with custom fields\n`);

    for (const contact of contacts) {
      try {
        const customFields = JSON.parse(contact.custom_fields);

        if (Array.isArray(customFields)) {
          for (const field of customFields) {
            this.processField(field);
          }
        }
      } catch (error) {
        console.error(`Error parsing custom fields for contact ${contact.id}:`, error.message);
      }
    }

    return this.generateReport();
  }

  /**
   * Process a single custom field
   */
  processField(field) {
    if (!field.id) return;

    if (!this.customFieldsMap.has(field.id)) {
      this.customFieldsMap.set(field.id, {
        id: field.id,
        count: 0,
        sampleValues: [],
        types: new Set()
      });
    }

    const fieldData = this.customFieldsMap.get(field.id);
    fieldData.count++;

    // Determine type and collect samples
    const value = field.value;
    const valueType = Array.isArray(value) ? 'array' : typeof value;
    fieldData.types.add(valueType);

    // Store sample values (max 5)
    if (fieldData.sampleValues.length < 5) {
      fieldData.sampleValues.push(value);
    }
  }

  /**
   * Generate analysis report
   */
  generateReport() {
    console.log('📋 Custom Fields Analysis Report\n');
    console.log('='.repeat(80));

    const fields = Array.from(this.customFieldsMap.values())
      .sort((a, b) => b.count - a.count); // Sort by frequency

    const report = {
      totalUniqueFields: fields.length,
      fields: []
    };

    for (const [index, field] of fields.entries()) {
      const types = Array.from(field.types);
      const primaryType = this.determinePrimaryType(types, field.sampleValues);

      const fieldInfo = {
        index: index + 1,
        id: field.id,
        count: field.count,
        types: types,
        primaryType: primaryType,
        suggestedSQLType: this.getSQLType(primaryType),
        sampleValues: field.sampleValues.slice(0, 3) // Show only 3 samples in report
      };

      report.fields.push(fieldInfo);

      // Print field info
      console.log(`\n${index + 1}. Field ID: ${field.id}`);
      console.log(`   Occurrences: ${field.count}`);
      console.log(`   Types: ${types.join(', ')}`);
      console.log(`   Primary Type: ${primaryType}`);
      console.log(`   Suggested SQL Type: ${fieldInfo.suggestedSQLType}`);
      console.log(`   Sample Values:`);
      field.sampleValues.slice(0, 3).forEach((val, i) => {
        console.log(`     ${i + 1}. ${JSON.stringify(val)}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Total unique custom fields found: ${fields.length}\n`);

    return report;
  }

  /**
   * Determine the primary type from all observed types
   */
  determinePrimaryType(types, sampleValues) {
    // If only one type, that's the primary
    if (types.length === 1) {
      return types[0];
    }

    // If mixed types, analyze samples to determine best fit
    const hasArray = types.includes('array');
    const hasString = types.includes('string');
    const hasNumber = types.includes('number');
    const hasBoolean = types.includes('boolean');

    // Check if arrays contain consistent types
    if (hasArray) {
      const arrayValues = sampleValues.filter(v => Array.isArray(v));
      if (arrayValues.length > 0) {
        const firstArray = arrayValues[0];
        if (firstArray.length > 0 && typeof firstArray[0] === 'string') {
          return 'array_of_strings';
        }
      }
      return 'array';
    }

    if (hasNumber) return 'number';
    if (hasBoolean) return 'boolean';
    if (hasString) return 'string';

    return 'string'; // default fallback
  }

  /**
   * Get appropriate SQL type for a JavaScript type
   */
  getSQLType(jsType) {
    const typeMap = {
      'string': 'TEXT',
      'number': 'REAL',
      'boolean': 'INTEGER',
      'array': 'TEXT', // Store as JSON
      'array_of_strings': 'TEXT', // Store as JSON or comma-separated
      'object': 'TEXT'
    };

    return typeMap[jsType] || 'TEXT';
  }

  /**
   * Generate SQL column name from field ID
   */
  generateColumnName(fieldId) {
    // Use cf_ prefix (custom field) + sanitized ID
    return `cf_${fieldId.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * Generate ALTER TABLE statements
   */
  generateMigrationSQL(report) {
    console.log('\n' + '='.repeat(80));
    console.log('🛠️  Generated SQL Migration Statements\n');

    const sqlStatements = [];

    for (const field of report.fields) {
      const columnName = this.generateColumnName(field.id);
      const sqlType = field.suggestedSQLType;

      const alterTable = `ALTER TABLE ghl_contacts ADD COLUMN ${columnName} ${sqlType};`;
      sqlStatements.push({
        fieldId: field.id,
        columnName,
        statement: alterTable
      });

      console.log(alterTable);
    }

    console.log('\n' + '='.repeat(80));

    return sqlStatements;
  }

  /**
   * Generate column mapping for future use
   */
  generateColumnMapping(report) {
    const mapping = {};

    for (const field of report.fields) {
      const columnName = this.generateColumnName(field.id);
      mapping[field.id] = {
        columnName,
        sqlType: field.suggestedSQLType,
        primaryType: field.primaryType
      };
    }

    return mapping;
  }

  close() {
    this.db.close();
  }
}

// Main execution
const dbPath = path.join(__dirname, '../ghl_contacts/ghl_contacts.db');

console.log(`📂 Database: ${dbPath}\n`);

const analyzer = new CustomFieldAnalyzer(dbPath);
const report = analyzer.analyze();
const sqlStatements = analyzer.generateMigrationSQL(report);
const columnMapping = analyzer.generateColumnMapping(report);

// Save results to JSON file
import fs from 'fs';
const resultsPath = path.join(__dirname, 'custom-fields-analysis.json');
const results = {
  analyzedAt: new Date().toISOString(),
  report,
  sqlStatements,
  columnMapping
};

fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
console.log(`\n💾 Results saved to: ${resultsPath}\n`);

analyzer.close();

export { CustomFieldAnalyzer };
