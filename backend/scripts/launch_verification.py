import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, AsyncSessionLocal
from app.services.cache_service import cache
from sqlalchemy import text

async def verify_launch():
    print("🚀 Starting Launch Verification...")
    
    # 1. Database Connection
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        print("✅ Database connection successful.")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False
        
    # 2. Redis Connection
    try:
        if cache.redis_client and cache.redis_client.ping():
            print("✅ Redis connection successful.")
        else:
            print("⚠️ Redis is not available or not configured.")
    except Exception as e:
        print(f"❌ Redis connection failed: {e}")
        return False
        
    print("🎉 All critical systems verified. Ready for launch.")
    return True

if __name__ == "__main__":
    success = asyncio.run(verify_launch())
    sys.exit(0 if success else 1)
