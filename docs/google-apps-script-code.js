/**
 * Google Apps Script for CloudTalk Call Tracking
 *
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Go to script.google.com
 * 2. Create a new project
 * 3. Replace Code.gs content with this code
 * 4. Create a Google Sheets document for call tracking
 * 5. Update SHEET_ID with your Google Sheets document ID
 * 6. Deploy as Web App with Execute as "Me" and Access to "Anyone"
 * 7. Copy the Web App URL and set as GOOGLE_SHEETS_APPS_SCRIPT_URL in .env
 *
 * GOOGLE SHEETS HEADERS (Row 1):
 * Timestamp | Call UUID | Call ID | External Number | Contact Name | Agent Name | Agent ID |
 * Internal Number | Call Status | Call Started | Call Ended | Talking Time | Waiting Time |
 * Process Type | Source | Webhook Type | Created At | Notes
 */

// Configuration - UPDATE THIS WITH YOUR GOOGLE SHEETS ID
const SHEET_ID = 'YOUR_GOOGLE_SHEETS_ID_HERE'; // Replace with your actual Google Sheets ID
const SHEET_NAME = 'Call Tracking'; // Name of the sheet tab

/**
 * Main HTTP POST handler
 * Receives webhook data from CloudTalk middleware and writes to Google Sheets
 */
function doPost(e) {
  const startTime = new Date();

  try {
    // Parse incoming data
    const contentType = e.parameter.contentType || 'application/json';
    let data;

    if (contentType === 'application/json') {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter;
    }

    console.log('Received webhook data:', JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.call_uuid && !data.call_id) {
      return createErrorResponse('Missing required field: call_uuid or call_id');
    }

    // Process the data
    const result = processCallData(data);

    // Calculate processing time
    const processingTime = new Date() - startTime;

    return createSuccessResponse({
      message: 'Call data processed successfully',
      timestamp: new Date().toISOString(),
      processingTime: processingTime,
      result: result
    });

  } catch (error) {
    console.error('Error processing webhook:', error);

    return createErrorResponse('Internal processing error: ' + error.message);
  }
}

/**
 * Main HTTP GET handler for testing
 * Returns service status and configuration
 */
function doGet(e) {
  try {
    // Check if sheet exists
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();

    return createSuccessResponse({
      service: 'CloudTalk Call Tracking Apps Script',
      status: 'active',
      timestamp: new Date().toISOString(),
      configuration: {
        sheetId: SHEET_ID,
        sheetName: SHEET_NAME,
        totalRows: lastRow,
        lastUpdate: lastRow > 1 ? sheet.getRange(lastRow, 1).getValue() : 'No data'
      },
      endpoints: {
        POST: 'Receive call tracking data from CloudTalk middleware',
        GET: 'Health check and configuration status'
      }
    });

  } catch (error) {
    console.error('Error in health check:', error);

    return createErrorResponse('Health check failed: ' + error.message);
  }
}

/**
 * Process call data and write to Google Sheets
 * Handles both call-started and call-ended events
 */
function processCallData(data) {
  const sheet = getOrCreateSheet();
  const webhookType = data.webhook_type || data.queue_metadata?.processing_type || 'unknown';

  console.log('Processing webhook type:', webhookType);

  if (webhookType === 'call-started') {
    return processCallStarted(sheet, data);
  } else if (webhookType === 'call-ended') {
    return processCallEnded(sheet, data);
  } else {
    // Generic processing for unknown types
    return processGenericCall(sheet, data);
  }
}

/**
 * Process call-started webhook
 * Creates new row in Google Sheets
 */
