# FaceSnap Deployment Guide (v1.0)

## Overview
FaceSnap is a modern facial recognition platform utilizing Next.js (Frontend), FastAPI (Backend), PostgreSQL + pgvector (Database), Redis (Caching/Queue), and Celery (Background Workers).

## Prerequisites
- Node.js v24.x
- Python 3.10+
- PostgreSQL 15+ with pgvector extension
- Redis 7+

## Environment Variables
Ensure the following files are configured correctly before deploying:
- `backend/.env`
- `frontend/.env.local`

*Refer to `.env.staging` for reference keys.*

## Backend Deployment
1. Navigate to `backend/`
2. Create virtual environment: `python -m venv venv`
3. Activate virtual environment: `source venv/bin/activate` (Linux/Mac) or `venv\Scripts\activate` (Windows)
4. Install dependencies: `pip install -r requirements.txt`
5. Run migrations: `python scratch/migrate_5h.py`
6. Start Celery worker: `celery -A app.celery worker --loglevel=info`
7. Start FastAPI server: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

## Frontend Deployment
1. Navigate to `frontend/`
2. Install dependencies: `npm install`
3. Build for production: `npm run build`
4. Start Next.js server: `npm run start`

## Nginx Reverse Proxy (Optional but Recommended)
Use the provided `infra/nginx.conf` to serve FaceSnap over HTTPS and handle static assets efficiently. Ensure you have proper SSL certificates configured.

## Post-Deployment Verification
Run the Launch Verification Suite:
`python scripts/launch_verification.py`
