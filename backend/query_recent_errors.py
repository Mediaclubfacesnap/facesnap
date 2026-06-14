"""Query recent database error logs"""
import asyncio
import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        print("--- Querying most recent error logs ---")
        result = await conn.execute(text(
            "SELECT id, endpoint, method, message, traceback, created_at "
            "FROM error_logs "
            "ORDER BY created_at DESC "
            "LIMIT 5;"
        ))
        rows = result.fetchall()
        if not rows:
            print("No error logs found.")
        for row in rows:
            print("=" * 80)
            print(f"Error ID: {row[0]}")
            print(f"Time: {row[5]}")
            print(f"Endpoint: {row[2]} {row[1]}")
            print(f"Message: {row[3]}")
            print("Traceback:")
            print(row[4])
            print("=" * 80)

if __name__ == '__main__':
    asyncio.run(main())
