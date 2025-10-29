# 🧪 Test Import - Guida Completa

## 🎯 Cosa Fa

Questo test:
1. **Svuota** il database (con backup automatico)
2. **Ricrea** database vuoto con schema base
3. **Importa 10 contatti** da GHL API
4. **Analizza custom fields** automaticamente
5. **Aggiunge colonne** dinamicamente
6. **Popola tutto** correttamente
7. **Verifica** i risultati

---

## 🚀 COMANDI DA ESEGUIRE

### 1️⃣ Reset Database (Svuota e Ricrea)

```bash
node scripts/reset-database.js
```

**Output atteso:**
```
================================================================================
🗑️  DATABASE RESET
================================================================================

💾 Step 1: Backing up existing database...

  ✅ Backup created: ghl_contacts/backups/ghl_contacts_2025-10-27...db
  📊 Size: 0.25 MB

🗑️  Step 2: Deleting old database...

  ✅ Old database deleted.

🏗️  Step 3: Creating fresh database with schema...

  ✅ Created table: ghl_contacts
  ✅ Created table: ghl_opportunities
  ✅ Created table: ghl_contact_notes
  ✅ Created table: ghl_sync_log
  ✅ Created table: custom_fields_metadata
  ✅ Created indexes

🎉 Fresh database created successfully!

================================================================================
✅ DATABASE RESET COMPLETE!
================================================================================

📊 Database is now empty and ready for import.
```

---

### 2️⃣ Test Import (10 Contatti)

```bash
node scripts/test-import.js 10
```

**Parametro opzionale**: `10` = numero contatti da importare (default: 10)

**Output atteso:**
```
================================================================================
🧪 TEST IMPORT
================================================================================

📊 Importing 10 contacts for testing...

🌐 Step 1: Fetching contacts from GHL API...

  ✅ Fetched 10 contacts

🔍 Analyzing custom fields...

  🆕 Found 4 new custom fields

  ✅ Added column: cf_bBUMgopGjt62qji3KuBP TEXT
  ✅ Added column: cf_OvycNhr7O63M1udF3mWj TEXT
  ✅ Added column: cf_yo2pbUHvfqxBUFzVoH1D TEXT
  ✅ Added column: cf_TX3ddYyNVlvExyE5YG1H REAL

💾 Importing contacts to database...

  ✅ Imported: Giuseppe Quaresima (giuseppequaresima@yahoo.it)
  ✅ Imported: Gianpaolo 800 (parisigianpaolo@icloud.com)
  ✅ Imported: Jubil Kurian (jubilkurian26@gmail.com)
  [... altri 7 contatti ...]

📊 Import Summary:
   Imported: 10
   Errors: 0

🔍 Fetching opportunities for contacts...

  ✅ Fetched 1 opportunities for contact 921aSiBD19GEqqrsGhbh
  ✅ Fetched 1 opportunities for contact gafermTDxjm913eqkXMC
  [... altri contatti ...]

🔍 Verifying imported data...

📊 Database Statistics:
   Contacts: 10
   Opportunities: 8
   Custom Fields: 4

📄 Sample contact with custom fields:
┌──────────────────────┬────────────┬───────────┬─────────────────────────┬────────────────┐
│ id                   │ first_name │ last_name │ email                   │ cf_bBUMgopGjt  │
├──────────────────────┼────────────┼───────────┼─────────────────────────┼────────────────┤
│ 921aSiBD19GEqqrsGhbh │ Giuseppe   │ Quaresima │ giuseppequaresima@...   │ ["Gestire..."] │
└──────────────────────┴────────────┴───────────┴─────────────────────────┴────────────────┘

✅ Verification complete!

================================================================================
✅ TEST IMPORT COMPLETE!
================================================================================
```

---

## 🔍 Verificare i Risultati

### Opzione 1: lazysql (Visuale)

```bash
lazysql sqlite://./ghl_contacts/ghl_contacts.db
```

### Opzione 2: sqlite3 CLI

```bash
# Vedere struttura tabella
sqlite3 ghl_contacts/ghl_contacts.db "PRAGMA table_info(ghl_contacts);"

# Vedere solo custom fields
sqlite3 ghl_contacts/ghl_contacts.db "PRAGMA table_info(ghl_contacts);" | grep cf_

# Contare contatti
sqlite3 ghl_contacts/ghl_contacts.db "SELECT COUNT(*) FROM ghl_contacts;"

# Query esempio
sqlite3 ghl_contacts/ghl_contacts.db "SELECT id, first_name, last_name, email FROM ghl_contacts LIMIT 5;" -header -column
```

---

## ⚙️ Cosa Succede Dietro le Quinte

### Reset Database
1. **Backup** del DB esistente → `ghl_contacts/backups/`
2. **Cancellazione** DB vecchio
3. **Creazione** schema base:
   - `ghl_contacts` (senza custom fields ancora)
   - `ghl_opportunities` (schema completo)
   - `ghl_contact_notes`
   - `ghl_sync_log`
   - `custom_fields_metadata` (traccia colonne dinamiche)

