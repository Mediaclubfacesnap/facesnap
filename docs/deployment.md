# FaceSnap Production Deployment Guide

This guide documents the procedures for deploying, maintaining, and recovering the FaceSnap platform in a production environment.

---

## 1. Frontend: Vercel Deployment

FaceSnap's Next.js frontend is designed for seamless hosting on [Vercel](https://vercel.com).

### Prerequisites
- Vercel CLI installed locally (`npm i -g vercel`) or a connected GitHub repository.
- Next.js 14+ compatible project configuration.

### Deployment Steps
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Initialize and deploy via CLI:
   ```bash
   vercel
   ```
3. For production release, execute:
   ```bash
   vercel --prod
   ```

### Required Environment Variables
Configure these variables in your Vercel Dashboard under **Project Settings > Environment Variables**:

| Variable Name | Description | Example / Recommended Value |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Absolute URL of the FastAPI backend service | `https://api.facesnap.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API gateway endpoint | `https://bcahxnvuodsslmeqdnin.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous key for client-side storage access | `eyJhbGciOiJIUzI1...` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN key for telemetry and tracking crashes | `https://da4eadae...` |

---

## 2. Backend: Railway/Render Deployment

The FastAPI backend is built to run inside a Docker container or directly on container hosting providers like Render or Railway.

### Deployment Steps
1. Connect your git repository to Render or Railway.
2. Select the `backend/` directory as the root folder.
3. Configure the platform build using the provided `backend/Dockerfile`.

### Required Environment Variables
Configure these variables in your hosting provider's setting panel:

| Variable Name | Description | Value |
|---|---|---|
| `ENVIRONMENT` | Deployment environment identifier | `production` |
| `DATABASE_URL` | Supabase PostgreSQL asyncpg connection string | `postgresql+asyncpg://...` |
| `REDIS_URL` | Connection string to Redis cache instances | `redis://...` |
| `SUPABASE_URL` | Supabase API gateway url | `https://...` |
| `SUPABASE_KEY` | Supabase Service Role Key (for secure backend operations) | `eyJhbGciOiJIUzI...` |
| `SUPABASE_BUCKET` | Dedicated Supabase Storage bucket | `facesnap-memories` |
| `JWT_SECRET` | Ultra-secure high-entropy secret key to sign auth JWTs | `prod_ultra_secure_...` |
| `JWT_ALGORITHM` | Algorithm used for JWT hashing | `HS256` |
| `SENTRY_DSN` | Sentry telemetry error reporting key | `https://...` |

### Worker Startup Commands
Start background worker processes alongside the main API server. 

- **Celery Worker Command**:
  ```bash
  celery -A app.workers.celery_app worker --loglevel=info --concurrency=4
  ```
- **Celery Beat (Scheduler) Command**:
  ```bash
  celery -A app.workers.celery_app beat --loglevel=info
  ```

---

## 3. Database: Backup and Restore Procedures

The primary database is Supabase PostgreSQL.

### Automated Backups
Supabase performs daily physical backups automatically. These are retained according to the project pricing tier.

### Manual Backups
Create logical backups using standard PostgreSQL client tools:
```bash
pg_dump -H db.project-ref.supabase.co -U postgres -d postgres -F c -f facesnap_backup_$(date +%F).dump
```

### Restore Procedure
To restore a logical backup dump:
```bash
pg_restore -H db.project-ref.supabase.co -U postgres -d postgres -v facesnap_backup_xxxx.dump
```

---

## 4. Rollback and Disaster Recovery

In the event of a critical issue during production release:

### Application Rollback
1. **Frontend**: Go to the Vercel dashboard, select the previous successful deployment, and click **Redeploy > Promote to Production**.
2. **Backend**: Revert the production release git tag/branch to the previous release commit hash and trigger a redeploy on your platform.
   ```bash
   git push origin <previous-commit-hash>:main --force
   ```

### Schema Rollback
If a migration broke schema integrity, execute the rollback script or run manual ALTER statements corresponding to the migration. Keep rollback files in `backend/scripts/rollbacks/`.
