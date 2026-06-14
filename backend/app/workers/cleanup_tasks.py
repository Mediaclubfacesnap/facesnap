import logging
import datetime
from app.workers.celery_app import celery_app
from app.workers.tasks import get_sync_db
from app.models import PhotoFaceMatch

logger = logging.getLogger(__name__)

@celery_app.task(name="app.workers.cleanup_tasks.cleanup_media_job")
def cleanup_media_job():
    """
    Module 9 & 24: Storage Cleanup & Stale Records Purging Background Job
    Periodically clears orphaned media records or unlinked database matches.
    Runs once every 24 hours via Celery Beat (configured in celery_app.py).
    """
    logger.info("Executing Celery scheduled media storage cleanup job...")
    
    deleted_matches_count = 0
    thirty_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=30)
    
    try:
        with get_sync_db() as db:
            # 1. Clean up rejected face matches older than 30 days
            rejected_matches = (
                db.query(PhotoFaceMatch)
                .filter(
                    PhotoFaceMatch.status == "rejected",
                    PhotoFaceMatch.created_at < thirty_days_ago
                )
                .all()
            )
            
            for match in rejected_matches:
                db.delete(match)
                deleted_matches_count += 1
                
            if deleted_matches_count > 0:
                db.commit()
                logger.info(f"Pruned {deleted_matches_count} stale/rejected face matches successfully.")
            else:
                logger.info("No stale/rejected face matches required pruning.")
                
            return {"status": "success", "pruned_face_matches": deleted_matches_count}
            
    except Exception as e:
        logger.error(f"Storage cleanup background job encountered error: {e}", exc_info=True)
        return {"status": "failed", "error": str(e)}
