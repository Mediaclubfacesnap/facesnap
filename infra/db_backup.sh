#!/bin/bash

# ==============================================================================
# FaceSnap Production Database & Assets Backup Automation Script
# ==============================================================================
# Frequency: Recommended to run as a daily cron job
# Usage: ./db_backup.sh
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# Configuration
BACKUP_DIR="/app/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_CONTAINER_NAME="facesnap-postgres"
DB_NAME="facesnap"
DB_USER="postgres"
RETENTION_DAYS=7

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "======================================================================"
echo "Starting FaceSnap Backup Routine: $(date)"
echo "======================================================================"

# 1. Database Backup (pg_dump)
DB_BACKUP_FILE="$BACKUP_DIR/facesnap_db_$TIMESTAMP.sql.gz"
echo "[1/3] Dumping database '$DB_NAME' from container '$DB_CONTAINER_NAME'..."

if docker ps --format '{{.Names}}' | grep -q "^$DB_CONTAINER_NAME$"; then
    # Run pg_dump inside the docker container and stream to host compressed file
    docker exec -t "$DB_CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" -F c | gzip > "$DB_BACKUP_FILE"
    echo "✓ Database dump successful: $DB_BACKUP_FILE"
else
    echo "✗ ERROR: PostgreSQL container '$DB_CONTAINER_NAME' is not running!"
    exit 1
fi

# 2. Uploads and Media Volume Backup
MEDIA_BACKUP_FILE="$BACKUP_DIR/facesnap_media_$TIMESTAMP.tar.gz"
echo "[2/3] Archiving media uploads volume..."

# If the uploads folder exists on host or within docker volumes
# We compress the uploads directory to prevent media loss
if [ -d "/app/uploads" ]; then
    tar -czf "$MEDIA_BACKUP_FILE" -C "/app" uploads
    echo "✓ Media backup successful: $MEDIA_BACKUP_FILE"
else
    # Fallback to backing up compose mount folders if running in same folder
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PARENT_DIR="$(dirname "$SCRIPT_DIR")"
    if [ -d "$PARENT_DIR/backend/uploads" ]; then
        tar -czf "$MEDIA_BACKUP_FILE" -C "$PARENT_DIR/backend" uploads
        echo "✓ Media backup successful (fallback path): $MEDIA_BACKUP_FILE"
      else
        echo "! WARNING: Media uploads directory not found, skipping media backup."
    fi
fi

# 3. Clean up historical backups (Retention Policy)
echo "[3/3] Enforcing retention policy ($RETENTION_DAYS days)..."
find "$BACKUP_DIR" -type f -name "facesnap_db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -type f -name "facesnap_media_*.tar.gz" -mtime +$RETENTION_DAYS -delete
echo "✓ Retention policy checked and clean."

echo "======================================================================"
echo "FaceSnap Backup Completed Successfully!"
echo "Timestamp: $TIMESTAMP"
echo "======================================================================"

# ==============================================================================
# HOW TO RESTORE RESTORE INSTRUCTIONS:
# ==============================================================================
# To restore the database:
# 1. Decompress/get file: gunzip -c facesnap_db_TIMESTAMP.sql.gz > temp_db.sql
# 2. Copy to container: docker cp temp_db.sql facesnap-postgres:/tmp/temp_db.sql
# 3. Run pg_restore:
#    docker exec -it facesnap-postgres pg_restore -U postgres -d facesnap --clean --no-owner /tmp/temp_db.sql
# 4. Cleanup: rm temp_db.sql && docker exec facesnap-postgres rm /tmp/temp_db.sql
# ==============================================================================
