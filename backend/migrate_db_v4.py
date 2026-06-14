import asyncio
from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        # Add RBAC columns if they do not exist
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_role VARCHAR(50) DEFAULT 'user';"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_create_communities BOOLEAN DEFAULT FALSE;"))
        # Backfill existing rows
        await conn.execute(text("UPDATE users SET platform_role = 'user' WHERE platform_role IS NULL;"))
        await conn.execute(text("UPDATE users SET can_create_communities = FALSE WHERE can_create_communities IS NULL;"))
    print("Migration v4 applied successfully.")

if __name__ == "__main__":
    asyncio.run(main())
