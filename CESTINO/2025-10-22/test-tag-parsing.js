/**
 * Test parsing dei tag dal webhook CloudTalk
 */

// Simulate webhook payloads
const payload1 = {
  tag: "Straniero"
};

const payload2 = {
  tag: "Straniero,Cerca lavoro"
};

const payload3 = {
  tag: "Straniero, Cerca lavoro, Bambino"  // con spazi
};

function parseWebhookTags(webhookPayload) {
  let webhookTags = [];

  if (webhookPayload.tag) {
    // Split CSV string and trim whitespace
    webhookTags = webhookPayload.tag
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  } else if (webhookPayload.tags) {
    // Fallback: if tags is an array
    webhookTags = Array.isArray(webhookPayload.tags) ? webhookPayload.tags : [];
  } else if (webhookPayload.call_tags) {
    // Fallback: if call_tags is an array
    webhookTags = Array.isArray(webhookPayload.call_tags) ? webhookPayload.call_tags : [];
  }

  return webhookTags;
}

console.log('🧪 Test 1: Single tag');
console.log('Input:', payload1.tag);
console.log('Output:', parseWebhookTags(payload1));
console.log('Expected: ["Straniero"]');
console.log('Match:', JSON.stringify(parseWebhookTags(payload1)) === JSON.stringify(["Straniero"]) ? '✅' : '❌');

console.log('\n🧪 Test 2: Two tags');
console.log('Input:', payload2.tag);
console.log('Output:', parseWebhookTags(payload2));
console.log('Expected: ["Straniero", "Cerca lavoro"]');
console.log('Match:', JSON.stringify(parseWebhookTags(payload2)) === JSON.stringify(["Straniero", "Cerca lavoro"]) ? '✅' : '❌');

console.log('\n🧪 Test 3: Three tags with spaces');
console.log('Input:', payload3.tag);
console.log('Output:', parseWebhookTags(payload3));
console.log('Expected: ["Straniero", "Cerca lavoro", "Bambino"]');
console.log('Match:', JSON.stringify(parseWebhookTags(payload3)) === JSON.stringify(["Straniero", "Cerca lavoro", "Bambino"]) ? '✅' : '❌');