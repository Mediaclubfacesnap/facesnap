import logging
import datetime
from sqlalchemy import distinct
from app.workers.celery_app import celery_app
from app.workers.tasks import get_sync_db, validate_worker_boot
from app.models import Notification, User, PhotoFaceMatch, CommunityMedia, Photo, PushSubscription, NotificationPreference, NotificationType, NotificationPriority
from app.config import settings
import json

try:
    from pywebpush import webpush, WebPushException
except ImportError:
    webpush = None

logger = logging.getLogger(__name__)

def sync_create_or_aggregate_notification(
    db,
    user_id,
    notification_type,
    title,
    message,
    community_id=None,
    event_id=None,
    match_count=1,
    media_ids=None,
    target_url=None,
    priority=NotificationPriority.MEDIUM
):
    """Synchronous version of aggregation and deduplication builder."""
    time_threshold = datetime.datetime.utcnow() - datetime.timedelta(minutes=15)
    
    # Check aggregation window
    stmt = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.notification_type == notification_type,
        Notification.is_read == False,
        Notification.created_at >= time_threshold
    )
    if community_id:
        stmt = stmt.filter(Notification.community_id == community_id)
    if event_id:
        stmt = stmt.filter(Notification.event_id == event_id)
        
    existing_notif = stmt.first()
    
    if existing_notif:
        current_media_ids = existing_notif.media_ids or []
        incoming_ids = [str(mid) for mid in media_ids] if media_ids else []
        new_unique_ids = [mid for mid in incoming_ids if mid not in current_media_ids]
        
        if new_unique_ids:
            existing_notif.match_count = (existing_notif.match_count or 0) + len(new_unique_ids)
            existing_notif.media_ids = current_media_ids + new_unique_ids
            
            if notification_type == "community_match":
                existing_notif.message = f"📸 {existing_notif.match_count} new photos containing you were found in the gallery."
            elif notification_type == "event_match":
                existing_notif.message = f"📸 {existing_notif.match_count} new photos containing you were found."
            else:
                existing_notif.message = message
                
            existing_notif.created_at = datetime.datetime.utcnow()
            db.commit()
        return existing_notif
    else:
        new_notif = Notification(
            user_id=user_id,
            notification_type=notification_type,
            priority=priority,
            title=title,
            message=message,
            community_id=community_id,
            event_id=event_id,
            match_count=match_count,
            media_ids=[str(mid) for mid in media_ids] if media_ids else [],
            target_url=target_url or "/dashboard/my-photos",
            is_read=False,
            notification_dismissed=False
        )
        db.add(new_notif)
        db.commit()
        return new_notif

def send_web_push(db, user_id, title, message, url):
    """Module 7: Send Web Push via pywebpush"""
    if not webpush:
        logger.warning("pywebpush not installed. Skipping web push.")
        return

    vapid_private_key = getattr(settings, "VAPID_PRIVATE_KEY", os.getenv("VAPID_PRIVATE_KEY"))
    vapid_public_key = getattr(settings, "VAPID_PUBLIC_KEY", os.getenv("VAPID_PUBLIC_KEY"))
    
    if not vapid_private_key or not vapid_public_key:
        logger.warning("VAPID keys not configured. Skipping web push.")
        return
        
    subs = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
    if not subs:
        return
        
    payload = json.dumps({
        "title": title,
        "body": message,
        "url": url,
        "icon": "/icons/icon-192x192.png"
    })
    
    for sub in subs:
        sub_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "auth": sub.auth,
                "p256dh": sub.p256dh
            }
        }
        try:
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims={"sub": "mailto:admin@facesnap.app"}
            )
        except WebPushException as ex:
            logger.error(f"Web Push failed: {repr(ex)}")
            # If subscription is expired/invalid, remove it
            if ex.response and ex.response.status_code in [404, 410]:
                db.delete(sub)
                db.commit()
        except Exception as e:
            logger.error(f"Web push error: {e}")


