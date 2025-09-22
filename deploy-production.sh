#!/bin/bash
# deploy-production.sh
# Automated CloudTalk Webhook Production Deployment Script
#
# Usage: ./deploy-production.sh webhooks.yourdomain.com your-email@domain.com
#
# This script will:
# 1. Install all dependencies (NGINX, Node.js, PM2, Certbot)
# 2. Setup security (UFW, Fail2ban)
# 3. Deploy application with PM2
# 4. Configure NGINX with SSL
# 5. Setup monitoring and logging
# 6. Create systemd services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
DOMAIN="${1:-webhooks.yourdomain.com}"
EMAIL="${2:-admin@yourdomain.com}"
APP_USER="webhook-app"
APP_DIR="/opt/webhook-app"
LOG_DIR="/var/log/webhook-app"
NGINX_CONFIG="/etc/nginx/sites-available/cloudtalk-webhooks"

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}❌ This script must be run as root${NC}"
        echo "Usage: sudo ./deploy-production.sh webhooks.yourdomain.com your-email@domain.com"
        exit 1
    fi
}

# Print banner
print_banner() {
    clear
    echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}    🚀 CloudTalk Webhook Production Deployment Script${NC}"
    echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}Domain:${NC} ${BLUE}$DOMAIN${NC}"
    echo -e "${YELLOW}Email:${NC} ${BLUE}$EMAIL${NC}"
    echo -e "${YELLOW}App Directory:${NC} ${BLUE}$APP_DIR${NC}"
    echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Log function
log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

# Error function
error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Warning function
warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Step 1: Update system and install dependencies
install_dependencies() {
    log "📦 Updating system and installing dependencies..."

    # Update package list
    apt update || error "Failed to update package list"

    # Install required packages
    log "Installing system packages..."
    DEBIAN_FRONTEND=noninteractive apt install -y \
        nginx \
        certbot \
        python3-certbot-nginx \
        curl \
        wget \
        git \
        htop \
        unzip \
        logrotate \
        ufw \
        fail2ban \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release || error "Failed to install system packages"

    # Install Node.js 18.x
    log "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - || error "Failed to add Node.js repository"
    apt install -y nodejs || error "Failed to install Node.js"

    # Install PM2 globally
    log "Installing PM2..."
    npm install -g pm2 || error "Failed to install PM2"

    log "✅ All dependencies installed successfully"
}

# Step 2: Create application user and directories
setup_user_and_directories() {
    log "👤 Setting up application user and directories..."

    # Create application user
    if ! id "$APP_USER" &>/dev/null; then
        useradd -m -s /bin/bash "$APP_USER" || error "Failed to create user $APP_USER"
        log "Created user: $APP_USER"
    else
        log "User $APP_USER already exists"
    fi

    # Create application directory
    mkdir -p "$APP_DIR" || error "Failed to create app directory"
    chown "$APP_USER:$APP_USER" "$APP_DIR"

    # Create logs directory
    mkdir -p "$LOG_DIR" || error "Failed to create log directory"
    chown "$APP_USER:$APP_USER" "$LOG_DIR"

    # Create nginx log directory
    mkdir -p /var/log/nginx

    # Create webroot for certbot
    mkdir -p /var/www/certbot
    chown www-data:www-data /var/www/certbot

    log "✅ User and directories setup completed"
}

