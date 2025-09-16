require('dotenv').config();

async function testGHLOpportunitiesAPI() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = 'i30YnwSzJ1ld5lsxtnb2';

  console.log('🧪 Test API GoHighLevel Opportunities');
  console.log('API Key presente:', !!apiKey);
  console.log('Location ID:', locationId);

  try {
    // Test base con limit ridotto
    const response = await fetch(`https://services.leadconnectorhq.com/opportunities/search?location_id=${locationId}&limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    });

    console.log('Status:', response.status);
    console.log('Rate limit remaining:', response.headers.get('x-ratelimit-remaining'));

    if (!response.ok) {
      console.error('❌ Errore API:', await response.text());
      return;
    }

    const data = await response.json();
    console.log('✅ Successo!');
    console.log('- Totale opportunità:', data.meta?.total);
    console.log('- Opportunità ricevute:', data.opportunities?.length);
    console.log('- TraceId:', data.traceId);

    // ANALISI DETTAGLIATA
    if (data.opportunities && data.opportunities.length > 0) {
      console.log('\n📊 ANALISI STRUTTURA:');
      console.log('- Campi prima opportunità:', Object.keys(data.opportunities[0]));
      
      // JSON COMPLETO PRIMA OPPORTUNITÀ
      console.log('\n📄 JSON COMPLETO PRIMA OPPORTUNITÀ:');
      console.log(JSON.stringify(data.opportunities[0], null, 2));

      // JSON COMPLETO SECONDA OPPORTUNITÀ (se esiste)
      if (data.opportunities[1]) {
        console.log('\n📄 JSON COMPLETO SECONDA OPPORTUNITÀ:');
        console.log(JSON.stringify(data.opportunities[1], null, 2));
      }

      // ANALISI PIPELINE E STAGE
      const firstOpp = data.opportunities[0];
      console.log('\n🚰 PIPELINE INFO:');
      console.log('- Pipeline ID:', firstOpp.pipelineId);
      console.log('- Pipeline Stage ID:', firstOpp.pipelineStageId);
      console.log('- Status:', firstOpp.status);
      console.log('- Monetary Value:', firstOpp.monetaryValue);

      // ANALISI CONTATTO COLLEGATO
      if (firstOpp.contact) {
        console.log('\n👤 CONTATTO COLLEGATO:');
        console.log('- Contact ID:', firstOpp.contact.id);
        console.log('- Nome:', firstOpp.contact.name);
        console.log('- Email:', firstOpp.contact.email);
        console.log('- JSON completo:', JSON.stringify(firstOpp.contact, null, 2));
      }

      // ANALISI RELATIONS
      if (firstOpp.relations && firstOpp.relations.length > 0) {
        console.log('\n🔗 RELATIONS:');
        console.log('- Numero relations:', firstOpp.relations.length);
        console.log('- Prima relation:', JSON.stringify(firstOpp.relations[0], null, 2));
      }

      // ANALISI CUSTOM FIELDS
      if (firstOpp.customFields && firstOpp.customFields.length > 0) {
        console.log('\n🏷️ CUSTOM FIELDS:');
        console.log(JSON.stringify(firstOpp.customFields, null, 2));
      } else {
        console.log('\n🏷️ Nessun custom field nella prima opportunità');
      }

      // ANALISI ATTRIBUTIONS
      if (firstOpp.attributions && firstOpp.attributions.length > 0) {
        console.log('\n📈 ATTRIBUTIONS:');
        console.log(JSON.stringify(firstOpp.attributions, null, 2));
      }

      // ANALISI ASSIGNED TO
      console.log('\n👥 ASSIGNMENT:');
      console.log('- Assigned To:', firstOpp.assignedTo);

      // ANALISI DATE
      console.log('\n📅 DATE IMPORTANTI:');
      console.log('- Created At:', firstOpp.createdAt);
      console.log('- Updated At:', firstOpp.updatedAt);
      console.log('- Last Status Change:', firstOpp.lastStatusChangeAt);
      console.log('- Last Stage Change:', firstOpp.lastStageChangeAt);
    }

    // ANALISI META
    if (data.meta) {
      console.log('\n📖 META INFO:');
      console.log('- Totale:', data.meta.total);
      console.log('- Pagina corrente:', data.meta.currentPage);
      console.log('- Next page URL:', data.meta.nextPageUrl);
    }

    // ANALISI AGGREGATIONS
    if (data.aggregations) {
      console.log('\n📊 AGGREGATIONS:');
      console.log('- Pipelines aggregations:', JSON.stringify(data.aggregations, null, 2));
    }

    console.log('\n🎯 TEST COMPLETATO - Dati pronti per mapping!');
    return data;

  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

// Test aggiuntivo con filtri
async function testOpportunitiesWithFilters() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = 'i30YnwSzJ1ld5lsxtnb2';

  console.log('\n\n🔍 Test Opportunities con FILTRI:');

  try {
    // Test con status = won
    console.log('\n📈 Test solo opportunità WON:');
    const wonResponse = await fetch(`https://services.leadconnectorhq.com/opportunities/search?location_id=${locationId}&status=won&limit=3`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    });

    if (wonResponse.ok) {
      const wonData = await wonResponse.json();
      console.log('- Opportunità WON trovate:', wonData.meta?.total);
      if (wonData.opportunities && wonData.opportunities.length > 0) {
        console.log('- Prima WON:', {
          name: wonData.opportunities[0].name,
          value: wonData.opportunities[0].monetaryValue,
          status: wonData.opportunities[0].status
        });
      }
    }

    // Delay per rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));

    // Test con status = open
    console.log('\n📊 Test solo opportunità OPEN:');
    const openResponse = await fetch(`https://services.leadconnectorhq.com/opportunities/search?location_id=${locationId}&status=open&limit=3`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    });

    if (openResponse.ok) {
      const openData = await openResponse.json();
      console.log('- Opportunità OPEN trovate:', openData.meta?.total);
      if (openData.opportunities && openData.opportunities.length > 0) {
        console.log('- Prima OPEN:', {
          name: openData.opportunities[0].name,
          value: openData.opportunities[0].monetaryValue,
          status: openData.opportunities[0].status
        });
      }
    }

  } catch (error) {
    console.error('❌ Errore test filtri:', error.message);
  }
}

// Esegui entrambi i test
async function runAllTests() {
  await testGHLOpportunitiesAPI();
  await testOpportunitiesWithFilters();
}

runAllTests();