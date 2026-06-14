from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any
from uuid import UUID
import datetime

from app.database import get_db
from app.models import (
    User, MemoryCollection, MemoryPhoto, MemoryPerson, 
    Photo, CommunityMedia, PhotoFaceMatch, FacePrivacySettings
)
from app.routes.auth import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/memories", tags=["AI Memory Timeline"])

class MemoryCollectionCreate(BaseModel):
    title: str
    description: str = None
    memory_type: str = "CUSTOM"
    memory_date: datetime.datetime = None

@router.get("")
async def get_timeline(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns user memories partitioned by year.
    Example: [{ year: 2026, collections: [...] }]
    """
    stmt = select(MemoryCollection).where(
        MemoryCollection.user_id == current_user.id
    ).order_by(MemoryCollection.memory_date.desc().nulls_last(), MemoryCollection.created_at.desc())
    
    result = await db.execute(stmt)
    memories = result.scalars().all()
    
    timeline = {}
    for m in memories:
        year = m.memory_date.year if m.memory_date else m.created_at.year
        if year not in timeline:
            timeline[year] = []
        
        # Resolve Cover Photo URL
        cover_url = None
        if m.cover_photo_id:
            photo = await db.execute(select(Photo).where(Photo.id == m.cover_photo_id))
            photo = photo.scalar_one_or_none()
            if photo:
                cover_url = photo.storage_path
            else:
                media = await db.execute(select(CommunityMedia).where(CommunityMedia.id == m.cover_photo_id))
                media = media.scalar_one_or_none()
                if media:
                    cover_url = media.file_url

        timeline[year].append({
            "id": str(m.id),
            "title": m.title,
            "description": m.description,
            "memory_type": m.memory_type,
            "memory_date": m.memory_date.isoformat() if m.memory_date else None,
            "photo_count": m.photo_count,
            "people_count": m.people_count,
            "cover_url": cover_url
        })
        
    formatted_timeline = [
        {"year": year, "collections": collections} 
        for year, collections in sorted(timeline.items(), key=lambda x: x[0], reverse=True)
    ]
    
    return formatted_timeline

@router.get("/highlights")
async def get_highlights(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns AI highlights: Top Memory, Most Active Year.
    """
    # Best Memory
    stmt = select(MemoryCollection).where(
        MemoryCollection.user_id == current_user.id
    ).order_by(MemoryCollection.memory_score.desc()).limit(1)
    
    result = await db.execute(stmt)
    top_memory = result.scalar_one_or_none()
    
    return {
        "top_memory": {"id": str(top_memory.id), "title": top_memory.title} if top_memory else None,
        "most_active_year": 2026, # Hardcoded for now
        "best_group_photo": None
    }

@router.get("/insights/relationships")
async def get_relationship_insights(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns dynamic relationship insights from PhotoFaceMatch.
    Enforces allow_relationship_graph privacy rules.
    """
    from app.models import CommunityRole, Event
    from sqlalchemy import or_, and_

    # Get user's joined communities
    stmt_roles = select(CommunityRole.community_id).where(CommunityRole.user_id == current_user.id)
    res_roles = await db.execute(stmt_roles)
    my_joined_ids = [row[0] for row in res_roles.all()]

    # Find all photo_ids where current_user appears
    my_photos_stmt = select(PhotoFaceMatch.photo_id, PhotoFaceMatch.media_id).where(
        PhotoFaceMatch.user_id == current_user.id,
        PhotoFaceMatch.is_verified_match == True
    )

    if current_user.platform_role != "super_admin":
        my_photos_stmt = (
            my_photos_stmt
            .outerjoin(CommunityMedia, PhotoFaceMatch.media_id == CommunityMedia.id)
            .outerjoin(Photo, PhotoFaceMatch.photo_id == Photo.id)
            .outerjoin(Event, Photo.event_id == Event.id)
            .where(
                or_(
                    CommunityMedia.community_id.in_(my_joined_ids),
                    Event.community_id.in_(my_joined_ids)
                )
            )
        )

    my_photos_res = await db.execute(my_photos_stmt)
    
    photo_ids = set()
    media_ids = set()
    for row in my_photos_res.all():
        if row.photo_id: photo_ids.add(row.photo_id)
        if row.media_id: media_ids.add(row.media_id)
        
    if not photo_ids and not media_ids:
        return []

    # Find co-appearances
    co_stmt = select(PhotoFaceMatch.user_id, func.count(PhotoFaceMatch.id).label("appearances")).where(
        (PhotoFaceMatch.photo_id.in_(photo_ids)) | (PhotoFaceMatch.media_id.in_(media_ids)),
        PhotoFaceMatch.user_id != current_user.id,
        PhotoFaceMatch.is_verified_match == True
    ).group_by(PhotoFaceMatch.user_id).order_by(func.count(PhotoFaceMatch.id).desc()).limit(10)

    co_res = await db.execute(co_stmt)
    co_appearances = co_res.all()

    results = []
    for u_id, count in co_appearances:
        # Enforce Privacy
        privacy_stmt = select(FacePrivacySettings).where(FacePrivacySettings.user_id == u_id)
        privacy_res = await db.execute(privacy_stmt)
        privacy = privacy_res.scalar_one_or_none()
        
        # If user explicitly disabled relationship graph, skip them
        if privacy and not privacy.allow_relationship_graph:
            continue
            
        user_stmt = select(User).where(User.id == u_id)
        user_res = await db.execute(user_stmt)
        user = user_res.scalar_one_or_none()
        
        if user:
            results.append({
                "user_id": str(user.id),
                "user": user.full_name,
                "appearances": count,
                "avatar_url": user.avatar_url
            })

    return results

@router.get("/{id}")
async def get_memory_detail(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(MemoryCollection).where(
        MemoryCollection.id == id,
        MemoryCollection.user_id == current_user.id
    )
    result = await db.execute(stmt)
    memory = result.scalar_one_or_none()
    
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
        
    # Get photos
    photo_stmt = select(MemoryPhoto).where(MemoryPhoto.memory_id == id)
    photo_res = await db.execute(photo_stmt)
    memory_photos = photo_res.scalars().all()
    
    photos_data = []
    for mp in memory_photos:
        file_url = None
        photo = await db.execute(select(Photo).where(Photo.id == mp.photo_id))
        photo = photo.scalar_one_or_none()
        if photo:
            file_url = photo.storage_path
        else:
            media = await db.execute(select(CommunityMedia).where(CommunityMedia.id == mp.photo_id))
            media = media.scalar_one_or_none()
            if media:
                file_url = media.file_url
        if file_url:
            photos_data.append({
                "photo_id": str(mp.photo_id),
                "url": file_url,
                "confidence": mp.confidence_score
            })
            
    # Resolve Cover Photo
    cover_url = None
    if memory.cover_photo_id:
        # Same check as above
        photo = await db.execute(select(Photo).where(Photo.id == memory.cover_photo_id))
        photo = photo.scalar_one_or_none()
        if photo:
            cover_url = photo.storage_path
        else:
            media = await db.execute(select(CommunityMedia).where(CommunityMedia.id == memory.cover_photo_id))
            media = media.scalar_one_or_none()
            if media:
                cover_url = media.file_url

    return {
        "id": str(memory.id),
        "title": memory.title,
        "description": memory.description,
        "memory_type": memory.memory_type,
        "memory_date": memory.memory_date.isoformat() if memory.memory_date else None,
        "cover_url": cover_url,
        "photos": photos_data,
        "people": [], # Placeholder for people
        "community": {} # Placeholder for community details
    }

@router.post("")
async def create_memory(
    payload: MemoryCollectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    mem = MemoryCollection(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        memory_type=payload.memory_type,
        memory_date=payload.memory_date or datetime.datetime.utcnow()
    )
    db.add(mem)
    await db.commit()
    await db.refresh(mem)
    return {"id": str(mem.id), "title": mem.title}

@router.delete("/{id}")
async def delete_memory(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(MemoryCollection).where(
        MemoryCollection.id == id,
        MemoryCollection.user_id == current_user.id
    )
    result = await db.execute(stmt)
    mem = result.scalar_one_or_none()
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")
        
    await db.delete(mem)
    await db.commit()
    return {"status": "success", "message": "Memory deleted"}
