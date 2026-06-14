from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import distinct
from typing import List, Optional
from uuid import UUID
import datetime
import logging
from app.database import get_db
from app.models import Notification, User, PhotoFaceMatch, CommunityMedia, Photo, NotificationPreference
from app.schemas import NotificationResponse, NotificationPreferencesResponse, NotificationPreferencesUpdate, UserResponse
from app.routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["Notifications"])

async def trigger_weekly_digest(db: AsyncSession, user: User):
    """
    Dynamic self-healing weekly digest compiler.
    Checks user eligibility and triggers a weekly recap notification if 7 days have passed since the last digest.
    """
    stmt_pref = select(NotificationPreference).where(NotificationPreference.user_id == user.id)
    res_pref = await db.execute(stmt_pref)
    pref = res_pref.scalar_one_or_none()
    
    if not pref or not pref.digest_enabled:
        return
        
    stmt = (
        select(Notification)
        .where(
            Notification.user_id == user.id,
            Notification.notification_type == "weekly_digest"
        )
        .order_by(Notification.created_at.desc())
        .limit(1)
    )
    res = await db.execute(stmt)
    last_digest = res.scalar_one_or_none()
    
    now = datetime.datetime.utcnow()
    if last_digest:
        last_created = last_digest.created_at
        # Strip timezone info if present (PostgreSQL may return timezone-aware datetimes)
        if last_created is not None and hasattr(last_created, 'tzinfo') and last_created.tzinfo is not None:
            last_created = last_created.replace(tzinfo=None)
        if last_created is not None and (now - last_created) < datetime.timedelta(days=7):
            return
        
    seven_days_ago = now - datetime.timedelta(days=7)
    
    # Aggregate data
    stmt_matches = select(PhotoFaceMatch).where(
        PhotoFaceMatch.user_id == user.id,
        PhotoFaceMatch.status == "approved",
        PhotoFaceMatch.created_at >= seven_days_ago
    )
    res_matches = await db.execute(stmt_matches)
    matches_list = res_matches.scalars().all()
    photos_found = len(matches_list)
    
    stmt_comms = (
        select(distinct(CommunityMedia.community_id))
        .join(PhotoFaceMatch, PhotoFaceMatch.media_id == CommunityMedia.id)
        .where(
            PhotoFaceMatch.user_id == user.id,
            PhotoFaceMatch.created_at >= seven_days_ago
        )
    )
    res_comms = await db.execute(stmt_comms)
    comms_count = len(res_comms.scalars().all())
    
    stmt_events = (
        select(distinct(Photo.event_id))
        .join(PhotoFaceMatch, PhotoFaceMatch.photo_id == Photo.id)
        .where(
            PhotoFaceMatch.user_id == user.id,
            PhotoFaceMatch.created_at >= seven_days_ago
        )
    )
    res_events = await db.execute(stmt_events)
    events_count = len(res_events.scalars().all())
    
    stmt_favs = select(PhotoFaceMatch).where(
        PhotoFaceMatch.user_id == user.id,
        PhotoFaceMatch.is_favorite == True,
        PhotoFaceMatch.created_at >= seven_days_ago
    )
    res_favs = await db.execute(stmt_favs)
    favs_count = len(res_favs.scalars().all())
    
    # Mock Email Delivery
    if pref.email_enabled:
        logger.info(
            f"EMAIL DIGEST SENT TO {user.email} — Photos: {photos_found}, Communities: {comms_count}, Events: {events_count}, Favorites: {favs_count}"
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
        notification_type="weekly_digest",
        match_count=photos_found,
        media_ids=[],
        target_url="/dashboard/my-photos",
        is_read=False
    )
    db.add(digest_notif)
    await db.commit()
    logger.info(f"Generated weekly digest for user {user.id}")


