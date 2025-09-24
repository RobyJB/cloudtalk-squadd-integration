import { google } from 'googleapis';
import path from 'path';
import { log, logError } from '../logger.js';

class GoogleSheetsService {
    constructor() {
        this.auth = null;
        this.sheets = null;
        this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        this.sheetName = 'Call Sheet';
        this.init();
    }

    async init() {
        try {
            const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_PATH);

            this.auth = new google.auth.GoogleAuth({
                keyFile: keyPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            log('✅ Google Sheets service initialized');
        } catch (error) {
            logError('❌ Failed to initialize Google Sheets service:', error.message);
        }
    }

    /**
     * Insert new row when call starts
     * Mapping: B=datetime, D=agent_id, E=agent_name, O=formula, Q=call_uuid
     */
    async insertCallStarted(callData) {
        try {
            const timestamp = new Date().toLocaleString('it-IT', {
                timeZone: 'Europe/Rome',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).replace(/:/g, '.');

            const agentName = `${callData.agent_first_name} ${callData.agent_last_name}`;

            // Find next available row (after last non-empty row)
            const nextRow = await this.findNextAvailableRow();

            // Prepare data for specific columns: A, B, C, D, E... O, P, Q
            const rowData = new Array(17).fill(''); // 17 columns (A-Q)

            rowData[1] = timestamp;                    // Column B: Data e ora
            rowData[3] = callData.agent_id;            // Column D: Agent ID
            rowData[4] = agentName;                    // Column E: Nome + cognome agente
            rowData[14] = '=SE(VAL.NUMERO(INDICE($B:$B; RIF.RIGA()));   MAIUSC(SINISTRA(TESTO(INDICE($B:$B; RIF.RIGA()); "mmmm yyyy");1)) &   MINUSC(STRINGA.ESTRAI(TESTO(INDICE($B:$B; RIF.RIGA()); "mmmm yyyy");2;LUNGHEZZA(TESTO(INDICE($B:$B; RIF.RIGA()); "mmmm yyyy"))));   "" )'; // Column O: Formula
            rowData[16] = callData.call_uuid;          // Column Q: call_uuid

            const values = [rowData];
            const resource = { values: values };

            let result;

            if (nextRow === 'append') {
                // Use append for large sheets
                result = await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: `${this.sheetName}!A:Q`,
                    valueInputOption: 'USER_ENTERED',
                    resource: resource,
                });
                log(`✅ Call started row appended: ${callData.call_uuid} - ${agentName}`);
            } else {
                // Insert at specific row position
                result = await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${this.sheetName}!A${nextRow}:Q${nextRow}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: resource,
                });
                log(`✅ Call started row inserted at row ${nextRow}: ${callData.call_uuid} - ${agentName}`);
            }
            return result.data;

        } catch (error) {
            logError('❌ Failed to insert call started row:', error.message);
            throw error;
        }
    }

    /**
     * Update existing row when call ends
     * Searches from bottom to top and updates Column K (talking_time) and Column L (end_timestamp)
     */
    async updateCallEnded(callData) {
        try {
            // Search from bottom to top for matching call_uuid
            const rowIndex = await this.findRowByCallUuidFromBottom(callData.call_uuid);

            if (!rowIndex) {
                log(`Call UUID ${callData.call_uuid} not found, skipping update`);
                return { success: false, reason: 'call_uuid_not_found' };
            }

            // Create timestamp for call end (same format as call start but with . instead of :)
            const endTimestamp = new Date().toLocaleString('it-IT', {
                timeZone: 'Europe/Rome',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).replace(/:/g, '.');

            // Update Column K (talking_time) and Column L (end_timestamp)
            const updates = [
                {
                    range: `${this.sheetName}!K${rowIndex}`,
                    values: [[callData.talking_time || 0]]
                },
                {
                    range: `${this.sheetName}!L${rowIndex}`,
                    values: [[endTimestamp]]
                }
            ];

            const batchUpdateRequest = {
                spreadsheetId: this.spreadsheetId,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: updates
                }
            };

            const result = await this.sheets.spreadsheets.values.batchUpdate(batchUpdateRequest);

            log(`✅ Call ended row updated: ${callData.call_uuid} - Row ${rowIndex} - Talking time: ${callData.talking_time} - End time: ${endTimestamp}`);
            return result.data;

        } catch (error) {
            logError('❌ Failed to update call ended row:', error.message);
            throw error;
        }
    }

    /**
     * Process call data - auto-detect if it's call-started or call-ended
     */
    async processCallData(callData) {
        try {
            // Auto-detect webhook type based on available data
            const hasCallEndData = callData.talking_time !== undefined || callData.call_ended || callData.duration;

            if (hasCallEndData) {
                // This is call-ended webhook
                log(`📞 Processing call-ended webhook: ${callData.call_uuid}`);
                return await this.updateCallEnded(callData);
            } else {
                // This is call-started webhook
                log(`📞 Processing call-started webhook: ${callData.call_uuid}`);
                return await this.insertCallStarted(callData);
            }

        } catch (error) {
            logError('❌ Failed to process call data:', error.message);
            throw error;
        }
    }

    /**
     * Find next available row (after last non-empty row)
     * Uses append instead of trying to determine exact row number
     */
    async findNextAvailableRow() {
        try {
            // For large sheets, we'll use append which automatically finds next row
            // But first check if sheet is too big
            const sheetInfo = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });

            const callSheet = sheetInfo.data.sheets.find(sheet => sheet.properties.title === this.sheetName);
            if (callSheet && callSheet.properties.gridProperties.rowCount > 10000) {
                // For very large sheets, use a simpler approach
                log(`⚠️ Large sheet detected (${callSheet.properties.gridProperties.rowCount} rows), using optimized insertion`);
                return 'append'; // Special flag to use append mode
            }

            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A:Q`,
                majorDimension: 'ROWS'
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) return 2;

            // Find last non-empty row (scan from bottom)
            let lastNonEmptyRow = 1;
            for (let i = Math.min(rows.length - 1, 50); i >= 0; i--) { // Only check last 50 rows for performance
                if (rows[i] && rows[i].some(cell => cell && cell.trim() !== '')) {
                    lastNonEmptyRow = i + 1;
                    break;
                }
            }

            return lastNonEmptyRow + 1;

        } catch (error) {
            logError('❌ Failed to find next available row:', error.message);
            return 'append'; // Use append as fallback
        }
    }

    /**
     * Find row by call_uuid searching from bottom to top
     */
    async findRowByCallUuidFromBottom(callUuid) {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A:Q`
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) return null;

            // Search from bottom to top (most recent first)
            for (let i = rows.length - 1; i >= 0; i--) {
                if (rows[i] && rows[i][16] === callUuid) { // Column Q (index 16) has call_uuid
                    return i + 1; // Convert to 1-indexed row number
                }
            }

            return null; // Not found

        } catch (error) {
            logError('❌ Failed to find row by call UUID from bottom:', error.message);
            return null;
        }
    }

    /**
     * Setup sheet headers if needed
     */
    async setupHeaders() {
        try {
            const headers = [
                'Timestamp',
                'Call UUID',
                'Lead Phone',
                'Lead Name',
                'Agent Name',
                'Status',
                'Duration (s)',
                'Talking Time (s)',
                'Waiting Time (s)'
            ];

            const resource = {
                values: [headers]
            };

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A1:I1`,
                valueInputOption: 'USER_ENTERED',
                resource: resource,
            });

            log('✅ Sheet headers setup completed');

        } catch (error) {
            logError('❌ Failed to setup headers:', error.message);
            throw error;
        }
    }

    /**
     * Test connection
     */
    async testConnection() {
        try {
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });

            log(`✅ Connected to Google Sheet: ${response.data.properties.title}`);
            return true;

        } catch (error) {
            logError('❌ Google Sheets connection test failed:', error.message);
            return false;
        }
    }
}

export default new GoogleSheetsService();