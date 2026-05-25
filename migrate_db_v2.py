import asyncio
import asyncpg
import sys
import os
from dotenv import load_dotenv

# Load env
load_dotenv()

# Safely extract Database Connection URL from environment
RAW_DB_URL = os.getenv("DATABASE_URL")
if RAW_DB_URL:
    if RAW_DB_URL.startswith("postgresql+asyncpg://"):
        DB_URL = RAW_DB_URL.replace("postgresql+asyncpg://", "postgresql://")
    else:
        DB_URL = RAW_DB_URL
else:
    DB_URL = "postgresql://postgres.bcahxnvuodsslmeqdnin:Mediaclubfacesnap@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"


MIGRATION_SQL = """
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
    inviter_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    invitee_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(community_id, invitee_id)
);
"""

async def run():
    print("Connecting to Supabase database for v2 invitations schema...")
    try:
        conn = await asyncpg.connect(DB_URL, timeout=30, statement_cache_size=0)

    except Exception as e:
        print(f"Error connecting to database: {e}", file=sys.stderr)
        return

    print("Running invitations migration SQL...")
    try:
        await conn.execute(MIGRATION_SQL)
        print("Invitations table successfully deployed!")
    except Exception as e:
        print(f"Migration failed: {e}", file=sys.stderr)
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
