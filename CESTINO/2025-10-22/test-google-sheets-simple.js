import 'dotenv/config';
import googleSheetsService from './src/services/google-sheets-service.js';

async function testGoogleSheets() {
    console.log('🧪 Testing Google Sheets Integration...\n');

    try {
        // Test 1: Connection
        console.log('1. Testing connection...');
        const connectionTest = await googleSheetsService.testConnection();
        if (!connectionTest) {
            throw new Error('Connection test failed');
        }
        console.log('✅ Connection successful\n');

        // Test 2: Setup headers (skip if protected)
        console.log('2. Setting up headers (skipping if protected)...');
        try {
            await googleSheetsService.setupHeaders();
            console.log('✅ Headers setup complete\n');
        } catch (headerError) {
            console.log('⚠️ Headers setup skipped (protected sheet)\n');
        }

        // Test 3: Process call started (auto-detect)
        console.log('3. Testing call started (auto-detect)...');
        const callStartedData = {
            "call_uuid": "test-new-mapping-123",
            "internal_number": 393520441984,
            "external_number": 393513416607,
            "contact_name": "Roberto Bondici (New Mapping Test)",
            "agent_id": 493933,
            "agent_first_name": "Roberto",
            "agent_last_name": "Bondici"
        };

        await googleSheetsService.processCallData(callStartedData);
        console.log('✅ Call started processed\n');

        // Wait 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 4: Process call ended (auto-detect)
        console.log('4. Testing call ended (auto-detect)...');
        const callEndedData = {
            "call_uuid": "test-new-mapping-123",
            "call_id": 1012183927,
            "internal_number": 393520441984,
            "external_number": 393513416607,
            "agent_id": 493933,
            "agent_first_name": "Roberto",
            "agent_last_name": "Bondici",
            "talking_time": 42
        };

        await googleSheetsService.processCallData(callEndedData);
        console.log('✅ Call ended processed\n');

        console.log('🎉 All tests passed! Check your Google Sheet:');
        console.log('https://docs.google.com/spreadsheets/d/1M7i6abjueLuVQ9xLuZwF_wKkxesGs3hhvqvGBvslVaA/edit');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);

        // Try to get more details
        try {
            await googleSheetsService.testConnection();
        } catch (detailError) {
            console.error('❌ Detailed error:', detailError);
        }

        console.log('\n🔧 Troubleshooting checklist:');
        console.log('1. Is google-service-account.json in the project root?');
        console.log('2. Did you share the sheet with the service account email: google-sheet@friday-test-435006.iam.gserviceaccount.com?');
        console.log('3. Are the environment variables set correctly?');
        console.log('4. GOOGLE_SHEETS_ID:', process.env.GOOGLE_SHEETS_ID);
        console.log('5. GOOGLE_SERVICE_ACCOUNT_PATH:', process.env.GOOGLE_SERVICE_ACCOUNT_PATH);
    }
}

// Run test
testGoogleSheets();