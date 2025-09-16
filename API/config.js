import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Get current directory and resolve .env path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// From API/config.js, go up one level to reach project root
const envPath = path.resolve(__dirname, '../.env');

dotenv.config({ path: envPath });

// CloudTalk API Configuration
const CLOUDTALK_CONFIG = {
  baseURL: 'https://my.cloudtalk.io/api',
  apiKeyId: process.env.CLOUDTALK_API_KEY_ID,
  apiSecret: process.env.CLOUDTALK_API_SECRET,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

// Helper function to create Basic Auth header
function getAuthHeader() {
  if (!CLOUDTALK_CONFIG.apiKeyId || !CLOUDTALK_CONFIG.apiSecret) {
    throw new Error('CLOUDTALK_API_KEY_ID and CLOUDTALK_API_SECRET not found in environment variables');
  }
  
  // CloudTalk uses API Key ID as username and API Secret as password for Basic Auth
  const credentials = Buffer.from(`${CLOUDTALK_CONFIG.apiKeyId}:${CLOUDTALK_CONFIG.apiSecret}`).toString('base64');
  return `Basic ${credentials}`;
}

// Helper function to make authenticated requests
async function makeCloudTalkRequest(endpoint, options = {}) {
  const url = `${CLOUDTALK_CONFIG.baseURL}${endpoint}`;
  
  const requestOptions = {
    method: options.method || 'GET',
    headers: {
      ...CLOUDTALK_CONFIG.headers,
      'Authorization': getAuthHeader(),
      ...options.headers
    },
    ...options
  };

  console.log(`🔗 Making request to: ${url}`);
  console.log(`📝 Method: ${requestOptions.method}`);
  console.log(`🔑 Auth header: ${requestOptions.headers.Authorization ? requestOptions.headers.Authorization.substring(0, 20) + '...' : 'No auth header'}`);

  try {
    const response = await fetch(url, requestOptions);

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // ✅ FIX: Check Content-Type before parsing
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      // JSON response
      const data = await response.json();
      return {
        status: response.status,
        data: data
      };
    } else {
      // Binary response (audio, images, etc.)
      const data = await response.arrayBuffer();
      return {
        status: response.status,
        data: data,
        contentType: contentType
      };
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    throw error;
  }
}

export {
  CLOUDTALK_CONFIG,
  getAuthHeader,
  makeCloudTalkRequest
};
