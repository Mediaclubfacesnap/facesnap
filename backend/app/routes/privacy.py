from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any
from app.database import get_db
from app.routes.auth import get_current_user
from app.models import User, FacePrivacySettings, FacePrivacyAudit, ExportJob, FaceDeletionRequest, Notification
import datetime

router = APIRouter(prefix="/api/v1/privacy", tags=["privacy"])

# --- Helper to get or create privacy settings ---
async def get_or_create_privacy_settings(db: AsyncSession, user_id):
    result = await db.execute(select(FacePrivacySettings).where(FacePrivacySettings.user_id == user_id))
    settings = result.scalars().first()
    if not settings:
        settings = FacePrivacySettings(user_id=user_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings

async def log_audit(db: AsyncSession, user_id, action: str, old_value: str = None, new_value: str = None, ip_address: str = None):
    audit = FacePrivacyAudit(
        user_id=user_id,
        action=action,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        ip_address=ip_address
    )
    db.add(audit)
    
    # Notify user of critical privacy change
    notif = Notification(
        user_id=user_id,
        title="Privacy Settings Changed",
        message=f"Your privacy setting ({action}) was updated.",
        notification_type="security",
        priority="high"
    )
    db.add(notif)
    await db.commit()


@router.get("/settings")
async def get_privacy_settings(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    settings = await get_or_create_privacy_settings(db, current_user.id)
    return {
        "face_matching_enabled": settings.face_matching_enabled,
        "public_search_enabled": settings.public_search_enabled,
        "community_search_enabled": settings.community_search_enabled,
        "allow_face_suggestions": settings.allow_face_suggestions,
        "allow_group_discovery": settings.allow_group_discovery,
        "allow_relationship_graph": settings.allow_relationship_graph,
        "hide_from_directory": settings.hide_from_directory,
        "privacy_profile": settings.privacy_profile
    }

@router.put("/settings")
async def update_privacy_settings(updates: Dict[str, Any], current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    settings = await get_or_create_privacy_settings(db, current_user.id)
    
    for key, value in updates.items():
        if hasattr(settings, key):
            old_val = getattr(settings, key)
            if old_val != value:
                setattr(settings, key, value)
                await log_audit(db, current_user.id, f"update_{key}", old_val, value)
    
    settings.privacy_profile = "CUSTOM"
    await db.commit()
    await db.refresh(settings)
    
    return {"status": "success", "settings": settings}

@router.post("/preset")
async def apply_privacy_preset(data: Dict[str, str], current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    preset = data.get("preset", "").upper()
    settings = await get_or_create_privacy_settings(db, current_user.id)
    
    if preset == "STANDARD":
        settings.face_matching_enabled = True
        settings.public_search_enabled = True
        settings.community_search_enabled = True
        settings.allow_face_suggestions = True
        settings.hide_from_directory = False
    elif preset == "PRIVATE":
        settings.face_matching_enabled = True
        settings.public_search_enabled = False
        settings.community_search_enabled = True
        settings.allow_face_suggestions = False
        settings.hide_from_directory = True
    elif preset == "INVISIBLE":
        settings.face_matching_enabled = False
        settings.public_search_enabled = False
        settings.community_search_enabled = False
        settings.allow_face_suggestions = False
        settings.hide_from_directory = True
    else:
        raise HTTPException(status_code=400, detail="Invalid preset")
    
    settings.privacy_profile = preset
    await log_audit(db, current_user.id, "applied_preset", None, preset)
    await db.commit()
    
    return {"status": "success", "preset": preset}

@router.get("/audit")
async def get_privacy_audit(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(FacePrivacyAudit)
        .where(FacePrivacyAudit.user_id == current_user.id)
        .order_by(FacePrivacyAudit.created_at.desc())
        .limit(50)
    )
    audits = result.scalars().all()
    return [{"action": a.action, "old_value": a.old_value, "new_value": a.new_value, "timestamp": a.created_at} for a in audits]

@router.post("/disable-face-matching")
async def disable_face_matching(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    settings = await get_or_create_privacy_settings(db, current_user.id)
    if settings.face_matching_enabled:
        settings.face_matching_enabled = False
        await log_audit(db, current_user.id, "disable_face_matching", True, False)
        await db.commit()
    return {"status": "success", "face_matching_enabled": False}

@router.post("/enable-face-matching")
async def enable_face_matching(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    settings = await get_or_create_privacy_settings(db, current_user.id)
    if not settings.face_matching_enabled:
        settings.face_matching_enabled = True
        await log_audit(db, current_user.id, "enable_face_matching", False, True)
        await db.commit()
    return {"status": "success", "face_matching_enabled": True}

@router.get("/face-status")
async def face_status(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.models import VerificationSession
    result = await db.execute(
        select(VerificationSession)
        .where(VerificationSession.user_id == current_user.id)
        .where(VerificationSession.status == "verified")
    )
    sessions = result.scalars().all()
    registered = len(sessions) > 0
    
    return {
        "registered": registered,
        "embedding_count": len(sessions),
        "last_updated": sessions[-1].created_at if registered else None
    }

@router.get("/match-history")
async def match_history(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Placeholder for match history, typically you'd query PhotoFace or similar.
    # For now, returning empty array or a mock since the actual relationship may vary.
    return []

@router.post("/delete-face-data")
async def request_face_deletion(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Create request
    req = FaceDeletionRequest(
        user_id=current_user.id,
        scheduled_deletion_at=datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    )
    db.add(req)
    
    # Notify user
    notif = Notification(
        user_id=current_user.id,
        title="Face Deletion Requested",
        message="Your face data deletion has been scheduled. You have 24 hours to cancel.",
        notification_type="security",
        priority="critical"
    )
    db.add(notif)
    await db.commit()
    
    return {"status": "success", "message": "Deletion scheduled in 24 hours"}

@router.post("/confirm-face-deletion")
async def confirm_face_deletion(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.models import VerificationSession
    
    # Fetch pending request
    result = await db.execute(
        select(FaceDeletionRequest)
        .where(FaceDeletionRequest.user_id == current_user.id)
        .where(FaceDeletionRequest.confirmed == False)
        .where(FaceDeletionRequest.cancelled == False)
    )
    req = result.scalars().first()
    if not req:
        raise HTTPException(status_code=400, detail="No pending deletion request found.")
    
    # Proceed with deletion
    req.confirmed = True
    req.completed_at = datetime.datetime.utcnow()
    
    # Delete verification sessions (which hold face embeddings)
    await db.execute(
        select(VerificationSession).where(VerificationSession.user_id == current_user.id)
    )
    # Actually we should delete them
    sessions_res = await db.execute(select(VerificationSession).where(VerificationSession.user_id == current_user.id))
    for s in sessions_res.scalars().all():
        await db.delete(s)
        
    # Disable matching
    settings = await get_or_create_privacy_settings(db, current_user.id)
    settings.face_matching_enabled = False
    
    await log_audit(db, current_user.id, "face_data_deleted", "Active", "Deleted")
    
    notif = Notification(
        user_id=current_user.id,
        title="Face Data Deleted",
        message="Your facial embeddings have been permanently deleted.",
        notification_type="security",
        priority="critical"
    )
    db.add(notif)
    await db.commit()
    return {"status": "success"}

@router.post("/cancel-face-deletion")
async def cancel_face_deletion(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(FaceDeletionRequest)
        .where(FaceDeletionRequest.user_id == current_user.id)
        .where(FaceDeletionRequest.confirmed == False)
        .where(FaceDeletionRequest.cancelled == False)
    )
    req = result.scalars().first()
    if req:
        req.cancelled = True
        await db.commit()
        return {"status": "success"}
    raise HTTPException(status_code=400, detail="No pending request")

@router.post("/export")
async def request_data_export(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.workers.export_tasks import export_user_data_task
    
    job = ExportJob(user_id=current_user.id)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    
    export_user_data_task.delay(str(job.id), str(current_user.id))
    
    return {"status": "success", "job_id": job.id}

@router.get("/export-status/{job_id}")
async def get_export_status(job_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExportJob).where(ExportJob.id == job_id, ExportJob.user_id == current_user.id))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "status": job.status,
        "progress": job.progress,
        "download_url": job.download_url
    }
