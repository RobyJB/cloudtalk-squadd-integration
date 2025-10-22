import 'dotenv/config';
import { extractKeyPoints } from './src/services/transcription-service.js';
import fs from 'fs/promises';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Test con file audio locale esistente
const audioFile = './20251018_16-53-43_393459686264.wav';

console.log('🎤 TEST ANALISI 3 FASI');
console.log('═══════════════════════════════════════\n');

try {
  console.log('📝 Step 1: Trascrizione audio locale...');
  
  const fileStream = (await import('fs')).default.createReadStream(audioFile);
  
  const transcription = await openai.audio.transcriptions.create({
    file: fileStream,
    model: 'whisper-1',
    language: 'it',
    response_format: 'text'
  });
  
  console.log(`✅ Trascritto: ${transcription.length} caratteri\n`);
  console.log('Prima parte:', transcription.substring(0, 200), '...\n');
  
  console.log('🔍 Step 2: Analisi 3 fasi (Phase 1 → Phase 2 → Phase 3)...\n');
  
  const analysisResult = await extractKeyPoints(transcription);
  
  if (!analysisResult.success) {
    console.error('❌ Errore analisi:', analysisResult.error);
    process.exit(1);
  }
  
  console.log('\n✅ ANALISI COMPLETATA!\n');
  console.log('═'.repeat(60));
  console.log('📊 RISULTATO COMPLETO');
  console.log('═'.repeat(60));
  console.log(JSON.stringify(analysisResult.analysis, null, 2));
  
} catch (error) {
  console.error('❌ Errore:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
