import asyncio
from app.database import engine
from sqlalchemy import text

async def main():
    try:
        async with engine.begin() as conn:
            print("Dropping NOT NULL constraint on community_roles.role...")
            await conn.execute(text("ALTER TABLE community_roles ALTER COLUMN role DROP NOT NULL;"))
        print("Successfully updated database schema!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
