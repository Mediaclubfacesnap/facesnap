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
        # Get count of photo faces
        faces_res = await session.execute(text("SELECT COUNT(*) FROM photo_faces"))
        faces_count = faces_res.scalar()
        print(f"Total photo faces in DB: {faces_count}")
        
        # Test similarity distance between different faces currently in the DB
        # If they are saturated, the distance will be <= 0.05
        # If they are correct, the distance will be much larger (0.5 to 1.2) for different faces
        dist_res = await session.execute(text("""
            SELECT pf1.photo_id as id1, pf2.photo_id as id2, (pf1.embedding <=> pf2.embedding) as dist
            FROM photo_faces pf1
            JOIN photo_faces pf2 ON pf1.id < pf2.id
            WHERE pf1.photo_id != pf2.photo_id
            LIMIT 10
        """))
        rows = dist_res.all()
        print("\nSample distances between different faces in DB:")
        for r in rows:
            print(f" - Photo {r.id1} vs Photo {r.id2}: distance = {r.dist:.4f}")
            
        # Calculate how many faces have saturated embeddings
        # Let's count pairs that are extremely close
        count_close_res = await session.execute(text("""
            SELECT COUNT(*) FROM (
                SELECT (pf1.embedding <=> pf2.embedding) as dist
                FROM photo_faces pf1
                JOIN photo_faces pf2 ON pf1.id < pf2.id
                WHERE pf1.photo_id != pf2.photo_id
                LIMIT 100
            ) t WHERE dist <= 0.05
        """))
        close_pairs = count_close_res.scalar()
        print(f"\nSaturated/close pairs percentage in sample: {close_pairs}% (if near 100%, re-indexing has not updated these records yet)")

if __name__ == "__main__":
    asyncio.run(main())
