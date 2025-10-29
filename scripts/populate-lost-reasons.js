#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Populate lost reasons lookup table
 */
class LostReasonsPopulator {
  constructor() {
    this.dbPath = path.join(__dirname, '../ghl_contacts/ghl_contacts.db');
    this.db = new Database(this.dbPath);

    // Mappatura fornita dall'utente
    this.lostReasons = [
      { id: '68e42bee31d03a816d551b85', name: 'Molestatore seriale' },
      { id: '68e3c2e565dc67cf257b1904', name: 'Solo gestione appuntamenti' },
      { id: '68e3c2e5b83d1643c513e2ff', name: 'Solo whatsapp massivo' },
      { id: '68dbe90121c2ca35feb032e9', name: 'Non ora' },
      { id: '661d4ed2b9691e3c82402daa', name: 'Fuori budget' },
      { id: '68cc7d6cae0cf13fd8ee806f', name: 'Straniero' },
      { id: '68cc7d6c2564837c50403dd4', name: 'Cerca lavoro' },
      { id: '68cc7d6c6cca92e7cdcd00ab', name: 'Non ha capito perché ha cliccato' },
      { id: '68cc7d6cf52ae888f6b44244', name: 'Bambino' },
      { id: '6870dfbce4d4bd79fe9550a4', name: 'Fuori target' },
      { id: '6630f77124b6d98b300f410', name: 'Già cliente' },
      { id: '663329f66058220b13f7f295', name: 'Non interessato' },
      { id: '6633294590db8b2d0ce8b12e', name: 'Non risponde' },
      { id: '65eddf392cd1023fe3199648', name: 'Dati errati' }
    ];
  }

  run() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 POPULATING LOST REASONS TABLE');
    console.log('='.repeat(80) + '\n');

    try {
      // Create table if not exists
      console.log('🏗️  Creating ghl_lost_reasons table...\n');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ghl_lost_reasons (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('  ✅ Table created\n');

      // Insert lost reasons
      console.log('💾 Inserting lost reasons...\n');

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO ghl_lost_reasons (id, name)
        VALUES (?, ?)
      `);

      let inserted = 0;
      for (const reason of this.lostReasons) {
        stmt.run(reason.id, reason.name);
        console.log(`  ✅ ${reason.name} (${reason.id})`);
        inserted++;
      }

      console.log(`\n📊 Inserted ${inserted} lost reasons\n`);

      // Verify
      const count = this.db.prepare('SELECT COUNT(*) as count FROM ghl_lost_reasons').get().count;
      console.log(`🔍 Verification: ${count} lost reasons in database\n`);

      // Show sample JOIN query
      console.log('📝 Sample Query with JOIN:\n');
      console.log('```sql');
      console.log(`SELECT
  o.id,
  o.name,
  o.status,
  lr.name as lost_reason_name
FROM ghl_opportunities o
LEFT JOIN ghl_lost_reasons lr ON o.lost_reason_id = lr.id
WHERE o.status = 'lost'
LIMIT 5;`);
      console.log('```\n');

      // Execute sample query
      const results = this.db.prepare(`
        SELECT
          o.id,
          o.name,
          o.status,
          lr.name as lost_reason_name
        FROM ghl_opportunities o
        LEFT JOIN ghl_lost_reasons lr ON o.lost_reason_id = lr.id
        WHERE o.status = 'lost'
        LIMIT 5
      `).all();

      if (results.length > 0) {
        console.log('🔍 Sample Results:\n');
        console.table(results);
      }

      console.log('='.repeat(80));
      console.log('✅ LOST REASONS POPULATED SUCCESSFULLY!');
      console.log('='.repeat(80) + '\n');

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      this.db.close();
    }
  }
}

// Main execution
const populator = new LostReasonsPopulator();
populator.run();
