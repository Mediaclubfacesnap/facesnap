import asyncio
import asyncpg
import sys

DB_URL = "postgresql://postgres:Mediaclubfacesnap@db.bcahxnvuodsslmeqdnin.supabase.co:5432/postgres"

MIGRATION_SQL = """
-- 1. Terminate stale user connections querying 'photos' to release active locks
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE usename = 'postgres' 
  AND pid <> pg_backend_pid() 
  AND (query LIKE '%photos%' OR state = 'idle in transaction');

-- 2. Add hash column to photos table
ALTER TABLE photos ADD COLUMN IF NOT EXISTS hash TEXT;

-- 3. Create unique index on event_id and hash where hash is not null
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_photo_hash ON photos (event_id, hash) WHERE hash IS NOT NULL;
"""

async def run():
    print("Connecting to Supabase database...")
    try:
        conn = await asyncpg.connect(DB_URL, timeout=30)
    except Exception as e:
        print(f"Error connecting to database: {e}", file=sys.stderr)
        return

    print("Running targeted lock termination and schema upgrades...")
    try:
        await conn.execute(MIGRATION_SQL)
        print("Database schema successfully upgraded with hash column and index!")
    except Exception as e:
        print(f"Migration failed: {e}", file=sys.stderr)
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
