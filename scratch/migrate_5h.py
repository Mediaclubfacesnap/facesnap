import asyncio
import sys
import os

# Ensure the backend directory is in the python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app.database import engine, Base
import app.models  # Registers all models

async def run_migrations():
    print("Running Phase 5H Database Migrations...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, checkfirst=True))
        print("Database schema successfully synchronized with new Phase 5H models!")
    except Exception as e:
        print(f"Error applying migrations: {e}")

if __name__ == "__main__":
    asyncio.run(run_migrations())
