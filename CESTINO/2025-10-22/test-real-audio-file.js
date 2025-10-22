import 'dotenv/config';
import OpenAI from 'openai';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const CUSTOM_VOCABULARY = [
  'Squadd', 'CRM', 'Workflow', 'Automazioni', 'Appuntamento',
  'GoHighLevel', 'Delera', 'Leadfather', 'Arcanis', 'Growi', 'Unique.ai'
];

async function testRealAudioFile() {
const audioPath = '/Users/robertobondici/projects/api-middleware/test-download.wav';
  const recordingUrl = 'https://my.cloudtalk.io/pub/r/TEST123/recording.wav';
  
  console.log('🎤 SIMULAZIONE COMPLETA ANALISI CHIAMATA');
  console.log('═══════════════════════════════════════\n');
  
  try {
    // STEP 1: Trascrizione
    console.log('📝 STEP 1: Trascrizione con Whisper...');
    const fileStream = fsSync.createReadStream(audioPath);
    
    const transcription = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      language: 'it',
      prompt: `Trascrizione di una chiamata telefonica aziendale. Vocabolario: ${CUSTOM_VOCABULARY.join(', ')}`,
      response_format: 'text'
    });
    
    console.log('✅ Trascrizione completata!');
    console.log(`📊 Lunghezza: ${transcription.length} caratteri\n`);
    console.log('📝 TRASCRIZIONE:');
    console.log('─'.repeat(60));
    console.log(transcription);
    console.log('─'.repeat(60));
    console.log('');
    
    // STEP 2: FASE 1 - Estrazione Dati (GPT-5 nano)
    console.log('🔍 STEP 2: FASE 1 - Estrazione dati (GPT-5 nano)...');
    
    const phase1 = await openai.chat.completions.create({
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
  "dimensione_attivita": "Numero dipendenti o dimensione",
  "software_in_uso": ["lista", "di", "software"],
  "automazioni_in_uso": ["lista", "o", "Nessuna"],
  "problematiche_attuali": ["problema 1", "problema 2"],
  "necessita": ["necessità 1", "necessità 2"],
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
    
    let rawContent = phase1.choices[0].message.content;
    // Pulisci markdown se presente
    if (rawContent.includes('```json')) {
      rawContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    const extractedData = JSON.parse(rawContent);
    console.log('✅ Dati estratti!');
    console.log(JSON.stringify(extractedData, null, 2));
    console.log('');
    
    // Check if non-substantial or voicemail
    if (extractedData.call_type !== 'sostanziosa') {
      console.log(`⚠️  Chiamata ${extractedData.call_type} - Saltando analisi avatar e BANT`);
      console.log('\n📄 NOTA GHL FINALE:');
      console.log('═'.repeat(60));
      
      const finalNote = `🎧 REGISTRAZIONE CHIAMATA:
${recordingUrl}

═══════════════════════════════════════

${extractedData.call_type === 'segreteria' ? '📵 SEGRETERIA - CLOUDTALK\n\nLa chiamata è caduta su segreteria telefonica.' : '✔︎ Risposto - conversazione non avvenuta\n\n📋 RIASSUNTO:\n' + extractedData.call_summary}

═══════════════ TRASCRIZIONE ═══════════════

${transcription}`;
      
      console.log(finalNote);
      return;
    }
    
    // STEP 3: FASE 2 - Classificazione Avatar (GPT-5)
    console.log('🎯 STEP 3: FASE 2 - Classificazione Avatar (GPT-5)...');
    
    const avatarRules = `# AVATAR LEAD SQUADD

## Avatar 1-7: [regole complete...]

# LEAD FUORI TARGET

# CAMPANELLI D'ALLARME`;
    
    const phase2 = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `Sei un esperto di classificazione lead per Squadd.

Classifica questo lead in uno degli avatar 1-7 o come fuori target.

Rispondi in JSON:
{
  "avatar_numero": 1-7 o null,
  "avatar_descrizione": "Descrizione breve",
  "in_target": true/false,
  "motivazione_target": "Perché",
  "campanelli_allarme": [],
  "confidenza": "Alta/Media/Bassa"
}`
        },
        {
          role: 'user',
          content: `Classifica questo lead:\n\nDATI ESTRATTI:\n${JSON.stringify(extractedData, null, 2)}\n\nTRASCRIZIONE:\n${transcription.substring(0, 2000)}...`
        }
      ],
      temperature: 0.3,
      max_completion_tokens: 800
    });
    
    let rawContent2 = phase2.choices[0].message.content;
    // Pulisci markdown se presente
    if (rawContent2.includes('```json')) {
      rawContent2 = rawContent2.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    const avatarClass = JSON.parse(rawContent2);
    console.log('✅ Avatar classificato!');
    console.log(JSON.stringify(avatarClass, null, 2));
    console.log('');
    
    // STEP 4: FASE 3 - BANT e Note Advisor (GPT-5)
    console.log('📊 STEP 4: FASE 3 - BANT e Note Advisor (GPT-5)...');
    
    const phase3 = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `Sei un coach esperto di vendita per Squadd.

Analizza BANT e fornisci note per l'advisor.

Rispondi in JSON:
{
  "bant": {
    "budget": {"status": "✅/⚠️/❌", "spiegazione": "..."},
    "autorita": {"status": "✅/⚠️/❌", "spiegazione": "..."},
    "necessita": {"status": "✅/⚠️/❌", "spiegazione": "..."},
    "tempistica": {"status": "✅/⚠️/❌", "spiegazione": "..."}
  },
  "note_advisor": "Feedback dettagliato...",
  "confidenza_analisi": "Alta/Media/Bassa"
}`
        },
        {
          role: 'user',
          content: `Analizza:\n\nDATI:\n${JSON.stringify(extractedData, null, 2)}\n\nAVATAR:\n${JSON.stringify(avatarClass, null, 2)}\n\nTRASCRIZIONE:\n${transcription}`
        }
      ],
      temperature: 0.3,
      max_completion_tokens: 1200
    });
    
    let rawContent3 = phase3.choices[0].message.content;
    // Pulisci markdown se presente
    if (rawContent3.includes('```json')) {
      rawContent3 = rawContent3.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    const bant = JSON.parse(rawContent3);
    console.log('✅ BANT analizzato!');
    console.log(JSON.stringify(bant, null, 2));
    console.log('');
    
    // STEP 5: Formato finale
    console.log('📄 STEP 5: Generazione nota GHL finale...\n');
    
    const problematiche = extractedData.problematiche_attuali?.map(p => `• ${p}`).join('\n') || 'Nessuna';
    const necessita = extractedData.necessita?.map(n => `• ${n}`).join('\n') || 'Nessuna';
    const software = extractedData.software_in_uso?.join(', ') || 'Nessuno';
    const automazioni = extractedData.automazioni_in_uso?.join(', ') || 'Nessuna';
    const avatarStatus = avatarClass.in_target ? '🟢 IN TARGET' : '🔴 FUORI TARGET';
    const avatarInfo = avatarClass.avatar_numero ? `Avatar ${avatarClass.avatar_numero} - ${avatarClass.avatar_descrizione}` : 'Fuori target';
    const campanelli = avatarClass.campanelli_allarme?.length > 0 ? `\n\n📊 CAMPANELLI D'ALLARME:\n${avatarClass.campanelli_allarme.map(c => `🔔 ${c}`).join('\n')}` : '';
    
    const finalNote = `🎧 REGISTRAZIONE CHIAMATA:
${recordingUrl}

═══════════════════════════════════════

👤 NOME ADVISOR: ${extractedData.nome_advisor || 'Non specificato'}

🎯 AVATAR LEAD: ${avatarInfo}

${avatarStatus}
${avatarClass.motivazione_target}

══════════════ B.A.N.T. ══════════════

💰 BUDGET: ${bant.bant.budget.status}
${bant.bant.budget.spiegazione}

👔 AUTORITÀ: ${bant.bant.autorita.status}
${bant.bant.autorita.spiegazione}

🎯 NECESSITÀ: ${bant.bant.necessita.status}
${bant.bant.necessita.spiegazione}

⏰ TEMPISTICA: ${bant.bant.tempistica.status}
${bant.bant.tempistica.spiegazione}

══════════════ DETTAGLI LEAD ══════════════

🏢 SETTORE: ${extractedData.settore_lead || 'Non specificato'}
👥 DIMENSIONE: ${extractedData.dimensione_attivita || 'Non specificato'}
💻 SOFTWARE IN UTILIZZO: ${software}
🤖 AUTOMAZIONI IN UTILIZZO: ${automazioni}

🚨 PROBLEMATICHE ATTUALI:
${problematiche}

✨ NECESSITÀ EMERSE:
${necessita}${campanelli}

══════════════ NOTE ADVISOR ══════════════

${bant.note_advisor}

══════════════ TRASCRIZIONE ══════════════

${transcription}

⏰ Elaborata: ${new Date().toLocaleString('it-IT')}`;
    
    console.log('📄 NOTA GHL FINALE:');
    console.log('═'.repeat(60));
    console.log(finalNote);
    console.log('═'.repeat(60));
    
    console.log('\n✅ TEST COMPLETATO CON SUCCESSO!');
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testRealAudioFile();