# Step 3: Deploy application
deploy_application() {
    log "🚀 Deploying application..."

    # Switch to app user for deployment
    sudo -u "$APP_USER" bash << EOF
        cd "$APP_DIR"

        # If this is a fresh install, we need to copy the current project
        if [ ! -f "package.json" ]; then
            echo "Copying current project files..."
            cp -r $(pwd)/* "$APP_DIR/" 2>/dev/null || true
            cp -r $(pwd)/.* "$APP_DIR/" 2>/dev/null || true
        fi

        # Install production dependencies
        npm install --production || exit 1

        # Create production environment file
        cat > .env << 'EOL'
# Production Environment Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# CloudTalk API Credentials (REPLACE WITH YOUR VALUES)
CLOUDTALK_API_KEY_ID=your_api_key_id_here
CLOUDTALK_API_SECRET=your_api_secret_here

# GoHighLevel API Key (REPLACE WITH YOUR VALUES)
GHL_API_KEY=your_ghl_api_key_here

# OpenAI API Key (REPLACE WITH YOUR VALUES)
OPENAI_API_KEY=your_openai_api_key_here

# CloudTalk Campaign Automation
CLOUDTALK_TAG_NUOVI_LEAD="Nuovi Lead"
CLOUDTALK_TAG_FOLLOW_UP="Follow Up"
CLOUDTALK_TAG_MANCATA_RISPOSTA="Mancata Risposta"
TOTAL_ATTEMPTS_FIELD_KEY="# di tentativi di chiamata"
GHL_LOCATION_ID=your_ghl_location_id_here

# Optional proxy target
# TARGET_URL=your_downstream_api_url
EOL

        # Set proper permissions
        chmod 600 .env
EOF

    log "✅ Application deployed successfully"
    warn "⚠️  Don't forget to update .env with your actual API keys!"
}

# Step 4: Setup PM2 process manager
setup_pm2() {
    log "🔧 Setting up PM2 process manager..."

    sudo -u "$APP_USER" bash << EOF
        cd "$APP_DIR"

        # Create PM2 ecosystem file
        cat > ecosystem.config.js << 'EOL'
module.exports = {
  apps: [{
    name: 'cloudtalk-webhooks',
    script: 'src/index.js',
    cwd: '$APP_DIR',
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '$LOG_DIR/error.log',
    out_file: '$LOG_DIR/out.log',
    log_file: '$LOG_DIR/combined.log',
    time: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'webhook-payloads', 'recordings', 'temp-audio'],
    kill_timeout: 5000,
    listen_timeout: 10000,
    wait_ready: true
  }]
};
EOL

        # Start application with PM2
        pm2 start ecosystem.config.js || exit 1

        # Save PM2 configuration
        pm2 save || exit 1
EOF

    # Setup PM2 startup script
    env PATH=$PATH:/usr/bin pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" || error "Failed to setup PM2 startup"

    log "✅ PM2 setup completed"
}

# Step 5: Configure firewall
setup_firewall() {
    log "🔥 Configuring firewall..."

    # Reset UFW to defaults
    ufw --force reset

    # Default policies
    ufw default deny incoming
    ufw default allow outgoing

    # SSH access
    ufw allow 22/tcp

    # HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp

    # Enable firewall
    ufw --force enable

    log "✅ Firewall configured successfully"
}

# Step 6: Setup Fail2ban
setup_fail2ban() {
    log "🛡️ Setting up Fail2ban..."

    # Create nginx webhook filter
    cat > /etc/fail2ban/filter.d/nginx-webhook.conf << 'EOF'
[Definition]
failregex = ^<HOST> -.*"(GET|POST|HEAD).*HTTP.*" (4|5)\d\d
ignoreregex = ^<HOST> -.*"GET /health.*HTTP.*" 200
EOF

    # Create jail for webhook endpoints
    cat > /etc/fail2ban/jail.d/nginx-webhook.conf << 'EOF'
[nginx-webhook]
enabled = true
port = http,https
filter = nginx-webhook
logpath = /var/log/nginx/webhooks.error.log
maxretry = 10
bantime = 3600
findtime = 600
action = iptables-multiport[name=nginx-webhook, port="http,https", protocol=tcp]
EOF

    # Restart fail2ban
    systemctl restart fail2ban || error "Failed to restart fail2ban"
    systemctl enable fail2ban

    log "✅ Fail2ban configured successfully"
}

# Step 7: Configure NGINX
setup_nginx() {
    log "🌐 Configuring NGINX..."

    # Create NGINX configuration
    cat > "$NGINX_CONFIG" << EOF
# CloudTalk Webhook NGINX Configuration
# Generated by deploy-production.sh

# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=webhook_limit:10m rate=30r/m;
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=60r/m;

# Upstream backend server
upstream webhook_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other requests to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    # SSL Configuration (will be updated by certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # Modern SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logging
    access_log /var/log/nginx/webhooks.access.log;
    error_log /var/log/nginx/webhooks.error.log warn;

    # Body size limits for webhook payloads
    client_max_body_size 10M;
    client_body_buffer_size 128k;

    # Timeouts
    proxy_connect_timeout 30s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # CloudTalk Webhooks (Priority endpoints)
    location ~ ^/api/cloudtalk-webhooks/(call-recording-ready|call-ended) {
        limit_req zone=webhook_limit burst=5 nodelay;

        proxy_pass http://webhook_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Webhook-Source "cloudtalk";
        proxy_set_header X-Nginx-Timestamp \$msec;
    }

    # Other CloudTalk Webhooks
    location /api/cloudtalk-webhooks/ {
        limit_req zone=webhook_limit burst=10 nodelay;

        proxy_pass http://webhook_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Webhook-Source "cloudtalk";
    }

    # GoHighLevel Webhooks
    location /api/ghl-webhooks/ {
        limit_req zone=webhook_limit burst=10 nodelay;

        proxy_pass http://webhook_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Webhook-Source "ghl";
    }

    # General API endpoints
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://webhook_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://webhook_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }

    # Root redirect to health check
    location = / {
        return 302 /health;
    }

    # Block common attack vectors
    location ~ /\\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF

    # Enable site
    ln -sf "$NGINX_CONFIG" /etc/nginx/sites-enabled/

    # Remove default nginx site
    rm -f /etc/nginx/sites-enabled/default

    # Test nginx configuration
    nginx -t || error "NGINX configuration test failed"

    log "✅ NGINX configured successfully"
}

# Step 8: Setup SSL with Let's Encrypt
setup_ssl() {
    log "🔒 Setting up SSL certificate..."

    # Stop nginx temporarily
    systemctl stop nginx

    # Generate certificate
    certbot certonly \
        --standalone \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --domains "$DOMAIN" || error "Failed to generate SSL certificate"

    # Start nginx
    systemctl start nginx || error "Failed to start NGINX"
    systemctl enable nginx

    # Setup auto-renewal
    cat > /etc/cron.d/certbot-renew << 'EOF'
# Renew Let's Encrypt certificates twice daily
0 */12 * * * root /usr/bin/certbot renew --quiet --post-hook "systemctl reload nginx"
EOF

    log "✅ SSL certificate configured successfully"
}

