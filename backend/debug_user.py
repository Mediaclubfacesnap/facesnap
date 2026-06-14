"""Debug: test what happens when login fails"""
import sys
import asyncio
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.database import AsyncSessionLocal
from app.models import User
from app.schemas import UserResponse
from sqlalchemy.future import select

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == 'rec99@facesnap.dev'))
        user = result.scalar_one_or_none()
        if user:
            print(f"User found: {user.email}")
            print(f"  platform_role: {user.platform_role}")
            print(f"  face_matching_enabled: {user.face_matching_enabled}")
            print(f"  can_create_communities: {user.can_create_communities}")
            print(f"  password_hash: {user.password_hash[:20]}...")
            
            # Try to serialize
            try:
                ur = UserResponse.model_validate(user)
                print(f"  UserResponse serialization: OK")
            except Exception as e:
                print(f"  UserResponse serialization FAILED: {e}")
        else:
            print("User not found")
            
        # Test login with non-existent email
        result2 = await db.execute(select(User).where(User.email == 'nobody@x.com'))
        user2 = result2.scalar_one_or_none()
        print(f"nobody@x.com user: {user2}")

asyncio.run(main())
