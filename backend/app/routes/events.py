from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID
from app.database import get_db
from app.models import Event, CommunityRole, User, Community
from app.schemas import EventCreate, EventResponse
from app.routes.auth import get_current_user

router = APIRouter(prefix="/events", tags=["Events"])

async def verify_contributor_permission(community_id: UUID, user_id: UUID, db: AsyncSession) -> bool:
    """Verifies if the user is a host, admin, or contributor in the given community."""
    stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == user_id
    )
    result = await db.execute(stmt)
    role_record = result.scalar_one_or_none()
    if not role_record:
        return False
    return role_record.role in ("host", "admin", "contributor")

@router.post("/{community_id}", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    community_id: UUID,
    event_in: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify permission
    has_permission = await verify_contributor_permission(community_id, current_user.id, db)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have host or contributor permissions in this community to create events."
        )

    # Verify community exists
    comm_res = await db.execute(select(Community).where(Community.id == community_id))
    if not comm_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Community not found"
        )

    new_event = Event(
        community_id=community_id,
        title=event_in.title,
        description=event_in.description,
        location=event_in.location,
        date=event_in.date,
        status="draft",
        banner_url=event_in.banner_url or event_in.cover_url,
        creator_id=current_user.id
    )
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)
    return new_event

@router.get("/community/{community_id}", response_model=List[EventResponse])
async def list_community_events(community_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Event)
        .where(Event.community_id == community_id)
        .order_by(Event.date.desc())
    )
    return result.scalars().all()

@router.get("/{event_id}", response_model=EventResponse)
async def get_event(event_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    return event

@router.put("/{event_id}/banner", response_model=EventResponse)
async def update_event_banner(
    event_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Allows group hosts or contributors to update event banner URL at any time."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    has_permission = await verify_contributor_permission(event.community_id, current_user.id, db)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group hosts, admins or contributors can update event settings."
        )

    banner_url = payload.get("banner_url")
    event.banner_url = banner_url
    await db.commit()
    await db.refresh(event)
    return event

