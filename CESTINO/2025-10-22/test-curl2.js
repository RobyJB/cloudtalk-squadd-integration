import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function test() {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream('./test-curl2.wav'),
    model: 'whisper-1',
    language: 'it'
  });
  
  console.log(transcription.text);
  console.log('\n\nLunghezza:', transcription.text.length);
}

test();
