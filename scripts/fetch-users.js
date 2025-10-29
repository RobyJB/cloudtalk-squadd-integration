#!/usr/bin/env node

import GHLAPIClient from '../src/services/ghl-api-client.js';
import dotenv from 'dotenv';

dotenv.config();

const apiClient = new GHLAPIClient();

async function fetchUsers() {
  try {
    console.log('\n🔍 Fetching GHL users...\n');

    const response = await apiClient.makeRequest(
      `/locations/${process.env.GHL_LOCATION_ID}/users`,
      { method: 'GET' }
    );

    console.log('📋 Users found:\n');

    if (response.users && Array.isArray(response.users)) {
      for (const user of response.users) {
        console.log(`ID: ${user.id}`);
        console.log(`Name: ${user.firstName} ${user.lastName}`);
        console.log(`Email: ${user.email}`);
        console.log('');
      }

      console.log(`\n✅ Total users: ${response.users.length}\n`);
    } else {
      console.log('Response:', JSON.stringify(response, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

fetchUsers();
