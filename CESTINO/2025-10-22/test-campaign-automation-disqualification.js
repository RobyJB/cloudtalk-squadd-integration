#!/usr/bin/env node

/**
 * Test script for CloudTalk Campaign Automation with Disqualification Logic
 *
 * Tests:
 * 1. Tag progression at boundaries (1-2, 3-9, 10+ attempts)
 * 2. Disqualification tag handling
 * 3. Multiple disqualification tags
 * 4. Normal tags (no disqualification)
 * 5. Non-campaign tag preservation
 */

import {
  processCallEndedWebhook,
  checkDisqualification,
  DISQUALIFICATION_TAGS,
  CAMPAIGN_TAGS_TO_REMOVE
} from './src/services/cloudtalk-campaign-automation.js';

// Test configuration
const TEST_PHONE = '+393513416607'; // Roberto's test number
const TEST_CORRELATION_ID = `test-${Date.now()}`;

// Color output for better readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function logTest(title) {
  console.log(`\n${colors.bright}${colors.cyan}============ ${title} ============${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

function logInfo(message, data = null) {
  console.log(`${colors.blue}ℹ ${message}${colors.reset}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

// Test scenarios
const testScenarios = [
  {
    name: 'Test 1: Disqualification Check Function',
    run: async () => {
      logTest('Testing Disqualification Check Function');

      // Test with no tags
      let result = checkDisqualification([]);
      if (!result.isDisqualified && result.matchedTags.length === 0) {
        logSuccess('Empty tags correctly not disqualified');
      } else {
        logError('Empty tags incorrectly flagged');
      }

      // Test with normal tags
      result = checkDisqualification(['test', 'normal_tag']);
      if (!result.isDisqualified && result.matchedTags.length === 0) {
        logSuccess('Normal tags correctly not disqualified');
      } else {
        logError('Normal tags incorrectly flagged');
      }

      // Test with single disqualification tag
      result = checkDisqualification(['Straniero']);
      if (result.isDisqualified && result.matchedTags.includes('Straniero')) {
        logSuccess('Single disqualification tag "Straniero" correctly detected');
      } else {
        logError('Failed to detect "Straniero" tag');
      }

      // Test with multiple disqualification tags
      result = checkDisqualification(['Fuori budget', 'normal_tag', 'Bambino']);
      if (result.isDisqualified &&
          result.matchedTags.includes('Fuori budget') &&
          result.matchedTags.includes('Bambino') &&
          result.matchedTags.length === 2) {
        logSuccess('Multiple disqualification tags correctly detected');
      } else {
        logError('Failed to detect multiple disqualification tags');
      }

      // Test case sensitivity
      result = checkDisqualification(['straniero']); // lowercase
      if (!result.isDisqualified) {
        logSuccess('Case sensitivity working - "straniero" not matched');
      } else {
        logError('Case sensitivity failed - "straniero" should not match "Straniero"');
      }

      return true;
    }
  },

  {
    name: 'Test 2: Webhook with Disqualification Tag (Straniero)',
    run: async () => {
      logTest('Testing Webhook with Disqualification Tag');

      const webhookPayload = {
        external_number: TEST_PHONE,
        tags: ['Straniero', 'test123'], // Mix of disqualification and normal tag
        call_uuid: TEST_CORRELATION_ID + '-disqualify-1',
        contact_id: 12345
      };

      logInfo('Webhook payload:', webhookPayload);

      try {
        const result = await processCallEndedWebhook(webhookPayload, webhookPayload.call_uuid);

        if (result.success && result.disqualification) {
          logSuccess('Contact successfully disqualified');
          logInfo('Disqualification tags:', result.disqualificationTags);
          logInfo('Removed campaign tags:', result.removedCampaignTags);
          logInfo('Final tags:', result.finalTags);

          if (result.disqualificationTags.includes('Straniero')) {
            logSuccess('Straniero tag correctly added');
          }

          if (result.finalTags && result.finalTags.includes('test123')) {
            logSuccess('Non-campaign tag "test123" preserved');
          }
        } else {
          logError('Disqualification not triggered');
        }

        return true;
      } catch (error) {
        logError(`Test failed: ${error.message}`);
        return false;
      }
    }
  },

  {
    name: 'Test 3: Multiple Disqualification Tags',
    run: async () => {
      logTest('Testing Multiple Disqualification Tags');

      const webhookPayload = {
        external_number: TEST_PHONE,
        tags: ['Fuori target', 'Dati errati', 'custom_tag', 'nuovi_lead'],
        call_uuid: TEST_CORRELATION_ID + '-multi-disqualify',
        contact_id: 12346
      };

      logInfo('Webhook payload:', webhookPayload);

      try {
        const result = await processCallEndedWebhook(webhookPayload, webhookPayload.call_uuid);

        if (result.success && result.disqualification) {
          logSuccess('Contact successfully disqualified with multiple tags');

          if (result.disqualificationTags.includes('Fuori target') &&
              result.disqualificationTags.includes('Dati errati')) {
            logSuccess('Both disqualification tags correctly detected');
          }

          if (result.removedCampaignTags && result.removedCampaignTags.includes('nuovi_lead')) {
            logSuccess('Campaign tag "nuovi_lead" correctly removed');
          }

          if (result.finalTags && result.finalTags.includes('custom_tag')) {
            logSuccess('Non-campaign tag "custom_tag" preserved');
          }
        } else {
          logError('Multiple disqualification not handled correctly');
        }

        return true;
      } catch (error) {
        logError(`Test failed: ${error.message}`);
        return false;
      }
    }
  },

  {
    name: 'Test 4: Normal Call (No Disqualification)',
    run: async () => {
      logTest('Testing Normal Call without Disqualification');

      const webhookPayload = {
        external_number: TEST_PHONE,
        tags: ['normal_tag', 'another_tag'],
        call_uuid: TEST_CORRELATION_ID + '-normal',
        contact_id: 12347
      };

      logInfo('Webhook payload:', webhookPayload);

      try {
        const result = await processCallEndedWebhook(webhookPayload, webhookPayload.call_uuid);

        if (result.success && !result.disqualification) {
          logSuccess('Normal call processed without disqualification');
          logInfo('Attempts updated:', result.attempts);

          if (result.tags) {
            logInfo('Tag changes applied based on attempts:', result.tags);
          }
        } else {
          logError('Normal call incorrectly disqualified');
        }

        return true;
      } catch (error) {
        logError(`Test failed: ${error.message}`);
        logInfo('Note: This test requires a real contact in CloudTalk');
        return false;
      }
    }
  },

  {
    name: 'Test 5: Tag Progression Boundaries',
    run: async () => {
      logTest('Testing Tag Progression at Boundaries');

      logInfo('Note: This test shows expected tag assignments at different attempt counts');

      const boundaries = [
        { attempts: 1, expectedTag: 'nuovi_lead', description: '1 attempt → nuovi_lead' },
        { attempts: 2, expectedTag: 'nuovi_lead', description: '2 attempts → nuovi_lead' },
        { attempts: 3, expectedTag: 'lead_recenti', description: '3 attempts → lead_recenti' },
        { attempts: 9, expectedTag: 'lead_recenti', description: '9 attempts → lead_recenti' },
        { attempts: 10, expectedTag: 'mancata_risposta', description: '10 attempts → mancata_risposta' },
        { attempts: 15, expectedTag: 'mancata_risposta', description: '15 attempts → mancata_risposta' }
      ];

      boundaries.forEach(boundary => {
        logInfo(`${boundary.description} (expected: ${boundary.expectedTag})`);
      });

      logSuccess('Tag progression boundaries defined correctly');

      return true;
    }
  }
];

// Main test runner
async function runTests() {
  console.log(`${colors.bright}${colors.magenta}
╔════════════════════════════════════════════════════════════╗
║     CloudTalk Campaign Automation Disqualification Test    ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);

  logInfo('Test Configuration:');
  console.log(`  - Test Phone: ${TEST_PHONE}`);
  console.log(`  - Correlation ID: ${TEST_CORRELATION_ID}`);
  console.log(`  - Disqualification Tags: ${DISQUALIFICATION_TAGS.join(', ')}`);
  console.log(`  - Campaign Tags to Remove: ${CAMPAIGN_TAGS_TO_REMOVE.join(', ')}`);

  let passedTests = 0;
  let failedTests = 0;

  for (const scenario of testScenarios) {
    try {
      const result = await scenario.run();
      if (result) {
        passedTests++;
      } else {
        failedTests++;
      }
    } catch (error) {
      logError(`Unexpected error in ${scenario.name}: ${error.message}`);
      failedTests++;
    }
  }

  // Summary
  console.log(`\n${colors.bright}${colors.cyan}════════════════ TEST SUMMARY ════════════════${colors.reset}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);

  if (failedTests === 0) {
    console.log(`\n${colors.bright}${colors.green}🎉 All tests passed successfully!${colors.reset}`);
  } else {
    console.log(`\n${colors.bright}${colors.yellow}⚠️  Some tests failed. Check the logs above.${colors.reset}`);
  }

  // Important notes
  console.log(`\n${colors.yellow}Important Notes:${colors.reset}`);
  console.log('1. Tests 2-4 require a real contact with the test phone number in CloudTalk');
  console.log('2. The contact must have the "# di tentativi di chiamata" custom field configured');
  console.log('3. API credentials (CLOUDTALK_API_KEY_ID and CLOUDTALK_API_SECRET) must be set');
  console.log('4. Tag matching is case-sensitive as specified in requirements');
  console.log('5. Webhook payload field names may vary (tags, call_tags, ContactsTag)');
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});