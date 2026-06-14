"""List tables in public schema"""
import asyncio
import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        print("--- Listing public tables ---")
        result = await conn.execute(text(
            "SELECT table_name "
            "FROM information_schema.tables "
            "WHERE table_schema = 'public' "
            "ORDER BY table_name;"
        ))
        rows = result.fetchall()
        for row in rows:
            print(row[0])

if __name__ == '__main__':
    asyncio.run(main())
