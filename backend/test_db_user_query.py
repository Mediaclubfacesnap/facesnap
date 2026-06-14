"""Test select(User) query against DB"""
import asyncio
import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.database import engine, Base
from app.models import User
from sqlalchemy import select

async def main():
    print("Database URL:", engine.url)
    async with engine.begin() as conn:
        print("Checking connection...")
        try:
            async with AsyncSessionLocal() as session:
                pass
        except Exception:
            from app.database import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                print("Executing select(User)...")
                try:
                    stmt = select(User).limit(1)
                    res = await session.execute(stmt)
                    user = res.scalar_one_or_none()
                    print("User query succeeded! User:", user)
                    if user:
                        print("User username:", user.username)
                        print("User platform_role:", getattr(user, 'platform_role', 'NOT EXIST'))
                except Exception as e:
                    print("User query failed!")
                    import traceback
                    traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(main())
