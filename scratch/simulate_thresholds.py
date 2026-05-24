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
        # Load a sample face embedding (we'll treat this as the scanned user)
        # We will find pairs from the same photo vs different photos
        pairs_res = await session.execute(text("""
            SELECT pf1.photo_id as pid1, pf2.photo_id as pid2, (pf1.embedding <=> pf2.embedding) as dist
            FROM photo_faces pf1
            JOIN photo_faces pf2 ON pf1.id < pf2.id
            LIMIT 500
        """))
        pairs = pairs_res.all()
        
    print(f"Loaded {len(pairs)} face pairs from the database. Analyzing cosine distance distributions...")
    
    thresholds = [0.25, 0.28, 0.30, 0.32, 0.35, 0.38, 0.40, 0.45]
    for t in thresholds:
        count = sum(1 for p in pairs if p.dist <= t)
        percent = (count / len(pairs)) * 100
        print(f"Threshold <= {t:.2f}: {count} pairs match ({percent:.2f}%)")

if __name__ == "__main__":
    asyncio.run(main())
