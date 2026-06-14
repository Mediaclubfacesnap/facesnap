import asyncio
from app.database import engine
from sqlalchemy import text
import traceback

async def main():
    try:
        async with engine.begin() as conn:
            # Add message column to notifications if it does not exist
            await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;"))
            
            # Backfill existing rows with empty message or default value to prevent null constraint errors if nullable=False
            await conn.execute(text("UPDATE notifications SET message = '' WHERE message IS NULL;"))
            
            # Note: SQLAlchemy model says `message = Column(Text, nullable=False)`
            # So after backfilling, we shouldn't strictly alter the column to NOT NULL unless we want to,
            # but it's safe enough if the application always provides it now.
            
        print("Migration v5 applied successfully. Added `message` column to `notifications`.")
    except Exception as e:
        print("Error applying migration:", e)
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
