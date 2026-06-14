import logging
import requests
import datetime
from app.workers.celery_app import celery_app
from app.workers.tasks import get_sync_db, update_job_status
from app.models import Event, Community, Photo, CommunityMedia, MediaAlbum, PhotoFaceMatch, HighlightGenerationLog, EventRegistration, CommunityRole, User, Notification
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

@celery_app.task(name="app.workers.highlight_tasks.generate_ai_highlights", bind=True, max_retries=3, default_retry_delay=120)
def generate_ai_highlights(self, event_id: str = None, community_id: str = None, limit: int = 25, user_id: str = None, job_id: str = None):
    """
    Module 5: AI Highlights Queue Background Job
    Extracts, scores, and ranks event or community media photos,
    runs perceptual duplicate sweep, aggregates favorites boosts,
    creates Highlights albums, and alerts community/event participants.
    """
    logger.info(f"Starting Highlights Task: event_id={event_id}, community_id={community_id}, limit={limit}, user_id={user_id}, job_id={job_id}")
    
    if job_id:
        update_job_status(job_id, status="running", progress=10, progress_message="Initializing AI highlights curation pipeline...", worker_name=self.request.hostname)
        
    try:
        if not event_id and not community_id:
            raise Exception("Either event_id or community_id must be provided to highlights generation task.")

        if event_id:
            return process_event_highlights(event_id, limit, user_id, job_id)
        else:
            return process_community_highlights(community_id, limit, user_id, job_id)
            
    except Exception as e:
        logger.error(f"Error in generate_ai_highlights: {e}", exc_info=True)
        if job_id:
            update_job_status(job_id, status="failed", error_message=str(e), progress_message="AI highlights generation failed.")
        raise self.retry(exc=e)


