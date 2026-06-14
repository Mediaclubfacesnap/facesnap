from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy import or_, and_, func
from typing import List, Optional, Dict, Any
from uuid import UUID
import datetime
import logging
from pydantic import BaseModel

from app.database import get_db
from app.models import (
    User, Community, Event, Photo, CommunityMedia, PhotoFaceMatch,
    MediaAlbum, ChatMessage, CommunityAnnouncement, ConversationParticipant,
    SearchHistory, SavedSearch, EventRegistration, CommunityRole, Message,
    MemoryCollection
)
from app.schemas import (
    UserResponse, CommunityResponse, EventResponse, MyPhotoResponse, MessageResponse,
    MediaAlbumResponse, AnnouncementResponse, SearchHistoryResponse, SavedSearchResponse,
    SavedSearchCreate, GlobalSearchResponse, MemoryCollectionResponse
)
from app.routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/search", tags=["Smart Search System"])


# --- In-Memory Caching Layer (TTL Cache) ---
class SearchCacheManager:
    def __init__(self, ttl_seconds: int = 300): # 5 minutes TTL default
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl = datetime.timedelta(seconds=ttl_seconds)

    def get(self, key: str) -> Optional[Any]:
        if key in self.cache:
            entry = self.cache[key]
            if datetime.datetime.utcnow() - entry["timestamp"] < self.ttl:
                return entry["data"]
            else:
                del self.cache[key]
        return None

    def set(self, key: str, data: Any):
        self.cache[key] = {
            "data": data,
            "timestamp": datetime.datetime.utcnow()
        }

    def clear(self):
        self.cache.clear()

search_cache = SearchCacheManager(ttl_seconds=300) # 5-minute cache


# --- Natural Language Parser & Filters ---
def parse_natural_language(q: str, current_user_id: UUID) -> Dict[str, Any]:
    """
    Parses common natural language queries and maps them to structural filters.
    """
    q_clean = q.strip().lower()
    filters = {
        "scope": "all",
        "custom_filter": None,
        "date_filter": None
    }
    
    # 1. Scopes
    if "events this week" in q_clean:
        filters["scope"] = "events"
        filters["date_filter"] = "week"
    elif "my registered events" in q_clean or "registered events" in q_clean:
        filters["scope"] = "events"
        filters["custom_filter"] = "my_registered"
    elif "my photos" in q_clean or "photos containing me" in q_clean:
        filters["scope"] = "photos"
        filters["custom_filter"] = "photos_of_me"
    elif "unread messages" in q_clean:
        filters["scope"] = "messages"
        filters["custom_filter"] = "unread"
    elif "communities I joined" in q_clean or "joined groups" in q_clean:
        filters["scope"] = "communities"
        filters["custom_filter"] = "joined"
    
    # 2. Command shortcuts
    elif q_clean.startswith("/user "):
        filters["scope"] = "users"
        filters["query_override"] = q[6:]
    elif q_clean.startswith("/community "):
        filters["scope"] = "communities"
        filters["query_override"] = q[11:]
    elif q_clean.startswith("/event "):
        filters["scope"] = "events"
        filters["query_override"] = q[7:]
    elif q_clean.startswith("/photo "):
        filters["scope"] = "photos"
        filters["query_override"] = q[7:]
    elif q_clean.startswith("/message "):
        filters["scope"] = "messages"
        filters["query_override"] = q[9:]

    return filters


