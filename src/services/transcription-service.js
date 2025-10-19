import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { log, logError } from '../logger.js';
import { execSync, spawn } from 'child_process';

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

    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp-audio');
    await fs.mkdir(tempDir, { recursive: true });

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `recording_${timestamp}.wav`;
    const filePath = path.join(tempDir, filename);

    // Download with curl using spawn (more reliable)
    await new Promise((resolve, reject) => {
      const curl = spawn('curl', ['-s', '-L', audioUrl, '-o', filePath]);
      
      curl.on('error', (err) => reject(err));
      curl.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`curl exited with code ${code}`));
      });
    });

    // Verify file was downloaded
    const stats = await fs.stat(filePath);
    log(`✅ Audio downloaded to: ${filePath} (${stats.size} bytes)`);

    if (stats.size < 1000) {
      throw new Error(`Downloaded file too small (${stats.size} bytes) - likely not valid audio`);
    }

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
 * Three-phase analysis system for Squadd sales calls
 * @param {string} transcription - The transcribed text
 * @returns {Promise<{success: boolean, analysis?: object, error?: string}>}
 */
export async function extractKeyPoints(transcription) {
  try {
    log(`🔍 Starting three-phase Squadd call analysis...`);

    // PHASE 1: Data extraction (GPT-5 nano)
    const phase1Result = await performPhase1DataExtraction(transcription);
    if (!phase1Result.success) {
      return phase1Result;
    }

    // Check if call is voicemail - skip further analysis
    if (phase1Result.data.call_type === 'segreteria') {
      log(`📞 Voicemail detected, skipping avatar classification`);

      return {
        success: true,
        analysis: {
          call_type: 'segreteria',
          extracted_data: phase1Result.data,
          avatar: null,
          bant_final: null,
          advisor_notes: null
        }
      };
    }

    // Check if call is non-substantial - skip coaching
    if (phase1Result.data.call_type === 'non_sostanziosa') {
      log(`⚠️ Non-substantial call detected, skipping avatar classification`);

      return {
        success: true,
        analysis: {
          call_type: 'non_sostanziosa',
          call_summary: phase1Result.data.call_summary,
          extracted_data: phase1Result.data,
          avatar: null,
          bant_final: null,
          advisor_notes: null
        }
      };
    }

    // PHASE 2: Avatar classification (GPT-5)
    const phase2Result = await performPhase2AvatarClassification(phase1Result.data, transcription);
    if (!phase2Result.success) {
      return phase2Result;
    }

    // PHASE 3: BANT validation and advisor notes (GPT-5)
    const phase3Result = await performPhase3BANTAndNotes(phase1Result.data, phase2Result.classification, transcription);
    if (!phase3Result.success) {
      return phase3Result;
    }

    log(`✅ Three-phase analysis completed successfully`);

    return {
      success: true,
      analysis: {
        call_type: 'sostanziosa',
        extracted_data: phase1Result.data,
        avatar_classification: phase2Result.classification,
        bant_final: phase3Result.bant,
        advisor_notes: phase3Result.notes
      }
    };

  } catch (error) {
    log(`❌ Error in three-phase analysis: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Phase 1: Data extraction with GPT-5 nano (fast and economical)
 */
async function performPhase1DataExtraction(transcription) {
  try {
    log(`📋 Phase 1: Extracting base data from call...`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `Sei un analista esperto di chiamate commerciali per Squadd (CRM SaaS B2B).

CONTESTO: I setter di Squadd chiamano lead aziendali per qualificarli e fissare appuntamenti demo.

ESTRAI le seguenti informazioni dalla chiamata:

{
  "call_type": "sostanziosa/non_sostanziosa/segreteria",
  "call_summary": "Breve riassunto di cosa è successo",
  "nome_advisor": "Nome del setter/advisor Squadd",
  "settore_lead": "Settore business del lead",
  "dimensione_attivita": "Numero dipendenti o dimensione (es: '5 dipendenti', 'solo titolare', '10+', ecc)",
  "software_in_uso": ["lista", "di", "software"],
  "automazioni_in_uso": ["lista", "o", "Nessuna"],
  "problematiche_attuali": ["problema 1", "problema 2"],
  "necessita": ["necessit\u00e0 1", "necessit\u00e0 2"],
  "bant_preliminare": {
    "budget": "presente/incerto/assente",
    "autorita": "presente/incerto/assente",
    "necessita": "presente/incerto/assente",
    "tempistica": "presente/incerto/assente"
  },
  "appuntamento_fissato": true/false
}`
        },
        {
          role: 'user',
          content: `Analizza questa chiamata Squadd:\n\n${transcription}`
        }
      ],
      temperature: 0.2,
      max_completion_tokens: 1000
    });

    let response = completion.choices[0].message.content;
    // Pulisci markdown se presente
    if (response.includes('```json')) {
      response = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    const data = JSON.parse(response);

    log(`✅ Phase 1 completed - call type: ${data.call_type}`);

    return {
      success: true,
      data: data
    };

  } catch (error) {
    logError(`❌ Error in Phase 1: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Phase 2: Avatar Classification with GPT-5
 * Determines the correct avatar (1-7) and if lead is in/out of target
 */
async function performPhase2AvatarClassification(extractedData, transcription) {
  try {
    log(`🎯 Phase 2: Classifying lead avatar...`);

    const avatarRules = `# AVATAR LEAD SQUADD

## Avatar 1:
- **Settore**: Qualsiasi tranne parrucchieri, ristoranti, networker, bar
- **Numero dipendenti**: 3+
- **Necessità**: Automatizzare appuntamenti, promemoria, messaggi whatsapp automatici, gestire lead generation/pubblicità, nutrire automaticamente i clienti, recuperare lead persi, metriche per tracciare le attività, chatbot AI (per chat, NO chiamate), richiedere recensioni, gestire pubblicazioni social, convertire più lead
- **Problemi**: Lavoro disorganizzato, mancanza processo specifico, non converte i lead, dimentica task, non ha controllo sui collaboratori

## Avatar 2:
- **Settore**: Agenzia di marketing
- **Numero dipendenti**: qualsiasi
- **Necessità**: rivendere il sistema, proporre il sistema ai propri clienti, gestire i propri clienti, automatizzare le task, gestire la lead generation, dare un servizio aggiuntivo ai propri clienti
- **Problemi**: Non riesce a centralizzare tutti i clienti, non riesce a tenere sotto controllo i dati dei clienti, spende troppo per i software

## Avatar 3:
- **Settore**: Catene di negozi o brand (piccole e grandi)
- **Numero di punti vendita**: 1+
- **Necessità**: Centralizzare i dati e il lavoro, gestire i clienti meglio, seguire meglio i lead, convertire più lead dalle sponsorizzate, nutrire i clienti, far rimanere più a lungo i clienti, tenere sotto controllo le attività dei collaboratori/dipendenti
- **Problemi**: Non riesce a centralizzare il lavoro, non riesce a tenere sotto controllo i dati e le attività, hanno troppi software, non hanno nessun software per aiutarsi con le attività, perdono troppo tempo, seguono male il cliente

## Avatar 4:
- **Settore**: TUTTE le aziende che lavorano online
- **Numero dipendenti**: qualsiasi
- **Necessità**: convertire più lead dalle pubblicità, seguire meglio i lead, nutrire i clienti, automatizzare i processi, automatizzare le task, promemoria per gli appuntamenti, monitorare le attività del team vendita/setting
- **Problemi**: si perdono per strada tanti lead, troppi software, costi elevati dei software, poco supporto nell'utilizzo dei software, i clienti non vengono seguiti bene dopo la vendita, troppe task manuali

## Avatar 5:
- **Settore**: TUTTE le aziende che fanno pubblicità tramite facebook/instagram/meta/google
- **Necessità**: Centralizzare i dati e il lavoro, gestire i clienti meglio, seguire meglio i lead, convertire più lead dalle sponsorizzate, nutrire i clienti, far rimanere più a lungo i clienti, tenere sotto controllo le attività dei collaboratori/dipendenti
- **Problemi**: si perdono per strada tanti lead, i clienti non vengono seguiti bene dopo la vendita, troppe task manuali, mancanza di un posto unico dove seguire i lead, non c'è un processo di vendita specifico da seguire

## Avatar 6:
- **Settore**: Chi utilizza già GoHighLevel
- **Numero dipendenti**: qualsiasi
- **Necessità**: usando già il nostro stesso programma, avrà dei vantaggi a passare da noi
- **Punti di forza**: a loro, in particolare, regaliamo whatsapp (quello da 30€ al mese), in più hanno assistenza dedicata in live chat in italiano

## Avatar 7:
- **Settore**: qualsiasi
- **Necessità**: vuole lead o fare soldi o fare pubblicità, vuole servizi di marketing
- **ATTENZIONE**: Assicurarsi che ci sia il budget. La soluzione lead generation costa €750/mese

# LEAD FUORI TARGET

## Avatar FT1 - Parrucchieri:
- **Eccezione**: SOLO se fa pubblicità su facebook/instagram/google E necessità è automatizzare lead generation, convertire lead, inviare promemoria, richiedere recensioni
- Altrimenti: FUORI TARGET

## Avatar FT2 - Commerciali/venditori/consulenti:
- Se vuole: Inviare massivamente whatsapp senza essere bloccati, whatsapp gratuiti senza pagare
- FUORI TARGET

## Avatar FT3 - Ristoranti e bar:
- SEMPRE FUORI TARGET (hanno bisogno di prenotazione tavoli che non abbiamo)

## Avatar FT4 - Network di qualsiasi tipo:
- SEMPRE FUORI TARGET (vogliono spammare su whatsapp)

## Avatar FT5 - Software di fatturazione:
- Se vuole SOLO fatturazione: FUORI TARGET
- Se interessato anche ad altro: IN TARGET (proporre integrazione fatture in cloud)

## Avatar FT6 - Affitti brevi:
- Se vuole: gestire più canali comunicazione, prenotazione immobili, channel manager
- FUORI TARGET
- Eccezione: Se fa pubblicità può essere in target

# CAMPANELLI D'ALLARME

🔔 **Invio massivo whatsapp SENZA API/SENZA PAGARE**: Se vuole SOLO whatsapp massivi gratis → FUORI TARGET. Verificare prima se ha altre necessità.

🔔 **Affitti brevi/immobiliare**: Se serve sistema prenotazione immobili tipo airbnb/booking o gestore canali → FUORI TARGET`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `Sei un esperto di classificazione lead per Squadd.

REGOLE AVATAR:
${avatarRules}

IMPORTANTE: 
- Se manca un criterio BANT (Budget, Autorità, Necessità, Tempistica), il lead rischia di essere fuori target
- Formula ideale: B.A.N.T. + Avatar

Rispondi in JSON:
{
  "avatar_numero": 1-7 o null se fuori target,
  "avatar_descrizione": "Descrizione breve avatar",
  "in_target": true/false,
  "motivazione_target": "Perché è in/fuori target",
  "campanelli_allarme": ["lista", "campanelli"] o [],
  "confidenza": "Alta/Media/Bassa"
}`
        },
        {
          role: 'user',
          content: `Classifica questo lead:

DATI ESTRATTI:
${JSON.stringify(extractedData, null, 2)}

TRASCRIZIONE COMPLETA (per contesto):
${transcription.substring(0, 2000)}...`
        }
      ],
      temperature: 0.3,
      max_completion_tokens: 800
    });

    let response = completion.choices[0].message.content;
    // Pulisci markdown se presente
    if (response.includes('```json')) {
      response = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    const classification = JSON.parse(response);

    log(`✅ Phase 2 completed - Avatar: ${classification.avatar_numero || 'Fuori Target'}`);

    return {
      success: true,
      classification: classification
    };

  } catch (error) {
    logError(`❌ Error in Phase 2: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Phase 3: BANT Validation and Advisor Notes with GPT-5
 * Provides detailed BANT analysis and feedback for the advisor
 */
async function performPhase3BANTAndNotes(extractedData, avatarClassification, transcription) {
  try {
    log(`📊 Phase 3: BANT validation and advisor notes...`);

    const bantRules = `# B.A.N.T. Framework Squadd

**Budget**: Il budget non deve essere esplicitamente nominato dal setter. Analizza i dettagli: un networker difficilmente ha soldi, mentre un'azienda con 10 dipendenti attiva da 10 anni li ha sicuramente.

**Autorità**: L'autorità solitamente è implicita. Se il lead non può decidere autonomamente o non può trasmettere correttamente le info ai superiori, non ha autorità.

**Necessità**: Determinare se ha un bisogno CONCRETO o è solo curioso. La necessità deve essere REALE.

**Tempistica**: Non chiedere direttamente "vuoi implementarlo oggi?". Analizzare la conversazione: se ha necessità urgente, ha già provato soluzioni senza successo → ha giusta tempistica. Se parla di "dopo l'estate", "a fine anno", "l'anno prossimo" → NON ha tempistica.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `Sei un coach esperto di vendita per Squadd.

${bantRules}

Analizza la chiamata e fornisci:
1. BANT dettagliato con spiegazioni
2. Note per l'advisor su cosa ha fatto bene/male

Rispondi in JSON:
{
  "bant": {
    "budget": {
      "status": "✅ Presente / ⚠️ Incerto / ❌ Assente",
      "spiegazione": "Perché hai dato questo verdetto"
    },
    "autorita": {
      "status": "✅ Presente / ⚠️ Incerto / ❌ Assente",
      "spiegazione": "Perché hai dato questo verdetto"
    },
    "necessita": {
      "status": "✅ Presente / ⚠️ Incerto / ❌ Assente",
      "spiegazione": "Perché hai dato questo verdetto"
    },
    "tempistica": {
      "status": "✅ Presente / ⚠️ Incerto / ❌ Assente",
      "spiegazione": "Perché hai dato questo verdetto"
    }
  },
  "note_advisor": "Feedback dettagliato per l'advisor. Cosa ha fatto bene, cosa migliorare. Massimo 300 parole. Sii specifico e costruttivo.",
  "confidenza_analisi": "Alta/Media/Bassa"
}`
        },
        {
          role: 'user',
          content: `Analizza questa chiamata:

DATI ESTRATTI:
${JSON.stringify(extractedData, null, 2)}

AVATAR CLASSIFICATO:
${JSON.stringify(avatarClassification, null, 2)}

TRASCRIZIONE COMPLETA:
${transcription}`
        }
      ],
      temperature: 0.3,
      max_completion_tokens: 1200
    });

    let response = completion.choices[0].message.content;
    // Pulisci markdown se presente
    if (response.includes('```json')) {
      response = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    const analysis = JSON.parse(response);

    log(`✅ Phase 3 completed - BANT analysis done`);

    return {
      success: true,
      bant: analysis.bant,
      notes: analysis.note_advisor,
      confidenza: analysis.confidenza_analisi
    };

  } catch (error) {
    logError(`❌ Error in Phase 3: ${error.message}`);
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
    // DEBUG: Non cancellare per ispezionare
    if (tempFilePath) {
      log(`🔍 DEBUG: File salvato in: ${tempFilePath}`);
    }
  }
}

