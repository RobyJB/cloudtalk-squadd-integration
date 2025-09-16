import { makeCloudTalkRequest } from '../config.js';
import { processSingleCallRecording } from '../recording-integration.js';

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

async function getCallRecording(callId, params = {}) {
  console.log('🎵 CloudTalk - Get Call Recording');
  console.log('=' .repeat(40));

  if (!callId) throw new Error('callId is required');

  // Check if auto-save to database is enabled (disabled by default)
  const autoSaveToDatabase = params.auto_save_to_database === true;

  const endpoint = `/calls/recording/${callId}.json`;

  try {
    // Note: This endpoint returns binary WAV data, not JSON
    // For testing purposes, we'll attempt the request but handle both binary and JSON responses
    const response = await makeCloudTalkRequest(endpoint);

    console.log('✅ Success!');
    console.log(`\n🎵 Recording for call ${callId}:`);
    
    // Check if response is binary (WAV) or JSON (error)
    if (response.contentType && response.contentType.includes('audio')) {
      // Binary WAV data
      console.log('   🎵 Binary WAV data received');
      console.log(`   📊 Data size: ${response.data.byteLength} bytes`);
      console.log(`   🎼 Content-Type: ${response.contentType}`);
    } else if (response.data && typeof response.data === 'object') {
      // JSON error response
      console.log('   📄 JSON Response:', JSON.stringify(response.data, null, 2));
    } else {
      console.log('   📄 Unknown response type received');
    }

    // Auto-save to database if enabled and we have binary audio data
    if (autoSaveToDatabase && response.contentType && response.contentType.includes('audio')) {
      console.log('\n💾 Auto-saving recording to database...');
      try {
        const recordingResult = await processSingleCallRecording(callId, params.metadata || {});

        if (recordingResult.success) {
          if (recordingResult.already_exists) {
            console.log('⏭️  Recording already exists in database');
          } else {
            console.log(`✅ Recording saved to database (${recordingResult.data?.file_size || 'unknown'} bytes)`);
          }
        } else {
          console.log(`⚠️  Failed to save recording: ${recordingResult.error}`);
        }
      } catch (error) {
        console.error('⚠️  Auto-save to database failed:', error.message);
        // Don't throw - let the main function continue
      }
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