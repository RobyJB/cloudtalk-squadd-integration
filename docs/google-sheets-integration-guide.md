# Google Sheets Integration Guide
## CloudTalk Call Tracking with Queue Management

This guide provides a complete implementation strategy for integrating Google Sheets with CloudTalk call tracking, featuring high-volume queue management for handling 20-50 simultaneous calls.

## 🏗️ Architecture Overview

```
CloudTalk Webhooks → Express Middleware → Queue Service → Google Apps Script → Google Sheets
        ↓                    ↓                   ↓              ↓              ↓
    call-started        Process &           In-memory      HTTP POST      Real-time
    call-ended          Validate            Queue          Request        Tracking
```

### Components

1. **CloudTalk Webhook Handlers** (`src/routes/cloudtalk-webhooks.js`)
   - Enhanced call-started and call-ended handlers
   - Automatic Google Sheets queue integration
   - Maintains existing GHL and Campaign Automation

2. **Queue Management Service** (`src/services/google-sheets-queue-service.js`)
   - In-memory queue with priority handling
   - Rate limiting (5 concurrent requests, 200ms delay)
   - Automatic retry with exponential backoff
   - Performance monitoring and health checks

3. **Google Apps Script** (`docs/google-apps-script-code.js`)
   - Handles call-started and call-ended events
   - Automatic row creation and updates
   - Proper data validation and error handling

4. **Enhanced Webhook Routes** (`src/routes/google-sheets-webhooks.js`)
   - Queue statistics and health monitoring
   - Test endpoints for validation
   - Legacy compatibility maintained

## 🚀 Quick Setup

### 1. Environment Configuration

Add to your `.env` file:

```bash
# Google Sheets Integration (REQUIRED)
GOOGLE_SHEETS_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec

# Optional: Queue Configuration (defaults shown)
GOOGLE_SHEETS_MAX_CONCURRENT=5
GOOGLE_SHEETS_REQUEST_DELAY=200
GOOGLE_SHEETS_MAX_RETRIES=3
```

### 2. Google Sheets Setup

