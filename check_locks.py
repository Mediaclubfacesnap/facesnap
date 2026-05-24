import asyncio
import asyncpg
import sys

DB_URL = "postgresql://postgres:Mediaclubfacesnap@db.bcahxnvuodsslmeqdnin.supabase.co:5432/postgres"

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
        conn = await asyncpg.connect(DB_URL, timeout=30)
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
