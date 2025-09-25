import dotenv from 'dotenv';
dotenv.config();

/**
 * CloudTalk Analytics API Service
 * Fetches call details from CloudTalk Analytics API to get real call status
 */

// Helper function to get CloudTalk auth header
function getCloudTalkAuthHeader() {
  if (!process.env.CLOUDTALK_API_KEY_ID || !process.env.CLOUDTALK_API_SECRET) {
    throw new Error('CLOUDTALK_API_KEY_ID and CLOUDTALK_API_SECRET not found in environment variables');
  }

  const credentials = Buffer.from(`${process.env.CLOUDTALK_API_KEY_ID}:${process.env.CLOUDTALK_API_SECRET}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Get call details from CloudTalk Analytics API
 * @param {string|number} callId - The call ID from the webhook
 * @returns {Promise<Object>} Call details including status
 */
export async function getCallDetails(callId) {
  try {
    console.log(`📡 Fetching call details for call_id: ${callId}`);

    const response = await fetch(`https://analytics-api.cloudtalk.io/api/calls/${callId}`, {
      method: 'GET',
      headers: {
        'Authorization': getCloudTalkAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CloudTalk Analytics API failed: ${response.status} - ${errorText}`);
    }

    const callDetails = await response.json();

    console.log(`✅ Call details retrieved successfully`);
    console.log(`   - Status: ${callDetails.status}`);
    console.log(`   - Talking time: ${callDetails.call_times?.talking_time || 0}`);
    console.log(`   - Direction: ${callDetails.direction}`);
    console.log(`   - Recorded: ${callDetails.recorded}`);

    return {
      success: true,
      data: callDetails,
      // Extract key fields for easy access
      status: callDetails.status,
      talkingTime: callDetails.call_times?.talking_time || 0,
      totalTime: callDetails.call_times?.total_time || 0,
      direction: callDetails.direction,
      recorded: callDetails.recorded,
      uuid: callDetails.uuid
    };

  } catch (error) {
    console.error(`❌ Failed to fetch call details: ${error.message}`);

    return {
      success: false,
      error: error.message,
      // Fallback values to prevent breaking the flow
      status: 'unknown',
      talkingTime: 0,
      totalTime: 0,
      direction: 'unknown',
      recorded: false,
      uuid: null
    };
  }
}

/**
 * Determine if a call is missed based on CloudTalk status
 * @param {string} status - The status from CloudTalk Analytics API
 * @returns {boolean} True if the call is missed
 */
export function isCallMissed(status) {
  // CloudTalk status values: "answered", "missed", "busy", "no-answer", "failed", etc.
  const missedStatuses = ['missed', 'no-answer', 'busy', 'failed', 'rejected'];
  return missedStatuses.includes(status.toLowerCase());
}

/**
 * Enhanced call analysis with fallback logic
 * @param {Object} webhookPayload - The original webhook payload
 * @returns {Promise<Object>} Enhanced call information
 */
export async function analyzeCall(webhookPayload) {
  const callId = webhookPayload.call_id;

  if (!callId) {
    console.warn('⚠️ No call_id in webhook payload, cannot fetch call details');
    return {
      success: false,
      status: 'unknown',
      isMissed: false,
      reason: 'No call_id provided'
    };
  }

  // Get call details from Analytics API
  const callDetails = await getCallDetails(callId);

  if (!callDetails.success) {
    console.warn('⚠️ Failed to get call details, using fallback logic');

    // Fallback: if we have talking_time in payload, use it
    const talkingTime = webhookPayload.talking_time;
    const isMissedFallback = !talkingTime || talkingTime === 0;

    return {
      success: false,
      status: isMissedFallback ? 'missed' : 'answered',
      isMissed: isMissedFallback,
      reason: 'Analytics API failed, used fallback logic',
      fallback: true,
      analyticsError: callDetails.error
    };
  }

  // Use real CloudTalk status
  const isMissed = isCallMissed(callDetails.status);

  return {
    success: true,
    status: callDetails.status,
    isMissed: isMissed,
    talkingTime: callDetails.talkingTime,
    totalTime: callDetails.totalTime,
    direction: callDetails.direction,
    recorded: callDetails.recorded,
    uuid: callDetails.uuid,
    reason: 'Real CloudTalk Analytics data'
  };
}

export default {
  getCallDetails,
  isCallMissed,
  analyzeCall
};