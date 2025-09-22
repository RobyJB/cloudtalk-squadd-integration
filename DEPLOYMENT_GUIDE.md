# 🚀 CloudTalk Webhook Production Deployment Guide

Questo script automatizza completamente il deployment del sistema webhook CloudTalk su un server di produzione con NGINX, SSL e monitoraggio.

## 📋 Pre-requisiti

### 1. Server Requirements
- **OS**: Ubuntu 20.04+ o Debian 11+
- **RAM**: Minimo 2GB (consigliati 4GB)
- **Storage**: Minimo 20GB
- **Network**: IP pubblico statico

### 2. DNS Configuration
Prima di eseguire lo script, configura il DNS:

```dns
Type: A
Name: webhooks
Value: TUO_SERVER_IP
TTL: 300
```

**Verifica DNS:**
```bash
dig webhooks.tuodominio.com
nslookup webhooks.tuodominio.com
```

### 3. Server Access
- Accesso SSH come root (o utente con sudo)
- Porte 22, 80, 443 aperte nel firewall del provider

## 🎯 Uso dello Script

### 1. Trasferisci i file sul server
```bash
# Sul tuo computer locale
scp deploy-production.sh root@TUO_SERVER_IP:/root/
scp -r . root@TUO_SERVER_IP:/root/api-middleware/

# Connettiti al server
ssh root@TUO_SERVER_IP
cd /root
```

### 2. Esegui il deployment
```bash
# Sintassi
sudo ./deploy-production.sh webhooks.tuodominio.com tua-email@dominio.com

# Esempio
sudo ./deploy-production.sh webhooks.bondici.com roberto@bondici.com
```

## 🔧 Cosa fa lo script automaticamente

### ✅ **Installazione Completa**
- 🔧 NGINX con configurazione ottimizzata
- 🟢 Node.js 18.x + PM2 process manager
- 🔒 Let's Encrypt SSL (HTTPS automatico)
- 🛡️ UFW Firewall + Fail2ban
- 📊 Monitoring e health checks
- 📝 Log rotation automatico

### ✅ **Sicurezza Avanzata**
- 🚦 Rate limiting (30 req/min per IP)
- 🔐 Security headers moderni
- 🛡️ Protection contro brute force
- 🚧 IP whitelisting ready per CloudTalk/GHL
- 🔥 Firewall configurato automaticamente

### ✅ **High Availability**
- 🔄 PM2 cluster mode (2 processi)
- 💓 Health check ogni 5 minuti
- 🔄 Auto-restart se crashes
- 📈 Load balancing ready
- 💾 Persistent logging

## 📍 Endpoint Finali

Dopo il deployment, i tuoi webhook saranno disponibili a:

### CloudTalk Webhooks (7 endpoint):
```
https://webhooks.tuodominio.com/api/cloudtalk-webhooks/call-recording-ready
https://webhooks.tuodominio.com/api/cloudtalk-webhooks/transcription-ready
https://webhooks.tuodominio.com/api/cloudtalk-webhooks/new-tag
https://webhooks.tuodominio.com/api/cloudtalk-webhooks/contact-updated
https://webhooks.tuodominio.com/api/cloudtalk-webhooks/call-started
https://webhooks.tuodominio.com/api/cloudtalk-webhooks/call-ended
https://webhooks.tuodominio.com/api/cloudtalk-webhooks/new-note
```

### GoHighLevel Webhooks (5 endpoint):
```
https://webhooks.tuodominio.com/api/ghl-webhooks/new-contact
https://webhooks.tuodominio.com/api/ghl-webhooks/new-tag
https://webhooks.tuodominio.com/api/ghl-webhooks/new-note
https://webhooks.tuodominio.com/api/ghl-webhooks/pipeline-stage-changed
https://webhooks.tuodominio.com/api/ghl-webhooks/opportunity-status-changed
```

### Health Check:
```
https://webhooks.tuodominio.com/health
```

## ⚙️ Post-Deployment Steps

### 1. 🔑 Aggiorna le API Keys
```bash
# Edita il file di configurazione
sudo nano /opt/webhook-app/.env

# Inserisci le tue vere API keys:
CLOUDTALK_API_KEY_ID=tua_vera_key_id
CLOUDTALK_API_SECRET=tuo_vero_secret
GHL_API_KEY=tua_vera_ghl_key
OPENAI_API_KEY=tua_vera_openai_key
GHL_LOCATION_ID=tuo_vero_location_id

# Riavvia l'applicazione
sudo -u webhook-app pm2 restart cloudtalk-webhooks
```

