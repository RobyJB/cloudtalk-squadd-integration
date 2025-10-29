# GoHighLevel Contact Export System - Implementation Plan

## 1. Available GHL Contact API Endpoints

Based on the `@gohighlevel/api-client` package analysis:

### Primary Endpoints for Contact Export
1. **`searchContactsAdvanced()`** - POST /contacts/search
   - Supports advanced filtering and pagination
   - Returns contact data with all fields
   - Current usage in project: `API Squadd/tests/search-contacts.js`

2. **`getContacts()`** - GET /contacts (DEPRECATED)
   - Legacy endpoint, not recommended for new implementations
   - Use searchContactsAdvanced instead

3. **`getContact(contactId)`** - GET /contacts/:contactId
   - Retrieve single contact details
   - Useful for updates and verification

4. **`getContactsByBusinessId()`** - GET /businesses/:businessId/contacts
   - Retrieve contacts grouped by business
   - Useful for segmented exports

### Supporting Endpoints
- **`getAllNotes(contactId)`** - Retrieve contact notes
- **`getAllTasks(contactId)`** - Retrieve contact tasks
- **`getAppointmentsForContact(contactId)`** - Retrieve appointments

## 2. Proposed SQLite Schema for Contacts

```sql
-- Main contacts table
CREATE TABLE IF NOT EXISTS ghl_contacts (
    id TEXT PRIMARY KEY,                    -- GHL contact ID
    location_id TEXT NOT NULL,              -- GHL location ID

    -- Basic Information
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    phone_label TEXT,

    -- Additional Contact Info
    additional_emails TEXT,                 -- JSON array
    additional_phones TEXT,                 -- JSON array

    -- Address Information
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    postal_code TEXT,

    -- Business Information
    business_id TEXT,
    business_name TEXT,
    company_name TEXT,
    website TEXT,

    -- Contact Properties
    type TEXT,                              -- 'lead' or 'contact'
    source TEXT,                            -- Lead source (Facebook, etc.)
    assigned_to TEXT,                       -- User ID assigned to
    followers TEXT,                         -- JSON array of follower IDs

    -- Communication Preferences
    dnd BOOLEAN DEFAULT 0,                  -- Do Not Disturb
    valid_email BOOLEAN,

    -- Custom Fields
    custom_fields TEXT,                     -- JSON object
    tags TEXT,                              -- JSON array

    -- Dates
    date_of_birth TEXT,
    date_added DATETIME,
    date_updated DATETIME,

    -- Local tracking
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    local_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_status TEXT DEFAULT 'synced',     -- 'synced', 'pending', 'error'
    sync_error TEXT,

    -- Indexes
    INDEX idx_location_id (location_id),
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_type (type),
    INDEX idx_sync_status (sync_status),
    INDEX idx_date_updated (date_updated)
);

-- Opportunities table (related to contacts)
CREATE TABLE IF NOT EXISTS ghl_opportunities (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL,
    pipeline_id TEXT,
    pipeline_stage_id TEXT,
    monetary_value DECIMAL(15,2),
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES ghl_contacts(id) ON DELETE CASCADE,
    INDEX idx_contact_id (contact_id),
    INDEX idx_status (status)
);

-- Contact notes table (optional, for full sync)
CREATE TABLE IF NOT EXISTS ghl_contact_notes (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL,
    body TEXT,
    user_id TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (contact_id) REFERENCES ghl_contacts(id) ON DELETE CASCADE,
    INDEX idx_contact_id (contact_id)
);

-- Sync log table for tracking export operations
CREATE TABLE IF NOT EXISTS ghl_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL,               -- 'full', 'incremental', 'single'
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status TEXT DEFAULT 'running',         -- 'running', 'completed', 'failed'
    total_contacts INTEGER,
    processed_contacts INTEGER,
    error_count INTEGER DEFAULT 0,
    error_details TEXT,
    metadata TEXT                          -- JSON with additional info
);
```

## 3. Contact Data Fields Mapping

Based on the API response analysis:

