# 🔧 Guida alla Ristrutturazione Database GHL

## 📊 Situazione Attuale vs Obiettivo

### ❌ Prima (Situazione Attuale)
```
ghl_contacts:
  - custom_fields: TEXT -> JSON: [{"id":"xxx", "value":"..."}]

ghl_opportunities:
  - Mancano campi: name, pipeline_name, stage_name, custom_fields, ecc.
```

### ✅ Dopo (Obiettivo)
```
ghl_contacts:
  - cf_bBUMgopGjt62qji3KuBP: TEXT
  - cf_OvycNhr7O63M1udF3mWj: TEXT
  - cf_yo2pbUHvfqxBUFzVoH1D: TEXT
  - cf_TX3ddYyNVlvExyE5YG1H: REAL
  - ... (una colonna per ogni custom field)

ghl_opportunities:
  - Tutti i campi necessari: name, pipeline_name, stage_name, custom_fields, tags, ecc.
```

## 🚀 Comandi di Esecuzione

### Passo 1: Backup Database (OBBLIGATORIO)

```bash
./scripts/backup-database.sh
```

Questo crea un backup in `ghl_contacts/backups/ghl_contacts_YYYYMMDD_HHMMSS.db`

### Passo 2: Ristrutturazione Completa

```bash
node scripts/restructure-database.js
```

Questo script esegue automaticamente:
1. **Analisi** dei custom fields nei dati esistenti
2. **Migliora** la tabella opportunità con nuove colonne
3. **Migra** i custom fields dei contatti da JSON a colonne individuali
4. **Verifica** che tutto sia andato a buon fine

## ⏱️ Tempo Stimato

- 680 contatti: **~10-15 secondi**
- 21,678 contatti: **~2-3 minuti**

## 📋 Output Atteso

```
================================================================================
🔧 GHL DATABASE RESTRUCTURING
================================================================================

📂 Database: /Users/robertobondici/projects/api-middleware/ghl_contacts/ghl_contacts.db

📊 STEP 1: Analyzing Custom Fields

🔍 Analyzing custom fields from existing contacts...

📊 Found 680 contacts with custom fields

📋 Custom Fields Analysis Report
================================================================================

1. Field ID: bBUMgopGjt62qji3KuBP
   Occurrences: 450
   Types: array
   Primary Type: array_of_strings
   Suggested SQL Type: TEXT
   Sample Values:
     1. ["Gestire e comunicare meglio con i miei clienti"]

2. Field ID: OvycNhr7O63M1udF3mWj
   Occurrences: 450
   Types: string
   Primary Type: string
   Suggested SQL Type: TEXT
   Sample Values:
     1. "Sono un libero professionista."

[... più custom fields ...]

💾 Analysis saved to: /Users/robertobondici/projects/api-middleware/scripts/custom-fields-analysis.json

================================================================================
🔧 STEP 2: Enhancing Opportunities Table

  ✅ Added name TEXT
  ✅ Added pipeline_name TEXT
  ✅ Added stage_name TEXT
  [...]

📊 Summary: 10 columns added, 0 skipped

================================================================================
🔄 STEP 3: Migrating Contact Custom Fields to Columns

🔧 Step 1: Adding new columns to ghl_contacts table...

  ✅ Added cf_bBUMgopGjt62qji3KuBP TEXT
  ✅ Added cf_OvycNhr7O63M1udF3mWj TEXT
  [...]

📊 Summary: 15 columns added, 0 skipped

🔄 Step 2: Migrating data from JSON to individual columns...

📦 Processing 680 contacts...

  📝 Processed 100/680 contacts...
  📝 Processed 200/680 contacts...
  [...]

✅ Migration complete!
   Processed: 680
   Errors: 0

🔍 Step 3: Verifying migration...

Sample migrated data:
┌────────────┬─────────────┬────────────┬──────────────────────┬─────────────────────┐
│ id         │ first_name  │ last_name  │ cf_bBUMgopGjt62qji3  │ cf_OvycNhr7O63M1udF │
├────────────┼─────────────┼────────────┼──────────────────────┼─────────────────────┤
│ 921a...    │ Giuseppe    │ Quaresima  │ ["Gestire meglio..."]│ Libero professional │
└────────────┴─────────────┴────────────┴──────────────────────┴─────────────────────┘

✅ Verification complete!

================================================================================
🔍 STEP 4: Final Verification

✅ Contacts table: 63 total columns
   - 15 custom field columns

✅ Opportunities table: 18 total columns

📊 Data counts:
   - Contacts: 680
   - Opportunities: 624

📄 Sample contact with custom fields:
[Table showing sample data]

✅ Verification complete!

================================================================================
🎉 DATABASE RESTRUCTURING COMPLETE!
================================================================================
```

