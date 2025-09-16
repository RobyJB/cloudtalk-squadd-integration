import RecordingManager from './recording-manager.js';
import { config } from '../config.js';

class CloudTalkRecordingService {
  constructor() {
    this.recordingManager = new RecordingManager();
    this.apiKeyId = process.env.CLOUDTALK_API_KEY_ID;
    this.apiSecret = process.env.CLOUDTALK_API_SECRET;
    this.baseUrl = 'https://my.cloudtalk.io/api';
  }

  async init() {
    await this.recordingManager.init();
  }

  createAuthHeader() {
    const credentials = Buffer.from(`${this.apiKeyId}:${this.apiSecret}`).toString('base64');
    return `Basic ${credentials}`;
  }

  async downloadAndSaveRecording(callId, callMetadata = {}) {
    try {
      // Verifica se la registrazione esiste già
      const existingRecording = await this.recordingManager.getRecording(callId);
      if (existingRecording && existingRecording.file_exists) {
        console.log(`📀 Recording ${callId} already exists`);
        return {
          success: true,
          already_exists: true,
          data: existingRecording
        };
      }

      console.log(`📥 Downloading recording for call ${callId}...`);

      // Chiama l'API CloudTalk per ottenere la registrazione
      const url = `${this.baseUrl}/calls/recording/${callId}.json`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.createAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`CloudTalk API error: ${response.status} ${response.statusText}`);
      }

      // Ottieni il buffer audio
      const audioBuffer = await response.arrayBuffer();
      const audioBufferNode = Buffer.from(audioBuffer);

      console.log(`💾 Saving recording ${callId} (${audioBufferNode.length} bytes)`);

      // Salva la registrazione usando il RecordingManager
      const result = await this.recordingManager.downloadAndSaveRecording(
        callId,
        audioBufferNode,
        callMetadata
      );

      console.log(`✅ Recording ${callId} saved successfully`);

      return {
        success: true,
        downloaded: true,
        data: result
      };

    } catch (error) {
      console.error(`❌ Failed to download recording ${callId}:`, error.message);

      // Se il problema è che il file non è JSON (è un file audio binario), è normale
      if (error.message.includes('Unexpected token')) {
        // In questo caso, proviamo a trattarlo come dati binari
        try {
          const url = `${this.baseUrl}/calls/recording/${callId}.json`;

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': this.createAuthHeader()
            }
          });

          if (!response.ok) {
            throw new Error(`CloudTalk API error: ${response.status} ${response.statusText}`);
          }

          const audioBuffer = await response.arrayBuffer();
          const audioBufferNode = Buffer.from(audioBuffer);

          const result = await this.recordingManager.downloadAndSaveRecording(
            callId,
            audioBufferNode,
            callMetadata
          );

          return {
            success: true,
            downloaded: true,
            data: result
          };

        } catch (binaryError) {
          throw new Error(`Failed to download recording as binary: ${binaryError.message}`);
        }
      }

      throw error;
    }
  }

  async enhanceCallMetadataForRecording(callId) {
    try {
      // Chiama l'API per ottenere dettagli della chiamata
      const callDetailsUrl = `https://analytics-api.cloudtalk.io/api/calls/${callId}`;

      const response = await fetch(callDetailsUrl, {
        method: 'GET',
        headers: {
          'Authorization': this.createAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`⚠️  Could not fetch call details for ${callId}: ${response.status}`);
        return {};
      }

      const callDetails = await response.json();

      return {
        duration: callDetails.talk_time || callDetails.duration,
        agent_name: callDetails.contact_name || callDetails.internal_name,
        phone_from: callDetails.external || callDetails.from,
        phone_to: callDetails.internal || callDetails.to,
        call_type: callDetails.direction || 'unknown',
        started_at: callDetails.started_at,
        metadata: callDetails
      };

    } catch (error) {
      console.warn(`⚠️  Failed to enhance metadata for call ${callId}:`, error.message);
      return {};
    }
  }

  async processCallRecording(callId, options = {}) {
    try {
      // Ottieni metadata aggiuntivi della chiamata se richiesto
      let callMetadata = {};
      if (options.enhance_metadata !== false) {
        callMetadata = await this.enhanceCallMetadataForRecording(callId);
      }

      // Merge con metadata forniti
      if (options.metadata) {
        callMetadata = { ...callMetadata, ...options.metadata };
      }

      // Scarica e salva la registrazione
      return await this.downloadAndSaveRecording(callId, callMetadata);

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async close() {
    await this.recordingManager.close();
  }
}

export default CloudTalkRecordingService;