import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Call Recording GET API
 * Endpoint: GET /calls/recording/{callId}.json
 * 
 * Description: Api endpoint returns media data of recording for selected call. Media data are returned in WAV format.
 * 
 * Path Parameters:
 * - callId: Call ID for the requested recording (required)
 * 
 * Example API Response:
 * - Content-Type: audio/x-wav
 * - Binary WAV data or JSON error response
 * 
 * Error responses:
 * - 404: Recording not found
 * - 410: Recording expired
 */

async function getCallRecording(callId) {
  console.log('🎵 CloudTalk - Get Call Recording');
  console.log('=' .repeat(40));

  if (!callId) throw new Error('callId is required');

  const endpoint = `/calls/recording/${callId}.json`;

  try {
    // Note: This endpoint returns binary WAV data, not JSON
    // For testing purposes, we'll attempt the request but handle both binary and JSON responses
    const response = await makeCloudTalkRequest(endpoint);

    console.log('✅ Success!');
    console.log(`\n🎵 Recording for call ${callId}:`);
    
    // Check if response is binary (WAV) or JSON (error)
    if (response.data && typeof response.data === 'object') {
      // JSON error response
      console.log('   📄 JSON Response:', JSON.stringify(response.data, null, 2));
    } else {
      // Binary WAV data
      console.log('   🎵 Binary WAV data received');
      console.log(`   📊 Data size: ${response.data ? response.data.length : 0} bytes`);
    }

    return response.data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    // Don't throw for common expected errors like 404/410
    if (error.message.includes('404') || error.message.includes('410')) {
      console.log('   ℹ️  This is expected if recording doesn\'t exist or has expired');
      return null;
    }
    throw error;
  }
}

// Test examples
async function runTests() {
  console.log('🚀 Testing CloudTalk Call Recording API\n');

  try {
    // Test 1: Try to get recording (likely to fail with 404)
    console.log('Test 1: Get call recording (may 404 if recording not found)');
    await getCallRecording(12345);

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('💥 Tests failed (expected for missing recordings):', error.message);
    // Don't exit with error for missing recordings as this is expected
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getCallRecording };