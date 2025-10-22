# FIX: Exact Tag Passthrough to GHL

## Issue Fixed
Tags di disqualificazione venivano modificati prima dell'invio a GHL con l'aggiunta del prefisso "Disqualified - ".

## Root Cause
Nel file `src/services/ghl-opportunity-service.js` alla riga 407, il tag veniva modificato:
```javascript
const lostReason = `Disqualified - ${disqualificationTag}`;
```

Questo causava:
- "Fuori budget" → "Disqualified - Fuori budget"
- "Non ora" → "Disqualified - Non ora"

## Solution Applied
Rimosso il prefisso "Disqualified - " per inviare il tag esatto:
```javascript
// Line 408 in ghl-opportunity-service.js
const lostReason = disqualificationTag;
```

## Complete Tag Flow (After Fix)

### 1. CloudTalk Webhook Reception
**File:** `src/routes/cloudtalk-webhooks.js`
- Receives tags array in webhook payload
- Tags arrive exactly as configured in CloudTalk

### 2. Disqualification Check
**File:** `src/services/cloudtalk-campaign-automation.js` (line 632)
```javascript
function checkDisqualification(webhookTags) {
  // Exact case-sensitive match
  const matchedTags = webhookTags.filter(tag =>
    DISQUALIFICATION_TAGS.includes(tag)
  );
}
```

### 3. Tag Selection
**File:** `src/services/cloudtalk-campaign-automation.js` (line 707)
```javascript
const selectedTag = disqualificationTags[0]; // First tag, no modification
```

### 4. GHL Opportunity Update
**File:** `src/services/ghl-opportunity-service.js` (line 408)
```javascript
const lostReason = disqualificationTag; // ✅ EXACT tag, no prefix
```

### 5. API Call to GHL
**File:** `src/services/ghl-opportunity-service.js` (line 219-224)
```javascript
customFields: [
  {
    key: 'lost_reason',
    field_value: lostReason  // Exact tag value
  }
]
```

## Verified Tags
All 8 disqualification tags are now passed exactly:

| CloudTalk Tag | GHL lost_reason Value |
|---------------|----------------------|
| Straniero | Straniero |
| Cerca lavoro | Cerca lavoro |
| Non ha capito perché ha cliccato | Non ha capito perché ha cliccato |
| Bambino | Bambino |
| Fuori target | Fuori target |
| Fuori budget | Fuori budget |
| Dati errati | Dati errati |
| Non ora | Non ora |

## Testing
Run the verification test:
```bash
node test-exact-tag-passthrough.js
```

## Impact
- ✅ Tags are sent EXACTLY as configured in CloudTalk
- ✅ No prefix or suffix added
- ✅ Spaces preserved (e.g., "Non ora" stays "Non ora")
- ✅ Case preserved exactly
- ✅ GHL receives the exact tag value in lost_reason field

## Deployment
This fix is now active. Any new disqualification webhooks will send exact tags to GHL without the "Disqualified - " prefix.