import fs from 'fs/promises';
import path from 'path';
import { log } from '../logger.js';

// Webhook payload logger utility
// Saves all webhook payloads to JSON files in webhook-payloads directory

const WEBHOOK_PAYLOADS_DIR = path.join(process.cwd(), 'webhook-payloads');

/**
 * Save webhook payload to text file
 * @param {string} provider - 'cloudtalk' or 'squadd'
 * @param {string} webhookType - Type of webhook (e.g., 'call-recording-ready', 'new-contact')
 * @param {object} payload - Webhook payload data
 * @param {object} headers - Request headers
 */
export async function saveWebhookPayload(provider, webhookType, payload, headers = {}) {
  try {
    // Create directory structure if it doesn't exist
    const providerDir = path.join(WEBHOOK_PAYLOADS_DIR, provider);
    await fs.mkdir(providerDir, { recursive: true });

    // Create filename for webhook type
    const filename = `${webhookType}.txt`;
    const filepath = path.join(providerDir, filename);

    // Prepare data to append
    const timestamp = new Date().toISOString();
    const webhookEntry = `
=== WEBHOOK RECEIVED: ${timestamp} ===
Provider: ${provider}
Webhook Type: ${webhookType}
Headers: ${JSON.stringify(headers, null, 2)}
User-Agent: ${headers['user-agent'] || 'N/A'}
Content-Type: ${headers['content-type'] || 'N/A'}
IP: ${headers['x-forwarded-for'] || headers['x-real-ip'] || 'N/A'}

PAYLOAD:
${JSON.stringify(payload, null, 2)}

==============================

`;

    // Append to file (creates if doesn't exist)
    await fs.appendFile(filepath, webhookEntry);

    log(`💾 Webhook payload aggiunto a: ${filepath}`);

    return {
      success: true,
      filepath: filepath
    };

  } catch (error) {
    log(`❌ Errore salvando webhook payload: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get all webhook files for a provider and type
 * @param {string} provider - 'cloudtalk' or 'squadd'
 * @param {string} webhookType - Type of webhook (optional)
 */
export async function getWebhookFiles(provider, webhookType = null) {
  try {
    const providerDir = path.join(WEBHOOK_PAYLOADS_DIR, provider);

    // Check if directory exists
    try {
      await fs.access(providerDir);
    } catch {
      return { success: true, files: [] }; // Directory doesn't exist yet
    }

    const files = await fs.readdir(providerDir);

    let filteredFiles = files.filter(file => file.endsWith('.txt'));
    if (webhookType) {
      filteredFiles = files.filter(file => file === `${webhookType}.txt`);
    }

    // Sort by modification time (newest first)
    const filesWithStats = await Promise.all(
      filteredFiles.map(async file => {
        const filepath = path.join(providerDir, file);
        const stats = await fs.stat(filepath);
        return {
          filename: file,
          filepath: filepath,
          size: stats.size,
          modified: stats.mtime,
          webhookType: file.replace('.txt', '')
        };
      })
    );

    filesWithStats.sort((a, b) => b.modified - a.modified);

    return {
      success: true,
      files: filesWithStats
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Read webhook payload from file
 * @param {string} filepath - Full path to the webhook file
 */
export async function readWebhookPayload(filepath) {
  try {
    const content = await fs.readFile(filepath, 'utf8');

    // For .txt files, just return the raw content
    if (filepath.endsWith('.txt')) {
      // Count webhook entries
      const webhookEntries = content.split('=== WEBHOOK RECEIVED:').length - 1;

      return {
        success: true,
        content: content,
        count: webhookEntries,
        isTextFile: true
      };
    }

    // Legacy support for JSON files (if any exist)
    if (filepath.endsWith('.jsonl')) {
      const lines = content.trim().split('\n');
      const payloads = lines.map(line => JSON.parse(line));
      return {
        success: true,
        payloads: payloads,
        count: payloads.length
      };
    } else {
      const payload = JSON.parse(content);
      return {
        success: true,
        payload: payload
      };
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clean old webhook files (older than specified days)
 * @param {number} daysToKeep - Number of days to keep files
 * @param {string} provider - Provider to clean (optional, cleans all if not specified)
 */
export async function cleanOldWebhookFiles(daysToKeep = 30, provider = null) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const providers = provider ? [provider] : ['cloudtalk', 'squadd'];
    let deletedCount = 0;

    for (const prov of providers) {
      const providerDir = path.join(WEBHOOK_PAYLOADS_DIR, prov);

      try {
        await fs.access(providerDir);
      } catch {
        continue; // Directory doesn't exist
      }

      const files = await fs.readdir(providerDir);

      for (const file of files) {
        const filepath = path.join(providerDir, file);
        const stats = await fs.stat(filepath);

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filepath);
          deletedCount++;
          log(`🗑️ Deleted old webhook file: ${file}`);
        }
      }
    }

    return {
      success: true,
      deletedCount: deletedCount,
      message: `Deleted ${deletedCount} old webhook files`
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}