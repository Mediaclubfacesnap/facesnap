import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
from app.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("SELECT count(*) FROM photo_faces"))
        count = res.scalar()
        print(f"Total faces in photo_faces table: {count}")

if __name__ == "__main__":
    asyncio.run(main())
