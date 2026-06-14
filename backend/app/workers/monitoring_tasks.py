import datetime
import time
import requests
import logging
from app.workers.celery_app import celery_app
from app.workers.tasks import get_sync_db
from app.models import UptimeLog, SecurityIncident, Notification, User, AuditLog
from app.services.cache_service import cache

logger = logging.getLogger(__name__)

@celery_app.task(name="app.workers.monitoring_tasks.ping_services_heartbeat")
def ping_services_heartbeat():
    """
    Module 7 & 8 & 13 & 18: Heartbeat checks for database, redis, workers, and API.
    Executed every 1 minute via Celery Beat.
    """
    now = datetime.datetime.utcnow()
    
    with get_sync_db() as db:
        # 1. Database check
        db_status = "healthy"
        db_latency = 0.0
        try:
            start_time = time.time()
            db.execute("SELECT 1")
            db_latency = (time.time() - start_time) * 1000
        except Exception as e:
            db_status = "unhealthy"
            logger.error(f"Heartbeat database failed: {e}")
            trigger_system_alert(db, "database", "Database connection lost or pool exhausted.")

        db_log = UptimeLog(
            service="database",
            status=db_status,
            latency_ms=db_latency,
            created_at=now
        )
        db.add(db_log)

        # 2. Redis Cache check
        redis_status = "healthy"
        redis_latency = 0.0
        try:
            if cache.redis_client:
                start_time = time.time()
                cache.redis_client.ping()
                redis_latency = (time.time() - start_time) * 1000
            else:
                redis_status = "unhealthy"
                trigger_system_alert(db, "cache", "Redis client is offline.")
        except Exception as e:
            redis_status = "unhealthy"
            logger.error(f"Heartbeat Redis failed: {e}")
            trigger_system_alert(db, "cache", "Redis connection error.")

        redis_log = UptimeLog(
            service="cache",
            status=redis_status,
            latency_ms=redis_latency,
            created_at=now
        )
        db.add(redis_log)

        # 3. API Check (localhost:8000 health ping)
        api_status = "healthy"
        api_latency = 0.0
        try:
            start_time = time.time()
            res = requests.get("http://localhost:8000/api/v1/health", timeout=3.0)
            api_latency = (time.time() - start_time) * 1000
            if res.status_code != 200:
                api_status = "unhealthy"
                trigger_system_alert(db, "api", f"API health check returned non-200: {res.status_code}")
        except Exception as e:
            api_status = "unhealthy"
            logger.error(f"Heartbeat API failed: {e}")
            trigger_system_alert(db, "api", "FastAPI server unreachable on port 8000.")

        api_log = UptimeLog(
            service="api",
            status=api_status,
            latency_ms=api_latency,
            created_at=now
        )
        db.add(api_log)

        # 4. Workers Cluster check
        workers_status = "healthy"
        workers_latency = 0.0
        try:
            start_time = time.time()
            inspector = celery_app.control.inspect()
            ping = inspector.ping()
            workers_latency = (time.time() - start_time) * 1000
            if not ping:
                workers_status = "unhealthy"
                trigger_system_alert(db, "worker", "Celery worker cluster offline (no workers responded).")
        except Exception as e:
            workers_status = "unhealthy"
            logger.error(f"Heartbeat Workers failed: {e}")
            trigger_system_alert(db, "worker", "Failed to contact Celery cluster.")

        worker_log = UptimeLog(
            service="worker",
            status=workers_status,
            latency_ms=workers_latency,
            created_at=now
        )
        db.add(worker_log)

        db.commit()


def trigger_system_alert(db, service: str, message: str):
    """
    Module 8 & 13: Alert Engine. Creates SecurityIncident and Notification alerts.
    """
    # 1. Log incident
    incident = SecurityIncident(
        incident_type="system_alert",
        severity="critical",
        description=f"CRITICAL SERVICE ALERT: {service.upper()} went down. {message}"
    )
    db.add(incident)

    # 2. Dispatch notification alerts to all super admins
    admins = db.query(User).filter(User.platform_role == "super_admin").all()
    for admin in admins:
        notif = Notification(
            user_id=admin.id,
            title="CRITICAL SERVICE ALERT",
            message=f"Platform Alert: Service '{service}' is down! Details: {message}",
            notification_type="system",
            target_url="/dashboard/admin/monitoring"
        )
        db.add(notif)


@celery_app.task(name="app.workers.monitoring_tasks.purge_monitoring_logs")
def purge_monitoring_logs():
    """
    Module 24: Automatically purge api telemetry logs and heartbeat records older than 30 days.
    Runs daily.
    """
    retention_days = 30
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=retention_days)
    
    with get_sync_db() as db:
        # Delete from api_metrics
        db.execute(
            text("DELETE FROM api_metrics WHERE created_at < :cutoff"),
            {"cutoff": cutoff}
        )
        # Delete from uptime_logs
        db.execute(
            text("DELETE FROM uptime_logs WHERE created_at < :cutoff"),
            {"cutoff": cutoff}
        )
        
        # Log cleanup in AuditLog
        purge_audit = AuditLog(
            action="automated_purge",
            target="telemetry_logs",
            meta={"retention_cutoff": cutoff.isoformat()}
        )
        db.add(purge_audit)
        db.commit()
    logger.info(f"Automated cleanup deleted telemetry logs older than 30 days (cutoff: {cutoff}).")