/**
 * Format transcription for GoHighLevel note - NEW TEMPLATE with recording URL
 * @param {object} transcriptionResult - Result from processRecordingTranscription
 * @param {string} recordingUrl - CloudTalk recording URL
 * @returns {string} Formatted note content
 */
export function formatTranscriptionForGHL(transcriptionResult, recordingUrl) {
  const { transcription, analysis, processedAt } = transcriptionResult;

  // Check if this is incomprehensible audio
  if (analysis.call_type === 'incomprehensible_audio') {
    return `🎧 REGISTRAZIONE CHIAMATA:
${recordingUrl}

═══════════════════════════════════════

❓ AUDIO NON COMPRENSIBILE - CLOUDTALK

${analysis.reason}

═══════════════ TRASCRIZIONE ═══════════════

${transcription}`;
  }

  // Check if this is voicemail
  if (analysis.call_type === 'segreteria') {
    return `🎧 REGISTRAZIONE CHIAMATA:
${recordingUrl}

═══════════════════════════════════════

📵 SEGRETERIA - CLOUDTALK

La chiamata è caduta su segreteria telefonica.

═══════════════ TRASCRIZIONE ═══════════════

${transcription}`;
  }

  // Check if this is a non-substantial call
  if (analysis.call_type === 'non_sostanziosa') {
    return `🎧 REGISTRAZIONE CHIAMATA:
${recordingUrl}

═══════════════════════════════════════

✔︎ Risposto - conversazione non avvenuta

📋 RIASSUNTO:
${analysis.call_summary || 'Chiamata tecnica o senza dialogo commerciale'}

═══════════════ TRASCRIZIONE ═══════════════

${transcription}`;
  }

  // Full analysis format for substantial calls
  const { extracted_data, avatar_classification, bant_final, advisor_notes } = analysis;

  // Build problematiche section
  const problematiche = extracted_data.problematiche_attuali && extracted_data.problematiche_attuali.length > 0
    ? extracted_data.problematiche_attuali.map(p => `• ${p}`).join('\n')
    : 'Nessuna problematica specifica emersa';

  // Build necessità section
  const necessita = extracted_data.necessita && extracted_data.necessita.length > 0
    ? extracted_data.necessita.map(n => `• ${n}`).join('\n')
    : 'Nessuna necessità specifica emersa';

  // Build software section
  const software = extracted_data.software_in_uso && extracted_data.software_in_uso.length > 0
    ? extracted_data.software_in_uso.join(', ')
    : 'Nessuno';

  // Build automazioni section
  const automazioni = extracted_data.automazioni_in_uso && extracted_data.automazioni_in_uso.length > 0
    ? extracted_data.automazioni_in_uso.join(', ')
    : 'Nessuna';

  // Avatar status emoji
  const avatarStatus = avatar_classification.in_target ? '🟢 IN TARGET' : '🔴 FUORI TARGET';
  const avatarInfo = avatar_classification.avatar_numero 
    ? `Avatar ${avatar_classification.avatar_numero} - ${avatar_classification.avatar_descrizione}`
    : 'Fuori target';

  // Campanelli d'allarme section
  const campanelliSection = avatar_classification.campanelli_allarme && avatar_classification.campanelli_allarme.length > 0
    ? `\n\n📊 CAMPANELLI D'ALLARME:\n${avatar_classification.campanelli_allarme.map(c => `🔔 ${c}`).join('\n')}`
    : '';

  return `🎧 REGISTRAZIONE CHIAMATA:
${recordingUrl}

═══════════════════════════════════════

👤 NOME ADVISOR: ${extracted_data.nome_advisor || 'Non specificato'}

🎯 AVATAR LEAD: ${avatarInfo}

${avatarStatus}
${avatar_classification.motivazione_target}

══════════════ B.A.N.T. ══════════════

💰 BUDGET: ${bant_final.budget.status}
${bant_final.budget.spiegazione}

👔 AUTORITÀ: ${bant_final.autorita.status}
${bant_final.autorita.spiegazione}

🎯 NECESSITÀ: ${bant_final.necessita.status}
${bant_final.necessita.spiegazione}

⏰ TEMPISTICA: ${bant_final.tempistica.status}
${bant_final.tempistica.spiegazione}

══════════════ DETTAGLI LEAD ══════════════

🏢 SETTORE: ${extracted_data.settore_lead || 'Non specificato'}
👥 DIMENSIONE: ${extracted_data.dimensione_attivita || 'Non specificato'}
💻 SOFTWARE IN UTILIZZO: ${software}
🤖 AUTOMAZIONI IN UTILIZZO: ${automazioni}

🚨 PROBLEMATICHE ATTUALI:
${problematiche}

✨ NECESSITÀ EMERSE:
${necessita}${campanelliSection}

══════════════ NOTE ADVISOR ══════════════

${advisor_notes}

══════════════ TRASCRIZIONE ══════════════

${transcription}

⏰ Elaborata: ${new Date(processedAt).toLocaleString('it-IT')}`;
}

export default {
  processRecordingTranscription,
  formatTranscriptionForGHL,
  extractKeyPoints
};