| GHL Field | SQLite Column | Data Type | Notes |
|-----------|---------------|-----------|-------|
| id | id | TEXT | Primary key |
| firstName | first_name | TEXT | |
| lastName | last_name | TEXT | |
| email | email | TEXT | Indexed |
| phone | phone | TEXT | Indexed |
| phoneLabel | phone_label | TEXT | |
| additionalEmails | additional_emails | TEXT | JSON array |
| additionalPhones | additional_phones | TEXT | JSON array |
| address | address | TEXT | |
| city | city | TEXT | |
| state | state | TEXT | |
| country | country | TEXT | ISO code |
| postalCode | postal_code | TEXT | |
| businessId | business_id | TEXT | |
| businessName | business_name | TEXT | |
| companyName | company_name | TEXT | |
| website | website | TEXT | |
| type | type | TEXT | 'lead' or 'contact' |
| source | source | TEXT | Lead source |
| assignedTo | assigned_to | TEXT | User ID |
| followers | followers | TEXT | JSON array |
| dnd | dnd | BOOLEAN | |
| validEmail | valid_email | BOOLEAN | |
| customFields | custom_fields | TEXT | JSON array of objects |
| tags | tags | TEXT | JSON array |
| dateOfBirth | date_of_birth | TEXT | |
| dateAdded | date_added | DATETIME | |
| dateUpdated | date_updated | DATETIME | |
| opportunities | - | - | Stored in separate table |

## 4. Service Architecture Design

```javascript
// File structure
src/services/
├── ghl-contact-export-service.js      // Main export service
├── ghl-contact-database.js            // Database operations for GHL contacts
└── ghl-api-client.js                  // GHL API wrapper

// Key Components:

1. GHLContactExportService
   - exportAllContacts()               // Full export
   - exportContactsByDateRange()       // Incremental export
   - exportSingleContact()             // Single contact export
   - syncContacts()                    // Bidirectional sync

2. GHLContactDatabase (extends Database)
   - initGHLTables()                  // Create GHL-specific tables
   - upsertContact()                  // Insert or update contact
   - bulkUpsertContacts()             // Batch operations
   - getContactsBySyncStatus()        // Query by sync status
   - markContactsSynced()             // Update sync status

3. GHLAPIClient
   - searchContacts()                 // Paginated search
   - getContactDetails()              // Single contact with relations
   - handlePagination()              // Automatic pagination handling
   - rateLimitedRequest()             // Rate limit management
```

## 5. Implementation Plan

### Phase 1: Database Setup
```javascript
// src/services/ghl-contact-database.js
import Database from './database.js';

class GHLContactDatabase extends Database {
  async initGHLTables() {
    // Create tables as defined in schema
  }

  async upsertContact(contact) {
    // Insert or update single contact
  }

  async bulkUpsertContacts(contacts) {
    // Batch insert/update with transaction
  }
}
```

### Phase 2: API Client Wrapper
```javascript
// src/services/ghl-api-client.js
class GHLAPIClient {
  constructor(apiKey, locationId) {
    this.apiKey = apiKey;
    this.locationId = locationId;
    this.baseUrl = 'https://services.leadconnectorhq.com';
  }

  async searchContacts(options = {}) {
    // Implement paginated search
  }

  async *contactsIterator(options = {}) {
    // Generator for handling large datasets
    let hasMore = true;
    let nextPage = null;

    while (hasMore) {
      const result = await this.searchContacts({
        ...options,
        startAfterId: nextPage
      });

      yield result.contacts;

      hasMore = result.nextPage !== undefined;
      nextPage = result.nextPage;
    }
  }
}
```

### Phase 3: Export Service
```javascript
// src/services/ghl-contact-export-service.js
class GHLContactExportService {
  constructor(apiClient, database) {
    this.api = apiClient;
    this.db = database;
  }

  async exportAllContacts() {
    const syncLog = await this.db.startSyncLog('full');
    let processed = 0;

    try {
      for await (const batch of this.api.contactsIterator()) {
        await this.db.bulkUpsertContacts(batch);
        processed += batch.length;

        // Update progress
        await this.db.updateSyncLog(syncLog.id, {
          processed_contacts: processed
        });
      }

      await this.db.completeSyncLog(syncLog.id, 'completed');
    } catch (error) {
      await this.db.completeSyncLog(syncLog.id, 'failed', error);
      throw error;
    }
  }
}
```

