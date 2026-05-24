import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
from app.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        # Check photos
        photos_count_res = await session.execute(text("SELECT COUNT(*) FROM photos"))
        photos_count = photos_count_res.scalar()
        print(f"Total photos in DB: {photos_count}")
        
        # Check indexed status
        photos_status_res = await session.execute(text("SELECT status, COUNT(*) FROM photos GROUP BY status"))
        print("Photos status count:")
        for r in photos_status_res.all():
            print(f" - {r[0]}: {r[1]}")
            
        # Check photo faces
        faces_count_res = await session.execute(text("SELECT COUNT(*) FROM photo_faces"))
        faces_count = faces_count_res.scalar()
        print(f"Total photo faces in DB: {faces_count}")
        
        # Check if any event has photos
        events_photos_res = await session.execute(text("SELECT event_id, COUNT(*) FROM photos GROUP BY event_id"))
        print("Events with photos:")
        for r in events_photos_res.all():
            print(f" - Event {r[0]}: {r[1]} photos")
            
        # Let's inspect some photo faces embeddings to make sure they are not all zeros or identical
        faces_sample = await session.execute(text("SELECT id, photo_id, bbox, SUBSTRING(embedding::text, 1, 100) FROM photo_faces LIMIT 5"))
        print("Sample photo faces:")
        for r in faces_sample.all():
            print(f" - Face {r[0]} for Photo {r[1]} (bbox: {r[2]}): {r[3]}...")

if __name__ == "__main__":
    asyncio.run(main())
