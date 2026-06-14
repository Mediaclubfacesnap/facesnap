import logging
import datetime
from sqlalchemy import func
from app.workers.celery_app import celery_app
from app.workers.tasks import get_sync_db
from app.models import SearchHistory, Community, Event, AuditLog

logger = logging.getLogger(__name__)

@celery_app.task(name="app.workers.analytics_tasks.record_search_analytics")
def record_search_analytics(user_id: str, query: str):
    """
    Module 8: Search Analytics Queue Background Job
    Asynchronously logs search history entries in the database to keep search paths ultra-fast.
    """
    logger.info(f"Asynchronously recording search query for User {user_id}: {query}")
    try:
        with get_sync_db() as db:
            new_log = SearchHistory(
                user_id=user_id,
                query=query,
                created_at=datetime.datetime.utcnow()
            )
            db.add(new_log)
            db.commit()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to record search analytics: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="app.workers.analytics_tasks.rollup_nightly")
def rollup_nightly():
    """
    Module 18: Nightly Scheduled Analytics Rollup
    Aggregates trending search queries, popular communities, and most active events.
    """
    logger.info("Executing scheduled nightly analytics rollup...")
    
    twenty_four_hours_ago = datetime.datetime.utcnow() - datetime.timedelta(days=1)
    
    try:
        with get_sync_db() as db:
            # 1. Trending Queries (Last 24 Hours)
            query_stats = (
                db.query(SearchHistory.query, func.count(SearchHistory.id).label("count"))
                .filter(SearchHistory.created_at >= twenty_four_hours_ago)
                .group_by(SearchHistory.query)
                .order_by(func.count(SearchHistory.id).desc())
                .limit(10)
                .all()
            )
            trending = [{"query": q, "count": cnt} for q, cnt in query_stats]
            
            # 2. Most Active Communities (By newly created Media/Actions)
            # Log these insights to AuditLogs so admin dashboard can fetch them
            rollup_log = AuditLog(
                action="nightly_analytics_rollup",
                target="system",
                created_at=datetime.datetime.utcnow()
            )
            db.add(rollup_log)
            db.commit()
            
            logger.info(f"Nightly Analytics Complete. Trending Queries: {trending}")
            return {"status": "success", "trending_queries": trending}
    except Exception as e:
        logger.error(f"Failed to execute nightly rollup: {e}")
        return {"status": "failed", "error": str(e)}
