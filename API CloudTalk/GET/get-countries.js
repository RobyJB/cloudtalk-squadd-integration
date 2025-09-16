import { makeCloudTalkRequest } from '../config.js';

/**
 * CloudTalk Countries GET API
 * Endpoint: GET /countries/index.json
 * 
 * Description: List all countries
 * 
 * Example API Response Payload:
 * {
 *   "responseData": [
 *     {
 *       "Country": {
 *         "id": "61",
 *         "name": "Denmark",
 *         "country_code": "DK",
 *         "iso3": "DNK",
 *         "calling_code": "45"
 *       }
 *     },
 *     {
 *       "Country": {
 *         "id": "235",
 *         "name": "United Kingdom",
 *         "country_code": "GB",
 *         "iso3": "GBR",
 *         "calling_code": "44"
 *       }
 *     }
 *   ]
 * }
 */

async function getCountries() {
  console.log('🌍 CloudTalk - Get Countries');
  console.log('=' .repeat(40));

  const endpoint = '/countries/index.json';

  try {
    const response = await makeCloudTalkRequest(endpoint);
    
    console.log('✅ Success!');
    if (response.data?.responseData && Array.isArray(response.data.responseData)) {
      const countries = response.data.responseData;
      
      console.log(`\n📊 Found ${countries.length} countries:`);
      countries.slice(0, 10).forEach((item, index) => {
        const country = item.Country;
        if (country) {
          console.log(`   ${index + 1}. ${country.name} (${country.country_code})`);
          console.log(`      📞 Calling Code: +${country.calling_code}`);
          console.log(`      🏷️  ISO3: ${country.iso3}`);
          console.log(`      🆔 ID: ${country.id}`);
        }
      });
      
      if (countries.length > 10) {
        console.log(`   ... and ${countries.length - 10} more countries`);
      }
    }
    
    return response.data;

  } catch (error) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

// Test examples
async function runTests() {
  console.log('🚀 Testing CloudTalk Countries API\n');

  try {
    // Test 1: Get all countries
    console.log('Test 1: Get all countries');
    await getCountries();

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { getCountries };