@router.get("", response_model=GlobalSearchResponse)
async def global_search(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Intelligent unified search engine across all components.
    Includes smart priority ranking and history logger.
    """
    import time
    start_time = time.time()
    if not q.strip():
        return GlobalSearchResponse(
            users=[], communities=[], events=[], photos=[], messages=[], highlights=[], announcements=[], memories=[]
        )

    # Resolve natural language parses & overrides
    nlp = parse_natural_language(q, current_user.id)
    search_query = nlp.get("query_override", q).strip()

    # Log Search History (Limit last 10 entries)
    now = datetime.datetime.utcnow()
    # Check if duplicate query in past 1 hour to prevent flooding
    dup_stmt = select(SearchHistory).where(
        SearchHistory.user_id == current_user.id,
        SearchHistory.query == q,
        SearchHistory.created_at >= now - datetime.timedelta(hours=1)
    )
    dup_res = await db.execute(dup_stmt)
    if not dup_res.scalars().all():
        history_entry = SearchHistory(user_id=current_user.id, query=q, created_at=now)
        db.add(history_entry)
        await db.flush()

        # Clean history older than last 10
        hist_count_stmt = select(SearchHistory).where(SearchHistory.user_id == current_user.id).order_by(SearchHistory.created_at.desc())
        hist_count_res = await db.execute(hist_count_stmt)
        all_hist = hist_count_res.scalars().all()
        if len(all_hist) > 10:
            for old_h in all_hist[10:]:
                await db.delete(old_h)
        await db.commit()

    # Check cache first for standard search queries
    cache_key = f"global:{current_user.id}:{q.lower()}"
    cached_result = search_cache.get(cache_key)
    if cached_result:
        return cached_result

    q_lower = search_query.lower()
    q_wild = f"%{q_lower}%"

    # Fetch communities user is a member of for isolation checks
    member_comms_stmt = select(CommunityRole.community_id).where(CommunityRole.user_id == current_user.id)
    member_comms_res = await db.execute(member_comms_stmt)
    my_joined_ids = set(member_comms_res.scalars().all())

    # Define return arrays
    users_list = []
    comms_list = []
    events_list = []
    photos_list = []
    msgs_list = []
    highlights_list = []
    announcements_list = []

    # 1. Search Users
    if nlp["scope"] in ["all", "users"]:
        user_stmt = select(User).where(
            or_(
                func.lower(User.username).contains(q_lower),
                func.lower(User.full_name).contains(q_lower)
            )
        ).limit(20)
        res = await db.execute(user_stmt)
        users_list = res.scalars().all()

    # 2. Search Communities (joined/owned ranked higher)
    if nlp["scope"] in ["all", "communities"]:
        comm_stmt = select(Community).where(
            Community.archived_at.is_(None),
            or_(
                func.lower(Community.title).contains(q_lower),
                func.lower(Community.description).contains(q_lower),
                func.lower(Community.category).contains(q_lower)
            )
        )
        # Apply privacy and custom filters
        if current_user.platform_role != "super_admin":
            comm_stmt = comm_stmt.where(Community.id.in_(my_joined_ids))
        elif nlp["custom_filter"] == "joined":
            comm_stmt = comm_stmt.where(Community.id.in_(my_joined_ids))

        res = await db.execute(comm_stmt)
        all_comms = res.scalars().all()
        # Ranking priority: Joined/Owned first
        comms_list = sorted(all_comms, key=lambda c: c.id in my_joined_ids or c.creator_id == current_user.id, reverse=True)[:20]

    # 3. Search Events (registered first, upcoming first)
    if nlp["scope"] in ["all", "events"]:
        # Find registered event IDs
        reg_stmt = select(EventRegistration.event_id).where(
            EventRegistration.user_id == current_user.id,
            EventRegistration.status == "registered"
        )
        reg_res = await db.execute(reg_stmt)
        my_reg_ids = set(reg_res.scalars().all())

        event_stmt = select(Event).join(Community, Community.id == Event.community_id).where(
            Community.archived_at.is_(None),
            or_(
                func.lower(Event.title).contains(q_lower),
                func.lower(Event.description).contains(q_lower),
                func.lower(Event.location).contains(q_lower),
                func.lower(Event.category).contains(q_lower)
            )
        )
        
        # Apply filters & privacy
        if current_user.platform_role != "super_admin":
            event_stmt = event_stmt.where(Event.community_id.in_(my_joined_ids))
            
        if nlp["date_filter"] == "week":
            today = datetime.date.today()
            event_stmt = event_stmt.where(Event.date >= today, Event.date <= today + datetime.timedelta(days=7))
        if nlp["custom_filter"] == "my_registered":
            event_stmt = event_stmt.where(Event.id.in_(my_reg_ids))

        res = await db.execute(event_stmt)
        all_events = res.scalars().all()
        # Ranking priority: Registered first
        events_list = sorted(all_events, key=lambda e: e.id in my_reg_ids, reverse=True)[:20]

    # 4. Search Photos (verified photos of me / favorites prioritized)
    if nlp["scope"] in ["all", "photos"]:
        # Fetch photos containing current user with face matching
        from sqlalchemy.orm import aliased
        CommPhotoMedia = aliased(Community)
        CommPhotoEvent = aliased(Community)
        photo_stmt = (
            select(PhotoFaceMatch)
            .outerjoin(CommunityMedia, PhotoFaceMatch.media_id == CommunityMedia.id)
            .outerjoin(Photo, PhotoFaceMatch.photo_id == Photo.id)
            .outerjoin(Event, Photo.event_id == Event.id)
            .outerjoin(CommPhotoMedia, CommunityMedia.community_id == CommPhotoMedia.id)
            .outerjoin(CommPhotoEvent, Event.community_id == CommPhotoEvent.id)
            .where(
                PhotoFaceMatch.user_id == current_user.id,
                or_(
                    and_(PhotoFaceMatch.media_id == None, PhotoFaceMatch.photo_id == None),
                    and_(PhotoFaceMatch.media_id != None, CommPhotoMedia.archived_at.is_(None)),
                    and_(PhotoFaceMatch.photo_id != None, CommPhotoEvent.archived_at.is_(None))
                )
            )
            .options(
                joinedload(PhotoFaceMatch.media).joinedload(CommunityMedia.album),
                joinedload(PhotoFaceMatch.photo).joinedload(Photo.event)
            )
        )

        if current_user.platform_role != "super_admin":
            photo_stmt = photo_stmt.where(
                or_(
                    CommunityMedia.community_id.in_(my_joined_ids),
                    Event.community_id.in_(my_joined_ids)
                )
            )

        if nlp["custom_filter"] == "photos_of_me":
            # Scoped strictly to Me
            pass
        else:
            # Match query on community/album name or photo description
            photo_stmt = photo_stmt.where(
                or_(
                    func.lower(CommunityMedia.title).contains(q_lower),
                    func.lower(CommunityMedia.description).contains(q_lower),
                    func.lower(Photo.filename).contains(q_lower)
                )
            )

        res = await db.execute(photo_stmt)
        matches = res.scalars().all()
        
        # Map to MyPhotoResponse Pydantic structures
        mapped_photos = []
        for m in matches:
            file_url = m.media.file_url if m.media else (m.photo.storage_path if m.photo else "")
            community_title = m.media.community.title if (m.media and m.media.community) else "Event Photo Archive"
            album_name = m.media.album.name if (m.media and m.media.album) else (m.photo.event.title if (m.photo and m.photo.event) else None)
            title = m.media.title if m.media else (m.photo.filename if m.photo else None)
            description = m.media.description if m.media else None

            mapped_photos.append(
                MyPhotoResponse(
                    match_id=m.id,
                    media_id=m.media_id,
                    photo_id=m.photo_id,
                    file_url=file_url,
                    confidence=m.confidence_score,
                    status=m.status,
                    is_favorite=m.is_favorite,
                    is_hidden=m.is_hidden,
                    title=title,
                    description=description,
                    created_at=m.created_at,
                    community_title=community_title,
                    album_name=album_name
                )
            )
        # Ranking Priority: Favorites & Verified Matches first
        photos_list = sorted(mapped_photos, key=lambda p: (p.is_favorite, p.confidence), reverse=True)[:20]

    # 5. Search Messages (restricted to conversations user is a participant in)
    if nlp["scope"] in ["all", "messages"]:
        # Find active conversation IDs for current user
        part_stmt = select(ConversationParticipant.conversation_id).where(
            ConversationParticipant.user_id == current_user.id
        )
        part_res = await db.execute(part_stmt)
        my_conv_ids = part_res.scalars().all()

        if my_conv_ids:
            msg_stmt = (
                select(Message)
                .where(
                    Message.conversation_id.in_(my_conv_ids),
                    func.lower(Message.content).contains(q_lower)
                )
                .options(selectinload(Message.sender))
                .order_by(Message.created_at.desc())
                .limit(20)
            )
            res = await db.execute(msg_stmt)
            msgs_list = res.scalars().all()

    # 6. Search Highlights (Albums marked is_highlights = True)
    if nlp["scope"] in ["all", "highlights"]:
        hl_stmt = select(MediaAlbum).join(Community, Community.id == MediaAlbum.community_id).where(
            MediaAlbum.is_highlights == True,
            Community.archived_at.is_(None),
            or_(
                func.lower(MediaAlbum.name).contains(q_lower),
                func.lower(MediaAlbum.description).contains(q_lower)
            )
        )
        if current_user.platform_role != "super_admin":
            hl_stmt = hl_stmt.where(MediaAlbum.community_id.in_(my_joined_ids))
        hl_stmt = hl_stmt.limit(20)
        res = await db.execute(hl_stmt)
        highlights_list = res.scalars().all()

    # 7. Search Announcements
    if nlp["scope"] in ["all", "announcements"]:
        ann_stmt = select(CommunityAnnouncement).join(Community, Community.id == CommunityAnnouncement.community_id).where(
            Community.archived_at.is_(None),
            or_(
                func.lower(CommunityAnnouncement.title).contains(q_lower),
                func.lower(CommunityAnnouncement.content).contains(q_lower)
            )
        ).options(joinedload(CommunityAnnouncement.community))
        if current_user.platform_role != "super_admin":
            ann_stmt = ann_stmt.where(CommunityAnnouncement.community_id.in_(my_joined_ids))
        ann_stmt = ann_stmt.limit(20)
        res = await db.execute(ann_stmt)
        announcements_list = res.scalars().all()

    # 8. Search Memories
    memories_list = []
    if nlp["scope"] in ["all", "memories"]:
        mem_stmt = select(MemoryCollection).where(
            MemoryCollection.user_id == current_user.id,
            or_(
                func.lower(MemoryCollection.title).contains(q_lower),
                func.lower(MemoryCollection.description).contains(q_lower)
            )
        ).limit(20)
        res = await db.execute(mem_stmt)
        memories_list = res.scalars().all()

    # Compile unified response
    response_obj = GlobalSearchResponse(
        users=[UserResponse.from_orm(u) for u in users_list],
        communities=[CommunityResponse.from_orm(c) for c in comms_list],
        events=[EventResponse.from_orm(e) for e in events_list],
        photos=photos_list, # already mapped to Pydantic responses
        messages=[MessageResponse.from_orm(m) for m in msgs_list],
        highlights=[MediaAlbumResponse.from_orm(h) for h in highlights_list],
        announcements=[AnnouncementResponse.from_orm(a) for a in announcements_list],
        memories=[MemoryCollectionResponse.from_orm(m) for m in memories_list]
    )

    # Set cache
    search_cache.set(cache_key, response_obj)

    # Log Search Quality Telemetry (Module 10)
    try:
        duration_ms = (time.time() - start_time) * 1000
        result_count = (
            len(users_list) + len(comms_list) + len(events_list) +
            len(photos_list) + len(msgs_list) + len(highlights_list) +
            len(announcements_list)
        )
        from app.database import AsyncSessionLocal
        from app.models import SearchMetric
        async def log_search_metric():
            async with AsyncSessionLocal() as metric_db:
                metric = SearchMetric(
                    query=q,
                    duration_ms=duration_ms,
                    result_count=result_count,
                    is_success=True,
                    user_id=current_user.id
                )
                metric_db.add(metric)
                await metric_db.commit()
        import asyncio
        asyncio.create_task(log_search_metric())
    except Exception:
        pass

    return response_obj


@router.get("/users", response_model=List[UserResponse])
async def search_users(
    q: str,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(User).where(
        or_(
            func.lower(User.username).contains(q.lower()),
            func.lower(User.full_name).contains(q.lower())
        )
    ).limit(limit).offset(offset)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/communities", response_model=List[CommunityResponse])
async def search_communities(
    q: str,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.platform_role == "super_admin":
        stmt = select(Community).where(
            Community.archived_at.is_(None),
            or_(
                func.lower(Community.title).contains(q.lower()),
                func.lower(Community.description).contains(q.lower()),
                func.lower(Community.category).contains(q.lower())
            )
        ).limit(limit).offset(offset)
    else:
        stmt = (
            select(Community)
            .join(CommunityRole)
            .where(
                Community.archived_at.is_(None),
                CommunityRole.user_id == current_user.id,
                or_(
                    func.lower(Community.title).contains(q.lower()),
                    func.lower(Community.description).contains(q.lower()),
                    func.lower(Community.category).contains(q.lower())
                )
            )
            .limit(limit)
            .offset(offset)
        )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/events", response_model=List[EventResponse])
async def search_events(
    q: str,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.platform_role == "super_admin":
        stmt = select(Event).join(Community, Community.id == Event.community_id).where(
            Community.archived_at.is_(None),
            or_(
                func.lower(Event.title).contains(q.lower()),
                func.lower(Event.description).contains(q.lower()),
                func.lower(Event.location).contains(q.lower()),
                func.lower(Event.category).contains(q.lower())
            )
        ).limit(limit).offset(offset)
    else:
        stmt = (
            select(Event)
            .join(CommunityRole, CommunityRole.community_id == Event.community_id)
            .join(Community, Community.id == Event.community_id)
            .where(
                Community.archived_at.is_(None),
                CommunityRole.user_id == current_user.id,
                or_(
                    func.lower(Event.title).contains(q.lower()),
                    func.lower(Event.description).contains(q.lower()),
                    func.lower(Event.location).contains(q.lower()),
                    func.lower(Event.category).contains(q.lower())
                )
            )
            .limit(limit)
            .offset(offset)
        )
    res = await db.execute(stmt)
    return res.scalars().all()


# --- Autocomplete & Suggestions Engine ---
@router.get("/suggestions", response_model=List[str])
async def get_suggestions(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lightning-fast auto-suggestions engine as user types.
    Comps from communities list, event titles, and highlight albums.
    """
    if not q.strip() or len(q) < 2:
        return []

    q_lower = q.lower()
    suggestions = set()

    # 1. Fetch matching community titles
    # Fetch communities user is a member of for isolation checks
    if current_user.platform_role != "super_admin":
        member_comms_stmt = select(CommunityRole.community_id).where(CommunityRole.user_id == current_user.id)
        member_comms_res = await db.execute(member_comms_stmt)
        my_joined_ids = [row[0] for row in member_comms_res.all()]
    else:
        my_joined_ids = []

    comm_stmt = select(Community.title).where(
        Community.archived_at.is_(None),
        func.lower(Community.title).contains(q_lower)
    )
    if current_user.platform_role != "super_admin":
        comm_stmt = comm_stmt.where(Community.id.in_(my_joined_ids))
    comm_stmt = comm_stmt.limit(3)
    comm_res = await db.execute(comm_stmt)
    for title in comm_res.scalars().all():
        suggestions.add(title)

    # 2. Fetch matching event titles
    event_stmt = select(Event.title).join(Community, Community.id == Event.community_id).where(
        Community.archived_at.is_(None),
        func.lower(Event.title).contains(q_lower)
    )
    if current_user.platform_role != "super_admin":
        event_stmt = event_stmt.where(Event.community_id.in_(my_joined_ids))
    event_stmt = event_stmt.limit(3)
    event_res = await db.execute(event_stmt)
    for title in event_res.scalars().all():
        suggestions.add(title)

    # 3. Fetch matching highlight albums
    hl_stmt = select(MediaAlbum.name).join(Community, Community.id == MediaAlbum.community_id).where(
        MediaAlbum.is_highlights == True,
        Community.archived_at.is_(None),
        func.lower(MediaAlbum.name).contains(q_lower)
    )
    if current_user.platform_role != "super_admin":
        hl_stmt = hl_stmt.where(MediaAlbum.community_id.in_(my_joined_ids))
    hl_stmt = hl_stmt.limit(3)
    hl_res = await db.execute(hl_stmt)
    for name in hl_res.scalars().all():
        suggestions.add(name)

    # 4. Fetch trending history search queries matching typing
    hist_stmt = select(SearchHistory.query).where(
        SearchHistory.user_id == current_user.id,
        func.lower(SearchHistory.query).contains(q_lower)
    ).limit(3)
    hist_res = await db.execute(hist_stmt)
    for query in hist_res.scalars().all():
        suggestions.add(query)

    return sorted(list(suggestions))[:10]


# --- Search History Management ---
@router.get("/history", response_model=List[SearchHistoryResponse])
async def get_search_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(SearchHistory).where(SearchHistory.user_id == current_user.id).order_by(SearchHistory.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.delete("/history")
async def clear_search_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(SearchHistory).where(SearchHistory.user_id == current_user.id)
    res = await db.execute(stmt)
    for entry in res.scalars().all():
        await db.delete(entry)
    await db.commit()
    search_cache.clear()
    return {"status": "success", "message": "Search history cleared successfully"}


# --- Saved Searches (Bookmark Manager) ---
@router.get("/saved", response_model=List[SavedSearchResponse])
async def get_saved_searches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(SavedSearch).where(SavedSearch.user_id == current_user.id).order_by(SavedSearch.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/saved", response_model=SavedSearchResponse)
async def save_search(
    payload: SavedSearchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Enforce bookmark limit (15 searches per user max)
    count_stmt = select(SavedSearch).where(SavedSearch.user_id == current_user.id)
    count_res = await db.execute(count_stmt)
    current_count = len(count_res.scalars().all())
    if current_count >= 15:
        raise HTTPException(
            status_code=400,
            detail="Maximum saved searches limit reached (max 15 saved searches allowed)"
        )

    # Avoid duplicate saved searches
    dup_stmt = select(SavedSearch).where(
        SavedSearch.user_id == current_user.id,
        SavedSearch.query == payload.query
    )
    dup_res = await db.execute(dup_stmt)
    if dup_res.scalars().all():
        return dup_res.scalars().first()

    new_saved = SavedSearch(
        user_id=current_user.id,
        query=payload.query,
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_saved)
    await db.commit()
    await db.refresh(new_saved)
    return new_saved


@router.delete("/saved/{id}")
async def delete_saved_search(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(SavedSearch).where(
        SavedSearch.id == id,
        SavedSearch.user_id == current_user.id
    )
    res = await db.execute(stmt)
    saved = res.scalar_one_or_none()
    if not saved:
        raise HTTPException(status_code=404, detail="Saved search bookmark not found")

    await db.delete(saved)
    await db.commit()
    return {"status": "success", "message": "Saved search bookmark deleted successfully"}


# --- Trending Searches ---
@router.get("/trending", response_model=List[str])
async def get_trending_searches(
    db: AsyncSession = Depends(get_db)
):
    """
    Returns trending search queries based on aggregate SearchHistory counts in past 7 days.
    """
    cache_key = "trending_searches"
    cached = search_cache.get(cache_key)
    if cached:
        return cached

    now = datetime.datetime.utcnow()
    week_ago = now - datetime.timedelta(days=7)

    # Query most common terms
    stmt = select(SearchHistory.query).where(
        SearchHistory.created_at >= week_ago
    )
    res = await db.execute(stmt)
    queries = res.scalars().all()

    # Aggregate frequencies in Python
    freq: Dict[str, int] = {}
    for q in queries:
        q_clean = q.strip().lower()
        if len(q_clean) < 3:
            continue
        freq[q_clean] = freq.get(q_clean, 0) + 1

    # Sort and take top 5
    top_terms = sorted(freq.keys(), key=lambda k: freq[k], reverse=True)[:5]

    # Standard placeholders if history is completely empty
    if len(top_terms) < 3:
        top_terms = ["photography", "hackathon", "media club", "workshop"]

    # Title-case for premium display
    trending_list = [t.title() for t in top_terms]
    search_cache.set(cache_key, trending_list)

    return trending_list
