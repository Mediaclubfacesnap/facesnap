from fastapi import APIRouter, Depends, HTTPException, status, Body, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from typing import List
from uuid import UUID
import base64
import io
import time
import zipfile
import requests
import logging
import anyio
from app.database import get_db
from app.models import Event, Photo, PhotoFace, VerificationSession, User, CommunityRole
from app.schemas import VerificationRequest, VerificationResponse, MatchedPhotoResponse, RecognitionHistoryResponse
from app.services.ai_service import AIService
from app.routes.auth import get_current_user
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/verification", tags=["Verification"])

@router.post("/{event_id}", response_model=List[MatchedPhotoResponse])
async def verify_and_search_memories(
    event_id: UUID,
    payload: VerificationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Start performance timer
    start_time = time.time()

    # Verify event exists
    event_stmt = select(Event).where(Event.id == event_id)
    event_res = await db.execute(event_stmt)
    if not event_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found."
        )

    # Parse selfie base64 image
    try:
        header, encoded = payload.image_base64.split(",", 1) if "," in payload.image_base64 else ("", payload.image_base64)
        image_bytes = base64.b64decode(encoded)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 image payload: {e}"
        )

    # Perform Liveness and Embedding Generation inside thread pool
    is_live, liveness_score, selfie_embedding = await anyio.to_thread.run_sync(
        AIService.verify_liveness, image_bytes
    )

    # Capture request metadata
    client_ip = request.client.host if request.client else None
    device_info = request.headers.get("user-agent", "Unknown")

    # Create verification audit record
    session_record = VerificationSession(
        user_id=current_user.id,
        event_id=event_id,
        status="verified" if is_live else "failed",
        liveness_score=liveness_score,
        ip_address=client_ip,
        device_info=device_info,
        face_embedding=selfie_embedding if is_live else None
    )
    db.add(session_record)

    if not is_live:
        # Log failed verification with timing
        session_record.processing_time_ms = int((time.time() - start_time) * 1000)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Verification failed: Anti-spoofing alert. Liveness score: {liveness_score:.2f}."
        )

    # Set of embeddings to query across all captured side profiles (pitch up, pitch down, yaw right, yaw left + front)
    query_embeddings = [selfie_embedding]

    # Extract embeddings from optional side-profile photos
    for side_base64 in [payload.image_up, payload.image_down, payload.image_right, payload.image_left]:
        if side_base64:
            try:
                header, encoded = side_base64.split(",", 1) if "," in side_base64 else ("", side_base64)
                side_bytes = base64.b64decode(encoded)
                faces = await anyio.to_thread.run_sync(AIService.extract_faces, side_bytes)
                if faces:
                    query_embeddings.append(faces[0]["embedding"])
            except Exception as e:
                logger.warning(f"Error extracting side profile embedding: {e}")

    # Query the vector space for all captured facial angles (all sides)
    all_matches = []
    for emb in query_embeddings:
        distance_expr = PhotoFace.embedding.cosine_distance(emb)
        stmt = (
            select(
                Photo.id.label("photo_id"),
                Photo.filename,
                Photo.storage_path,
                PhotoFace.bbox,
                (1.0 - distance_expr).label("confidence")
            )
            .join(PhotoFace, Photo.id == PhotoFace.photo_id)
            .where(Photo.event_id == event_id)
            .where(distance_expr <= 0.30)
            .order_by(distance_expr.asc())
        )
        res = await db.execute(stmt)
        all_matches.extend(res.all())

    # Format and deduplicate response list (only keep highest confidence match per photo across all angles)
    seen_photos = {}
    for match in all_matches:
        p_id = match.photo_id
        conf = float(match.confidence)
        if p_id not in seen_photos or conf > seen_photos[p_id]["confidence"]:
            seen_photos[p_id] = {
                "photo_id": p_id,
                "filename": match.filename,
                "storage_path": match.storage_path,
                "confidence": conf,
                "bbox": match.bbox
            }

    # Sort results by confidence descending
    matched_photos = sorted(seen_photos.values(), key=lambda x: x["confidence"], reverse=True)

    # Calculate recognition analytics
    processing_time_ms = int((time.time() - start_time) * 1000)
    avg_confidence = (
        sum(m["confidence"] for m in matched_photos) / len(matched_photos)
        if matched_photos else 0.0
    )

    # Update session record with full recognition data
    session_record.matched_photos_count = len(matched_photos)
    session_record.average_confidence = round(avg_confidence, 4)
    session_record.processing_time_ms = processing_time_ms
    await db.commit()

    logger.info(
        f"Recognition logged: User @{current_user.username} | "
        f"{len(matched_photos)} matches | {avg_confidence:.2%} avg confidence | "
        f"{processing_time_ms}ms | IP: {client_ip}"
    )
    return matched_photos


