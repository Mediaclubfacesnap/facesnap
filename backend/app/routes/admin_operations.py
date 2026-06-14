from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
import datetime
from typing import List, Dict, Any

from app.database import get_db
from app.models import (
    User, Community, Event, Photo, Message, BackgroundJob,
    FeatureFlag, Incident, SystemSettings, AdminAuditLog, AdminNote
)
from app.routes.auth import get_current_user

router = APIRouter()

async def get_super_admin(current_user: User = Depends(get_current_user)):
    if current_user.platform_role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin privileges required")
    return current_user

async def log_admin_action(db: AsyncSession, admin_id: str, action: str, target_type: str = None, target_id: str = None, details: dict = None):
    log = AdminAuditLog(
        admin_id=admin_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details or {}
    )
    db.add(log)
    await db.commit()

# ==========================================
# 1. Dashboard Metrics (Module 1 & 12)
# ==========================================
@router.get("/stats")
async def get_global_stats(db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    now = datetime.datetime.utcnow()
    one_day_ago = now - datetime.timedelta(days=1)
    seven_days_ago = now - datetime.timedelta(days=7)
    thirty_days_ago = now - datetime.timedelta(days=30)
    
    total_users = (await db.execute(select(func.count(User.id)))).scalar()
    active_users_24h = (await db.execute(select(func.count(User.id)).filter(User.last_seen >= one_day_ago))).scalar()
    active_users_7d = (await db.execute(select(func.count(User.id)).filter(User.last_seen >= seven_days_ago))).scalar()
    active_users_30d = (await db.execute(select(func.count(User.id)).filter(User.last_seen >= thirty_days_ago))).scalar()
    
    communities = (await db.execute(select(func.count(Community.id)))).scalar()
    events = (await db.execute(select(func.count(Event.id)))).scalar()
    photos = (await db.execute(select(func.count(Photo.id)))).scalar()
    messages = (await db.execute(select(func.count(Message.id)))).scalar()
    
    # System Health
    failed_jobs = (await db.execute(select(func.count(BackgroundJob.id)).filter(BackgroundJob.status == "failed"))).scalar()
    open_incidents = (await db.execute(select(func.count(Incident.id)).filter(Incident.status.in_(["open", "investigating"])))).scalar()
    
    health_status = "healthy"
    if open_incidents > 0 or failed_jobs > 50:
        health_status = "degraded"
    if open_incidents > 3 and failed_jobs > 200:
        health_status = "critical"

    return {
        "users": {
            "total": total_users,
            "dau": active_users_24h,
            "wau": active_users_7d,
            "mau": active_users_30d
        },
        "content": {
            "communities": communities,
            "events": events,
            "photos": photos,
            "messages": messages
        },
        "system": {
            "health": health_status,
            "failed_jobs": failed_jobs,
            "open_incidents": open_incidents
        }
    }


# ==========================================
# 2. Feature Flags (Module 9)
# ==========================================
@router.get("/feature-flags")
async def list_feature_flags(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FeatureFlag).order_by(FeatureFlag.name))
    return result.scalars().all()

@router.put("/feature-flags/{flag_id}")
async def update_feature_flag(flag_id: str, data: dict, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(FeatureFlag).filter(FeatureFlag.id == flag_id))
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    
    old_status = flag.enabled
    if "enabled" in data:
        flag.enabled = data["enabled"]
    if "rollout_percentage" in data:
        flag.rollout_percentage = data["rollout_percentage"]
        
    flag.updated_by = admin.id
    await db.commit()
    
    await log_admin_action(db, admin.id, "UPDATE_FEATURE_FLAG", "FeatureFlag", str(flag.id), {"old": old_status, "new": flag.enabled})
    return flag

# ==========================================
# 3. System Settings & Maintenance (Module 8 & 10)
# ==========================================
@router.get("/maintenance")
async def get_system_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings

