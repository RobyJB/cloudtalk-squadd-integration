#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reset database - Delete and recreate with fresh schema
 */
class DatabaseReset {
  constructor() {
    this.dbDir = path.join(__dirname, '../ghl_contacts');
    this.dbPath = path.join(this.dbDir, 'ghl_contacts.db');
    this.backupDir = path.join(this.dbDir, 'backups');
  }

  async run() {
    console.log('\n' + '='.repeat(80));
    console.log('🗑️  DATABASE RESET');
    console.log('='.repeat(80) + '\n');

    try {
      // Step 1: Backup existing database if it exists
      await this.backupExisting();

      // Step 2: Delete old database
      await this.deleteDatabase();

      // Step 3: Create fresh database with schema
      await this.createFreshDatabase();

      console.log('\n' + '='.repeat(80));
      console.log('✅ DATABASE RESET COMPLETE!');
      console.log('='.repeat(80) + '\n');

      console.log('📊 Database is now empty and ready for import.\n');

    } catch (error) {
      console.error('\n' + '='.repeat(80));
      console.error('❌ DATABASE RESET FAILED');
      console.error('='.repeat(80));
      console.error('\nError:', error.message);
      process.exit(1);
    }
  }

  async backupExisting() {
    if (!fs.existsSync(this.dbPath)) {
      console.log('ℹ️  No existing database to backup.\n');
      return;
    }

    console.log('💾 Step 1: Backing up existing database...\n');

    // Create backup directory
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `ghl_contacts_${timestamp}.db`);

    fs.copyFileSync(this.dbPath, backupPath);

