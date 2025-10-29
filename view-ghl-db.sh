#!/bin/bash
# Quick script to open GHL contacts database with lazysql

# Get absolute path
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DB_PATH="$SCRIPT_DIR/ghl_contacts/ghl_contacts.db"

if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found at: $DB_PATH"
    exit 1
fi

echo "🚀 Opening GHL Contacts Database with lazysql..."
echo "📊 Database: $DB_PATH"
echo ""

# lazysql needs absolute path WITHOUT sqlite:// prefix
lazysql "$DB_PATH"
