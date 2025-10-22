import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testWhisperOnly() {
  console.log('\n=== TEST WHISPER TRASCRIZIONE ===\n');
  
  const audioPath = './test-download.wav';
  
  if (!fs.existsSync(audioPath)) {
    console.error('File non trovato:', audioPath);
    return;
  }
  
  console.log('File audio:', audioPath);
  console.log('Invio a Whisper...\n');
  
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      language: 'it'
    });
    
    console.log('=== TRASCRIZIONE COMPLETA ===\n');
    console.log(transcription.text);
    console.log('\n=== FINE TRASCRIZIONE ===');
    console.log('\nLunghezza:', transcription.text.length, 'caratteri');
    
  } catch (error) {
    console.error('Errore Whisper:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testWhisperOnly();
