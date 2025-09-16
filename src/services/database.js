import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

class Database {
  constructor(dbPath = 'recordings/recordings.db') {
    this.dbPath = dbPath;
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async init() {
    await this.connect();
    await this.createTables();
  }

  async createTables() {
    const createRecordingsTable = `
      CREATE TABLE IF NOT EXISTS recordings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_id TEXT UNIQUE NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        duration INTEGER,
        format TEXT DEFAULT 'wav',
        downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        agent_name TEXT,
        phone_from TEXT,
        phone_to TEXT,
        call_type TEXT,
        transcription TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.run(createRecordingsTable, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async insertRecording(recordingData) {
    const {
      call_id,
      file_path,
      file_size,
      duration,
      format = 'wav',
      agent_name,
      phone_from,
      phone_to,
      call_type,
      metadata = null
    } = recordingData;

    const sql = `
      INSERT INTO recordings
      (call_id, file_path, file_size, duration, format, agent_name, phone_from, phone_to, call_type, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        call_id,
        file_path,
        file_size,
        duration,
        format,
        agent_name,
        phone_from,
        phone_to,
        call_type,
        JSON.stringify(metadata)
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async getRecording(callId) {
    const sql = 'SELECT * FROM recordings WHERE call_id = ?';

    return new Promise((resolve, reject) => {
      this.db.get(sql, [callId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row && row.metadata) {
            try {
              row.metadata = JSON.parse(row.metadata);
            } catch (e) {
              row.metadata = null;
            }
          }
          resolve(row);
        }
      });
    });
  }

  async getAllRecordings(limit = 50, offset = 0) {
    const sql = 'SELECT * FROM recordings ORDER BY created_at DESC LIMIT ? OFFSET ?';

    return new Promise((resolve, reject) => {
      this.db.all(sql, [limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const processedRows = rows.map(row => {
            if (row.metadata) {
              try {
                row.metadata = JSON.parse(row.metadata);
              } catch (e) {
                row.metadata = null;
              }
            }
            return row;
          });
          resolve(processedRows);
        }
      });
    });
  }

  async updateRecording(callId, updates) {
    // Whitelist allowed fields to prevent SQL injection
    const allowedFields = ['transcription', 'agent_name', 'phone_from', 'phone_to', 'call_type', 'metadata'];
    const fields = Object.keys(updates).filter(field => allowedFields.includes(field));

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const values = fields.map(field => updates[field]);
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    const sql = `UPDATE recordings SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE call_id = ?`;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [...values, callId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async deleteRecording(callId) {
    const sql = 'DELETE FROM recordings WHERE call_id = ?';

    return new Promise((resolve, reject) => {
      this.db.run(sql, [callId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async searchRecordings(filters = {}) {
    let sql = 'SELECT * FROM recordings WHERE 1=1';
    const params = [];

    if (filters.agent_name) {
      sql += ' AND agent_name LIKE ?';
      params.push(`%${filters.agent_name}%`);
    }

    if (filters.phone_from) {
      sql += ' AND phone_from LIKE ?';
      params.push(`%${filters.phone_from}%`);
    }

    if (filters.phone_to) {
      sql += ' AND phone_to LIKE ?';
      params.push(`%${filters.phone_to}%`);
    }

    if (filters.call_type) {
      sql += ' AND call_type = ?';
      params.push(filters.call_type);
    }

    if (filters.date_from) {
      sql += ' AND created_at >= ?';
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      sql += ' AND created_at <= ?';
      params.push(filters.date_to);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const processedRows = rows.map(row => {
            if (row.metadata) {
              try {
                row.metadata = JSON.parse(row.metadata);
              } catch (e) {
                row.metadata = null;
              }
            }
            return row;
          });
          resolve(processedRows);
        }
      });
    });
  }

  async close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }
}

export default Database;