# Step 9: Setup monitoring and logging
setup_monitoring() {
    log "📊 Setting up monitoring and logging..."

    # Create log rotation configuration
    cat > /etc/logrotate.d/webhook-app << 'EOF'
/var/log/webhook-app/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 webhook-app webhook-app
    postrotate
        /usr/bin/pm2 reloadLogs
    endscript
}

/var/log/nginx/webhooks.*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 0644 www-data adm
    postrotate
        systemctl reload nginx
    endscript
}
EOF

    # Create health check script
    cat > /opt/webhook-app/health-check.sh << EOF
#!/bin/bash

WEBHOOK_URL="https://$DOMAIN/health"
LOG_FILE="$LOG_DIR/health-check.log"

# Function to log with timestamp
log_message() {
    echo "[\$(date '+%Y-%m-%d %H:%M:%S')] \$1" >> "\$LOG_FILE"
}

# Check application health
response=\$(curl -s -o /dev/null -w "%{http_code}" "\$WEBHOOK_URL" --max-time 10)

if [ "\$response" = "200" ]; then
    log_message "✅ Health check passed (HTTP \$response)"
    exit 0
else
    log_message "❌ Health check failed (HTTP \$response)"

    # Restart application if health check fails
    log_message "🔄 Restarting application..."
    sudo -u $APP_USER /usr/bin/pm2 restart cloudtalk-webhooks

    # Wait and check again
    sleep 30
    response=\$(curl -s -o /dev/null -w "%{http_code}" "\$WEBHOOK_URL" --max-time 10)

    if [ "\$response" = "200" ]; then
        log_message "✅ Application restarted successfully"
    else
        log_message "💥 Application restart failed - manual intervention required"
    fi
fi
EOF

    chmod +x /opt/webhook-app/health-check.sh
    chown "$APP_USER:$APP_USER" /opt/webhook-app/health-check.sh

    # Add to cron for monitoring every 5 minutes
    cat > /etc/cron.d/webhook-health << EOF
*/5 * * * * $APP_USER /opt/webhook-app/health-check.sh
EOF

    log "✅ Monitoring and logging setup completed"
}

# Step 10: Final verification and cleanup
final_verification() {
    log "🔍 Running final verification..."

    # Wait for services to start
    sleep 10

    # Check if PM2 is running
    if ! sudo -u "$APP_USER" pm2 status | grep -q "online"; then
        error "PM2 application is not running properly"
    fi

    # Check if NGINX is running
    if ! systemctl is-active --quiet nginx; then
        error "NGINX is not running properly"
    fi

    # Check if health endpoint responds
    local health_response
    health_response=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" --max-time 10 --insecure) || health_response="000"

    if [ "$health_response" != "200" ]; then
        warn "Health check endpoint not responding (HTTP $health_response)"
        warn "This might be normal if DNS hasn't propagated yet"
    else
        log "✅ Health check endpoint is responding"
    fi

    log "✅ Final verification completed"
}