    const backupSize = (fs.statSync(backupPath).size / 1024 / 1024).toFixed(2);
    console.log(`  ✅ Backup created: ${backupPath}`);
    console.log(`  📊 Size: ${backupSize} MB\n`);
  }

  async deleteDatabase() {
    if (!fs.existsSync(this.dbPath)) {
      console.log('ℹ️  No database to delete.\n');
      return;
    }

    console.log('🗑️  Step 2: Deleting old database...\n');

    fs.unlinkSync(this.dbPath);

    console.log('  ✅ Old database deleted.\n');
  }

  async createFreshDatabase() {
    console.log('🏗️  Step 3: Creating fresh database with schema...\n');

    // Create directory if needed
    if (!fs.existsSync(this.dbDir)) {
      fs.mkdirSync(this.dbDir, { recursive: true });
    }

    const db = new Database(this.dbPath);

    // Create ghl_contacts table (base schema - custom fields added dynamically)
    db.exec(`
      CREATE TABLE IF NOT EXISTS ghl_contacts (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        phone_label TEXT,
        additional_emails TEXT,
        additional_phones TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        postal_code TEXT,
        business_id TEXT,
        business_name TEXT,
        company_name TEXT,
        website TEXT,
        type TEXT,
        source TEXT,
        assigned_to TEXT,
        followers TEXT,
        dnd INTEGER DEFAULT 0,
        valid_email INTEGER,
        custom_fields TEXT,
        tags TEXT,
        date_of_birth TEXT,
        date_added DATETIME,
        date_updated DATETIME,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        local_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT DEFAULT 'synced',
        sync_error TEXT
      )
    `);

    console.log('  ✅ Created table: ghl_contacts');

    // Create ghl_opportunities table (enhanced schema)
    db.exec(`
      CREATE TABLE IF NOT EXISTS ghl_opportunities (
        id TEXT PRIMARY KEY,
        contact_id TEXT NOT NULL,
        pipeline_id TEXT,
        pipeline_stage_id TEXT,
        name TEXT,
        pipeline_name TEXT,
        stage_name TEXT,
        monetary_value REAL,
        status TEXT,
        lost_reason_id TEXT,
        lost_reason_name TEXT,
        assigned_to TEXT,
        source TEXT,
        last_status_change_at DATETIME,
        last_stage_change_at DATETIME,
        lead_value REAL,
        custom_fields TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contact_id) REFERENCES ghl_contacts(id)
      )
    `);

    console.log('  ✅ Created table: ghl_opportunities');

    // Create ghl_contact_notes table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ghl_contact_notes (
        id TEXT PRIMARY KEY,
        contact_id TEXT NOT NULL,
        body TEXT,
        user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contact_id) REFERENCES ghl_contacts(id)
      )
    `);

    console.log('  ✅ Created table: ghl_contact_notes');

    // Create ghl_sync_log table (ENHANCED with resume capability)
    db.exec(`
      CREATE TABLE IF NOT EXISTS ghl_sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_type TEXT NOT NULL,
        entity_type TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        last_checkpoint_at DATETIME,
        status TEXT DEFAULT 'running',
        total_records INTEGER,
        records_processed INTEGER DEFAULT 0,
        records_failed INTEGER DEFAULT 0,
        last_processed_id TEXT,
        last_search_after TEXT,
        resume_offset INTEGER DEFAULT 0,
        error_message TEXT,
        metadata TEXT
      )
    `);

    console.log('  ✅ Created table: ghl_sync_log');

    // Create custom_fields_metadata table (to track dynamic columns)
    db.exec(`
      CREATE TABLE IF NOT EXISTS custom_fields_metadata (
        field_id TEXT PRIMARY KEY,
        field_name TEXT,
        column_name TEXT UNIQUE,
        data_type TEXT,
        sql_type TEXT,
        object_type TEXT DEFAULT 'contact',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('  ✅ Created table: custom_fields_metadata');

    // Create ghl_lost_reasons table (lookup table for lost reason IDs)
    db.exec(`
      CREATE TABLE IF NOT EXISTS ghl_lost_reasons (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('  ✅ Created table: ghl_lost_reasons');

    // Populate lost reasons
    const lostReasons = [
      ['68e42bee31d03a816d551b85', 'Molestatore seriale'],
      ['68e3c2e565dc67cf257b1904', 'Solo gestione appuntamenti'],
      ['68e3c2e5b83d1643c513e2ff', 'Solo whatsapp massivo'],
      ['68dbe90121c2ca35feb032e9', 'Non ora'],
      ['661d4ed2b9691e3c82402daa', 'Fuori budget'],
      ['68cc7d6cae0cf13fd8ee806f', 'Straniero'],
      ['68cc7d6c2564837c50403dd4', 'Cerca lavoro'],
      ['68cc7d6c6cca92e7cdcd00ab', 'Non ha capito perché ha cliccato'],
      ['68cc7d6cf52ae888f6b44244', 'Bambino'],
      ['6870dfbce4d4bd79fe9550a4', 'Fuori target'],
      ['6630f77124b6d98b300f410', 'Già cliente'],
      ['663329f66058220b13f7f295', 'Non interessato'],
      ['6633294590db8b2d0ce8b12e', 'Non risponde'],
      ['65eddf392cd1023fe3199648', 'Dati errati']
    ];

    const lostReasonStmt = db.prepare('INSERT INTO ghl_lost_reasons (id, name) VALUES (?, ?)');
    for (const [id, name] of lostReasons) {
      lostReasonStmt.run(id, name);
    }

    console.log('  ✅ Populated 14 lost reasons');

    // Create ghl_appointments table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ghl_appointments (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        calendar_id TEXT,
        contact_id TEXT,
        title TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        status TEXT,
        assigned_user_id TEXT,
        address TEXT,
        notes TEXT,
        appointment_status TEXT,
        is_all_day INTEGER DEFAULT 0,
        meeting_location TEXT,
        custom_fields TEXT,
        created_at DATETIME,
        updated_at DATETIME,
        FOREIGN KEY (contact_id) REFERENCES ghl_contacts(id)
      )
    `);

    console.log('  ✅ Created table: ghl_appointments');

    // Create ghl_conversations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ghl_conversations (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        contact_id TEXT,
        assigned_to TEXT,
        status TEXT,
        type TEXT,
        last_message_type TEXT,
        last_message_direction TEXT,
        last_message_body TEXT,
        last_message_date DATETIME,
        unread_count INTEGER DEFAULT 0,
        starred INTEGER DEFAULT 0,
        created_at DATETIME,
        updated_at DATETIME,
        FOREIGN KEY (contact_id) REFERENCES ghl_contacts(id)
      )
    `);

    console.log('  ✅ Created table: ghl_conversations');

    // Create ghl_messages table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ghl_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        contact_id TEXT,
        location_id TEXT,
        type TEXT,
        direction TEXT,
        body TEXT,
        status TEXT,
        attachments TEXT,
        content_type TEXT,
        call_duration INTEGER,
        recording_url TEXT,
        transcription TEXT,
        date_added DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES ghl_conversations(id),
        FOREIGN KEY (contact_id) REFERENCES ghl_contacts(id)
      )
    `);

    console.log('  ✅ Created table: ghl_messages');

    // Create ghl_pipelines table (Master Data)
    db.exec(`
      CREATE TABLE IF NOT EXISTS ghl_pipelines (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        name TEXT NOT NULL,
        stage_order TEXT,
        visibility TEXT,
        created_at DATETIME,
        updated_at DATETIME
      )
    `);

    console.log('  ✅ Created table: ghl_pipelines');

    // Create ghl_pipeline_stages table (Normalized)
    db.exec(`
      CREATE TABLE IF NOT EXISTS ghl_pipeline_stages (
        id TEXT PRIMARY KEY,
        pipeline_id TEXT NOT NULL,
        name TEXT NOT NULL,
        position INTEGER,
        probability REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pipeline_id) REFERENCES ghl_pipelines(id)
      )
    `);

    console.log('  ✅ Created table: ghl_pipeline_stages');

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON ghl_contacts(email);
      CREATE INDEX IF NOT EXISTS idx_contacts_phone ON ghl_contacts(phone);
      CREATE INDEX IF NOT EXISTS idx_opportunities_contact ON ghl_opportunities(contact_id);
      CREATE INDEX IF NOT EXISTS idx_opportunities_pipeline ON ghl_opportunities(pipeline_id);
      CREATE INDEX IF NOT EXISTS idx_notes_contact ON ghl_contact_notes(contact_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_contact ON ghl_appointments(contact_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_start ON ghl_appointments(start_time);
      CREATE INDEX IF NOT EXISTS idx_conversations_contact ON ghl_conversations(contact_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_date ON ghl_conversations(last_message_date);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON ghl_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created ON ghl_messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON ghl_pipeline_stages(pipeline_id);
    `);

    console.log('  ✅ Created indexes\n');

    db.close();

    console.log('🎉 Fresh database created successfully!\n');
  }
}

// Main execution
const reset = new DatabaseReset();
reset.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
