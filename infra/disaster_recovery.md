# FaceSnap Disaster Recovery & Business Continuity Plan

This document details the recovery protocols, priority levels, and step-by-step resolution paths for infrastructure and service failures on the FaceSnap platform.

---

## 1. Severity Levels & Target Recovery Objectives

| Severity | Description | Target RTO (Recovery Time Objective) | Target RPO (Recovery Point Objective) | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **L1 - Critical** | Database Outage / Corruption / Primary Server down | < 30 Minutes | < 24 Hours | Highest |
| **L2 - Major** | Redis Outage / Celery Worker Loop failure | < 60 Minutes | < 1 Hour | High |
| **L3 - Moderate**| Media Storage disconnect / Nginx Cache issues | < 4 Hours | < 4 Hours | Medium |
| **L4 - Minor** | Local log overflow / Analytics metrics delay | < 24 Hours | < 24 Hours | Low |

---

## 2. Recovery Protocols

### Scenario A: Database Failure (L1 - Critical)

#### Potential Causes:
- PostgreSQL container storage exhaustion.
- Database connection pool leakage/exhaustion.
- Data corruption due to unclean hardware shutdowns.

#### Resolution Steps:
1. **Identify the Issue**: Check container health using `docker compose ps`. If unhealthy or down:
   ```bash
   docker compose logs postgres
   ```
2. **Reboot the Postgres Service**: If container is crashed, check host storage space (`df -h`) and restart:
   ```bash
   docker compose restart postgres
   ```
3. **Database Restore (In case of data corruption)**:
   - Identify the latest healthy backup dump under `/app/backups/facesnap_db_YYYYMMDD_HHMMSS.sql.gz`.
   - Extract the SQL dump file:
     ```bash
     gunzip -c /app/backups/facesnap_db_YYYYMMDD_HHMMSS.sql.gz > /tmp/restore_db.sql
     ```
   - Copy the extracted SQL backup to the running Postgres container:
     ```bash
     docker cp /tmp/restore_db.sql facesnap-postgres:/tmp/restore_db.sql
     ```
   - Wipe the current state and execute `pg_restore` (or restore command depending on format):
     ```bash
     docker exec -it facesnap-postgres pg_restore -U postgres -d facesnap --clean --no-owner /tmp/restore_db.sql
     ```
   - Clean up temp files from host and container:
     ```bash
     rm /tmp/restore_db.sql
     docker exec facesnap-postgres rm /tmp/restore_db.sql
     ```

---

### Scenario B: Redis Service Outage (L2 - Major)

#### Potential Causes:
- Out of Memory (OOM) due to high active message payloads.
- Eviction policy misconfiguration.

#### Resolution Steps:
1. **Verify Redis Status**:
   - Check if Redis PING returns PONG:
     ```bash
     docker exec -it facesnap-redis redis-cli -a <password> ping
     ```
2. **Clear Memory Bloat (if degraded)**:
   - If Redis is sluggish, verify memory usage using `redis-cli info memory`.
   - Flush the transient cache (but do NOT purge Celery task queues):
     ```bash
     # Connect and execute:
     redis-cli -a <password> keys "cache:*" | xargs redis-cli -a <password> del
     ```
3. **Container Recovery**:
   - Force reboot the service container:
     ```bash
     docker compose restart redis
     ```

---

### Scenario C: Celery Worker Pool Offline (L2 - Major)

#### Potential Causes:
- OOM due to heavy OpenCV/PyTorch facial matching memory usage.
- Worker process locking up during heavy concurrency loads.

#### Resolution Steps:
1. **Verify Cluster Health**:
   - Go to Admin Panel -> Jobs Queue to inspect online workers.
   - Or run inside the host:
     ```bash
     docker compose exec celery-worker celery -A app.workers.celery_app inspect ping
     ```
2. **Scale Workers or Restart**:
   - If workers are offline or hanging:
     ```bash
     docker compose restart celery-worker celery-beat
     ```
   - To increase worker concurrency, change the concurrency limit inside `docker-compose.yml` (`--concurrency=4` to higher or spin up another worker replica).

---

### Scenario D: Storage & Media Volume Failure (L3 - Moderate)

#### Potential Causes:
- Supabase storage bucket policy alterations.
- Disk capacity full on host system.

#### Resolution Steps:
1. **Check Storage Capacity**:
   - Run `df -h` on host to check storage volumes.
   - Clean up Docker builder cache and dangling images:
     ```bash
     docker system prune -a --volumes -f
     ```
2. **Purge Temp Uploads**:
   - If local upload directories are full, run the daily cleanup Celery task manually or wipe `/app/uploads/` temp files.

---

### Scenario E: Server Level Crash (L1 - Critical)

#### Resolution Steps:
1. **Redeploy Compose Stack**:
   - Pull the repository to a clean state, ensure env files are linked, and build:
     ```bash
     docker compose down
     docker compose up -d --build
     ```
2. **Verify Port Mappings**:
   - Verify port `80` and `443` bindings:
     ```bash
     netstat -tuln | grep -E '80|443'
     ```

---

## 3. Recovery Integrity & Encryption Auditing

### AES-256 Fernet Backup Decryption
Every system backup packages:
- `db_dump.json.enc`: Encrypted database dump containing relations metadata and vector face embeddings.
- `media_archive.tar.gz.enc`: Encrypted user files.

To manually decrypt a backup file for emergency debugging, run from the backend container:
```bash
python -c "
from app.services.recovery_service import decrypt_file
decrypt_file('/app/backups/primary/facesnap_backup_daily_XXX.zip', '/app/backups/primary/facesnap_backup_daily_XXX_decrypted.zip')
"
```

### PostgreSQL PITR Restore Execution
When restoring the database to a specific transaction log point:
1. Stop the application services to prevent writes:
   ```bash
   docker compose stop backend celery-worker celery-beat
   ```
2. Place a `recovery.signal` file in the Postgres data directory:
   ```bash
   touch /var/lib/postgresql/data/recovery.signal
   ```
3. Add the target time parameters to `postgresql.conf`:
   ```ini
   restore_command = 'cp /app/backups/wal/%f %p'
   recovery_target_time = '2026-06-03 15:41:00 UTC'
   ```
4. Restart Postgres service to play back WAL transaction logs up to the recovery point:
   ```bash
   docker compose restart postgres
   ```
5. Once recovery completes, Postgres transitions to write-enabled master. Verify system and start app:
   ```bash
   docker compose start backend celery-worker celery-beat
   ```

---

## 4. Recovery Health Score Mappings

The automated **Recovery Health Score** is computed dynamically out of 100 based on the following:
- **Backup Coverage (30 points)**: Success within the last 24 hours.
- **Restore Success (30 points)**: Last 5 restore sandbox tests compiled successfully.
- **Encryption Coverage (20 points)**: Safe cryptography key initialised.
- **Storage Redundancy (20 points)**: Backups successfully replicated in `/app/backups/secondary`.

Score classifications:
- **90–100**: Excellent (Launch Ready)
- **75–89**: Good (Safe Staging)
- **50–74**: Warning (Missing secondary replication or old backup)
- **0–49**: Critical (Restore tests failing or encryption missing)