## 6. Rate Limiting & Pagination Strategy

### Rate Limiting
- GHL API has rate limits (check headers: `x-ratelimit-remaining`)
- Implement exponential backoff for 429 responses
- Use queue system for batch operations

### Pagination Approach
```javascript
// Cursor-based pagination using searchAfter
const paginationOptions = {
  pageLimit: 100,              // Max 100 per request
  startAfterId: null,          // Initial null
  startAfter: null            // Timestamp for time-based pagination
};

// Handle pagination in batches
while (hasMorePages) {
  const response = await api.searchContacts({
    locationId,
    pageLimit: 100,
    startAfterId: lastContactId
  });

  // Process batch
  await processBatch(response.contacts);

  // Update pagination
  hasMorePages = response.contacts.length === 100;
  lastContactId = response.contacts[response.contacts.length - 1]?.id;
}
```

### Performance Considerations
1. **Batch Size**: Use 100 contacts per API request (maximum allowed)
2. **Database Transactions**: Insert in batches of 500-1000 records
3. **Memory Management**: Use streaming/generators for large datasets
4. **Concurrent Requests**: Limit to 2-3 concurrent API requests
5. **Progress Tracking**: Update sync log every 100 processed contacts

## 7. Error Handling & Recovery

### Error Types
1. **API Errors**
   - 401: Invalid authentication
   - 403: No access to location
   - 429: Rate limit exceeded
   - 500: Server errors

2. **Data Errors**
   - Invalid/malformed contact data
   - Duplicate key violations
   - Foreign key constraints

3. **Network Errors**
   - Timeouts
   - Connection errors

### Recovery Strategy
```javascript
class ExportWithRetry {
  async exportWithRetry(contactId, maxRetries = 3) {
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await this.exportContact(contactId);
      } catch (error) {
        attempt++;

        if (error.statusCode === 429) {
          // Rate limit - exponential backoff
          await this.delay(Math.pow(2, attempt) * 1000);
        } else if (error.statusCode >= 500) {
          // Server error - retry with delay
          await this.delay(5000);
        } else {
          // Client error - don't retry
          throw error;
        }
      }
    }
  }
}
```

## 8. Usage Examples

### Full Export
```javascript
import GHLContactExportService from './services/ghl-contact-export-service.js';

const exporter = new GHLContactExportService();
await exporter.exportAllContacts();
console.log('Export completed');
```

### Incremental Sync
```javascript
// Export contacts updated in last 24 hours
const yesterday = new Date(Date.now() - 24*60*60*1000);
await exporter.exportContactsByDateRange(yesterday, new Date());
```

### Query Exported Data
```javascript
// Get all contacts from SQLite
const contacts = await db.query(`
  SELECT * FROM ghl_contacts
  WHERE type = 'lead'
  AND date_added > date('now', '-7 days')
`);
```

## 9. Testing Approach

1. **Unit Tests**
   - Database operations
   - API client methods
   - Data transformation

2. **Integration Tests**
   - API connection with real credentials
   - Database transactions
   - Error recovery

3. **Load Tests**
   - Handle 20,000+ contacts
   - Memory usage monitoring
   - Performance benchmarks

## 10. Deployment Considerations

1. **Environment Variables**
   ```env
   GHL_API_KEY=your_key
   GHL_LOCATION_ID=your_location_id
   GHL_SYNC_ENABLED=true
   GHL_SYNC_INTERVAL=3600000  # 1 hour in ms
   ```

2. **Cron Job for Sync**
   ```javascript
   // Run hourly sync
   setInterval(async () => {
     await exporter.incrementalSync();
   }, process.env.GHL_SYNC_INTERVAL);
   ```

3. **Database Maintenance**
   - Regular VACUUM operations
   - Index optimization
   - Old sync log cleanup