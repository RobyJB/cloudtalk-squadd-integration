import 'dotenv/config';
import { processRecordingTranscription, formatTranscriptionForGHL } from './src/services/transcription-service.js';

const recordingUrl = 'https://my.cloudtalk.io/pub/r/MTAwMjQwMjQ4Nw%3D%3D/M2Q1NDg1OTc3NGRkNzg4YWUyYmIwY2NhNmQxZTE3ODZlZTgzMTE5N2EyMzcwNDRjODY4NmE1MjQ1YzQyZmQwNg%3D%3D.wav';

console.log('🎤 ANALISI CHIAMATA CLOUDTALK');
console.log('═══════════════════════════════════════\n');
console.log(`🔗 URL: ${recordingUrl}\n`);

console.log('🚀 Avvio pipeline completa...');
console.log('📝 Step 1: Download audio');
console.log('🎤 Step 2: Trascrizione Whisper');
console.log('🔍 Step 3: Analisi 3 fasi con GPT-4o');
console.log('📄 Step 4: Formato nota GHL\n');
console.log('⏳ Attendere 2-3 minuti...\n');

try {
  const result = await processRecordingTranscription(recordingUrl);
  
  if (!result.success) {
    console.error('❌ Errore:', result.error);
    process.exit(1);
  }
  
  console.log('✅ ANALISI COMPLETATA!\n');
  console.log('═'.repeat(60));
  console.log('📊 RISULTATO ANALISI');
  console.log('═'.repeat(60));
  console.log(JSON.stringify(result.result.analysis, null, 2));
  console.log('');
  
  console.log('═'.repeat(60));
  console.log('📄 NOTA GHL FORMATTATA');
  console.log('═'.repeat(60));
  
  const formattedNote = formatTranscriptionForGHL(result.result, recordingUrl);
  console.log(formattedNote);
  
} catch (error) {
  console.error('❌ Errore:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
