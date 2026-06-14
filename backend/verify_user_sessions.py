"""Verify user sessions in database"""
import asyncio
import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        print("--- Querying last 5 user_sessions ---")
        result = await conn.execute(text(
            "SELECT id, user_id, jti, device_name, browser, expires_at, created_at "
            "FROM user_sessions "
            "ORDER BY created_at DESC "
            "LIMIT 5;"
        ))
        rows = result.fetchall()
        for row in rows:
            print(f"Session ID: {row[0]}")
            print(f"  User ID: {row[1]}")
            print(f"  JTI: {row[2]}")
            print(f"  Device Name: {row[3]}")
            print(f"  Browser: {row[4]}")
            print(f"  Expires At: {row[5]}")
            print(f"  Created At: {row[6]}")
            print("-" * 50)

if __name__ == '__main__':
    asyncio.run(main())
