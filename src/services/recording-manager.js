import fs from 'fs/promises';
import path from 'path';
import Database from './database.js';
import { config } from '../config.js';

class RecordingManager {
  constructor() {
    this.db = new Database();
    this.recordingsPath = 'recordings/audio';
    this.baseUrl = `http://localhost:${config.port}`;
  }

  async init() {
    await this.db.init();
    await this.ensureDirectoryExists(this.recordingsPath);
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  async downloadAndSaveRecording(callId, audioBuffer, callMetadata = {}) {
    try {
      // Genera nome file basato su callId e timestamp
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const fileName = `${callId}_${timestamp}.wav`;
      const filePath = path.join(this.recordingsPath, fileName);

      // Salva il file audio
      await fs.writeFile(filePath, audioBuffer);

      // Ottieni informazioni file
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      // Estrai metadata dalla chiamata
      const recordingData = {
        call_id: callId,
        file_path: filePath,
        file_size: fileSize,
        duration: callMetadata.duration || null,
        format: 'wav',
        agent_name: callMetadata.agent_name || null,
        phone_from: callMetadata.phone_from || null,
        phone_to: callMetadata.phone_to || null,
        call_type: callMetadata.call_type || null,
        metadata: callMetadata
      };

      // Salva metadata nel database
      const recordingId = await this.db.insertRecording(recordingData);

      return {
        success: true,
        recording_id: recordingId,
        call_id: callId,
        file_path: filePath,
        file_size: fileSize,
        download_url: `${this.baseUrl}/api/recordings/${callId}/audio`
      };

    } catch (error) {
      throw new Error(`Failed to save recording for call ${callId}: ${error.message}`);
    }
  }

  async getRecording(callId) {
    try {
      const recording = await this.db.getRecording(callId);
      if (!recording) {
        return null;
      }

      // Validate file path and check existence
      const safePath = this.validateAndSanitizePath(recording.file_path);
      if (safePath) {
        try {
          await fs.access(safePath);
          recording.file_exists = true;
        } catch (error) {
          recording.file_exists = false;
        }
      } else {
        recording.file_exists = false;
      }

      recording.download_url = `${this.baseUrl}/api/recordings/${callId}/audio`;
      return recording;

    } catch (error) {
      throw new Error(`Failed to get recording for call ${callId}: ${error.message}`);
    }
  }

  async getAllRecordings(options = {}) {
    try {
      const { limit = 50, offset = 0 } = options;
      const recordings = await this.db.getAllRecordings(limit, offset);

      // Optimize file existence checks with Promise.all
      await this.attachFileExistenceInfo(recordings);

      return recordings;

    } catch (error) {
      throw new Error(`Failed to get recordings: ${error.message}`);
    }
  }

  async searchRecordings(filters = {}) {
    try {
      const recordings = await this.db.searchRecordings(filters);

      // Optimize file existence checks with Promise.all
      await this.attachFileExistenceInfo(recordings);

      return recordings;

    } catch (error) {
      throw new Error(`Failed to search recordings: ${error.message}`);
    }
  }

  async getRecordingFile(callId) {
    try {
      const recording = await this.db.getRecording(callId);
      if (!recording) {
        return null;
      }

      // Validate file path to prevent path traversal
      const safePath = this.validateAndSanitizePath(recording.file_path);
      if (!safePath) {
        throw new Error('Invalid or unsafe file path');
      }

      // Verifica che il file esista
      try {
        await fs.access(safePath);
        const audioBuffer = await fs.readFile(safePath);

        return {
          buffer: audioBuffer,
          contentType: 'audio/wav',
          fileName: path.basename(safePath),
          fileSize: recording.file_size
        };

      } catch (error) {
        if (error.code === 'ENOENT') {
          return null; // File not found
        }
        throw error;
      }

    } catch (error) {
      throw new Error(`Failed to get recording file for call ${callId}: ${error.message}`);
    }
  }

  async deleteRecording(callId, deleteFile = true) {
    try {
      const recording = await this.db.getRecording(callId);
      if (!recording) {
        return false;
      }

      // Elimina il file se richiesto
      if (deleteFile && recording.file_path) {
        // Validate file path to prevent path traversal
        const safePath = this.validateAndSanitizePath(recording.file_path);
        if (safePath) {
          try {
            await fs.unlink(safePath);
          } catch (error) {
            if (error.code !== 'ENOENT') {
              throw error;
            }
          }
        }
      }

      // Elimina dal database
      const changes = await this.db.deleteRecording(callId);
      return changes > 0;

    } catch (error) {
      throw new Error(`Failed to delete recording for call ${callId}: ${error.message}`);
    }
  }

  async updateRecordingMetadata(callId, metadata) {
    try {
      const updates = {};

      if (metadata.transcription !== undefined) {
        updates.transcription = metadata.transcription;
      }

      if (metadata.agent_name !== undefined) {
        updates.agent_name = metadata.agent_name;
      }

      if (metadata.metadata !== undefined) {
        updates.metadata = JSON.stringify(metadata.metadata);
      }

      const changes = await this.db.updateRecording(callId, updates);
      return changes > 0;

    } catch (error) {
      throw new Error(`Failed to update recording metadata for call ${callId}: ${error.message}`);
    }
  }

  async getStorageStats() {
    try {
      const recordings = await this.db.getAllRecordings(1000); // Get more for accurate stats

      let totalSize = 0;
      let totalDuration = 0;
      let fileCount = 0;
      let missingFiles = 0;

      // Optimize file existence checks with Promise.all
      const fileChecks = recordings.map(async (recording) => {
        const safePath = this.validateAndSanitizePath(recording.file_path);
        if (safePath) {
          try {
            await fs.access(safePath);
            return {
              exists: true,
              size: recording.file_size || 0,
              duration: recording.duration || 0
            };
          } catch (error) {
            return { exists: false, size: 0, duration: 0 };
          }
        } else {
          return { exists: false, size: 0, duration: 0 };
        }
      });

      const results = await Promise.all(fileChecks);

      results.forEach(result => {
        if (result.exists) {
          totalSize += result.size;
          totalDuration += result.duration;
          fileCount++;
        } else {
          missingFiles++;
        }
      });

      return {
        total_recordings: recordings.length,
        files_found: fileCount,
        missing_files: missingFiles,
        total_size_bytes: totalSize,
        total_size_mb: Math.round(totalSize / (1024 * 1024) * 100) / 100,
        total_duration_seconds: totalDuration,
        average_file_size_mb: fileCount > 0 ? Math.round((totalSize / fileCount) / (1024 * 1024) * 100) / 100 : 0
      };

    } catch (error) {
      throw new Error(`Failed to get storage stats: ${error.message}`);
    }
  }

  async cleanup(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const oldRecordings = await this.db.searchRecordings({
        date_to: cutoffDate.toISOString()
      });

      let deletedCount = 0;
      let freedSpace = 0;

      for (const recording of oldRecordings) {
        try {
          const deleted = await this.deleteRecording(recording.call_id, true);
          if (deleted) {
            deletedCount++;
            freedSpace += recording.file_size || 0;
          }
        } catch (error) {
          console.error(`Failed to delete old recording ${recording.call_id}:`, error.message);
        }
      }

      return {
        deleted_count: deletedCount,
        freed_space_bytes: freedSpace,
        freed_space_mb: Math.round(freedSpace / (1024 * 1024) * 100) / 100
      };

    } catch (error) {
      throw new Error(`Failed to cleanup old recordings: ${error.message}`);
    }
  }

