# Campaign Automation - Tag System

## Panoramica

Il sistema di automazione campagne CloudTalk è stato aggiornato per utilizzare i **tag dei contatti** invece dello spostamento fisico tra campagne. Questo approccio è più affidabile e non richiede API aggiuntive per la gestione dei contatti nelle campagne.

## Come Funziona

### Sistema Basato su Tag

Invece di spostare i contatti tra campagne diverse, il sistema assegna **tag specifici** ai contatti per indicare la loro fase nel processo di follow-up:

| Tentativi | Tag Assegnato | Descrizione |
|-----------|---------------|-------------|
| 1-2 | `Nuovi Lead` | Contatti appena acquisiti, primi tentativi |
| 3-9 | `Follow Up` | Contatti che richiedono follow-up attivo |
| 10+ | `Mancata Risposta` | Contatti che non hanno risposto dopo molti tentativi |

### Logica di Transizione

- **1-2 tentativi**: Assegna il tag `Nuovi Lead`
- **3° tentativo**: Rimuove `Nuovi Lead` e assegna `Follow Up`
- **10° tentativo**: Rimuove `Follow Up` e assegna `Mancata Risposta`

I tag vengono **sostituiti completamente** ad ogni aggiornamento per mantenere la consistenza.

## Configurazione

### Variabili di Ambiente (.env)

```bash
# CloudTalk Campaign Automation (Tag-based System)
CLOUDTALK_TAG_NUOVI_LEAD="Nuovi Lead"
CLOUDTALK_TAG_FOLLOW_UP="Follow Up" 
CLOUDTALK_TAG_MANCATA_RISPOSTA="Mancata Risposta"
TOTAL_ATTEMPTS_FIELD_KEY="# di tentativi di chiamata"
```

### Soglie Configurabili

Le soglie sono definite nel codice ma possono essere facilmente modificate:

```javascript
const THRESHOLDS = {
  FOLLOW_UP: 3,         // A 3 tentativi: cambia a "Follow Up"  
  MANCATA_RISPOSTA: 10  // A 10 tentativi: cambia a "Mancata Risposta"
};
```

## Implementazione Tecnica

### API Utilizzate

Il sistema utilizza l'**API Bulk di CloudTalk** per aggiornare i tag:

```javascript
POST /bulk/contacts.json
{
  "action": "edit_contact",
  "command_id": "update-tags-{contactId}-{timestamp}",
  "data": {
    "id": contactId,
    "name": "Nome Contatto",
    "ContactsTag": [
      { "name": "Follow Up" }
    ]
  }
}
```

### Flusso di Esecuzione

1. **Webhook Call-Ended**: Riceve notifica di chiamata terminata
2. **Ricerca Contatto**: Trova il contatto per numero di telefono
3. **Incrementa Tentativi**: Aggiorna il campo custom "# di tentativi di chiamata"
4. **Valuta Soglie**: Controlla se i tentativi hanno raggiunto una soglia
5. **Aggiorna Tag**: Assegna i tag appropriati tramite API bulk
6. **Log Risultati**: Registra tutte le operazioni per auditing

### Gestione Errori

- Se l'aggiornamento dei tag fallisce, il sistema continua comunque (l'incremento dei tentativi è già avvenuto)
- Tutti gli errori vengono loggati per debugging
- Il sistema è **idempotente**: chiamate multiple con lo stesso webhook non causano problemi

## Vantaggi del Sistema Tag

### ✅ Vantaggi

1. **API Disponibili**: Usa API CloudTalk esistenti e documentate
2. **Semplicità**: Non richiede gestione complessa di appartenenza alle campagne
3. **Flessibilità**: I tag possono essere utilizzati per filtri e segmentazione
4. **Affidabilità**: Meno punti di fallimento rispetto allo spostamento tra campagne
5. **Visibilità**: I tag sono visibili nell'interfaccia CloudTalk
6. **Estendibilità**: Facile aggiungere nuovi stati o soglie

### 🔄 Confronto con Sistema Precedente

| Aspetto | Sistema Campagne | Sistema Tag |
|---------|------------------|-------------|
| **API Richieste** | 3 nuove API non documentate | 1 API esistente e documentata |
| **Complessità** | Alta (gestione appartenenza) | Bassa (assegnazione tag) |
| **Affidabilità** | Dipende da API non implementate | Usa API stabili |
| **Visibilità** | Solo in campagne specifiche | Visibile ovunque |
| **Manutenzione** | Complessa | Semplice |

## Testing

### Script di Test

È disponibile uno script di test completo:

```bash
node tests/campaign-automation/test-tag-system.js
```

### Scenari Testati

- ✅ Progressione 1-2 tentativi → "Nuovi Lead"
- ✅ Transizione 3° tentativo → "Follow Up"
- ✅ Transizione 10° tentativo → "Mancata Risposta"
- ✅ Gestione contatti non trovati
- ✅ Gestione numeri di telefono non validi
- ✅ Gestione webhook senza numero

### Log e Monitoring

Il sistema produce log dettagliati in:
- **File dedicato**: `logs/cloudtalk-campaign-automation.log`
- **Console**: Per debugging in tempo reale
- **Formato strutturato**: JSON per analisi automatiche

## Utilizzo nei Filtri CloudTalk

Una volta assegnati, i tag possono essere utilizzati per:

1. **Filtri Campagne**: Creare liste dinamiche basate sui tag
2. **Segmentazione**: Dividere i contatti per stadio di follow-up
3. **Reportistica**: Analizzare performance per categoria
4. **Automazioni**: Trigger automatici basati sui tag

## Migrazione dal Sistema Precedente

Se stavi usando il sistema basato su campagne:

1. **Backup**: Esporta i contatti delle campagne esistenti
2. **Stop Automazione**: Disabilita temporaneamente i webhook
3. **Deploy Nuovo Sistema**: Aggiorna il codice con il sistema tag
4. **Ri-tag Contatti**: Esegui script per assegnare tag corretti ai contatti esistenti
5. **Test**: Verifica il funzionamento con webhook di test
6. **Riattivazione**: Riabilita i webhook in produzione

## Supporto e Debugging

### Log Principali

```bash
# Monitora log automazione campagne
tail -f logs/cloudtalk-campaign-automation.log | jq

# Cerca errori specifici
grep -i "error" logs/cloudtalk-campaign-automation.log | tail -20
```

### Variabili di Debug

Aggiungi queste variabili per debugging esteso:

```bash
LOG_LEVEL=debug
NODE_ENV=development
```

## Contatti e Supporto

Per domande o problemi con il sistema:

- Controlla i log in `logs/cloudtalk-campaign-automation.log`
- Esegui i test: `npm run test:campaign-automation`
- Verifica la configurazione delle variabili di ambiente
- Controlla che la CLOUDTALK_API_KEY sia configurata correttamente

---

*Ultimo aggiornamento: Dicembre 2024*