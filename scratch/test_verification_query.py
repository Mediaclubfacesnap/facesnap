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
        # Get one face embedding to use as a "selfie"
        face_res = await session.execute(text("SELECT embedding FROM photo_faces LIMIT 1"))
        selfie_emb = face_res.scalar()
        if not selfie_emb:
            print("No faces in DB to test with.")
            return
            
        print(f"Loaded selfie embedding from DB (type: {type(selfie_emb)}). Running matching query...")
        
        # We need to find the event_id for this face
        event_res = await session.execute(text(
            "SELECT p.event_id FROM photo_faces pf JOIN photos p ON pf.photo_id = p.id LIMIT 1"
        ))
        event_id = event_res.scalar()
        
        # Run query with threshold 0.45
        query = text("""
            SELECT p.id, p.filename, (1.0 - (pf.embedding <=> :selfie_emb)) as confidence, (pf.embedding <=> :selfie_emb) as distance
            FROM photos p
            JOIN photo_faces pf ON p.id = pf.photo_id
            WHERE p.event_id = :event_id
            ORDER BY pf.embedding <=> :selfie_emb ASC
        """)
        
        res = await session.execute(query, {"selfie_emb": selfie_emb, "event_id": event_id})
        rows = res.all()
        print(f"Total rows in event container: {len(rows)}")
        
        print("\nMatches at different thresholds:")
        thresholds = [0.3, 0.4, 0.45, 0.5, 0.6, 1.0]
        for t in thresholds:
            matched = [r for r in rows if r.distance <= t]
            print(f" - Distance <= {t}: {len(matched)} matches")
            
        print("\nTop 10 matches:")
        for r in rows[:10]:
            print(f" - Photo: {r.filename}, Distance: {r.distance:.4f}, Confidence: {r.confidence:.4f}")

if __name__ == "__main__":
    asyncio.run(main())
