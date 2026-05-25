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


DIAG_SQL = """
SELECT 
    a.pid,
    a.usename,
    a.client_addr,
    a.state,
    a.query,
    a.query_start,
    age(clock_timestamp(), a.query_start) AS age
FROM pg_stat_activity a
JOIN pg_locks l ON l.pid = a.pid
WHERE l.relation = 'photos'::regclass;
"""

async def run():
    print("Connecting to Supabase database...")
    try:
        conn = await asyncpg.connect(DB_URL, timeout=30, statement_cache_size=0)

    except Exception as e:
        print(f"Error connecting to database: {e}", file=sys.stderr)
        return

    print("Checking active locks on 'photos' table...")
    try:
        records = await conn.fetch(DIAG_SQL)
        if not records:
            print("No active locks found on 'photos' table!")
        else:
            print(f"Found {len(records)} active lock(s):")
            for r in records:
                print(f"PID: {r['pid']}, State: {r['state']}, Age: {r['age']}, Query: {r['query']}")
    except Exception as e:
        print(f"Locks diagnosis failed: {e}", file=sys.stderr)
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