async def create_or_aggregate_notification(
    db: AsyncSession,
    user_id: UUID,
    notification_type: str,
    title: str,
    message: str,
    community_id: Optional[UUID] = None,
    event_id: Optional[UUID] = None,
    match_count: int = 1,
    media_ids: Optional[list] = None,
    target_url: Optional[str] = None
) -> Optional[Notification]:
    """
    Aggregation and deduplication builder:
    - Deduplicates identical individual matches.
    - Aggregates concurrent matches within a 15-minute time window for the same user, community/event, and type.
    """
    from datetime import datetime, timedelta
    
    time_threshold = datetime.utcnow() - timedelta(minutes=15)
    
    # Check aggregation window
    stmt = select(Notification).where(
        Notification.user_id == user_id,
        Notification.notification_type == notification_type,
        Notification.is_read == False,
        Notification.created_at >= time_threshold
    )
    if community_id:
        stmt = stmt.where(Notification.community_id == community_id)
    if event_id:
        stmt = stmt.where(Notification.event_id == event_id)
        
    res = await db.execute(stmt)
    existing_notif = res.scalar_one_or_none()
    
    if existing_notif:
        # Deduplicate matches within the media_ids list (Module 3)
        current_media_ids = existing_notif.media_ids or []
        incoming_ids = [str(mid) for mid in media_ids] if media_ids else []
        new_unique_ids = [mid for mid in incoming_ids if mid not in current_media_ids]
        
        if new_unique_ids:
            existing_notif.match_count = (existing_notif.match_count or 0) + len(new_unique_ids)
            existing_notif.media_ids = current_media_ids + new_unique_ids
            
            # Formulate aggregated message
            if notification_type == "community_match":
                existing_notif.message = f"📸 {existing_notif.match_count} new photos containing you were found in the gallery."
            elif notification_type == "event_match":
                existing_notif.message = f"📸 {existing_notif.match_count} new photos containing you were found."
            else:
                existing_notif.message = message
                
            existing_notif.created_at = datetime.utcnow() # Reset window
            await db.commit()
        return existing_notif
    else:
        # Create fresh notification
        new_notif = Notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            community_id=community_id,
            event_id=event_id,
            match_count=match_count,
            media_ids=[str(mid) for mid in media_ids] if media_ids else [],
            target_url=target_url or "/dashboard/my-photos",
            is_read=False
        )
        db.add(new_notif)
        await db.commit()
        return new_notif


