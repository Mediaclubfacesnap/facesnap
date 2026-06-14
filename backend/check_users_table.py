import asyncio
from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        res = await conn.execute(text("select column_name from information_schema.columns where table_name='users'"))
        cols = [r[0] for r in res.fetchall()]
        print("COLUMNS IN users:", cols)

asyncio.run(main())
