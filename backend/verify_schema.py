import asyncio
from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position;"))
        rows = result.fetchall()
        print('User table columns:')
        for row in rows:
            print(row[0])

if __name__ == '__main__':
    asyncio.run(main())
