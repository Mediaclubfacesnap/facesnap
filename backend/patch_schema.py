import asyncio
import os
import sys

# Add backend directory to sys.path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine
from sqlalchemy import text

async def main():
    try:
        async with engine.begin() as conn:
            print("Adding platform_role to users...")
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_role VARCHAR(50) DEFAULT 'user';"))
            
            print("Adding columns to communities...")
            await conn.execute(text("ALTER TABLE communities ADD COLUMN IF NOT EXISTS created_by UUID;"))
            await conn.execute(text("ALTER TABLE communities ADD COLUMN IF NOT EXISTS host_id UUID;"))
            await conn.execute(text("ALTER TABLE communities ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE communities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;"))
            
            print("Adding columns to events...")
            await conn.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by UUID;"))
            await conn.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_id UUID;"))
            await conn.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_url TEXT;"))
            await conn.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;"))
            await conn.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS max_participants INTEGER;"))
            await conn.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ;"))
            await conn.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS category VARCHAR(100);"))
        print("Done successfully!")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(main())
