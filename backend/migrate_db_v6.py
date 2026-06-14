import asyncio
from app.database import engine
from sqlalchemy import text
import traceback

async def main():
    try:
        async with engine.begin() as conn:
            # 1. Add visibility column to communities if it does not exist
            await conn.execute(text("ALTER TABLE communities ADD COLUMN IF NOT EXISTS visibility VARCHAR DEFAULT 'PRIVATE';"))
            
            # 2. Add archived_at column to communities if it does not exist
            await conn.execute(text("ALTER TABLE communities ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;"))
            
            # 3. Backfill existing communities with 'PRIVATE' if visibility is NULL
            await conn.execute(text("UPDATE communities SET visibility = 'PRIVATE' WHERE visibility IS NULL;"))
            
        print("Migration v6 applied successfully. Added `visibility` and `archived_at` columns to `communities`.")
    except Exception as e:
        print("Error applying migration v6:", e)
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