@celery_app.task(name="app.workers.notification_tasks.send_notification_batch", max_retries=3, default_retry_delay=30)
def send_notification_batch(user_new_matches: dict, photo_id: str = None, media_id: str = None, community_id: str = None, event_id: str = None):
    """
    Module 6: Notification Queue Background Job
    Aggregates face match detections and pushes in-app and email notifications.
    """
    logger.info(f"Dispatching notification batch for matches. community_id={community_id}, event_id={event_id}")
    
    with get_sync_db() as db:
        from app.models import Community, Event
        if community_id:
            comm = db.query(Community).filter(Community.id == community_id).first()
            if comm and comm.archived_at is not None:
                logger.info(f"Skipping notification batch: Community {community_id} is archived.")
                return {"status": "skipped", "reason": "community archived"}
        if event_id:
            event = db.query(Event).filter(Event.id == event_id).first()
            if event and event.community and event.community.archived_at is not None:
                logger.info(f"Skipping notification batch: Event {event_id} belongs to archived community {event.community_id}.")
                return {"status": "skipped", "reason": "community archived"}

        for u_id_str, count in user_new_matches.items():
            user = db.query(User).filter(User.id == u_id_str).first()
            if not user:
                continue
                
            pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user.id).first()
            if not pref or not pref.face_matches_enabled:
                continue
                
            notif_type = NotificationType.FACE_MATCH
            priority = NotificationPriority.HIGH
            
            # Check preferences for specific scopes
            is_community = bool(community_id)
            is_event = bool(event_id)
            
            if is_community and not pref.community_enabled:
                continue
            if is_event and not pref.event_enabled:
                continue
                
            # Formulate the title and default message
            title = "📸 New Face Matches Found!"
            message = f"We found new photos containing you! Tap to check them out."
            
            media_ids_list = [media_id] if media_id else ([photo_id] if photo_id else [])
            
            notif = sync_create_or_aggregate_notification(
                db=db,
                user_id=user.id,
                notification_type=notif_type,
                title=title,
                message=message,
                community_id=community_id,
                event_id=event_id,
                match_count=count,
                media_ids=media_ids_list,
                target_url="/dashboard/my-photos",
                priority=priority
            )
            
            # Mock email dispatch if enabled
            if pref.email_enabled:
                logger.info(f"EMAIL NOTIFICATION SENT to {user.email} (Match count: {count})")
                if notif:
                    notif.email_sent = True
                
            # Send Web Push if enabled
            if pref.push_enabled:
                send_web_push(db, user.id, title, message, "/dashboard/my-photos")
                if notif:
                    notif.push_sent = True
            
            db.commit()
                
    return {"status": "success", "processed_users": len(user_new_matches)}


@celery_app.task(name="app.workers.notification_tasks.generate_weekly_digest")
def generate_weekly_digest():
    """
    Module 7: Weekly Digest Queue Background Job
    Gathers weekly face matches, events, community actions, and favorites, compiles digest messages,
    and logs mock emails, pushing in-app recaps for all eligible users.
    """
    logger.info("Starting scheduled weekly digest generation for all eligible users...")
    processed_count = 0
    
    now = datetime.datetime.utcnow()
    seven_days_ago = now - datetime.timedelta(days=7)
    
    with get_sync_db() as db:
        prefs = db.query(NotificationPreference).filter(NotificationPreference.digest_enabled == True).all()
        
        for pref in prefs:
            user = db.query(User).filter(User.id == pref.user_id).first()
            if not user:
                continue
                
            # Check if user already got a weekly digest in the last 6 days (to prevent duplication)
            last_digest = (
                db.query(Notification)
                .filter(Notification.user_id == user.id, Notification.notification_type == NotificationType.SYSTEM)
                .filter(Notification.title.like("%Summary%"))
                .order_by(Notification.created_at.desc())
                .first()
            )
            if last_digest and (now - last_digest.created_at) < datetime.timedelta(days=6):
                continue
                
            # Aggregate stats
            from app.models import Community, Event

            # Query matches on photos whose events do NOT belong to an archived community
            photos_count = (
                db.query(PhotoFaceMatch.id)
                .join(Photo, PhotoFaceMatch.photo_id == Photo.id)
                .join(Event, Photo.event_id == Event.id)
                .join(Community, Event.community_id == Community.id)
                .filter(
                    PhotoFaceMatch.user_id == user.id,
                    PhotoFaceMatch.status == "approved",
                    PhotoFaceMatch.created_at >= seven_days_ago,
                    Community.archived_at.is_(None)
                )
                .count()
            )
            
            # Query matches on media whose communities are NOT archived
            media_count = (
                db.query(PhotoFaceMatch.id)
                .join(CommunityMedia, PhotoFaceMatch.media_id == CommunityMedia.id)
                .join(Community, CommunityMedia.community_id == Community.id)
                .filter(
                    PhotoFaceMatch.user_id == user.id,
                    PhotoFaceMatch.status == "approved",
                    PhotoFaceMatch.created_at >= seven_days_ago,
                    Community.archived_at.is_(None)
                )
                .count()
            )
            
            photos_found = photos_count + media_count
            
            comms_count = (
                db.query(distinct(CommunityMedia.community_id))
                .join(PhotoFaceMatch, PhotoFaceMatch.media_id == CommunityMedia.id)
                .join(Community, CommunityMedia.community_id == Community.id)
                .filter(
                    PhotoFaceMatch.user_id == user.id, 
                    PhotoFaceMatch.created_at >= seven_days_ago,
                    Community.archived_at.is_(None)
                )
                .count()
            )
            
            events_count = (
                db.query(distinct(Photo.event_id))
                .join(PhotoFaceMatch, PhotoFaceMatch.photo_id == Photo.id)
                .join(Event, Photo.event_id == Event.id)
                .join(Community, Event.community_id == Community.id)
                .filter(
                    PhotoFaceMatch.user_id == user.id, 
                    PhotoFaceMatch.created_at >= seven_days_ago,
                    Community.archived_at.is_(None)
                )
                .count()
            )
            
            # Query favorites on photos whose events do NOT belong to an archived community
            favs_photos = (
                db.query(PhotoFaceMatch.id)
                .join(Photo, PhotoFaceMatch.photo_id == Photo.id)
                .join(Event, Photo.event_id == Event.id)
                .join(Community, Event.community_id == Community.id)
                .filter(
                    PhotoFaceMatch.user_id == user.id,
                    PhotoFaceMatch.is_favorite == True,
                    PhotoFaceMatch.created_at >= seven_days_ago,
                    Community.archived_at.is_(None)
                )
                .count()
            )
            
            # Query favorites on media whose communities are NOT archived
            favs_media = (
                db.query(PhotoFaceMatch.id)
                .join(CommunityMedia, PhotoFaceMatch.media_id == CommunityMedia.id)
                .join(Community, CommunityMedia.community_id == Community.id)
                .filter(
                    PhotoFaceMatch.user_id == user.id,
                    PhotoFaceMatch.is_favorite == True,
                    PhotoFaceMatch.created_at >= seven_days_ago,
                    Community.archived_at.is_(None)
                )
                .count()
            )
            
            favs_count = favs_photos + favs_media
            
            # Send mock email if enabled
            if pref.email_enabled:
                logger.info(
                    f"WEEKLY EMAIL DIGEST SENT TO {user.email} — "
                    f"Photos: {photos_found}, Communities: {comms_count}, Events: {events_count}, Favorites: {favs_count}"
                )
                
            digest_msg = (
                f"📸 Weekly FaceSnap Summary\n"
                f"{photos_found} New Photos\n"
                f"{comms_count} Communities\n"
                f"{events_count} Events\n"
                f"{favs_count} Favorites"
            )
            
            digest_notif = Notification(
                user_id=user.id,
                title="📸 Weekly FaceSnap Summary",
                message=digest_msg,
                notification_type=NotificationType.SYSTEM,
                priority=NotificationPriority.LOW,
                match_count=photos_found,
                media_ids=[],
                target_url="/dashboard/my-photos",
                is_read=False
            )
            db.add(digest_notif)
            processed_count += 1
            
            # Send Web Push for Weekly Digest
            if pref.push_enabled:
                send_web_push(db, user.id, "📸 Weekly FaceSnap Summary", digest_msg, "/dashboard/my-photos")
                digest_notif.push_sent = True
                
            if pref.email_enabled:
                digest_notif.email_sent = True

            # Audit log for weekly digest generation
            from app.models import AuditLog
            audit = AuditLog(
                user_id=user.id,
                action="Digest Generated",
                target="weekly_digest",
                meta={"photos_found": photos_found, "communities_count": comms_count, "events_count": events_count, "archived_data_filtered": True}
            )
            db.add(audit)
            
        db.commit()
        
    logger.info(f"Weekly digest compiler finished. Processed {processed_count} users.")
    return {"status": "success", "processed_users": processed_count}


