import Database from './database.js';

/**
 * GHL Contact Database Service
 * Extends the base Database class to handle GoHighLevel contact data
 */
class GHLContactDatabase extends Database {
  constructor(dbPath = 'ghl_contacts/ghl_contacts.db') {
    super(dbPath);
  }

  /**
   * Initialize GHL-specific tables
   */
  async createTables() {
    // First create base tables from parent class
    await super.createTables();

    // Create GHL contacts table
    const createContactsTable = `
      CREATE TABLE IF NOT EXISTS ghl_contacts (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,

        -- Basic Information
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        phone_label TEXT,

        -- Additional Contact Info
        additional_emails TEXT,
        additional_phones TEXT,

        -- Address Information
        address TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        postal_code TEXT,

        -- Business Information
        business_id TEXT,
        business_name TEXT,
        company_name TEXT,
        website TEXT,

        -- Contact Properties
        type TEXT,
        source TEXT,
        assigned_to TEXT,
        followers TEXT,

        -- Communication Preferences
        dnd INTEGER DEFAULT 0,
        valid_email INTEGER,

        -- Custom Fields and Tags
        custom_fields TEXT,
        tags TEXT,

        -- Dates
        date_of_birth TEXT,
        date_added DATETIME,
        date_updated DATETIME,

        -- Local tracking
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        local_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT DEFAULT 'synced',
        sync_error TEXT
      )
    `;

    // Create opportunities table
    const createOpportunitiesTable = `
      CREATE TABLE IF NOT EXISTS ghl_opportunities (
        id TEXT PRIMARY KEY,
        contact_id TEXT NOT NULL,
        pipeline_id TEXT,
        pipeline_stage_id TEXT,
        monetary_value REAL,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contact_id) REFERENCES ghl_contacts(id) ON DELETE CASCADE
      )
    `;

    // Create contact notes table
    const createNotesTable = `
      CREATE TABLE IF NOT EXISTS ghl_contact_notes (
        id TEXT PRIMARY KEY,
        contact_id TEXT NOT NULL,
        body TEXT,
        user_id TEXT,
        created_at DATETIME,
        updated_at DATETIME,
        FOREIGN KEY (contact_id) REFERENCES ghl_contacts(id) ON DELETE CASCADE
      )
    `;

    // Create sync log table
    const createSyncLogTable = `
      CREATE TABLE IF NOT EXISTS ghl_sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_type TEXT NOT NULL,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        status TEXT DEFAULT 'running',
        total_contacts INTEGER,
        processed_contacts INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        error_details TEXT,
        metadata TEXT
      )
    `;

    // Create indexes
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_ghl_contacts_location_id ON ghl_contacts(location_id)',
      'CREATE INDEX IF NOT EXISTS idx_ghl_contacts_email ON ghl_contacts(email)',
      'CREATE INDEX IF NOT EXISTS idx_ghl_contacts_phone ON ghl_contacts(phone)',
      'CREATE INDEX IF NOT EXISTS idx_ghl_contacts_type ON ghl_contacts(type)',
      'CREATE INDEX IF NOT EXISTS idx_ghl_contacts_sync_status ON ghl_contacts(sync_status)',
      'CREATE INDEX IF NOT EXISTS idx_ghl_contacts_date_updated ON ghl_contacts(date_updated)',
      'CREATE INDEX IF NOT EXISTS idx_ghl_opportunities_contact_id ON ghl_opportunities(contact_id)',
      'CREATE INDEX IF NOT EXISTS idx_ghl_opportunities_status ON ghl_opportunities(status)',
      'CREATE INDEX IF NOT EXISTS idx_ghl_contact_notes_contact_id ON ghl_contact_notes(contact_id)'
    ];

    // Execute all table creation
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(createContactsTable, (err) => {
          if (err) return reject(err);
        });

        this.db.run(createOpportunitiesTable, (err) => {
          if (err) return reject(err);
        });

        this.db.run(createNotesTable, (err) => {
          if (err) return reject(err);
        });

        this.db.run(createSyncLogTable, (err) => {
          if (err) return reject(err);
        });

        // Create indexes
        createIndexes.forEach(indexSql => {
          this.db.run(indexSql, (err) => {
            if (err) console.error('Index creation error:', err);
          });
        });

