import 'dotenv/config';
import { log, logError } from '../logger.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

/**
 * Search for conversations by contact ID
 * @param {string} contactId - GHL Contact ID
 * @returns {Promise<{success: boolean, conversations?: array, error?: string}>}
 */
export async function searchConversations(contactId) {
  try {
    log(`🔍 Searching conversations for contact: ${contactId}`);

    const url = new URL(`${GHL_API_BASE}/conversations/search`);
    url.searchParams.append('contactId', contactId);
    url.searchParams.append('locationId', GHL_LOCATION_ID);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-04-15',
        'Content-Type': 'application/json'
      }
    });

    log(`Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    log(`✅ Found ${data.conversations?.length || 0} conversations`);
    if (data.conversations && data.conversations.length > 0) {
      log(`🔍 First conversation details:`, JSON.stringify(data.conversations[0], null, 2));
    }

    return {
      success: true,
      conversations: data.conversations || []
    };

  } catch (error) {
    logError(`❌ Error searching conversations: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload file attachment to GHL
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} conversationId - GHL Conversation ID
 * @param {string} contentType - MIME type
 * @returns {Promise<{success: boolean, fileUrl?: string, error?: string}>}
 */
export async function uploadFileAttachment(fileBuffer, filename, conversationId, contentType = 'audio/wav') {
  try {
    log(`📤 Uploading file: ${filename} (${fileBuffer.length} bytes) to conversation: ${conversationId}`);

    // Save buffer to temp file and use fs.createReadStream()
    const tempFilePath = `/tmp/ghl_upload_${Date.now()}_${filename}`;
    await (await import('fs')).default.promises.writeFile(tempFilePath, fileBuffer);

    const formData = new FormData();
    const fileStream = (await import('fs')).default.createReadStream(tempFilePath);
    formData.append('fileAttachment', fileStream);
    formData.append('conversationId', conversationId);

    const response = await fetch(`${GHL_API_BASE}/conversations/messages/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-04-15'
        // Note: Don't set Content-Type for FormData, let browser set it with boundary
      },
      body: formData
    });

    log(`Upload status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    log(`✅ File uploaded successfully`);
    log(`📎 File URL: ${data.url || data.fileUrl || 'URL not provided'}`);

    // Clean up temp file
    try {
      await (await import('fs')).default.promises.unlink(tempFilePath);
      log(`🗑️ Cleaned up temp file: ${tempFilePath}`);
    } catch (cleanupError) {
      log(`⚠️ Could not clean up temp file: ${cleanupError.message}`);
    }

    return {
      success: true,
      fileUrl: data.url || data.fileUrl,
      response: data
    };

  } catch (error) {
    logError(`❌ Error uploading file: ${error.message}`);

    // Clean up temp file even on error
    try {
      await (await import('fs')).default.promises.unlink(tempFilePath);
      log(`🗑️ Cleaned up temp file after error: ${tempFilePath}`);
    } catch (cleanupError) {
      log(`⚠️ Could not clean up temp file after error: ${cleanupError.message}`);
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send message with file attachment to conversation
 * @param {string} conversationId - GHL Conversation ID
 * @param {string} message - Text message
 * @param {string} fileUrl - Uploaded file URL
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendMessageWithAttachment(conversationId, message, fileUrl) {
  try {
    log(`💬 Sending message to conversation: ${conversationId}`);

    const response = await fetch(`${GHL_API_BASE}/conversations/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-04-15',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'text',
        message: message,
        conversationId: conversationId,
        attachments: fileUrl ? [fileUrl] : []
      })
    });

    log(`Message status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    log(`✅ Message sent successfully`);

    return {
      success: true,
      messageId: data.id,
      response: data
    };

  } catch (error) {
    logError(`❌ Error sending message: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send call data to GHL webhook
 * @param {string} conversationId - GHL Conversation ID
 * @param {string} conversationProviderId - GHL Conversation Provider ID
 * @param {string} transcriptionText - Transcription text
 * @param {string} callId - CloudTalk Call ID
 * @param {string} audioUrl - CloudTalk audio URL
 * @param {string} phoneNumber - External phone number
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendCallMessage(conversationId, conversationProviderId, transcriptionText, callId, audioUrl, phoneNumber) {
  try {
    log(`📞 ===== SENDING CALL DATA TO GHL WEBHOOK =====`);
    log(`📞 Conversation ID: ${conversationId}`);
    log(`📞 Call ID: ${callId}`);
    log(`📞 Audio URL: ${audioUrl}`);
    log(`📞 Phone Number: ${phoneNumber}`);

    const webhookUrl = 'https://services.leadconnectorhq.com/hooks/DfxGoORmPoL5Z1OcfYJM/webhook-trigger/fb9f35d9-7b38-472e-a8b4-cc8dcc9085ce';

    const webhookPayload = {
      type: 'call_record',
      callId: callId,
      conversationId: conversationId,
      conversationProviderId: conversationProviderId,
      phoneNumber: phoneNumber,
      audioUrl: audioUrl,
      transcription: transcriptionText,
      call: {
        to: phoneNumber,
        from: '+40312296109', // CloudTalk internal number
        status: 'completed'
      },
      timestamp: new Date().toISOString(),
      source: 'cloudtalk'
    };

    log(`📤 Webhook payload:`, JSON.stringify(webhookPayload, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });

    log(`Call message status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    log(`✅ Call message sent successfully`);

    return {
      success: true,
      messageId: data.id,
      response: data
    };

  } catch (error) {
    logError(`❌ Error sending call message: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Complete workflow: find conversation and send call message
 * @param {string} contactId - GHL Contact ID
 * @param {Buffer} audioBuffer - Audio file buffer (unused in this approach)
 * @param {string} transcriptionText - Transcription text
 * @param {string} callId - CloudTalk Call ID
 * @param {string} audioUrl - CloudTalk audio URL
 * @returns {Promise<{success: boolean, result?: object, error?: string}>}
 */
export async function uploadAudioToConversation(contactId, audioBuffer, transcriptionText, callId, audioUrl) {
  try {
    log(`🚀 Starting call message workflow for contact: ${contactId}`);

    // Step 1: Search for conversations
    log(`🔍 About to search conversations for contact: ${contactId}`);
    const conversationsResult = await searchConversations(contactId);
    log(`🔍 Conversations search result:`, JSON.stringify(conversationsResult, null, 2));
    if (!conversationsResult.success) {
      return {
        success: false,
        error: `Failed to search conversations: ${conversationsResult.error}`
      };
    }

    if (conversationsResult.conversations.length === 0) {
      log(`⚠️ No conversations found for contact ${contactId}`);
      return {
        success: false,
        error: 'No conversations found for this contact'
      };
    }

    // Use the first (most recent) conversation
    const conversation = conversationsResult.conversations[0];
    log(`📱 Using conversation: ${conversation.id}`);
    log(`📱 Conversation provider ID: ${conversation.lastMessageConversationProviderId || 'Not found'}`);

    // Step 2: Send call record with audio URL as attachment
    const messageResult = await sendCallMessage(
      conversation.id,
      conversation.lastMessageConversationProviderId,
      transcriptionText,
      callId,
      audioUrl,
      conversation.phone
    );

    if (!messageResult.success) {
      return {
        success: false,
        error: `Failed to send call message: ${messageResult.error}`
      };
    }

    log(`✅ Call message workflow completed successfully!`);

    return {
      success: true,
      result: {
        conversationId: conversation.id,
        messageId: messageResult.messageId,
        audioUrl: audioUrl
      }
    };

  } catch (error) {
    logError(`❌ Call message workflow failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  searchConversations,
  uploadFileAttachment,
  sendMessageWithAttachment,
  uploadAudioToConversation
};