1. **Create New Google Sheets Document**
   - Go to [sheets.google.com](https://sheets.google.com)
   - Create new spreadsheet
   - Name it "CloudTalk Call Tracking"
   - Copy the Sheets ID from URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`

2. **Deploy Google Apps Script**
   - Go to [script.google.com](https://script.google.com)
   - Create new project
   - Replace `Code.gs` content with `/docs/google-apps-script-code.js`
   - Update `SHEET_ID` constant with your Google Sheets ID
   - Deploy as Web App:
     - Execute as: **Me**
     - Who has access: **Anyone**
   - Copy the Web App URL and set as `GOOGLE_SHEETS_APPS_SCRIPT_URL`

### 3. Test Integration

```bash
# Start the middleware
npm run dev

# Test queue functionality
curl -X POST http://localhost:3000/api/google-sheets-webhooks/test

# Check queue health
curl http://localhost:3000/api/google-sheets-webhooks/health

# Monitor queue statistics
curl http://localhost:3000/api/google-sheets-webhooks/queue-stats
```

## 📊 Google Sheets Structure

The integration creates the following columns automatically:

| Column | Field | Description |
|--------|-------|-------------|
| A | Timestamp | When the event occurred |
| B | Call UUID | Unique call identifier |
| C | Call ID | CloudTalk call ID |
| D | External Number | Lead's phone number |
| E | Contact Name | Contact name from CloudTalk |
| F | Agent Name | Agent first + last name |
| G | Agent ID | CloudTalk agent ID |
| H | Internal Number | Agent's extension |
| I | Call Status | started/ended |
| J | Call Started | Start timestamp |
| K | Call Ended | End timestamp |
| L | Talking Time | Duration in seconds |
| M | Waiting Time | Wait time in seconds |
| N | Process Type | call_tracking |
| O | Source | CloudTalk |
| P | Webhook Type | call-started/call-ended |
| Q | Created At | Row creation time |
| R | Notes | Additional information |

## 🔄 Webhook Flow

### Call Started Flow

```
CloudTalk → /api/cloudtalk-webhooks/call-started
    ↓
1. Validate webhook (deduplication check)
2. Save payload to webhook-payloads/
3. Queue Google Sheets update (Priority 1)
4. Process existing GHL integration
5. Mark webhook as processed
6. Return success response
```

### Call Ended Flow

```
CloudTalk → /api/cloudtalk-webhooks/call-ended
    ↓
1. Validate webhook (deduplication check)
2. Save payload to webhook-payloads/
3. Queue Google Sheets update (Priority 1)
4. Process Campaign Automation
5. Process existing GHL integration
6. Mark webhook as processed
7. Return success response
```

## 📈 Queue Management Features

### High-Volume Support
- **Concurrent Processing**: 5 simultaneous Google Sheets requests
- **Queue Prioritization**: Call events get priority 1 (highest)
- **Rate Limiting**: 200ms delay between requests
- **Retry Logic**: 3 attempts with exponential backoff

### Performance Monitoring
- **Real-time Statistics**: Queue size, processing rate, success rate
- **Health Checks**: Service health with performance metrics
- **Error Tracking**: Failed requests with detailed error messages
- **Processing Time**: Average response time monitoring

### Data Handling
- **Call Matching**: Automatic call-ended updates to existing rows
- **Missing Events**: Creates new rows if call-started missed
- **Data Validation**: Required field checking and data sanitization
- **Flexible Schema**: Handles both known and unknown data formats

## 🛠️ API Endpoints

### Queue Management Endpoints

#### GET /api/google-sheets-webhooks/health
Comprehensive health check with queue status:

```json
{
  "service": "Google Sheets Webhooks with Queue Management",
  "status": "healthy|degraded",
  "queue": {
    "size": 0,
    "processing": true,
    "activeRequests": 2,
    "maxConcurrent": 5
  },
  "performance": {
    "processed": 150,
    "failed": 2,
    "successRate": 98.68,
    "averageProcessingTime": 1250
  }
}
```

#### GET /api/google-sheets-webhooks/queue-stats
Detailed queue statistics:

```json
{
  "queue": {
    "current_size": 3,
    "active_requests": 1,
    "max_concurrent": 5,
    "processing": true
  },
  "performance": {
    "total_processed": 1247,
    "total_failed": 12,
    "success_rate": 99.05,
    "average_processing_time_ms": 1180
  }
}
```

#### POST /api/google-sheets-webhooks/test
Queue-based testing endpoint:

```json
{
  "success": true,
  "message": "Test calls queued for Google Sheets processing",
  "queue_ids": {
    "started": "test-uuid-123_call-started_456",
    "ended": "test-uuid-124_call-ended_457"
  },
  "note": "Check /api/google-sheets-webhooks/queue-stats for processing status"
}
```

### CloudTalk Webhook Endpoints (Enhanced)

#### POST /api/cloudtalk-webhooks/call-started
Enhanced with Google Sheets tracking:

```json
{
  "success": true,
  "message": "CloudTalk call-started webhook processed with Google Sheets tracking",
  "googleSheetsTracking": {
    "success": true,
    "queueId": "25659dac-df5b-4269-818e-267a5d5fcadf_call-started_123",
    "message": "Call started queued for Google Sheets tracking"
  },
  "ghlIntegration": { "success": true },
  "contact": { "id": "contact123", "name": "Roberto Bondici" }
}
```

#### POST /api/cloudtalk-webhooks/call-ended
Enhanced with Google Sheets tracking and Campaign Automation:

```json
{
  "success": true,
  "message": "CloudTalk call-ended webhook processed with Google Sheets tracking and Campaign Automation",
  "googleSheetsTracking": {
    "success": true,
    "queueId": "25659dac-df5b-4269-818e-267a5d5fcadf_call-ended_124"
  },
  "campaignAutomation": { "success": true },
  "ghlIntegration": { "success": true }
}
```

## 🔧 Configuration Options

### Queue Service Configuration

You can customize queue behavior by modifying `src/services/google-sheets-queue-service.js`:

```javascript
// Queue configuration
this.maxConcurrentRequests = 5; // Concurrent Google Sheets requests
this.requestDelay = 200; // Delay between requests (ms)

// Retry configuration
this.maxRetries = 3; // Maximum retry attempts
this.baseRetryDelay = 1000; // Base retry delay (ms)
```

### Google Apps Script Configuration

Update constants in the Google Apps Script:

```javascript
const SHEET_ID = 'YOUR_GOOGLE_SHEETS_ID_HERE';
const SHEET_NAME = 'Call Tracking';
```

## 🚨 Error Handling

### Common Issues and Solutions

#### 1. Google Sheets URL Not Configured
```
Error: GOOGLE_SHEETS_APPS_SCRIPT_URL not configured
Solution: Set the environment variable with your Apps Script URL
```

#### 2. Queue Processing Slow
```
Problem: High queue size, slow processing
Solutions:
- Increase maxConcurrentRequests (up to 10)
- Decrease requestDelay (minimum 100ms)
- Check Google Apps Script performance
```

#### 3. Google Sheets Access Denied
```
Problem: 403 Forbidden from Google Apps Script
Solutions:
- Redeploy Apps Script with correct permissions
- Ensure "Anyone" access is enabled
- Check Google account permissions
```

#### 4. Webhook Duplicates
```
Problem: Duplicate rows in Google Sheets
Solution: Webhook deduplication is handled automatically via:
- UUID-based duplicate checking
- Processed webhook tracking
```

## 📊 Performance Optimization

### For High Call Volumes (50+ calls)

1. **Increase Concurrency**:
   ```javascript
   this.maxConcurrentRequests = 10; // Up from 5
   this.requestDelay = 100; // Down from 200ms
   ```

2. **Batch Processing** (Future Enhancement):
   - Collect multiple calls and send in batches
   - Reduce API calls to Google Sheets
   - Implement in queue service

3. **Database Caching** (Future Enhancement):
   - Cache failed requests in SQLite
   - Retry failed requests during low-traffic periods

### For Google Sheets Performance

1. **Use Batch Operations** in Apps Script:
   ```javascript
   // Instead of single cell updates
   sheet.getRange(row, 9, 1, 4).setValues([[status, endTime, talking, waiting]]);
   ```

2. **Index Optimization**:
   - Keep Call UUID (Column B) for fast lookups
   - Consider separate sheets for different time periods

## 🧪 Testing Strategy

### 1. Unit Testing

Test individual components:

```bash
# Test queue service directly
node -e "
import('./src/services/google-sheets-queue-service.js').then(service => {
  const queueId = service.default.enqueue({
    call_uuid: 'test-123',
    external_number: '+1234567890'
  }, 'call-started', 1);
  console.log('Queued:', queueId);
});
"
```

### 2. Integration Testing

```bash
# Test full CloudTalk webhook flow
curl -X POST http://localhost:3000/api/cloudtalk-webhooks/call-started \
  -H "Content-Type: application/json" \
  -d '{
    "call_uuid": "test-webhook-123",
    "external_number": "+393513416607",
    "contact_name": "Test Contact",
    "agent_first_name": "Roberto",
    "agent_last_name": "Bondici",
    "agent_id": 493933,
    "internal_number": "393520441984"
  }'

