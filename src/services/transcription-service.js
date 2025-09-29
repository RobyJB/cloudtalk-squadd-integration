import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { log, logError } from '../logger.js';
import { execSync } from 'child_process';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Custom vocabulary for Squadd call transcription accuracy
const CUSTOM_VOCABULARY = [
  // Squadd specific terms
  'Squadd', 'CRM', 'Workflow', 'Automazioni', 'Appuntamento',

  // Competitor software mentioned in calls
  'GoHighLevel', 'Delera', 'Leadfather', 'Arcanis', 'Growi', 'Unique.ai',

  // Common business terms in Italian B2B calls
  'cliente', 'preventivo', 'offerta', 'contratto', 'fattura', 'scadenza',
  'riunione', 'appuntamento', 'telefonate', 'email', 'WhatsApp',

  // Sales and CRM terminology
  'lead', 'prospect', 'pipeline', 'funnel', 'software', 'piattaforma',
  'abbonamento', 'SaaS', 'demo', 'trial', 'budget', 'team vendita',
  'gestione', 'pubblicità', 'marketing', 'automazione', 'flusso lavoro'
];

/**
 * Download audio file from URL
 * @param {string} audioUrl - URL of the audio file
 * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
 */
async function downloadAudio(audioUrl) {
  try {
    log(`🎵 Downloading audio from: ${audioUrl}`);

    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp-audio');
    await fs.mkdir(tempDir, { recursive: true });

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `recording_${timestamp}.wav`;
    const filePath = path.join(tempDir, filename);

    // Download and save file
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filePath, buffer);

    log(`✅ Audio downloaded to: ${filePath} (${buffer.length} bytes)`);

    return {
      success: true,
      filePath: filePath
    };

  } catch (error) {
    logError(`❌ Error downloading audio: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check and convert audio file format if needed
 * @param {string} filePath - Path to audio file
 * @returns {Promise<{success: boolean, convertedPath?: string, error?: string}>}
 */
async function checkAndConvertAudio(filePath) {
  try {
    log(`🔍 Checking audio file format: ${filePath}`);

    // Check file info using file command
    try {
      const fileInfo = execSync(`file "${filePath}"`, { encoding: 'utf8' });
      log(`📊 File info: ${fileInfo.trim()}`);
    } catch (error) {
      log(`⚠️ Could not get file info: ${error.message}`);
    }

    // Try to get audio info with ffprobe (if available)
    let needsConversion = false;
    try {
      const ffprobeOutput = execSync(`ffprobe -v quiet -print_format json -show_format "${filePath}"`, { encoding: 'utf8' });
      const audioInfo = JSON.parse(ffprobeOutput);
      log(`🎵 Audio format: ${audioInfo.format.format_name}`);

      // Check if it's a supported format
      const supportedFormats = ['wav', 'mp3', 'flac', 'm4a', 'ogg'];
      const formatName = audioInfo.format.format_name.toLowerCase();
      needsConversion = !supportedFormats.some(format => formatName.includes(format));

    } catch (error) {
      log(`⚠️ ffprobe not available or failed, attempting direct transcription: ${error.message}`);
      // If ffprobe fails, try direct transcription first
      needsConversion = false;
    }

    if (needsConversion) {
      log(`🔄 Converting audio to compatible format...`);

      const convertedPath = filePath.replace(/\.[^/.]+$/, '_converted.wav');
      execSync(`ffmpeg -i "${filePath}" -acodec pcm_s16le -ar 16000 "${convertedPath}"`, {
        stdio: 'pipe'
      });

      log(`✅ Audio converted to: ${convertedPath}`);

      return {
        success: true,
        convertedPath: convertedPath
      };
    }

    return {
      success: true,
      convertedPath: filePath // No conversion needed
    };

  } catch (error) {
    logError(`❌ Error checking/converting audio: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Transcribe audio file using OpenAI Whisper
 * @param {string} filePath - Path to audio file
 * @returns {Promise<{success: boolean, transcription?: string, error?: string}>}
 */
async function transcribeAudio(filePath) {
  try {
    log(`🎤 Transcribing audio file: ${filePath}`);

    // First check and convert audio if needed
    const conversionResult = await checkAndConvertAudio(filePath);

    let audioFileToUse = filePath;
    if (conversionResult.success && conversionResult.convertedPath) {
      audioFileToUse = conversionResult.convertedPath;
    } else if (!conversionResult.success) {
      log(`⚠️ Audio conversion failed, trying original file: ${conversionResult.error}`);
    }

    // Create a readable stream for the audio file
    const fileStream = (await import('fs')).default.createReadStream(audioFileToUse);

    const transcription = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      language: 'it', // Italian
      prompt: `Trascrizione di una chiamata telefonica aziendale. Vocabolario: ${CUSTOM_VOCABULARY.join(', ')}`,
      response_format: 'text'
    });

    // Clean up converted file if it was created
    if (audioFileToUse !== filePath) {
      try {
        await fs.unlink(audioFileToUse);
        log(`🗑️ Cleaned up converted file: ${audioFileToUse}`);
      } catch (error) {
        log(`⚠️ Could not clean up converted file: ${error.message}`);
      }
    }

    log(`✅ Transcription completed: ${transcription.length} characters`);

    return {
      success: true,
      transcription: transcription
    };

  } catch (error) {
    logError(`❌ Error transcribing audio: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Two-phase analysis system for Squadd sales calls
 * @param {string} transcription - The transcribed text
 * @returns {Promise<{success: boolean, analysis?: object, error?: string}>}
 */
export async function extractKeyPoints(transcription) {
  try {
    log(`🔍 Starting two-phase Squadd call analysis...`);

    // PHASE 1: Initial analysis and speaker identification
    const phase1Result = await performPhase1Analysis(transcription);
    if (!phase1Result.success) {
      return phase1Result;
    }

    // Check if call is not substantial or voicemail - skip Phase 2 if so
    if (phase1Result.analysis.call_type === 'non_sostanziosa') {
      log(`⚠️ Non-substantial call detected, skipping Phase 2 coaching`);

      return {
        success: true,
        analysis: {
          ...phase1Result.analysis,
          coaching: null // No coaching for non-substantial calls
        }
      };
    }

    if (phase1Result.analysis.call_type === 'segreteria') {
      log(`📞 Voicemail detected, skipping Phase 2 coaching`);

      return {
        success: true,
        analysis: {
          ...phase1Result.analysis,
          coaching: null // No coaching for voicemail calls
        }
      };
    }

    // PHASE 2: Validation and coaching feedback (only for substantial calls)
    const phase2Result = await performPhase2Coaching(transcription, phase1Result.analysis);
    if (!phase2Result.success) {
      return phase2Result;
    }

    log(`✅ Two-phase analysis completed successfully`);

    return {
      success: true,
      analysis: {
        ...phase1Result.analysis,
        coaching: phase2Result.coaching
      }
    };

  } catch (error) {
    log(`❌ Error in two-phase analysis: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Phase 1: Speaker identification and basic call analysis
 */
async function performPhase1Analysis(transcription) {
  try {
    log(`📋 Phase 1: Analyzing speakers and extracting call data...`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `Sei un analista esperto di chiamate commerciali per Squadd (CRM SaaS B2B).

CONTESTO: I setter di Squadd chiamano lead aziendali per qualificarli e fissare appuntamenti demo.

IDENTIFICAZIONE SPEAKER:
- SETTER: Si presenta come Squadd, fa domande sul business del lead, propone appuntamenti
- LEAD: Risponde a domande sulla propria azienda, chiede informazioni su Squadd

IMPORTANTE: Rileva il tipo di chiamata:
- SOSTANZIOSA: Dialogo reale tra setter e lead con contenuto commerciale significativo
- NON AVVENUTA: Chiamate brevi, accordi per ricontattarsi, rifiuti immediati, note tecniche, test
- SEGRETERIA: Messaggio registrato di segreteria telefonica, nessuna conversazione reale

ANALIZZA e rispondi in JSON:
{
  "call_type": "sostanziosa/non_sostanziosa/segreteria",
  "call_summary": "Se non sostanziosa, riassunto veloce di cosa è successo nella chiamata (es: 'Lead e setter si sono accordati per risentirsi domani alle 15:00' oppure 'Lead ha mostrato disinteresse immediato')",
  "speakers": {
    "setter_identified": true/false,
    "lead_identified": true/false,
    "confidence": "Alta/Media/Bassa"
  },
  "call_outcome": {
    "appuntamento_fissato": true/false,
    "motivo_se_non_fissato": "spiegazione breve"
  },
  "lead_info": {
    "azienda": "nome azienda se menzionato",
    "settore": "settore business se chiaro",
    "software_attuale": "software già in uso",
    "team_vendita": "sì/no/non chiaro",
    "fa_pubblicità": "sì/no/non chiaro"
  },
  "sentiment": "Positivo/Neutro/Negativo",
  "note_aggiuntive": "osservazioni importanti"
}`
        },
        {
          role: 'user',
          content: `Analizza questa chiamata Squadd:\n\n${transcription}`
        }
      ],
      temperature: 0.2,
      max_tokens: 800
    });

    const response = completion.choices[0].message.content;
    const analysis = JSON.parse(response);

    log(`✅ Phase 1 completed - speakers identified: ${analysis.speakers.confidence}`);

    return {
      success: true,
      analysis: analysis
    };

  } catch (error) {
    logError(`❌ Error in Phase 1 analysis: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Phase 2: BANT analysis and coaching feedback according to Squadd framework
 */
async function performPhase2Coaching(transcription, phase1Analysis) {
  try {
    log(`🎯 Phase 2: BANT analysis and coaching feedback...`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `Sei un coach di chiamata esperto per Squadd.
Dal trascritto di chiamata che ricevi, e basandoti sulle regole che hai, dai un verdetto alla chiamata.

# Ruolo e Obiettivo
L'obiettivo è assicurarsi che il setter segua lo script, faccia un'analisi corretta, e non lasci spazio a dubbi.

Prima di dare qualsiasi feedback (scritto normalmente, a mo' di paragrafo), dai un riassunto:

## Categorie di lead:
🟢 Categoria 1 - Conosce già il software GoHighLevel oppure uno dei competitor: Delera, Leadfather, Arcanis, Growi, Unique.ai
🔵 Categoria 2 - Usa già software di marketing, CRM o automazioni.
🟡 Categoria 3 - Non usa nessuno strumento, o al massimo fogli Google e similari, ma riconsoce di avere un problema ed è chiaro che sia alla ricerca di una soluzione.
🔴 Categoria 4 - Non usa strumenti di nessun tipo, e non gli è chiaro il tipo di problema che ha. L'obiettivo qui è capire se la persona vuole comunque migliorare la propria azienda/operatività.

## B.A.N.T Framework:
Budget -> il budget non deve essere esplicitamente nominato dal setter
Autorità -> l'autorità solitamente è impliciata; se però hai dubbi, dalla per incerta o non esplorata.
Necessità -> La necessità deriva dall'urgenza e dalla presenza di un problema reale che possiamo risolvere
Tempistica -> La tempistica invece si rivolge alla tempistica di adozione della nostra soluzione; solitamente implicita quando c'è la necessità

## Fasi dello script:
Fase 1 - Introduzione, benvenuto, piacere di conoscerti
Fase 2 - Analisi della situazione ed estrapolazione del bisogno
Fase 3 - Contestualizzo la mia soluzione e la contrappongo ai suoi problemi
Fase 4 - Presa appuntamento

Rispondi in questo formato JSON:
{
  "riassunto": {
    "appuntamento": "✅ Fissato / ❌ Non fissato",
    "categoria_lead": "🟢 Categoria 1 / 🔵 Categoria 2 / 🟡 Categoria 3 / 🔴 Categoria 4",
    "bant": {
      "budget": "✅ presente / ⚠️ incerto / ❌ non esplorato",
      "autorità": "✅ presente / ⚠️ incerto / ❌ non esplorato",
      "necessità": "✅ presente / ⚠️ incerto / ❌ non esplorato",
      "tempistica": "✅ presente / ⚠️ incerto / ❌ non esplorato"
    }
  },
  "coaching_feedback": "Paragrafo di feedback caldo, empatico e contestualizzato per il setter. Massimo 200 parole. Indica passaggi specifici della chiamata. Dai feedback sinceri su cosa migliorare.",
  "fasi_script_seguite": ["Fase 1", "Fase 2", "Fase 3", "Fase 4"],
  "confidenza_analisi": "Alta/Media/Bassa"
}`
        },
        {
          role: 'user',
          content: `Analizza questa chiamata per coaching:

DATI FASE 1:
${JSON.stringify(phase1Analysis, null, 2)}

TRASCRIZIONE COMPLETA:
${transcription}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const response = completion.choices[0].message.content;
    const coaching = JSON.parse(response);

    log(`✅ Phase 2 completed - coaching generated`);

    return {
      success: true,
      coaching: coaching
    };

  } catch (error) {
    logError(`❌ Error in Phase 2 coaching: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clean up temporary audio file
 * @param {string} filePath - Path to file to delete
 */
async function cleanupAudioFile(filePath) {
  try {
    await fs.unlink(filePath);
    log(`🗑️ Cleaned up audio file: ${filePath}`);
  } catch (error) {
    logError(`⚠️ Error cleaning up audio file: ${error.message}`);
  }
}

/**
 * Check if audio transcription is comprehensible or just placeholder text
 * Detects Amara.org and similar placeholder patterns
 * @param {string} transcription - The transcription text to analyze
 * @returns {object} - { isComprehensible: boolean, reason: string, detectedPatterns: array }
 */
function checkAudioComprehensible(transcription) {
  if (!transcription || typeof transcription !== 'string') {
    return {
      isComprehensible: false,
      reason: 'Empty or invalid transcription',
      detectedPatterns: ['empty_transcription']
    };
  }

  const cleanText = transcription.trim().toLowerCase();
  const detectedPatterns = [];

  // Patterns that indicate incomprehensible audio
  const placeholderPatterns = [
    /sottotitoli creati dalla comunità amara\.org/gi,
    /subtitles created by the amara\.org community/gi,
    /sottotitoli creati da amara\.org/gi,
    /created by amara\.org/gi,
    /amara\.org community/gi,
    /sottotitoli automatici/gi,
    /automatic subtitles/gi,
    /generated subtitles/gi,
    /transcript not available/gi,
    /trascrizione non disponibile/gi
  ];

  // Check each pattern
  placeholderPatterns.forEach((pattern, index) => {
    if (pattern.test(transcription)) {
      detectedPatterns.push(`placeholder_pattern_${index + 1}`);
    }
  });

  // If patterns detected, check if the transcription is ONLY placeholder text
  if (detectedPatterns.length > 0) {
    // Remove all placeholder text and see what's left
    let textWithoutPlaceholders = transcription;

    placeholderPatterns.forEach(pattern => {
      textWithoutPlaceholders = textWithoutPlaceholders.replace(pattern, '').trim();
    });

    // Remove common noise characters and whitespace
    const cleanedText = textWithoutPlaceholders
      .replace(/[.\-_,\s\n\r\t]+/g, ' ')
      .trim();

    log(`🔍 Audio comprehension check:`);
    log(`   Original length: ${transcription.length} chars`);
    log(`   After placeholder removal: ${cleanedText.length} chars`);
    log(`   Detected patterns: ${detectedPatterns.join(', ')}`);
    log(`   Remaining text: "${cleanedText.substring(0, 100)}${cleanedText.length > 100 ? '...' : ''}"`);

    // If very little meaningful text remains, consider it incomprehensible
    if (cleanedText.length < 20) {
      return {
        isComprehensible: false,
        reason: `Transcription contains mostly placeholder text (${detectedPatterns.length} patterns detected, only ${cleanedText.length} meaningful chars)`,
        detectedPatterns: detectedPatterns,
        originalLength: transcription.length,
        cleanedLength: cleanedText.length,
        remainingText: cleanedText
      };
    }

    // If substantial text remains after removing placeholders, it's comprehensible
    log(`✅ Substantial text found after placeholder removal - considering comprehensible`);
  }

  // Additional check: very short transcriptions (but not empty)
  if (cleanText.length > 0 && cleanText.length < 10) {
    return {
      isComprehensible: false,
      reason: `Transcription too short (${cleanText.length} chars)`,
      detectedPatterns: ['too_short']
    };
  }

  // If we get here, the audio is comprehensible
  return {
    isComprehensible: true,
    reason: 'Transcription appears to contain meaningful content',
    detectedPatterns: detectedPatterns // May contain patterns but still comprehensible
  };
}

/**
 * Complete transcription pipeline
 * @param {string} audioUrl - URL of the recording to transcribe
 * @returns {Promise<{success: boolean, result?: object, error?: string}>}
 */
export async function processRecordingTranscription(audioUrl) {
  let tempFilePath = null;

  try {
    log(`🚀 Starting transcription pipeline for: ${audioUrl}`);

    // Step 1: Download audio
    const downloadResult = await downloadAudio(audioUrl);
    if (!downloadResult.success) {
      return {
        success: false,
        error: `Download failed: ${downloadResult.error}`
      };
    }

    tempFilePath = downloadResult.filePath;

    // Step 2: Transcribe audio
    const transcriptionResult = await transcribeAudio(tempFilePath);
    if (!transcriptionResult.success) {
      return {
        success: false,
        error: `Transcription failed: ${transcriptionResult.error}`
      };
    }

    // Step 2.5: 🆕 Check for incomprehensible audio (Amara.org placeholders)
    const transcription = transcriptionResult.transcription;
    const audioComprehensionCheck = checkAudioComprehensible(transcription);

    if (!audioComprehensionCheck.isComprehensible) {
      log(`❓ Audio detected as incomprehensible: ${audioComprehensionCheck.reason}`);

      // Read audio buffer for potential upload
      const audioBuffer = await fs.readFile(tempFilePath);

      return {
        success: true,
        result: {
          transcription: transcription,
          analysis: {
            call_type: 'incomprehensible_audio',
            classification: 'AUDIO_NOT_COMPREHENSIBLE',
            reason: audioComprehensionCheck.reason,
            detected_patterns: audioComprehensionCheck.detectedPatterns
          },
          audioUrl: audioUrl,
          audioBuffer: audioBuffer,
          processedAt: new Date().toISOString(),
          incomprehensibleAudio: true
        }
      };
    }

    // Step 3: Extract key points (only for comprehensible audio)
    const analysisResult = await extractKeyPoints(transcription);
    if (!analysisResult.success) {
      return {
        success: false,
        error: `Analysis failed: ${analysisResult.error}`
      };
    }

    // Step 4: Read the audio file to return buffer for upload
    const audioBuffer = await fs.readFile(tempFilePath);

    // Step 5: Format result
    const result = {
      transcription: transcriptionResult.transcription,
      analysis: analysisResult.analysis,
      audioUrl: audioUrl,
      audioBuffer: audioBuffer,
      processedAt: new Date().toISOString()
    };

    log(`✅ Transcription pipeline completed successfully`);

    return {
      success: true,
      result: result
    };

  } catch (error) {
    logError(`❌ Transcription pipeline failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };

  } finally {
    // Always clean up temp file
    if (tempFilePath) {
      await cleanupAudioFile(tempFilePath);
    }
  }
}

/**
 * Format transcription for GoHighLevel note
 * @param {object} transcriptionResult - Result from processRecordingTranscription
 * @returns {string} Formatted note content
 */
export function formatTranscriptionForGHL(transcriptionResult) {
  const { transcription, analysis, processedAt } = transcriptionResult;

  // Fallback for old format compatibility (only if analysis completely failed)
  if (!analysis) {
    const { keyPoints = [], summary = "Analisi non disponibile" } = transcriptionResult;
    return `📋 Riassunto: ${summary}

🔑 Punti chiave:
${keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

📝 Trascrizione completa:
${transcription}

⏰ Elaborata: ${new Date(processedAt).toLocaleString('it-IT')}`;
  }

  // Check if this is voicemail
  if (analysis.call_type === 'segreteria') {
    return `📵 SEGRETERIA - CLOUDTALK`;
  }

  // Check if this is a non-substantial call
  if (analysis.call_type === 'non_sostanziosa') {
    return `✔︎ Risposto - conversazione non avvenuta

📋 Riassunto:
${analysis.call_summary || 'Chiamata tecnica o senza dialogo commerciale'}

📝 Trascrizione:
${transcription}`;
  }

  // Full analysis format for substantial calls
  const { coaching, speakers, call_outcome, lead_info, sentiment } = analysis;

  return `✔︎ Conversazione effettuata

${coaching.riassunto.appuntamento}

${coaching.riassunto.categoria_lead}

📊 B.A.N.T. Framework:
• Budget: ${coaching.riassunto.bant.budget}
• Autorità: ${coaching.riassunto.bant.autorità}
• Necessità: ${coaching.riassunto.bant.necessità}
• Tempistica: ${coaching.riassunto.bant.tempistica}

🎯 COACHING FEEDBACK:
${coaching.coaching_feedback}

📋 DETTAGLI CHIAMATA:
• Sentiment: ${sentiment}
• Speaker identificati: ${speakers.confidence}
• Lead: ${lead_info.azienda || 'Non specificato'} (${lead_info.settore || 'Settore non chiaro'})
• Software attuale: ${lead_info.software_attuale || 'Non specificato'}
• Team vendita: ${lead_info.team_vendita || 'Non chiaro'}

🔄 Fasi script seguite: ${coaching.fasi_script_seguite.join(', ')}

📝 Trascrizione completa:
${transcription}

⏰ Elaborata: ${new Date(processedAt).toLocaleString('it-IT')}
🤖 Confidenza analisi: ${coaching.confidenza_analisi}`;
}

export default {
  processRecordingTranscription,
  formatTranscriptionForGHL,
  extractKeyPoints
};