  async attachFileExistenceInfo(recordings) {
    // Optimize file existence checks with Promise.all to reduce N+1 I/O operations
    const fileChecks = recordings.map(async (recording) => {
      recording.download_url = `${this.baseUrl}/api/recordings/${recording.call_id}/audio`;

      const safePath = this.validateAndSanitizePath(recording.file_path);
      if (safePath) {
        try {
          await fs.access(safePath);
          recording.file_exists = true;
        } catch (error) {
          recording.file_exists = false;
        }
      } else {
        recording.file_exists = false;
      }
    });

    await Promise.all(fileChecks);
  }

  validateAndSanitizePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return null;
    }

    try {
      // Normalize and resolve the path
      const normalizedPath = path.normalize(filePath);
      const resolvedPath = path.resolve(normalizedPath);

      // Get the absolute path of the recordings directory
      const recordingsAbsolutePath = path.resolve(this.recordingsPath);

      // Check if the resolved path is within the recordings directory using relative path
      const relativePath = path.relative(recordingsAbsolutePath, resolvedPath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        console.warn(`Path traversal attempt detected: ${filePath}`);
        return null;
      }

      return resolvedPath;
    } catch (error) {
      console.error(`Path validation error: ${error.message}`);
      return null;
    }
  }

  async close() {
    await this.db.close();
  }
}

export default RecordingManager;