"""Query all recent error logs"""
import asyncio
import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        print("--- Querying 10 most recent error logs ---")
        result = await conn.execute(text(
            "SELECT id, endpoint, method, message, created_at "
            "FROM error_logs "
            "ORDER BY created_at DESC "
            "LIMIT 10;"
        ))
        rows = result.fetchall()
        for row in rows:
            print(f"ID: {row[0]} | Time: {row[4]} | {row[2]} {row[1]} | Message: {row[3]}")

if __name__ == '__main__':
    asyncio.run(main())