## 🔍 Verificare i Risultati

### Con lazysql (Interfaccia Visuale)
```bash
lazysql sqlite://./ghl_contacts/ghl_contacts.db
```

### Con sqlite3 (Command Line)
```bash
# Vedere tutte le colonne della tabella contacts
sqlite3 ghl_contacts/ghl_contacts.db "PRAGMA table_info(ghl_contacts);"

# Vedere solo le colonne custom fields
sqlite3 ghl_contacts/ghl_contacts.db "PRAGMA table_info(ghl_contacts);" | grep cf_

# Query di esempio con custom fields
sqlite3 ghl_contacts/ghl_contacts.db "SELECT id, first_name, last_name, cf_bBUMgopGjt62qji3KuBP FROM ghl_contacts LIMIT 5;" -header -column
```

## 📁 File Creati

### Script
- `scripts/restructure-database.js` - Script principale orchestratore
- `scripts/analyze-custom-fields.js` - Analizzatore custom fields
- `scripts/migrate-custom-fields-to-columns.js` - Migratore database
- `scripts/backup-database.sh` - Script backup

### Utility
- `src/services/ghl-rate-limiter.js` - Rate limiter avanzato (7-8 req/sec)

### Output
- `scripts/custom-fields-analysis.json` - Report analisi completa
- `ghl_contacts/backups/ghl_contacts_*.db` - Backup database

### Documentazione
- `scripts/README.md` - Documentazione tecnica script
- `RISTRUTTURAZIONE_DATABASE.md` - Questa guida

## ⚙️ Caratteristiche Rate Limiter

Il sistema include gestione avanzata del rate limiting per GHL:

- **Limite GHL**: 100 richieste ogni 10 secondi
- **Rate sicuro**: 7-8 richieste/secondo (margine di sicurezza)
- **Retry automatico**: Fino a 5 tentativi su errori 429
- **Exponential backoff**: Delay progressivo tra retry
- **Finestra scorrevole**: Tracciamento preciso delle richieste

## ⚠️ Note Importanti

1. **BACKUP OBBLIGATORIO**: Sempre eseguire backup prima della ristrutturazione
2. **Idempotenza**: Gli script possono essere eseguiti più volte in sicurezza
3. **Spazio disco**: Le nuove colonne aumenteranno la dimensione del database (~20-30%)
4. **Backward compatibility**: Il campo `custom_fields` JSON viene mantenuto

## 🐛 Troubleshooting

### Database locked
```bash
# Chiudi tutte le connessioni (lazysql, altri script, ecc.)
# Riprova l'esecuzione
```

### Analysis file not found
```bash
# Lo script principale lo crea automaticamente
# Se esegui script separati, prima:
node scripts/analyze-custom-fields.js
```

### Verificare se la migrazione è già stata eseguita
```bash
sqlite3 ghl_contacts/ghl_contacts.db "PRAGMA table_info(ghl_contacts);" | grep cf_
# Se vedi colonne cf_*, la migrazione è già stata eseguita
```

## 📞 Prossimi Passi

Dopo la ristrutturazione, avrai:
- ✅ Tutti i custom fields come colonne individuali
- ✅ Tabella opportunità completa
- ✅ Database pronto per analisi avanzate
- ✅ Struttura ottimizzata per query SQL

Puoi procedere con:
- Export completo di tutti i 21K contatti
- Analisi e report personalizzati
- Integrazioni avanzate con i dati