function processCallStarted(sheet, data) {
  const timestamp = new Date().toISOString();

  // Prepare row data
  const rowData = [
    data.timestamp || timestamp,                    // A: Timestamp
    data.call_uuid || '',                          // B: Call UUID
    data.call_id || '',                            // C: Call ID
    data.external_number || '',                    // D: External Number
    data.contact_name || 'Unknown Contact',       // E: Contact Name
    data.agent_name || '',                         // F: Agent Name
    data.agent_id || '',                           // G: Agent ID
    data.internal_number || '',                    // H: Internal Number
    'started',                                     // I: Call Status
    timestamp,                                     // J: Call Started
    '',                                            // K: Call Ended (empty for started)
    '',                                            // L: Talking Time (empty for started)
    '',                                            // M: Waiting Time (empty for started)
    data.process_type || 'call_tracking',          // N: Process Type
    data.source || 'CloudTalk',                   // O: Source
    'call-started',                                // P: Webhook Type
    timestamp,                                     // Q: Created At
    `Call started from CloudTalk webhook`          // R: Notes
  ];

  // Add row to sheet
  sheet.appendRow(rowData);

  console.log('Call started row added for:', data.call_uuid || data.call_id);

  return {
    action: 'call_started_logged',
    call_uuid: data.call_uuid,
    call_id: data.call_id,
    row_number: sheet.getLastRow()
  };
}

/**
 * Process call-ended webhook
 * Updates existing row or creates new one if not found
 */
function processCallEnded(sheet, data) {
  const timestamp = new Date().toISOString();
  const callUuid = data.call_uuid || '';
  const callId = data.call_id || '';

  // Try to find existing row by call_uuid or call_id
  const existingRow = findExistingCall(sheet, callUuid, callId);

  if (existingRow) {
    // Update existing row
    updateCallEndedRow(sheet, existingRow, data, timestamp);

    console.log('Updated existing row:', existingRow, 'for call:', callUuid || callId);

    return {
      action: 'call_ended_updated',
      call_uuid: callUuid,
      call_id: callId,
      row_number: existingRow
    };

  } else {
    // Create new row (in case call-started was missed)
    const rowData = [
      data.timestamp || timestamp,                    // A: Timestamp
      callUuid,                                      // B: Call UUID
      callId,                                        // C: Call ID
      data.external_number || '',                    // D: External Number
      data.contact_name || 'Unknown Contact',       // E: Contact Name
      data.agent_name || '',                         // F: Agent Name
      data.agent_id || '',                           // G: Agent ID
      data.internal_number || '',                    // H: Internal Number
      'ended',                                       // I: Call Status
      '',                                            // J: Call Started (unknown)
      timestamp,                                     // K: Call Ended
      data.talking_time || 0,                        // L: Talking Time
      data.waiting_time || 0,                        // M: Waiting Time
      data.process_type || 'call_tracking',          // N: Process Type
      data.source || 'CloudTalk',                   // O: Source
      'call-ended',                                  // P: Webhook Type
      timestamp,                                     // Q: Created At
      `Call ended - missed start event`             // R: Notes
    ];

    sheet.appendRow(rowData);

    console.log('Created new row for call-ended:', callUuid || callId);

    return {
      action: 'call_ended_new_row',
      call_uuid: callUuid,
      call_id: callId,
      row_number: sheet.getLastRow()
    };
  }
}

/**
 * Process generic/unknown call data
 */
function processGenericCall(sheet, data) {
  const timestamp = new Date().toISOString();

  const rowData = [
    data.timestamp || timestamp,                    // A: Timestamp
    data.call_uuid || '',                          // B: Call UUID
    data.call_id || '',                            // C: Call ID
    data.external_number || data.lead_phone || '', // D: External Number
    data.contact_name || data.lead_name || '',     // E: Contact Name
    data.agent_name || '',                         // F: Agent Name
    data.agent_id || '',                           // G: Agent ID
    data.internal_number || '',                    // H: Internal Number
    data.call_status || 'unknown',                 // I: Call Status
    data.call_started || '',                       // J: Call Started
    data.call_ended || '',                         // K: Call Ended
    data.talking_time || data.call_duration || '', // L: Talking Time
    data.waiting_time || '',                       // M: Waiting Time
    data.process_type || 'generic',                // N: Process Type
    data.source || 'CloudTalk',                   // O: Source
    data.webhook_type || 'generic',                // P: Webhook Type
    timestamp,                                     // Q: Created At
    data.notes || 'Generic call data processed'   // R: Notes
  ];

  sheet.appendRow(rowData);

  console.log('Generic call row added');

  return {
    action: 'generic_call_logged',
    call_uuid: data.call_uuid,
    call_id: data.call_id,
    row_number: sheet.getLastRow()
  };
}