@router.get("/", response_model=List[NotificationResponse])
async def list_notifications(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve all notifications, including system and general logs."""
    # Run dynamic weekly check
    await trigger_weekly_digest(db, current_user)
    
    from app.models import CommunityRole, Event, Community
    from sqlalchemy.orm import aliased
    from sqlalchemy import or_, and_

    CommNotification = aliased(Community)
    CommEvent = aliased(Community)

    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
    )

    if current_user.platform_role != "super_admin":
        stmt_roles = select(CommunityRole.community_id).where(CommunityRole.user_id == current_user.id)
        res_roles = await db.execute(stmt_roles)
        my_joined_ids = [row[0] for row in res_roles.all()]
        stmt = stmt.outerjoin(Event, Notification.event_id == Event.id).where(
            or_(
                and_(Notification.community_id == None, Notification.event_id == None),
                Notification.community_id.in_(my_joined_ids),
                Event.community_id.in_(my_joined_ids)
            )
        )
    else:
        stmt = stmt.outerjoin(Event, Notification.event_id == Event.id)

    stmt = stmt.outerjoin(CommNotification, Notification.community_id == CommNotification.id)\
               .outerjoin(CommEvent, Event.community_id == CommEvent.id)\
               .where(
                   and_(
                       or_(Notification.community_id == None, CommNotification.archived_at.is_(None)),
                       or_(Notification.event_id == None, CommEvent.archived_at.is_(None))
                   )
               )

    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/face-matches", response_model=List[NotificationResponse])
async def list_face_matches(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve only AI recognition and matching digest alerts."""
    # Run dynamic weekly check
    await trigger_weekly_digest(db, current_user)
    
    from app.models import CommunityRole, Event, Community
    from sqlalchemy.orm import aliased
    from sqlalchemy import or_, and_

    CommNotification = aliased(Community)
    CommEvent = aliased(Community)

    stmt = (
        select(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.notification_type.in_(["face_match", "community_match", "event_match", "weekly_digest"])
        )
    )

    if current_user.platform_role != "super_admin":
        stmt_roles = select(CommunityRole.community_id).where(CommunityRole.user_id == current_user.id)
        res_roles = await db.execute(stmt_roles)
        my_joined_ids = [row[0] for row in res_roles.all()]
        stmt = stmt.outerjoin(Event, Notification.event_id == Event.id).where(
            or_(
                and_(Notification.community_id == None, Notification.event_id == None),
                Notification.community_id.in_(my_joined_ids),
                Event.community_id.in_(my_joined_ids)
            )
        )
    else:
        stmt = stmt.outerjoin(Event, Notification.event_id == Event.id)

    stmt = stmt.outerjoin(CommNotification, Notification.community_id == CommNotification.id)\
               .outerjoin(CommEvent, Event.community_id == CommEvent.id)\
               .where(
                   and_(
                       or_(Notification.community_id == None, CommNotification.archived_at.is_(None)),
                       or_(Notification.event_id == None, CommEvent.archived_at.is_(None))
                   )
               )

    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models import CommunityRole, Event, Community
    from sqlalchemy.orm import aliased
    from sqlalchemy import or_, and_

    CommNotification = aliased(Community)
    CommEvent = aliased(Community)

    stmt = select(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    )

    if current_user.platform_role != "super_admin":
        stmt_roles = select(CommunityRole.community_id).where(CommunityRole.user_id == current_user.id)
        res_roles = await db.execute(stmt_roles)
        my_joined_ids = [row[0] for row in res_roles.all()]
        stmt = stmt.outerjoin(Event, Notification.event_id == Event.id).where(
            or_(
                and_(Notification.community_id == None, Notification.event_id == None),
                Notification.community_id.in_(my_joined_ids),
                Event.community_id.in_(my_joined_ids)
            )
        )
    else:
        stmt = stmt.outerjoin(Event, Notification.event_id == Event.id)

    stmt = stmt.outerjoin(CommNotification, Notification.community_id == CommNotification.id)\
               .outerjoin(CommEvent, Event.community_id == CommEvent.id)\
               .where(
                   and_(
                       or_(Notification.community_id == None, CommNotification.archived_at.is_(None)),
                       or_(Notification.event_id == None, CommEvent.archived_at.is_(None))
                   )
               )

    res = await db.execute(stmt)
    unread_list = res.scalars().all()
    return {"count": len(unread_list)}


@router.get("/preferences", response_model=NotificationPreferencesResponse)
async def get_notification_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve face matching and notifications specific user privacy preferences."""
    stmt = select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    res = await db.execute(stmt)
    pref = res.scalar_one_or_none()
    
    if not pref:
        # Fallback if migration hasn't run
        pref = NotificationPreference(
            user_id=current_user.id,
            face_matches_enabled=current_user.face_matching_enabled,
            community_enabled=True,
            social_enabled=True,
            achievement_enabled=True,
            system_enabled=True,
            security_enabled=True,
            event_enabled=True,
            message_enabled=True,
            push_enabled=True,
            email_enabled=current_user.email_notifications_enabled,
            digest_enabled=current_user.weekly_digest_enabled,
            digest_frequency="weekly",
            quiet_hours_enabled=False
        )
        db.add(pref)
        await db.commit()
        await db.refresh(pref)
        
    return pref


@router.put("/preferences", response_model=NotificationPreferencesResponse)
async def update_notification_preferences(
    prefs: NotificationPreferencesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update face matching and notifications specific user privacy preferences."""
    stmt = select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    res = await db.execute(stmt)
    pref = res.scalar_one_or_none()
    
    if not pref:
        raise HTTPException(status_code=404, detail="Preferences not found.")

    for field, value in prefs.dict(exclude_unset=True).items():
        setattr(pref, field, value)

    pref.updated_at = datetime.datetime.utcnow()
    await db.commit()
    await db.refresh(pref)
    return pref


@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    )
    res = await db.execute(stmt)
    notif = res.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.is_read = True
    await db.commit()
    return {"message": "Notification marked as read."}


@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark all active notifications for the current user as read."""
    stmt = select(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    )
    res = await db.execute(stmt)
    unread = res.scalars().all()
    for n in unread:
        n.is_read = True
    await db.commit()
    return {"message": "All notifications marked as read."}


@router.post("/{notification_id}/open")
async def track_notification_opened(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Track notification view open events for open-rate analytics."""
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    )
    res = await db.execute(stmt)
    notif = res.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.notification_opened = True
    await db.commit()
    return {"status": "tracked"}


