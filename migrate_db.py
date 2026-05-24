import asyncio
import asyncpg
import sys

DB_URL = "postgresql://postgres:Mediaclubfacesnap@db.bcahxnvuodsslmeqdnin.supabase.co:5432/postgres"

MIGRATION_SQL = """
-- 1. Alter community_roles table role check constraint
ALTER TABLE community_roles DROP CONSTRAINT IF EXISTS community_roles_role_check;
ALTER TABLE community_roles ADD CONSTRAINT community_roles_role_check CHECK (
    role IN ('host', 'admin', 'contributor', 'gallery_access', 'member_access', 'member')
);

-- 2. Alter contributor_requests table to add request_type
ALTER TABLE contributor_requests ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'gallery';
ALTER TABLE contributor_requests DROP CONSTRAINT IF EXISTS contributor_requests_request_type_check;
ALTER TABLE contributor_requests ADD CONSTRAINT contributor_requests_request_type_check CHECK (
    request_type IN ('contributor', 'upload', 'gallery', 'member')
);

-- 3. Re-create the uniqueness constraint to be based on (community_id, user_id, request_type)
ALTER TABLE contributor_requests DROP CONSTRAINT IF EXISTS uq_community_user_request;
ALTER TABLE contributor_requests DROP CONSTRAINT IF EXISTS contributor_requests_community_id_user_id_key;
ALTER TABLE contributor_requests ADD CONSTRAINT uq_community_user_request_type UNIQUE (community_id, user_id, request_type);
"""

async def run():
    print("Connecting to Supabase database...")
    try:
        conn = await asyncpg.connect(DB_URL, timeout=30)
    except Exception as e:
        print(f"Error connecting to database: {e}", file=sys.stderr)
        return

    print("Running migration SQL...")
    try:
        await conn.execute(MIGRATION_SQL)
        print("Database schema successfully upgraded!")
    except Exception as e:
        print(f"Migration failed: {e}", file=sys.stderr)
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
