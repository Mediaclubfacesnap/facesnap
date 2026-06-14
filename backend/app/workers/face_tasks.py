import logging
import requests
import numpy as np
import datetime
from app.workers.celery_app import celery_app
from app.workers.tasks import get_sync_db, update_job_status
from app.models import Photo, CommunityMedia, PhotoFace, User, VerificationSession, PhotoFaceMatch
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

@celery_app.task(name="app.workers.face_tasks.process_face_matching", bind=True, max_retries=3, default_retry_delay=60)
def process_face_matching(self, photo_id: str = None, media_id: str = None, job_id: str = None):
    """
    Module 4: Face Matching Queue Background Job
    Downloads file from storage, runs MTCNN extraction and VGGFace2 embedding,
    performs pgvector face similarity lookup, and persists matches in database.
    """
    logger.info(f"Starting Face Matching Task: photo_id={photo_id}, media_id={media_id}, job_id={job_id}")
    
    if job_id:
        update_job_status(job_id, status="running", progress=10, progress_message="Initializing face matching pipeline...", worker_name=self.request.hostname)
        
    try:
        url = None
        event_id = None
        community_id = None
        
        with get_sync_db() as db:
            if photo_id:
                photo = db.query(Photo).filter(Photo.id == photo_id).first()
                if not photo:
                    raise Exception(f"Photo with ID {photo_id} not found in database.")
                url = photo.storage_path
                event_id = photo.event_id
                # Find community_id from event
                event = photo.event
                if event:
                    community_id = event.community_id
            elif media_id:
                media = db.query(CommunityMedia).filter(CommunityMedia.id == media_id).first()
                if not media:
                    raise Exception(f"CommunityMedia with ID {media_id} not found in database.")
                url = media.file_url
                community_id = media.community_id
            else:
                raise Exception("Neither photo_id nor media_id was provided to face matching task.")
                
            if community_id:
                from app.models import Community
                community = db.query(Community).filter(Community.id == community_id).first()
                if community and community.archived_at is not None:
                    logger.info(f"Skipping face matching task: Community {community_id} is archived.")
                    from app.models import AuditLog
                    audit = AuditLog(
                        action="Recognition Skipped (Archived)",
                        target=f"Community {community_id} is archived",
                        target_id=community_id
                    )
                    db.add(audit)
                    db.commit()
                    if job_id:
                        update_job_status(job_id, status="completed", progress=100, progress_message="Skipped face matching because community is archived.")
                    return {"status": "skipped", "reason": "community archived"}

            from app.models import AuditLog
            audit = AuditLog(
                action="Recognition Started",
                target=f"Face recognition analysis started for photo_id={photo_id} or media_id={media_id}",
                target_id=photo_id if photo_id else media_id
            )
            db.add(audit)
            db.commit()
        
        if not url:
            raise Exception("Failed to resolve storage URL/path for matching task.")

        if job_id:
            update_job_status(job_id, status="running", progress=30, progress_message="Downloading media asset from cloud storage...")

        # Download image bytes
        logger.info(f"Downloading file from URL: {url}")
        res = requests.get(url, timeout=30)
        if res.status_code != 200:
            raise Exception(f"Failed to download media file from storage (HTTP {res.status_code})")
        image_bytes = res.content

        if job_id:
            update_job_status(job_id, status="running", progress=50, progress_message="Extracting faces and generating embeddings using AI models...")

        # Extract faces using AIService
        faces = AIService.extract_faces(image_bytes)
        logger.info(f"Extracted {len(faces)} faces from image.")

        with get_sync_db() as db:
            # If photo_id, save the extracted faces into PhotoFace table
            if photo_id:
                # Clear any existing faces to prevent duplicate entry errors on retries
                db.query(PhotoFace).filter(PhotoFace.photo_id == photo_id).delete()
                
                for face in faces:
                    new_face = PhotoFace(
                        photo_id=photo_id,
                        bbox=face["bbox"],
                        embedding=face["embedding"]
                    )
                    db.add(new_face)
                
                # Mark photo status as indexed
                photo = db.query(Photo).filter(Photo.id == photo_id).first()
                if photo:
                    photo.status = "indexed"
                db.commit()

        if job_id:
            update_job_status(job_id, status="running", progress=75, progress_message="Matching faces against registered user profiles...")

        matches_count = 0
        user_new_matches = {} # user_id -> count of matches

        # Fetch all user verification embeddings (only members of this community OR super_admin)
        with get_sync_db() as db:
            from app.models import FacePrivacySettings, CommunityRole, AuditLog
            member_ids_query = db.query(CommunityRole.user_id).filter(CommunityRole.community_id == community_id)
            
            # Log Recognition Blocked (Privacy) for users with face matching disabled
            blocked_users = (
                db.query(User.id)
                .join(VerificationSession, User.id == VerificationSession.user_id)
                .outerjoin(FacePrivacySettings, User.id == FacePrivacySettings.user_id)
                .filter(
                    VerificationSession.status == "verified",
                    VerificationSession.face_embedding.isnot(None),
                    (User.platform_role != 'super_admin') & User.id.in_(member_ids_query),
                    (FacePrivacySettings.face_matching_enabled == False) |
                    (FacePrivacySettings.id.is_(None) & (User.face_matching_enabled == False))
                )
                .all()
            )
            for bu_id, in blocked_users:
                audit_blocked = AuditLog(
                    user_id=bu_id,
                    action="Recognition Blocked (Privacy)",
                    target=f"User face recognition candidate blocked due to privacy settings.",
                    target_id=photo_id if photo_id else media_id
                )
                db.add(audit_blocked)
            db.commit()

            user_rows = (
                db.query(User.id, VerificationSession.face_embedding)
                .join(VerificationSession, User.id == VerificationSession.user_id)
                .outerjoin(FacePrivacySettings, User.id == FacePrivacySettings.user_id)
                .filter(
                    # If FacePrivacySettings exists, use its value, else fallback to User.face_matching_enabled
                    (FacePrivacySettings.face_matching_enabled == True) | 
                    (FacePrivacySettings.id.is_(None) & (User.face_matching_enabled == True)),
                    VerificationSession.status == "verified",
                    VerificationSession.face_embedding.isnot(None),
                    (User.platform_role == 'super_admin') | User.id.in_(member_ids_query)
                )
                .order_by(VerificationSession.created_at.desc())
                .all()
            )
            
            user_embeddings = {}
            for u_id, emb in user_rows:
                if u_id not in user_embeddings:
                    user_embeddings[u_id] = emb

            if user_embeddings and faces:
                for face in faces:
                    face_emb = np.array(face["embedding"])
                    
                    for u_id, u_emb in user_embeddings.items():
                        emb2 = np.array(u_emb)
                        dot_product = np.dot(face_emb, emb2)
                        norm1 = np.linalg.norm(face_emb)
                        norm2 = np.linalg.norm(emb2)
                        similarity = dot_product / (norm1 * norm2) if norm1 > 0 and norm2 > 0 else 0.0
                        
                        if similarity >= 0.75:
                            # Check duplicate
                            existing_match = db.query(PhotoFaceMatch).filter(
                                PhotoFaceMatch.photo_id == photo_id if photo_id else PhotoFaceMatch.media_id == media_id,
                                PhotoFaceMatch.user_id == u_id
                            ).first()
                            
                            if not existing_match:
                                status_val = "approved" if similarity >= 0.90 else "pending"
                                new_match = PhotoFaceMatch(
                                    photo_id=photo_id,
                                    media_id=media_id,
                                    user_id=u_id,
                                    confidence_score=float(similarity),
                                    is_verified_match=(status_val == "approved"),
                                    status=status_val
                                )
                                db.add(new_match)
                                matches_count += 1
                                user_new_matches[str(u_id)] = user_new_matches.get(str(u_id), 0) + 1
                
                db.commit()

        # Log completion audit log
        with get_sync_db() as db:
            from app.models import AuditLog
            audit = AuditLog(
                action="Recognition Completed",
                target=f"Face recognition analysis completed. Matches created: {matches_count}",
                target_id=photo_id if photo_id else media_id
            )
            db.add(audit)
            db.commit()

        logger.info(f"Face matching completed. Created {matches_count} new face matches.")

        if job_id:
            update_job_status(job_id, status="running", progress=90, progress_message="Dispatching match notifications to users...")

        # Dispatch notifications if there are matches
        if user_new_matches:
            from app.workers.notification_tasks import send_notification_batch
            from app.workers.memory_tasks import generate_user_memories
            send_notification_batch.delay(
                user_new_matches=user_new_matches,
                photo_id=photo_id,
                media_id=media_id,
                community_id=str(community_id) if community_id else None,
                event_id=str(event_id) if event_id else None
            )
            # Trigger Memory Generation asynchronously for each matched user
            for u_id in user_new_matches.keys():
                generate_user_memories.delay(user_id=u_id)

        if job_id:
            update_job_status(
                job_id,
                status="completed",
                progress=100,
                progress_message="Face matching completed successfully!",
                result={"faces_detected": len(faces), "matches_created": matches_count}
            )
            
        return {"status": "success", "faces_detected": len(faces), "matches_created": matches_count}
        
    except Exception as e:
        logger.error(f"Error in process_face_matching: {e}", exc_info=True)
        if job_id:
            update_job_status(job_id, status="failed", error_message=str(e), progress_message="Face matching failed due to an internal error.")
        # Trigger Celery autoretry
        raise self.retry(exc=e)


# Run startup validation
validate_worker_boot("FaceTasks", check_supabase=True)

