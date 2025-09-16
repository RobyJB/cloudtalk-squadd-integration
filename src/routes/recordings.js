import express from 'express';
import RecordingManager from '../services/recording-manager.js';
import { logError } from '../logger.js';

const router = express.Router();
const recordingManager = new RecordingManager();

// Initialize recording manager
(async () => {
  try {
    await recordingManager.init();
    console.log('📀 Recording manager initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize recording manager:', error.message);
    logError(error);
  }
})();

// GET /api/recordings - Lista tutte le registrazioni
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const recordings = await recordingManager.getAllRecordings({
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      count: recordings.length,
      data: recordings,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    logError(error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recordings',
      message: error.message
    });
  }
});

// GET /api/recordings/search - Ricerca registrazioni
router.get('/search', async (req, res) => {
  try {
    const filters = {};

    if (req.query.agent_name) filters.agent_name = req.query.agent_name;
    if (req.query.phone_from) filters.phone_from = req.query.phone_from;
    if (req.query.phone_to) filters.phone_to = req.query.phone_to;
    if (req.query.call_type) filters.call_type = req.query.call_type;
    if (req.query.date_from) filters.date_from = req.query.date_from;
    if (req.query.date_to) filters.date_to = req.query.date_to;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);

    const recordings = await recordingManager.searchRecordings(filters);

    res.json({
      success: true,
      count: recordings.length,
      filters,
      data: recordings
    });

  } catch (error) {
    logError(error);
    res.status(500).json({
      success: false,
      error: 'Failed to search recordings',
      message: error.message
    });
  }
});

// GET /api/recordings/stats - Statistiche storage
router.get('/stats', async (req, res) => {
  try {
    const stats = await recordingManager.getStorageStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logError(error);
    res.status(500).json({
      success: false,
      error: 'Failed to get storage stats',
      message: error.message
    });
  }
});

// GET /api/recordings/:callId - Dettagli registrazione specifica
router.get('/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const recording = await recordingManager.getRecording(callId);

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found',
        call_id: callId
      });
    }

    res.json({
      success: true,
      data: recording
    });

  } catch (error) {
    logError(error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recording',
      message: error.message
    });
  }
});

// GET /api/recordings/:callId/audio - Stream file audio
router.get('/:callId/audio', async (req, res) => {
  try {
    const { callId } = req.params;
    const audioFile = await recordingManager.getRecordingFile(callId);

    if (!audioFile) {
      return res.status(404).json({
        success: false,
        error: 'Recording file not found',
        call_id: callId
      });
    }

    res.set({
      'Content-Type': audioFile.contentType,
      'Content-Length': audioFile.fileSize,
      'Content-Disposition': `attachment; filename="${audioFile.fileName}"`
    });

    res.send(audioFile.buffer);

  } catch (error) {
    logError(error);
    res.status(500).json({
      success: false,
      error: 'Failed to stream recording',
      message: error.message
    });
  }
});

// POST /api/recordings/:callId/download - Scarica e salva registrazione
router.post('/:callId/download', async (req, res) => {
  try {
    const { callId } = req.params;
    const callMetadata = req.body || {};

    // Verifica se la registrazione esiste già
    const existingRecording = await recordingManager.getRecording(callId);
    if (existingRecording) {
      return res.json({
        success: true,
        message: 'Recording already exists',
        data: existingRecording
      });
    }

    // Qui dovremmo chiamare l'API CloudTalk per scaricare la registrazione
    // Per ora restituiamo un messaggio di placeholder
    res.json({
      success: false,
      error: 'Download functionality not yet implemented',
      message: 'Use the CloudTalk API integration to download recordings',
      call_id: callId
    });

  } catch (error) {
    logError(error);
    res.status(500).json({
      success: false,
      error: 'Failed to download recording',
      message: error.message
    });
  }
});

// PUT /api/recordings/:callId - Aggiorna metadata registrazione
router.put('/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const metadata = req.body;

    const updated = await recordingManager.updateRecordingMetadata(callId, metadata);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found',
        call_id: callId
      });
    }

    const updatedRecording = await recordingManager.getRecording(callId);

    res.json({
      success: true,
      message: 'Recording metadata updated',
      data: updatedRecording
    });

  } catch (error) {
    logError(error);
    res.status(500).json({
      success: false,
      error: 'Failed to update recording',
      message: error.message
    });
  }
});

// DELETE /api/recordings/:callId - Elimina registrazione
router.delete('/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const { delete_file = true } = req.query;

    const deleted = await recordingManager.deleteRecording(callId, delete_file === 'true');

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found',
        call_id: callId
      });
    }

    res.json({
      success: true,
      message: 'Recording deleted successfully',
      call_id: callId,
      file_deleted: delete_file === 'true'
    });

  } catch (error) {
    logError(error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete recording',
      message: error.message
    });
  }
});

// POST /api/recordings/cleanup - Pulizia registrazioni vecchie
router.post('/cleanup', async (req, res) => {
  try {
    const { days_old = 30 } = req.body;

    const result = await recordingManager.cleanup(parseInt(days_old));

    res.json({
      success: true,
      message: `Cleanup completed: ${result.deleted_count} recordings deleted`,
      data: result
    });

  } catch (error) {
    logError(error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup recordings',
      message: error.message
    });
  }
});

export default router;