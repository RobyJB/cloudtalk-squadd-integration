import 'dotenv/config';

async function testGHLAPI() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID || 'DfxGoORmPoL5Z1OcfYJM';

  if (!apiKey) {
    console.error('GHL_API_KEY not found in .env');
    return;
  }

  console.log('Testing GHL Contact API...');
  console.log('Location ID:', locationId);

  try {
    // Test search endpoint with minimal data
    const response = await fetch('https://services.leadconnectorhq.com/contacts/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: locationId,
        pageLimit: 2
      })
    });

    if (!response.ok) {
      console.error('API Error:', response.status);
      const errorText = await response.text();
      console.error('Response:', errorText);
      return;
    }

    const data = await response.json();

    console.log('\n✅ API Response:');
    console.log('- Total contacts:', data.total);
    console.log('- Received contacts:', data.contacts?.length || 0);
    console.log('- Has more pages:', !!data.nextPage);
    console.log('- Next page cursor:', data.nextPage);

    if (data.contacts && data.contacts[0]) {
      console.log('\n📋 Sample Contact Fields:');
      const contact = data.contacts[0];
      const fields = Object.keys(contact);
      console.log('Total fields:', fields.length);
      console.log('Field names:', fields.join(', '));

      // Show complete data structure
      console.log('\n📊 Complete First Contact:');
      console.log(JSON.stringify(contact, null, 2));
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testGHLAPI();