### Test Import
1. **Fetch 10 contatti** da GHL API con rate limiting (7 req/sec)
2. **Analisi custom fields**:
   - Scansiona tutti i custom fields nei contatti
   - Determina tipo di dato (TEXT, REAL, INTEGER)
   - Genera nome colonna (`cf_` + field_id)
3. **Aggiunta colonne dinamica**:
   - `ALTER TABLE ghl_contacts ADD COLUMN cf_xxx TEXT`
   - Salva metadata in `custom_fields_metadata`
4. **Import dati**:
   - Popola campi base (nome, email, phone, ecc.)
   - Popola colonne custom fields individuali
   - Mantiene JSON originale in `custom_fields` (backward compat)
5. **Fetch opportunità** per ogni contatto
6. **Verifica** e statistiche

---

## 📊 Schema Database Risultante

```sql
-- PRIMA (Schema Base)
ghl_contacts (
  id, location_id, first_name, last_name, email, phone,
  custom_fields TEXT  -- JSON blob
)

-- DOPO (Schema + Custom Fields Dinamici)
ghl_contacts (
  id, location_id, first_name, last_name, email, phone,
  custom_fields TEXT,  -- JSON originale (mantenuto)
  cf_bBUMgopGjt62qji3KuBP TEXT,  -- Dinamico!
  cf_OvycNhr7O63M1udF3mWj TEXT,  -- Dinamico!
  cf_yo2pbUHvfqxBUFzVoH1D TEXT,  -- Dinamico!
  cf_TX3ddYyNVlvExyE5YG1H REAL   -- Dinamico!
)

-- Tabella metadata
custom_fields_metadata (
  field_id TEXT,      -- es: "bBUMgopGjt62qji3KuBP"
  column_name TEXT,   -- es: "cf_bBUMgopGjt62qji3KuBP"
  sql_type TEXT,      -- es: "TEXT"
  data_type TEXT      -- es: "array,string"
)
```

---

## ⚡ Rate Limiting

Il test usa il **rate limiter avanzato**:
- ✅ Max 7 richieste/secondo (sicuro entro limite 100/10sec GHL)
- ✅ Retry automatico su 429 errors (fino a 5 tentativi)
- ✅ Exponential backoff
- ✅ Finestra scorrevole 10 secondi

---

## 🎯 Se il Test Va Bene

Dopo aver verificato che tutto funziona con 10 contatti, puoi:

### Import Completo (Tutti i 21K Contatti)

```bash
# Opzione 1: Usando il test-import con limite alto
node scripts/test-import.js 21678

# Opzione 2: Aggiornare il CLI esistente (da fare)
node ghl-export-cli.js export-all
```

**Tempo stimato per 21K contatti**: ~40-60 minuti (con rate limiting sicuro)

---

## 🔧 Varianti Test

```bash
# Test con 5 contatti
node scripts/test-import.js 5

# Test con 20 contatti
node scripts/test-import.js 20

# Test con 100 contatti
node scripts/test-import.js 100
```

---

## ⚠️ Note Importanti

1. **Backup automatico**: `reset-database.js` crea sempre backup prima di cancellare
2. **Idempotente**: `test-import.js` può essere eseguito più volte (INSERT OR REPLACE)
3. **Rate limiting**: Rispetta i limiti GHL automaticamente
4. **Errori 429**: Retry automatico con backoff esponenziale
5. **Custom fields dinamici**: Colonne aggiunte al volo durante l'import

---

## 🐛 Troubleshooting

### Database locked
```bash
# Chiudi tutte le connessioni aperte (lazysql, ecc.)
pkill -f lazysql
# Riprova
```

### API Key non valida
```bash
# Verifica .env
cat .env | grep GHL_API_KEY
# Dovrebbe mostrare la tua chiave
```

### Nessun contatto trovato
```bash
# Testa connessione API
node -e "
import GHLAPIClient from './src/services/ghl-api-client.js';
const client = new GHLAPIClient();
const result = await client.testConnection();
console.log(result);
"
```

---

## ✅ Checklist Test

- [ ] Eseguito `node scripts/reset-database.js`
- [ ] Database svuotato e ricreato
- [ ] Backup creato in `ghl_contacts/backups/`
- [ ] Eseguito `node scripts/test-import.js 10`
- [ ] Importati 10 contatti
- [ ] Custom fields aggiunti come colonne
- [ ] Opportunità importate
- [ ] Verificato con lazysql o sqlite3
- [ ] Tutto funziona correttamente ✨

---

## 📁 File del Sistema

```
scripts/
├── reset-database.js      ← Svuota e ricrea DB
├── test-import.js         ← Test import 10 contatti
├── analyze-custom-fields.js
├── migrate-custom-fields-to-columns.js
├── restructure-database.js
└── README.md

src/services/
├── ghl-api-client.js      ← Client API GHL
├── ghl-rate-limiter.js    ← Rate limiter 7 req/sec
└── ...

ghl_contacts/
├── ghl_contacts.db        ← Database principale
└── backups/               ← Backup automatici
    └── ghl_contacts_2025-10-27...db
```
