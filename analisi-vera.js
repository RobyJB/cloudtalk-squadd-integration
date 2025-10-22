import 'dotenv/config';
import { processRecordingTranscription, formatTranscriptionForGHL } from './src/services/transcription-service.js';
import fs from 'fs/promises';

// Usa l'audio più sostanzioso che abbiamo
const audioFile = './20251018_16-53-43_393459686264.wav';

console.log('🎤 ANALISI AUDIO COMPLETA');
console.log('═══════════════════════════════════════\n');
console.log(`📁 File: ${audioFile}\n`);

try {
  const stats = await fs.stat(audioFile);
  console.log(`📊 Dimensione: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);
  
  console.log('⏳ Avvio analisi completa (2-3 minuti)...\n');
  
  // Simula URL per il formato della nota
  const fakeUrl = 'https://my.cloudtalk.io/pub/r/LOCAL_FILE.wav';
  
  // Process come se fosse da URL (usa il file locale)
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  console.log('📝 Step 1/3: Trascrizione Whisper...');
  const fileStream = (await import('fs')).default.createReadStream(audioFile);
  
  const transcription = await openai.audio.transcriptions.create({
    file: fileStream,
    model: 'whisper-1',
    language: 'it',
    response_format: 'text'
  });
  
  console.log(`✅ Trascritto: ${transcription.length} caratteri\n`);
  
  console.log('🔍 Step 2/3: Analisi 3 fasi (GPT-4.1)...');
  console.log('  → Phase 1: Estrazione dati');
  console.log('  → Phase 2: Classificazione avatar');
  console.log('  → Phase 3: BANT + note advisor\n');
  
  const { extractKeyPoints } = await import('./src/services/transcription-service.js');
  const analysisResult = await extractKeyPoints(transcription);
  
  if (!analysisResult.success) {
    console.error('❌ Errore:', analysisResult.error);
    process.exit(1);
  }
  
  console.log('✅ Analisi completata!\n');
  
  console.log('📄 Step 3/3: Formattazione nota GHL...\n');
  
  const result = {
    transcription,
    analysis: analysisResult.analysis,
    processedAt: new Date().toISOString()
  };
  
  const formattedNote = formatTranscriptionForGHL(result, fakeUrl);
  
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RISULTATO ANALISI COMPLETA');
  console.log('═'.repeat(70) + '\n');
  
  console.log(formattedNote);
  
  console.log('\n' + '═'.repeat(70));
  console.log('📈 DATI STRUTTURATI (JSON)');
  console.log('═'.repeat(70) + '\n');
  
  console.log(JSON.stringify(analysisResult.analysis, null, 2));
  
} catch (error) {
  console.error('❌ Errore:', error.message);
  console.error(error.stack);
  process.exit(1);
}