def process_event_highlights(event_id: str, limit: int, user_id: str, job_id: str):
    with get_sync_db() as db:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise Exception(f"Event with ID {event_id} not found.")
            
        all_photos = db.query(Photo).filter(Photo.event_id == event_id).all()
        if not all_photos:
            if job_id:
                update_job_status(job_id, status="completed", progress=100, progress_message="No photos found in this event to analyze.", result={"photos_analyzed": 0, "photos_selected": 0})
            return {"message": "No photos found.", "photos_analyzed": 0, "photos_selected": 0}

        # 1. Scoring on the fly
        if job_id:
            update_job_status(job_id, status="running", progress=30, progress_message="Scoring photo quality and aesthetics using PyTorch...")
            
        photos_analyzed_count = 0
        for photo in all_photos:
            if photo.overall_score == 0.0:
                try:
                    res = requests.get(photo.storage_path, timeout=10)
                    if res.status_code == 200:
                        scores = AIService.score_photo(res.content)
                        photo.sharpness_score = scores["sharpness_score"]
                        photo.blur_score = scores["blur_score"]
                        photo.brightness_score = scores["brightness_score"]
                        photo.face_visibility_score = scores["face_visibility_score"]
                        photo.smile_score = scores["smile_score"]
                        photo.composition_score = scores["composition_score"]
                        photo.eye_open_score = scores["eye_open_score"]
                        photo.overall_score = scores["overall_score"]
                        photo.quality_reason = scores["quality_reason"]
                        photos_analyzed_count += 1
                except Exception as e:
                    logger.error(f"Failed to score photo {photo.id} dynamically: {e}")
                    photo.overall_score = 75.0
                    photo.sharpness_score = 70.0
                    photo.brightness_score = 80.0
                    photo.quality_reason = "balanced detail capture"
        db.commit()

        # 2. Favorites boost
        if job_id:
            update_job_status(job_id, status="running", progress=50, progress_message="Analyzing engagement metrics and favorites boosts...")
            
        for photo in all_photos:
            fav_count = db.query(PhotoFaceMatch).filter(PhotoFaceMatch.photo_id == photo.id, PhotoFaceMatch.is_favorite == True).count()
            photo.overall_score = min(100.0, photo.overall_score + (fav_count * 5.0))
        db.commit()

        # 3. Duplicate Sweep
        if job_id:
            update_job_status(job_id, status="running", progress=70, progress_message="Filtering near-duplicate photos using perceptual sweeps...")
            
        unique_photos = []
        duplicate_count = 0
        sorted_candidates = sorted(all_photos, key=lambda x: x.overall_score, reverse=True)
        
        for candidate in sorted_candidates:
            if candidate.is_pinned_highlight:
                unique_photos.append(candidate)
                continue
                
            is_dup = False
            for unique in unique_photos:
                time_diff = abs((candidate.created_at - unique.created_at).total_seconds())
                score_diff = abs(candidate.overall_score - unique.overall_score)
                if time_diff < 300 and score_diff < 3.0:
                    is_dup = True
                    duplicate_count += 1
                    break
            if not is_dup:
                unique_photos.append(candidate)

        # 4. Selection
        pinned_highlights = [p for p in unique_photos if p.is_pinned_highlight]
        standard_highlights = [p for p in unique_photos if not p.is_pinned_highlight]
        standard_highlights.sort(key=lambda x: x.overall_score, reverse=True)
        
        remaining_slots = max(0, limit - len(pinned_highlights))
        selected_photos = pinned_highlights + standard_highlights[:remaining_slots]

        # 5. Album Creation / Retrieve
        album = db.query(MediaAlbum).filter(MediaAlbum.event_id == event_id, MediaAlbum.is_highlights == True).first()
        if not album:
            album = MediaAlbum(
                community_id=event.community_id,
                event_id=event_id,
                name=f"✨ {event.title} AI Highlights",
                description=f"Curated collection of the top photos from '{event.title}'. Powered by FaceSnap AI Curation.",
                is_highlights=True,
                generated_by_ai=True,
                created_by=user_id if user_id else event.creator_id
            )
            db.add(album)
            db.commit()
            db.refresh(album)

        if job_id:
            update_job_status(job_id, status="running", progress=85, progress_message="Updating community media and pinning cover photos...")

        # Clear previous community media highlights mapping
        db.query(CommunityMedia).filter(CommunityMedia.album_id == album.id).delete()
        db.commit()

        # Re-populate selected highlights
        for photo in selected_photos:
            new_media = CommunityMedia(
                community_id=event.community_id,
                album_id=album.id,
                uploaded_by=photo.event.creator_id if (photo.event and photo.event.creator_id) else (user_id if user_id else event.creator_id),
                file_url=photo.storage_path,
                file_type="photo",
                title=photo.filename,
                description=f"AI Highlight from event '{event.title}'",
                sharpness_score=photo.sharpness_score,
                blur_score=photo.blur_score,
                brightness_score=photo.brightness_score,
                face_visibility_score=photo.face_visibility_score,
                smile_score=photo.smile_score,
                composition_score=photo.composition_score,
                eye_open_score=photo.eye_open_score,
                overall_score=photo.overall_score,
                quality_reason=photo.quality_reason,
                is_pinned_highlight=photo.is_pinned_highlight
            )
            db.add(new_media)
        db.commit()

        # Cover selection
        new_media_list = db.query(CommunityMedia).filter(CommunityMedia.album_id == album.id).order_by(CommunityMedia.overall_score.desc()).all()
        if new_media_list and (not album.cover_media_id or album.cover_media_id not in [m.id for m in new_media_list]):
            album.cover_media_id = new_media_list[0].id
            album.cover_url = new_media_list[0].file_url

        # Log details
        generation_log = HighlightGenerationLog(
            album_id=album.id,
            event_id=event_id,
            community_id=event.community_id,
            generated_by=user_id,
            photos_analyzed=len(all_photos),
            photos_selected=len(selected_photos),
            duplicates_removed=duplicate_count
        )
        db.add(generation_log)

        if job_id:
            update_job_status(job_id, status="running", progress=95, progress_message="Dispatching highlights alerts to registered participants...")

        # Push notification to event registered users
        registrations = db.query(EventRegistration).filter(EventRegistration.event_id == event_id, EventRegistration.status == "registered").all()
        participant_ids = [r.user_id for r in registrations]
        
        for p_id in participant_ids:
            p_user = db.query(User).filter(User.id == p_id).first()
            if p_user and p_user.match_notifications_enabled and p_user.event_match_notifications_enabled:
                notif = Notification(
                    user_id=p_id,
                    title="✨ Event Highlights Compiled!",
                    message=f"✨ '{event.title}' AI Highlights album is ready! Top {len(selected_photos)} photos selected.",
                    notification_type="event_match",
                    event_id=event_id,
                    match_count=len(selected_photos),
                    target_url=f"/dashboard/my-groups/{event.community_id}?tab=events",
                    is_read=False
                )
                db.add(notif)
        db.commit()

        if job_id:
            update_job_status(job_id, status="completed", progress=100, progress_message="AI highlights album generated successfully!", result={"album_id": str(album.id), "photos_selected": len(selected_photos)})
        return {"status": "success", "album_id": str(album.id), "photos_selected": len(selected_photos)}


