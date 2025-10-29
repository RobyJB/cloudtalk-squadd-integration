#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../ghl_contacts/ghl_contacts.db');
const db = new Database(dbPath);

const command = process.argv[2];

console.log('\n' + '='.repeat(80));
console.log('📊 SYNC MANAGER');
console.log('='.repeat(80) + '\n');

switch(command) {
  case 'status':
  case undefined:
    // Show sync status
    const syncs = db.prepare(`
      SELECT *
      FROM ghl_sync_log
      ORDER BY started_at DESC
      LIMIT 10
    `).all();

    if (syncs.length === 0) {
      console.log('ℹ️  No sync history found.\n');
    } else {
      console.log('📋 Recent Syncs:\n');
      for (const sync of syncs) {
        const duration = sync.completed_at
          ? Math.round((new Date(sync.completed_at) - new Date(sync.started_at)) / 1000)
          : Math.round((new Date() - new Date(sync.started_at)) / 1000);

        console.log(`ID: ${sync.id} | ${sync.status.toUpperCase()} | ${sync.entity_type || 'N/A'}`);
        console.log(`   Started: ${sync.started_at}`);
        console.log(`   Records: ${sync.records_processed || 0}${sync.total_records ? `/${sync.total_records}` : ''}`);
        console.log(`   Duration: ${duration}s`);
        if (sync.status === 'running') {
          console.log(`   ⚠️  INCOMPLETE - Can resume`);
        }
        if (sync.error_message) {
          console.log(`   Error: ${sync.error_message}`);
        }
        console.log('');
      }
    }
    break;

  case 'clean':
    // Clean incomplete syncs
    const result = db.prepare(`
      DELETE FROM ghl_sync_log
      WHERE status = 'running'
    `).run();

    console.log(`✅ Cleaned ${result.changes} incomplete sync(s)\n`);
    console.log('You can now start a fresh import without resume.\n');
    break;

  case 'resume':
    // Show resume info
    const incomplete = db.prepare(`
      SELECT * FROM ghl_sync_log
      WHERE status = 'running'
      ORDER BY started_at DESC
      LIMIT 1
    `).get();

    if (!incomplete) {
      console.log('ℹ️  No incomplete sync found. Nothing to resume.\n');
    } else {
      console.log('⚠️  Found incomplete sync:\n');
      console.log(`   ID: ${incomplete.id}`);
      console.log(`   Started: ${incomplete.started_at}`);
      console.log(`   Progress: ${incomplete.records_processed}/${incomplete.total_records || 'unknown'}`);
      console.log(`   Last checkpoint: ${incomplete.last_checkpoint_at || 'none'}\n`);
      console.log('🔄 Just run the import script again to resume automatically!\n');
    }
    break;

  case 'help':
  default:
    console.log('Usage:');
    console.log('  node scripts/sync-manager.js [command]\n');
    console.log('Commands:');
    console.log('  status (default) - Show recent syncs');
    console.log('  resume          - Show resume info');
    console.log('  clean           - Clean incomplete syncs (start fresh)\n');
    break;
}

db.close();

console.log('='.repeat(80) + '\n');