@router.get("/results/{event_id}", response_model=List[MatchedPhotoResponse])
async def get_verification_results(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves exact matched event photos for the current user based on their
    latest successful verification session, completely bypassing frontend session storage.
    """
    # Find latest successful verification session for this user and event
    stmt = (
        select(VerificationSession)
        .where(
            VerificationSession.user_id == current_user.id,
            VerificationSession.event_id == event_id,
            VerificationSession.status == "verified",
            VerificationSession.face_embedding.isnot(None)
        )
        .order_by(VerificationSession.created_at.desc())
        .limit(1)
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No successful verification session found. Please complete face verification first."
        )
        
    # Perform vector similarity search with a slightly wider high-precision threshold of 0.32
    emb = session.face_embedding
    distance_expr = PhotoFace.embedding.cosine_distance(emb)
    query_stmt = (
        select(
            Photo.id.label("photo_id"),
            Photo.filename,
            Photo.storage_path,
            PhotoFace.bbox,
            (1.0 - distance_expr).label("confidence")
        )
        .join(PhotoFace, Photo.id == PhotoFace.photo_id)
        .where(Photo.event_id == event_id)
        .where(distance_expr <= 0.32) # Matches exactly with optimal precision
        .order_by(distance_expr.asc())
    )
    query_res = await db.execute(query_stmt)
    all_matches = query_res.all()
    
    # Deduplicate matching results (keep highest confidence per photo)
    seen_photos = {}
    for match in all_matches:
        p_id = match.photo_id
        conf = float(match.confidence)
        if p_id not in seen_photos or conf > seen_photos[p_id]["confidence"]:
            seen_photos[p_id] = {
                "photo_id": p_id,
                "filename": match.filename,
                "storage_path": match.storage_path,
                "confidence": conf,
                "bbox": match.bbox
            }
            
    matched_photos = sorted(seen_photos.values(), key=lambda x: x["confidence"], reverse=True)
    return matched_photos


# ──────────────────────────────────────────────────────────
# Recognition History API (Host/Admin Only)
# ──────────────────────────────────────────────────────────

@router.get("/history/{community_id}", response_model=List[RecognitionHistoryResponse])
async def get_recognition_history(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch recognition search history for all events in a community. Host/Admin only."""
    # Verify host/admin role
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id,
        CommunityRole.role.in_(["host", "admin"])
    )
    role_res = await db.execute(role_stmt)
    if not role_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only hosts and admins can view recognition history."
        )

    # Get all events in this community
    event_ids_stmt = select(Event.id).where(Event.community_id == community_id)
    event_ids_res = await db.execute(event_ids_stmt)
    event_ids = [r[0] for r in event_ids_res.all()]

    if not event_ids:
        return []

    # Fetch all verification sessions with user and event relationships
    stmt = (
        select(VerificationSession)
        .options(
            selectinload(VerificationSession.user),
            selectinload(VerificationSession.event)
        )
        .where(VerificationSession.event_id.in_(event_ids))
        .order_by(VerificationSession.created_at.desc())
        .limit(200)
    )
    result = await db.execute(stmt)
    sessions = result.scalars().all()

    return sessions