        resolve();
      });
    });
  }

  /**
   * Transform GHL API contact to database format
   */
  transformContactForDB(ghlContact) {
    return {
      id: ghlContact.id,
      location_id: ghlContact.locationId,
      first_name: ghlContact.firstName || null,
      last_name: ghlContact.lastName || null,
      email: ghlContact.email || null,
      phone: ghlContact.phone || null,
      phone_label: ghlContact.phoneLabel || null,
      additional_emails: JSON.stringify(ghlContact.additionalEmails || []),
      additional_phones: JSON.stringify(ghlContact.additionalPhones || []),
      address: ghlContact.address || null,
      city: ghlContact.city || null,
      state: ghlContact.state || null,
      country: ghlContact.country || null,
      postal_code: ghlContact.postalCode || null,
      business_id: ghlContact.businessId || null,
      business_name: ghlContact.businessName || null,
      company_name: ghlContact.companyName || null,
      website: ghlContact.website || null,
      type: ghlContact.type || null,
      source: ghlContact.source || null,
      assigned_to: ghlContact.assignedTo || null,
      followers: JSON.stringify(ghlContact.followers || []),
      dnd: ghlContact.dnd ? 1 : 0,
      valid_email: ghlContact.validEmail === null ? null : (ghlContact.validEmail ? 1 : 0),
      custom_fields: JSON.stringify(ghlContact.customFields || []),
      tags: JSON.stringify(ghlContact.tags || []),
      date_of_birth: ghlContact.dateOfBirth || null,
      date_added: ghlContact.dateAdded || null,
      date_updated: ghlContact.dateUpdated || null
    };
  }

  /**
   * Upsert a single contact
   */
  async upsertContact(ghlContact) {
    const contact = this.transformContactForDB(ghlContact);

    const sql = `
      INSERT OR REPLACE INTO ghl_contacts (
        id, location_id, first_name, last_name, email, phone, phone_label,
        additional_emails, additional_phones, address, city, state, country,
        postal_code, business_id, business_name, company_name, website,
        type, source, assigned_to, followers, dnd, valid_email,
        custom_fields, tags, date_of_birth, date_added, date_updated,
        synced_at, sync_status
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'synced'
      )
    `;

    const values = [
      contact.id, contact.location_id, contact.first_name, contact.last_name,
      contact.email, contact.phone, contact.phone_label, contact.additional_emails,
      contact.additional_phones, contact.address, contact.city, contact.state,
      contact.country, contact.postal_code, contact.business_id, contact.business_name,
      contact.company_name, contact.website, contact.type, contact.source,
      contact.assigned_to, contact.followers, contact.dnd, contact.valid_email,
      contact.custom_fields, contact.tags, contact.date_of_birth, contact.date_added,
      contact.date_updated
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: contact.id, changes: this.changes });
        }
      });
    });
  }

  /**
   * Bulk upsert contacts with transaction
   */
  async bulkUpsertContacts(ghlContacts) {
    return new Promise((resolve, reject) => {
      let processed = 0;
      const errors = [];

      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO ghl_contacts (
            id, location_id, first_name, last_name, email, phone, phone_label,
            additional_emails, additional_phones, address, city, state, country,
            postal_code, business_id, business_name, company_name, website,
            type, source, assigned_to, followers, dnd, valid_email,
            custom_fields, tags, date_of_birth, date_added, date_updated,
            synced_at, sync_status
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'synced'
          )
        `);

        for (const ghlContact of ghlContacts) {
          try {
            const contact = this.transformContactForDB(ghlContact);

            stmt.run([
              contact.id, contact.location_id, contact.first_name, contact.last_name,
              contact.email, contact.phone, contact.phone_label, contact.additional_emails,
              contact.additional_phones, contact.address, contact.city, contact.state,
              contact.country, contact.postal_code, contact.business_id, contact.business_name,
              contact.company_name, contact.website, contact.type, contact.source,
              contact.assigned_to, contact.followers, contact.dnd, contact.valid_email,
              contact.custom_fields, contact.tags, contact.date_of_birth, contact.date_added,
              contact.date_updated
            ], (err) => {
              if (err) {
                errors.push({ contact: ghlContact.id, error: err.message });
              } else {
                processed++;
              }
            });

            // Also insert opportunities if present
            if (ghlContact.opportunities && ghlContact.opportunities.length > 0) {
              for (const opp of ghlContact.opportunities) {
                this.upsertOpportunity(ghlContact.id, opp);
              }
            }
          } catch (err) {
            errors.push({ contact: ghlContact.id, error: err.message });
          }
        }

        stmt.finalize();

        this.db.run('COMMIT', (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(err);
          } else {
            resolve({
              processed,
              total: ghlContacts.length,
              errors: errors.length > 0 ? errors : null
            });
          }
        });
      });
    });
  }

  /**
   * Upsert an opportunity
   */
  async upsertOpportunity(contactId, opportunity) {
    const sql = `
      INSERT OR REPLACE INTO ghl_opportunities (
        id, contact_id, pipeline_id, pipeline_stage_id, monetary_value, status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        opportunity.id,
        contactId,
        opportunity.pipelineId || opportunity.pipeline_id,
        opportunity.pipelineStageId || opportunity.pipeline_stage_id,
        opportunity.monetaryValue || opportunity.monetary_value || 0,
        opportunity.status
      ], function(err) {
        if (err) {
          // Don't reject, just log error for opportunities
          console.error('Opportunity insert error:', err);
          resolve(null);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Get contacts by sync status
   */
  async getContactsBySyncStatus(status = 'pending', limit = 100) {
    const sql = `
      SELECT * FROM ghl_contacts
      WHERE sync_status = ?
      ORDER BY local_updated_at DESC
      LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [status, limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Parse JSON fields
          const contacts = rows.map(row => {
            try {
              row.additional_emails = JSON.parse(row.additional_emails || '[]');
              row.additional_phones = JSON.parse(row.additional_phones || '[]');
              row.custom_fields = JSON.parse(row.custom_fields || '[]');
              row.tags = JSON.parse(row.tags || '[]');
              row.followers = JSON.parse(row.followers || '[]');
            } catch (e) {
              console.error('JSON parse error:', e);
            }
            return row;
          });
          resolve(contacts);
        }
      });
    });
  }

  /**
   * Get all contacts with pagination
   */
  async getAllContacts(limit = 100, offset = 0) {
    const sql = `
      SELECT * FROM ghl_contacts
      ORDER BY date_updated DESC
      LIMIT ? OFFSET ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get contact count
   */
  async getContactCount() {
    const sql = 'SELECT COUNT(*) as count FROM ghl_contacts';

    return new Promise((resolve, reject) => {
      this.db.get(sql, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  }

  /**
   * Start a new sync log entry
   */
  async startSyncLog(syncType = 'full') {
    const sql = `
      INSERT INTO ghl_sync_log (sync_type, status)
      VALUES (?, 'running')
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [syncType], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, syncType });
        }
      });
    });
  }

  /**
   * Update sync log progress
   */
  async updateSyncLog(logId, updates) {
    const allowedFields = ['processed_contacts', 'total_contacts', 'error_count'];
    const fields = Object.keys(updates).filter(f => allowedFields.includes(f));

    if (fields.length === 0) return;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => updates[f]);

    const sql = `UPDATE ghl_sync_log SET ${setClause} WHERE id = ?`;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [...values, logId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Complete sync log
   */
  async completeSyncLog(logId, status = 'completed', error = null) {
    const sql = `
      UPDATE ghl_sync_log
      SET status = ?, completed_at = CURRENT_TIMESTAMP, error_details = ?
      WHERE id = ?
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [status, error ? JSON.stringify(error) : null, logId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Get latest sync log
   */
  async getLatestSyncLog() {
    const sql = `
      SELECT * FROM ghl_sync_log
      ORDER BY started_at DESC
      LIMIT 1
    `;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get all sync logs with limit
   */
  async getAllSyncLogs(limit = 10) {
    const sql = `
      SELECT * FROM ghl_sync_log
      ORDER BY started_at DESC
      LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Search contacts by various criteria
   */
  async searchContacts(criteria = {}) {
    let sql = 'SELECT * FROM ghl_contacts WHERE 1=1';
    const params = [];

    if (criteria.email) {
      sql += ' AND email LIKE ?';
      params.push(`%${criteria.email}%`);
    }

    if (criteria.phone) {
      sql += ' AND phone LIKE ?';
      params.push(`%${criteria.phone}%`);
    }

    if (criteria.name) {
      sql += ' AND (first_name LIKE ? OR last_name LIKE ?)';
      params.push(`%${criteria.name}%`, `%${criteria.name}%`);
    }

    if (criteria.type) {
      sql += ' AND type = ?';
      params.push(criteria.type);
    }

    if (criteria.source) {
      sql += ' AND source = ?';
      params.push(criteria.source);
    }

    if (criteria.dateFrom) {
      sql += ' AND date_added >= ?';
      params.push(criteria.dateFrom);
    }

    if (criteria.dateTo) {
      sql += ' AND date_added <= ?';
      params.push(criteria.dateTo);
    }

    sql += ' ORDER BY date_updated DESC';

    if (criteria.limit) {
      sql += ' LIMIT ?';
      params.push(criteria.limit);
    }

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

export default GHLContactDatabase;