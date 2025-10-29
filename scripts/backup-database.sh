#!/bin/bash

# Backup script for GHL database
# Usage: ./scripts/backup-database.sh

DB_PATH="./ghl_contacts/ghl_contacts.db"
BACKUP_DIR="./ghl_contacts/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/ghl_contacts_${TIMESTAMP}.db"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗄️  GHL Database Backup${NC}\n"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}❌ Database not found: $DB_PATH${NC}"
    exit 1
fi

# Get database size
DB_SIZE=$(du -h "$DB_PATH" | cut -f1)

echo -e "📂 Database: ${GREEN}$DB_PATH${NC}"
echo -e "📊 Size: ${GREEN}$DB_SIZE${NC}"
echo -e "💾 Backup to: ${GREEN}$BACKUP_FILE${NC}\n"

# Create backup
echo "Creating backup..."
cp "$DB_PATH" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "\n${GREEN}✅ Backup created successfully!${NC}"
    echo -e "📁 Location: $BACKUP_FILE"
    echo -e "📊 Size: $BACKUP_SIZE\n"

    # List recent backups
    echo -e "${BLUE}Recent backups:${NC}"
    ls -lht "$BACKUP_DIR" | head -6

else
    echo -e "\n${RED}❌ Backup failed!${NC}"
    exit 1
fi