# Wait a few seconds then test call-ended
curl -X POST http://localhost:3000/api/cloudtalk-webhooks/call-ended \
  -H "Content-Type: application/json" \
  -d '{
    "call_uuid": "test-webhook-123",
    "call_id": 999999999,
    "external_number": "+393513416607",
    "agent_first_name": "Roberto",
    "agent_last_name": "Bondici",
    "agent_id": 493933,
    "talking_time": 45,
    "waiting_time": 12
  }'
```

### 3. Load Testing

Simulate high-volume calls:

```bash
# Create test script to simulate 20 simultaneous calls
for i in {1..20}; do
  curl -X POST http://localhost:3000/api/cloudtalk-webhooks/call-started \
    -H "Content-Type: application/json" \
    -d "{
      \"call_uuid\": \"load-test-$i\",
      \"external_number\": \"+39351341660$i\",
      \"contact_name\": \"Load Test Contact $i\",
      \"agent_first_name\": \"Roberto\",
      \"agent_last_name\": \"Bondici\"
    }" &
done

# Check queue status
sleep 2
curl http://localhost:3000/api/google-sheets-webhooks/queue-stats
```

## 🔒 Security Considerations

### Google Apps Script Security

1. **Access Control**: Web App is set to "Anyone" for CloudTalk access
2. **Data Validation**: Input sanitization in Apps Script
3. **Rate Limiting**: Built-in protection against abuse

### Webhook Security

1. **Payload Logging**: All webhooks logged for audit
2. **Deduplication**: Prevents replay attacks
3. **Error Handling**: No sensitive data in error responses

## 📝 Deployment Checklist

- [ ] Google Sheets document created
- [ ] Google Apps Script deployed with correct SHEET_ID
- [ ] GOOGLE_SHEETS_APPS_SCRIPT_URL environment variable set
- [ ] Webhook endpoints tested with CloudTalk
- [ ] Queue health monitoring configured
- [ ] Performance metrics baseline established
- [ ] Error alerting configured (if needed)
- [ ] Documentation updated with actual URLs and IDs

## 🔄 Future Enhancements

### Planned Features

1. **Batch Processing**: Collect multiple calls and send in batches
2. **Database Persistence**: SQLite backup for failed requests
3. **Real-time Dashboard**: Live queue monitoring interface
4. **Advanced Analytics**: Call pattern analysis and reporting
5. **Multi-Sheet Support**: Separate sheets by agent/campaign
6. **Webhook Replay**: Re-process failed webhooks
7. **Custom Field Mapping**: Configurable data field mapping

### Integration Opportunities

1. **CloudTalk API Enrichment**: Add call details from CloudTalk API
2. **GoHighLevel Sync**: Bidirectional contact synchronization
3. **Campaign Analytics**: Integration with campaign performance data
4. **Call Recording Links**: Direct links to call recordings
5. **AI Analysis Integration**: Include transcription and analysis data

## 📞 Support

For issues with this integration:

1. **Check Logs**: Review console output and webhook-payloads directory
2. **Monitor Queue**: Use `/api/google-sheets-webhooks/health` endpoint
3. **Test Components**: Use test endpoints to isolate issues
4. **Google Apps Script Logs**: Check execution transcript in Apps Script editor

The integration is designed to be robust and handle high-volume call tracking while maintaining the existing CloudTalk → GoHighLevel integration functionality.