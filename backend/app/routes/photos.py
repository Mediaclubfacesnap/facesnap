from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
import logging
from app.database import get_db
from app.models import PhotoFaceMatch, CommunityMedia, Photo, Event, Community, User
from app.schemas import MyPhotoResponse, UserPrivacyPreferencesUpdate, UserResponse
from app.routes.auth import get_current_user
# File upload validation hook integration
from app.services.security_service import scan_file

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/photos", tags=["Photos"])

@router.get("/me", response_model=List[MyPhotoResponse])
async def get_my_photos(
    section: str = "all", # 'all', 'favorites', 'recent'
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unified endpoint to retrieve approved matched photos containing the user's face."""
    from app.models import CommunityRole
    from sqlalchemy import or_, and_

    stmt = (
        select(PhotoFaceMatch)
        .outerjoin(CommunityMedia, PhotoFaceMatch.media_id == CommunityMedia.id)
        .outerjoin(Photo, PhotoFaceMatch.photo_id == Photo.id)
        .outerjoin(Event, Photo.event_id == Event.id)
        .options(
            selectinload(PhotoFaceMatch.media).selectinload(CommunityMedia.community),
            selectinload(PhotoFaceMatch.media).selectinload(CommunityMedia.album),
            selectinload(PhotoFaceMatch.photo).selectinload(Photo.event).selectinload(Event.community)
        )
        .where(PhotoFaceMatch.user_id == current_user.id)
        .where(PhotoFaceMatch.status == "approved")
        .where(PhotoFaceMatch.is_hidden == False)
    )

    if current_user.platform_role != "super_admin":
        stmt_roles = select(CommunityRole.community_id).where(CommunityRole.user_id == current_user.id)
        res_roles = await db.execute(stmt_roles)
        my_joined_ids = [row[0] for row in res_roles.all()]
        stmt = stmt.where(
            or_(
                CommunityMedia.community_id.in_(my_joined_ids),
                Event.community_id.in_(my_joined_ids)
            )
        )

    if section == "favorites":
        stmt = stmt.where(PhotoFaceMatch.is_favorite == True)

    stmt = stmt.order_by(PhotoFaceMatch.created_at.desc()).limit(limit).offset(offset)
    res = await db.execute(stmt)
    matches = res.scalars().all()

    photos = []
    for match in matches:
        file_url = ""
        community_title = ""
        album_name = None
        title = None
        description = None
        created_at = match.created_at

        if match.media:
            file_url = match.media.file_url
            community_title = match.media.community.title if match.media.community else "Community Gallery"
            album_name = match.media.album.name if match.media.album else None
            title = match.media.title
            description = match.media.description
            created_at = match.media.created_at
        elif match.photo:
            file_url = match.photo.storage_path
            community_title = match.photo.event.community.title if (match.photo.event and match.photo.event.community) else "Event Gallery"
            album_name = match.photo.event.title if match.photo.event else None
            title = match.photo.filename
            description = f"Photo from event {match.photo.event.title}" if match.photo.event else None
            created_at = match.photo.created_at

        if not file_url:
            continue

        photos.append(MyPhotoResponse(
            match_id=match.id,
            media_id=match.media_id,
            photo_id=match.photo_id,
            file_url=file_url,
            confidence=match.confidence_score,
            status=match.status,
            is_favorite=match.is_favorite,
            is_hidden=match.is_hidden,
            title=title,
            description=description,
            created_at=created_at,
            community_title=community_title,
            album_name=album_name
        ))

    return photos

@router.get("/me/pending", response_model=List[MyPhotoResponse])
async def get_my_pending_photos(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve medium confidence matches waiting for user confirmation."""
    from app.models import CommunityRole
    from sqlalchemy import or_, and_

    stmt = (
        select(PhotoFaceMatch)
        .outerjoin(CommunityMedia, PhotoFaceMatch.media_id == CommunityMedia.id)
        .outerjoin(Photo, PhotoFaceMatch.photo_id == Photo.id)
        .outerjoin(Event, Photo.event_id == Event.id)
        .options(
            selectinload(PhotoFaceMatch.media).selectinload(CommunityMedia.community),
            selectinload(PhotoFaceMatch.media).selectinload(CommunityMedia.album),
            selectinload(PhotoFaceMatch.photo).selectinload(Photo.event).selectinload(Event.community)
        )
        .where(PhotoFaceMatch.user_id == current_user.id)
        .where(PhotoFaceMatch.status == "pending")
        .where(PhotoFaceMatch.is_hidden == False)
    )

    if current_user.platform_role != "super_admin":
        stmt_roles = select(CommunityRole.community_id).where(CommunityRole.user_id == current_user.id)
        res_roles = await db.execute(stmt_roles)
        my_joined_ids = [row[0] for row in res_roles.all()]
        stmt = stmt.where(
            or_(
                CommunityMedia.community_id.in_(my_joined_ids),
                Event.community_id.in_(my_joined_ids)
            )
        )

    stmt = stmt.order_by(PhotoFaceMatch.created_at.desc()).limit(limit).offset(offset)
    res = await db.execute(stmt)
    matches = res.scalars().all()

    photos = []
    for match in matches:
        file_url = ""
        community_title = ""
        album_name = None
        title = None
        description = None
        created_at = match.created_at

        if match.media:
            file_url = match.media.file_url
            community_title = match.media.community.title if match.media.community else "Community Gallery"
            album_name = match.media.album.name if match.media.album else None
            title = match.media.title
            description = match.media.description
            created_at = match.media.created_at
        elif match.photo:
            file_url = match.photo.storage_path
            community_title = match.photo.event.community.title if (match.photo.event and match.photo.event.community) else "Event Gallery"
            album_name = match.photo.event.title if match.photo.event else None
            title = match.photo.filename
            description = f"Photo from event {match.photo.event.title}" if match.photo.event else None
            created_at = match.photo.created_at

        if not file_url:
            continue

        photos.append(MyPhotoResponse(
            match_id=match.id,
            media_id=match.media_id,
            photo_id=match.photo_id,
            file_url=file_url,
            confidence=match.confidence_score,
            status=match.status,
            is_favorite=match.is_favorite,
            is_hidden=match.is_hidden,
            title=title,
            description=description,
            created_at=created_at,
            community_title=community_title,
            album_name=album_name
        ))

    return photos

@router.get("/me/favorites", response_model=List[MyPhotoResponse])
async def get_my_favorites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve matched photos user favorited."""
    return await get_my_photos(section="favorites", db=db, current_user=current_user)

@router.get("/me/count")
async def get_my_photos_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return count of approved user matches."""
    from app.models import CommunityRole
    from sqlalchemy import or_, and_

    stmt = (
        select(PhotoFaceMatch)
        .outerjoin(CommunityMedia, PhotoFaceMatch.media_id == CommunityMedia.id)
        .outerjoin(Photo, PhotoFaceMatch.photo_id == Photo.id)
        .outerjoin(Event, Photo.event_id == Event.id)
        .where(PhotoFaceMatch.user_id == current_user.id)
        .where(PhotoFaceMatch.status == "approved")
        .where(PhotoFaceMatch.is_hidden == False)
    )

    if current_user.platform_role != "super_admin":
        stmt_roles = select(CommunityRole.community_id).where(CommunityRole.user_id == current_user.id)
        res_roles = await db.execute(stmt_roles)
        my_joined_ids = [row[0] for row in res_roles.all()]
        stmt = stmt.where(
            or_(
                CommunityMedia.community_id.in_(my_joined_ids),
                Event.community_id.in_(my_joined_ids)
            )
        )

    res = await db.execute(stmt)
    matches = res.scalars().all()
    return {"count": len(matches)}

@router.post("/{match_id}/favorite")
async def toggle_favorite_photo(
    match_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggles favorite flag for a match."""
    stmt = select(PhotoFaceMatch).where(PhotoFaceMatch.id == match_id, PhotoFaceMatch.user_id == current_user.id)
    res = await db.execute(stmt)
    match = res.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found.")

    match.is_favorite = not match.is_favorite
    await db.commit()
    return {"message": "Favorite updated successfully.", "is_favorite": match.is_favorite}

@router.post("/{match_id}/hide")
async def toggle_hide_photo(
    match_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggles hidden state for a match."""
    stmt = select(PhotoFaceMatch).where(PhotoFaceMatch.id == match_id, PhotoFaceMatch.user_id == current_user.id)
    res = await db.execute(stmt)
    match = res.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found.")

    match.is_hidden = not match.is_hidden
    await db.commit()
    return {"message": "Hidden state updated successfully.", "is_hidden": match.is_hidden}

@router.post("/{match_id}/confirm")
async def confirm_match(
    match_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Confirms a pending potential face match, promoting it to approved."""
    stmt = select(PhotoFaceMatch).where(PhotoFaceMatch.id == match_id, PhotoFaceMatch.user_id == current_user.id)
    res = await db.execute(stmt)
    match = res.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found.")

    match.status = "approved"
    match.is_verified_match = True
    await db.commit()
    return {"message": "Match approved successfully.", "status": match.status}

@router.post("/{match_id}/reject")
async def reject_match(
    match_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Rejects a face match (wrong match), setting status to rejected."""
    stmt = select(PhotoFaceMatch).where(PhotoFaceMatch.id == match_id, PhotoFaceMatch.user_id == current_user.id)
    res = await db.execute(stmt)
    match = res.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found.")

    match.status = "rejected"
    match.is_verified_match = False
    await db.commit()
    return {"message": "Match rejected successfully.", "status": match.status}

@router.post("/preferences", response_model=UserResponse)
async def update_privacy_preferences(
    prefs: UserPrivacyPreferencesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update face recognition and discovery preferences."""
    stmt = select(User).where(User.id == current_user.id)
    res = await db.execute(stmt)
    user = res.scalar_one()

    user.face_matching_enabled = prefs.face_matching_enabled
    user.match_notifications_enabled = prefs.match_notifications_enabled
    user.community_discovery_enabled = prefs.community_discovery_enabled
    user.hide_matches_from_analytics = prefs.hide_matches_from_analytics

    await db.commit()
    await db.refresh(user)
    return user


@router.get("/activity")
async def get_photos_activity(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Formulates a chronological activity array structured by relative date tags:
    - 'Today', 'Yesterday', '2 days ago', etc.
    """
    from datetime import datetime, date, timedelta
    from app.models import CommunityRole

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    stmt = (
        select(PhotoFaceMatch)
        .outerjoin(CommunityMedia, PhotoFaceMatch.media_id == CommunityMedia.id)
        .outerjoin(Photo, PhotoFaceMatch.photo_id == Photo.id)
        .outerjoin(Event, Photo.event_id == Event.id)
        .options(
            selectinload(PhotoFaceMatch.media).selectinload(CommunityMedia.community),
            selectinload(PhotoFaceMatch.photo).selectinload(Photo.event)
        )
        .where(
            PhotoFaceMatch.user_id == current_user.id,
            PhotoFaceMatch.status == "approved",
            PhotoFaceMatch.created_at >= thirty_days_ago
        )
    )

    stmt_roles = select(CommunityRole.community_id).where(CommunityRole.user_id == current_user.id)
    res_roles = await db.execute(stmt_roles)
    my_comm_ids = [row[0] for row in res_roles.all()]

    if current_user.platform_role != "super_admin":
        from sqlalchemy import or_, and_
        stmt = stmt.where(
            or_(
                CommunityMedia.community_id.in_(my_comm_ids),
                Event.community_id.in_(my_comm_ids)
            )
        )

    stmt = stmt.order_by(PhotoFaceMatch.created_at.desc())
    res = await db.execute(stmt)
    matches = res.scalars().all()
    
    matches_grouped = {}
    for m in matches:
        m_date = m.created_at.date()
        comm_title = "Gallery"
        if m.media and m.media.community:
            comm_title = m.media.community.title
        elif m.photo and m.photo.event and m.photo.event.community:
            comm_title = m.photo.event.community.title
            
        key = (m_date, comm_title)
        matches_grouped[key] = matches_grouped.get(key, 0) + 1

    # Fetch recent community media uploads
    uploads_grouped = {}
    if my_comm_ids:
        stmt_uploads = (
            select(CommunityMedia)
            .options(selectinload(CommunityMedia.community))
            .where(
                CommunityMedia.community_id.in_(my_comm_ids),
                CommunityMedia.created_at >= thirty_days_ago
            )
            .order_by(CommunityMedia.created_at.desc())
        )
        res_uploads = await db.execute(stmt_uploads)
        uploads = res_uploads.scalars().all()
        
        for u in uploads:
            u_date = u.created_at.date()
            comm_title = u.community.title if u.community else "Community Gallery"
            key = (u_date, comm_title)
            uploads_grouped[key] = uploads_grouped.get(key, 0) + 1

    feed_items = []
    
    def get_relative_date_label(d: date) -> str:
        today = datetime.utcnow().date()
        diff = (today - d).days
        if diff == 0:
            return "Today"
        elif diff == 1:
            return "Yesterday"
        else:
            return f"{diff} days ago"

    # Add match activities
    for (d, comm_title), count in matches_grouped.items():
        feed_items.append({
            "date": d,
            "relative_date": get_relative_date_label(d),
            "type": "match_found",
            "title": "New photos containing you found",
            "message": f"📸 {count} new photos containing you were found in '{comm_title}'."
        })
        
    # Add upload activities
    for (d, comm_title), count in uploads_grouped.items():
        feed_items.append({
            "date": d,
            "relative_date": get_relative_date_label(d),
            "type": "media_uploaded",
            "title": "New photos uploaded",
            "message": f"📁 '{comm_title}' uploaded {count} new photos."
        })

    feed_items.sort(key=lambda x: x["date"], reverse=True)
    
    for item in feed_items:
        item["date"] = item["date"].isoformat()
        
    return feed_items[:20]
