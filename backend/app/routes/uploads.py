from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID
import uuid
import hashlib
import logging
import anyio
from app.database import get_db, AsyncSessionLocal
from app.models import Event, Photo, PhotoFace, User
from app.schemas import PhotoResponse
from app.services.storage_service import storage_service
from app.services.ai_service import AIService
from app.routes.auth import get_current_user
from app.routes.events import verify_contributor_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/uploads", tags=["Uploads"])

# --- Background Ingestion Worker ---
async def process_photo_faces(photo_id: UUID, image_bytes: bytes):
    """
    Asynchronous worker task:
    1. Calls PyTorch/MTCNN to extract faces and 512-D embeddings.
    2. Inserts face metadata and embeddings into Supabase PostgreSQL.
    3. Flags photo as 'indexed' or 'failed'.
    """
    logger.info(f"Background worker: Processing faces for Photo {photo_id}...")
    async with AsyncSessionLocal() as db:
        try:
            # Run heavy CPU-bound detection in thread pool to prevent blocking the event loop
            faces = await anyio.to_thread.run_sync(AIService.extract_faces, image_bytes)
            
            for face in faces:
                new_face = PhotoFace(
                    photo_id=photo_id,
                    bbox=face["bbox"],
                    embedding=face["embedding"]
                )
                db.add(new_face)
            
            # Update photo status
            stmt = select(Photo).where(Photo.id == photo_id)
            result = await db.execute(stmt)
            photo = result.scalar_one_or_none()
            if photo:
                photo.status = "indexed" if len(faces) > 0 else "indexed" # Even if 0 faces, mark indexed so search handles it
                
            await db.commit()
            logger.info(f"Background worker: Photo {photo_id} successfully indexed with {len(faces)} faces.")
        except Exception as e:
            logger.error(f"Background worker: Failed indexing faces for Photo {photo_id}: {e}")
            stmt = select(Photo).where(Photo.id == photo_id)
            result = await db.execute(stmt)
            photo = result.scalar_one_or_none()
            if photo:
                photo.status = "failed"
            await db.commit()

# --- Ingestion Router Endpoint ---
@router.post("/{event_id}", response_model=List[PhotoResponse], status_code=status.HTTP_201_CREATED)
async def upload_photos(
    event_id: UUID,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify event exists
    event_stmt = select(Event).where(Event.id == event_id)
    event_res = await db.execute(event_stmt)
    event = event_res.scalar_one_or_none()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found."
        )

    # Verify authorization
    has_permission = await verify_contributor_permission(event.community_id, current_user.id, db)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: You must be a host or contributor to upload photos."
        )

    # Set event status to uploading
    event.status = "processing"

    uploaded_photos = []
    
    for file in files:
        if not file.content_type.startswith("image/"):
            continue # Skip non-images
            
        file_bytes = await file.read()
        
        # Calculate image md5 hash for duplicate detection
        file_hash = hashlib.md5(file_bytes).hexdigest()
        
        # Check if a photo with the same hash already exists in this event container
        dup_stmt = select(Photo).where(Photo.event_id == event_id, Photo.hash == file_hash)
        dup_res = await db.execute(dup_stmt)
        if dup_res.scalar_one_or_none():
            logger.warning(f"Ingestion reject: Duplicate photo detected '{file.filename}' with hash '{file_hash}' in event '{event_id}'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Image '{file.filename}' has already been uploaded to this event. Try a different one."
            )

        photo_id = uuid.uuid4()
        
        # Upload to Supabase Storage: events/{event_id}/{photo_id}.jpg
        storage_path = f"events/{event_id}/{photo_id}.jpg"
        try:
            public_url = await anyio.to_thread.run_sync(
                storage_service.upload_file,
                storage_path,
                file_bytes,
                file.content_type
            )
        except Exception as e:
            logger.error(f"Failed to upload photo to Supabase storage: {e}")
            continue

        # Write metadata to relational db
        new_photo = Photo(
            id=photo_id,
            event_id=event_id,
            storage_path=public_url,
            filename=file.filename,
            hash=file_hash,
            status="processing"
        )
        db.add(new_photo)
        uploaded_photos.append(new_photo)
        
        # Trigger background face analysis using PyTorch
        background_tasks.add_task(process_photo_faces, photo_id, file_bytes)

    await db.commit()
    
    # Refresh all objects
    for photo in uploaded_photos:
        await db.refresh(photo)

    return uploaded_photos

@router.post("/banner", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_banner_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Allows authenticated users to upload a custom banner image to Supabase Storage and returns the public url."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image."
        )
        
    file_bytes = await file.read()
    banner_id = uuid.uuid4()
    storage_path = f"banners/{banner_id}.jpg"
    
    try:
        # Run storage upload in thread pool to prevent blocking the event loop
        public_url = await anyio.to_thread.run_sync(
            storage_service.upload_file,
            storage_path,
            file_bytes,
            file.content_type
        )
    except Exception as e:
        logger.error(f"Failed to upload banner to Supabase storage: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload banner to cloud storage."
        )
        
    return {"banner_url": public_url}

