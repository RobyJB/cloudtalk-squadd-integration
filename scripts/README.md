# Database Restructuring Scripts

Questo set di script ristruttura il database GHL per espandere i custom fields da JSON a colonne individuali.

## 🎯 Obiettivo

Trasformare il database da:
```
contacts (custom_fields: TEXT) -> JSON: [{"id": "xxx", "value": "..."}]
```

A:
```
contacts (cf_xxx: TEXT, cf_yyy: REAL, cf_zzz: TEXT, ...)
```

## 📋 Script Disponibili

### 1. `analyze-custom-fields.js`
Analizza tutti i contatti esistenti per identificare i custom fields e i loro tipi.

**Output:**
- `custom-fields-analysis.json` - Report completo con mappatura colonne

### 2. `migrate-custom-fields-to-columns.js`
Esegue la migrazione effettiva:
- Aggiunge colonne al database
- Migra dati da JSON a colonne
- Verifica la migrazione

### 3. `restructure-database.js` ⭐
**Script principale** - Orchestra tutto il processo:
1. Analizza custom fields
2. Migliora tabella opportunità
3. Migra custom fields dei contatti
4. Verifica finale

## 🚀 Utilizzo

### Esecuzione Singola (Consigliato)

```bash
node scripts/restructure-database.js
```

Questo comando esegue l'intero processo automaticamente.

### Esecuzione Step-by-Step (Debug)

```bash
# Step 1: Analisi
node scripts/analyze-custom-fields.js

# Step 2: Migrazione
node scripts/migrate-custom-fields-to-columns.js
```

## ⚙️ Rate Limiting

Il sistema include un rate limiter avanzato per le chiamate API GHL:

- **Max rate**: 7-8 richieste/secondo (100 ogni 10 secondi)
- **Retry automatico** su errori 429 (Too Many Requests)
- **Exponential backoff** per retry
- **Gestione finestra 10 secondi** per limite GHL

Configurato in: `src/services/ghl-rate-limiter.js`

## 📊 Tabelle Modificate

### `ghl_contacts`
- Aggiunge colonne `cf_*` per ogni custom field trovato
- Mantiene `custom_fields` (JSON) per backward compatibility

### `ghl_opportunities`
- Aggiunge colonne:
  - `name` (TEXT)
  - `pipeline_name` (TEXT)
  - `stage_name` (TEXT)
  - `assigned_to` (TEXT)
  - `source` (TEXT)
  - `last_status_change_at` (DATETIME)
  - `last_stage_change_at` (DATETIME)
  - `lead_value` (REAL)
  - `custom_fields` (TEXT)
  - `tags` (TEXT)

## 🔍 Verifica Post-Migrazione

Usa lazysql per verificare i risultati:

```bash
lazysql sqlite://./ghl_contacts/ghl_contacts.db
```

O interroga direttamente:

```bash
sqlite3 ghl_contacts/ghl_contacts.db "PRAGMA table_info(ghl_contacts);"
```

## ⚠️ Note Importanti

1. **Backup automatico**: Lo script NON crea backup automatici. Fai backup manuale prima:
   ```bash
   cp ghl_contacts/ghl_contacts.db ghl_contacts/ghl_contacts.db.backup
   ```

2. **Idempotenza**: Gli script possono essere eseguiti più volte in sicurezza (saltano colonne esistenti)

3. **Tempo stimato**: ~5-10 secondi per 680 contatti

4. **Spazio disco**: Le colonne aggiuntive aumenteranno la dimensione del database

## 🐛 Troubleshooting

### Error: "Analysis file not found"
```bash
# Esegui prima l'analisi
node scripts/analyze-custom-fields.js
```

### Error: "Database is locked"
```bash
# Chiudi connessioni aperte (lazysql, altri script)
# Riprova l'esecuzione
```

### Verificare colonne create
```bash
sqlite3 ghl_contacts/ghl_contacts.db "PRAGMA table_info(ghl_contacts);" | grep cf_
```

## 📁 File Generati

- `scripts/custom-fields-analysis.json` - Analisi completa dei custom fields
- Database aggiornato con nuove colonne

## 🔗 Related

- Rate Limiter: `src/services/ghl-rate-limiter.js`
- Export Service: `src/services/ghl-contact-export-service.js`
- Database Service: `src/services/ghl-contact-database.js`
