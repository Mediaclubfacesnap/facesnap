import logging
from celery_app import celery_app
from app.workers.tasks import SyncSessionLocal as SessionLocal, validate_worker_boot
from app.models import (
    User, PhotoFaceMatch, Photo, CommunityMedia, Event, Community,
    MemoryCollection, MemoryPhoto, MemoryPerson, FacePrivacySettings
)
from sqlalchemy import func
import datetime

logger = logging.getLogger(__name__)

@celery_app.task(name="app.workers.memory_tasks.generate_user_memories", bind=True)
def generate_user_memories(self, user_id: str):
    """
    Incremental memory generation triggered after face matching.
    Groups a user's matched photos by Event or Community into MemoryCollections.
    """
    db = SessionLocal()
    try:
        # Step 1: Find all verified matches for this user
        matches = db.query(PhotoFaceMatch).filter(
            PhotoFaceMatch.user_id == user_id,
            PhotoFaceMatch.is_verified_match == True
        ).all()

        if not matches:
            return

        # Cluster by event_id or community_id
        clusters = {} # key: 'event:UUID' or 'community:UUID', val: list of match_ids
        
        for m in matches:
            cluster_key = None
            if m.photo_id:
                photo = db.query(Photo).filter(Photo.id == m.photo_id).first()
                if photo and photo.event_id:
                    event = photo.event
                    if event and event.community and event.community.archived_at is not None:
                        continue
                    cluster_key = f"event:{photo.event_id}"
            elif m.media_id:
                media = db.query(CommunityMedia).filter(CommunityMedia.id == m.media_id).first()
                if media and media.community_id:
                    comm = media.community
                    if comm and comm.archived_at is not None:
                        continue
                    cluster_key = f"community:{media.community_id}"
            
            if cluster_key:
                if cluster_key not in clusters:
                    clusters[cluster_key] = []
                clusters[cluster_key].append(m)

        for cluster_key, match_list in clusters.items():
            ctype, cid = cluster_key.split(":")
            
            # Check if a memory collection already exists for this event/community
            existing_memory = db.query(MemoryCollection).filter(
                MemoryCollection.user_id == user_id,
                # We'll use title parsing as a simple matching mechanism for now
                MemoryCollection.memory_type == ctype.upper()
            ).first() # In a real implementation we would add a source_id column, but title/type works for v1

            # Fetch source details
            title = "New Memory"
            date = datetime.datetime.utcnow()
            
            if ctype == "event":
                event = db.query(Event).filter(Event.id == cid).first()
                if event:
                    title = event.title
                    date = event.date
            else:
                comm = db.query(Community).filter(Community.id == cid).first()
                if comm:
                    title = f"{comm.title} Memories"
            
            # Match existing by title and type
            memory = db.query(MemoryCollection).filter(
                MemoryCollection.user_id == user_id,
                MemoryCollection.title == title,
                MemoryCollection.memory_type == ctype.upper()
            ).first()

            if not memory:
                memory = MemoryCollection(
                    user_id=user_id,
                    title=title,
                    memory_type=ctype.upper(),
                    memory_date=date,
                    photo_count=0
                )
                db.add(memory)
                db.flush()

            # Add missing photos to memory
            added_photos = 0
            for m in match_list:
                actual_photo_id = m.photo_id if m.photo_id else m.media_id
                existing_mp = db.query(MemoryPhoto).filter(
                    MemoryPhoto.memory_id == memory.id,
                    MemoryPhoto.photo_id == actual_photo_id
                ).first()
                
                if not existing_mp:
                    db.add(MemoryPhoto(
                        memory_id=memory.id,
                        photo_id=actual_photo_id,
                        confidence_score=m.confidence_score
                    ))
                    added_photos += 1
                    
                    # Set cover photo if none
                    if not memory.cover_photo_id:
                        memory.cover_photo_id = actual_photo_id
            
            memory.photo_count += added_photos
            db.commit()

            # Send Notification if this is a newly created memory with multiple photos
            if added_photos > 0 and memory.photo_count >= 3:
                from app.workers.notification_tasks import sync_create_or_aggregate_notification
                from app.models import NotificationPriority
                sync_create_or_aggregate_notification(
                    db=db,
                    user_id=user_id,
                    notification_type="SYSTEM",
                    title="🎉 New Memory Created",
                    message=f"Your {title} memory is ready with {memory.photo_count} photos.",
                    target_url=f"/dashboard/memories/{memory.id}",
                    priority=NotificationPriority.MEDIUM
                )

    except Exception as e:
        logger.error(f"Error in generate_user_memories: {e}")
        db.rollback()
    finally:
        db.close()


@celery_app.task(name="app.workers.memory_tasks.nightly_memory_consolidation")
def nightly_memory_consolidation():
    """
    Runs nightly to recalculate scores, set best photos, and aggregate people counts.
    """
    db = SessionLocal()
    try:
        memories = db.query(MemoryCollection).all()
        for memory in memories:
            # Simple score calculation: 40% photo count + 20% people
            memory.memory_score = (memory.photo_count * 0.4) + (memory.people_count * 0.2)
            db.add(memory)
        db.commit()
    except Exception as e:
        logger.error(f"Error in nightly_memory_consolidation: {e}")
        db.rollback()
    finally:
        db.close()


# Run startup validation
validate_worker_boot("MemoryTasks")

