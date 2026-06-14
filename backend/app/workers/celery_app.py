import os
from celery import Celery
from celery.schedules import crontab
from app.config import settings

import sys

_is_celery = "celery" in sys.argv[0] or "celery" in sys.modules

celery_app = Celery(
    "facesnap_workers",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.face_tasks",
        "app.workers.highlight_tasks",
        "app.workers.notification_tasks",
        "app.workers.analytics_tasks",
        "app.workers.cleanup_tasks",
        "app.workers.export_tasks",
        "app.workers.monitoring_tasks",
        "app.workers.recovery_tasks",
        "app.workers.memory_tasks"
    ] if _is_celery else []
)

# Celery Configuration
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_default_queue="default",
    task_routes={
        "app.workers.face_tasks.*": {"queue": "high"},
        "app.workers.notification_tasks.send_notification_batch": {"queue": "high"},
        "app.workers.highlight_tasks.*": {"queue": "medium"},
        "app.workers.notification_tasks.generate_weekly_digest": {"queue": "medium"},
        "app.workers.analytics_tasks.*": {"queue": "low"},
        "app.workers.cleanup_tasks.*": {"queue": "low"},
        "app.workers.monitoring_tasks.*": {"queue": "low"},
        "app.workers.recovery_tasks.*": {"queue": "low"},
    },
    result_expires=86400,
)

# Scheduled Tasks (Celery Beat)
celery_app.conf.beat_schedule = {
    "cleanup-media-every-24h": {
        "task": "app.workers.cleanup_tasks.cleanup_media_job",
        "schedule": crontab(hour=0, minute=0), # Daily at midnight
    },
    "weekly-digest-every-sunday": {
        "task": "app.workers.notification_tasks.generate_weekly_digest",
        "schedule": crontab(day_of_week=0, hour=6, minute=0), # Sunday 6 AM
    },
    "nightly-search-analytics-rollup": {
        "task": "app.workers.analytics_tasks.rollup_nightly",
        "schedule": crontab(hour=2, minute=0), # Daily at 2 AM
    },
    "ping-services-heartbeat-every-1m": {
        "task": "app.workers.monitoring_tasks.ping_services_heartbeat",
        "schedule": 60.0, # Every 60 seconds (1 minute)
    },
    "purge-monitoring-logs-every-24h": {
        "task": "app.workers.monitoring_tasks.purge_monitoring_logs",
        "schedule": crontab(hour=1, minute=0), # Daily at 1 AM
    },
    "daily-database-backup-at-3am": {
        "task": "app.workers.recovery_tasks.trigger_backup_job",
        "schedule": crontab(hour=3, minute=0),
        "kwargs": {"backup_type": "daily"}
    },
    "incremental-backup-every-6h": {
        "task": "app.workers.recovery_tasks.trigger_backup_job",
        "schedule": crontab(minute=0, hour="*/6"),
        "kwargs": {"backup_type": "incremental"}
    },
    "weekly-system-backup-sunday-4am": {
        "task": "app.workers.recovery_tasks.trigger_backup_job",
        "schedule": crontab(day_of_week=0, hour=4, minute=0),
        "kwargs": {"backup_type": "weekly"}
    },
    "monthly-archive-backup-1st-5am": {
        "task": "app.workers.recovery_tasks.trigger_backup_job",
        "schedule": crontab(day_of_month=1, hour=5, minute=0),
        "kwargs": {"backup_type": "monthly"}
    },
    "enforce-retention-policy-daily-6am": {
        "task": "app.workers.recovery_tasks.enforce_retention_policy",
        "schedule": crontab(hour=6, minute=0),
    },
    "nightly-memory-consolidation": {
        "task": "app.workers.memory_tasks.nightly_memory_consolidation",
        "schedule": crontab(hour=4, minute=0),
    }
}
