import asyncio
import asyncpg
import sys
import os
from dotenv import load_dotenv

load_dotenv()

RAW_DB_URL = os.getenv("DATABASE_URL")
if RAW_DB_URL:
    if RAW_DB_URL.startswith("postgresql+asyncpg://"):
        DB_URL = RAW_DB_URL.replace("postgresql+asyncpg://", "postgresql://")
    else:
        DB_URL = RAW_DB_URL
else:
    DB_URL = "postgresql://postgres.bcahxnvuodsslmeqdnin:Mediaclubfacesnap@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"

MIGRATION_SQL = """
-- 1. Add platform_role and can_create_communities to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_role TEXT DEFAULT 'user' NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_create_communities BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Create community_access_requests table
CREATE TABLE IF NOT EXISTS community_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending' NOT NULL,
    reason TEXT NOT NULL,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create event_access_requests table
CREATE TABLE IF NOT EXISTS event_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending' NOT NULL,
    reason TEXT NOT NULL,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
"""

async def run():
    print("Connecting to Database for V4 Migration (RBAC)...")
    try:
        conn = await asyncpg.connect(DB_URL, timeout=30, statement_cache_size=0)
    except Exception as e:
        print(f"Error connecting to database: {e}", file=sys.stderr)
        return

    print("Running migration...")
    try:
        await conn.execute(MIGRATION_SQL)
        print("Migration V4 completed successfully!")
    except Exception as e:
        print(f"Error executing migration: {e}", file=sys.stderr)
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