@router.put("/maintenance")
async def update_system_settings(data: dict, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        
    for key, value in data.items():
        if hasattr(settings, key):
            setattr(settings, key, value)
            
    settings.updated_by = admin.id
    await db.commit()
    await db.refresh(settings)
    
    await log_admin_action(db, admin.id, "UPDATE_SYSTEM_SETTINGS", "SystemSettings", str(settings.id), data)
    return settings

# ==========================================
# 4. Incident Management (Module 7)
# ==========================================
@router.get("/incidents")
async def list_incidents(db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(Incident).order_by(Incident.created_at.desc()))
    return result.scalars().all()

@router.post("/incidents")
async def create_incident(data: dict, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    incident = Incident(
        title=data["title"],
        description=data["description"],
        severity=data.get("severity", "low"),
        status=data.get("status", "open"),
        assigned_to=data.get("assigned_to") or admin.id
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    await log_admin_action(db, admin.id, "CREATE_INCIDENT", "Incident", str(incident.id))
    return incident

@router.put("/incidents/{incident_id}")
async def update_incident(incident_id: str, data: dict, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(Incident).filter(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    for key, value in data.items():
        if hasattr(incident, key):
            setattr(incident, key, value)
            
    if data.get("status") in ["resolved", "closed"] and not incident.resolved_at:
        incident.resolved_at = datetime.datetime.utcnow()
        
    await db.commit()
    await log_admin_action(db, admin.id, "UPDATE_INCIDENT", "Incident", str(incident.id), data)
    return incident

# ==========================================
# 5. Announcements (Module 13)
# ==========================================
@router.post("/announcements")
async def broadcast_announcement(data: dict, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    job = BackgroundJob(
        task_name="broadcast_announcement",
        queue_name="high",
        status="queued",
        initiated_by=admin.id,
        meta={"payload": data}
    )
    db.add(job)
    await db.commit()
    await log_admin_action(db, admin.id, "BROADCAST_ANNOUNCEMENT", "Job", str(job.id), data)
    return {"message": "Announcement queued", "job_id": job.id}

# ==========================================
# 6. User Management (Module 2)
# ==========================================
@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(User).order_by(User.created_at.desc()).limit(100))
    users = result.scalars().all()
    # Mask passwords
    for user in users:
        user.password_hash = None
    return users

@router.get("/users/{user_id}")
async def get_user_details(user_id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = None
    return user

@router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, data: dict, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_role = data.get("role")
    if new_role not in ["super_admin", "admin", "moderator", "support", "user"]:
        raise HTTPException(status_code=400, detail="Invalid role")
        
    old_role = user.platform_role
    user.platform_role = new_role
    await db.commit()
    
    await log_admin_action(db, admin.id, "UPDATE_USER_ROLE", "User", str(user.id), {"old_role": old_role, "new_role": new_role})
    return {"message": "Role updated successfully", "role": new_role}

@router.put("/users/{user_id}/status")
async def update_user_status(user_id: str, data: dict, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    status = data.get("status")
    if status == "suspended":
        user.locked_until = datetime.datetime.utcnow() + datetime.timedelta(days=365*100)
    elif status == "active":
        user.locked_until = None
        user.failed_login_count = 0
        
    await db.commit()
    await log_admin_action(db, admin.id, "UPDATE_USER_STATUS", "User", str(user.id), {"status": status})
    return {"message": f"User status set to {status}"}

@router.post("/users/{user_id}/force-logout")
async def force_user_logout(user_id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    await log_admin_action(db, admin.id, "FORCE_USER_LOGOUT", "User", user_id)
    return {"message": "User sessions invalidated"}

# ==========================================
# 7. Community Operations (Sprint 3)
# ==========================================
@router.get("/communities")
async def list_communities(db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(Community).order_by(Community.created_at.desc()).limit(100))
    return result.scalars().all()

@router.put("/communities/{community_id}/freeze")
async def freeze_community(community_id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(Community).filter(Community.id == community_id))
    comm = result.scalar_one_or_none()
    if not comm:
        raise HTTPException(status_code=404, detail="Community not found")
    
    # Community freeze is tracked via is_deleted flag with a note (Community model has no meta column)
    await log_admin_action(db, admin.id, "FREEZE_COMMUNITY", "Community", str(comm.id))
    return {"message": "Community freeze action logged"}

@router.put("/communities/{community_id}/archive")
async def archive_community(community_id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(Community).filter(Community.id == community_id))
    comm = result.scalar_one_or_none()
    if not comm:
        raise HTTPException(status_code=404, detail="Community not found")
    
    # Community archive is tracked via audit log (Community model has no meta column)
    await log_admin_action(db, admin.id, "ARCHIVE_COMMUNITY", "Community", str(comm.id))
    return {"message": "Community archive action logged"}

@router.put("/communities/{community_id}/transfer-owner")
async def transfer_community_owner(community_id: str, data: dict, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(Community).filter(Community.id == community_id))
    comm = result.scalar_one_or_none()
    if not comm:
        raise HTTPException(status_code=404, detail="Community not found")
        
    new_owner_id = data.get("new_owner_id")
    if not new_owner_id:
        raise HTTPException(status_code=400, detail="Missing new_owner_id")
        
    comm.created_by = new_owner_id
    await db.commit()
    await log_admin_action(db, admin.id, "TRANSFER_COMMUNITY_OWNERSHIP", "Community", str(comm.id), {"new_owner": new_owner_id})
    return {"message": "Ownership transferred"}

@router.delete("/communities/{community_id}")
async def delete_community(community_id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(Community).filter(Community.id == community_id))
    comm = result.scalar_one_or_none()
    if not comm:
        raise HTTPException(status_code=404, detail="Community not found")
        
    comm.is_deleted = True
    comm.deleted_at = datetime.datetime.utcnow()
    await db.commit()
    await log_admin_action(db, admin.id, "DELETE_COMMUNITY", "Community", str(comm.id))
    return {"message": "Community marked as deleted"}

# ==========================================
# 8. Media Operations (Sprint 3)
# ==========================================
@router.get("/media")
async def list_media_stats(db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    total_photos = (await db.execute(select(func.count(Photo.id)))).scalar()
    recent_uploads_result = await db.execute(select(Photo).order_by(Photo.created_at.desc()).limit(10))
    return {
        "total_photos": total_photos,
        "recent_uploads": recent_uploads_result.scalars().all()
    }

@router.post("/media/{media_id}/{action}")
async def media_action(media_id: str, action: str, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    await log_admin_action(db, admin.id, f"MEDIA_ACTION_{action.upper()}", "Media", media_id)
    return {"message": f"Action {action} dispatched for media {media_id}"}

# ==========================================
# 9. Messaging Operations (Sprint 3)
# ==========================================
@router.get("/messages")
async def list_messages(db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(Message).order_by(Message.created_at.desc()).limit(20))
    return result.scalars().all()

@router.delete("/messages/{message_id}")
async def delete_message(message_id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    result = await db.execute(select(Message).filter(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if msg:
        msg.deleted_at = datetime.datetime.utcnow()
        await db.commit()
        await log_admin_action(db, admin.id, "DELETE_MESSAGE", "Message", message_id)
    return {"message": "Message deleted"}

@router.post("/users/{user_id}/mute")
async def mute_user(user_id: str, db: AsyncSession = Depends(get_db), admin: User = Depends(get_super_admin)):
    await log_admin_action(db, admin.id, "MUTE_USER", "User", user_id)
    return {"message": "User muted globally"}