### 2. 📝 Aggiorna CloudTalk Webhook URLs
Nel tuo dashboard CloudTalk, sostituisci gli URL temporanei:

**DA:**
```
https://random-uuid.trycloudflare.com/api/cloudtalk-webhooks/call-ended
```

**A:**
```
https://webhooks.tuodominio.com/api/cloudtalk-webhooks/call-ended
```

### 3. 🧪 Test degli endpoint
```bash
# Test health check
curl https://webhooks.tuodominio.com/health

# Test webhook endpoint
curl -X POST https://webhooks.tuodominio.com/api/cloudtalk-webhooks/test \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## 📊 Comandi di Gestione

### Monitoraggio:
```bash
# Logs dell'applicazione
sudo -u webhook-app pm2 logs

# Logs di NGINX
tail -f /var/log/nginx/webhooks.access.log
tail -f /var/log/nginx/webhooks.error.log

# Status dei servizi
sudo -u webhook-app pm2 status
systemctl status nginx
systemctl status fail2ban
```

### Controllo:
```bash
# Riavvia applicazione
sudo -u webhook-app pm2 restart cloudtalk-webhooks

# Riavvia NGINX
systemctl restart nginx

# Ricarica configurazione NGINX
systemctl reload nginx

# Check SSL certificate
certbot certificates
```

### Debugging:
```bash
# Test configurazione NGINX
nginx -t

# Check porte aperte
ss -tulnp | grep -E ':(80|443|3000)'

# Check processi
ps aux | grep -E '(node|nginx|pm2)'

# Check firewall
ufw status verbose

# Check fail2ban
fail2ban-client status
```

## 🔧 Troubleshooting

### Problema: Health check fails
```bash
# Check se l'app è running
sudo -u webhook-app pm2 status

# Check logs per errori
sudo -u webhook-app pm2 logs cloudtalk-webhooks --lines 50

# Check se il .env è configurato correttamente
sudo -u webhook-app cat /opt/webhook-app/.env
```

### Problema: SSL certificate non funziona
```bash
# Rigenera certificato
certbot certonly --standalone --force-renewal -d webhooks.tuodominio.com

# Riavvia nginx
systemctl restart nginx
```

### Problema: Webhook non riceve chiamate
```bash
# Check DNS
dig webhooks.tuodominio.com

# Check firewall
ufw status

# Check nginx logs
tail -f /var/log/nginx/webhooks.access.log

# Test connectivity
curl -v https://webhooks.tuodominio.com/health
```

## 📈 Prestazioni e Scalabilità

### Current Setup:
- **Concurrent connections**: 2 PM2 processes
- **Rate limiting**: 30 requests/minute per IP
- **Memory limit**: 1GB per process
- **Health checks**: Every 5 minutes

### Per scalare:
```bash
# Aumenta il numero di processi PM2
sudo -u webhook-app pm2 scale cloudtalk-webhooks +2

# Monitor usage
sudo -u webhook-app pm2 monit
htop
```

## 🔒 Sicurezza

### Features attive:
- ✅ HTTPS obbligatorio
- ✅ Rate limiting per endpoint
- ✅ Security headers moderni
- ✅ Fail2ban protection
- ✅ UFW firewall
- ✅ Auto SSL renewal

### Per hardening aggiuntivo:
```bash
# IP whitelisting per CloudTalk
# Edita /etc/nginx/sites-available/cloudtalk-webhooks
# Uncomment e aggiorna gli IP ranges di CloudTalk/GHL
```

## 🎯 Vantaggi vs Cloudflare Tunnel

| Feature | Cloudflare Tunnel | Production NGINX |
|---------|-------------------|------------------|
| URL Stability | ❌ Cambia ogni restart | ✅ Permanente |
| Performance | 🔄 Hop aggiuntivo | ⚡ Diretto |
| Control | ⚠️ Dipendente da CF | ✅ Controllo totale |
| Monitoring | ❌ Limitato | ✅ Completo |
| Security | ⚠️ Basic | 🔒 Advanced |
| Scaling | ❌ Single tunnel | ✅ Load balancer ready |

---

## 🚀 Ready to Deploy!

Quando hai configurato il DNS e hai accesso al server, esegui:

```bash
sudo ./deploy-production.sh webhooks.tuodominio.com tua-email@dominio.com
```

Lo script ti guiderà attraverso tutto il processo! 🎉