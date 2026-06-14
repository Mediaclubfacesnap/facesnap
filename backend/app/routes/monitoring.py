from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text, and_
from uuid import UUID
import datetime
import io
import csv
import logging
import time

from app.database import get_db, engine
from app.models import User, AuditLog, SecurityIncident, ApiMetric, SearchMetric, ErrorLog, UptimeLog, Notification, BackgroundJob, PhotoFaceMatch
from app.routes.auth import get_current_user
from app.services.cache_service import cache
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/monitoring", tags=["Monitoring & Observability"])

# Helper: Enforce Super Admin only
def assert_super_admin(current_user: User):
    if current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Monitoring and observability tools require Super Admin status."
        )

@router.get("/health")
async def health_check_overall(db: AsyncSession = Depends(get_db)):
    """
    Module 2: Overall System Health check endpoint.
    """
    db_status = "healthy"
    try:
        start = time.time()
        await db.execute(text("SELECT 1"))
        db_latency = (time.time() - start) * 1000
    except Exception:
        db_status = "unhealthy"
        db_latency = 0.0

    redis_status = "healthy"
    try:
        if cache.redis_client:
            cache.redis_client.ping()
        else:
            redis_status = "unhealthy"
    except Exception:
        redis_status = "unhealthy"

    workers_status = "healthy"
    try:
        from app.workers.celery_app import celery_app
        inspector = celery_app.control.inspect()
        ping = inspector.ping()
        if not ping:
            workers_status = "unhealthy"
    except Exception:
        workers_status = "unhealthy"

    overall = "healthy"
    if db_status == "unhealthy" or redis_status == "unhealthy" or workers_status == "unhealthy":
        overall = "degraded"
        if db_status == "unhealthy" and redis_status == "unhealthy":
            overall = "unhealthy"

    return {
        "status": overall,
        "database": db_status,
        "cache": redis_status,
        "workers": workers_status,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

@router.get("/health/database")
async def health_check_database(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Module 2: Specialized Database health diagnostics.
    """
    assert_super_admin(current_user)
    try:
        start_time = time.time()
        await db.execute(text("SELECT 1"))
        latency = (time.time() - start_time) * 1000
        
        # Check active connections
        conn_res = await db.execute(text("SELECT count(*) FROM pg_stat_activity;"))
        active_connections = conn_res.scalar() or 1
        
        return {
            "status": "healthy",
            "latency_ms": latency,
            "active_connections": active_connections,
            "pool_size": engine.pool.size() if hasattr(engine.pool, "size") else 20,
            "checked_out": engine.pool.checkedout() if hasattr(engine.pool, "checkedout") else 0
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "detail": str(e)}
        )

@router.get("/health/cache")
async def health_check_cache(current_user: User = Depends(get_current_user)):
    """
    Module 2: Redis cache health diagnostics.
    """
    assert_super_admin(current_user)
    try:
        if not cache.redis_client:
            raise Exception("Redis client not initialized.")
            
        start_time = time.time()
        cache.redis_client.ping()
        latency = (time.time() - start_time) * 1000
        
        info = cache.redis_client.info()
        memory_used = info.get("used_memory", 0)
        clients = info.get("connected_clients", 0)
        hits = info.get("keyspace_hits", 0)
        misses = info.get("keyspace_misses", 0)
        
        hit_rate = 0.0
        if (hits + misses) > 0:
            hit_rate = (hits / (hits + misses)) * 100
            
        return {
            "status": "healthy",
            "latency_ms": latency,
            "memory_used_bytes": memory_used,
            "memory_used_mb": round(memory_used / (1024 * 1024), 2),
            "connected_clients": clients,
            "hit_rate_pct": round(hit_rate, 2)
        }
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Redis cache check failed: {e}"
        )

@router.get("/health/workers")
async def health_check_workers(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Module 2: Celery workers health diagnostics.
    """
    assert_super_admin(current_user)
    try:
        from app.workers.celery_app import celery_app
        inspector = celery_app.control.inspect()
        
        ping = inspector.ping() or {}
        active = inspector.active() or {}
        reserved = inspector.reserved() or {}
        
        # Query database jobs to calculate queue metrics
        completed_stmt = select(func.count(BackgroundJob.id)).where(BackgroundJob.status == "completed")
        completed_res = await db.execute(completed_stmt)
        completed_count = completed_res.scalar() or 0
        
        failed_stmt = select(func.count(BackgroundJob.id)).where(BackgroundJob.status == "failed")
        failed_res = await db.execute(failed_stmt)
        failed_count = failed_res.scalar() or 0

        running_stmt = select(func.count(BackgroundJob.id)).where(BackgroundJob.status == "running")
        running_res = await db.execute(running_stmt)
        running_count = running_res.scalar() or 0

        queued_stmt = select(func.count(BackgroundJob.id)).where(BackgroundJob.status == "queued")
        queued_res = await db.execute(queued_stmt)
        queued_count = queued_res.scalar() or 0
        
        return {
            "status": "healthy" if len(ping) > 0 else "unhealthy",
            "online_workers": list(ping.keys()),
            "active_tasks_count": sum(len(tasks) for tasks in active.values()),
            "reserved_tasks_count": sum(len(tasks) for tasks in reserved.values()),
            "jobs_summary": {
                "completed": completed_count,
                "failed": failed_count,
                "running": running_count,
                "queued": queued_count
            }
        }
    except Exception as e:
        logger.error(f"Celery workers health check failed: {e}")
        return {
            "status": "unhealthy",
            "online_workers": [],
            "detail": str(e)
        }

@router.get("/stats")
async def get_monitoring_stats(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Module 3 - 17: Observability rollup telemetry stats.
    """
    assert_super_admin(current_user)
    
    # 1. User Activity (DAU/WAU/MAU)
    now = datetime.datetime.utcnow()
    day_ago = now - datetime.timedelta(days=1)
    week_ago = now - datetime.timedelta(days=7)
    month_ago = now - datetime.timedelta(days=30)
    
    dau_stmt = select(func.count(User.id)).where(User.last_seen >= day_ago)
    dau_res = await db.execute(dau_stmt)
    dau = dau_res.scalar() or 0
    
    wau_stmt = select(func.count(User.id)).where(User.last_seen >= week_ago)
    wau_res = await db.execute(wau_stmt)
    wau = wau_res.scalar() or 0
    
    mau_stmt = select(func.count(User.id)).where(User.last_seen >= month_ago)
    mau_res = await db.execute(mau_stmt)
    mau = mau_res.scalar() or 0

    # Total Users / Active Groups
    total_users_stmt = select(func.count(User.id))
    total_users = (await db.execute(total_users_stmt)).scalar() or 0
    
    from app.models import Community, Event
    active_communities = (await db.execute(select(func.count(Community.id)))).scalar() or 0
    active_events = (await db.execute(select(func.count(Event.id)))).scalar() or 0

    # 2. API Response Times & Error Rate (Module 4 & 9)
    # Average response duration, P50, P95, P99
    duration_stmt = select(ApiMetric.duration_ms).where(ApiMetric.created_at >= day_ago)
    duration_res = await db.execute(duration_stmt)
    durations = [r[0] for r in duration_res.all()]
    
    avg_duration = sum(durations) / len(durations) if durations else 0.0
    durations.sort()
    p50 = durations[int(len(durations) * 0.5)] if durations else 0.0
    p95 = durations[int(len(durations) * 0.95)] if durations else 0.0
    p99 = durations[int(len(durations) * 0.99)] if durations else 0.0
    
    # Error rate (status_code >= 400 / total)
    total_hits = len(durations)
    errors_res = await db.execute(select(func.count(ApiMetric.id)).where(and_(ApiMetric.created_at >= day_ago, ApiMetric.status_code >= 400)))
    total_errors = errors_res.scalar() or 0
    error_rate = (total_errors / total_hits * 100) if total_hits > 0 else 0.0

    # Endpoint Heatmap: Top 20 endpoints
    heatmap_stmt = select(ApiMetric.endpoint, ApiMetric.method, func.count(ApiMetric.id), func.avg(ApiMetric.duration_ms), func.count(text("CASE WHEN status_code >= 400 THEN 1 END"))).where(ApiMetric.created_at >= day_ago).group_by(ApiMetric.endpoint, ApiMetric.method).order_by(func.count(ApiMetric.id).desc()).limit(20)
    heatmap_res = await db.execute(heatmap_stmt)
    heatmap = [{
        "endpoint": r[0],
        "method": r[1],
        "hits": r[2],
        "avg_duration_ms": round(r[3] or 0.0, 2),
        "errors": r[4]
    } for r in heatmap_res.all()]

    # 3. Search Quality Monitoring (Module 10)
    search_total_stmt = select(func.count(SearchMetric.id)).where(SearchMetric.created_at >= day_ago)
    search_total = (await db.execute(search_total_stmt)).scalar() or 0
    
    search_zero_stmt = select(func.count(SearchMetric.id)).where(and_(SearchMetric.created_at >= day_ago, SearchMetric.result_count == 0))
    search_zero = (await db.execute(search_zero_stmt)).scalar() or 0

    search_avg_duration = (await db.execute(select(func.avg(SearchMetric.duration_ms)).where(SearchMetric.created_at >= day_ago))).scalar() or 0.0
    
    search_popular = (await db.execute(select(SearchMetric.query, func.count(SearchMetric.id)).where(SearchMetric.created_at >= day_ago).group_by(SearchMetric.query).order_by(func.count(SearchMetric.id).desc()).limit(5))).all()
    popular_queries = [{"query": r[0], "hits": r[1]} for r in search_popular]

    # 4. Face Recognition Analytics (Module 11)
    # confirmed/rejected/pending counts
    verified_res = await db.execute(select(PhotoFaceMatch.status, func.count(PhotoFaceMatch.id)).group_by(PhotoFaceMatch.status))
    face_counts = {r[0]: r[1] for r in verified_res.all()}
    
    approved = face_counts.get("confirmed", 0)
    rejected = face_counts.get("rejected", 0)
    total_face = approved + rejected + face_counts.get("pending", 0)
    false_pos_rate = (rejected / (approved + rejected) * 100) if (approved + rejected) > 0 else 0.0

    # Average face processing duration in workers
    avg_face_duration = (await db.execute(select(func.avg(BackgroundJob.completed_at - BackgroundJob.started_at)).where(and_(BackgroundJob.task_name == "app.workers.face_tasks.process_face_matching", BackgroundJob.status == "completed")))).scalar()
    avg_face_sec = avg_face_duration.total_seconds() if avg_face_duration else 0.0

    # 5. Notification Analytics (Module 12)
    notif_sent = (await db.execute(select(func.count(Notification.id)))).scalar() or 0
    notif_opened = (await db.execute(select(func.count(Notification.id)).where(Notification.notification_opened == True))).scalar() or 0
    notif_clicked = (await db.execute(select(func.count(Notification.id)).where(Notification.notification_clicked == True))).scalar() or 0
    
    open_rate = (notif_opened / notif_sent * 100) if notif_sent > 0 else 0.0
    ctr = (notif_clicked / notif_sent * 100) if notif_sent > 0 else 0.0

    # 6. Database storage size (Module 14)
    db_size_res = await db.execute(text("SELECT pg_database_size(current_database());"))
    db_size_bytes = db_size_res.scalar() or 0

    # Supabase Mockup/Calculated storage growth (Module 16)
    from app.models import CommunityMedia
    media_count = (await db.execute(select(func.count(CommunityMedia.id)))).scalar() or 0
    # Average photo is ~2MB, video is ~25MB
    photo_count_stmt = select(func.count(CommunityMedia.id)).where(CommunityMedia.content_type.like("image/%"))
    photos_count = (await db.execute(photo_count_stmt)).scalar() or 0
    videos_count = media_count - photos_count
    
    photos_storage_mb = photos_count * 2.0
    videos_storage_mb = videos_count * 25.0
    db_storage_mb = db_size_bytes / (1024 * 1024)

    # 7. Specific status code counts & failures for Phase 40 metrics
    errors_500_res = await db.execute(select(func.count(ApiMetric.id)).where(and_(ApiMetric.created_at >= day_ago, ApiMetric.status_code == 500)))
    errors_500 = errors_500_res.scalar() or 0

    errors_403_res = await db.execute(select(func.count(ApiMetric.id)).where(and_(ApiMetric.created_at >= day_ago, ApiMetric.status_code == 403)))
    errors_403 = errors_403_res.scalar() or 0

    errors_429_res = await db.execute(select(func.count(ApiMetric.id)).where(and_(ApiMetric.created_at >= day_ago, ApiMetric.status_code == 429)))
    errors_429 = errors_429_res.scalar() or 0

    rec_failures_res = await db.execute(select(func.count(BackgroundJob.id)).where(
        BackgroundJob.task_name == "app.workers.face_tasks.process_face_matching",
        BackgroundJob.status == "failed",
        BackgroundJob.created_at >= day_ago
    ))
    recognition_failures = rec_failures_res.scalar() or 0

    notif_failures_res = await db.execute(select(func.count(BackgroundJob.id)).where(
        BackgroundJob.task_name.like("%notification%"),
        BackgroundJob.status == "failed",
        BackgroundJob.created_at >= day_ago
    ))
    notification_failures = notif_failures_res.scalar() or 0

    return {
        "user_activity": {
            "dau": dau,
            "wau": wau,
            "mau": mau,
            "total_users": total_users,
            "active_communities": active_communities,
            "active_events": active_events
        },
        "api_performance": {
            "total_hits": total_hits,
            "average_ms": round(avg_duration, 2),
            "p50_ms": round(p50, 2),
            "p95_ms": round(p95, 2),
            "p99_ms": round(p99, 2),
            "error_rate_pct": round(error_rate, 2),
            "total_errors": total_errors,
            "errors_500": errors_500,
            "errors_403": errors_403,
            "errors_429": errors_429,
            "heatmap": heatmap
        },
        "search_quality": {
            "total_searches": search_total,
            "zero_results_pct": round((search_zero / search_total * 100) if search_total > 0 else 0.0, 2),
            "average_duration_ms": round(search_avg_duration, 2),
            "popular_queries": popular_queries
        },
        "face_recognition": {
            "matches_created": total_face,
            "matches_approved": approved,
            "matches_rejected": rejected,
            "false_positive_pct": round(false_pos_rate, 2),
            "average_matching_time_sec": round(avg_face_sec, 2),
            "processing_failures": recognition_failures
        },
        "notifications": {
            "sent": notif_sent,
            "opened": notif_opened,
            "clicked": notif_clicked,
            "open_rate_pct": round(open_rate, 2),
            "ctr_pct": round(ctr, 2),
            "delivery_failures": notification_failures
        },
        "storage": {
            "photos_mb": round(photos_storage_mb, 2),
            "videos_mb": round(videos_storage_mb, 2),
            "database_mb": round(db_storage_mb, 2),
            "total_mb": round(photos_storage_mb + videos_storage_mb + db_storage_mb, 2)
        }
    }

@router.get("/errors", response_model=list)
async def get_monitoring_error_logs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Module 21: Error Console list API.
    """
    assert_super_admin(current_user)
    
    stmt = (
        select(ErrorLog)
        .options(func.selectinload(ErrorLog.user) if hasattr(ErrorLog, "user") else [])
        .order_by(ErrorLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(stmt)
    logs = res.scalars().all()
    
    # Map manually to include username safely
    return [{
        "id": str(log.id),
        "message": log.message,
        "traceback": log.traceback,
        "endpoint": log.endpoint,
        "method": log.method,
        "ip_address": log.ip_address,
        "created_at": log.created_at.isoformat(),
        "user_email": log.user.email if log.user else None
    } for log in logs]

@router.get("/uptime")
async def get_uptime_percentages(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Module 14: Calculates true uptime percentage rollups (24h, 7d, 30d).
    """
    assert_super_admin(current_user)
    
    now = datetime.datetime.utcnow()
    day_ago = now - datetime.timedelta(days=1)
    week_ago = now - datetime.timedelta(days=7)
    month_ago = now - datetime.timedelta(days=30)
    
    services = ["api", "database", "cache", "worker"]
    uptime_stats = {}
    
    for s in services:
        # Calculate 24h Uptime
        day_total = (await db.execute(select(func.count(UptimeLog.id)).where(and_(UptimeLog.service == s, UptimeLog.created_at >= day_ago)))).scalar() or 0
        day_online = (await db.execute(select(func.count(UptimeLog.id)).where(and_(UptimeLog.service == s, UptimeLog.created_at >= day_ago, UptimeLog.status == "healthy")))).scalar() or 0
        
        # Calculate 7d Uptime
        week_total = (await db.execute(select(func.count(UptimeLog.id)).where(and_(UptimeLog.service == s, UptimeLog.created_at >= week_ago)))).scalar() or 0
        week_online = (await db.execute(select(func.count(UptimeLog.id)).where(and_(UptimeLog.service == s, UptimeLog.created_at >= week_ago, UptimeLog.status == "healthy")))).scalar() or 0
        
        # Calculate 30d Uptime
        month_total = (await db.execute(select(func.count(UptimeLog.id)).where(and_(UptimeLog.service == s, UptimeLog.created_at >= month_ago)))).scalar() or 0
        month_online = (await db.execute(select(func.count(UptimeLog.id)).where(and_(UptimeLog.service == s, UptimeLog.created_at >= month_ago, UptimeLog.status == "healthy")))).scalar() or 0
        
        uptime_stats[s] = {
            "uptime_24h": round((day_online / day_total * 100) if day_total > 0 else 100.0, 2),
            "uptime_7d": round((week_online / week_total * 100) if week_total > 0 else 100.0, 2),
            "uptime_30d": round((month_online / month_total * 100) if month_total > 0 else 100.0, 2)
        }
        
    return uptime_stats

@router.get("/export")
async def export_monitoring_logs(
    export_type: str = Query("api_metrics", pattern="^(api_metrics|error_logs|search_metrics|uptime_logs)$"),
    export_format: str = Query("csv", pattern="^(csv|xlsx)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Module 22: Export monitoring records.
    """
    assert_super_admin(current_user)
    
    # Audit log entry for monitoring exports (Module 23)
    audit = AuditLog(
        user_id=current_user.id,
        action="monitoring_export",
        target=export_type,
        meta={"format": export_format}
    )
    db.add(audit)
    await db.commit()

    output = io.StringIO()
    writer = csv.writer(output)
    
    if export_type == "api_metrics":
        stmt = select(ApiMetric).options(func.selectinload(ApiMetric.user) if hasattr(ApiMetric, "user") else []).order_by(ApiMetric.created_at.desc()).limit(1000)
        res = await db.execute(stmt)
        metrics = res.scalars().all()
        writer.writerow(["ID", "Timestamp", "User Email", "Endpoint", "Method", "Duration (ms)", "Status Code", "IP Address"])
        for m in metrics:
            email = m.user.email if m.user else "Anonymous"
            writer.writerow([str(m.id), m.created_at.isoformat(), email, m.endpoint, m.method, m.duration_ms, m.status_code, m.ip_address])
            
    elif export_type == "error_logs":
        stmt = select(ErrorLog).options(func.selectinload(ErrorLog.user) if hasattr(ErrorLog, "user") else []).order_by(ErrorLog.created_at.desc()).limit(1000)
        res = await db.execute(stmt)
        logs = res.scalars().all()
        writer.writerow(["ID", "Timestamp", "User Email", "Message", "Traceback", "Endpoint", "Method", "IP Address"])
        for l in logs:
            email = l.user.email if l.user else "Anonymous"
            writer.writerow([str(l.id), l.created_at.isoformat(), email, l.message, l.traceback, l.endpoint, l.method, l.ip_address])
            
    elif export_type == "search_metrics":
        stmt = select(SearchMetric).options(func.selectinload(SearchMetric.user) if hasattr(SearchMetric, "user") else []).order_by(SearchMetric.created_at.desc()).limit(1000)
        res = await db.execute(stmt)
        searches = res.scalars().all()
        writer.writerow(["ID", "Timestamp", "User Email", "Query", "Duration (ms)", "Results Count", "Success"])
        for s in searches:
            email = s.user.email if s.user else "Anonymous"
            writer.writerow([str(s.id), s.created_at.isoformat(), email, s.query, s.duration_ms, s.result_count, s.is_success])
            
    elif export_type == "uptime_logs":
        stmt = select(UptimeLog).order_by(UptimeLog.created_at.desc()).limit(1000)
        res = await db.execute(stmt)
        logs = res.scalars().all()
        writer.writerow(["ID", "Timestamp", "Service", "Status", "Latency (ms)"])
        for l in logs:
            writer.writerow([str(l.id), l.created_at.isoformat(), l.service, l.status, l.latency_ms])

    output.seek(0)
    
    if export_format == "xlsx":
        try:
            import openpyxl
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = export_type.replace("_", " ").title()
            
            reader = csv.reader(io.StringIO(output.getvalue()))
            for row in reader:
                ws.append(row)
                
            xlsx_buffer = io.BytesIO()
            wb.save(xlsx_buffer)
            xlsx_buffer.seek(0)
            
            response = StreamingResponse(xlsx_buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            filename = f"monitoring_export_{export_type}_{datetime.datetime.utcnow().strftime('%Y%m%d')}.xlsx"
            response.headers["Content-Disposition"] = f"attachment; filename={filename}"
            return response
        except ImportError:
            pass

    response = StreamingResponse(io.BytesIO(output.getvalue().encode("utf-8")), media_type="text/csv")
    filename = f"monitoring_export_{export_type}_{datetime.datetime.utcnow().strftime('%Y%m%d')}.csv"
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return response

@router.post("/purge")
async def purge_monitoring_stats_manually(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Allows super admins to manually wipe metrics older than 7 days.
    """
    assert_super_admin(current_user)
    
    retention_date = datetime.datetime.utcnow() - datetime.timedelta(days=7)
    
    # Purge ApiMetric
    api_del = text("DELETE FROM api_metrics WHERE created_at < :retention")
    search_del = text("DELETE FROM search_metrics WHERE created_at < :retention")
    uptime_del = text("DELETE FROM uptime_logs WHERE created_at < :retention")
    
    await db.execute(api_del, {"retention": retention_date})
    await db.execute(search_del, {"retention": retention_date})
    await db.execute(uptime_del, {"retention": retention_date})
    
    # Audit log entry for monitoring purge (Module 23)
    audit = AuditLog(
        user_id=current_user.id,
        action="monitoring_purge",
        target="metrics",
        meta={"retention_date": retention_date.isoformat()}
    )
    db.add(audit)
    await db.commit()
    
    return {"message": "Telemetry logs older than 7 days have been successfully purged."}


@router.get("/ready")
async def ready_check_endpoint(db: AsyncSession = Depends(get_db)):
    """
    Checks database, Redis, and Supabase connectivity for the ready probe.
    """
    # 1. Database connection check
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Monitoring ready check: Database failed. {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed"
        )

    # 2. Redis connection check
    try:
        if cache.redis_client:
            cache.redis_client.ping()
        else:
            import redis
            r = redis.from_url(settings.REDIS_URL)
            r.ping()
    except Exception as e:
        logger.error(f"Monitoring ready check: Redis failed. {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis connection failed"
        )

    # 3. Supabase connection check
    try:
        import requests
        base_url = f"{settings.SUPABASE_URL}/storage/v1"
        headers = {
            "Authorization": f"Bearer {settings.SUPABASE_KEY}",
            "apikey": settings.SUPABASE_KEY
        }
        check_url = f"{base_url}/bucket/{settings.SUPABASE_BUCKET}"
        response = requests.get(check_url, headers=headers, timeout=5)
        if response.status_code not in (200, 404):
            raise Exception(f"Supabase responded with status {response.status_code}")
    except Exception as e:
        logger.error(f"Monitoring ready check: Supabase failed. {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase connection failed"
        )

    return {"status": "ready"}

