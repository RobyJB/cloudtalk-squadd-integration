import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

// CloudTalk API Configuration
const CLOUDTALK_CONFIG = {
  baseURL: 'https://my.cloudtalk.io/api',
  apiKey: process.env.CLOUDTALK_API_KEY,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

// Helper function to create Basic Auth header
function getAuthHeader() {
  if (!CLOUDTALK_CONFIG.apiKey) {
    throw new Error('CLOUDTALK_API_KEY not found in environment variables');
  }
  
  // CloudTalk uses API Key as username with empty password for Basic Auth
  const credentials = Buffer.from(`${CLOUDTALK_CONFIG.apiKey}:`).toString('base64');
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
  console.log(`🔑 Auth header: ${requestOptions.headers.Authorization.substring(0, 20)}...`);

  try {
    const response = await fetch(url, requestOptions);
    
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    return {
      status: response.status,
      data: data
    };
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
