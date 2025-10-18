/**
 * NEW FORMAT FOR GHL NOTES
 * Format transcription analysis for GoHighLevel notes with recording URL
 */

/**
 * Format transcription for GoHighLevel note - NEW TEMPLATE
 * @param {object} transcriptionResult - Result from processRecordingTranscription
 * @param {string} recordingUrl - CloudTalk recording URL
 * @returns {string} Formatted note content
 */
export function formatTranscriptionForGHL(transcriptionResult, recordingUrl) {
  const { transcription, analysis, processedAt } = transcriptionResult;

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
${necessita}
${campanelliSection}

══════════════ NOTE ADVISOR ══════════════

${advisor_notes}

══════════════ TRASCRIZIONE ══════════════

${transcription}

⏰ Elaborata: ${new Date(processedAt).toLocaleString('it-IT')}`;
}

export default {
  formatTranscriptionForGHL
};