@celery_app.task(name="app.workers.notification_tasks.send_community_notifications", max_retries=3, default_retry_delay=30)
def send_community_notifications(community_id: str, action: str, target_user_ids: list, message: str, title: str = "Community Update"):
    """
    Sends community-scoped notifications (events, announcements, role changes).
    action: 'announcement', 'event', 'role_change', 'upload'
    """
    logger.info(f"Sending community notification. community_id={community_id}, action={action}")
    
    with get_sync_db() as db:
        from app.models import Community
        comm = db.query(Community).filter(Community.id == community_id).first()
        if comm and comm.archived_at is not None:
            logger.info(f"Skipping community notification: Community {community_id} is archived.")
            return {"status": "skipped", "reason": "community archived"}

        for u_id_str in target_user_ids:
            user = db.query(User).filter(User.id == u_id_str).first()
            if not user:
                continue
                
            pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user.id).first()
            if not pref or not pref.community_enabled:
                continue
                
            # Basic quiet hours check
            if pref.quiet_hours_enabled:
                now_hour = datetime.datetime.utcnow().hour
                try:
                    start_h = int(pref.quiet_hours_start.split(":")[0])
                    end_h = int(pref.quiet_hours_end.split(":")[0])
                    # If current hour falls within quiet hours, skip or delay (for now we skip)
                    if start_h <= end_h:
                        if start_h <= now_hour < end_h:
                            continue
                    else:
                        if now_hour >= start_h or now_hour < end_h:
                            continue
                except Exception:
                    pass
            
            notif = Notification(
                user_id=user.id,
                notification_type=NotificationType.COMMUNITY,
                priority=NotificationPriority.MEDIUM,
                title=title,
                message=message,
                community_id=community_id,
                target_url=f"/dashboard/my-groups/{community_id}",
                is_read=False,
                notification_dismissed=False
            )
            db.add(notif)
            
            if pref.email_enabled:
                notif.email_sent = True
                
            if pref.push_enabled:
                send_web_push(db, user.id, title, message, f"/dashboard/my-groups/{community_id}")
                notif.push_sent = True
                
        db.commit()
    return {"status": "success", "processed_users": len(target_user_ids)}


# Run startup validation
validate_worker_boot("NotificationTasks")

