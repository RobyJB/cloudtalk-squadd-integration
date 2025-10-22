#!/usr/bin/env node

/**
 * Unit test for disqualification logic without API calls
 */

import {
  checkDisqualification,
  DISQUALIFICATION_TAGS,
  CAMPAIGN_TAGS_TO_REMOVE
} from './src/services/cloudtalk-campaign-automation.js';

console.log('\n=== CloudTalk Disqualification Logic Test ===\n');

// Display configuration
console.log('Configuration:');
console.log('\nDisqualification Tags (exact match, case-sensitive):');
DISQUALIFICATION_TAGS.forEach(tag => console.log(`  - "${tag}"`));

console.log('\nCampaign Tags to Remove:');
CAMPAIGN_TAGS_TO_REMOVE.forEach(tag => console.log(`  - "${tag}"`));

console.log('\n=== Running Tests ===\n');

// Test cases
const testCases = [
  {
    name: 'Empty tags array',
    input: [],
    expectedDisqualified: false,
    expectedMatches: []
  },
  {
    name: 'Normal tags only',
    input: ['test', 'customer', 'priority'],
    expectedDisqualified: false,
    expectedMatches: []
  },
  {
    name: 'Single disqualification tag: Straniero',
    input: ['Straniero'],
    expectedDisqualified: true,
    expectedMatches: ['Straniero']
  },
  {
    name: 'Mixed tags with Straniero',
    input: ['test123', 'Straniero', 'other_tag'],
    expectedDisqualified: true,
    expectedMatches: ['Straniero']
  },
  {
    name: 'Multiple disqualification tags',
    input: ['Fuori budget', 'normal', 'Bambino', 'test'],
    expectedDisqualified: true,
    expectedMatches: ['Fuori budget', 'Bambino']
  },
  {
    name: 'All disqualification tags',
    input: DISQUALIFICATION_TAGS,
    expectedDisqualified: true,
    expectedMatches: DISQUALIFICATION_TAGS
  },
  {
    name: 'Case sensitivity test - lowercase straniero',
    input: ['straniero'],  // lowercase
    expectedDisqualified: false,
    expectedMatches: []
  },
  {
    name: 'Case sensitivity test - UPPERCASE STRANIERO',
    input: ['STRANIERO'],  // uppercase
    expectedDisqualified: false,
    expectedMatches: []
  },
  {
    name: 'Partial match should not trigger',
    input: ['Straniero123', 'TestStraniero'],
    expectedDisqualified: false,
    expectedMatches: []
  },
  {
    name: 'Complex scenario with campaign and disqualification tags',
    input: ['nuovi_lead', 'Cerca lavoro', 'custom_tag', 'Fuori target', 'mancata_risposta'],
    expectedDisqualified: true,
    expectedMatches: ['Cerca lavoro', 'Fuori target']
  }
];

let passedTests = 0;
let failedTests = 0;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`  Input: [${testCase.input.map(t => `"${t}"`).join(', ')}]`);

  const result = checkDisqualification(testCase.input);

  const passed =
    result.isDisqualified === testCase.expectedDisqualified &&
    JSON.stringify(result.matchedTags.sort()) === JSON.stringify(testCase.expectedMatches.sort());

  if (passed) {
    console.log(`  ✅ PASSED`);
    console.log(`     Disqualified: ${result.isDisqualified}`);
    if (result.matchedTags.length > 0) {
      console.log(`     Matched tags: [${result.matchedTags.map(t => `"${t}"`).join(', ')}]`);
    }
    passedTests++;
  } else {
    console.log(`  ❌ FAILED`);
    console.log(`     Expected disqualified: ${testCase.expectedDisqualified}, Got: ${result.isDisqualified}`);
    console.log(`     Expected matches: [${testCase.expectedMatches.map(t => `"${t}"`).join(', ')}]`);
    console.log(`     Got matches: [${result.matchedTags.map(t => `"${t}"`).join(', ')}]`);
    failedTests++;
  }
  console.log();
});

// Test campaign tag removal logic
console.log('=== Campaign Tag Removal Test ===\n');

const mockExistingTags = [
  'nuovi_lead',
  'custom_tag',
  'Nuovi Lead',
  'test123',
  'mancata_risposta',
  'another_tag',
  'lead_recenti'
];

console.log('Existing tags:', mockExistingTags);
console.log('Campaign tags to remove:', CAMPAIGN_TAGS_TO_REMOVE);

const remainingTags = mockExistingTags.filter(tag => !CAMPAIGN_TAGS_TO_REMOVE.includes(tag));
console.log('Tags that would remain:', remainingTags);

const removedTags = mockExistingTags.filter(tag => CAMPAIGN_TAGS_TO_REMOVE.includes(tag));
console.log('Tags that would be removed:', removedTags);

if (removedTags.includes('nuovi_lead') &&
    removedTags.includes('Nuovi Lead') &&
    removedTags.includes('mancata_risposta') &&
    removedTags.includes('lead_recenti') &&
    !removedTags.includes('custom_tag') &&
    !removedTags.includes('test123') &&
    !removedTags.includes('another_tag')) {
  console.log('✅ Campaign tag removal logic is correct');
  passedTests++;
} else {
  console.log('❌ Campaign tag removal logic has issues');
  failedTests++;
}

// Summary
console.log('\n=== Test Summary ===');
console.log(`Total tests: ${passedTests + failedTests}`);
console.log(`Passed: ${passedTests} ✅`);
console.log(`Failed: ${failedTests} ❌`);

if (failedTests === 0) {
  console.log('\n🎉 All tests passed successfully!');
} else {
  console.log('\n⚠️  Some tests failed. Review the logic.');
  process.exit(1);
}