@router.post("/{notification_id}/click")
async def track_notification_clicked(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Track notification click events for click-through rate analytics."""
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    )
    res = await db.execute(stmt)
    notif = res.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.notification_clicked = True
    notif.clicked_at = datetime.datetime.utcnow()
    await db.commit()
    return {"status": "tracked", "target_url": notif.target_url}


@router.post("/{notification_id}/dismiss")
async def track_notification_dismissed(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Track notification dismiss events for dismiss rate analytics."""
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    )
    res = await db.execute(stmt)
    notif = res.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.notification_dismissed = True
    notif.dismissed_at = datetime.datetime.utcnow()
    notif.is_read = True # Optionally mark as read when dismissed
    await db.commit()
    return {"status": "dismissed"}


@router.post("/trigger-migration/preferences")
async def trigger_preference_migration(
    db: AsyncSession = Depends(get_db)
):
    """Temporary endpoint to trigger the DB migration of user preferences"""
    stmt = select(User)
    res = await db.execute(stmt)
    users = res.scalars().all()
    migrated_count = 0
    skipped_count = 0
    
    for user in users:
        pref_stmt = select(NotificationPreference).where(NotificationPreference.user_id == user.id)
        pref_res = await db.execute(pref_stmt)
        if pref_res.scalar_one_or_none():
            skipped_count += 1
            continue
            
        new_pref = NotificationPreference(
            user_id=user.id,
            face_matches_enabled=user.face_matching_enabled and user.match_notifications_enabled,
            community_enabled=user.community_match_notifications_enabled,
            social_enabled=True,
            achievement_enabled=True,
            system_enabled=True,
            security_enabled=True,
            event_enabled=user.event_match_notifications_enabled,
            message_enabled=True,
            push_enabled=True,
            email_enabled=user.email_notifications_enabled,
            digest_enabled=user.weekly_digest_enabled,
            digest_frequency="weekly",
            quiet_hours_enabled=False
        )
        db.add(new_pref)
        migrated_count += 1
        
    await db.commit()
    return {"status": "Migration Complete", "migrated": migrated_count, "skipped": skipped_count}


import traceback

@router.get("/admin/analytics")
async def get_notification_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve system-wide notification analytics. Restricted to Super Admin."""
    if current_user.platform_role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required.")
        
    try:
        logger.info(f"[ANALYTICS] Notification Columns: {Notification.__table__.columns.keys()}")
        
        # Get total counts
        logger.info("[ANALYTICS] Executing query: select(Notification)")
        stmt_total = select(Notification)
        res_total = await db.execute(stmt_total)
        all_notifs = res_total.scalars().all()
        logger.info(f"[ANALYTICS] Query executed successfully. Total notifications fetched: {len(all_notifs)}")
        
        total = len(all_notifs)
        opened = sum(1 for n in all_notifs if getattr(n, 'notification_opened', False))
        clicked = sum(1 for n in all_notifs if getattr(n, 'notification_clicked', False))
        dismissed = sum(1 for n in all_notifs if getattr(n, 'notification_dismissed', False))
        
        open_rate = round((opened / total * 100), 2) if total > 0 else 0
        click_rate = round((clicked / total * 100), 2) if total > 0 else 0
        dismiss_rate = round((dismissed / total * 100), 2) if total > 0 else 0
        
        # Types distribution
        type_counts = {}
        for n in all_notifs:
            ntype = getattr(n.notification_type, 'value', n.notification_type) if n.notification_type else "unknown"
            type_counts[ntype] = type_counts.get(ntype, 0) + 1
            
        payload = {
            "metrics": {
                "total_sent": total,
                "total_opened": opened,
                "total_clicked": clicked,
                "total_dismissed": dismissed
            },
            "rates": {
                "open_rate_percent": open_rate,
                "click_rate_percent": click_rate,
                "dismiss_rate_percent": dismiss_rate
            },
            "distribution": type_counts
        }
        logger.info(f"[ANALYTICS] Return Payload: {payload}")
        return payload
    except Exception as e:
        logger.exception("ADMIN ANALYTICS CRASH")
        return {"error": str(e), "traceback": traceback.format_exc()}
