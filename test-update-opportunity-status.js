import 'dotenv/config';

async function updateOpportunityStatus() {
  const opportunityId = 'W7HzzYJX5IpznEbR76u1';
  const newStatus = 'open'; // Cambiamo da 'lost' a 'open'
  
  console.log('🔄 Test aggiornamento status opportunità');
  console.log('🆔 Opportunity ID:', opportunityId);
  console.log('📊 Nuovo status:', newStatus);
  
  try {
    // Prima controlliamo lo status attuale
    console.log('\n📋 Step 1: Controllo status attuale...');
    
    const currentResponse = await fetch(`https://services.leadconnectorhq.com/opportunities/search?location_id=${process.env.GHL_LOCATION_ID}&contact_id=eNtxZuc4PLQR2ELzyxOg`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    });
    
    if (currentResponse.ok) {
      const currentData = await currentResponse.json();
      const currentOpp = currentData.opportunities[0];
      console.log('✅ Status attuale:', currentOpp.status);
      console.log('📅 Ultimo cambio status:', currentOpp.lastStatusChangeAt);
    }

    // Step 2: Aggiorniamo lo status
    console.log('\n🚀 Step 2: Aggiorno status...');
    
    const updateResponse = await fetch(`https://services.leadconnectorhq.com/opportunities/${opportunityId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: newStatus
      })
    });

    console.log('Status aggiornamento:', updateResponse.status);
    console.log('Rate limit remaining:', updateResponse.headers.get('x-ratelimit-remaining'));
    
    if (updateResponse.ok) {
      const updateData = await updateResponse.json();
      console.log('✅ AGGIORNAMENTO RIUSCITO!');
      console.log('📊 Nuovo status:', updateData.opportunity?.status);
      console.log('📅 Data aggiornamento:', updateData.opportunity?.lastStatusChangeAt);
      
      // Mostra dettagli completi
      console.log('\n📄 DETTAGLI COMPLETI:');
      console.log('- ID:', updateData.opportunity?.id);
      console.log('- Nome:', updateData.opportunity?.name);
      console.log('- Status:', updateData.opportunity?.status);
      console.log('- Pipeline:', updateData.opportunity?.pipelineId);
      console.log('- Stage:', updateData.opportunity?.pipelineStageId);
      console.log('- Valore:', updateData.opportunity?.monetaryValue);
      
      // JSON completo della risposta
      console.log('\n🔍 JSON COMPLETO RISPOSTA:');
      console.log(JSON.stringify(updateData, null, 2));
      
    } else {
      const errorText = await updateResponse.text();
      console.log('❌ ERRORE nell\'aggiornamento:');
      console.log('- Status code:', updateResponse.status);
      console.log('- Errore:', errorText);
      
      // Proviamo a capire il problema
      if (updateResponse.status === 400) {
        console.log('\n💡 Possibili cause errore 400:');
        console.log('- Status non valido per questa pipeline');
        console.log('- Formato body non corretto');
        console.log('- Opportunità già in questo status');
      } else if (updateResponse.status === 404) {
        console.log('\n💡 Errore 404: Opportunità non trovata');
      } else if (updateResponse.status === 401) {
        console.log('\n💡 Errore 401: Problema di autorizzazione');
      }
    }

    // Step 3: Verifichiamo il risultato
    console.log('\n🔍 Step 3: Verifica finale...');
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Aspetta 1 secondo
    
    const verifyResponse = await fetch(`https://services.leadconnectorhq.com/opportunities/search?location_id=${process.env.GHL_LOCATION_ID}&contact_id=eNtxZuc4PLQR2ELzyxOg`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    });
    
    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      const finalOpp = verifyData.opportunities[0];
      console.log('📊 Status finale verificato:', finalOpp.status);
      console.log('📅 Ultimo cambio status:', finalOpp.lastStatusChangeAt);
      
      if (finalOpp.status === newStatus) {
        console.log('🎉 SUCCESSO! Status aggiornato correttamente');
      } else {
        console.log('⚠️ Status non cambiato come aspettato');
      }
    }

  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
  }
}

updateOpportunityStatus();