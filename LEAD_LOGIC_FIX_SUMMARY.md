# CRITICAL FIX: Lead-to-Call System Logic Correction

## Problem Identified

The Lead-to-Call system was incorrectly using GHL user data instead of lead data, causing calls to be made to the wrong person.

### Before Fix (WRONG BEHAVIOR):
```json
{
  "contact_id": "eNtxZuc4PLQR2ELzyxOg",
  "first_name": "Rubertu",        // THE ACTUAL LEAD
  "last_name": "Bundici",         // THE ACTUAL LEAD
  "phone": "+393513416607",       // THE ACTUAL LEAD
  "user": {
    "firstName": "Andrea",        // GHL USER WHO CREATED LEAD
    "lastName": "Guzzonato",      // GHL USER WHO CREATED LEAD
    "phone": "+393807454525"      // GHL USER PHONE
  }
}
```

**System was calling: Andrea Guzzonato at +393807454525 (WRONG!)**
**Should have been calling: Rubertu Bundici at +393513416607 (CORRECT!)**

## Root Cause

In `/src/services/lead-to-call-service.js`:

1. **Line 46**: `const contact = leadData.user || leadData;` - Used user data
2. **Line 216**: `const phoneNumber = leadData.user?.phone || leadData.phone;` - Used user phone

## Fix Applied

### Changes Made:

1. **Contact Creation Logic** (lines 45-46):
```javascript
// BEFORE (WRONG):
const contact = leadData.user || leadData;
const fullName = `${contact.firstName || leadData.first_name || ''} ${contact.lastName || leadData.last_name || ''}`.trim();

// AFTER (CORRECT):
const fullName = `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim();
```

2. **Contact Data Structure** (lines 51-60):
```javascript
// BEFORE (WRONG):
name: contact.name || fullName || leadData.full_name || leadData.name || 'Lead Senza Nome',
ContactNumber: [{ public_number: contact.phone || leadData.phone || '' }],
ContactEmail: [{ email: contact.email || leadData.email || '' }],

// AFTER (CORRECT):
name: fullName || leadData.full_name || leadData.name || 'Lead Senza Nome',
ContactNumber: [{ public_number: leadData.phone || '' }],
ContactEmail: [{ email: leadData.email || '' }],
```

3. **Phone Number Validation** (lines 214-215):
```javascript
// BEFORE (WRONG):
const phoneNumber = leadData.user?.phone || leadData.phone;

// AFTER (CORRECT):
const phoneNumber = leadData.phone;
```

4. **Enhanced Logging** (lines 83-86):
```javascript
log(`📞 Telefono da chiamare: ${contactData.data.ContactNumber?.[0]?.public_number || 'N/A'}`);
log(`✅ DATI CORRETTI: Usando lead root level, NON user GHL`);
```

## Business Logic Clarification

### What Each Field Means:
- **Root Level Data** (`first_name`, `last_name`, `phone`, `email`): The actual LEAD/CONTACT to be called
- **User Field Data** (`user.firstName`, `user.lastName`, `user.phone`): The GHL user who created the lead (metadata only)

### Correct Flow:
1. GHL webhook contains lead data (Rubertu Bundici) + creator metadata (Andrea Guzzonato)
2. System creates CloudTalk contact for THE LEAD (Rubertu Bundici)
3. System initiates call to THE LEAD's phone (+393513416607)
4. Agent calls the actual lead, not the GHL user

## Verification

### Test Results:
```javascript
// Payload sent to CloudTalk now shows CORRECT data:
{
  "action": "add_contact",
  "data": {
    "name": "Rubertu Bundici",           // ✅ CORRECT
    "ContactNumber": [
      { "public_number": "+393513416607" } // ✅ CORRECT
    ],
    "ContactEmail": [
      { "email": "rubertu@example.com" }   // ✅ CORRECT
    ]
  }
}
```

## Test Files Created

1. `test-corrected-lead-logic.js` - Validates contact creation logic
2. `test-webhook-endpoint.js` - Tests full webhook flow
3. Both tests confirm the system now uses the correct lead data

## Status: ✅ FIXED

The Lead-to-Call system now correctly:
- Creates contacts for the actual LEADS (not GHL users)
- Calls the actual LEADS' phone numbers (not GHL user phones)
- Uses proper root-level contact data from GHL webhooks

**Impact**: Critical business logic fix ensuring leads receive calls instead of internal GHL users.