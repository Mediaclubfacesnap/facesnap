"""Inspect columns of user_sessions table"""
import asyncio
import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        print("--- Inspecting user_sessions table ---")
        result = await conn.execute(text(
            "SELECT column_name, data_type, is_nullable "
            "FROM information_schema.columns "
            "WHERE table_name = 'user_sessions' "
            "ORDER BY ordinal_position;"
        ))
        rows = result.fetchall()
        for row in rows:
            print(f"Column: {row[0]} | Type: {row[1]} | Nullable: {row[2]}")

if __name__ == '__main__':
    asyncio.run(main())