@router.get("/stats/{community_id}")
async def get_recognition_stats(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch aggregated recognition stats for a community. Host/Admin only."""
    # Verify host/admin role
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id,
        CommunityRole.role.in_(["host", "admin"])
    )
    role_res = await db.execute(role_stmt)
    if not role_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only hosts and admins can view recognition stats."
        )

    # Get all events in this community
    event_ids_stmt = select(Event.id).where(Event.community_id == community_id)
    event_ids_res = await db.execute(event_ids_stmt)
    event_ids = [r[0] for r in event_ids_res.all()]

    if not event_ids:
        return {"total_searches": 0, "total_photos_found": 0, "failed_searches": 0, "most_active_username": None}

    # Total searches
    total_res = await db.execute(
        select(func.count(VerificationSession.id)).where(VerificationSession.event_id.in_(event_ids))
    )
    total_searches = total_res.scalar() or 0

    # Total photos found
    photos_res = await db.execute(
        select(func.coalesce(func.sum(VerificationSession.matched_photos_count), 0)).where(
            VerificationSession.event_id.in_(event_ids)
        )
    )
    total_photos_found = photos_res.scalar() or 0

    # Failed searches
    failed_res = await db.execute(
        select(func.count(VerificationSession.id)).where(
            VerificationSession.event_id.in_(event_ids),
            VerificationSession.status == "failed"
        )
    )
    failed_searches = failed_res.scalar() or 0

    # Most active user
    most_active_res = await db.execute(
        select(User.username, func.count(VerificationSession.id).label("cnt"))
        .join(VerificationSession, User.id == VerificationSession.user_id)
        .where(VerificationSession.event_id.in_(event_ids))
        .group_by(User.username)
        .order_by(func.count(VerificationSession.id).desc())
        .limit(1)
    )
    most_active_row = most_active_res.first()
    most_active_username = most_active_row[0] if most_active_row else None

    # Total photos uploaded in this community across all events
    total_photos_res = await db.execute(
        select(func.count(Photo.id)).where(Photo.event_id.in_(event_ids))
    )
    total_photos = total_photos_res.scalar() or 0

    # Calculate estimated storage used: say, each photo is roughly 2.8 MB (2,936,012 bytes)
    storage_used_bytes = total_photos * 2936012

    return {
        "total_searches": total_searches,
        "total_photos_found": int(total_photos_found),
        "failed_searches": failed_searches,
        "most_active_username": most_active_username,
        "total_photos": total_photos,
        "storage_used_bytes": storage_used_bytes
    }


# ──────────────────────────────────────────────────────────
# ZIP Download Endpoint
# ──────────────────────────────────────────────────────────

@router.post("/download")
async def download_selected_photos(
    photo_urls: List[str] = Body(..., embed=False),
    current_user: User = Depends(get_current_user)
):
    """
    Downloads list of public photos from Supabase Storage and aggregates
    them dynamically on-the-fly into a compressed ZIP stream.
    """
    if not photo_urls:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No photo URLs provided."
        )

    # Secure SSRF: Strictly validate that all photo URLs originate from our Supabase Storage domain
    for url in photo_urls:
        if not url.startswith(settings.SUPABASE_URL):
            logger.warning(f"SSRF Prevention: Blocked unauthorized download URL request '{url}' from user '{current_user.username}'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Security Alert: Domain validation failed. Only Supabase storage URLs are permitted."
            )

    # In-memory buffer to stream ZIP
    zip_buffer = io.BytesIO()

    try:
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for idx, url in enumerate(photo_urls):
                try:
                    response = await anyio.to_thread.run_sync(
                        lambda: requests.get(url, timeout=10)
                    )
                    if response.status_code == 200:
                        # Derive custom file names to avoid collisions
                        filename = url.split("/")[-1]
                        if not filename.endswith(".jpg"):
                            filename = f"photo_{idx + 1}.jpg"
                        zip_file.writestr(filename, response.content)
                except Exception as fetch_err:
                    logger.error(f"Error fetching photo for zip compilation: {url} - {fetch_err}")
                    continue

        zip_buffer.seek(0)
    except Exception as zip_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate ZIP archive: {zip_err}"
        )

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=facesnap_memories.zip"}
    )