# Display final instructions
show_final_instructions() {
    clear
    echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}    🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}📍 Your webhook endpoints are available at:${NC}"
    echo ""
    echo -e "${CYAN}CloudTalk Webhooks:${NC}"
    echo -e "  ${BLUE}https://$DOMAIN/api/cloudtalk-webhooks/call-recording-ready${NC}"
    echo -e "  ${BLUE}https://$DOMAIN/api/cloudtalk-webhooks/transcription-ready${NC}"
    echo -e "  ${BLUE}https://$DOMAIN/api/cloudtalk-webhooks/new-tag${NC}"
    echo -e "  ${BLUE}https://$DOMAIN/api/cloudtalk-webhooks/contact-updated${NC}"
    echo -e "  ${BLUE}https://$DOMAIN/api/cloudtalk-webhooks/call-started${NC}"
    echo -e "  ${BLUE}https://$DOMAIN/api/cloudtalk-webhooks/call-ended${NC}"
    echo -e "  ${BLUE}https://$DOMAIN/api/cloudtalk-webhooks/new-note${NC}"
    echo ""
    echo -e "${CYAN}GoHighLevel Webhooks:${NC}"
    echo -e "  ${BLUE}https://$DOMAIN/api/ghl-webhooks/new-contact${NC}"
    echo -e "  ${BLUE}https://$DOMAIN/api/ghl-webhooks/new-tag${NC}"
    echo -e "  ${BLUE}https://$DOMAIN/api/ghl-webhooks/new-note${NC}"
    echo -e "  ${BLUE}https://$DOMAIN/api/ghl-webhooks/pipeline-stage-changed${NC}"
    echo -e "  ${BLUE}https://$DOMAIN/api/ghl-webhooks/opportunity-status-changed${NC}"
    echo ""
    echo -e "${CYAN}Health Check:${NC}"
    echo -e "  ${BLUE}https://$DOMAIN/health${NC}"
    echo ""
    echo -e "${RED}⚠️  IMPORTANT NEXT STEPS:${NC}"
    echo -e "${YELLOW}1. Update your API keys in:${NC} ${BLUE}$APP_DIR/.env${NC}"
    echo -e "${YELLOW}2. Update CloudTalk webhook URLs in your dashboard${NC}"
    echo -e "${YELLOW}3. Test webhook endpoints with curl or CloudTalk${NC}"
    echo ""
    echo -e "${CYAN}📊 Useful Commands:${NC}"
    echo -e "  Monitor logs: ${BLUE}sudo -u $APP_USER pm2 logs${NC}"
    echo -e "  Restart app:  ${BLUE}sudo -u $APP_USER pm2 restart cloudtalk-webhooks${NC}"
    echo -e "  Check status: ${BLUE}sudo -u $APP_USER pm2 status${NC}"
    echo -e "  NGINX logs:   ${BLUE}tail -f /var/log/nginx/webhooks.access.log${NC}"
    echo ""
    echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}Deployment completed at: $(date)${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
}

# Main execution
main() {
    print_banner

    # Validate input
    if [[ -z "$DOMAIN" || "$DOMAIN" == "webhooks.yourdomain.com" ]]; then
        error "Please provide a valid domain name. Usage: ./deploy-production.sh webhooks.yourdomain.com your-email@domain.com"
    fi

    if [[ -z "$EMAIL" || "$EMAIL" == "admin@yourdomain.com" ]]; then
        error "Please provide a valid email address for SSL certificate. Usage: ./deploy-production.sh webhooks.yourdomain.com your-email@domain.com"
    fi

    # Check if running as root
    check_root

    echo -e "${YELLOW}Starting deployment in 5 seconds... Press Ctrl+C to cancel${NC}"
    sleep 5

    # Execute deployment steps
    install_dependencies
    setup_user_and_directories
    deploy_application
    setup_pm2
    setup_firewall
    setup_fail2ban
    setup_nginx
    setup_ssl
    setup_monitoring
    final_verification

    # Show final instructions
    show_final_instructions
}

# Run main function
main "$@"