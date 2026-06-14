import datetime
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import BackgroundJob

# Convert asyncpg connection string to synchronous psycopg2
sync_db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
if "postgresql://" in sync_db_url and "postgresql+psycopg2://" not in sync_db_url:
    sync_db_url = sync_db_url.replace("postgresql://", "postgresql+psycopg2://")

sync_engine = create_engine(sync_db_url, pool_pre_ping=True)
SyncSessionLocal = sessionmaker(bind=sync_engine, autoflush=False, autocommit=False)

@contextmanager
def get_sync_db():
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()

def update_job_status(job_id: str, status: str, progress: int = None, progress_message: str = None, result: dict = None, error_message: str = None, worker_name: str = None):
    """
    Updates the status, progress and metrics of a background job in the database.
    """
    with get_sync_db() as db:
        job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
        if job:
            job.status = status
            if progress is not None:
                job.progress = progress
            if progress_message is not None:
                job.progress_message = progress_message
            if result is not None:
                job.result = result
            if error_message is not None:
                job.error_message = error_message
            if worker_name is not None:
                job.worker_name = worker_name
                
            if status == "running" and not job.started_at:
                job.started_at = datetime.datetime.utcnow()
            elif status in ["completed", "failed", "cancelled"]:
                job.completed_at = datetime.datetime.utcnow()
                
            db.commit()
            return True
    return False


def validate_worker_boot(worker_name: str, check_supabase: bool = False):
    """
    Validates connections to database, Redis, and optionally Supabase at startup.
    Fails fast if any critical dependencies are offline.
    """
    import sys
    import logging
    logger = logging.getLogger(__name__)

    # Run check only if inside celery worker execution context
    is_celery = any("celery" in arg for arg in sys.argv) or "celery" in sys.modules
    if not is_celery:
        logger.info(f"[{worker_name}] Loaded in non-worker context.")
        return

    print(f"WORKER STARTED", flush=True)
    logger.info(f"[{worker_name}] WORKER STARTED")

    # 1. Database connection check
    try:
        with get_sync_db() as db:
            from sqlalchemy import text
            db.execute(text("SELECT 1"))
    except Exception as e:
        error_msg = f"[{worker_name}] Boot validation failed: Database is unavailable. Error: {e}"
        logger.critical(error_msg)
        print(error_msg, file=sys.stderr, flush=True)
        sys.exit(1)

    # 2. Redis connection check
    try:
        from app.services.cache_service import cache
        if cache.redis_client:
            cache.redis_client.ping()
        else:
            import redis
            r = redis.from_url(settings.REDIS_URL)
            r.ping()
    except Exception as e:
        error_msg = f"[{worker_name}] Boot validation failed: Redis is unavailable. Error: {e}"
        logger.critical(error_msg)
        print(error_msg, file=sys.stderr, flush=True)
        sys.exit(1)

    # 3. Supabase connection check (if required)
    if check_supabase:
        try:
            import requests
            base_url = f"{settings.SUPABASE_URL}/storage/v1"
            headers = {
                "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                "apikey": settings.SUPABASE_KEY
            }
            check_url = f"{base_url}/bucket/{settings.SUPABASE_BUCKET}"
            res = requests.get(check_url, headers=headers, timeout=5)
            # Accept 200 (exists) or 404 (not created yet, but server exists and responded)
            if res.status_code not in (200, 404):
                raise Exception(f"Supabase responded with status {res.status_code}")
        except Exception as e:
            error_msg = f"[{worker_name}] Boot validation failed: Supabase is unavailable. Error: {e}"
            logger.critical(error_msg)
            print(error_msg, file=sys.stderr, flush=True)
            sys.exit(1)

    print(f"WORKER READY", flush=True)
    logger.info(f"[{worker_name}] WORKER READY")

