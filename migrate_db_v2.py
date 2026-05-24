import asyncio
import asyncpg
import sys

DB_URL = "postgresql://postgres:Mediaclubfacesnap@db.bcahxnvuodsslmeqdnin.supabase.co:5432/postgres"

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
        conn = await asyncpg.connect(DB_URL, timeout=30)
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
