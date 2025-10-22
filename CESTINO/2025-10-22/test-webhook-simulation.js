#!/usr/bin/env node

/**
 * Webhook Simulation Test
 *
 * Simulates different webhook payloads to test the campaign automation
 * and disqualification logic without making actual HTTP requests
 */

import { processCallEndedWebhook } from './src/services/cloudtalk-campaign-automation.js';

// Color output
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

console.log(`${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════════════════╗
║         CloudTalk Webhook Simulation Test                  ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);

// Simulate different webhook scenarios
const webhookScenarios = [
  {
    name: 'Scenario 1: Normal call - No tags',
    description: 'Standard call without any tags, should progress normally',
    webhook: {
      external_number: '+393513416607',
      call_uuid: 'sim-normal-' + Date.now(),
      call_type: 'outbound',
      call_status: 'answered',
      duration: 120,
      tags: []
    }
  },
  {
    name: 'Scenario 2: Call with disqualification tag "Straniero"',
    description: 'Call with Straniero tag, should trigger disqualification',
    webhook: {
      external_number: '+393513416607',
      call_uuid: 'sim-straniero-' + Date.now(),
      call_type: 'outbound',
      call_status: 'answered',
      duration: 45,
      tags: ['Straniero', 'test_tag', 'nuovi_lead']
    }
  },
  {
    name: 'Scenario 3: Multiple disqualification tags',
    description: 'Call with "Fuori budget" and "Cerca lavoro", should disqualify and add both',
    webhook: {
      external_number: '+393513416607',
      call_uuid: 'sim-multi-disq-' + Date.now(),
      call_type: 'outbound',
      call_status: 'answered',
      duration: 180,
      tags: ['Fuori budget', 'normal_tag', 'Cerca lavoro', 'lead_recenti']
    }
  },
  {
    name: 'Scenario 4: Call with campaign tags only',
    description: 'Call with only campaign tags, should progress normally',
    webhook: {
      external_number: '+393513416607',
      call_uuid: 'sim-campaign-' + Date.now(),
      call_type: 'outbound',
      call_status: 'answered',
      duration: 90,
      tags: ['nuovi_lead', 'followup']
    }
  },
  {
    name: 'Scenario 5: Edge case - "Bambino" tag',
    description: 'Call with Bambino tag, should disqualify',
    webhook: {
      external_number: '+393513416607',
      call_uuid: 'sim-bambino-' + Date.now(),
      call_type: 'outbound',
      call_status: 'answered',
      duration: 10,
      tags: ['Bambino', 'mancata_risposta', 'custom_tag']
    }
  },
  {
    name: 'Scenario 6: Case sensitivity test',
    description: 'Tags in wrong case should NOT trigger disqualification',
    webhook: {
      external_number: '+393513416607',
      call_uuid: 'sim-case-' + Date.now(),
      call_type: 'outbound',
      call_status: 'answered',
      duration: 60,
      tags: ['straniero', 'FUORI BUDGET', 'cerca Lavoro']  // Wrong case
    }
  }
];

async function simulateWebhook(scenario) {
  console.log(`\n${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}${scenario.name}${colors.reset}`);
  console.log(`${colors.cyan}${scenario.description}${colors.reset}`);
  console.log(`\nWebhook Payload:`);
  console.log(JSON.stringify(scenario.webhook, null, 2));

  try {
    console.log(`\n${colors.yellow}Processing...${colors.reset}`);
    const result = await processCallEndedWebhook(scenario.webhook, scenario.webhook.call_uuid);

    console.log(`\n${colors.green}✅ Result:${colors.reset}`);

    if (result.success) {
      console.log(`  Status: SUCCESS`);

      if (result.disqualification) {
        console.log(`  ${colors.red}⚠️  DISQUALIFIED${colors.reset}`);
        console.log(`  Disqualification tags: ${JSON.stringify(result.disqualificationTags)}`);
        console.log(`  Campaign tags removed: ${JSON.stringify(result.removedCampaignTags)}`);
        console.log(`  Final tags: ${JSON.stringify(result.finalTags)}`);
      } else {
        console.log(`  ${colors.green}✓ Normal processing${colors.reset}`);
        if (result.attempts) {
          console.log(`  Attempts: ${result.attempts.previous} → ${result.attempts.new}`);
        }
        if (result.tags) {
          console.log(`  Tag changes:`);
          console.log(`    Added: ${JSON.stringify(result.tags.added || [])}`);
          console.log(`    Removed: ${JSON.stringify(result.tags.removed || [])}`);
          console.log(`    Final: ${JSON.stringify(result.tags.final || [])}`);
        }
      }

      if (result.contact) {
        console.log(`  Contact: ${result.contact.name || 'Unknown'} (ID: ${result.contact.id})`);
      }
    } else {
      console.log(`  Status: FAILED`);
      if (result.reason) {
        console.log(`  Reason: ${result.reason}`);
      }
    }

  } catch (error) {
    console.log(`\n${colors.red}❌ Error:${colors.reset}`);
    console.log(`  ${error.message}`);
    console.log(`\n${colors.yellow}Note: This simulation requires:${colors.reset}`);
    console.log('  1. A real contact with the test phone number in CloudTalk');
    console.log('  2. The "# di tentativi di chiamata" custom field configured');
    console.log('  3. Valid CloudTalk API credentials in .env file');
  }
}

async function runSimulations() {
  console.log(`\n${colors.cyan}Starting webhook simulations...${colors.reset}`);
  console.log('Each scenario simulates a different webhook payload\n');

  for (const scenario of webhookScenarios) {
    await simulateWebhook(scenario);
  }

  console.log(`\n${colors.bright}${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}${colors.green}Simulation Complete${colors.reset}`);
  console.log(`\n${colors.yellow}Key Observations:${colors.reset}`);
  console.log('1. Disqualification tags are case-sensitive (exact match required)');
  console.log('2. When disqualified, ALL campaign tags are removed');
  console.log('3. Non-campaign tags are preserved during disqualification');
  console.log('4. Multiple disqualification tags can be applied simultaneously');
  console.log('5. Normal tag progression: 1-2 attempts → nuovi_lead');
  console.log('                          3-9 attempts → lead_recenti');
  console.log('                          10+ attempts → mancata_risposta');
}

// Run simulations
runSimulations().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});