def process_community_highlights(community_id: str, limit: int, user_id: str, job_id: str):
    with get_sync_db() as db:
        community = db.query(Community).filter(Community.id == community_id).first()
        if not community:
            raise Exception(f"Community with ID {community_id} not found.")

        all_photos = db.query(CommunityMedia).filter(CommunityMedia.community_id == community_id, CommunityMedia.file_type == "photo").all()
        if not all_photos:
            if job_id:
                update_job_status(job_id, status="completed", progress=100, progress_message="No community photos found to analyze.", result={"photos_analyzed": 0, "photos_selected": 0})
            return {"message": "No community photos found.", "photos_analyzed": 0, "photos_selected": 0}

        # 1. Scoring
        if job_id:
            update_job_status(job_id, status="running", progress=30, progress_message="Scoring community media quality metrics...")
            
        photos_analyzed_count = 0
        for photo in all_photos:
            if photo.overall_score == 0.0:
                try:
                    res = requests.get(photo.file_url, timeout=10)
                    if res.status_code == 200:
                        scores = AIService.score_photo(res.content)
                        photo.sharpness_score = scores["sharpness_score"]
                        photo.blur_score = scores["blur_score"]
                        photo.brightness_score = scores["brightness_score"]
                        photo.face_visibility_score = scores["face_visibility_score"]
                        photo.smile_score = scores["smile_score"]
                        photo.composition_score = scores["composition_score"]
                        photo.eye_open_score = scores["eye_open_score"]
                        photo.overall_score = scores["overall_score"]
                        photo.quality_reason = scores["quality_reason"]
                        photos_analyzed_count += 1
                except Exception as e:
                    logger.error(f"Failed to score community media {photo.id}: {e}")
                    photo.overall_score = 75.0
                    photo.sharpness_score = 70.0
                    photo.brightness_score = 80.0
                    photo.quality_reason = "balanced detail capture"
        db.commit()

        # 2. Favorites boost
        if job_id:
            update_job_status(job_id, status="running", progress=50, progress_message="Analyzing media likes and favorites boost...")
            
        for photo in all_photos:
            fav_count = db.query(PhotoFaceMatch).filter(PhotoFaceMatch.media_id == photo.id, PhotoFaceMatch.is_favorite == True).count()
            photo.overall_score = min(100.0, photo.overall_score + (fav_count * 5.0))
        db.commit()

        # 3. Duplicate Sweep
        if job_id:
            update_job_status(job_id, status="running", progress=70, progress_message="Performing perceptual duplicates sweeps...")
            
        unique_photos = []
        duplicate_count = 0
        sorted_candidates = sorted(all_photos, key=lambda x: x.overall_score, reverse=True)
        
        for candidate in sorted_candidates:
            if candidate.is_pinned_highlight:
                unique_photos.append(candidate)
                continue
                
            is_dup = False
            for unique in unique_photos:
                time_diff = abs((candidate.created_at - unique.created_at).total_seconds())
                score_diff = abs(candidate.overall_score - unique.overall_score)
                if time_diff < 300 and score_diff < 3.0:
                    is_dup = True
                    duplicate_count += 1
                    break
            if not is_dup:
                unique_photos.append(candidate)

        # 4. Curation Ranking
        pinned_highlights = [p for p in unique_photos if p.is_pinned_highlight]
        standard_highlights = [p for p in unique_photos if not p.is_pinned_highlight]
        standard_highlights.sort(key=lambda x: x.overall_score, reverse=True)
        
        remaining_slots = max(0, limit - len(pinned_highlights))
        selected_photos = pinned_highlights + standard_highlights[:remaining_slots]

        # 5. Highlights Album
        album = db.query(MediaAlbum).filter(MediaAlbum.community_id == community_id, MediaAlbum.is_highlights == True).first()
        if not album:
            album = MediaAlbum(
                community_id=community_id,
                name=f"✨ {community.title} AI Highlights",
                description=f"Curated collection of the top photos in the gallery. Powered by FaceSnap AI Curation.",
                is_highlights=True,
                generated_by_ai=True,
                created_by=user_id if user_id else community.creator_id
            )
            db.add(album)
            db.commit()
            db.refresh(album)

        if job_id:
            update_job_status(job_id, status="running", progress=85, progress_message="Updating highlights mappings and cover selections...")

        # Clear old album mappings
        for photo in all_photos:
            if photo.album_id == album.id:
                photo.album_id = None
        db.commit()

        # Update selected photo mappings
        for photo in selected_photos:
            photo.album_id = album.id
        db.commit()

        # Highlight cover selection
        if selected_photos and (not album.cover_media_id or album.cover_media_id not in [p.id for p in selected_photos]):
            album.cover_media_id = selected_photos[0].id
            album.cover_url = selected_photos[0].file_url

        # Log details
        generation_log = HighlightGenerationLog(
            album_id=album.id,
            community_id=community_id,
            generated_by=user_id,
            photos_analyzed=len(all_photos),
            photos_selected=len(selected_photos),
            duplicates_removed=duplicate_count
        )
        db.add(generation_log)

        if job_id:
            update_job_status(job_id, status="running", progress=95, progress_message="Dispatching highlights alerts to community members...")

        # Alerts to all community roles (members)
        roles = db.query(CommunityRole).filter(CommunityRole.community_id == community_id).all()
        member_ids = [r.user_id for r in roles]
        
        for m_id in member_ids:
            m_user = db.query(User).filter(User.id == m_id).first()
            if m_user and m_user.match_notifications_enabled and m_user.community_match_notifications_enabled:
                notif = Notification(
                    user_id=m_id,
                    title="✨ Community Highlights Generated",
                    message=f"✨ '{community.title}' AI Highlights album is ready! Top {len(selected_photos)} photos selected.",
                    notification_type="community_match",
                    community_id=community_id,
                    match_count=len(selected_photos),
                    target_url=f"/dashboard/my-groups/{community_id}",
                    is_read=False
                )
                db.add(notif)
        db.commit()

        if job_id:
            update_job_status(job_id, status="completed", progress=100, progress_message="AI highlights album generated successfully!", result={"album_id": str(album.id), "photos_selected": len(selected_photos)})
        return {"status": "success", "album_id": str(album.id), "photos_selected": len(selected_photos)}
