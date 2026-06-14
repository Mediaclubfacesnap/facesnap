import json
import zipfile
import os
import io
from celery_app import celery_app
from app.workers.tasks import SyncSessionLocal as SessionLocal, validate_worker_boot
from app.models import ExportJob, User, Community, Photo, PhotoFace, Notification, FacePrivacySettings, FacePrivacyAudit, Message
from sqlalchemy import select
import datetime

@celery_app.task(name="export_user_data_task")
def export_user_data_task(job_id: str, user_id: str):
    db = SessionLocal()
    try:
        # Mark as processing
        job = db.query(ExportJob).filter(ExportJob.id == job_id).first()
        if not job:
            return
        
        job.status = "PROCESSING"
        job.progress = 10
        db.commit()

        # 1. Fetch User Profile
        user = db.query(User).filter(User.id == user_id).first()
        profile_data = {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "created_at": user.created_at.isoformat()
        }
        job.progress = 20
        db.commit()

        # 2. Fetch Privacy Settings & Audit
        settings = db.query(FacePrivacySettings).filter(FacePrivacySettings.user_id == user_id).first()
        settings_data = {
            "face_matching_enabled": settings.face_matching_enabled if settings else True,
            "public_search_enabled": settings.public_search_enabled if settings else True,
            "privacy_profile": settings.privacy_profile if settings else "STANDARD"
        }
        
        audits = db.query(FacePrivacyAudit).filter(FacePrivacyAudit.user_id == user_id).all()
        audit_data = [{"action": a.action, "timestamp": a.created_at.isoformat()} for a in audits]

        job.progress = 40
        db.commit()

        # 3. Create ZIP Archive in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            zip_file.writestr("profile.json", json.dumps(profile_data, indent=2))
            zip_file.writestr("privacy_settings.json", json.dumps(settings_data, indent=2))
            zip_file.writestr("audit_history.json", json.dumps(audit_data, indent=2))
            # Mock other data for now (notifications, photos, communities)
            zip_file.writestr("notifications.json", json.dumps([], indent=2))
            zip_file.writestr("face_matches.json", json.dumps([], indent=2))
        
        job.progress = 80
        db.commit()
        
        # In a real system, you would upload this zip_buffer to S3/Supabase Storage
        # and get a signed download URL.
        # Here we mock the URL
        
        fake_url = f"https://storage.facesnap.com/exports/{user_id}/export_{job_id}.zip"
        
        job.status = "READY"
        job.progress = 100
        job.download_url = fake_url
        job.completed_at = datetime.datetime.utcnow()
        job.file_size = zip_buffer.tell()
        
        # Notify User
        notif = Notification(
            user_id=user_id,
            title="Data Export Ready",
            message="Your data export is ready for download.",
            notification_type="system",
            priority="high",
            target_url="/dashboard/settings/privacy"
        )
        # Audit log
        from app.models import AuditLog
        audit = AuditLog(
            user_id=user_id,
            action="Export generated",
            target=f"Data export zip generated for user: {user_id}",
            target_id=job.id
        )
        db.add(audit)
        
        db.commit()
        
    except Exception as e:
        db.rollback()
        job = db.query(ExportJob).filter(ExportJob.id == job_id).first()
        if job:
            job.status = "FAILED"
            db.commit()
        raise e
    finally:
        db.close()


# Run startup validation
validate_worker_boot("ExportTasks")

