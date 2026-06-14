from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID
import logging
import datetime
from app.database import get_db
from app.models import BackgroundJob, User
from app.routes.auth import get_current_user

from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Background Jobs"])

class JobResponse(BaseModel):
    id: UUID
    task_id: Optional[str] = None
    task_name: str
    queue_name: str
    status: str
    priority: int
    queued_at: datetime.datetime
    started_at: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None
    initiated_by: Optional[UUID] = None
    worker_name: Optional[str] = None
    progress: int
    progress_message: Optional[str] = None
    result: Optional[dict] = None
    error_message: Optional[str] = None
    retry_count: int
    max_retries: int
    parent_job_id: Optional[UUID] = None
    depends_on_job_id: Optional[UUID] = None
    meta: Optional[dict] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


@router.get("/jobs", response_model=List[JobResponse])
async def list_jobs(
    limit: int = 50,
    offset: int = 0,
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    GET /jobs
    Retrieve a paginated list of background jobs.
    Super Admins see all jobs, while normal users can only view jobs they initiated.
    """
    stmt = select(BackgroundJob)
    
    if current_user.platform_role != "super_admin":
        stmt = stmt.where(BackgroundJob.initiated_by == current_user.id)
        
    if status_filter:
        stmt = stmt.where(BackgroundJob.status == status_filter)
        
    stmt = stmt.order_by(BackgroundJob.created_at.desc()).limit(limit).offset(offset)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/jobs/stats")
async def get_job_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    GET /jobs/stats
    Aggregated job execution counts. Super Admin access only.
    """
    if current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Super Admin role required."
        )
        
    stmt = select(BackgroundJob.status, func.count(BackgroundJob.id)).group_by(BackgroundJob.status)
    res = await db.execute(stmt)
    stats = {row[0]: row[1] for row in res.all()}
    
    # Fill in default zeros for missing statuses
    for s in ["queued", "running", "completed", "failed", "cancelled", "paused"]:
        if s not in stats:
            stats[s] = 0
            
    stats["total"] = sum(stats.values())
    return stats


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job_detail(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    GET /jobs/{id}
    Retrieve details and real-time progress metric of a specific background job.
    """
    stmt = select(BackgroundJob).where(BackgroundJob.id == job_id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Background job not found."
        )
        
    if current_user.platform_role != "super_admin" and job.initiated_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You can only view details of your own queued jobs."
        )
        
    return job


@router.get("/worker-health")
async def get_worker_health(
    current_user: User = Depends(get_current_user)
):
    """
    GET /worker-health
    Super Admin monitoring view displaying Celery cluster ping and active job details.
    """
    if current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Super Admin role required."
        )
    
    from app.workers.celery_app import celery_app
    try:
        inspect = celery_app.control.inspect()
        
        # In case Redis or celery is not active/configured
        ping = inspect.ping()
        active = inspect.active()
        scheduled = inspect.scheduled()
        
        workers_count = len(ping.keys()) if ping else 0
        active_jobs = sum(len(tasks) for tasks in active.values()) if active else 0
        scheduled_jobs = sum(len(tasks) for tasks in scheduled.values()) if scheduled else 0
        
        return {
            "status": "healthy" if workers_count > 0 else "degraded",
            "workers": workers_count,
            "active_jobs": active_jobs,
            "queued_jobs": scheduled_jobs,
            "details": ping if ping else {}
        }
    except Exception as e:
        logger.warning(f"Worker health check Degraded: {e}")
        return {
            "status": "offline",
            "workers": 0,
            "active_jobs": 0,
            "queued_jobs": 0,
            "error": str(e)
        }


@router.post("/jobs/retry/{job_id}", response_model=JobResponse)
async def retry_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    POST /jobs/retry/{id}
    Manually retry a failed background job. Super Admin access only.
    """
    if current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Super Admin role required."
        )
        
    stmt = select(BackgroundJob).where(BackgroundJob.id == job_id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Background job not found."
        )
        
    if job.status not in ["failed", "cancelled"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only failed or cancelled background jobs can be retried."
        )
    
    from app.workers.celery_app import celery_app
    # Re-trigger Celery task dynamically using send_task
    kwargs = job.meta.get("args", {}) if job.meta else {}
    # Make sure we pass the job_id to the task so it continues writing logs
    kwargs["job_id"] = str(job.id)
    
    try:
        new_task = celery_app.send_task(
            name=job.task_name,
            kwargs=kwargs,
            queue=job.queue_name
        )
        
        # Reset database job record
        job.task_id = new_task.id
        job.status = "queued"
        job.progress = 0
        job.progress_message = "Re-queued manually by Super Admin."
        job.error_message = None
        job.retry_count += 1
        job.started_at = None
        job.completed_at = None
        
        await db.commit()
        await db.refresh(job)
        return job
    except Exception as e:
        logger.error(f"Failed to retry Celery job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger Celery retry: {e}"
        )


@router.post("/jobs/cancel/{job_id}", response_model=JobResponse)
async def cancel_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    POST /jobs/cancel/{id}
    Revoke/terminate a running or queued background job. Super Admin access only.
    """
    if current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Super Admin role required."
        )
        
    stmt = select(BackgroundJob).where(BackgroundJob.id == job_id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Background job not found."
        )
        
    if job.status not in ["queued", "running"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only queued or running jobs can be cancelled."
        )
        
    # Revoke via Celery control API
    if job.task_id:
        try:
            celery_app.control.revoke(job.task_id, terminate=True)
        except Exception as e:
            logger.warning(f"Error revoking Celery task ID {job.task_id}: {e}")
            
    # Mark job cancelled in Database
    job.status = "cancelled"
    job.progress_message = "Cancelled/Revoked manually by Super Admin."
    job.completed_at = datetime.datetime.utcnow()
    
    await db.commit()
    await db.refresh(job)
    return job