/**
 * Find existing call row by call_uuid or call_id
 */
function findExistingCall(sheet, callUuid, callId) {
  if (!callUuid && !callId) return null;

  const data = sheet.getDataRange().getValues();

  // Start from row 2 (skip header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowCallUuid = row[1]; // Column B
    const rowCallId = row[2];   // Column C

    // Match by call_uuid (preferred) or call_id
    if ((callUuid && rowCallUuid === callUuid) ||
        (callId && rowCallId && rowCallId.toString() === callId.toString())) {
      return i + 1; // Return 1-based row number
    }
  }

  return null;
}

/**
 * Update existing row with call-ended data
 */
function updateCallEndedRow(sheet, rowNumber, data, timestamp) {
  // Update specific columns for call-ended
  sheet.getRange(rowNumber, 9).setValue('ended');                    // I: Call Status
  sheet.getRange(rowNumber, 11).setValue(timestamp);                 // K: Call Ended
  sheet.getRange(rowNumber, 12).setValue(data.talking_time || 0);    // L: Talking Time
  sheet.getRange(rowNumber, 13).setValue(data.waiting_time || 0);    // M: Waiting Time
  sheet.getRange(rowNumber, 16).setValue('call-ended');              // P: Webhook Type
  sheet.getRange(rowNumber, 18).setValue('Updated with call-ended data'); // R: Notes
}

/**
 * Get or create the Google Sheets document and ensure headers exist
 */
function getOrCreateSheet() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);

    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
    }

    // Check if headers exist
    if (sheet.getLastRow() === 0) {
      createHeaders(sheet);
    }

    return sheet;

  } catch (error) {
    console.error('Error accessing Google Sheets:', error);
    throw new Error('Unable to access Google Sheets. Check SHEET_ID configuration.');
  }
}

/**
 * Create column headers in the sheet
 */
function createHeaders(sheet) {
  const headers = [
    'Timestamp',        // A
    'Call UUID',        // B
    'Call ID',          // C
    'External Number',  // D
    'Contact Name',     // E
    'Agent Name',       // F
    'Agent ID',         // G
    'Internal Number',  // H
    'Call Status',      // I
    'Call Started',     // J
    'Call Ended',       // K
    'Talking Time',     // L
    'Waiting Time',     // M
    'Process Type',     // N
    'Source',           // O
    'Webhook Type',     // P
    'Created At',       // Q
    'Notes'             // R
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#f0f0f0');

  console.log('Headers created in Google Sheets');
}

/**
 * Create success response
 */
function createSuccessResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      ...data
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Create error response
 */
function createErrorResponse(message) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function - can be run from Apps Script editor
 */
function testCallStarted() {
  const testData = {
    call_uuid: 'test-uuid-' + new Date().getTime(),
    external_number: '+393513416607',
    contact_name: 'Roberto Bondici (Test)',
    agent_name: 'Roberto Bondici',
    agent_id: '493933',
    internal_number: '393520441984',
    webhook_type: 'call-started',
    timestamp: new Date().toISOString()
  };

  const result = processCallData(testData);
  console.log('Test result:', result);
  return result;
}

/**
 * Test function for call ended
 */
function testCallEnded() {
  const testData = {
    call_uuid: 'test-uuid-' + (new Date().getTime() - 60000), // Use older timestamp
    call_id: '999999999',
    external_number: '+393513416607',
    contact_name: 'Roberto Bondici (Test)',
    agent_name: 'Roberto Bondici',
    agent_id: '493933',
    internal_number: '393520441984',
    talking_time: 45,
    waiting_time: 12,
    webhook_type: 'call-ended',
    timestamp: new Date().toISOString()
  };

  const result = processCallData(testData);
  console.log('Test result:', result);
  return result;
}