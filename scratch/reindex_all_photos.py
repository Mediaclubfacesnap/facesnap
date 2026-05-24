import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

import asyncio
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
from app.config import settings
from app.services.ai_service import AIService
from app.models import Photo, PhotoFace

async def reindex_photo(photo_id, storage_path, session):
    print(f"Re-indexing Photo {photo_id} from {storage_path}...")
    try:
        # Download photo bytes
        async with httpx.AsyncClient() as client:
            resp = await client.get(storage_path, timeout=30.0)
            if resp.status_code != 200:
                print(f"  [ERROR] Failed to download photo {photo_id}: HTTP {resp.status_code}")
                return False
            image_bytes = resp.content
            
        # Extract faces using the updated AIService (which now has post_process=True)
        # Note: we need to run CPU-heavy code in an executor or thread pool, but for a one-off script we can run directly
        faces = AIService.extract_faces(image_bytes)
        print(f"  Found {len(faces)} faces.")
        
        # Delete existing PhotoFace entries for this photo
        await session.execute(
            text("DELETE FROM photo_faces WHERE photo_id = :photo_id"),
            {"photo_id": photo_id}
        )
        
        # Insert new faces
        for face in faces:
            new_face = PhotoFace(
                photo_id=photo_id,
                bbox=face["bbox"],
                embedding=face["embedding"]
            )
            session.add(new_face)
            
        await session.commit()
        print(f"  [SUCCESS] Successfully re-indexed Photo {photo_id}")
        return True
    except Exception as e:
        print(f"  [ERROR] Failed to re-index Photo {photo_id}: {e}")
        await session.rollback()
        return False

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        # Get all photos that are successfully indexed or in processing
        res = await session.execute(
            text("SELECT id, storage_path FROM photos WHERE status = 'indexed'")
        )
        photos = res.all()
        
    print(f"Found {len(photos)} photos to re-index. Starting processing...")
    
    success_count = 0
    fail_count = 0
    
    for photo_id, storage_path in photos:
        # Create a new session for each photo to avoid large transaction locks
        async with AsyncSessionLocal() as session:
            success = await reindex_photo(photo_id, storage_path, session)
            if success:
                success_count += 1
            else:
                fail_count += 1
                
    print(f"\nRe-indexing completed. Success: {success_count}, Fail: {fail_count}")

if __name__ == "__main__":
    asyncio.run(main())
