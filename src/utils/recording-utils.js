/**
 * Recording Utils - CloudTalk Recording Management
 * Handles CloudTalk recording URLs and integration with GoHighLevel
 */

import { makeCloudTalkRequest } from '../../API CloudTalk/config.js';

/**
 * Extract recording information from CloudTalk payload
 */
export function extractRecordingInfo(payload) {
    return {
        url: payload.recording_url || payload.Recording_url || payload.recording?.url,
        available: payload.recording_available || payload.recording || false,
        callId: payload.Call_id || payload.call_id || payload.id,
        duration: payload.Call_duration || payload.duration,
        format: payload.recording_format || 'wav', // CloudTalk usually uses WAV
        size: payload.recording_size,
        downloadable: payload.recording_downloadable !== false, // Default true
    };
}

/**
 * Get recording URL from CloudTalk API if not provided in webhook
 * This function calls CloudTalk API to get the recording URL
 */
export async function getCloudTalkRecordingUrl(callId) {
    try {
        console.log(`📼 Fetching recording URL for call ${callId} from CloudTalk API...`);
        
        // CloudTalk API endpoint for call recordings
        const response = await makeCloudTalkRequest(`/calls/${callId}/recording`);
        
        if (response.data?.responseData?.data?.recording_url) {
            return {
                success: true,
                url: response.data.responseData.data.recording_url,
                available: true
            };
        }
        
        return {
            success: false,
            url: null,
            available: false,
            message: 'Recording not available via API'
        };
        
    } catch (error) {
        console.error(`❌ Error fetching recording URL for call ${callId}:`, error.message);
        return {
            success: false,
            url: null,
            available: false,
            error: error.message
        };
    }
}

/**
 * Create a downloadable recording link for GoHighLevel
 * This creates a proxy link through our middleware if needed
 */
export function createGHLRecordingLink(callId, originalUrl) {
    if (!originalUrl) {
        return null;
    }
    
    // Option 1: Direct CloudTalk URL (if publicly accessible)
    if (originalUrl.startsWith('http')) {
        return originalUrl;
    }
    
    // Option 2: Proxy through our middleware (for authenticated access)
    return `${process.env.MIDDLEWARE_BASE_URL || 'https://your-domain.com'}/api/recordings/cloudtalk/${callId}`;
}

/**
 * Format recording information for GoHighLevel note
 */
export function formatRecordingForNote(callId, recordingInfo, callData) {
    if (!recordingInfo.available || !recordingInfo.url) {
        return '📼 Recording: Not available';
    }
    
    const duration = callData.duration ? ` (${callData.duration}s)` : '';
    const ghlLink = createGHLRecordingLink(callId, recordingInfo.url);
    
    return `📼 Recording: Available${duration}\\n🔗 Listen: ${ghlLink}`;
}

/**
 * Prepare recording data for GoHighLevel custom field
 */
export function formatRecordingForCustomField(callId, recordingInfo, callData) {
    if (!recordingInfo.available || !recordingInfo.url) {
        return null;
    }
    
    return {
        // Simple URL format for custom field
        recording_url: createGHLRecordingLink(callId, recordingInfo.url),
        recording_available: true,
        call_id: callId,
        call_duration: callData.duration,
        recording_format: recordingInfo.format || 'wav',
        updated_at: new Date().toISOString()
    };
}

/**
 * Get recording from CloudTalk with multiple fallback strategies
 */
export async function getRecordingWithFallback(callData, webhookPayload) {
    // Strategy 1: Check webhook payload first
    let recordingInfo = extractRecordingInfo(webhookPayload);
    
    if (recordingInfo.url && recordingInfo.available) {
        console.log('📼 Recording URL found in webhook payload');
        return recordingInfo;
    }
    
    // Strategy 2: If recording is marked as available but no URL, fetch from API
    if (recordingInfo.available && !recordingInfo.url && callData.id) {
        console.log('📼 Recording available but no URL, fetching from CloudTalk API...');
        const apiResult = await getCloudTalkRecordingUrl(callData.id);
        
        if (apiResult.success) {
            return {
                ...recordingInfo,
                url: apiResult.url,
                available: true
            };
        }
    }
    
    // Strategy 3: Check if call-ended webhook has recording info
    if (callData.recording) {
        console.log('📼 Recording mentioned in call data, but no direct URL');
        return {
            ...recordingInfo,
            available: true,
            url: null // Will be handled by fallback
        };
    }
    
    // Strategy 4: No recording available
    console.log('📼 No recording available for this call');
    return {
        available: false,
        url: null
    };
}

/**
 * Helper function to add recording to GoHighLevel contact via both note and custom field
 */
export async function addRecordingToGHLContact(ghlContactId, callId, recordingInfo, callData, addNoteFunction, addCustomFieldFunction) {
    const results = {
        note_added: false,
        custom_field_added: false,
        errors: []
    };
    
    try {
        // Add to note
        if (addNoteFunction) {
            const noteRecording = formatRecordingForNote(callId, recordingInfo, callData);
            const recordingNote = `[CloudTalk Recording] Call ${callId} recording available\\n${noteRecording}\\nCall Details: ${callData.agentName || 'Unknown Agent'}, ${callData.duration}s - ${new Date().toISOString()}`;
            
            await addNoteFunction(ghlContactId, recordingNote);
            results.note_added = true;
            console.log('✅ Recording added to GHL contact note');
        }
        
        // Add to custom field (if function provided)
        if (addCustomFieldFunction) {
            const customFieldData = formatRecordingForCustomField(callId, recordingInfo, callData);
            if (customFieldData) {
                await addCustomFieldFunction(ghlContactId, 'cloudtalk_last_recording', JSON.stringify(customFieldData));
                results.custom_field_added = true;
                console.log('✅ Recording added to GHL contact custom field');
            }
        }
        
    } catch (error) {
        console.error('❌ Error adding recording to GHL contact:', error.message);
        results.errors.push(error.message);
    }
    
    return results;
}

export default {
    extractRecordingInfo,
    getCloudTalkRecordingUrl,
    createGHLRecordingLink,
    formatRecordingForNote,
    formatRecordingForCustomField,
    getRecordingWithFallback,
    addRecordingToGHLContact
};