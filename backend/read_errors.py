import asyncio
from app.database import get_db, engine
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

async def read_logs():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT traceback FROM error_logs ORDER BY created_at DESC LIMIT 1"))
        row = res.fetchone()
        if row:
            print("=== LATEST ERROR LOG ===")
            print(row[0])
        else:
            print("No error logs found.")

if __name__ == "__main__":
    asyncio.run(read_logs())
