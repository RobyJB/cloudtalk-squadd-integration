import dotenv from 'dotenv';
dotenv.config();

// Test CloudTalk Analytics API for call details
async function testAnalyticsAPI() {
  const callId = '1013012637';

  console.log('🔍 Testing CloudTalk Analytics API...');
  console.log(`📞 Call ID: ${callId}`);

  // Use same auth method as existing CloudTalk APIs
  const credentials = Buffer.from(`${process.env.CLOUDTALK_API_KEY_ID}:${process.env.CLOUDTALK_API_SECRET}`).toString('base64');
  const authHeader = `Basic ${credentials}`;

  console.log(`🔑 Auth header: Basic ${credentials.substring(0, 10)}...`);

  try {
    const response = await fetch(`https://analytics-api.cloudtalk.io/api/calls/${callId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success!');
      console.log('📄 Call Details:');
      console.log(JSON.stringify(data, null, 2));

      // Check if we have status field
      if (data.status) {
        console.log(`🎯 Call Status: ${data.status}`);
      }
      if (data.talking_time !== undefined) {
        console.log(`⏱️ Talking Time: ${data.talking_time}`);
      }

    } else {
      const errorText = await response.text();
      console.log('❌ Failed!');
      console.log(`Error: ${response.status} - ${errorText}`);
    }

  } catch (error) {
    console.error('💥 Request failed:', error.message);
  }
}

testAnalyticsAPI();